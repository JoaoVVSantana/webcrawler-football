import { CONFIG } from './config';
import { Frontier } from './crawler/frontier';
import { fetchHtml } from './crawler/fetcher';
import { extractBasicDocument, extractLinks, hashHtml } from './crawler/extractor';
import { isHttpUrl } from './utils/url';
import { storeDocument, upsertMatches } from './pipelines/store';
import { EspnTeamAgendaAdapter } from './adapters/espnTeamAgenda';
import { GeTeamAgendaAdapter } from './adapters/geTeamAgenda';
import { Adapter, CrawlTask } from './types';
import { saveMatchesToCsv } from './pipelines/csvStore';

const adapters: Adapter[] = [
  new GeTeamAgendaAdapter(),
  new EspnTeamAgendaAdapter()
];

function pickAdapter(url: string): Adapter | undefined {
  const u = url.toLowerCase();
  return adapters.find(a => a.whitelistPatterns.some(p => p.test(u)));
}

async function processTask(task: CrawlTask, frontier: Frontier) {
  const res = await fetchHtml(task.url);
  if (!res) return;

  const html = res.body;
  const doc = extractBasicDocument(task.url, html);
  doc.status = res.statusCode;

  await storeDocument(doc);

  const adapter = pickAdapter(task.url);
  if (adapter) {
  
    const { matches = [], nextLinks = [] } = adapter.extract(html, task.url);
    //console.log({ url: task.url, found: matches.length }, 'EXTRACT');
    if (matches.length) 
    {
      await upsertMatches(matches);      
      await saveMatchesToCsv(matches);    
    }

    for (const link of nextLinks) 
    {
      try 
      {
        const abs = new URL(link, task.url).toString();

        if (!isHttpUrl(abs)) continue;

        if (!adapter.whitelistPatterns.some(p => p.test(abs))) continue;

        if (frontier.has(abs)) continue; // <-- evita duplicar

        frontier.push({ url: abs, depth: (task.depth ?? 0) + 1, priority: (task.priority ?? 0) - 1 });
      } 
      catch { }
    }

  } else {
    const _links = extractLinks(task.url, html);
  }
}

async function main() {
  if (CONFIG.seeds.length === 0) {
    //console.log('Nenhuma seed definida. Configure SEEDS no .env');
    process.exit(1);
  }

  //console.log({ seeds: CONFIG.seeds }, 'Iniciando crawler');
  const frontier = new Frontier();

  for (const seed of CONFIG.seeds) {
    frontier.push({ url: seed, depth: 0, priority: 100 });
  }

  let processed = 0;
  const MAX_PAGES = 200;

  while (frontier.size() > 0 && processed < MAX_PAGES) 
  {
    const task = frontier.pop()!;
    try 
    {
      await processTask(task, frontier);
    } 
    catch (e: any) 
    {
      console.log({ url: task.url, err: e?.message }, 'Falha task');
    }
    processed++;
  }

  //console.log({ processed }, 'Crawler finalizado (limite atingido ou frontier vazia)');
}

main().catch(err => {
  console.log({ err }, 'Erro fatal');
  process.exit(1);
});

