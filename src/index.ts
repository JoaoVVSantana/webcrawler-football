import * as cheerio from 'cheerio';
import { CRAWLER_CONFIG } from './config';
import { CrawlFrontier } from './crawler/frontier';
import { fetchHtml } from './crawler/fetcher';
import { createDocumentMetadata, extractUniqueLinks } from './crawler/extractor';
import { isHttpOrHttpsUrl } from './utils/url';
import { CrawlTask } from './types';
import { scheduleDocumentPersist, flushPipelineQueues, shutdownDocumentPipeline } from './pipelines/pipelineQueue';
import { saveMetrics } from './utils/metrics';
import { isBlockedUrl } from './utils/urlFilters';

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const MAX_LINKS_PER_PAGE = Math.max(0, CRAWLER_CONFIG.fallbackLinkLimit ?? 0);
const PROCESS_ALL_LINKS = CRAWLER_CONFIG.processAllLinksFromPage !== false;
const INITIAL_PRIORITY = 100;
const PRIORITY_DECAY = 1;

async function processCrawlTask(
  crawlerTask: CrawlTask,
  frontier: CrawlFrontier,
  workerId: number,
  signal?: AbortSignal
): Promise<void> {
  if (isBlockedUrl(crawlerTask.url)) return;

  const response = await fetchHtml(crawlerTask.url, workerId, signal);
  if (!response) return;

  const html = response.body;
  const dom = cheerio.load(html);
  const documentRecord = createDocumentMetadata(crawlerTask.url, html, undefined, dom);
  documentRecord.metadata.status = response.statusCode;

  scheduleDocumentPersist(documentRecord);

  const outgoingLinks = extractUniqueLinks(crawlerTask.url, html, dom).filter(
    link => isHttpOrHttpsUrl(link) && !isBlockedUrl(link)
  );

  const nextPriority = (crawlerTask.priority ?? INITIAL_PRIORITY) - PRIORITY_DECAY;
  const shouldLimitLinks = MAX_LINKS_PER_PAGE > 0;
  const linksToEnqueue = shouldLimitLinks ? outgoingLinks.slice(0, MAX_LINKS_PER_PAGE) : outgoingLinks;
  const deferredLinks = shouldLimitLinks ? outgoingLinks.slice(MAX_LINKS_PER_PAGE) : [];

  for (const link of linksToEnqueue) {
    try {
      frontier.pushIfAbsent({
        url: link,
        depth: (crawlerTask.depth ?? 0) + 1,
        priority: nextPriority
      });
    } catch {
      // ignore malformed URLs
    }
  }

  if (PROCESS_ALL_LINKS && deferredLinks.length > 0) {
    deferredLinks.forEach((link, index) => {
      try {
        frontier.pushIfAbsent({
          url: link,
          depth: (crawlerTask.depth ?? 0) + 1,
          priority: nextPriority - (index + 1) * PRIORITY_DECAY
        });
      } catch {
        // ignore malformed URLs
      }
    });
  }
}

