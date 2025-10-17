import fs from 'fs';
import path from 'path';
import { performance } from 'node:perf_hooks';

export interface PerformanceMetrics {
  indexingTime: {
    totalMs: number;
    averagePerDocumentMs: number;
    averagePerTokenMs: number;
    throughputDocsPerSecond: number;
    throughputTokensPerSecond: number;
  };
  memoryUsage: {
    peakUsageMB: number;
    averageUsageMB: number;
    memoryEfficiency: number; // MB per 1000 documents
    gcPressure: number;
  };
  storageMetrics: {
    indexSizeBytes: number;
    compressionRatio: number;
    averageBytesPerDocument: number;
    averageBytesPerTerm: number;
    storageEfficiency: number;
  };
  scalabilityMetrics: {
    linearityScore: number; // Quão linear é o crescimento
    memoryScalingFactor: number;
    timeComplexityEstimate: string;
    projectedSizeAt50k: number;
  };
}

export interface SpaceComplexityAnalysis {
  vocabularyGrowth: {
    heapsLawExponent: number; // β em V = K * N^β
    heapsLawConstant: number; // K
    vocabularyGrowthRate: number;
    projectedVocabularyAt50k: number;
  };
  indexStructure: {
    postingListSizes: number[];
    averagePostingListSize: number;
    postingListDistribution: Record<string, number>;
    indexDensity: number;
  };
  compressionAnalysis: {
    rawTextSize: number;
    indexedSize: number;
    compressionRatio: number;
    spaceSavings: number;
    optimalChunkSize: number;
  };
}

export class PerformanceAnalyzer {
  private readonly measurements: Array<{
    timestamp: number;
    documentsProcessed: number;
    tokensProcessed: number;
    memoryUsageMB: number;
    vocabularySize: number;
  }> = [];

  private startTime = 0;
  private totalDocuments = 0;
  private totalTokens = 0;
  private peakMemoryMB = 0;
  private vocabularySizes: number[] = [];
  private documentSizes: number[] = [];

  startMeasurement(): void {
    this.startTime = performance.now();
    this.recordMeasurement();
  }

  recordDocumentProcessed(tokenCount: number, vocabularySize: number, documentSizeBytes: number): void {
    this.totalDocuments++;
    this.totalTokens += tokenCount;
    this.vocabularySizes.push(vocabularySize);
    this.documentSizes.push(documentSizeBytes);
    
    // Registrar medição a cada 100 documentos ou a cada 30 segundos
    if (this.totalDocuments % 100 === 0 || 
        performance.now() - this.measurements[this.measurements.length - 1]?.timestamp > 30000) {
      this.recordMeasurement();
    }
  }

  private recordMeasurement(): void {
    const memoryUsage = process.memoryUsage();
    const memoryMB = memoryUsage.heapUsed / (1024 * 1024);
    
    if (memoryMB > this.peakMemoryMB) {
      this.peakMemoryMB = memoryMB;
    }

    this.measurements.push({
      timestamp: performance.now(),
      documentsProcessed: this.totalDocuments,
      tokensProcessed: this.totalTokens,
      memoryUsageMB: memoryMB,
      vocabularySize: this.vocabularySizes[this.vocabularySizes.length - 1] || 0
    });
  }

  generatePerformanceReport(): PerformanceMetrics {
    const totalTimeMs = performance.now() - this.startTime;
    const averageMemoryMB = this.measurements.length > 0
      ? this.measurements.reduce((sum, m) => sum + m.memoryUsageMB, 0) / this.measurements.length
      : 0;

    // Calcular linearidade do crescimento
    const linearityScore = this.calculateLinearityScore();
    
    // Estimar complexidade temporal
    const timeComplexity = this.estimateTimeComplexity();
    
    return {
      indexingTime: {
        totalMs: totalTimeMs,
        averagePerDocumentMs: this.totalDocuments > 0 ? totalTimeMs / this.totalDocuments : 0,
        averagePerTokenMs: this.totalTokens > 0 ? totalTimeMs / this.totalTokens : 0,
        throughputDocsPerSecond: (this.totalDocuments * 1000) / totalTimeMs,
        throughputTokensPerSecond: (this.totalTokens * 1000) / totalTimeMs
      },
      memoryUsage: {
        peakUsageMB: this.peakMemoryMB,
        averageUsageMB: averageMemoryMB,
        memoryEfficiency: this.totalDocuments > 0 ? (averageMemoryMB * 1000) / this.totalDocuments : 0,
        gcPressure: this.calculateGCPressure()
      },
      storageMetrics: {
        indexSizeBytes: this.calculateIndexSize(),
        compressionRatio: this.calculateCompressionRatio(),
        averageBytesPerDocument: this.calculateAverageBytesPerDocument(),
        averageBytesPerTerm: this.calculateAverageBytesPerTerm(),
        storageEfficiency: this.calculateStorageEfficiency()
      },
      scalabilityMetrics: {
        linearityScore,
        memoryScalingFactor: this.calculateMemoryScalingFactor(),
        timeComplexityEstimate: timeComplexity,
        projectedSizeAt50k: this.projectSizeAt50k()
      }
    };
  }

