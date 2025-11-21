import type { SearchResult } from '../types/search';
import { EmptyState } from './EmptyState';
import { ErrorMessage } from './ErrorMessage';
import { LoadingState } from './LoadingState';
import { ResultCard } from './ResultCard';

interface ResultsSectionProps {
  isLoading: boolean;
  error: string | null;
  results: SearchResult[];
  hasSearched: boolean;
  querySummary?: {
    query: string;
    total: number;
    processingTime: number;
  };
}

export function ResultsSection({
  isLoading,
  error,
  results,
  hasSearched,
  querySummary
}: ResultsSectionProps) {
  return (
    <section className="results-container" id="results">
      {isLoading && <LoadingState />}
      {!isLoading && error && <ErrorMessage message={error} />}
      {!isLoading && !error && hasSearched && results.length === 0 && <EmptyState />}
      {!isLoading && !error && results.length > 0 && querySummary && (
        <>
          <div className="results-header">
            <h2>🔎 Resultados para "{querySummary.query}"</h2>
            <p>
              {querySummary.total} resultado(s) em {querySummary.processingTime}ms
            </p>
          </div>
          <div className="results-list">
            {results.map((result) => (
              <ResultCard key={result.docId} result={result} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
