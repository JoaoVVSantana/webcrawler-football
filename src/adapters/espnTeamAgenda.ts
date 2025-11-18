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

  extract(html: string, url: string, domInstance?: cheerio.CheerioAPI) {
    const jsonLdMatches = this.extractSportsEventsFromJsonLd(html, url, 'ESPN (json-ld)', 0.8);
    const dom = domInstance ?? cheerio.load(html);
    const htmlMatches = jsonLdMatches.length ? [] : this.parseMatchesFromHtml(dom, url);
    const allowedLinks = this.collectAllowedLinks(dom, url);
    const matches = jsonLdMatches.length ? jsonLdMatches : htmlMatches;
    return { matches, nextLinks: allowedLinks };
  }

  private parseMatchesFromHtml(dom: cheerio.CheerioAPI, sourceUrl: string): MatchItem[] {
    const matches: MatchItem[] = [];

    dom('article, li, [class*=match], [class*=game]').each((_, element) => {
      const text = dom(element).text().replace(/\s+/g, ' ').trim();
      if (!text || !/[xX]/.test(text)) return;

      const teamsMatch = text.match(/([A-Za-z\.\s'\-]{3,})\s+[xX]\s+([A-Za-z\.\s'\-]{3,})/);
      if (!teamsMatch) return;

      const homeTeamName = teamsMatch[1];
      const awayTeamName = teamsMatch[2];

      const dateMatch =
        text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/) ||
        text.match(/(\d{1,2}\s+de\s+[A-Za-z]+)/i);
      const timeMatch = text.match(/(\d{1,2}:\d{2})/);
      const dateTimeText = dateMatch && timeMatch ? `${dateMatch[0]} ${timeMatch[0]}` : undefined;

      const { local, utc } = dateTimeText ? parsePtBrDateTimeToIso(dateTimeText) : ({} as any);
      if (!local && !utc) return;

      matches.push({
        homeTeam: this.standardizeTeamName(homeTeamName),
        awayTeam: this.standardizeTeamName(awayTeamName),
        dateTimeLocal: local,
        dateTimeUtc: utc,
        sourceUrl,
        sourceName: 'ESPN (competicao)',
        confidence: 0.5
      });
    });

    return this.deduplicateMatches(matches);
  }
}
