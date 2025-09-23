export function extractHostname(url: string): string {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}

export function haveMatchingHostnames(firstUrl: string, secondUrl: string): boolean {
  return extractHostname(firstUrl) === extractHostname(secondUrl);
}

export function isHttpOrHttpsUrl(candidateUrl: string): boolean {
  try {
    const parsedUrl = new URL(candidateUrl);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch { return false; }
}

/** Normaliza para comparar/armazenar: remove fragmento, normaliza host, ordena query (sem utm_*), resolve barra final. */
export function canonicalizeUrl(input: string): string {
  const parsedUrl = new URL(input);

  parsedUrl.hostname = parsedUrl.hostname.toLowerCase();

  parsedUrl.hash = '';

  const filteredQueryParams = new URLSearchParams();
  const sortedParams = Array.from(parsedUrl.searchParams.entries())
    .filter(([key]) => !/^utm_|^gclid$|^fbclid$/i.test(key));

  sortedParams.sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey));

  for (const [key, value] of sortedParams) filteredQueryParams.append(key, value);

  parsedUrl.search = filteredQueryParams.toString() ? `?${filteredQueryParams.toString()}` : '';

  if (parsedUrl.pathname !== '/' && parsedUrl.pathname.endsWith('/')) 
  {
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, '');
  }

  return parsedUrl.toString();
}
