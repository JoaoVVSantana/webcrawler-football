import { performance } from 'node:perf_hooks';
import natural from 'natural';
import { INDEX_CONFIG } from '../config';

const { PorterStemmerPt } = natural;

export interface LexicalMetrics {
  totalTokens: number;
  uniqueTokens: number;
  stopwordCount: number;
  averageTokenLength: number;
  lexicalDensity: number;
  vocabularyRichness: number;
  compressionRatio: number;
  processingTimeMs: number;
}

export interface TermStatistics {
  term: string;
  frequency: number;
  relativeFrequency: number;
  stemmedForm: string;
  documentFrequency?: number;
}

export interface LexicalAnalysisResult {
  originalTokens: string[];
  filteredTokens: string[];
  stemmedTokens: string[];
  termFrequencies: Map<string, number>;
  stemFrequencies: Map<string, number>;
  topTerms: TermStatistics[];
  metrics: LexicalMetrics;
}

const FOOTBALL_STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'ate', 'com', 'como', 'quando', 'quanto', 'que', 'quem', 'o', 'os', 'da', 'do', 'das', 'dos',
  'de', 'e', 'em', 'no', 'nos', 'na', 'nas', 'num', 'numa', 'numas', 'para', 'por', 'se', 'sem', 'sob', 'sobre',
  'pra', 'pro', 'porque', 'pois', 'mas', 'ou', 'onde', 'lhe', 'lhes', 'me', 'te', 'seu', 'sua', 'seus', 'suas',
  'este', 'esta', 'estes', 'estas', 'isso', 'isto', 'aquele', 'aquela', 'aqueles', 'aquelas', 'depois', 'antes',
  'entao', 'assim', 'tambem', 'muito', 'muita', 'muitos', 'muitas', 'pouco', 'pouca', 'poucos', 'poucas',
  'cada', 'algum', 'alguns', 'algumas', 'nenhum', 'nenhuma', 'sendo', 'era', 'eram', 'ser', 'sao', 'foi', 'foram',
  'seja', 'sejam', 'sera', 'serao', 'ter', 'tem', 'tendo', 'tinha', 'tinham', 'ja', 'ainda', 'sempre', 'nunca',
  'todo', 'toda', 'todos', 'todas', 'vai', 'vao', 'ele', 'ela', 'eles', 'elas', 'nos', 'voces',

  'mais', 'ver', 'clique', 'aqui', 'saiba', 'veja', 'leia', 'acesse', 'confira', 'acompanhe', 'assista',
  'pagina', 'site', 'link', 'menu', 'principal', 'home', 'inicio', 'voltar', 'proximo', 'anterior',
  'compartilhar', 'curtir', 'seguir', 'inscrever', 'comentar', 'publicado', 'atualizado', 'editado'
]);

export class LexicalAnalyzer {
  private readonly minTokenLength: number;
  private readonly maxTokens: number;
  private readonly topTermsLimit: number;

  constructor() {
    this.minTokenLength = INDEX_CONFIG.minTokenLength;
    this.maxTokens = INDEX_CONFIG.maxTokensPerDocument;
    this.topTermsLimit = INDEX_CONFIG.topTermsLimit;
  }

  analyze(text: string): LexicalAnalysisResult {
    const startTime = performance.now();
    
    if (!text?.trim()) {
      return this.createEmptyResult(0);
    }

    // Tokenização inicial
    const originalTokens = this.tokenize(text);
    
    // Filtrar stopwords e tokens muito curtos
    const filteredTokens = this.filterTokens(originalTokens);
    
    // Aplicar stemming
    const { stemmedTokens, stemFrequencies } = this.applyStemming(filteredTokens);
    
    // Calcular frequências
    const termFrequencies = this.calculateFrequencies(filteredTokens);
    
    // Calcular métricas
    const metrics = this.calculateMetrics(
      originalTokens,
      filteredTokens,
      stemmedTokens,
      performance.now() - startTime
    );
    
    // Extrair termos mais relevantes
    const topTerms = this.extractTopTerms(termFrequencies, stemFrequencies);

    return {
      originalTokens,
      filteredTokens,
      stemmedTokens,
      termFrequencies,
      stemFrequencies,
      topTerms,
      metrics
    };
  }

