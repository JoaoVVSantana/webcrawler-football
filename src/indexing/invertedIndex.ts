import fs from 'fs';
import path from 'path';
import { performance } from 'node:perf_hooks';
import { INDEX_CONFIG } from '../config';
import { DocumentRecord, LexicalAnalysisDetail } from '../types';

interface Posting {
  docId: string;
  chunkId: number;
  termFrequency: number;
}

interface DocumentIndexEntry {
  docId: string;
  url: string;
  title?: string;
  fetchedAt: string;
  status: number;
  source?: string;
  pageType?: string;
  tokenCount: number;
  uniqueTokenCount: number;
  stopwordCount: number;
  lexicalDensity: number;
  averageTokenLength: number;
  chunkCounts: Record<string, number>;
}

interface ChunkSizeStats {
  totalChunks: number;
  totalTokens: number;
}

interface SerializableChunkIndex {
  chunkSize: number;
  vocabularySize: number;
  totalChunks: number;
  totalTokens: number;
  terms: Record<string, { docFrequency: number; postings: Posting[] }>;
}

class InvertedIndexBuilder {
  private readonly chunkSizes = INDEX_CONFIG.chunkSizes;
  private readonly indexDir = path.join(process.cwd(), 'result', 'index');
  private readonly indexByChunkSize = new Map<number, Map<string, Posting[]>>();
  private readonly chunkStatsBySize = new Map<number, ChunkSizeStats>();
  private readonly documents = new Map<string, DocumentIndexEntry>();
  private readonly processedDocuments = new Set<string>();
  private readonly startTime = performance.now();
  private totalTokens = 0;
  private truncatedDocuments = 0;

  addDocument(record: DocumentRecord): void {
    const { metadata, lexical } = record;
    if (!metadata || !lexical) return;

    const docId = metadata.rawHtmlHash;
    if (this.processedDocuments.has(docId)) return;

    const tokens = this.prepareTokens(lexical);
    if (!tokens.length) return;

    this.processedDocuments.add(docId);
    this.totalTokens += tokens.length;

    const chunkCounts: Record<string, number> = {};
    const documentEntry: DocumentIndexEntry = {
      docId,
      url: metadata.url,
      title: metadata.title,
      fetchedAt: metadata.fetchedAt,
      status: metadata.status,
      source: metadata.source,
      pageType: metadata.pageType,
      tokenCount: tokens.length,
      uniqueTokenCount: lexical.uniqueTokenCount,
      stopwordCount: lexical.stopwordCount,
      lexicalDensity: lexical.lexicalDensity,
      averageTokenLength: lexical.averageTokenLength,
      chunkCounts
    };

    for (const chunkSize of this.chunkSizes) {
      const termIndex = this.indexByChunkSize.get(chunkSize) ?? new Map<string, Posting[]>();
      const chunkStats = this.chunkStatsBySize.get(chunkSize) ?? { totalChunks: 0, totalTokens: 0 };

      const chunkCount = this.buildChunkPostings(docId, tokens, chunkSize, termIndex, chunkStats);
      chunkCounts[String(chunkSize)] = chunkCount;

      this.indexByChunkSize.set(chunkSize, termIndex);
      this.chunkStatsBySize.set(chunkSize, chunkStats);
    }

    this.documents.set(docId, documentEntry);
  }

  finalize(): void {
    this.persistToDisk();
  }

