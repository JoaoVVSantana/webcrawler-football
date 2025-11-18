import * as crypto from 'crypto';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { DocumentItem, DocumentRecord, PageType } from '../types';
import { analyzeAndNormalizeText } from '../utils/textProcessing';

export function generateHtmlHash(html: string): string {
  return crypto.createHash('sha256').update(html).digest('hex');
}

export function createDocumentMetadata(
  url: string,
  html: string,
  pageType?: PageType,
  dom?: CheerioAPI
): DocumentRecord {
  const $ = dom ?? cheerio.load(html);
  const bodyClone = $('body').clone();
  bodyClone.find('script, style, noscript, iframe').remove();
  const rawText = bodyClone.text();
  const normalizedText = rawText.replace(/\s+/g, ' ').trim();
  const lexical = normalizedText ? analyzeAndNormalizeText(normalizedText) : undefined;
  const title = $('title').first().text().trim() || undefined;
  const lang = $('html').attr('lang') || undefined;
  const metadata: DocumentItem = {
    url,
    fetchedAt: new Date().toISOString(),
    status: 200,
    title,
    lang,
    pageType,
    rawHtmlHash: generateHtmlHash(html),
    contentLength: html.length,
    cleanedContentLength: normalizedText.length || undefined,
    lexicalSummary: lexical
      ? {
          tokenCount: lexical.tokenCount,
          uniqueTokenCount: lexical.uniqueTokenCount,
          stopwordCount: lexical.stopwordCount,
          averageTokenLength: lexical.averageTokenLength,
          lexicalDensity: lexical.lexicalDensity,
          topTerms: lexical.topTerms,
          processingMs: lexical.processingMs
        }
      : undefined
  };

  return {
    metadata,
    cleanedText: normalizedText,
    lexical
  };
}

export function extractUniqueLinks(url: string, html: string, dom?: CheerioAPI): string[] {
  const $ = dom ?? cheerio.load(html);
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
