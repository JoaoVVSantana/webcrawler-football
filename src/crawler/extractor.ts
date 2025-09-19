import * as crypto from 'crypto';
import * as cheerio from 'cheerio';
import { DocumentItem } from '../types';

export function hashHtml(html: string): string {
  return crypto.createHash('sha256').update(html).digest('hex');
}

export function extractBasicDocument(url: string, html: string): DocumentItem {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim() || undefined;
  const lang = $('html').attr('lang') || undefined;
  return {
    url,
    fetchedAt: new Date().toISOString(),
    status: 200,
    title,
    lang,
    rawHtmlHash: hashHtml(html)
  };
}

/** utilidade: extrair links absolutos simples p/ descoberta */
export function extractLinks(url: string, html: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(url);
  const links = new Set<string>();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href')!;
    try {
      const abs = new URL(href, base).toString();
      links.add(abs);
    } catch {}
  });
  return [...links];
}
