import * as cheerio from 'cheerio';
import { CRAWLER_CONFIG } from './config';
import { CrawlFrontier } from './crawler/frontier';
import { fetchHtml } from './crawler/fetcher';
import { createDocumentMetadata, extractUniqueLinks } from './crawler/extractor';
import { isHttpOrHttpsUrl } from './utils/url';
import { EspnTeamAgendaAdapter } from './adapters/espnTeamAgenda';
import { GeTeamAgendaAdapter } from './adapters/geTeamAgenda';
import { CbfAdapter } from './adapters/cbfAdapter';
import { UolOndeAssistirAdapter } from './adapters/uolOndeAssistir';
import { LanceAgendaAdapter } from './adapters/lanceAgenda';
import { OneFootballAdapter } from './adapters/oneFootball';
import { GenericSportsNewsAdapter } from './adapters/genericSportsNews';
import { Adapter, CrawlTask, PageType } from './types';
import { scheduleDocumentPersist, scheduleMatchesPersist, flushPipelineQueues } from './pipelines/pipelineQueue';
import { saveMetrics } from './utils/metrics';
import { finalizeInvertedIndex } from './indexing/invertedIndex';
import { isBlockedUrl } from './utils/urlFilters';

const adapters: Adapter[] = [
  new GeTeamAgendaAdapter(),
  new EspnTeamAgendaAdapter(),
  new CbfAdapter(),
  new UolOndeAssistirAdapter(),
  new LanceAgendaAdapter(),
  new OneFootballAdapter(),
  new GenericSportsNewsAdapter()
];

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const FALLBACK_LINK_LIMIT = Math.max(0, CRAWLER_CONFIG.fallbackLinkLimit ?? 0);

const PAGE_PRIORITY_BOOST: Record<PageType, number> = {
  agenda: 25,
  'onde-assistir': 22,
  tabela: 18,
  match: 18,
  team: 12,
  noticia: 6,
  outro: 0
};

function findAdapterForUrl(url: string): Adapter | undefined {
  const normalizedUrl = url.toLowerCase();
  return adapters.find(adapter => adapter.whitelistPatterns.some(pattern => pattern.test(normalizedUrl)));
}

function computeNextPriority(adapter: Adapter, url: string, parentPriority: number | undefined): number {
  const pageType = adapter.classify(url);
  const boost = PAGE_PRIORITY_BOOST[pageType] ?? 0;
  const base = parentPriority ?? 0;
  return base - 1 + boost;
}

async function processCrawlTask(crawlerTask: CrawlTask, frontier: CrawlFrontier): Promise<{ matches: number } | undefined> {
  if (isBlockedUrl(crawlerTask.url)) return { matches: 0 };

  const response = await fetchHtml(crawlerTask.url);
  if (!response) return { matches: 0 };

  const html = response.body;
  const dom = cheerio.load(html);
  const selectedAdapter = findAdapterForUrl(crawlerTask.url);
  const pageType = selectedAdapter ? selectedAdapter.classify(crawlerTask.url) : 'outro';
  const documentRecord = createDocumentMetadata(crawlerTask.url, html, pageType, dom);
  documentRecord.metadata.status = response.statusCode;

  scheduleDocumentPersist(documentRecord);
  if (selectedAdapter) {

    const { matches = [], nextLinks = [] } = selectedAdapter.extract(html, crawlerTask.url, dom);
    if (matches.length) {
      scheduleMatchesPersist(matches);
    }

    if (nextLinks.length) {
      for (const link of nextLinks) {
        try {
          const currentLink = new URL(link, crawlerTask.url).toString();
          if (isBlockedUrl(currentLink)) continue;
          if (!isHttpOrHttpsUrl(currentLink)) continue;
          if (!selectedAdapter.whitelistPatterns.some(pattern => pattern.test(currentLink))) continue;
          if (frontier.has(currentLink)) continue;

          const nextPriority = computeNextPriority(selectedAdapter, currentLink, crawlerTask.priority);
          frontier.push({
            url: currentLink,
            depth: (crawlerTask.depth ?? 0) + 1,
            priority: nextPriority
          });
        } catch {
          // ignore malformed URLs
        }
      }
    }

    return { matches: matches.length };
  }

  if (FALLBACK_LINK_LIMIT > 0) {
    const fallbackLinks = extractUniqueLinks(crawlerTask.url, html, dom)
      .filter(link => isHttpOrHttpsUrl(link) && !isBlockedUrl(link));

    for (const rawLink of fallbackLinks.slice(0, FALLBACK_LINK_LIMIT)) {
      try {
        if (frontier.has(rawLink)) continue;
        frontier.push({
          url: rawLink,
          depth: (crawlerTask.depth ?? 0) + 1,
          priority: (crawlerTask.priority ?? 0) - 2
        });
      } catch {
        // ignore malformed URLs
      }
    }
  }

  return { matches: 0 };
}