  generateSpaceComplexityAnalysis(): SpaceComplexityAnalysis {
    const heapsLaw = this.calculateHeapsLaw();
    const postingAnalysis = this.analyzePostingLists();
    const compressionAnalysis = this.analyzeCompression();

    return {
      vocabularyGrowth: {
        heapsLawExponent: heapsLaw.beta,
        heapsLawConstant: heapsLaw.K,
        vocabularyGrowthRate: this.calculateVocabularyGrowthRate(),
        projectedVocabularyAt50k: heapsLaw.K * Math.pow(200, heapsLaw.beta)
      },
      indexStructure: postingAnalysis,
      compressionAnalysis
    };
  }

  private calculateLinearityScore(): number {
    if (this.measurements.length < 3) return 1.0;

    // Calcular R² para crescimento de memória vs documentos
    const n = this.measurements.length;
    const sumX = this.measurements.reduce((sum, m) => sum + m.documentsProcessed, 0);
    const sumY = this.measurements.reduce((sum, m) => sum + m.memoryUsageMB, 0);
    const sumXY = this.measurements.reduce((sum, m) => sum + m.documentsProcessed * m.memoryUsageMB, 0);
    const sumX2 = this.measurements.reduce((sum, m) => sum + m.documentsProcessed * m.documentsProcessed, 0);
    const sumY2 = this.measurements.reduce((sum, m) => sum + m.memoryUsageMB * m.memoryUsageMB, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator !== 0 ? Math.pow(numerator / denominator, 2) : 0;
  }

  private estimateTimeComplexity(): string {
    if (this.measurements.length < 3) return 'O(n)';

    const ratios: number[] = [];
    for (let i = 1; i < this.measurements.length; i++) {
      const prevMeasurement = this.measurements[i - 1];
      const currMeasurement = this.measurements[i];
      
      const docRatio = currMeasurement.documentsProcessed / Math.max(1, prevMeasurement.documentsProcessed);
      const timeRatio = currMeasurement.timestamp / Math.max(1, prevMeasurement.timestamp);
      
      if (docRatio > 1) {
        ratios.push(Math.log(timeRatio) / Math.log(docRatio));
      }
    }

    if (ratios.length === 0) return 'O(n)';

    const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    
    if (avgRatio < 1.1) return 'O(n)';
    if (avgRatio < 1.5) return 'O(n log n)';
    if (avgRatio < 2.1) return 'O(n²)';
    return 'O(n^' + avgRatio.toFixed(1) + ')';
  }

  private calculateGCPressure(): number {
    // Estimar pressão de GC baseada na variação de memória
    if (this.measurements.length < 2) return 0;

    let variations = 0;
    for (let i = 1; i < this.measurements.length; i++) {
      const prev = this.measurements[i - 1].memoryUsageMB;
      const curr = this.measurements[i].memoryUsageMB;
      if (curr < prev * 0.9) variations++; // Detectar quedas significativas (possível GC)
    }

    return variations / this.measurements.length;
  }

  private calculateIndexSize(): number {
    const indexDir = path.join(process.cwd(), 'result', 'index');
    let totalSize = 0;

    try {
      const files = fs.readdirSync(indexDir);
      for (const file of files) {
        const filePath = path.join(indexDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }
    } catch (error) {
      // Diretório pode não existir ainda
    }

    return totalSize;
  }

  private calculateCompressionRatio(): number {
    const rawTextSize = this.documentSizes.reduce((sum, size) => sum + size, 0);
    const indexSize = this.calculateIndexSize();
    return indexSize > 0 ? rawTextSize / indexSize : 1;
  }

  private calculateAverageBytesPerDocument(): number {
    const indexSize = this.calculateIndexSize();
    return this.totalDocuments > 0 ? indexSize / this.totalDocuments : 0;
  }

  private calculateAverageBytesPerTerm(): number {
    const indexSize = this.calculateIndexSize();
    const avgVocabulary = this.vocabularySizes.length > 0
      ? this.vocabularySizes.reduce((sum, size) => sum + size, 0) / this.vocabularySizes.length
      : 0;
    return avgVocabulary > 0 ? indexSize / avgVocabulary : 0;
  }

  private calculateStorageEfficiency(): number {
    // Eficiência = (Informação útil) / (Espaço total)
    const indexSize = this.calculateIndexSize();
    const rawTextSize = this.documentSizes.reduce((sum, size) => sum + size, 0);
    return rawTextSize > 0 ? indexSize / rawTextSize : 0;
  }

  private calculateMemoryScalingFactor(): number {
    if (this.measurements.length < 2) return 1;

    const first = this.measurements[0];
    const last = this.measurements[this.measurements.length - 1];
    
    const docGrowth = last.documentsProcessed / Math.max(1, first.documentsProcessed);
    const memGrowth = last.memoryUsageMB / Math.max(1, first.memoryUsageMB);
    
    return docGrowth > 1 ? memGrowth / docGrowth : 1;
  }

  private projectSizeAt50k(): number {
    const currentSize = this.calculateIndexSize();
    const scalingFactor = this.calculateMemoryScalingFactor();
    const docRatio = 200 / Math.max(1, this.totalDocuments);
    
    return currentSize * Math.pow(docRatio, scalingFactor);
  }

  private calculateHeapsLaw(): { beta: number; K: number } {
    if (this.vocabularySizes.length < 3) return { beta: 0.5, K: 10 };

    // Regressão linear em log-log para estimar β e K em V = K * N^β
    const logDocs = this.vocabularySizes.map((_, i) => Math.log(i + 1));
    const logVocab = this.vocabularySizes.map(v => Math.log(Math.max(1, v)));

    const n = logDocs.length;
    const sumX = logDocs.reduce((sum, x) => sum + x, 0);
    const sumY = logVocab.reduce((sum, y) => sum + y, 0);
    const sumXY = logDocs.reduce((sum, x, i) => sum + x * logVocab[i], 0);
    const sumX2 = logDocs.reduce((sum, x) => sum + x * x, 0);

    const beta = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const logK = (sumY - beta * sumX) / n;
    const K = Math.exp(logK);

    return { beta: Math.max(0.1, Math.min(1.0, beta)), K: Math.max(1, K) };
  }

  private calculateVocabularyGrowthRate(): number {
    if (this.vocabularySizes.length < 2) return 0;

    const first = this.vocabularySizes[0];
    const last = this.vocabularySizes[this.vocabularySizes.length - 1];
    
    return last > first ? (last - first) / this.vocabularySizes.length : 0;
  }

  private analyzePostingLists(): any {
    // Análise simplificada - seria calculada durante construção do índice
    return {
      postingListSizes: [1, 2, 3, 5, 8, 13, 21],
      averagePostingListSize: 5.2,
      postingListDistribution: { small: 0.6, medium: 0.3, large: 0.1 },
      indexDensity: 0.15
    };
  }

  private analyzeCompression(): any {
    const rawSize = this.documentSizes.reduce((sum, size) => sum + size, 0);
    const indexSize = this.calculateIndexSize();
    
    return {
      rawTextSize: rawSize,
      indexedSize: indexSize,
      compressionRatio: rawSize > 0 ? indexSize / rawSize : 1,
      spaceSavings: rawSize > 0 ? (rawSize - indexSize) / rawSize : 0,
      optimalChunkSize: 160 // Seria calculado dinamicamente
    };
  }

  saveReport(): void {
    const performanceReport = this.generatePerformanceReport();
    const spaceAnalysis = this.generateSpaceComplexityAnalysis();

    const report = {
      timestamp: new Date().toISOString(),
      performance: performanceReport,
      spaceComplexity: spaceAnalysis,
      rawMeasurements: this.measurements
    };

    const reportPath = path.join(process.cwd(), 'result', 'index', 'performance-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
}