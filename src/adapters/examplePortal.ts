import * as cheerio from 'cheerio';
import { BaseAdapter } from './baseAdapter';
import { MatchItem, PageType } from '../types';

export class ExamplePortalAdapter extends BaseAdapter {
  domain = 'example.com';
  whitelistPatterns = [
    /^https?:\/\/(www\.)?example\.com\/(agenda|tabela|onde-assistir)\/?/i
  ];

  classify(url: string): PageType {
    return super.classify(url);
  }

  extract(html: string, url: string) {
    const $ = cheerio.load(html);
    const matches: MatchItem[] = [];

    //isso é um "mock" pra supor cards com classes previsíveis
    $('.match-card').each((_, el) => {
      const home = $(el).find('.team-home').text().trim();
      const away = $(el).find('.team-away').text().trim();
      const datetime = $(el).find('time').attr('datetime')?.trim();
      const watchText = $(el).find('.where-to-watch').text().toLowerCase();
      const watchLink = $(el).find('.where-to-watch a').attr('href') || undefined;

      if (home && away) {
        matches.push({
          homeTeam: home || undefined,
          awayTeam: away || undefined,
          dateTimeLocal: datetime || undefined,
          sourceUrl: url,
          whereToWatch: watchText
            ? [{ type: watchText.includes('youtube') ? 'youtube' : 'streaming', provider: watchText, url: watchLink }]
            : undefined,
          confidence: 0.6,
          sourceName: 'Example Portal'
        });
      }
    });

    const nextLinks = $('a[href]').map((_, a) => $(a).attr('href')!).get();

    return { matches, nextLinks };
  }
}
