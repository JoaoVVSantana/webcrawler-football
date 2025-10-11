export type PageType = 'agenda' | 'onde-assistir' | 'tabela' | 'noticia' | 'outro' | 'team' | 'match';

export interface CrawlTask {
  url: string;
  depth: number;
  source?: string;
  pageType?: PageType;
  priority?: number; 
}

export interface LexicalTopTerm {
  term: string;
  frequency: number;
  weight?: number;
}

export interface LexicalAnalysisSummary {
  tokenCount: number;
  uniqueTokenCount: number;
  stopwordCount: number;
  averageTokenLength: number;
  lexicalDensity: number;
  topTerms: LexicalTopTerm[];
  processingMs: number;
}

export interface LexicalAnalysisDetail extends LexicalAnalysisSummary {
  tokens: string[];
  stemmedTokens: string[];
  frequencyByToken: Record<string, number>;
}

export interface DocumentItem {
  url: string;
  fetchedAt: string;
  status: number;
  title?: string;
  lang?: string;
  rawHtmlHash: string;
  pageType?: PageType;
  source?: string;
  contentLength?: number;
  cleanedContentLength?: number;
  lexicalSummary?: LexicalAnalysisSummary;
}

export interface MatchItem {
  homeTeam?: string;
  awayTeam?: string;
  dateTimeLocal?: string; 
  dateTimeUtc?: string;
  competition?: string;
  whereToWatch?: Array<{ type: 'tv_aberta'|'tv_fechada'|'streaming'|'youtube'; provider: string; url?: string }>;
  sourceUrl: string;
  sourceName?: string;
  confidence?: number; 
}

export interface Adapter {
  domain: string;
  whitelistPatterns: RegExp[];
  classify(url: string): PageType;
  extract(doc: string, url: string): {
    document?: Partial<DocumentItem>;
    matches?: MatchItem[];
    nextLinks?: string[];
  };
}

export interface DocumentRecord {
  metadata: DocumentItem;
  cleanedText?: string;
  lexical?: LexicalAnalysisDetail;
}
