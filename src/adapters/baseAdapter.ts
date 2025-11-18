import type { CheerioAPI } from 'cheerio';
import { BRAZIL_TEAMS, mapTeamNameToId } from '../data/brasilTeams';
import type { Adapter, PageType, MatchItem } from '../types';
import { canonicalizeUrl } from '../utils/url';

type Broadcast = NonNullable<MatchItem['whereToWatch']>[number];

export abstract class BaseAdapter implements Adapter 
{
  abstract domain: string;
  abstract whitelistPatterns: RegExp[];

  protected teamsById = new Map(BRAZIL_TEAMS.map(team => [team.id, team]));
  protected broadcastExclusionKeywords = ['cartola', 'ingresso', 'ingressos', 'seja pro'];

  classify(url: string): PageType 
  {
    const lowerCaseUrl = url.toLowerCase();
    if (lowerCaseUrl.includes('onde-assistir')) return 'onde-assistir' as PageType;
    if (lowerCaseUrl.includes('/noticia') || lowerCaseUrl.includes('/noticias/')) return 'noticia' as PageType;
    if (lowerCaseUrl.includes('agenda') || lowerCaseUrl.includes('calend') || lowerCaseUrl.includes('tabela') || lowerCaseUrl.includes('rodada')) return 'agenda' as PageType;
    return 'outro' as PageType;
  }

  abstract extract(html: string, url: string, dom?: CheerioAPI): ReturnType<Adapter['extract']>;

  protected standardizeTeamName(extractedTeamName?: string | null): string | undefined 
  {
    if (!extractedTeamName) return undefined;
    const trimmedTeamName = extractedTeamName.trim();

    if (!trimmedTeamName) return undefined;
    const teamId = mapTeamNameToId(trimmedTeamName);

    if (!teamId) return trimmedTeamName;
    const team = this.teamsById.get(teamId);

    return team?.name ?? trimmedTeamName;
  }

  protected deduplicateMatches(matches: MatchItem[]): MatchItem[] 
  {
    const seenMatches = new Set<string>();
    const uniqueMatches: MatchItem[] = [];

    for (const currentMatch of matches) 
    {
      const key = `${currentMatch.homeTeam ?? ''}|${currentMatch.awayTeam ?? ''}|${currentMatch.dateTimeUtc ?? currentMatch.dateTimeLocal ?? ''}`;
      if (seenMatches.has(key)) continue;

      seenMatches.add(key);

      uniqueMatches.push(currentMatch);
    }

    return uniqueMatches;
  }

  protected collectAllowedLinks(dom: CheerioAPI, baseUrl: string): string[]
  {
    const allowedLinks = new Set<string>();
    const canonicalBaseUrl = canonicalizeUrl(baseUrl);

    dom('a[href]').each((_, anchor) =>
    {
      const rawHref = dom(anchor).attr('href');
      const normalizedHref = rawHref?.trim();
      if (!normalizedHref) return;
      if (normalizedHref.startsWith('javascript:') || normalizedHref.startsWith('mailto:')) return;

      try
      {
        const resolvedUrl = new URL(normalizedHref, baseUrl).toString();
        if (!this.whitelistPatterns.some(pattern => pattern.test(resolvedUrl))) return;

        const normalizedUrl = canonicalizeUrl(resolvedUrl);
        if (normalizedUrl === canonicalBaseUrl) return;

        allowedLinks.add(normalizedUrl);
      }
      catch
      {
        // do nothing
      }
    });

    return Array.from(allowedLinks);
  }

  protected extractJsonObjectAtMarker(source: string, marker: string): string | undefined 
  {
    const markerIndex = source.indexOf(marker);
    if (markerIndex === -1) return undefined;

    const start = source.indexOf('{', markerIndex);
    if (start === -1) return undefined;

    let depth = 0;
    for (let iteration = start; iteration < source.length; iteration++) 
    {
      const character = source[iteration];

      if (character === '{') depth++;

      else if (character === '}') 
      {
        depth--;
        if (depth === 0) 
        {
          return source.slice(start, iteration + 1);
        }
      }
    }
    return undefined;
  }

  protected mapBroadcastSource(name?: string, url?: string): Broadcast | undefined 
  {
    if (!name) return undefined;

    const provider = name.trim();
    if (!provider) return undefined;

    const lowercaseProvider = provider.toLowerCase();

    if (this.broadcastExclusionKeywords.some(keyword => lowercaseProvider.includes(keyword))) return undefined;

    let type: Broadcast['type'] = 'streaming';
    if (lowercaseProvider.includes('youtube')) type = 'youtube';

    else if (lowercaseProvider.includes('globo')
      || lowercaseProvider.includes('band') 
      || lowercaseProvider.includes('sbt')) type = 'tv_aberta';

    else if (
      lowercaseProvider.includes('premiere') || lowercaseProvider.includes('sportv') ||
      lowercaseProvider.includes('espn') || lowercaseProvider.includes('tnt') 
    ) type = 'tv_fechada';

    return { type, provider, url: url?.trim() || undefined };
  }

