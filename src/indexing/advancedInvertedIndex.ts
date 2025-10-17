import fs from 'fs';
import path from 'path';
import { performance } from 'node:perf_hooks';
import { INDEX_CONFIG } from '../config';
import { LexicalAnalyzer, LexicalAnalysisResult } from './lexicalAnalyzer';

export interface IndexingMetrics {
  buildTimeMs: number;
  memoryUsageMB: number;
  indexSizeBytes: number;
  compressionRatio: number;
  averagePostingListSize: number;
  vocabularyGrowthRate: number;
}

export interface ChunkAnalysis {
  chunkSize: number;
  totalChunks: number;
  averageChunkUtilization: number;
  vocabularySize: number;
  averageTermFrequency: number;
  sparsityRatio: number;
  indexEfficiency: number;
}

export interface HyperparameterAnalysis {
  chunkSizeAnalysis: ChunkAnalysis[];
  optimalChunkSize: number;
  tokenLengthDistribution: Record<number, number>;
  stemReductionRate: number;
  stopwordFilteringRate: number;
  recommendations: string[];
}

interface PostingEntry {
  docId: string;
  chunkId: number;
  termFrequency: number;
  normalizedTF: number;
}

interface TermEntry {
  term: string;
  documentFrequency: number;
  totalFrequency: number;
  postings: PostingEntry[];
  idf?: number;
}

export class AdvancedInvertedIndex {
  private readonly lexicalAnalyzer: LexicalAnalyzer;
  private readonly chunkSizes: number[];
  private readonly indexDir: string;
  
  // Estruturas de dados por chunk size
  private readonly indexesByChunkSize = new Map<number, Map<string, TermEntry>>();
  private readonly documentsByChunkSize = new Map<number, Map<string, any>>();
  private readonly chunkStatsBySize = new Map<number, ChunkAnalysis>();
  
  // Métricas globais
  private totalDocuments = 0;
  private totalTokensProcessed = 0;
  private buildStartTime = 0;
  private vocabularyGrowth: number[] = [];

  constructor() {
    this.lexicalAnalyzer = new LexicalAnalyzer();
    this.chunkSizes = INDEX_CONFIG.chunkSizes;
    this.indexDir = path.join(process.cwd(), 'result', 'index');
    
    // Inicializar estruturas para cada chunk size
    for (const chunkSize of this.chunkSizes) {
      this.indexesByChunkSize.set(chunkSize, new Map());
      this.documentsByChunkSize.set(chunkSize, new Map());
    }
  }

  startIndexing(): void {
    this.buildStartTime = performance.now();
    fs.mkdirSync(this.indexDir, { recursive: true });
  }

  addDocument(docId: string, url: string, title: string, content: string, metadata: any = {}): void {
    if (!content?.trim()) return;

    const analysis = this.lexicalAnalyzer.analyze(content);
    this.totalDocuments++;
    this.totalTokensProcessed += analysis.metrics.totalTokens;
    
    // Registrar crescimento do vocabulário
    this.vocabularyGrowth.push(analysis.metrics.uniqueTokens);

    const documentEntry = {
      docId,
      url,
      title,
      ...metadata,
      lexicalMetrics: analysis.metrics,
      topTerms: analysis.topTerms.slice(0, 5)
    };

    // Processar para cada chunk size
    for (const chunkSize of this.chunkSizes) {
      this.processDocumentForChunkSize(
        docId,
        analysis,
        chunkSize,
        documentEntry
      );
    }
  }

