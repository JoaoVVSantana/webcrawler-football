import 'dotenv/config';

export const CONFIG = {
  userAgent: process.env.CRAWLER_USER_AGENT ?? 'CrawlerBrasileirao/0.1',
  globalMaxConcurrency: Number(process.env.GLOBAL_MAX_CONCURRENCY ?? 6),
  perDomainRps: Number(process.env.PER_DOMAIN_RPS ?? 1),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 15000),
  seeds: (process.env.SEEDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
};
