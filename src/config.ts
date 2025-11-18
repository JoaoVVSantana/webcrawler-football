import 'dotenv/config';
import fs from 'fs';
import path from 'path';

type FrontierStrategy = 'priority' | 'dfs';

function parseNumberList(input: string | undefined, fallback: number[]): number[] {
  if (!input) return fallback;
  const values = input
    .split(',')
    .map(item => Number(item.trim()))
    .filter(value => !Number.isNaN(value) && value > 0);
  return values.length ? Array.from(new Set(values)) : fallback;
}

function extractSeedsFromConfig(seedConfig: unknown): string[] {
  if (!seedConfig || typeof seedConfig !== 'object') return [];
  const collected: string[] = [];

  for (const value of Object.values(seedConfig as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      collected.push(
        ...value
          .map(item => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      );
    } else if (value && typeof value === 'object') {
      collected.push(...extractSeedsFromConfig(value));
    }
  }

  return collected;
}

let seedUrls: string[] = [];

if (process.env.SEEDS_FILE) {
  try {
    const seedFileContents = fs.readFileSync(process.env.SEEDS_FILE, 'utf8');
    const seedConfig = JSON.parse(seedFileContents);
    seedUrls = extractSeedsFromConfig(seedConfig);
  } catch (error) {
    console.error('Erro ao ler SEEDS_FILE:', error);
  }
} else if (process.env.SEEDS) {
  seedUrls = process.env.SEEDS.split(',').map(seed => seed.trim()).filter(Boolean);
} else {
  const seedsDir = path.join(process.cwd(), 'seeds');
  if (fs.existsSync(seedsDir)) {
    const candidateFiles = fs.readdirSync(seedsDir).filter(file => file.endsWith('.json'));
    for (const file of candidateFiles) {
      try {
        const fileContents = fs.readFileSync(path.join(seedsDir, file), 'utf8');
        const parsedConfig = JSON.parse(fileContents);
        seedUrls.push(...extractSeedsFromConfig(parsedConfig));
      } catch (error) {
        console.error(`Erro ao carregar seeds de ${file}:`, error);
      }
    }
  }
}

seedUrls = Array.from(new Set(seedUrls.filter(Boolean)));

const defaultChunkSizes = parseNumberList(process.env.INDEX_CHUNK_SIZES, [160, 240]);
const normalizedFrontierStrategy = (process.env.CRAWLER_STRATEGY ?? 'priority').toLowerCase();
const processedFrontierStrategy: FrontierStrategy = normalizedFrontierStrategy === 'dfs' ? 'dfs' : 'priority';
const exploreAllLinks = (process.env.CRAWLER_PROCESS_ALL_LINKS ?? 'true').toLowerCase() === 'true';

export const CRAWLER_CONFIG = {
  globalMaxConcurrency: Number(process.env.GLOBAL_MAX_CONCURRENCY ?? 8),
  perDomainRps: Number(process.env.PER_DOMAIN_RPS ?? 4),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 15000),
  seeds: seedUrls,
  respectRobots: (process.env.RESPECT_ROBOTS ?? 'true').toLowerCase() === 'true',
  userAgentHeader: process.env.CRAWLER_USER_AGENT ?? 'CrawlerBrasileirao/0.1',
  acceptHeader: 'text/html,application/xhtml+xml',
  languageHeader: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  maxRuntimeMs: Number(process.env.MAX_RUNTIME_MINUTES ?? 0) * 60_000,
  fallbackLinkLimit: Number(process.env.FALLBACK_LINK_LIMIT ?? 18),
  processAllLinksFromPage: exploreAllLinks,
  maxDepth: Number(process.env.MAX_DEPTH ?? 10),
  frontierStrategy: processedFrontierStrategy,
  index: {
    chunkSizes: defaultChunkSizes,
    primaryChunkSize: defaultChunkSizes[0],
    minTokenLength: Math.max(2, Number(process.env.INDEX_MIN_TOKEN_LENGTH ?? 3)),
    topTermsLimit: Math.max(5, Number(process.env.LEXICAL_TOP_TERMS ?? 12)),
    maxTokensPerDocument: Number(process.env.INDEX_MAX_TOKENS ?? 25000),
    granularity: (process.env.INDEX_GRANULARITY ?? 'token').toLowerCase()
  }
};

export const INDEX_CONFIG = CRAWLER_CONFIG.index;
