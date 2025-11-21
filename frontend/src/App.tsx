import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchAPI } from './api/searchApi';
import { PopularSearches } from './components/PopularSearches';
import { ResultsSection } from './components/ResultsSection';
import { SearchForm } from './components/SearchForm';
import { TeamMatchesExplorer } from './components/TeamMatchesExplorer';
import { ThemeToggle } from './components/ThemeToggle';
import type { SearchResult } from './types/search';
import './styles.css';

type ThemeMode = 'light' | 'dark';

const DEFAULT_THEME: ThemeMode =
  (typeof window !== 'undefined' && (localStorage.getItem('theme') as ThemeMode)) || 'dark';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultsLimit, setResultsLimit] = useState(10);
  const [summary, setSummary] = useState<{
    query: string;
    total: number;
    processingTime: number;
  }>();
  const [activePage, setActivePage] = useState<'search' | 'matches'>('search');

  useEffect(() => {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    localStorage.setItem('theme', theme);

    return () => {
      document.body.classList.remove('light', 'dark');
    };
  }, [theme]);

  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await SearchAPI.search(term.trim(), { limit: resultsLimit });

      setResults(response.results ?? []);
      setSummary({
        query: response.query ?? term.trim(),
        total: response.total ?? response.results?.length ?? 0,
        processingTime: response.processingTime ?? 0
      });
    } catch (err) {
      setResults([]);
      setSummary(undefined);
      setError(err instanceof Error ? err.message : 'Erro na busca');
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  }, [resultsLimit]);

  useEffect(() => {
    if (activePage !== 'search') {
      return;
    }

    const trimmed = query.trim();

    if (trimmed.length === 0) {
      setError(null);
      setResults([]);
      setSummary(undefined);
      setHasSearched(false);
      return;
    }

    if (trimmed.length < 2) {
      return;
    }

    const timeout = setTimeout(() => performSearch(trimmed), 500);
    return () => clearTimeout(timeout);
  }, [performSearch, query, activePage]);

  useEffect(() => {
    SearchAPI.health().then((healthy) => {
      if (!healthy) {
        setError('API não está disponível. Verifique se o servidor está rodando em localhost:3001');
      }
    });
  }, []);

  const handleManualSearch = () => {
    if (!query.trim()) {
      setError('Digite algo para buscar');
      return;
    }

    performSearch(query);
  };

  const handleSelectPopular = (term: string) => {
    setQuery(term);
    performSearch(term);
  };

  const heroStats = useMemo(
    () => [
      { label: 'Domínios monitorados', value: '1300+' },
      { label: 'Resultados indexados', value: '65999' },
      { label: 'Cobertura em tempo real', value: '⚡26 Pages Per Sec' }
    ],
    []
  );

  const pageTabs: Array<{ id: 'search' | 'matches'; label: string }> = useMemo(
    () => [
      { id: 'search', label: 'Busca inteligente' },
      { id: 'matches', label: 'Agenda por time' }
    ],
    []
  );

  return (
    <div id="app">
      <ThemeToggle theme={theme} onToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />

      <header className="header">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="hero-ball" aria-hidden="true">
              ⚽
            </span>
            BrasileirãoFinder
          </h1>
          <p className="hero-subtitle">Encontre tudo sobre o Campeonato Brasileiro</p>
          <div className="hero-stats">
            {heroStats.map((stat) => (
              <div key={stat.label} className="stat-item">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="page-switcher">
          {pageTabs.map(tab => (
            <button
              key={tab.id}
              className={`page-switcher__button ${activePage === tab.id ? 'is-active' : ''}`}
              onClick={() => setActivePage(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activePage === 'search' ? (
          <>
            <SearchForm
              query={query}
              isSearching={isSearching}
              resultsLimit={resultsLimit}
              onQueryChange={setQuery}
              onResultsLimitChange={setResultsLimit}
              onSubmit={handleManualSearch}
            />

            <PopularSearches onSelectTerm={handleSelectPopular} />

            <ResultsSection
              isLoading={isSearching}
              error={error}
              hasSearched={hasSearched}
              results={results}
              querySummary={summary}
            />
          </>
        ) : (
          <TeamMatchesExplorer />
        )}
      </main>

      <footer className="footer">
        <p>🇧🇷 BrasileirãoFinder - Sistema de RI | PUC</p>
      </footer>
    </div>
  );
}
