import * as cheerio from 'cheerio';
import { BaseAdapter } from './baseAdapter';
import type { MatchItem, PageType } from '../types';
import { parsePtBrDateTimeToIso } from '../utils/datetime';
import { appendPlayersToCsv, appendTeamStatsToCsv } from '../pipelines/cbfStore';

export class CbfAdapter extends BaseAdapter {
  domain = 'www.cbf.com.br';

  whitelistPatterns = [
    /^https?:\/\/(www\.)?cbf\.com\.br\/futebol-brasileiro\/tabelas\//i,
    /^https?:\/\/(www\.)?cbf\.com\.br\/futebol-brasileiro\/times\//i,
    /^https?:\/\/(www\.)?cbf\.com\.br\/futebol-brasileiro\/atletas\//i,
    /^https?:\/\/(www\.)?cbf\.com\.br\/futebol-brasileiro\/jogos\//i
  ];

  classify(url: string): PageType {
    if (/\/tabelas\//i.test(url)) return 'agenda';
    if (/\/times\//i.test(url)) return 'team';
    if (/\/atletas\//i.test(url)) return 'outro';
    if (/\/jogos\//i.test(url)) return 'match';
    return 'outro';
  }

  extract(html: string, url: string) {
    const matches = this.extractMatches(html, url);
    const nextLinks = this.extractLinks(html, url);
    
    // Extrair e armazenar dados específicos
    this.extractAndStoreData(html, url);
    
    return { matches, nextLinks };
  }

  private extractMatches(html: string, url: string): MatchItem[] {
    const dom = cheerio.load(html);
    const matches: MatchItem[] = [];

    // Extração de partidas da página de histórico
    if (url.includes('tab=historico-de-partidas')) {
      dom('[class*="match"], [class*="jogo"], .game-item').each((_, element) => {
        const text = dom(element).text().replace(/\s+/g, ' ').trim();
        const teamsMatch = text.match(/([A-Za-zÀ-ÿ\s\-\.]{3,})\s+[xX×]\s+([A-Za-zÀ-ÿ\s\-\.]{3,})/);
        
        if (teamsMatch) {
          const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          const timeMatch = text.match(/(\d{1,2}:\d{2})/);
          
          if (dateMatch) {
            const dateTimeText = timeMatch ? `${dateMatch[0]} ${timeMatch[0]}` : dateMatch[0];
            const { local, utc } = parsePtBrDateTimeToIso(dateTimeText);
            
            matches.push({
              homeTeam: this.standardizeTeamName(teamsMatch[1]),
              awayTeam: this.standardizeTeamName(teamsMatch[2]),
              dateTimeLocal: local,
              dateTimeUtc: utc,
              competition: 'Campeonato Brasileiro',
              sourceUrl: url,
              sourceName: 'CBF (histórico)',
              confidence: 0.9
            });
          }
        }
      });
    }

    return this.deduplicateMatches(matches);
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const dom = cheerio.load(html);
    const links = new Set<string>();

    // Links de times da tabela principal
    if (baseUrl.includes('/tabelas/')) {
      dom('a[href*="/times/"]').each((_, element) => {
        const href = dom(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.cbf.com.br${href}`;
          links.add(fullUrl);
          
          // Adicionar todas as tabs do time
          const teamId = href.match(/\/times\/[^\/]+\/[^\/]+\/[^\/]+\/(\d+)/)?.[1];
          if (teamId) {
            links.add(`${fullUrl}?tab=atletas`);
            links.add(`${fullUrl}?tab=historico-de-partidas`);
            links.add(`${fullUrl}?tab=estatisticas`);
          }
        }
      });
    }

    // Links de atletas
    if (baseUrl.includes('tab=atletas')) {
      dom('a[href*="/atletas/"]').each((_, element) => {
        const href = dom(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.cbf.com.br${href}`;
          links.add(fullUrl);
        }
      });
    }

    // Links de jogos do histórico
    if (baseUrl.includes('tab=historico-de-partidas')) {
      dom('a[href*="/jogos/"]').each((_, element) => {
        const href = dom(element).attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.cbf.com.br${href}`;
          links.add(fullUrl);
        }
      });
    }

    return Array.from(links).filter(link => 
      this.whitelistPatterns.some(pattern => pattern.test(link))
    );
  }

  private async extractAndStoreData(html: string, url: string) {
    const dom = cheerio.load(html);
    
    // Extrair jogadores da tab atletas
    if (url.includes('tab=atletas')) {
      const players: any[] = [];
      const teamName = this.extractTeamName(url);
      
      // Seletores mais amplos para capturar jogadores
      const selectors = [
        '[class*="player"]', '[class*="atleta"]', '.athlete-item',
        'tr', 'li', '[class*="jogador"]', '.player-row',
        '[data-player]', '[class*="roster"]'
      ];
      
      for (const selector of selectors) {
        dom(selector).each((_, element) => {
          const text = dom(element).text().replace(/\s+/g, ' ').trim();
          
          // Buscar nomes que parecem ser de jogadores (2+ palavras, sem números no início)
          const nameMatch = text.match(/([A-Za-zÀ-ÿ\s]{3,}(?:\s[A-Za-zÀ-ÿ\s]{2,})+)/);
          if (nameMatch && !text.match(/^\d/) && text.length < 100) {
            const name = nameMatch[1].trim();
            
            // Tentar extrair posição
            const positionMatch = text.match(/(goleiro|zagueiro|lateral|volante|meia|atacante|centroavante)/i);
            const position = positionMatch ? positionMatch[1] : 'N/A';
            
            if (name.length > 5 && !players.some(p => p.name === name)) {
              players.push({ name, position, team: teamName, sourceUrl: url });
            }
          }
        });
        
        if (players.length > 0) break; // Se encontrou jogadores, para de tentar outros seletores
      }
      
      if (players.length) {
        console.log(`Encontrados ${players.length} jogadores para ${teamName}`);
        await appendPlayersToCsv(players);
      } else {
        console.log(`Nenhum jogador encontrado em ${url}`);
      }
    }
    
    // Extrair estatísticas da tab estatísticas
    if (url.includes('tab=estatisticas')) {
      const teamName = this.extractTeamName(url);
      const statsText = dom('body').text();
      
      const winsMatch = statsText.match(/(\d+)\s*vitórias?/i);
      const drawsMatch = statsText.match(/(\d+)\s*empates?/i);
      const lossesMatch = statsText.match(/(\d+)\s*derrotas?/i);
      
      if (winsMatch || drawsMatch || lossesMatch) {
        const stats = [{
          teamName,
          wins: winsMatch ? parseInt(winsMatch[1]) : 0,
          draws: drawsMatch ? parseInt(drawsMatch[1]) : 0,
          losses: lossesMatch ? parseInt(lossesMatch[1]) : 0,
          goalsFor: 0,
          goalsAgainst: 0,
          sourceUrl: url
        }];
        
        await appendTeamStatsToCsv(stats);
      }
    }
  }
  
  private extractTeamName(url: string): string {
    const match = url.match(/\/times\/[^\/]+\/[^\/]+\/[^\/]+\/(\d+)/);
    return match ? `Team_${match[1]}` : 'Unknown';
  }
}
