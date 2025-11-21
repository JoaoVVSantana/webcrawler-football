export interface SearchResult {
  docId: string;
  url: string;
  title: string;
  score: number;
  termsMatched: number;
  fetchedAt?: string;
  status?: number;
  tokenCount?: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  processingTime: number;
  results: SearchResult[];
}
