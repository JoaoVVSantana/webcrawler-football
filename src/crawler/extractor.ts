import * as crypto from 'crypto';
import * as cheerio from 'cheerio';
import { DocumentItem, DocumentRecord } from '../types';
import { analyzeAndNormalizeText } from '../utils/textProcessing';

export function generateHtmlHash(html: string): string {
  return crypto.createHash('sha256').update(html).digest('hex');
}

export function createDocumentMetadata(url: string, html: string): DocumentRecord {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe').remove();
  const rawText = $('body').text();
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