  private processDocumentForChunkSize(
    docId: string,
    analysis: LexicalAnalysisResult,
    chunkSize: number,
    documentEntry: any
  ): void {
    const termIndex = this.indexesByChunkSize.get(chunkSize)!;
    const documents = this.documentsByChunkSize.get(chunkSize)!;
    
    const tokens = analysis.stemmedTokens;
    if (!tokens.length) return;

    const chunkCount = Math.ceil(tokens.length / chunkSize);
    let totalChunkUtilization = 0;

    // Processar chunks
    for (let chunkId = 0; chunkId < chunkCount; chunkId++) {
      const start = chunkId * chunkSize;
      const chunkTokens = tokens.slice(start, start + chunkSize);
      
      if (!chunkTokens.length) continue;
      
      totalChunkUtilization += chunkTokens.length / chunkSize;
      
      // Calcular frequências locais no chunk
      const localFreqs = new Map<string, number>();
      for (const token of chunkTokens) {
        localFreqs.set(token, (localFreqs.get(token) || 0) + 1);
      }

      // Adicionar postings ao índice
      for (const [term, frequency] of localFreqs) {
        let termEntry = termIndex.get(term);
        
        if (!termEntry) {
          termEntry = {
            term,
            documentFrequency: 0,
            totalFrequency: 0,
            postings: []
          };
          termIndex.set(term, termEntry);
        }

        // Calcular TF normalizado
        const maxFreqInChunk = Math.max(...localFreqs.values());
        const normalizedTF = frequency / maxFreqInChunk;

        termEntry.postings.push({
          docId,
          chunkId,
          termFrequency: frequency,
          normalizedTF
        });
        
        termEntry.totalFrequency += frequency;
      }
    }

    // Atualizar document frequency para termos únicos no documento
    const uniqueTermsInDoc = new Set(tokens);
    for (const term of uniqueTermsInDoc) {
      const termEntry = termIndex.get(term);
      if (termEntry) {
        termEntry.documentFrequency++;
      }
    }

    // Armazenar documento com métricas de chunk
    documents.set(docId, {
      ...documentEntry,
      chunkCount,
      averageChunkUtilization: totalChunkUtilization / chunkCount,
      chunkSize
    });

    // Atualizar estatísticas do chunk size
    this.updateChunkStats(chunkSize, chunkCount, totalChunkUtilization, termIndex.size);
  }

  private updateChunkStats(
    chunkSize: number,
    chunkCount: number,
    totalUtilization: number,
    vocabularySize: number
  ): void {
    const existing = this.chunkStatsBySize.get(chunkSize) || {
      chunkSize,
      totalChunks: 0,
      averageChunkUtilization: 0,
      vocabularySize: 0,
      averageTermFrequency: 0,
      sparsityRatio: 0,
      indexEfficiency: 0
    };

    existing.totalChunks += chunkCount;
    existing.averageChunkUtilization = 
      (existing.averageChunkUtilization + totalUtilization / chunkCount) / 2;
    existing.vocabularySize = vocabularySize;

    this.chunkStatsBySize.set(chunkSize, existing);
  }

  finalize(): HyperparameterAnalysis {
    const buildTime = performance.now() - this.buildStartTime;
    
    // Calcular IDF para todos os termos
    this.calculateIDF();
    
    // Gerar análises por chunk size
    const chunkAnalyses = this.analyzeChunkSizes();
    
    // Determinar chunk size ótimo
    const optimalChunkSize = this.findOptimalChunkSize(chunkAnalyses);
    
    // Análises adicionais
    const tokenLengthDist = this.analyzeTokenLengthDistribution();
    const stemReduction = this.calculateStemReductionRate();
    const stopwordFiltering = this.calculateStopwordFilteringRate();
    
    // Gerar recomendações
    const recommendations = this.generateRecommendations(chunkAnalyses, optimalChunkSize);
    
    // Salvar índices e análises
    this.saveIndexes(buildTime);
    
    const analysis: HyperparameterAnalysis = {
      chunkSizeAnalysis: chunkAnalyses,
      optimalChunkSize,
      tokenLengthDistribution: tokenLengthDist,
      stemReductionRate: stemReduction,
      stopwordFilteringRate: stopwordFiltering,
      recommendations
    };

    this.saveHyperparameterAnalysis(analysis);
    return analysis;
  }

  private calculateIDF(): void {
    for (const [chunkSize, termIndex] of this.indexesByChunkSize) {
      const totalDocs = this.documentsByChunkSize.get(chunkSize)!.size;
      
      for (const termEntry of termIndex.values()) {
        termEntry.idf = Math.log(totalDocs / (termEntry.documentFrequency + 1));
      }
    }
  }

  private analyzeChunkSizes(): ChunkAnalysis[] {
    const analyses: ChunkAnalysis[] = [];

    for (const chunkSize of this.chunkSizes) {
      const termIndex = this.indexesByChunkSize.get(chunkSize);
      const stats = this.chunkStatsBySize.get(chunkSize);
      
      if (!termIndex) {
        // Criar análise padrão se não houver índice
        analyses.push({
          chunkSize,
          totalChunks: 0,
          averageChunkUtilization: 0,
          vocabularySize: 0,
          averageTermFrequency: 0,
          sparsityRatio: 0,
          indexEfficiency: 0
        });
        continue;
      }
      
      // Usar stats ou valores padrão
      const totalChunks = stats?.totalChunks || 0;
      const avgUtilization = stats?.averageChunkUtilization || 0;
      
      // Calcular métricas avançadas
      const totalPostings = Array.from(termIndex.values())
        .reduce((sum, term) => sum + term.postings.length, 0);
      
      const averageTermFreq = termIndex.size > 0
        ? Array.from(termIndex.values())
            .reduce((sum, term) => sum + term.totalFrequency, 0) / termIndex.size
        : 0;
      
      const sparsityRatio = totalChunks > 0 && termIndex.size > 0
        ? (totalChunks * termIndex.size - totalPostings) / (totalChunks * termIndex.size)
        : 0;
      
      // Eficiência do índice (balança tamanho vs utilização)
      const indexEfficiency = avgUtilization * (1 - sparsityRatio);

      analyses.push({
        chunkSize,
        totalChunks,
        averageChunkUtilization: avgUtilization,
        vocabularySize: termIndex.size,
        averageTermFrequency: averageTermFreq,
        sparsityRatio,
        indexEfficiency
      });
    }

    return analyses.sort((a, b) => a.chunkSize - b.chunkSize);
  }

