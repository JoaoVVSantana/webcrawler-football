import 'dotenv/config';
import fs from 'fs';

function parseNumberList(input: string | undefined, fallback: number[]): number[] {
  if (!input) return fallback;
  const values = input
    .split(',')
    .map(item => Number(item.trim()))
    .filter(value => !Number.isNaN(value) && value > 0);
  return values.length ? Array.from(new Set(values)) : fallback;
}

let seedUrls: string[] = [];

if (process.env.SEEDS_FILE) 
{
  try
  {
    const seedFileContents = fs.readFileSync(process.env.SEEDS_FILE, 'utf8');
    const seedConfig = JSON.parse(seedFileContents);

    const clubSeedGroups = Object.values(seedConfig.clubs ?? {}) as string[][];
    const portalSeedGroups = Object.values(seedConfig.portals ?? {}) as string[][];
    const independentSeedGroups = Object.values(seedConfig.independent_media ?? {}) as string[][];
    const supporterSeedGroups = Object.values(seedConfig.supporters ?? {}) as string[][];

    seedUrls = [
      ...portalSeedGroups.flat(),
      ...clubSeedGroups.flat(),
      ...independentSeedGroups.flat(),
      ...supporterSeedGroups.flat()
    ];
  } 
  catch (error) 
  {
    console.error('Erro ao ler SEEDS_FILE:', error);
  }
} 
else if (process.env.SEEDS) 
{
  seedUrls = process.env.SEEDS.split(',').map(seed => seed.trim()).filter(Boolean);
}

export const CRAWLER_CONFIG = {
  globalMaxConcurrency: Number(process.env.GLOBAL_MAX_CONCURRENCY ?? 6),
  perDomainRps: Number(process.env.PER_DOMAIN_RPS ?? 1),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 15000),
  seeds: seedUrls,
  respectRobots: (process.env.RESPECT_ROBOTS ?? 'true').toLowerCase() === 'true',
  userAgentHeader: process.env.CRAWLER_USER_AGENT ?? 'CrawlerBrasileirao/0.1',
  acceptHeader: 'text/html,application/xhtml+xml',
  languageHeader: 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
};

const defaultChunkSizes = parseNumberList(process.env.INDEX_CHUNK_SIZES, [160, 240]);

export const INDEX_CONFIG = {
  chunkSizes: defaultChunkSizes,
  primaryChunkSize: defaultChunkSizes[0],
  minTokenLength: Math.max(2, Number(process.env.INDEX_MIN_TOKEN_LENGTH ?? 3)),
  topTermsLimit: Math.max(5, Number(process.env.LEXICAL_TOP_TERMS ?? 12)),
  maxTokensPerDocument: Number(process.env.INDEX_MAX_TOKENS ?? 25000),
  granularity: (process.env.INDEX_GRANULARITY ?? 'token').toLowerCase()
};
