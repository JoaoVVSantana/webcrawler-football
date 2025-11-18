class BrasileiraoFinder {
    constructor() {
        this.API_BASE = 'http://localhost:3001';
        this.currentFilter = 'all';
        this.init();
    }

    init() {
        this.bindEvents();
        this.showWelcomeMessage();
    }

    bindEvents() {
        // Search events
        document.getElementById('searchBtn').addEventListener('click', () => this.performSearch());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });

        // Filter events
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.setFilter(filter);
            });
        });

        // Popular tags events
        document.querySelectorAll('.tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const query = e.target.dataset.query;
                document.getElementById('searchInput').value = query;
                this.performSearch();
            });
        });
    }

    showWelcomeMessage() {
        console.log('⚽ BrasileiraoFinder inicializado!');
        console.log('🔍 Digite sua busca e encontre tudo sobre futebol brasileiro');
    }

    setFilter(filter) {
        console.log('Filtro selecionado:', filter);
        this.currentFilter = filter;
        
        // Update UI
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-filter="${filter}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Re-search if there's a current query
        const query = document.getElementById('searchInput').value.trim();
        if (query) {
            this.performSearch();
        }
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        
        if (!query) {
            this.showError('Digite algo para buscar!');
            return;
        }

        this.showLoading();
        
        try {
            const params = new URLSearchParams({
                q: query,
                limit: 20
            });
            
            if (this.currentFilter !== 'all') {
                params.append('pageTypes', this.currentFilter);
            }

            const response = await fetch(`${this.API_BASE}/search?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.displayResults(data, query);
            
        } catch (error) {
            console.error('Erro na busca:', error);
            this.showError('Erro ao buscar. Verifique se a API está rodando.');
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('noResults').classList.add('hidden');
    }

    displayResults(data, query) {
        document.getElementById('loading').classList.add('hidden');
        
        if (!data.results || data.results.length === 0) {
            this.showNoResults();
            return;
        }

        // Show results section
        document.getElementById('resultsSection').classList.remove('hidden');
        document.getElementById('noResults').classList.add('hidden');
        
        // Update header
        document.getElementById('resultsTitle').textContent = `Resultados para "${query}"`;
        document.getElementById('resultsCount').textContent = 
            `${data.results.length} resultado${data.results.length !== 1 ? 's' : ''} encontrado${data.results.length !== 1 ? 's' : ''}`;
        
        // Generate results HTML
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = data.results.map(result => this.createResultHTML(result)).join('');
        
        // Add click events to results
        document.querySelectorAll('.result-item').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.dataset.url;
                window.open(url, '_blank');
            });
        });
    }

    createResultHTML(result) {
        const pageTypeIcons = {
            'agenda': 'fas fa-calendar',
            'onde-assistir': 'fas fa-tv',
            'match': 'fas fa-futbol',
            'noticia': 'fas fa-newspaper',
            'tabela': 'fas fa-table',
            'team': 'fas fa-users'
        };
        
        const icon = pageTypeIcons[result.pageType] || 'fas fa-file-alt';
        const pageTypeLabel = this.getPageTypeLabel(result.pageType);
        const domain = this.extractDomain(result.url);
        const date = new Date(result.fetchedAt).toLocaleDateString('pt-BR');
        
        return `
            <div class="result-item" data-url="${result.url}">
                <div class="result-header">
                    <div>
                        <h3 class="result-title">
                            <i class="${icon}"></i> ${this.escapeHtml(result.title)}
                        </h3>
                        <div class="result-url">${this.escapeHtml(result.url)}</div>
                    </div>
                    <div class="result-score">Score: ${result.score}</div>
                </div>
                
                <div class="result-snippet">${this.escapeHtml(result.snippet)}</div>
                
                <div class="result-meta">
                    <span class="result-type">
                        <i class="${icon}"></i> ${pageTypeLabel}
                    </span>
                    <span><i class="fas fa-globe"></i> ${domain}</span>
                    <span><i class="fas fa-clock"></i> ${date}</span>
                </div>
            </div>
        `;
    }

    getPageTypeLabel(pageType) {
        const labels = {
            'agenda': 'Agenda',
            'onde-assistir': 'Onde Assistir',
            'match': 'Jogo',
            'noticia': 'Notícia',
            'tabela': 'Tabela',
            'team': 'Time',
            'outro': 'Outros'
        };
        return labels[pageType] || 'Página';
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'N/A';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNoResults() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('noResults').classList.remove('hidden');
    }

    showError(message) {
        document.getElementById('loading').classList.add('hidden');
        alert(`❌ ${message}`);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BrasileiraoFinder();
});

// Add some fun console messages
console.log(`
⚽ ====================================== ⚽
    🇧🇷 BrasileiraoFinder - BUSCADOR DE FUTEBOL 🇧🇷
    
    Desenvolvido com:
    • TF-IDF Search Engine
    • Node.js + Express API  
    • Vanilla JavaScript
    
    Encontre tudo sobre futebol brasileiro!
⚽ ====================================== ⚽
`);