async function main() {
  if (CRAWLER_CONFIG.seeds.length === 0) {
    console.log('Nenhuma seed definida. Configure SEEDS no .env');
    process.exit(1);
  }

  const startTime = new Date().toISOString();
  const startTimestamp = Date.now();
  console.log({ seeds: CRAWLER_CONFIG.seeds }, 'Iniciando crawler');
  const frontier = new CrawlFrontier();

  for (const seed of CRAWLER_CONFIG.seeds) {
    frontier.push({ url: seed, depth: 0, priority: 100 });
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

  async function worker(workerId: number) {
    while (true) {
      if (stopRequested) break;
      if (CRAWLER_CONFIG.maxRuntimeMs > 0 && Date.now() - startTimestamp >= CRAWLER_CONFIG.maxRuntimeMs) {
        stopRequested = true;
        stopReason = stopReason ?? 'runtime_limit';
        break;
      }
      if (statistics.processed >= maxPagesToProcess) {
        stopRequested = true;
        stopReason = stopReason ?? 'max_pages';
        break;
      }

      const task = frontier.pop();
      if (!task) {
        if (stopRequested) break;
        if (activeFetches === 0 && frontier.size() === 0) {
          stopRequested = true;
          stopReason = stopReason ?? 'frontier_empty';
          break;
        }
        await sleep(25);
        continue;
      }

      activeFetches++;
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

        const result = await processCrawlTask(task, frontier);
        if (result?.matches) statistics.matchesFound += result.matches;
        const domain = new URL(task.url).hostname;
        sourceBreakdown[domain] = (sourceBreakdown[domain] || 0) + 1;
      } catch (e: any) {
        console.log({ worker: workerId, url: task.url, err: e?.message }, 'Falha task');
        statistics.errorCount++;
      } finally {
        activeFetches--;
        statistics.processed++;
        if (statistics.processed >= maxPagesToProcess) {
          stopRequested = true;
          stopReason = stopReason ?? 'max_pages';
        }
      }
    }
  }

  const workers = Array.from({ length: concurrency }, (_, index) => worker(index + 1));
  await Promise.all(workers);
  await flushPipelineQueues();

  const endTime = new Date().toISOString();
  console.log(
    {
      processed: statistics.processed,
      matchesFound: statistics.matchesFound,
      errorCount: statistics.errorCount,
      visited: frontier.visitedCount(),
      stopReason
    },
    'Crawler finalizado'
  );
  
  saveMetrics({
    startTime,
    endTime,
    pagesProcessed: statistics.processed,
    matchesFound: statistics.matchesFound,
    errorCount: statistics.errorCount,
    sourceBreakdown,
    stopReason: stopReason ?? undefined
  });
  finalizeInvertedIndex();
}

main().catch(async err => {
  console.log({ err }, 'Erro fatal');
  await flushPipelineQueues();
  finalizeInvertedIndex();
  process.exit(1);
});

