import {
  BM25_B,
  BM25_K1,
  DOMAIN_BOOSTS,
  FOOTBALL_KEYWORDS,
  TITLE_COVERAGE_WEIGHT,
  URL_COVERAGE_WEIGHT
} from './constants';

export function computeBm25(
  tf: number,
  docLength: number,
  averageDocumentLength: number,
  idf: number
): number {
  if (tf <= 0 || idf <= 0) {
    return 0;
  }

  const avgLength = averageDocumentLength > 0 ? averageDocumentLength : 1;
  const safeDocLength = docLength > 0 ? docLength : avgLength;
  const normalization = (1 - BM25_B) + BM25_B * (safeDocLength / avgLength);
  const denominator = tf + BM25_K1 * normalization;
  if (denominator <= 0) {
    return 0;
  }

  const numerator = tf * (BM25_K1 + 1);
  return idf * (numerator / denominator);
}

export function computeCoverage(queryTokens: string[], fieldTokens: string[]): number {
  if (!queryTokens.length || !fieldTokens.length) {
    return 0;
  }

  const fieldSet = new Set(fieldTokens);
  let matched = 0;
  for (const token of queryTokens) {
    if (fieldSet.has(token)) {
      matched += 1;
    }
  }
  return matched / queryTokens.length;
}

export function hasFootballKeywordMatch(tokens: string[], normalizedTitle: string): boolean {
  for (const token of tokens) {
    if (FOOTBALL_KEYWORDS.has(token) && normalizedTitle.includes(token)) {
      return true;
    }
  }
  return false;
}

export function applyCoverageBoost(titleCoverage: number, urlCoverage: number): number {
  return 1 + TITLE_COVERAGE_WEIGHT * titleCoverage + URL_COVERAGE_WEIGHT * urlCoverage;
}

export function applyDomainBoost(score: number, domain: string): number {
  const domainBoost = DOMAIN_BOOSTS.get(domain) ?? 1;
  return score * domainBoost;
}
