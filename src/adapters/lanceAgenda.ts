import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { BaseAdapter } from './baseAdapter';
import type { MatchItem, PageType } from '../types';
import { parsePtBrDateTimeToIso } from '../utils/datetime';

export class LanceAgendaAdapter extends BaseAdapter {
  domain = 'www.lance.com.br';

  whitelistPatterns = [
    /^https?:\/\/(www\.)?lance\.com\.br\/futebol\/brasileirao-serie-a.*$/i,
    /^https?:\/\/(www\.)?lance\.com\.br\/clubes\/[a-z0-9\-]+.*$/i,
    /^https?:\/\/(www\.)?lance\.com\.br\/futebol\/agenda.*$/i,
    /^https?:\/\/(www\.)?lance\.com\.br\/futebol\/tabela.*$/i
  ];

  classify(url: string): PageType {
    const lower = url.toLowerCase();
    if (lower.includes('agenda') || lower.includes('brasileirao')) return 'agenda';
    if (lower.includes('tabela')) return 'tabela';
    if (lower.includes('/noticias/')) return 'noticia';
    return super.classify(url);
  }

  extract(html: string, url: string, domInstance?: cheerio.CheerioAPI) {
    const stateMatches = this.parseMatchesFromInlineState(html, url);
    const jsonLdMatches = this.extractSportsEventsFromJsonLd(html, url, 'Lance (json-ld)', 0.78);
    const dom = domInstance ?? cheerio.load(html);
    const htmlMatches =
      stateMatches.length || jsonLdMatches.length ? [] : this.parseMatchesFromHtml(dom, url);

    const combinedMatches = this.deduplicateMatches([
      ...stateMatches,
      ...jsonLdMatches,
      ...htmlMatches
    ]);

    const nextLinks = this.collectAllowedLinks(dom, url).filter(link =>
      /futebol|brasileirao|agenda|tabela/i.test(link)
    );

    return { matches: combinedMatches, nextLinks: Array.from(new Set(nextLinks)) };
  }

  private parseMatchesFromInlineState(html: string, sourceUrl: string): MatchItem[] {
    const inlinePayload =
      this.extractJsonObjectAtMarker(html, 'window.__NUXT__') ??
      this.extractJsonObjectAtMarker(html, 'window.__INITIAL_STATE__');
    if (!inlinePayload) return [];

    try {
      const parsedState = JSON.parse(inlinePayload);
      const matches: MatchItem[] = [];
      this.walkPotentialMatchNodes(parsedState, matches, sourceUrl, 'Lance (inline state)');
      return this.deduplicateMatches(matches);
    } catch {
      return [];
    }
  }

