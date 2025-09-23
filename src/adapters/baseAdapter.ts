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

  abstract extract(html: string, url: string): ReturnType<Adapter['extract']>;

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
}