  persistToDisk(): void {
    if (!this.documents.size) return;
    fs.mkdirSync(this.indexDir, { recursive: true });

    const serialized = this.serialize();
    const indexFilePath = path.join(this.indexDir, 'inverted-index.json');
    let serializedPayload: string;
    try {
      serializedPayload = JSON.stringify(serialized, null, 2);
    } catch (error) {
      if (error instanceof RangeError) {
        console.error(
          {
            documents: this.documents.size,
            totalTokens: this.totalTokens
          },
          'Inverted index snapshot skipped: payload too large to serialize'
        );
        return;
      }
      throw error;
    }
    fs.writeFileSync(indexFilePath, serializedPayload);

    const indexFileStats = fs.statSync(indexFilePath);
    const endTime = performance.now();
    const buildTimeMs = Number((endTime - this.startTime).toFixed(3));
    const memorySnapshot = process.memoryUsage();

    const metadata = {
      generatedAt: new Date().toISOString(),
      documentsIndexed: this.documents.size,
      tokensIndexed: this.totalTokens,
      truncatedDocuments: this.truncatedDocuments,
      buildTimeMs,
      indexFileBytes: indexFileStats.size,
      indexFile: path.relative(process.cwd(), indexFilePath),
      chunkSizeStats: serialized.chunkIndexes.map(chunk => ({
        chunkSize: chunk.chunkSize,
        vocabularySize: chunk.vocabularySize,
        totalChunks: chunk.totalChunks,
        totalTokens: chunk.totalTokens
      })),
      memoryUsage: {
        rss: memorySnapshot.rss,
        heapTotal: memorySnapshot.heapTotal,
        heapUsed: memorySnapshot.heapUsed,
        external: memorySnapshot.external
      },
      indexingConfig: {
        chunkSizes: INDEX_CONFIG.chunkSizes,
        primaryChunkSize: INDEX_CONFIG.primaryChunkSize,
        minTokenLength: INDEX_CONFIG.minTokenLength,
        maxTokensPerDocument: INDEX_CONFIG.maxTokensPerDocument
      }
    };

    const metadataFilePath = path.join(this.indexDir, 'index-metadata.json');
    fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));
  }

  private prepareTokens(lexical: LexicalAnalysisDetail): string[] {
    if (!lexical.stemmedTokens?.length) return [];
    const maxTokens = INDEX_CONFIG.maxTokensPerDocument;
    if (maxTokens && lexical.stemmedTokens.length > maxTokens) {
      this.truncatedDocuments++;
      return lexical.stemmedTokens.slice(0, maxTokens);
    }
    return lexical.stemmedTokens.slice();
  }

  private buildChunkPostings(
    docId: string,
    tokens: string[],
    chunkSize: number,
    termIndex: Map<string, Posting[]>,
    stats: ChunkSizeStats
  ): number {
    if (!tokens.length) return 0;
    if (chunkSize <= 0) return 0;

    const chunkCount = Math.max(1, Math.ceil(tokens.length / chunkSize));

    for (let chunkId = 0; chunkId < chunkCount; chunkId++) {
      const start = chunkId * chunkSize;
      const chunkTokens = tokens.slice(start, start + chunkSize);
      if (!chunkTokens.length) continue;

      stats.totalChunks += 1;
      stats.totalTokens += chunkTokens.length;

      const localFrequency = new Map<string, number>();
      for (const token of chunkTokens) {
        localFrequency.set(token, (localFrequency.get(token) ?? 0) + 1);
      }

      for (const [term, frequency] of localFrequency.entries()) {
        const postings = termIndex.get(term);
        const postingEntry: Posting = { docId, chunkId, termFrequency: frequency };
        if (postings) postings.push(postingEntry);
        else termIndex.set(term, [postingEntry]);
      }
    }

    return chunkCount;
  }

  private serialize() {
    const documents = Array.from(this.documents.values());
    const chunkIndexes: SerializableChunkIndex[] = [];

    for (const [chunkSize, termIndex] of this.indexByChunkSize.entries()) {
      const stats = this.chunkStatsBySize.get(chunkSize) ?? { totalChunks: 0, totalTokens: 0 };
      const terms: Record<string, { docFrequency: number; postings: Posting[] }> = {};

      termIndex.forEach((postings, term) => {
        const docFrequency = new Set(postings.map(posting => posting.docId)).size;
        terms[term] = { docFrequency, postings };
      });

      chunkIndexes.push({
        chunkSize,
        vocabularySize: termIndex.size,
        totalChunks: stats.totalChunks,
        totalTokens: stats.totalTokens,
        terms
      });
    }

    chunkIndexes.sort((a, b) => a.chunkSize - b.chunkSize);

    return {
      config: {
        chunkSizes: INDEX_CONFIG.chunkSizes,
        primaryChunkSize: INDEX_CONFIG.primaryChunkSize,
        minTokenLength: INDEX_CONFIG.minTokenLength,
        maxTokensPerDocument: INDEX_CONFIG.maxTokensPerDocument,
        granularity: INDEX_CONFIG.granularity
      },
      documents,
      chunkIndexes
    };
  }
}

let singletonBuilder: InvertedIndexBuilder | null = null;

export function getInvertedIndexBuilder(): InvertedIndexBuilder {
  if (!singletonBuilder) singletonBuilder = new InvertedIndexBuilder();
  return singletonBuilder;
}

export function finalizeInvertedIndex(): void {
  if (!singletonBuilder) return;
  singletonBuilder.finalize();
}

export function snapshotInvertedIndex(): void {
  if (!singletonBuilder) return;
  singletonBuilder.persistToDisk();
}
