import type { FormEvent } from 'react';

interface SearchFormProps {
  query: string;
  isSearching: boolean;
  resultsLimit: number;
  onQueryChange: (value: string) => void;
  onResultsLimitChange: (value: number) => void;
  onSubmit: () => void;
}

const LIMIT_OPTIONS = [5, 10, 20, 50];

export function SearchForm({
  query,
  isSearching,
  resultsLimit,
  onQueryChange,
  onResultsLimitChange,
  onSubmit
}: SearchFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            id="searchInput"
            placeholder="Buscar times, jogos, onde assistir..."
            autoComplete="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <button type="submit" className="search-btn" disabled={isSearching}>
            ⚽ Buscar
          </button>
          <div className="results-limit-select">
            <label htmlFor="resultsLimit" className="sr-only">
              Quantidade de resultados
            </label>
            <select
              id="resultsLimit"
              value={resultsLimit}
              onChange={(event) => onResultsLimitChange(Number(event.target.value))}
            >
              {LIMIT_OPTIONS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </form>
  );
}
