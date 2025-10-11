import * as cheerio from 'cheerio';
import { BaseAdapter } from './baseAdapter';
import type { MatchItem, PageType } from '../types';
import { parsePtBrDateTimeToIso } from '../utils/datetime';

const GENERIC_DOMAINS = [
  'trivela.com.br',
  'placar.com.br',
  'superesportes.com.br',
  'esportelandia.com.br',
  'futebolnaveia.com.br',
  'sofascore.com',
  'flashscore.com.br',
  'footystats.org',
  'ultimadivisao.com.br',
  'jogadadeefeito.com.br',
  'torcedores.com',
  'goal.com',
  'terra.com.br',
  'gazetaesportiva.com',
  'meutimao.com.br',
  'colunadofla.com',
  'netvasco.com.br',
  'fogaonet.com',
  'gremistas.net',
  'colorados.com.br',
  'revistacolorada.com.br'
];

function buildWhitelistPatterns(domains: string[]): RegExp[] {
  return domains.map(domain => {
    const sanitized = domain.replace(/\./g, '\\.');
    return new RegExp(`^https?:\\/\\/(www\\.)?${sanitized}\\/.*`, 'i');
  });
}

export class GenericSportsNewsAdapter extends BaseAdapter {
  domain = 'generic-sports-news';
  whitelistPatterns = buildWhitelistPatterns(GENERIC_DOMAINS);

  classify(url: string): PageType {
    const normalized = url.toLowerCase();
    if (normalized.includes('/agenda') || normalized.includes('/calendario') || normalized.includes('/tabela')) {
      return 'agenda';
    }
    if (normalized.includes('/onde-assistir') || normalized.includes('/transmissao')) {
      return 'onde-assistir';
    }
    if (normalized.includes('/classificacao') || normalized.includes('/tabela')) {
      return 'tabela';
    }
    if (normalized.includes('/noticia') || normalized.includes('/news') || normalized.includes('/blog')) {
      return 'noticia';
    }
    return super.classify(url);
  }

  extract(html: string, url: string) {
    const jsonLdMatches = this.extractSportsEventsFromJsonLd(html, url, 'Generic sports (json-ld)', 0.65);
    const dom = cheerio.load(html);
    const htmlMatches = jsonLdMatches.length ? [] : this.parseMatchesFromHtml(dom, url);
    const matches = this.deduplicateMatches([...jsonLdMatches, ...htmlMatches]);
    const nextLinks = this.collectAllowedLinks(dom, url);
    return { matches, nextLinks };
  }

  private parseMatchesFromHtml(dom: cheerio.CheerioAPI, sourceUrl: string): MatchItem[] {
    const matches: MatchItem[] = [];

    dom('article, section, li, div').each((_, element) => {
      const text = dom(element).text().replace(/\s+/g, ' ').trim();
      if (text.length < 20) return;
      if (!/[xX]/.test(text) && !/vs\.?|versus/i.test(text) && !/contra/i.test(text)) return;

      const teamsMatch =
        text.match(/([A-Za-zÀ-ÿ.\s'-]{3,})\s+(?:vs\.?|versus|[xX])\s+([A-Za-zÀ-ÿ.\s'-]{3,})/) ??
        text.match(/([A-Za-zÀ-ÿ.\s'-]{3,})\s+contra\s+([A-Za-zÀ-ÿ.\s'-]{3,})/i);
      if (!teamsMatch) return;

      const firstTeam = teamsMatch[1];
      const secondTeam = teamsMatch[2];
      if (!firstTeam || !secondTeam) return;

      const dateMatch =
        text.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/) ||
        text.match(/(\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+)/i) ||
        text.match(/(\d{4}-\d{2}-\d{2})/);
      const timeMatch = text.match(/(\d{1,2}:\d{2})/);
      const dateTimeText =
        dateMatch && timeMatch ? `${dateMatch[0]} ${timeMatch[0]}` : dateMatch ? dateMatch[0] : undefined;
      const parsedDate = dateTimeText ? parsePtBrDateTimeToIso(dateTimeText) : ({} as any);

      const whereToWatch: MatchItem['whereToWatch'] = [];
      const broadcastingKeywords = text.match(/(premiere|sportv|espn|tnt|star\+|prime video|youtube|globo)/gi);
      if (broadcastingKeywords) {
        for (const candidate of broadcastingKeywords) {
          const mapped = this.mapBroadcastSource(candidate, undefined);
          if (mapped) whereToWatch.push(mapped);
        }
      }

      matches.push({
        homeTeam: this.standardizeTeamName(firstTeam),
        awayTeam: this.standardizeTeamName(secondTeam),
        dateTimeLocal: parsedDate.local,
        dateTimeUtc: parsedDate.utc,
        whereToWatch: whereToWatch.length ? whereToWatch : undefined,
        sourceUrl,
        sourceName: 'Generic sports (heuristic)',
        confidence: parsedDate.local || whereToWatch.length ? 0.45 : 0.3
      });
    });

    return this.deduplicateMatches(matches);
  }
}
