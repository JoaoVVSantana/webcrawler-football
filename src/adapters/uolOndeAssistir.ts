import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { BaseAdapter } from './baseAdapter';
import type { MatchItem, PageType } from '../types';
import { parsePtBrDateTimeToIso } from '../utils/datetime';

export class UolOndeAssistirAdapter extends BaseAdapter {
  domain = 'www.uol.com.br';

  whitelistPatterns = [
    /^https?:\/\/(www\.)?uol\.com\.br\/esporte\/futebol\/?$/i,
    /^https?:\/\/(www\.)?uol\.com\.br\/esporte\/futebol\/onde-assistir\/?/i,
    /^https?:\/\/(www\.)?uol\.com\.br\/esporte\/futebol\/campeonatos\/brasileirao.*$/i
  ];

  classify(url: string): PageType {
    const lower = url.toLowerCase();
    if (lower.includes('onde-assistir')) return 'onde-assistir';
    if (lower.includes('campeonatos') || lower.includes('brasileirao')) return 'tabela';
    return super.classify(url);
  }

  extract(html: string, url: string) {
    const jsonLdMatches = this.extractSportsEventsFromJsonLd(html, url, 'UOL (json-ld)', 0.75);
    const dom = cheerio.load(html);
    const htmlMatches = jsonLdMatches.length ? [] : this.parseMatchesFromHtml(dom, url);

    const nextLinks = this.collectAllowedLinks(dom, url).filter(link =>
      /futebol|brasileirao|onde-assistir/i.test(link)
    );

    const matches = jsonLdMatches.length ? jsonLdMatches : htmlMatches;
    return { matches, nextLinks: Array.from(new Set(nextLinks)) };
  }

  private parseMatchesFromHtml(dom: cheerio.CheerioAPI, sourceUrl: string): MatchItem[] {
    const matches: MatchItem[] = [];

    dom('[data-match], article, li, .match-card, [class*=agenda]').each((_, element) => {
      const $element = dom(element);
      const dataMatch = $element.attr('data-match');

      if (dataMatch) {
        try {
          const parsed = JSON.parse(dataMatch);
          const mapped = this.mapStructuredMatch(parsed, sourceUrl);
          if (mapped) {
            matches.push(mapped);
            return;
          }
        } catch {
          // ignore malformed datasets
        }
      }

      const textContent = $element.text().replace(/\s+/g, ' ').trim();
      if (!textContent || !/[xX]/.test(textContent)) return;

      const teamsMatch = textContent.match(/([A-Za-z\.\s'\-]{3,})\s+[xX]\s+([A-Za-z\.\s'\-]{3,})/);
      if (!teamsMatch) return;

      const dateMatch =
        textContent.match(/(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/) ||
        textContent.match(/(\d{1,2}\s+de\s+[A-Za-z]+)/i);
      const timeMatch = textContent.match(/(\d{1,2}:\d{2})/);
      const dateTimeText = dateMatch && timeMatch ? `${dateMatch[0]} ${timeMatch[0]}` : undefined;
      const { local, utc } = dateTimeText ? parsePtBrDateTimeToIso(dateTimeText) : ({} as any);

      const matchItem: MatchItem = {
        homeTeam: this.standardizeTeamName(teamsMatch[1]),
        awayTeam: this.standardizeTeamName(teamsMatch[2]),
        dateTimeLocal: local,
        dateTimeUtc: utc,
        sourceUrl,
        sourceName: 'UOL (analise HTML)',
        confidence: 0.45
      };

      const watchSources = this.extractWatchSources(dom, $element);
      if (watchSources.length) matchItem.whereToWatch = watchSources;

      matches.push(matchItem);
    });

    return this.deduplicateMatches(matches);
  }

  private mapStructuredMatch(payload: Record<string, any>, sourceUrl: string): MatchItem | undefined {
    const homeTeam = this.standardizeTeamName(payload?.homeTeam?.name ?? payload?.home ?? payload?.mandante);
    const awayTeam = this.standardizeTeamName(payload?.awayTeam?.name ?? payload?.away ?? payload?.visitante);
    if (!homeTeam || !awayTeam) return undefined;

    let dateTimeUtc: string | undefined;
    if (typeof payload?.startTime === 'string') dateTimeUtc = payload.startTime;
    else if (typeof payload?.startTimestamp === 'number') dateTimeUtc = new Date(payload.startTimestamp * 1000).toISOString();
    else if (typeof payload?.data === 'string') {
      const parsed = parsePtBrDateTimeToIso(payload.data);
      dateTimeUtc = parsed.utc;
    }

    const watchSourcesMap = new Map<string, NonNullable<MatchItem['whereToWatch']>[number]>();
    const broadcastCandidates = payload?.whereToWatch ?? payload?.broadcast ?? payload?.channels ?? payload?.transmission;
    if (Array.isArray(broadcastCandidates)) {
      for (const candidate of broadcastCandidates) {
        const mapped = this.mapBroadcastSource(
          candidate?.name ?? candidate?.provider ?? candidate,
          candidate?.url ?? candidate?.link ?? candidate?.href
        );
        if (mapped && !watchSourcesMap.has(mapped.provider.toLowerCase())) {
          watchSourcesMap.set(mapped.provider.toLowerCase(), mapped);
        }
      }
    }

    return {
      homeTeam,
      awayTeam,
      dateTimeUtc,
      competition: payload?.championship ?? payload?.competition ?? undefined,
      whereToWatch: watchSourcesMap.size ? Array.from(watchSourcesMap.values()) : undefined,
      sourceUrl,
      sourceName: 'UOL (estruturado)',
      confidence: 0.8
    };
  }

  private extractWatchSources(dom: cheerio.CheerioAPI, element: cheerio.Cheerio<AnyNode>) {
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
