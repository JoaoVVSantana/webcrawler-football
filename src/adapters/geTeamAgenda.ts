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

  extract(html: string, url: string) {
    const inlineMatches = this.extractFromInlineSchedule(html, url);
    const fromJsonLd = inlineMatches.length ? [] : this.extractFromJsonLd(html, url);
    const $ = cheerio.load(html);
    const fromHtml = inlineMatches.length || fromJsonLd.length ? [] : this.extractFromHtml($, url);


    const agendaLinksFromTeams = this.buildTeamAgendaLinks($, url);

    const rodadaLinks = this.collectNextLinks($, url).filter(href =>
      /\/brasileirao-serie-a\/rodada\/\d+\/?$/i.test(href)
    );

    const matches = this.dedupeMatches([
      ...inlineMatches,
      ...fromJsonLd,
      ...fromHtml
    ]);
    const nextLinks = Array.from(new Set([
      ...agendaLinksFromTeams,
      ...rodadaLinks
    ]));

    return { matches, nextLinks };
  }

  private extractFromInlineSchedule(html: string, sourceUrl: string): MatchItem[] {
    const block = this.extractJsonBlock(html, 'window.byTeamScheduleTeamData');
    if (!block) return [];

    try {
      const data = JSON.parse(block) as { matches?: any[] } | undefined;
      const matchesData = Array.isArray(data?.matches) ? data.matches : [];
      const out: MatchItem[] = [];

      for (const raw of matchesData) {
        const homeName = this.canonicalTeamName(raw?.firstContestant?.popularName ?? raw?.firstContestant?.name);
        const awayName = this.canonicalTeamName(raw?.secondContestant?.popularName ?? raw?.secondContestant?.name);
        if (!homeName || !awayName) continue;

        const dateParts: string[] = [];
        if (typeof raw?.startDate === 'string' && raw.startDate.trim()) {
          dateParts.push(raw.startDate.trim());
        }
        if (typeof raw?.startHour === 'string' && raw.startHour.trim()) {
          dateParts.push(raw.startHour.trim());
        }

        let dateTimeLocal: string | undefined;
        let dateTimeUtc: string | undefined;
        if (dateParts.length) {
          const parsed = parsePtBrDateTimeToIso(dateParts.join(' '));
          dateTimeLocal = parsed.local;
          dateTimeUtc = parsed.utc;
        }

        const watchSourceEntries = Array.isArray(raw?.liveWatchSources)
          ? raw.liveWatchSources
              .map((item: unknown) => {
                const candidate = item as { name?: string; url?: string } | undefined;
                return this.mapWatchSource(candidate?.name, candidate?.url);
              })
              .filter((item: unknown): item is NonNullable<MatchItem['whereToWatch']>[number] => Boolean(item))
          : [];

        const watchSources = watchSourceEntries.length ? watchSourceEntries : undefined;

        const competition: string | undefined =
          raw?.phase?.championshipEdition?.championship?.name ??
          raw?.championship?.name ??
          undefined;

        const matchSourceUrl =
          typeof raw?.transmission?.url === 'string' && raw.transmission.url.trim()
            ? raw.transmission.url
            : sourceUrl;

        out.push({
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

      return out;
    } catch {
      return [];
    }
  }

  private extractFromJsonLd(html: string, sourceUrl: string): MatchItem[] {
    const out: MatchItem[] = [];
    const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
    for (const blk of blocks) {
      try {
        const jsonText = blk.replace(/^[\s\S]*?>/, '').replace(/<\/script>\s*$/i, '');
        const data = JSON.parse(jsonText);
        const arr = Array.isArray(data) ? data : [data];

        for (const node of arr) {
          if (node?.['@type'] === 'SportsEvent') {
            const homeName = this.canonicalTeamName(node?.homeTeam?.name ?? node?.homeTeam);
            const awayName = this.canonicalTeamName(node?.awayTeam?.name ?? node?.awayTeam);
            const comp = node?.superEvent?.name ?? node?.competitor?.name ?? node?.name ?? undefined;
            const startIso = node?.startDate ? String(node.startDate) : undefined;

            if (homeName && awayName && startIso) {
              out.push({
                homeTeam: homeName,
                awayTeam: awayName,
                competition: comp,
                dateTimeUtc: startIso,
                dateTimeLocal: undefined,
                sourceUrl: sourceUrl,
                sourceName: 'ge.globo (competicao)',
                confidence: 0.85
              });
            }
          }
        }
      } catch {}
    }
    return this.dedupeMatches(out);
  }

  private extractFromHtml($: cheerio.CheerioAPI, sourceUrl: string): MatchItem[] {
    const matches: MatchItem[] = [];

    $('[class*=jogo], [class*=match], article, li').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || !/[xX]/.test(text)) return;

      const vs = text.match(/([A-Za-z\.?\-\s']{3,})\s+[xX]\s+([A-Za-z\.?\-\s']{3,})/);
      if (!vs) return;

      const dateMatch =
        text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/) ||
        text.match(/(\d{1,2}\s+de\s+[A-Za-z]+)/i);
      const timeMatch = text.match(/(\d{1,2}:\d{2})/);
      const when = dateMatch && timeMatch ? `${dateMatch[0]} ${timeMatch[0]}` : undefined;

      const { local, utc } = when ? parsePtBrDateTimeToIso(when) : ({} as any);
      if (!local && !utc) return;

      matches.push({
        homeTeam: this.canonicalTeamName(vs[1]),
        awayTeam: this.canonicalTeamName(vs[2]),
        dateTimeLocal: local,
        dateTimeUtc: utc,
        sourceUrl,
        sourceName: 'ge.globo (competicao)',
        confidence: 0.6
      });
    });

    return this.dedupeMatches(matches);
  }

  private buildTeamAgendaLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const slugs = new Set<string>();

    $('a[href*="/futebol/times/"]').each((_, a) => {
      const href = String($(a).attr('href') ?? '');
      const abs = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
      const m = abs.match(/\/futebol\/times\/([a-z0-9\-]+)\/?/i);
      if (m?.[1]) slugs.add(m[1].toLowerCase());
    });

    const links: string[] = [];
    for (const s of slugs) {
      links.push(`https://ge.globo.com/futebol/times/${s}/agenda-de-jogos-do-${s}/`);
    }
    return Array.from(new Set(links));
  }
}





