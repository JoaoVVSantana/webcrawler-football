import * as cheerio from 'cheerio';
import { BaseAdapter } from './baseAdapter';
import type { MatchItem, PageType } from '../types';
import { parsePtBrDateTimeToIso } from '../utils/datetime';

export class OneFootballAdapter extends BaseAdapter {
  domain = 'onefootball.com';

  whitelistPatterns = [
    /^https?:\/\/(www\.)?onefootball\.com\/pt-br\/competicao\/brasileirao-serie-a-13.*$/i,
    /^https?:\/\/(www\.)?onefootball\.com\/pt-br\/time\/[a-z0-9\-]+-\d+.*$/i,
    /^https?:\/\/(www\.)?onefootball\.com\/pt-br\/liga\/.*$/i
  ];

  classify(url: string): PageType {
    const lower = url.toLowerCase();
    if (lower.includes('/competicao/') || lower.includes('/time/')) return 'agenda';
    return super.classify(url);
  }

  extract(html: string, url: string, domInstance?: cheerio.CheerioAPI) {
    const nextDataMatches = this.parseMatchesFromNextData(html, url);
    const jsonLdMatches = this.extractSportsEventsFromJsonLd(html, url, 'OneFootball (json-ld)', 0.76);
    const matches = this.deduplicateMatches([...nextDataMatches, ...jsonLdMatches]);

    const dom = domInstance ?? cheerio.load(html);
    const nextLinks = this.collectAllowedLinks(dom, url).filter(link =>
      /brasileirao|time|competicao|liga/i.test(link)
    );

    return { matches, nextLinks: Array.from(new Set(nextLinks)) };
  }

  private parseMatchesFromNextData(html: string, sourceUrl: string): MatchItem[] {
    const scriptMatch = html.match(
      /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/
    );
    if (!scriptMatch?.[1]) return [];

    try {
      const parsed = JSON.parse(scriptMatch[1]);
      const matches: MatchItem[] = [];
      this.walkNextData(parsed, matches, sourceUrl, 'OneFootball (__NEXT_DATA__)');
      return this.deduplicateMatches(matches);
    } catch {
      return [];
    }
  }

  private walkNextData(
    node: unknown,
    matches: MatchItem[],
    fallbackUrl: string,
    sourceLabel: string
  ) {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const entry of node) this.walkNextData(entry, matches, fallbackUrl, sourceLabel);
      return;
    }

    if (typeof node === 'object') {
      const candidate = this.mapNextDataMatch(node as Record<string, any>, fallbackUrl, sourceLabel);
      if (candidate) matches.push(candidate);

      for (const value of Object.values(node as Record<string, any>)) {
        this.walkNextData(value, matches, fallbackUrl, sourceLabel);
      }
    }
  }

  private mapNextDataMatch(
    payload: Record<string, any>,
    fallbackUrl: string,
    sourceLabel: string
  ): MatchItem | undefined {
    const homeTeam = this.standardizeTeamName(
      payload?.homeTeam?.name ??
        payload?.homeTeam ??
        payload?.teamHome ??
        payload?.teams?.home?.name ??
        payload?.participants?.[0]?.team?.name ??
        payload?.clubHome?.name ??
        payload?.team1?.name ??
        payload?.team1 ??
        payload?.mandante
    );
    const awayTeam = this.standardizeTeamName(
      payload?.awayTeam?.name ??
        payload?.awayTeam ??
        payload?.teamAway ??
        payload?.teams?.away?.name ??
        payload?.participants?.[1]?.team?.name ??
        payload?.clubAway?.name ??
        payload?.team2?.name ??
        payload?.team2 ??
        payload?.visitante
    );

    if (!homeTeam || !awayTeam) return undefined;

    const startCandidate =
      payload?.kickoffTime ??
      payload?.kickoffAt ??
      payload?.startTimestamp ??
      payload?.startTime ??
      payload?.startDate ??
      payload?.utcDate ??
      payload?.dateTime ??
      payload?.matchDate;

    let dateTimeUtc: string | undefined;
    let dateTimeLocal: string | undefined;

    if (typeof startCandidate === 'number') {
      const timestamp = startCandidate > 1e12 ? startCandidate : startCandidate * 1000;
      dateTimeUtc = new Date(timestamp).toISOString();
    } else if (typeof startCandidate === 'string') {
      const trimmed = startCandidate.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.includes('T')) {
        dateTimeUtc = trimmed;
      } else {
        const parsed = parsePtBrDateTimeToIso(trimmed);
        dateTimeUtc = parsed.utc;
        dateTimeLocal = parsed.local;
      }
    }

    if (!dateTimeUtc) {
      const datePart = payload?.date ?? payload?.matchDate;
      const timePart = payload?.time ?? payload?.matchTime;
      if (datePart && timePart) {
        const parsed = parsePtBrDateTimeToIso(`${datePart} ${timePart}`);
        dateTimeUtc = parsed.utc;
        dateTimeLocal = parsed.local;
      }
    }

    const competition =
      payload?.competition?.name ??
      payload?.tournament?.name ??
      payload?.league?.name ??
      payload?.championship?.name ??
      payload?.superEvent?.name ??
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
      confidence: 0.74
    };
  }

  private collectWatchSourcesFromPayload(payload: Record<string, any>) {
    const sources = new Map<string, NonNullable<MatchItem['whereToWatch']>[number]>();
    const candidateFields = [
      'broadcasts',
      'channels',
      'whereToWatch',
      'media',
      'coverage',
      'watch',
      'availability',
      'tvStations'
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
}
