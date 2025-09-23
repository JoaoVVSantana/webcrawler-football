import got, { Response } from 'got';
import Bottleneck from 'bottleneck';
import robotsParser from 'robots-parser';
import { CookieJar } from 'tough-cookie';
import { CRAWLER_CONFIG } from '../config';

const hostRateLimiters = new Map<string, Bottleneck>();
const robotsTxtParsers = new Map<string, ReturnType<typeof robotsParser>>();

function getRateLimiter(hostname: string) 
{
  if (!hostRateLimiters.has(hostname)) 
  {
    const rateLimiter = new Bottleneck({
      reservoir: CRAWLER_CONFIG.perDomainRps,
      reservoirRefreshAmount: CRAWLER_CONFIG.perDomainRps, 
      reservoirRefreshInterval: 1000,
      maxConcurrent: 1
    });

    hostRateLimiters.set(hostname, rateLimiter);

  }
  return hostRateLimiters.get(hostname)!;
}

async function loadRobotsParserForOrigin(origin: string) 
{
  if (robotsTxtParsers.has(origin)) return robotsTxtParsers.get(origin)!;

  const robotsUrl = `${origin}/robots.txt`;
  try 
  {
    const response = await got(robotsUrl, { timeout: { request: 5000 }, throwHttpErrors: false });

    const body = response.statusCode >= 400 ? '' : response.body;

    const robotsTxtParser = robotsParser(robotsUrl, body);

    robotsTxtParsers.set(origin, robotsTxtParser);

    return robotsTxtParser;

  } catch {
    const robotsTxtParser = robotsParser('', '');
    robotsTxtParsers.set(origin, robotsTxtParser);
    return robotsTxtParser;
  }
}

function isSoft404Response(html: string) {
  const normalizedHtml = html.toLowerCase();
  return (
    normalizedHtml.includes('erro 404') ||
    normalizedHtml.includes('página não encontrada') ||
    normalizedHtml.includes('pagina não encontrada') ||
    normalizedHtml.includes('not found') ||
    normalizedHtml.includes('404 -') ||
    normalizedHtml.includes('404 –') ||
    normalizedHtml.includes('error 404')
  );
}

export async function fetchHtml(url: string): Promise<Response<string> | null> {
  const parsedUrl = new URL(url);
  const origin = parsedUrl.origin;      
  const hostname = parsedUrl.hostname;

  if (CRAWLER_CONFIG.respectRobots) 
  {
    const robotsParserInstance = await loadRobotsParserForOrigin(origin);

    if (!robotsParserInstance.isAllowed(url, CRAWLER_CONFIG.userAgentHeader)) 
    {
      //console.log({ url }, 'Bloqueado por robots.txt');
      return null;
    }
  }

  const rateLimiter = getRateLimiter(hostname);

  return rateLimiter.schedule(async () => {
    //console.log({ url }, 'GET');

    try 
    {
      const response = await got<string>(url, 
      {
        headers: 
        {
          'user-agent': CRAWLER_CONFIG.userAgentHeader,
          'accept': CRAWLER_CONFIG.acceptHeader,
          'accept-language': CRAWLER_CONFIG.languageHeader
        },
        cookieJar: new CookieJar(),
        timeout: { request: CRAWLER_CONFIG.requestTimeoutMs },
        http2: true,
        decompress: true,
        throwHttpErrors: false,
        followRedirect: true
      });

      const responseByteLength = (response.rawBody as any)?.length ?? 0;
      //console.log({ status: res.statusCode, bytes: responseByteLength }, 'RESP');

      if (response.statusCode >= 400) {
        //console.log({ url, status: response.statusCode }, 'Descartado (status >= 400)');
        return null;
      }

      if (response.body && isSoft404Response(response.body)) {
        //console.log({ url }, 'Descartado (soft-404 detectado)');
        return null;
      }

      return response;

    } 
    catch (e: any) 
    {
      console.log({ url, err: e?.message }, 'Erro fetch');
      return null;
    }
  });
}
