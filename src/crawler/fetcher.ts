import got, { Response } from 'got';
import Bottleneck from 'bottleneck';
import robotsParser from 'robots-parser';
import { CookieJar } from 'tough-cookie';
import { logger } from '../utils/logger';
import { CONFIG } from '../config';
import { getDomain } from '../utils/url';

const domainLimiters = new Map<string, Bottleneck>();
const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();

function getLimiter(domain: string) {
  if (!domainLimiters.has(domain)) {
    const limiter = new Bottleneck({
      reservoir: CONFIG.perDomainRps,               //requests disponíveis por tick
      reservoirRefreshAmount: CONFIG.perDomainRps,  //repõe por segundo
      reservoirRefreshInterval: 1000,
      maxConcurrent: 1
    });
    domainLimiters.set(domain, limiter);
  }
  return domainLimiters.get(domain)!;
}

async function getRobots(url: string) {
  const domain = getDomain(url);
  if (robotsCache.has(domain)) return robotsCache.get(domain)!;
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const res = await got(robotsUrl, { timeout: { request: 5000 } });
    const parser = robotsParser(robotsUrl, res.body);
    robotsCache.set(domain, parser);
    return parser;
  } catch {
    const parser = robotsParser('', ''); //permissivo se não conseguir baixar
    robotsCache.set(domain, parser);
    return parser;
  }
}

export async function fetchHtml(url: string): Promise<Response<string> | null> {
  const domain = getDomain(url);
  const robots = await getRobots(url);
  if (!robots.isAllowed(url, CONFIG.userAgent)) {
    logger.warn({ url }, 'Bloqueado por robots.txt');
    return null;
  }

  const limiter = getLimiter(domain);
  return limiter.schedule(async () => {
    logger.debug({ url }, 'GET');
    try {
      const res = await got<string>(url, {
        headers: { 'user-agent': CONFIG.userAgent, 'accept': 'text/html,application/xhtml+xml' },
        cookieJar: new CookieJar(),
        timeout: { request: CONFIG.requestTimeoutMs },
        http2: true,
        decompress: true,
        throwHttpErrors: false
      });
      logger.debug({ url, status: res.statusCode, bytes: res.rawBody?.length }, 'RESP');
      return res;
    } catch (e: any) {
      logger.error({ url, err: e?.message }, 'Erro fetch');
      return null;
    }
  });
}
