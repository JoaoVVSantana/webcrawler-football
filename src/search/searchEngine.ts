import fs from 'node:fs';
import type { SearchOptions, SearchResult } from './types';
import {
  DEFAULT_DOCUMENTS_CANDIDATES,
  DEFAULT_INDEX_CANDIDATES,
  FOOTBALL_KEYWORDS,
  TEAM_MATCH_BOOST,
  TEAM_MISS_PENALTY
} from './constants';
import {
  applyCoverageBoost,
  applyDomainBoost,
  computeBm25,
  computeCoverage,
  hasFootballKeywordMatch
} from './scoring';
import {
  expandQueryTokens,
  normalizeText,
  tokenizeText,
  type TokenizationOutput
} from './textProcessing';

interface SearchEngineOptions {
  indexFilePath?: string;
  documentsFilePath?: string;
}

interface IndexConfig {
  chunkSizes?: number[];
  primaryChunkSize?: number;
  minTokenLength?: number;
  maxTokensPerDocument?: number;
}

interface IndexDocumentEntry {
  docId: string;
  url: string;
  title?: string;
  fetchedAt?: string;
  status?: number;
  tokenCount?: number;
}

interface PostingEntry {
  docId: string;
  chunkId: number;
  termFrequency: number;
}

interface TermEntry {
  docFrequency: number;
  postings: PostingEntry[];
}

interface ChunkIndex {
  chunkSize: number;
  terms: Record<string, TermEntry>;
}

interface InvertedIndexData {
  config?: IndexConfig;
  documents?: IndexDocumentEntry[];
  chunkIndexes?: ChunkIndex[];
}

interface DocumentLexicalStats {
  tokenCount?: number;
  uniqueTokenCount?: number;
  stopwordCount?: number;
  averageTokenLength?: number;
  lexicalDensity?: number;
  topTerms?: Array<{ term: string; frequency?: number; weight?: number }>;
}

interface DocumentsJsonlEntry {
  hash: string;
  url: string;
  title?: string;
  fetchedAt?: string;
  status?: number;
  lang?: string;
  contentLength?: number;
  cleanedContentLength?: number;
  lexical?: DocumentLexicalStats;
}

interface DocumentRecord {
  docId: string;
  url: string;
  title: string;
  fetchedAt?: string;
  status?: number;
  tokenCount?: number;
  normalizedTitle: string;
  normalizedUrl: string;
  domain: string;
  normalizedDomain: string;
  titleTokens: string[];
  urlTokens: string[];
  lexical?: DocumentLexicalStats;
}

type TermDictionary = Record<string, TermEntry>;

export class SearchEngine {
  private readonly indexFilePath: string;
  private readonly documentsFilePath?: string;
  private config: IndexConfig = {};
  private documentCount = 0;
  private averageDocumentLength = 1;
  private minTokenLength = 3;
  private termIndex: TermDictionary = {};
  private readonly documentMap = new Map<string, DocumentRecord>();
  private readonly documentsJsonl = new Map<string, DocumentsJsonlEntry>();

  constructor(options?: SearchEngineOptions) {
    this.indexFilePath = this.resolveIndexPath(options?.indexFilePath);
    this.documentsFilePath = this.resolveDocumentsPath(options?.documentsFilePath);
    this.loadIndexData();
    this.loadDocumentsJsonl();
  }

  public search(query: string, options: SearchOptions = {}): SearchResult[] {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return [];
    }

    const tokenization = this.tokenizeValue(query);
    if (!tokenization.stems.length) {
      return [];
    }
    const expandedTokens = expandQueryTokens(
      tokenization.tokens,
      tokenization.stems,
      this.minTokenLength
    );
    const tokens = expandedTokens.tokens;
    const stems = expandedTokens.stems;

    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const minScore = options.minScore ?? 0;

    const docScores = new Map<string, number>();
    const docTermMatches = new Map<string, Set<string>>();
    const uniqueTerms = Array.from(new Set(stems));

