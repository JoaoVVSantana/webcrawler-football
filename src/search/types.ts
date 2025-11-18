export interface SearchResult {
  docId: string;
  url: string;
  title: string;
  score: number;
  snippet: string;
  fetchedAt: string;
  pageType?: string;
}

export interface QueryTerm {
  term: string;
  stemmed: string;
  weight: number;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  pageTypes?: string[];
}