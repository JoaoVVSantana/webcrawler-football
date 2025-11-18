import natural from 'natural';
import { QueryTerm } from './types';
import { analyzeAndNormalizeText } from '../utils/textProcessing';

const { PorterStemmerPt } = natural;

export class QueryParser {
  private synonyms: Record<string, string[]> = {
    'feminino': ['feminina', 'mulher', 'mulheres', 'damas'],
    'masculino': ['masculina', 'homem', 'homens'],
    'jogo': ['partida', 'match', 'confronto'],
    'time': ['equipe', 'clube', 'team'],
    'assistir': ['ver', 'transmissao', 'broadcast'],
    'agenda': ['calendario', 'tabela', 'programacao'],
    'brasileirao': ['serie-a', 'campeonato-brasileiro'],
    'libertadores': ['copa-libertadores', 'conmebol']
  };
  
  parse(query: string): QueryTerm[] {
    if (!query?.trim()) return [];
    
    const analysis = analyzeAndNormalizeText(query);
    const terms: QueryTerm[] = [];
    
    // Pesos especiais para termos importantes
    const termWeights: Record<string, number> = {
      'jogo': 2.5, 'partida': 2.5, 'agenda': 2.0,
      'transmissao': 2.0, 'assistir': 2.0,
      'flamengo': 3.0, 'palmeiras': 3.0, 'corinthians': 2.8,
      'brasileirao': 2.2, 'copa': 1.8, 'libertadores': 2.5,
      'globo': 1.5, 'sportv': 1.5, 'youtube': 1.8,
      'feminino': 2.0, 'feminina': 2.0, 'masculino': 1.8,
      'time': 2.0, 'equipe': 2.0, 'clube': 2.0
    };
    
    for (const token of analysis.tokens) {
      const stemmed = PorterStemmerPt.stem(token);
      const weight = termWeights[token] || 1.0;
      
      // Adicionar o termo original
      terms.push({
        term: token,
        stemmed,
        weight
      });
      
      // Adicionar sinônimos com peso reduzido
      const synonymList = this.synonyms[token];
      if (synonymList) {
        for (const synonym of synonymList) {
          const synonymStemmed = PorterStemmerPt.stem(synonym);
          terms.push({
            term: synonym,
            stemmed: synonymStemmed,
            weight: weight * 0.7 // Peso reduzido para sinônimos
          });
        }
      }
    }
    
    return terms;
  }
}