import * as cheerio from 'cheerio';
import { BaseAdapter } from './baseAdapter';
import type { MatchItem, PageType } from '../types';
import { parsePtBrDateTimeToIso } from '../utils/datetime';

export class GeTeamAgendaAdapter extends BaseAdapter {
  domain = 'ge.globo.com';

  whitelistPatterns = [
    /^https?:\/\/ge\.globo\.com\/futebol\/brasileirao-serie-a\/?$/i,
    /^https?:\/\/ge\.globo\.com\/futebol\/brasileirao-serie-a\/rodada\/[0-9]+\/?$/i,
    /^https?:\/\/ge\.globo\.com\/futebol\/times\/[a-z0-9\-]+\/agenda-de-jogos-do-[a-z0-9\-]+\/?$/i
  ];

  classify(url: string): PageType {
    if (/brasileirao-serie-a\/rodada\//i.test(url)) return 'agenda';
    return /brasileirao-serie-a\/?$/i.test(url) ? 'agenda' : super.classify(url);
  }

  extract(html: string, url: string, domInstance?: cheerio.CheerioAPI) {
    const dom = domInstance ?? cheerio.load(html);
    const inlineScheduleMatches = this.parseInlineScheduleMatches(html, url);
    const jsonLdMatches = inlineScheduleMatches.length ? [] : this.parseMatchesFromJsonLd(html, url);
    const htmlMatches = inlineScheduleMatches.length || jsonLdMatches.length ? [] : this.parseMatchesFromHtml(dom, url);

    const agendaLinksFromTeams = this.buildTeamAgendaLinks(dom, url);

    const rodadaLinks = this.collectAllowedLinks(dom, url).filter(href =>
      /\/brasileirao-serie-a\/rodada\/\d+\/?$/i.test(href)
    );

    const matches = this.deduplicateMatches([
      ...inlineScheduleMatches,
      ...jsonLdMatches,
      ...htmlMatches
    ]);
    const nextLinks = Array.from(new Set([
      ...agendaLinksFromTeams,
      ...rodadaLinks
    ]));

    return { matches, nextLinks };
  }

  private parseInlineScheduleMatches(html: string, sourceUrl: string): MatchItem[] {
    const jsonBlock = this.extractJsonObjectAtMarker(html, 'window.byTeamScheduleTeamData');
    if (!jsonBlock) return [];

    try {
      const parsedSchedule = JSON.parse(jsonBlock) as { matches?: unknown[] } | undefined;
      const matchesPayload = Array.isArray(parsedSchedule?.matches) ? parsedSchedule?.matches : [];
      const matches: MatchItem[] = [];

      for (const rawMatch of matchesPayload) {
        const matchNode = rawMatch as Record<string, any>;
        const homeName = this.standardizeTeamName(matchNode?.firstContestant?.popularName ?? matchNode?.firstContestant?.name);
        const awayName = this.standardizeTeamName(matchNode?.secondContestant?.popularName ?? matchNode?.secondContestant?.name);
        if (!homeName || !awayName) continue;

        const dateParts: string[] = [];
        if (typeof matchNode?.startDate === 'string' && matchNode.startDate.trim()) {
          dateParts.push(matchNode.startDate.trim());
        }
        if (typeof matchNode?.startHour === 'string' && matchNode.startHour.trim()) {
          dateParts.push(matchNode.startHour.trim());
        }

        let dateTimeLocal: string | undefined;
        let dateTimeUtc: string | undefined;
        if (dateParts.length) {
          const parsed = parsePtBrDateTimeToIso(dateParts.join(' '));
          dateTimeLocal = parsed.local;
          dateTimeUtc = parsed.utc;
        }

        const watchSourceEntries = Array.isArray(matchNode?.liveWatchSources)
          ? matchNode.liveWatchSources
              .map((item: unknown) => {
                const candidate = item as { name?: string; url?: string } | undefined;
                return this.mapBroadcastSource(candidate?.name, candidate?.url);
              })
              .filter((item: unknown): item is NonNullable<MatchItem['whereToWatch']>[number] => Boolean(item))
          : [];

        const watchSources = watchSourceEntries.length ? watchSourceEntries : undefined;

        const competition: string | undefined =
          matchNode?.phase?.championshipEdition?.championship?.name ??
          matchNode?.championship?.name ??
          undefined;

        const matchSourceUrl =
          typeof matchNode?.transmission?.url === 'string' && matchNode.transmission.url.trim()
            ? matchNode.transmission.url
            : sourceUrl;

        matches.push({
          homeTeam: homeName,
          awayTeam: awayName,
          dateTimeLocal,
          dateTimeUtc,
          competition,
          whereToWatch: watchSources,
          sourceUrl: matchSourceUrl,
          sourceName: 'ge.globo (agenda time)',
          confidence: 0.9
        });
      }

      return matches;
    } catch {
      return [];
    }
  }

  private parseMatchesFromJsonLd(html: string, sourceUrl: string): MatchItem[] {
    const matches: MatchItem[] = [];
    const scriptBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
    for (const scriptBlock of scriptBlocks) {
      try {
        const jsonContent = scriptBlock.replace(/^[\s\S]*?>/, '').replace(/<\/script>\s*$/i, '');
        const parsedData = JSON.parse(jsonContent);
        const dataEntries = Array.isArray(parsedData) ? parsedData : [parsedData];

        for (const entry of dataEntries) {
          if (entry?.['@type'] === 'SportsEvent') {
            const homeName = this.standardizeTeamName(entry?.homeTeam?.name ?? entry?.homeTeam);
            const awayName = this.standardizeTeamName(entry?.awayTeam?.name ?? entry?.awayTeam);
            const competitionName = entry?.superEvent?.name ?? entry?.competitor?.name ?? entry?.name ?? undefined;
            const startIso = entry?.startDate ? String(entry.startDate) : undefined;

            if (homeName && awayName && startIso) {
              matches.push({
                homeTeam: homeName,
                awayTeam: awayName,
                competition: competitionName,
                dateTimeUtc: startIso,
                dateTimeLocal: undefined,
                sourceUrl,
                sourceName: 'ge.globo (competicao)',
                confidence: 0.85
              });
            }
          }
        }
      } catch {}
    }
    return this.deduplicateMatches(matches);
  }

  private parseMatchesFromHtml(dom: cheerio.CheerioAPI, sourceUrl: string): MatchItem[] {
    const matches: MatchItem[] = [];

    dom('[class*=jogo], [class*=match], article, li').each((_, element) => {
      const text = dom(element).text().replace(/\s+/g, ' ').trim();
      if (!text || !/[xX]/.test(text)) return;

      const teamsMatch = text.match(/([A-Za-z\.?\-\s']{3,})\s+[xX]\s+([A-Za-z\.?\-\s']{3,})/);
      if (!teamsMatch) return;

      const dateMatch =
        text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/) ||
        text.match(/(\d{1,2}\s+de\s+[A-Za-z]+)/i);
      const timeMatch = text.match(/(\d{1,2}:\d{2})/);
      const dateTimeText = dateMatch && timeMatch ? `${dateMatch[0]} ${timeMatch[0]}` : undefined;

      const { local, utc } = dateTimeText ? parsePtBrDateTimeToIso(dateTimeText) : ({} as any);
      if (!local && !utc) return;

      matches.push({
        homeTeam: this.standardizeTeamName(teamsMatch[1]),
        awayTeam: this.standardizeTeamName(teamsMatch[2]),
        dateTimeLocal: local,
        dateTimeUtc: utc,
        sourceUrl,
        sourceName: 'ge.globo (competicao)',
        confidence: 0.6
      });
    });

    return this.deduplicateMatches(matches);
  }

  private buildTeamAgendaLinks(dom: cheerio.CheerioAPI, baseUrl: string): string[] {
    const slugs = new Set<string>();

    dom('a[href*="/futebol/times/"]').each((_, anchor) => {
      const href = String(dom(anchor).attr('href') ?? '');
      const absoluteUrl = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
      const slugMatch = absoluteUrl.match(/\/futebol\/times\/([a-z0-9\-]+)\/?/i);
      if (slugMatch?.[1]) slugs.add(slugMatch[1].toLowerCase());
    });

    const teamAgendaLinks: string[] = [];
    for (const slug of slugs) {
      teamAgendaLinks.push(`https://ge.globo.com/futebol/times/${slug}/agenda-de-jogos-do-${slug}/`);
    }
    return Array.from(new Set(teamAgendaLinks));
  }
}



