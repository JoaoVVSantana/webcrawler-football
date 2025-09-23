import 'dotenv/config';
import fs from 'fs';

let seedUrls: string[] = [];

if (process.env.SEEDS_FILE) 
{
  try
  {
    const seedFileContents = fs.readFileSync(process.env.SEEDS_FILE, 'utf8');
    const seedConfig = JSON.parse(seedFileContents);

    const clubSeedGroups = Object.values(seedConfig.clubs ?? {}) as string[][];
    const portalSeedGroups = Object.values(seedConfig.portals ?? {}) as string[][];

    seedUrls = clubSeedGroups.flat().concat(portalSeedGroups.flat());
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