async function main() {
  if (CRAWLER_CONFIG.seeds.length === 0) {
    console.log('Nenhuma seed definida. Configure SEEDS no .env');
    process.exit(1);
  }

  const startTime = new Date().toISOString();
  const startTimestamp = Date.now();
  console.log({ seeds: CRAWLER_CONFIG.seeds }, 'Iniciando crawler');
  const frontier = new CrawlFrontier({
    maxDepth: CRAWLER_CONFIG.maxDepth,
    strategy: CRAWLER_CONFIG.frontierStrategy
  });

  for (const seed of CRAWLER_CONFIG.seeds) {
    frontier.push({ url: seed, depth: 0, priority: INITIAL_PRIORITY });
  }

  const statistics = {
    processed: 0,
    matchesFound: 0,
    errorCount: 0
  };
  const sourceBreakdown: Record<string, number> = {};
  const maxPagesToProcess = Number(process.env.MAX_PAGES ?? 60000);
  const concurrency = Math.max(1, CRAWLER_CONFIG.globalMaxConcurrency);
  let stopRequested = false;
  let stopReason: string | null = null;
  let activeFetches = 0;
  const activeControllers = new Map<number, AbortController>();

  function cancelActiveFetches(): void {
    activeControllers.forEach(controller => controller.abort());
    activeControllers.clear();
  }

  function requestStop(reason: string) {
    const wasRequested = stopRequested;
    stopRequested = true;
    stopReason = stopReason ?? reason;
    if (!wasRequested) {
      cancelActiveFetches();
    }
  }

  const cleanupHandlers: Array<() => void> = [];

  function assembleMetrics() {
    const endTime = new Date().toISOString();
    const durationSeconds = Math.max(1, (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
    const pagesPerSecond = statistics.processed / durationSeconds;
    return {
      startTime,
      endTime,
      pagesProcessed: statistics.processed,
      matchesFound: statistics.matchesFound,
      errorCount: statistics.errorCount,
      pagesPerSecond,
      sourceBreakdown,
      stopReason: stopReason ?? undefined
    };
  }

  async function worker(workerId: number) {
    let emptyCycles = 0;
    while (true) {
      if (stopRequested) break;
      if (CRAWLER_CONFIG.maxRuntimeMs > 0 && Date.now() - startTimestamp >= CRAWLER_CONFIG.maxRuntimeMs) {
        requestStop('runtime_limit');
        break;
      }
      if (statistics.processed >= maxPagesToProcess) {
        requestStop('max_pages');
        break;
      }

      const task = frontier.pop();
      if (!task) {
        emptyCycles++;
        if (emptyCycles % 100 === 0) {
          console.log(
            {
              worker: workerId,
              frontierSize: frontier.size(),
              activeFetches,
              processed: statistics.processed
            },
            'Worker aguardando tarefas'
          );
        }
        if (stopRequested) break;
        if (activeFetches === 0 && frontier.size() === 0) {
          requestStop('frontier_empty');
          break;
        }
        await sleep(5);
        continue;
      }
      emptyCycles = 0;

      activeFetches++;
      const controller = new AbortController();
      activeControllers.set(workerId, controller);
      try {
        console.log(
          {
            worker: workerId,
            processed: statistics.processed + 1,
            target: maxPagesToProcess,
            url: task.url
          },
          'Processando'
        );

        await processCrawlTask(task, frontier, workerId, controller.signal);
        const domain = new URL(task.url).hostname;
        sourceBreakdown[domain] = (sourceBreakdown[domain] || 0) + 1;
      } catch (e: any) {
        console.log({ worker: workerId, url: task.url, err: e?.message }, 'Falha task');
        statistics.errorCount++;
      } finally {
        activeFetches--;
        statistics.processed++;
        activeControllers.delete(workerId);
        if (statistics.processed >= maxPagesToProcess) {
          requestStop('max_pages');
        }
      }
    }
  }

  const workers = Array.from({ length: concurrency }, (_, index) => worker(index + 1));
  const workersPromise = Promise.all(workers);
  let finalizationPromise: Promise<void> | null = null;

  const finalizeRun = (reason?: string): Promise<void> => {
    if (finalizationPromise) return finalizationPromise;
    finalizationPromise = (async () => {
      if (reason) requestStop(reason);
      try {
        await workersPromise;
      } catch (err) {
        console.error({ err }, 'Erro ao aguardar workers');
        requestStop('worker_error');
      } finally {
        for (const dispose of cleanupHandlers) dispose();
      }

      try {
        await flushPipelineQueues();
      } catch (err) {
        console.error({ err }, 'Falha ao esvaziar pipelines');
      }

      try {
        await shutdownDocumentPipeline();
      } catch (err) {
        console.error({ err }, 'Falha ao encerrar pipeline de documentos');
      }

      const metricsPayload = assembleMetrics();
      try {
        saveMetrics(metricsPayload);
      } catch (err) {
        console.error({ err }, 'Falha ao salvar métricas');
      }

      console.log(
        {
          ...metricsPayload,
          visited: frontier.visitedCount()
        },
        'Crawler finalizado'
      );
    })();
    return finalizationPromise;
  };

  const handleSignal = (signal: NodeJS.Signals) => {
    console.log({ signal }, 'Sinal recebido, finalizando crawler...');
    finalizeRun('manual_stop').finally(() => process.exit(0));
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);
  cleanupHandlers.push(() => {
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
  });

  await finalizeRun();
}

main().catch(async err => {
  console.log({ err }, 'Erro fatal');
  process.exit(1);
});
