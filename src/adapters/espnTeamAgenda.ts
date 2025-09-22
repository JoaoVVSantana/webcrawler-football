import * as cheerio from 'cheerio';
import { BaseAdapter } from './baseAdapter';
import type { MatchItem, PageType } from '../types';
import { parsePtBrDateTimeToIso } from '../utils/datetime';

export class EspnTeamAgendaAdapter extends BaseAdapter {
  domain = 'www.espn.com.br';

  whitelistPatterns = [
    /^https?:\/\/(www\.)?espn\.com\.br\/futebol\/competicao\/_/i
  ];

  classify(url: string): PageType {
    return /\/competicao\/_/i.test(url) ? 'agenda' : super.classify(url);
  }

  extract(html: string, url: string) {
    const fromJsonLd = this.extractFromJsonLd(html, url);
    const $ = cheerio.load(html);
    const fromHtml = fromJsonLd.length ? [] : this.extractFromHtml($, url);
    const nextLinks = this.collectNextLinks($, url);
    const matches = fromJsonLd.length ? fromJsonLd : fromHtml;
    return { matches, nextLinks };
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
            const comp = node?.superEvent?.name ?? node?.competitor?.name ?? undefined;
            const startIso = node?.startDate ? String(node.startDate) : undefined;
            if (homeName && awayName && startIso) {
              out.push({
                homeTeam: homeName,
                awayTeam: awayName,
                competition: comp,
                dateTimeUtc: startIso,
                sourceUrl: sourceUrl,
                sourceName: 'ESPN (competição)',
                confidence: 0.8
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

    $('article, li, [class*=match], [class*=game]').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text || !/[xX]/.test(text)) return;
      const vs = text.match(/([A-Za-zÀ-ÿ\.\s'\-]{3,})\s+[xX]\s+([A-Za-zÀ-ÿ\.\s'\-]{3,})/);
      if (!vs) return;

      const dateMatch =
        text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/) ||
        text.match(/(\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+)/i);
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
        sourceName: 'ESPN (competição)',
        confidence: 0.5
      });
    });

    return this.dedupeMatches(matches);
  }
}
