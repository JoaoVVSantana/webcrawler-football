import { AdvancedInvertedIndex, HyperparameterAnalysis } from './advancedInvertedIndex';
import { PerformanceAnalyzer, PerformanceMetrics, SpaceComplexityAnalysis } from './performanceAnalyzer';
import { DocumentRecord } from '../types';
import fs from 'fs';
import path from 'path';

export interface IndexingReport {
  summary: {
    documentsProcessed: number;
    totalTokens: number;
    vocabularySize: number;
    indexingTimeMs: number;
    indexSizeBytes: number;
  };
  hyperparameterAnalysis: HyperparameterAnalysis;
  performanceMetrics: PerformanceMetrics;
  spaceComplexity: SpaceComplexityAnalysis;
  recommendations: string[];
}

export class IndexingPipeline {
  private readonly invertedIndex: AdvancedInvertedIndex;
  private readonly performanceAnalyzer: PerformanceAnalyzer;
  private documentsProcessed = 0;
  private totalTokens = 0;

  constructor() {
    this.invertedIndex = new AdvancedInvertedIndex();
    this.performanceAnalyzer = new PerformanceAnalyzer();
  }

  start(): void {
    console.log('🚀 Iniciando pipeline de indexação avançada...');
    this.invertedIndex.startIndexing();
    this.performanceAnalyzer.startMeasurement();
  }

  processDocument(record: DocumentRecord): void {
    if (!record.metadata || !record.cleanedText) return;

    const { metadata, cleanedText } = record;
    const documentSizeBytes = Buffer.byteLength(cleanedText, 'utf8');

    // Processar no índice invertido
    this.invertedIndex.addDocument(
      metadata.rawHtmlHash,
      metadata.url,
      metadata.title || 'Sem título',
      cleanedText,
      {
        fetchedAt: metadata.fetchedAt,
        status: metadata.status,
        source: metadata.source,
        pageType: metadata.pageType
      }
    );

    // Estimar tokens (simplificado)
    const estimatedTokens = cleanedText.split(/\s+/).length;
    const estimatedVocabulary = new Set(cleanedText.toLowerCase().split(/\W+/)).size;

    // Registrar métricas de performance
    this.performanceAnalyzer.recordDocumentProcessed(
      estimatedTokens,
      estimatedVocabulary,
      documentSizeBytes
    );

    this.documentsProcessed++;
    this.totalTokens += estimatedTokens;

    // Log de progresso
    if (this.documentsProcessed % 100 === 0) {
      console.log(`📊 Processados ${this.documentsProcessed} documentos (${this.totalTokens.toLocaleString()} tokens)`);
    }
  }

  finalize(): IndexingReport {
    console.log('🔄 Finalizando indexação e gerando análises...');

    // Finalizar índice invertido e obter análise de hiperparâmetros
    const hyperparameterAnalysis = this.invertedIndex.finalize();

    // Gerar relatórios de performance
    const performanceMetrics = this.performanceAnalyzer.generatePerformanceReport();
    const spaceComplexity = this.performanceAnalyzer.generateSpaceComplexityAnalysis();

    // Salvar relatório de performance
    this.performanceAnalyzer.saveReport();

    // Gerar recomendações consolidadas
    const recommendations = this.generateConsolidatedRecommendations(
      hyperparameterAnalysis,
      performanceMetrics,
      spaceComplexity
    );

    const report: IndexingReport = {
      summary: {
        documentsProcessed: this.documentsProcessed,
        totalTokens: this.totalTokens,
        vocabularySize: hyperparameterAnalysis.chunkSizeAnalysis[0]?.vocabularySize || 0,
        indexingTimeMs: performanceMetrics.indexingTime.totalMs,
        indexSizeBytes: performanceMetrics.storageMetrics.indexSizeBytes
      },
      hyperparameterAnalysis,
      performanceMetrics,
      spaceComplexity,
      recommendations
    };

    this.saveConsolidatedReport(report);
    this.printSummary(report);

    return report;
  }

