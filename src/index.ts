import { CRAWLER_CONFIG } from './config';
import { CrawlFrontier } from './crawler/frontier';
import { fetchHtml } from './crawler/fetcher';
import { createDocumentMetadata, extractUniqueLinks } from './crawler/extractor';
import { isHttpOrHttpsUrl } from './utils/url';
import { persistDocumentMetadata, persistMatches } from './pipelines/store';
import { EspnTeamAgendaAdapter } from './adapters/espnTeamAgenda';
import { GeTeamAgendaAdapter } from './adapters/geTeamAgenda';
import { CbfAdapter } from './adapters/cbfAdapter';
import { UolOndeAssistirAdapter } from './adapters/uolOndeAssistir';
import { LanceAgendaAdapter } from './adapters/lanceAgenda';
import { OneFootballAdapter } from './adapters/oneFootball';
import { Adapter, CrawlTask } from './types';
import { appendMatchesToCsv } from './pipelines/csvStore';
import { saveMetrics } from './utils/metrics';
import { finalizeInvertedIndex } from './indexing/invertedIndex';

const adapters: Adapter[] = [
  new GeTeamAgendaAdapter(),
  new EspnTeamAgendaAdapter(),
  new CbfAdapter(),
  new UolOndeAssistirAdapter(),
  new LanceAgendaAdapter(),
  new OneFootballAdapter()
];

function findAdapterForUrl(url: string): Adapter | undefined {
  const normalizedUrl = url.toLowerCase();
  return adapters.find(adapter => adapter.whitelistPatterns.some(pattern => pattern.test(normalizedUrl)));
}

async function processCrawlTask(crawlerTask: CrawlTask, frontier: CrawlFrontier): Promise<{ matches: number } | undefined> {
  const response = await fetchHtml(crawlerTask.url);
  if (!response) return { matches: 0 };

  const html = response.body;
  const documentRecord = createDocumentMetadata(crawlerTask.url, html);
  documentRecord.metadata.status = response.statusCode;

  await persistDocumentMetadata(documentRecord);

  const selectedAdapter = findAdapterForUrl(crawlerTask.url);
  if (selectedAdapter) {

    const { matches = [], nextLinks = [] } = selectedAdapter.extract(html, crawlerTask.url);
    //console.log({ url: task.url, found: matches.length }, 'EXTRACT');
    if (matches.length) 
    {
      await persistMatches(matches);      
      await appendMatchesToCsv(matches);
      return { matches: matches.length };
    }

    for (const link of nextLinks) 
    {
      try 
      {
        const currentLink = new URL(link, crawlerTask.url).toString();

        if (!isHttpOrHttpsUrl(currentLink)) continue;

        if (!selectedAdapter.whitelistPatterns.some(pattern => pattern.test(currentLink))) continue;

        if (frontier.has(currentLink)) continue; // <-- evita duplicar

        frontier.push({ url: currentLink, depth: (crawlerTask.depth ?? 0) + 1, priority: (crawlerTask.priority ?? 0) - 1 });
      } 
      catch { }
    }

  } else {
    const _links = extractUniqueLinks(crawlerTask.url, html);
  }
  return { matches: 0 };
}

async function main() {
  if (CRAWLER_CONFIG.seeds.length === 0) {
    console.log('Nenhuma seed definida. Configure SEEDS no .env');
    process.exit(1);
  }

  const startTime = new Date().toISOString();
  console.log({ seeds: CRAWLER_CONFIG.seeds }, 'Iniciando crawler');
  const frontier = new CrawlFrontier();

  for (const seed of CRAWLER_CONFIG.seeds) {
    frontier.push({ url: seed, depth: 0, priority: 100 });
  }

  let processed = 0;
  let matchesFound = 0;
  let errorCount = 0;
  const sourceBreakdown: Record<string, number> = {};
  const maxPagesToProcess = 3000;

  while (frontier.size() > 0 && processed < maxPagesToProcess) 
  {
    const task = frontier.pop()!;
    try 
    {
      console.log({ processed: processed + 1, total: maxPagesToProcess, url: task.url }, 'Processando');
      const result = await processCrawlTask(task, frontier);
      if (result?.matches) matchesFound += result.matches;
      const domain = new URL(task.url).hostname;
      sourceBreakdown[domain] = (sourceBreakdown[domain] || 0) + 1;

    } 
    catch (e: any) 
    {
      console.log({ url: task.url, err: e?.message }, 'Falha task');
      errorCount++;
    }
    processed++;
  }

  const endTime = new Date().toISOString();
  console.log({ processed, matchesFound, errorCount }, 'Crawler finalizado');
  
  saveMetrics({
    startTime,
    endTime,
    pagesProcessed: processed,
    matchesFound,
    errorCount,
    sourceBreakdown
  });
  finalizeInvertedIndex();
}

main().catch(err => {
  console.log({ err }, 'Erro fatal');
  finalizeInvertedIndex();
  process.exit(1);
});

