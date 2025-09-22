import 'dotenv/config';
import fs from 'fs';

let seeds: string[] = [];

if (process.env.SEEDS_FILE) 
{
  try
  {
    const raw = fs.readFileSync(process.env.SEEDS_FILE, 'utf8');
    const json = JSON.parse(raw);

    const clubSeeds = Object.values(json.clubs ?? {}) as string[][];
    const portalSeeds = Object.values(json.portals ?? {}) as string[][];

    seeds = clubSeeds.flat().concat(portalSeeds.flat());
  } 
  catch (e) 
  {
    console.error("Erro ao ler SEEDS_FILE:", e);
  }
} else if (process.env.SEEDS) {
  seeds = process.env.SEEDS.split(',').map(s => s.trim()).filter(Boolean);
}

export const CONFIG = {
  userAgent: process.env.CRAWLER_USER_AGENT ?? 'CrawlerBrasileirao/0.1',
  globalMaxConcurrency: Number(process.env.GLOBAL_MAX_CONCURRENCY ?? 6),
  perDomainRps: Number(process.env.PER_DOMAIN_RPS ?? 1),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 15000),
  seeds,
  respectRobots: (process.env.RESPECT_ROBOTS ?? 'true').toLowerCase() === 'true',
};
