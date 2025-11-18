import fs from 'fs';
import path from 'path';
import { SearchResult, SearchOptions } from './types';
import { QueryParser } from './queryParser';

interface IndexData {
  documents: any[];
  chunkIndexes: Array<{
    terms: Record<string, {
      docFrequency: number;
      totalFrequency: number;
      idf: number;
      postings: Array<{
        docId: string;
        chunkId: number;
        termFrequency: number;
        normalizedTF: number;
      }>;
    }>;
  }>;
}

export class SearchEngine {
  private indexData: IndexData | null = null;
  private queryParser = new QueryParser();
  
  constructor() {
    this.loadIndex();
  }
  
  private loadIndex(): void {
    try {
      const indexPath = path.join(process.cwd(), 'result', 'index', 'inverted-index.json');
      const data = fs.readFileSync(indexPath, 'utf8');
      this.indexData = JSON.parse(data);
      console.log(`📚 Índice carregado: ${this.indexData?.documents?.length || 0} documentos`);
    } catch (error) {
      console.error('❌ Erro ao carregar índice:', error);
    }
  }
  
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    if (!this.indexData || !query?.trim()) return [];
    
    const { limit = 10, minScore = 0.05, pageTypes } = options;
    const queryTerms = this.queryParser.parse(query);
    
    if (!queryTerms.length) return [];
    
    const scores = new Map<string, number>();
    const terms = this.indexData.chunkIndexes[0]?.terms || {};
    const documents = this.indexData.documents || [];
    
    // Busca híbrida: TF-IDF + busca direta nos documentos
    for (const queryTerm of queryTerms) {
      // 1. Busca no índice invertido (TF-IDF)
      const termData = terms[queryTerm.stemmed];
      if (termData) {
        for (const posting of termData.postings) {
          const currentScore = scores.get(posting.docId) || 0;
          const tf = posting.normalizedTF || posting.termFrequency || 1;
          const idf = termData.idf || Math.log(documents.length / termData.docFrequency);
          const tfIdfScore = tf * idf * queryTerm.weight;
          
          if (!isNaN(tfIdfScore)) {
            scores.set(posting.docId, currentScore + tfIdfScore);
          }
        }
      }
      
      // 2. Busca direta nos títulos e URLs (fallback para termos não indexados)
      for (const doc of documents) {
        const title = (doc.title || '').toLowerCase();
        const url = (doc.url || '').toLowerCase();
        const termLower = queryTerm.term.toLowerCase();
        
        let directScore = 0;
        
        // Busca exata no título (peso alto)
        if (title.includes(termLower)) {
          const titleMatches = (title.match(new RegExp(termLower, 'g')) || []).length;
          directScore += titleMatches * 3.0 * queryTerm.weight;
        }
        
        // Busca na URL (peso médio)
        if (url.includes(termLower)) {
          const urlMatches = (url.match(new RegExp(termLower, 'g')) || []).length;
          directScore += urlMatches * 1.5 * queryTerm.weight;
        }
        
        // Busca por palavras parciais (para "feminino" encontrar "feminina")
        const partialTerm = termLower.substring(0, Math.max(4, termLower.length - 2));
        if (partialTerm.length >= 4) {
          if (title.includes(partialTerm)) {
            directScore += 1.0 * queryTerm.weight;
          }
        }
        
        if (directScore > 0) {
          const currentScore = scores.get(doc.docId) || 0;
          scores.set(doc.docId, currentScore + directScore);
        }
      }
    }
    
    // Converter para resultados e ordenar
    const results: SearchResult[] = [];
    
    for (const [docId, score] of scores.entries()) {
      if (score < minScore) continue;
      
      const doc = documents.find(d => d.docId === docId);
      if (!doc) continue;
      
      // Filtrar por tipo de página se especificado
      if (pageTypes && pageTypes.length > 0) {
        const docPageType = doc.pageType || 'outro';
        if (!pageTypes.includes(docPageType)) {
          continue;
        }
      }
      
      // Boost por tipo de página
      const pageTypeBoosts: Record<string, number> = {
        'agenda': 2.2,
        'onde-assistir': 2.0,
        'match': 1.8,
        'noticia': 1.2,
        'team': 1.5,
        'outro': 1.0
      };
      
      const docPageType = doc.pageType || 'outro';
      const boost = pageTypeBoosts[docPageType] || 1.0;
      const finalScore = isNaN(score) ? 0 : score * boost;
      
      results.push({
        docId,
        url: doc.url,
        title: doc.title || 'Sem título',
        score: Math.round(finalScore * 1000) / 1000,
        snippet: this.generateSnippet(doc.title, query),
        fetchedAt: doc.fetchedAt,
        pageType: docPageType
      });
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  private generateSnippet(title: string, query: string): string {
    if (!title) return 'Documento sem título disponível';
    
    const words = title.split(' ');
    if (words.length <= 20) return title;
    
    // Tentar encontrar a parte mais relevante do título
    const queryWords = query.toLowerCase().split(' ');
    let bestStart = 0;
    let maxMatches = 0;
    
    for (let i = 0; i <= words.length - 15; i++) {
      const segment = words.slice(i, i + 15).join(' ').toLowerCase();
      const matches = queryWords.filter(qw => segment.includes(qw)).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestStart = i;
      }
    }
    
    const snippet = words.slice(bestStart, bestStart + 15).join(' ');
    const prefix = bestStart > 0 ? '...' : '';
    const suffix = bestStart + 15 < words.length ? '...' : '';
    
    return prefix + snippet + suffix;
  }
}