    for (const term of uniqueTerms) {
      const entry = this.termIndex[term];
      if (!entry) continue;

      const numerator = this.documentCount - entry.docFrequency + 0.5;
      const denominator = entry.docFrequency + 0.5;
      const idf = Math.log(1 + (numerator > 0 && denominator > 0 ? numerator / denominator : 0));
      if (!Number.isFinite(idf) || idf <= 0) continue;

      const tfPerDoc = this.aggregateTermFrequency(entry.postings);
      for (const [docId, tf] of tfPerDoc.entries()) {
        const doc = this.documentMap.get(docId);
        if (!doc) continue;

        const docLength = doc.tokenCount ?? doc.lexical?.tokenCount ?? this.averageDocumentLength;
        const contribution = computeBm25(tf, docLength, this.averageDocumentLength, idf);
        if (contribution <= 0) continue;

        docScores.set(docId, (docScores.get(docId) ?? 0) + contribution);

        if (!docTermMatches.has(docId)) {
          docTermMatches.set(docId, new Set());
        }
        docTermMatches.get(docId)!.add(term);
      }
    }

    const results: SearchResult[] = [];
    for (const [docId, baseScore] of docScores.entries()) {
      const doc = this.documentMap.get(docId);
      if (!doc) continue;

      const termsMatched = docTermMatches.get(docId)?.size ?? 0;
      if (!termsMatched) continue;

      let score = this.applyBoosts(baseScore, doc, normalizedQuery, tokens, tokenization.tokens);
      if (score < minScore) continue;

      const jsonlDoc = this.documentsJsonl.get(docId);
      const fetchedAt = jsonlDoc?.fetchedAt ?? doc.fetchedAt;
      const status = jsonlDoc?.status ?? doc.status;
      const title = jsonlDoc?.title ?? doc.title;

      results.push({
        docId,
        url: doc.url,
        title,
        fetchedAt,
        status,
        score: Number(score.toFixed(6)),
        termsMatched,
        tokenCount: doc.tokenCount ?? jsonlDoc?.lexical?.tokenCount
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private loadIndexData(): void {
    if (!fs.existsSync(this.indexFilePath)) {
      throw new Error(`Index file not found at ${this.indexFilePath}`);
    }

    try {
      const raw = fs.readFileSync(this.indexFilePath, 'utf8');
      const parsed = JSON.parse(raw) as InvertedIndexData;

      this.config = parsed.config ?? {};
      this.documentCount = parsed.documents?.length ?? 0;
      this.minTokenLength = Math.max(2, this.config.minTokenLength ?? 3);

      this.documentMap.clear();
      for (const entry of parsed.documents ?? []) {
        if (!entry?.docId || !entry.url) continue;
        this.documentMap.set(entry.docId, this.toDocumentRecord(entry));
      }
      this.updateAverageDocumentLength();

      const chunkCandidates = parsed.chunkIndexes ?? [];
      const preferredChunkSize = this.config.primaryChunkSize ?? this.config.chunkSizes?.[0];
      const chunkIndex =
        chunkCandidates.find(chunk => chunk.chunkSize === preferredChunkSize) ?? chunkCandidates[0];

      if (!chunkIndex) {
        throw new Error('No chunk index found in the inverted index file.');
      }

      this.termIndex = chunkIndex.terms ?? {};
      console.log(
        `[search] Loaded ${this.documentCount} documents and ${
          Object.keys(this.termIndex).length
        } terms from ${this.indexFilePath}`
      );
    } catch (error) {
      console.error('[search] Failed to load inverted index:', error);
      this.termIndex = {};
      this.documentMap.clear();
      this.documentCount = 0;
      this.averageDocumentLength = 1;
    }
  }

  private loadDocumentsJsonl(): void {
    if (!this.documentsFilePath || !fs.existsSync(this.documentsFilePath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(this.documentsFilePath, 'utf8');
      const lines = raw.split(/\r?\n/);
      let loaded = 0;

      for (const line of lines) {
        if (!line || !line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as DocumentsJsonlEntry;
          if (!parsed.hash) continue;
          this.documentsJsonl.set(parsed.hash, parsed);

          const doc = this.documentMap.get(parsed.hash);
          if (doc) {
            if (parsed.title && parsed.title.trim()) {
              doc.title = parsed.title;
              doc.normalizedTitle = normalizeText(parsed.title);
              doc.titleTokens = this.tokenizeValue(parsed.title).tokens;
            }
            doc.fetchedAt = doc.fetchedAt ?? parsed.fetchedAt;
            doc.status = doc.status ?? parsed.status;
            doc.lexical = parsed.lexical ?? doc.lexical;
            if (!doc.tokenCount && parsed.lexical?.tokenCount) {
              doc.tokenCount = parsed.lexical.tokenCount;
            }
          }
          loaded++;
        } catch (lineError) {
          console.warn('[search] Skipping invalid JSONL line:', lineError);
        }
      }

      console.log(`[search] Loaded ${loaded} entries from ${this.documentsFilePath}`);
      this.updateAverageDocumentLength();
    } catch (error) {
      console.error('[search] Failed to load documents.jsonl:', error);
    }
  }

  private aggregateTermFrequency(postings: PostingEntry[]): Map<string, number> {
    const frequencies = new Map<string, number>();
    for (const posting of postings) {
      frequencies.set(posting.docId, (frequencies.get(posting.docId) ?? 0) + posting.termFrequency);
    }
    return frequencies;
  }

  private applyBoosts(
    baseScore: number,
    doc: DocumentRecord,
    normalizedQuery: string,
    tokens: string[],
    originalTokens: string[]
  ): number {
    if (baseScore <= 0) return 0;

    let score = baseScore;

    const titleCoverage = computeCoverage(tokens, doc.titleTokens);
    const urlCoverage = computeCoverage(tokens, doc.urlTokens);
    const coverageBoost = applyCoverageBoost(titleCoverage, urlCoverage);
    score *= coverageBoost;

    if (normalizedQuery && doc.normalizedTitle.includes(normalizedQuery)) {
      score *= 1.5;
    }

    score = applyDomainBoost(score, doc.domain);

    if (hasFootballKeywordMatch(tokens, doc.normalizedTitle)) {
      score *= 1.1;
    }

    const teamFactor = this.computeTeamMatchFactor(originalTokens, doc);
    score *= teamFactor;

    if (tokens.some(token => doc.normalizedDomain.includes(token))) {
      score += 0.2;
    }

    return score;
  }

  private computeTeamMatchFactor(originalTokens: string[], doc: DocumentRecord): number {
    const teamTokens = originalTokens.filter(token => FOOTBALL_KEYWORDS.has(token));
    if (!teamTokens.length) {
      return 1;
    }

    const titleCoverage = computeCoverage(teamTokens, doc.titleTokens);
    const urlCoverage = computeCoverage(teamTokens, doc.urlTokens);
    const domainMatch = teamTokens.some(token => doc.normalizedDomain.includes(token));

    if (!titleCoverage && !urlCoverage && !domainMatch) {
      return TEAM_MISS_PENALTY;
    }

    const bestCoverage = Math.max(titleCoverage, urlCoverage);
    const coverageScore = Math.min(1, bestCoverage + (domainMatch ? 0.5 : 0));
    return 1 + TEAM_MATCH_BOOST * coverageScore;
  }

  private tokenizeValue(text: string): TokenizationOutput {
    return tokenizeText(text, this.minTokenLength);
  }

  private toDocumentRecord(entry: IndexDocumentEntry): DocumentRecord {
    const title = entry.title && entry.title.trim() ? entry.title : 'Sem titulo';
    const normalizedTitle = normalizeText(title);
    const normalizedUrl = normalizeText(entry.url);
    const domain = extractDomain(entry.url);
    const titleTokens = this.tokenizeValue(title).tokens;
    const urlTokens = this.tokenizeValue(entry.url).tokens;
    return {
      docId: entry.docId,
      url: entry.url,
      title,
      fetchedAt: entry.fetchedAt,
      status: entry.status,
      tokenCount: entry.tokenCount,
      normalizedTitle,
      normalizedUrl,
      domain,
      normalizedDomain: normalizeText(domain),
      titleTokens,
      urlTokens
    };
  }

  private resolveIndexPath(explicitPath?: string): string {
    if (explicitPath && fs.existsSync(explicitPath)) {
      return explicitPath;
    }

    for (const candidate of DEFAULT_INDEX_CANDIDATES) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error('Unable to find inverted index file. Set SEARCH_INDEX_FILE to the desired path.');
  }

  private resolveDocumentsPath(explicitPath?: string): string | undefined {
    if (explicitPath && fs.existsSync(explicitPath)) {
      return explicitPath;
    }

    for (const candidate of DEFAULT_DOCUMENTS_CANDIDATES) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  private updateAverageDocumentLength(): void {
    let total = 0;
    let count = 0;

    for (const doc of this.documentMap.values()) {
      const length = doc.tokenCount ?? doc.lexical?.tokenCount;
      if (typeof length === 'number' && Number.isFinite(length) && length > 0) {
        total += length;
        count++;
      }
    }

    this.averageDocumentLength = count > 0 ? total / count : 1;
  }
}

function extractDomain(rawUrl: string): string {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return rawUrl;
  }
}
