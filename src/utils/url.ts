export function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}
export function sameDomain(a: string, b: string): boolean {
  return getDomain(a) === getDomain(b);
}
export function isHttpUrl(u: string): boolean {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; } catch { return false; }
}