  private generateConsolidatedRecommendations(
    hyperparams: HyperparameterAnalysis,
    performance: PerformanceMetrics,
    space: SpaceComplexityAnalysis
  ): string[] {
    const recommendations: string[] = [];

    // Recomendações de hiperparâmetros
    recommendations.push(...hyperparams.recommendations);

    // Recomendações de performance
    if (performance.indexingTime.throughputDocsPerSecond < 10) {
      recommendations.push('⚠️ Baixo throughput detectado - considere otimizar processamento');
    }

    if (performance.memoryUsage.memoryEfficiency > 50) {
      recommendations.push('💾 Alto uso de memória por documento - revisar estruturas de dados');
    }

    if (performance.scalabilityMetrics.linearityScore < 0.8) {
      recommendations.push('📈 Crescimento não-linear detectado - investigar gargalos');
    }

    // Recomendações de espaço
    if (space.compressionAnalysis.compressionRatio < 0.3) {
      recommendations.push('🗜️ Baixa compressão - considere técnicas de compressão adicionais');
    }

    if (space.vocabularyGrowth.heapsLawExponent > 0.7) {
      recommendations.push('📚 Crescimento rápido do vocabulário - ajustar filtros de termos');
    }

    // Projeções para 50k documentos
    const projectedSizeGB = performance.scalabilityMetrics.projectedSizeAt50k / (1024 * 1024 * 1024);
    if (projectedSizeGB > 5) {
      recommendations.push(`💽 Tamanho projetado para 50k docs: ${projectedSizeGB.toFixed(1)}GB - considere otimizações`);
    }

    return recommendations;
  }

  private saveConsolidatedReport(report: IndexingReport): void {
    const reportPath = path.join(process.cwd(), 'result', 'index', 'indexing-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Relatório consolidado salvo em: ${reportPath}`);
  }

  private printSummary(report: IndexingReport): void {
    const { summary, performanceMetrics, hyperparameterAnalysis } = report;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RELATÓRIO DE INDEXAÇÃO - SEGUNDA PARTE DO TRABALHO');
    console.log('='.repeat(60));
    
    console.log('\n📈 RESUMO EXECUTIVO:');
    console.log(`   Documentos processados: ${summary.documentsProcessed.toLocaleString()}`);
    console.log(`   Tokens indexados: ${summary.totalTokens.toLocaleString()}`);
    console.log(`   Vocabulário único: ${summary.vocabularySize.toLocaleString()} termos`);
    console.log(`   Tempo de indexação: ${(summary.indexingTimeMs / 1000).toFixed(1)}s`);
    console.log(`   Tamanho do índice: ${(summary.indexSizeBytes / (1024 * 1024)).toFixed(1)} MB`);
    
    console.log('\n⚡ PERFORMANCE:');
    console.log(`   Throughput: ${performanceMetrics.indexingTime.throughputDocsPerSecond.toFixed(1)} docs/s`);
    console.log(`   Memória pico: ${performanceMetrics.memoryUsage.peakUsageMB.toFixed(1)} MB`);
    console.log(`   Complexidade temporal: ${performanceMetrics.scalabilityMetrics.timeComplexityEstimate}`);
    
    console.log('\n🔧 HIPERPARÂMETROS:');
    console.log(`   Chunk size ótimo: ${hyperparameterAnalysis.optimalChunkSize} tokens`);
    console.log(`   Taxa de stemming: ${(hyperparameterAnalysis.stemReductionRate * 100).toFixed(1)}%`);
    console.log(`   Taxa de stopwords: ${(hyperparameterAnalysis.stopwordFilteringRate * 100).toFixed(1)}%`);
    
    console.log('\n💡 PRINCIPAIS RECOMENDAÇÕES:');
    report.recommendations.slice(0, 5).forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Indexação concluída com sucesso!');
    console.log('='.repeat(60) + '\n');
  }
}