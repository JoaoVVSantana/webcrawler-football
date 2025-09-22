import got, { Response } from 'got';
import Bottleneck from 'bottleneck';
import robotsParser from 'robots-parser';
import { CookieJar } from 'tough-cookie';
import { CONFIG } from '../config';

const domainLimiters = new Map<string, Bottleneck>();
const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();

function getLimiter(hostname: string) 
{
  if (!domainLimiters.has(hostname)) 
  {
    const limiter = new Bottleneck({
      reservoir: CONFIG.perDomainRps,//requests por "tick"
      reservoirRefreshAmount: CONFIG.perDomainRps, 
      reservoirRefreshInterval: 1000,
      maxConcurrent: 1
    });

    domainLimiters.set(hostname, limiter);

  }
  return domainLimiters.get(hostname)!;
}

async function getRobotsForOrigin(origin: string) 
{
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;

  const robotsUrl = `${origin}/robots.txt`;
  try 
  {
    const res = await got(robotsUrl, { timeout: { request: 5000 }, throwHttpErrors: false });

    const body = res.statusCode >= 400 ? '' : res.body;

    const parser = robotsParser(robotsUrl, body);

    robotsCache.set(origin, parser);

    return parser;

  } catch {
    const parser = robotsParser('', '');
    robotsCache.set(origin, parser);
    return parser;
  }
}

function looksLikeSoft404(html: string) {
  const lower = html.toLowerCase();
  return (
    lower.includes('erro 404') ||
    lower.includes('página não encontrada') ||
    lower.includes('pagina não encontrada') ||
    lower.includes('not found') ||
    lower.includes('404 -') ||
    lower.includes('404 –') ||
    lower.includes('error 404')
  );
}

export async function fetchHtml(url: string): Promise<Response<string> | null> {
  const newUrl = new URL(url);
  const origin = newUrl.origin;      
  const hostname = newUrl.hostname;

  // Robots.txt (apenas se habilitado)
  if (CONFIG.respectRobots) 
  {
    const robots = await getRobotsForOrigin(origin);

    if (!robots.isAllowed(url, CONFIG.userAgent)) 
    {
      //console.log({ url }, 'Bloqueado por robots.txt');
      return null;
    }
  }

  const limiter = getLimiter(hostname);

  return limiter.schedule(async () => {
    //console.log({ url }, 'GET');

    try 
    {
      const res = await got<string>(url, 
      {
        headers: 
        {
          'user-agent': CONFIG.userAgent,
          'accept': 'text/html,application/xhtml+xml',
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        cookieJar: new CookieJar(),
        timeout: { request: CONFIG.requestTimeoutMs },
        http2: true,
        decompress: true,
        throwHttpErrors: false,
        followRedirect: true
      });

      const bytes = (res.rawBody as any)?.length ?? 0;
      //console.log({ status: res.statusCode, bytes }, 'RESP');

      if (res.statusCode >= 400) {
        //console.log({ url, status: res.statusCode }, 'Descartado (status >= 400)');
        return null;
      }

      if (res.body && looksLikeSoft404(res.body)) {
        //console.log({ url }, 'Descartado (soft-404 detectado)');
        return null;
      }

      return res;

    } 
    catch (e: any) 
    {
      console.log({ url, err: e?.message }, 'Erro fetch');
      return null;
    }
  });
}
