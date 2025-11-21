import type { SearchResult } from '../types/search';

interface ResultCardProps {
  result: SearchResult;
}

export function ResultCard({ result }: ResultCardProps) {
  const hostname = safeHostname(result.url);

  return (
    <article className="result-card">
      <div className="result-header">
        <span className="score">Score: {formatScore(result.score)}</span>
      </div>

      <h3 className="result-title">
        <a href={result.url} target="_blank" rel="noopener noreferrer">
          {result.title}
        </a>
      </h3>

      <p className="result-snippet">{result.url}</p>

      <div className="result-footer">
        <span className="result-url">{hostname}</span>
      </div>
    </article>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatScore(score: number) {
  return score.toFixed(4);
}
