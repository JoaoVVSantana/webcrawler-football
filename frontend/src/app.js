import { SearchAPI } from './api.js';
import { SearchComponents } from './components.js';

class BrasileiraoFinderApp {
  constructor() {
    this.isSearching = false;
    this.debounceTimeout = null;
    this.init();
  }

  init() {
    this.setupDOM();
    this.bindEvents();
    this.checkAPIHealth();
  }

  setupDOM() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <div class="theme-toggle" id="themeToggle">
        <span class="theme-icon" id="themeIcon">🌙</span>
        <span id="themeText">Escuro</span>
      </div>
      
      
      <header class="header">
        <div class="hero-content">
          <h1 class="hero-title">🏆 BrasileirãoFinder</h1>
          <p class="hero-subtitle">Encontre tudo sobre o Campeonato Brasileiro</p>
        </div>
      </header>
      <main class="main">
        <div id="searchSection"></div>
        <div id="popularSection"></div>
        <div id="resultsSection"></div>
      </main>
      
      <footer class="footer">
        <p>🏆 BrasileirãoFinder - Sistema de RI | PUC</p>
      </footer>
    `;

    const searchSection = document.getElementById('searchSection');
    const popularSection = document.getElementById('popularSection');
    const resultsSection = document.getElementById('resultsSection');

    searchSection.appendChild(SearchComponents.createSearchForm());
    popularSection.appendChild(SearchComponents.createPopularSearches());
    resultsSection.appendChild(SearchComponents.createResultsContainer());

    this.searchInput = document.getElementById('searchInput');
    this.pageTypeFilter = document.getElementById('pageTypeFilter');
    this.limitFilter = document.getElementById('limitFilter');
    this.resultsContainer = document.getElementById('results');
  }

  bindEvents() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.className = savedTheme;
    this.updateThemeToggle(savedTheme, themeIcon, themeText);
    
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.body.className;
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.className = newTheme;
      localStorage.setItem('theme', newTheme);
      this.updateThemeToggle(newTheme, themeIcon, themeText);
    });

    const form = document.querySelector('.search-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.performSearch();
    });

    this.searchInput.addEventListener('input', () => {
      const query = this.searchInput.value.trim();
      if (query.length >= 2) {
        this.debounceSearch();
      } else if (query.length === 0) {
        this.clearResults();
      }
    });

    this.pageTypeFilter.addEventListener('change', () => {
      if (this.searchInput.value.trim()) {
        this.performSearch();
      }
    });

    this.limitFilter.addEventListener('change', () => {
      if (this.searchInput.value.trim()) {
        this.performSearch();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('popular-tag')) {
        const term = e.target.dataset.term;
        if (term) {
          this.searchInput.value = term;
          this.performSearch();
        }
      }
    });
  }

  debounceSearch() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(() => {
      this.performSearch();
    }, 500);
  }

  async performSearch() {
    const query = this.searchInput.value.trim();
    if (!query || this.isSearching) return;

    this.isSearching = true;
    this.showLoading();

    try {
      const filters = {
        pageType: this.pageTypeFilter.value || undefined,
        limit: parseInt(this.limitFilter.value) || 10
      };

      const response = await SearchAPI.search(query, filters);
      this.displayResults(response);
    } catch (error) {
      this.showError(error.message || 'Erro na busca');
    } finally {
      this.isSearching = false;
    }
  }

  showLoading() {
    this.resultsContainer.innerHTML = '';
    this.resultsContainer.appendChild(SearchComponents.createLoadingSpinner());
  }

  displayResults(response) {
    this.resultsContainer.innerHTML = '';

    if (!response.results || response.results.length === 0) {
      this.resultsContainer.appendChild(SearchComponents.createEmptyState());
      return;
    }

    const header = document.createElement('div');
    header.className = 'results-header';
    header.innerHTML = `
      <h2>📊 Resultados para "${response.query}"</h2>
      <p>${response.total} resultado(s) em ${response.processingTime}ms</p>
    `;
    this.resultsContainer.appendChild(header);

    const resultsList = document.createElement('div');
    resultsList.className = 'results-list';
    
    response.results.forEach((result) => {
      resultsList.appendChild(SearchComponents.createResultCard(result));
    });

    this.resultsContainer.appendChild(resultsList);
  }

  showError(message) {
    this.resultsContainer.innerHTML = '';
    this.resultsContainer.appendChild(SearchComponents.createErrorMessage(message));
  }

  clearResults() {
    this.resultsContainer.innerHTML = '';
  }

  async checkAPIHealth() {
    const isHealthy = await SearchAPI.health();
    if (!isHealthy) {
      this.showError('API não está disponível. Verifique se o servidor está rodando em localhost:3001');
    }
  }
  
  updateThemeToggle(theme, themeIcon, themeText) {
    if (theme === 'dark') {
      themeIcon.textContent = '🌙';
      themeText.textContent = 'Escuro';
    } else {
      themeIcon.textContent = '☀️';
      themeText.textContent = 'Claro';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new BrasileiraoFinderApp();
});