  private walkPotentialMatchNodes(
    node: unknown,
    matches: MatchItem[],
    sourceUrl: string,
    sourceName: string
  ) {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const entry of node) this.walkPotentialMatchNodes(entry, matches, sourceUrl, sourceName);
      return;
    }

    if (typeof node === 'object') {
      const candidate = this.mapGenericMatch(node as Record<string, any>, sourceUrl, sourceName);
      if (candidate) matches.push(candidate);

      for (const value of Object.values(node as Record<string, any>)) {
        this.walkPotentialMatchNodes(value, matches, sourceUrl, sourceName);
      }
    }
  }

  private mapGenericMatch(
    payload: Record<string, any>,
    fallbackUrl: string,
    sourceLabel: string
  ): MatchItem | undefined {
    const homeTeam = this.standardizeTeamName(
      payload?.homeTeam?.name ??
        payload?.homeTeam ??
        payload?.teamHome ??
        payload?.mandante ??
        payload?.clubMandante
    );
    const awayTeam = this.standardizeTeamName(
      payload?.awayTeam?.name ??
        payload?.awayTeam ??
        payload?.teamAway ??
        payload?.visitante ??
        payload?.clubVisitante
    );

    if (!homeTeam || !awayTeam) return undefined;

    const dateCandidate =
      payload?.startTime ??
      payload?.startDate ??
      payload?.utcDate ??
      payload?.dateTime ??
      payload?.matchDate ??
      payload?.data;

    let dateTimeUtc: string | undefined;
    let dateTimeLocal: string | undefined;

    if (typeof dateCandidate === 'number') {
      const timestamp = dateCandidate > 1e12 ? dateCandidate : dateCandidate * 1000;
      dateTimeUtc = new Date(timestamp).toISOString();
    } else if (typeof dateCandidate === 'string') {
      const trimmed = dateCandidate.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.includes('T')) {
        dateTimeUtc = trimmed;
      } else {
        const parsed = parsePtBrDateTimeToIso(trimmed);
        dateTimeUtc = parsed.utc;
        dateTimeLocal = parsed.local;
      }
    }

    const competition =
      payload?.competition?.name ??
      payload?.tournament?.name ??
      payload?.championship ??
      payload?.league?.name ??
      payload?.campeonato ??
      undefined;

    const watchSources = this.collectWatchSourcesFromPayload(payload);

    return {
      homeTeam,
      awayTeam,
      dateTimeLocal,
      dateTimeUtc,
      competition,
      whereToWatch: watchSources.length ? watchSources : undefined,
      sourceUrl: typeof payload?.url === 'string' ? payload.url : fallbackUrl,
      sourceName: sourceLabel,
      confidence: 0.72
    };
  }

  private parseMatchesFromHtml(dom: cheerio.CheerioAPI, sourceUrl: string): MatchItem[] {
    const matches: MatchItem[] = [];

    dom('article, li, .match-card, [class*=match], [class*=agenda]').each((_, element) => {
      const $element = dom(element);
      const text = $element.text().replace(/\s+/g, ' ').trim();
      if (!text || !/[xX]/.test(text)) return;

      const teamsMatch = text.match(/([A-Za-z\.\s'\-]{3,})\s+[xX]\s+([A-Za-z\.\s'\-]{3,})/);
      if (!teamsMatch) return;

      const dateMatch =
        text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/) ||
        text.match(/(\d{1,2}\s+de\s+[A-Za-z]+)/i);
      const timeMatch = text.match(/(\d{1,2}:\d{2})/);
      const dateTimeText = dateMatch && timeMatch ? `${dateMatch[0]} ${timeMatch[0]}` : undefined;
      const parsedDate = dateTimeText ? parsePtBrDateTimeToIso(dateTimeText) : ({} as any);

      const watchSources = this.extractWatchSourcesFromHtml(dom, $element);

      matches.push({
        homeTeam: this.standardizeTeamName(teamsMatch[1]),
        awayTeam: this.standardizeTeamName(teamsMatch[2]),
        dateTimeLocal: parsedDate.local,
        dateTimeUtc: parsedDate.utc,
        whereToWatch: watchSources.length ? watchSources : undefined,
        sourceUrl,
        sourceName: 'Lance (analise HTML)',
        confidence: 0.45
      });
    });

    return this.deduplicateMatches(matches);
  }

  private collectWatchSourcesFromPayload(payload: Record<string, any>) {
    const sources = new Map<string, NonNullable<MatchItem['whereToWatch']>[number]>();
    const candidateFields = [
      'broadcasts',
      'channels',
      'whereToWatch',
      'media',
      'coverage',
      'tvStations',
      'transmission'
    ];

    for (const field of candidateFields) {
      const value = payload[field];
      if (Array.isArray(value)) {
        for (const entry of value) {
          const mapped = this.mapBroadcastSource(
            entry?.name ?? entry?.provider ?? entry?.channel ?? entry,
            entry?.url ?? entry?.link ?? entry?.href
          );
          if (mapped && !sources.has(mapped.provider.toLowerCase())) {
            sources.set(mapped.provider.toLowerCase(), mapped);
          }
        }
      } else if (value && typeof value === 'object') {
        const mapped = this.mapBroadcastSource(value?.name ?? value?.provider, value?.url ?? value?.link);
        if (mapped && !sources.has(mapped.provider.toLowerCase())) {
          sources.set(mapped.provider.toLowerCase(), mapped);
        }
      } else if (typeof value === 'string') {
        const mapped = this.mapBroadcastSource(value, undefined);
        if (mapped && !sources.has(mapped.provider.toLowerCase())) {
          sources.set(mapped.provider.toLowerCase(), mapped);
        }
      }
    }

    return Array.from(sources.values());
  }

  private extractWatchSourcesFromHtml(dom: cheerio.CheerioAPI, element: cheerio.Cheerio<AnyNode>) {
    const sources = new Map<string, NonNullable<MatchItem['whereToWatch']>[number]>();

    element.find('a[href]').each((_: number, anchorElement: AnyNode) => {
      const anchorNode = dom(anchorElement);
      const name = anchorNode.text().trim();
      const href = anchorNode.attr('href') ?? undefined;
      const mapped = this.mapBroadcastSource(name, href);
      if (mapped && !sources.has(mapped.provider.toLowerCase())) {
        sources.set(mapped.provider.toLowerCase(), mapped);
      }
    });

    return Array.from(sources.values());
  }
}
