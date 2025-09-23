import { CRAWLER_CONFIG } from './config';
import { CrawlFrontier } from './crawler/frontier';
import { fetchHtml } from './crawler/fetcher';
import { createDocumentMetadata, extractUniqueLinks } from './crawler/extractor';
import { isHttpOrHttpsUrl } from './utils/url';
import { persistDocumentMetadata, persistMatches } from './pipelines/store';
import { EspnTeamAgendaAdapter } from './adapters/espnTeamAgenda';
import { GeTeamAgendaAdapter } from './adapters/geTeamAgenda';
import { Adapter, CrawlTask } from './types';
import { appendMatchesToCsv } from './pipelines/csvStore';

const adapters: Adapter[] = [
  new GeTeamAgendaAdapter(),
  new EspnTeamAgendaAdapter()
];

function findAdapterForUrl(url: string): Adapter | undefined {
  const normalizedUrl = url.toLowerCase();
  return adapters.find(adapter => adapter.whitelistPatterns.some(pattern => pattern.test(normalizedUrl)));
}

async function processCrawlTask(crawlerTask: CrawlTask, frontier: CrawlFrontier) {
  const response = await fetchHtml(crawlerTask.url);
  if (!response) return;

  const html = response.body;
  const documentMetadata = createDocumentMetadata(crawlerTask.url, html);
  documentMetadata.status = response.statusCode;

  await persistDocumentMetadata(documentMetadata);

  const selectedAdapter = findAdapterForUrl(crawlerTask.url);
  if (selectedAdapter) {

    const { matches = [], nextLinks = [] } = selectedAdapter.extract(html, crawlerTask.url);
    //console.log({ url: task.url, found: matches.length }, 'EXTRACT');
    if (matches.length) 
    {
      await persistMatches(matches);      
      await appendMatchesToCsv(matches);    
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
}

async function main() {
  if (CRAWLER_CONFIG.seeds.length === 0) {
    console.log('Nenhuma seed definida. Configure SEEDS no .env');
    process.exit(1);
  }

  console.log({ seeds: CRAWLER_CONFIG.seeds }, 'Iniciando crawler');
  const frontier = new CrawlFrontier();

  for (const seed of CRAWLER_CONFIG.seeds) {
    frontier.push({ url: seed, depth: 0, priority: 100 });
  }

  let processed = 0;
  const maxPagesToProcess = 200;

  while (frontier.size() > 0 && processed < maxPagesToProcess) 
  {
    const task = frontier.pop()!;
    try 
    {
      await processCrawlTask(task, frontier);

    } 
    catch (e: any) 
    {
      console.log({ url: task.url, err: e?.message }, 'Falha task');
    }
    processed++;
  }

  console.log({ processed }, 'Crawler finalizado');
}

main().catch(err => {
  console.log({ err }, 'Erro fatal');
  process.exit(1);
});

