export class SearchComponents {
  static createSearchForm() {
    const form = document.createElement('form');
    form.className = 'search-form';
    form.innerHTML = `
      <div class="search-container">
        <div class="search-input-wrapper">
          <input 
            type="text" 
            id="searchInput" 
            placeholder="Buscar times, jogos, onde assistir..."
            autocomplete="off"
          >
          <button type="submit" class="search-btn">
            ⚽ Buscar
          </button>
        </div>
        
        <div class="filters">
          <select id="pageTypeFilter">
            <option value="">🌐 Todos</option>
            <option value="agenda">📅 Agenda</option>
            <option value="onde-assistir">📺 Onde Assistir</option>
            <option value="match">⚽ Partidas</option>
            <option value="noticia">📰 Notícias</option>
          </select>
          
          <select id="limitFilter">
            <option value="10">10 resultados</option>
            <option value="20">20 resultados</option>
            <option value="50">50 resultados</option>
          </select>
        </div>
      </div>
    `;
    return form;
  }

  static createPopularSearches() {
    const popular = [
      { term: 'Flamengo', icon: '🔴', description: 'Próximos jogos e notícias' },
      { term: 'Palmeiras', icon: '🟢', description: 'Agenda e transmissões' },
      { term: 'Corinthians', icon: '⚫', description: 'Calendário de jogos' },
      { term: 'Brasileirão', icon: '🏆', description: 'Tabela e rodadas' },
      { term: 'Libertadores', icon: '🌎', description: 'Copa Libertadores' }
    ];

    const container = document.createElement('div');
    container.className = 'popular-searches';
    container.innerHTML = `
      <h3>🔥 Buscas Populares</h3>
      <div class="popular-tags">
        ${popular.map(item => `
          <button class="popular-tag" data-term="${item.term}">
            ${item.icon} ${item.term}
          </button>
        `).join('')}
      </div>
    `;
    return container;
  }

  static createResultsContainer() {
    const container = document.createElement('div');
    container.id = 'results';
    container.className = 'results-container';
    return container;
  }

  static createLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.className = 'loading';
    spinner.innerHTML = `
      <div class="spinner">⚽</div>
      <p>Buscando...</p>
    `;
    return spinner;
  }

  static createResultCard(result) {
    const card = document.createElement('div');
    card.className = 'result-card';
    
    const pageTypeIcons = {
      'agenda': '📅',
      'onde-assistir': '📺',
      'match': '⚽',
      'noticia': '📰',
      'outro': '📄'
    };

    const icon = pageTypeIcons[result.pageType] || '📄';
    const date = new Date(result.fetchedAt).toLocaleDateString('pt-BR');
    
    card.innerHTML = `
      <div class="result-header">
        <span class="page-type">${icon} ${result.pageType}</span>
        <span class="score">Score: ${result.score}</span>
      </div>
      
      <h3 class="result-title">
        <a href="${result.url}" target="_blank" rel="noopener">
          ${result.title}
        </a>
      </h3>
      
      <p class="result-snippet">${result.snippet}</p>
      
      <div class="result-footer">
        <span class="result-url">${new URL(result.url).hostname}</span>
        <span class="result-date">${date}</span>
      </div>
    `;
    
    return card;
  }

  static createErrorMessage(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.innerHTML = `
      <div class="error-content">
        <span class="error-icon">❌</span>
        <p>${message}</p>
      </div>
    `;
    return error;
  }

  static createEmptyState() {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-content">
        <span class="empty-icon">🔍</span>
        <h3>Nenhum resultado encontrado</h3>
        <p>Tente buscar por times, jogos ou competições</p>
      </div>
    `;
    return empty;
  }
}