  private tokenize(text: string): string[] {
    // Normalizar e remover acentos
    const normalized = text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    
    // Extrair tokens alfanuméricos
    return normalized
      .split(/[^a-z0-9]+/)
      .map(token => token.trim())
      .filter(token => token.length >= this.minTokenLength);
  }

  private filterTokens(tokens: string[]): string[] {
    return tokens.filter(token => 
      token.length >= this.minTokenLength && 
      !FOOTBALL_STOPWORDS.has(token) &&
      !/^\d+$/.test(token) // Remove números puros
    );
  }

  private applyStemming(tokens: string[]): { stemmedTokens: string[]; stemFrequencies: Map<string, number> } {
    const stemmedTokens: string[] = [];
    const stemFrequencies = new Map<string, number>();

    for (const token of tokens) {
      const stem = PorterStemmerPt.stem(token);
      stemmedTokens.push(stem);
      stemFrequencies.set(stem, (stemFrequencies.get(stem) || 0) + 1);
    }

    return { stemmedTokens, stemFrequencies };
  }

  private calculateFrequencies(tokens: string[]): Map<string, number> {
    const frequencies = new Map<string, number>();
    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }
    return frequencies;
  }

  private calculateMetrics(
    originalTokens: string[],
    filteredTokens: string[],
    stemmedTokens: string[],
    processingTime: number
  ): LexicalMetrics {
    const totalTokens = filteredTokens.length;
    const uniqueTokens = new Set(filteredTokens).size;
    const uniqueStems = new Set(stemmedTokens).size;
    const stopwordCount = originalTokens.length - filteredTokens.length;
    
    const averageTokenLength = totalTokens > 0 
      ? filteredTokens.reduce((sum, token) => sum + token.length, 0) / totalTokens 
      : 0;
    
    const lexicalDensity = originalTokens.length > 0 
      ? totalTokens / originalTokens.length 
      : 0;
    
    const vocabularyRichness = totalTokens > 0 
      ? uniqueTokens / totalTokens 
      : 0;
    
    const compressionRatio = uniqueTokens > 0 
      ? uniqueStems / uniqueTokens 
      : 0;

    return {
      totalTokens,
      uniqueTokens,
      stopwordCount,
      averageTokenLength: Number(averageTokenLength.toFixed(4)),
      lexicalDensity: Number(lexicalDensity.toFixed(6)),
      vocabularyRichness: Number(vocabularyRichness.toFixed(6)),
      compressionRatio: Number(compressionRatio.toFixed(6)),
      processingTimeMs: Number(processingTime.toFixed(3))
    };
  }

  private extractTopTerms(
    termFrequencies: Map<string, number>,
    stemFrequencies: Map<string, number>
  ): TermStatistics[] {
    const totalTerms = Array.from(termFrequencies.values()).reduce((sum, freq) => sum + freq, 0);
    
    return Array.from(termFrequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.topTermsLimit)
      .map(([term, frequency]) => ({
        term,
        frequency,
        relativeFrequency: Number((frequency / totalTerms).toFixed(6)),
        stemmedForm: PorterStemmerPt.stem(term)
      }));
  }

  private createEmptyResult(processingTime: number): LexicalAnalysisResult {
    return {
      originalTokens: [],
      filteredTokens: [],
      stemmedTokens: [],
      termFrequencies: new Map(),
      stemFrequencies: new Map(),
      topTerms: [],
      metrics: {
        totalTokens: 0,
        uniqueTokens: 0,
        stopwordCount: 0,
        averageTokenLength: 0,
        lexicalDensity: 0,
        vocabularyRichness: 0,
        compressionRatio: 0,
        processingTimeMs: processingTime
      }
    };
  }
}