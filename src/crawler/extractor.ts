import * as crypto from 'crypto';
import * as cheerio from 'cheerio';
import { DocumentItem } from '../types';

export function generateHtmlHash(html: string): string {
  return crypto.createHash('sha256').update(html).digest('hex');
}

export function createDocumentMetadata(url: string, html: string): DocumentItem {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim() || undefined;
  const lang = $('html').attr('lang') || undefined;
  return {
    url,
    fetchedAt: new Date().toISOString(),
    status: 200,
    title,
    lang,
    rawHtmlHash: generateHtmlHash(html)
  };
}

export function extractUniqueLinks(url: string, html: string): string[] {
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);
  const uniqueLinks = new Set<string>();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href')!;
    try {
      const resolvedHref = new URL(href, baseUrl).toString();
      uniqueLinks.add(resolvedHref);
    } catch {}
  });
  return [...uniqueLinks];
}