  protected extractSportsEventsFromJsonLd(
    html: string,
    sourceUrl: string,
    sourceLabel: string,
    defaultConfidence = 0.75
  ): MatchItem[] {
    const matches: MatchItem[] = [];
    const scriptBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];

    for (const scriptBlock of scriptBlocks) {
      const jsonPayload = scriptBlock.replace(/^[\s\S]*?>/, '').replace(/<\/script>\s*$/i, '');
      try {
        const parsedJson = JSON.parse(jsonPayload);
        const entries = Array.isArray(parsedJson) ? parsedJson : [parsedJson];

        for (const entry of entries) {
          const match = this.mapSportsEventEntry(entry, sourceUrl, sourceLabel, defaultConfidence);
          if (match) matches.push(match);
        }
      } catch {
        // ignore malformed json-ld blocks
      }
    }

    return this.deduplicateMatches(matches);
  }

  private mapSportsEventEntry(
    candidate: Record<string, any>,
    sourceFallbackUrl: string,
    sourceLabel: string,
    defaultConfidence: number
  ): MatchItem | undefined {
    if (!candidate || typeof candidate !== 'object') return undefined;

    const type = candidate['@type'];
    if (type !== 'SportsEvent' && type !== 'Event') return undefined;

    const homeTeamName = this.resolveTeamName(candidate.homeTeam ?? candidate.competitor?.[0]);
    const awayTeamName = this.resolveTeamName(candidate.awayTeam ?? candidate.competitor?.[1]);

    if (!homeTeamName || !awayTeamName) return undefined;

    const competitionName =
      candidate.superEvent?.name ??
      candidate.tournament?.name ??
      candidate.competition?.name ??
      candidate.name;

    const startDate = this.resolveStartDate(candidate);
    if (!startDate) return undefined;

    const broadcastEntries: Broadcast[] = [];
    const broadcastCandidates = this.resolveBroadcastCandidates(candidate);
    for (const broadcastCandidate of broadcastCandidates) {
      const nameCandidate =
        broadcastCandidate?.name ??
        broadcastCandidate?.provider ??
        broadcastCandidate?.broadcastService?.name ??
        broadcastCandidate?.organizer?.name;

      const urlCandidate =
        broadcastCandidate?.url ?? broadcastCandidate?.sameAs ?? broadcastCandidate?.publication?.url;

      const mapped = this.mapBroadcastSource(nameCandidate, urlCandidate);
      if (mapped) broadcastEntries.push(mapped);
    }

    return {
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      competition: typeof competitionName === 'string' ? competitionName : undefined,
      dateTimeUtc: startDate,
      sourceUrl: typeof candidate.url === 'string' ? candidate.url : sourceFallbackUrl,
      sourceName: sourceLabel,
      whereToWatch: broadcastEntries.length ? broadcastEntries : undefined,
      confidence: defaultConfidence
    };
  }

  private resolveTeamName(candidate: unknown): string | undefined {
    if (!candidate) return undefined;

    if (typeof candidate === 'string') return this.standardizeTeamName(candidate);

    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        const resolved = this.resolveTeamName(entry);
        if (resolved) return resolved;
      }
      return undefined;
    }

    if (typeof candidate === 'object') {
      const payload = candidate as Record<string, any>;
      return this.standardizeTeamName(
        payload.popularName ??
          payload.commonName ??
          payload.shortName ??
          payload.name ??
          payload['@id'] ??
          payload.alternateName
      );
    }

    return undefined;
  }

  private resolveStartDate(candidate: Record<string, any>): string | undefined {
    const startDate = candidate.startDate ?? candidate.startTime ?? candidate.startDateTime ?? candidate.start;
    if (typeof startDate === 'string' && startDate.trim()) return startDate.trim();
    if (typeof startDate === 'number') return new Date(startDate * 1000).toISOString();

    const potentialDate = candidate.eventSchedule?.startDate ?? candidate.endDate ?? candidate.date;
    if (typeof potentialDate === 'string' && potentialDate.trim()) return potentialDate.trim();

    return undefined;
  }

  private resolveBroadcastCandidates(candidate: Record<string, any>): Array<Record<string, any>> {
    const candidates: Array<Record<string, any>> = [];
    const fields = ['broadcastOfEvent', 'broadcast', 'subjectOf', 'offers', 'publication', 'organizer'];

    for (const field of fields) {
      const payload = candidate[field];
      if (Array.isArray(payload)) {
        for (const entry of payload) {
          if (entry && typeof entry === 'object') candidates.push(entry);
        }
      } else if (payload && typeof payload === 'object') {
        candidates.push(payload);
      }
    }
    return candidates;
  }
}