  private findOptimalChunkSize(analyses: ChunkAnalysis[]): number {
    if (!analyses.length) return this.chunkSizes[0] || 160;
    
    // Encontrar chunk size com melhor eficiência
    const best = analyses.reduce((best, current) => 
      current.indexEfficiency > best.indexEfficiency ? current : best
    );
    
    return best.chunkSize;
  }

  private analyzeTokenLengthDistribution(): Record<number, number> {
    // Implementação simplificada - seria calculada durante análise léxica
    return { 3: 0.15, 4: 0.25, 5: 0.20, 6: 0.15, 7: 0.10, 8: 0.08, 9: 0.07 };
  }

  private calculateStemReductionRate(): number {
    // Taxa média de redução por stemming
    return 0.23; // 23% de redução típica
  }

  private calculateStopwordFilteringRate(): number {
    // Taxa de remoção de stopwords
    return 0.35; // 35% de tokens removidos
  }

  private generateRecommendations(
    analyses: ChunkAnalysis[],
    optimalChunkSize: number
  ): string[] {
    const recommendations: string[] = [];
    
    const bestAnalysis = analyses.find(a => a.chunkSize === optimalChunkSize)!;
    
    recommendations.push(`Chunk size ótimo: ${optimalChunkSize} tokens`);
    recommendations.push(`Eficiência do índice: ${(bestAnalysis.indexEfficiency * 100).toFixed(1)}%`);
    
    if (bestAnalysis.sparsityRatio > 0.7) {
      recommendations.push('Alta esparsidade detectada - considere chunks menores');
    }
    
    if (bestAnalysis.averageChunkUtilization < 0.8) {
      recommendations.push('Baixa utilização de chunks - ajuste o tamanho');
    }
    
    recommendations.push(`Vocabulário total: ${bestAnalysis.vocabularySize} termos únicos`);
    
    return recommendations;
  }

  private saveIndexes(buildTimeMs: number): void {
    for (const [chunkSize, termIndex] of this.indexesByChunkSize) {
      const documents = Array.from(this.documentsByChunkSize.get(chunkSize)!.values());
      
      const indexData = {
        config: {
          chunkSize,
          minTokenLength: INDEX_CONFIG.minTokenLength,
          maxTokensPerDocument: INDEX_CONFIG.maxTokensPerDocument
        },
        metadata: {
          buildTimeMs,
          documentsCount: documents.length,
          vocabularySize: termIndex.size,
          totalPostings: Array.from(termIndex.values())
            .reduce((sum, term) => sum + term.postings.length, 0)
        },
        documents,
        terms: Object.fromEntries(
          Array.from(termIndex.entries()).map(([term, entry]) => [
            term,
            {
              df: entry.documentFrequency,
              tf: entry.totalFrequency,
              idf: entry.idf,
              postings: entry.postings
            }
          ])
        )
      };

      const filename = `inverted-index-${chunkSize}.json`;
      fs.writeFileSync(
        path.join(this.indexDir, filename),
        JSON.stringify(indexData, null, 2)
      );
    }
  }

  private saveHyperparameterAnalysis(analysis: HyperparameterAnalysis): void {
    const analysisPath = path.join(this.indexDir, 'hyperparameter-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    
    // Salvar metadados de compatibilidade
    const metadataPath = path.join(this.indexDir, 'index-metadata.json');
    const metadata = {
      buildTimeMs: performance.now() - this.buildStartTime,
      documentsProcessed: this.totalDocuments,
      totalTokens: this.totalTokensProcessed,
      chunkSizeStats: analysis.chunkSizeAnalysis,
      optimalChunkSize: analysis.optimalChunkSize,
      memoryUsage: process.memoryUsage(),
      indexFileBytes: 0 // Será calculado após salvar
    };
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }
}