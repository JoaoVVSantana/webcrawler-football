export function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}
export function sameDomain(a: string, b: string): boolean {
  return getDomain(a) === getDomain(b);
}

export function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch { return false; }
}

/** Normaliza para comparar/armazenar: remove fragmento, normaliza host, ordena query (sem utm_*), resolve barra final. */
export function canonicalizeUrl(input: string): string {
  const u = new URL(input);

  u.hostname = u.hostname.toLowerCase();

  u.hash = '';

  const kept = new URLSearchParams();
  const entries = Array.from(u.searchParams.entries())
    .filter(([k]) => !/^utm_|^gclid$|^fbclid$/i.test(k));
  entries.sort(([a], [b]) => a.localeCompare(b));
  for (const [k, v] of entries) kept.append(k, v);
  u.search = kept.toString() ? `?${kept.toString()}` : '';

  if (u.pathname !== '/' && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }

  return u.toString();
}
