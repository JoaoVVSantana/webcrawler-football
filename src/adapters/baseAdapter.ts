import type { CheerioAPI } from 'cheerio';
import { TEAMS, normalizeTeamName } from '../data/brasilTeams';
import type { Adapter, PageType, MatchItem } from '../types';
import { canonicalizeUrl } from '../utils/url';

type Broadcast = NonNullable<MatchItem['whereToWatch']>[number];

export abstract class BaseAdapter implements Adapter {
  abstract domain: string;
  abstract whitelistPatterns: RegExp[];

  protected TEAM_BY_ID = new Map(TEAMS.map(t => [t.id, t]));
  protected BROADCAST_SKIP_KEYWORDS = ['cartola', 'ingresso', 'ingressos', 'seja pro'];

  classify(url: string): PageType {
    const u = url.toLowerCase();
    if (u.includes('onde-assistir')) return 'onde-assistir' as PageType;
    if (u.includes('/noticia') || u.includes('/noticias/')) return 'noticia' as PageType;
    if (u.includes('agenda') || u.includes('calend') || u.includes('tabela') || u.includes('rodada')) return 'agenda' as PageType;
    return 'outro' as PageType;
  }

  abstract extract(html: string, url: string): ReturnType<Adapter['extract']>;

  protected canonicalTeamName(raw?: string | null): string | undefined {
    if (!raw) return undefined;
    const name = raw.trim();
    if (!name) return undefined;
    const id = normalizeTeamName(name);
    if (!id) return name;
    const team = this.TEAM_BY_ID.get(id);
    return team?.name ?? name;
  }

  protected dedupeMatches(items: MatchItem[]): MatchItem[] 
  {
    const seen = new Set<string>();
    const result: MatchItem[] = [];

    for (const item of items) 
    {
      const key = `${item.homeTeam ?? ''}|${item.awayTeam ?? ''}|${item.dateTimeUtc ?? item.dateTimeLocal ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  protected collectNextLinks($: CheerioAPI, baseUrl: string): string[] 
  {
    const links = new Set<string>();

    const self = canonicalizeUrl(baseUrl);

    $('a[href]').each((_, a) => 
    {
      const href = String($(a).attr('href') ?? '');

      if (!href) return;

      try 
      {
        const abs = new URL(href, baseUrl).toString();

        if (!this.whitelistPatterns.some(rx => rx.test(abs))) return;

        const canon = canonicalizeUrl(abs);

        if (canon === self) return; 

        links.add(canon);
      } 
      catch 
      { 
        // do nothing
      }
    });

    return Array.from(links);
  }

  protected extractJsonBlock(source: string, marker: string): string | undefined 
  {
    const markerIndex = source.indexOf(marker);
    if (markerIndex === -1) return undefined;
    const start = source.indexOf('{', markerIndex);
    if (start === -1) return undefined;

    let depth = 0;
    for (let i = start; i < source.length; i++) 
    {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') 
      {
        depth--;
        if (depth === 0) 
        {
          return source.slice(start, i + 1);
        }
      }
    }
    return undefined;
  }

  protected mapWatchSource(name?: string, url?: string): Broadcast | undefined 
  {
    if (!name) return undefined;

    const provider = name.trim();
    if (!provider) return undefined;

    const lower = provider.toLowerCase();

    if (this.BROADCAST_SKIP_KEYWORDS.some(k => lower.includes(k))) return undefined;

    let type: Broadcast['type'] = 'streaming';
    if (lower.includes('youtube')) type = 'youtube';

    else if (lower.includes('globo')
      || lower.includes('band') 
      || lower.includes('sbt')) type = 'tv_aberta';

    else if (
      lower.includes('premiere') || lower.includes('sportv') ||
      lower.includes('espn') || lower.includes('tnt') 
    ) type = 'tv_fechada';

    return { type, provider, url: url?.trim() || undefined };
  }
}
