import { CONFIG } from './config.js';
import { logger } from './utils/logger.js';
import { Frontier } from './crawler/frontier.js';
import { fetchHtml } from './crawler/fetcher.js';
import { extractBasicDocument, extractLinks, hashHtml } from './crawler/extractor.js';
import { isHttpUrl } from './utils/url.js';
import { storeDocument, upsertMatches } from './pipelines/store.js';
import { ExamplePortalAdapter } from './adapters/examplePortal.js';
import { Adapter, CrawlTask } from './types.js';

const adapters: Adapter[] = [
  new ExamplePortalAdapter()
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
    if (matches.length) await upsertMatches(matches);

    // descoberta controlada (segue apenas links whitelisted do mesmo adapter)
    for (const link of nextLinks) {
      try {
        const abs = new URL(link, task.url).toString();
        if (isHttpUrl(abs) && adapter.whitelistPatterns.some(p => p.test(abs))) {
          frontier.push({ url: abs, depth: task.depth + 1, priority: (task.priority ?? 0) - 1 });
        }
      } catch {}
    }
  } else {
    // fallback: descoberta básica, mas SEM seguir (mantemos seguro no esqueleto)
    const _links = extractLinks(task.url, html);
    // aqui poderíamos filtrar por mesmo domínio, etc.
  }
}

async function main() {
  if (CONFIG.seeds.length === 0) {
    logger.warn('Nenhuma seed definida. Configure SEEDS no .env');
    process.exit(1);
  }

  logger.info({ seeds: CONFIG.seeds }, 'Iniciando crawler');
  const frontier = new Frontier();

  for (const seed of CONFIG.seeds) {
    frontier.push({ url: seed, depth: 0, priority: 100 });
  }

  // loop simples (single-thread) — fácil de evoluir para worker-pool
  let processed = 0;
  const MAX_PAGES = 200; // ajuste para seus testes locais

  while (frontier.size() > 0 && processed < MAX_PAGES) {
    const task = frontier.pop()!;
    try {
      await processTask(task, frontier);
    } catch (e: any) {
      logger.error({ url: task.url, err: e?.message }, 'Falha task');
    }
    processed++;
  }

  logger.info({ processed }, 'Crawler finalizado (limite atingido ou frontier vazia)');
}

main().catch(err => {
  logger.fatal({ err }, 'Erro fatal');
  process.exit(1);
});
