# 🎨 Frontend TypeScript - BrasileiraoFinder

Frontend moderno em TypeScript para o sistema de busca de futebol brasileiro.

## 🚀 Tecnologias

- **TypeScript** - Tipagem estática
- **ES Modules** - Módulos nativos
- **CSS3** - Gradientes e backdrop-filter
- **Express** - Servidor de desenvolvimento
- **Fetch API** - Comunicação com API

## 📁 Estrutura

```
frontend/
├── src/
│   ├── types.ts      # Interfaces TypeScript
│   ├── api.ts        # Cliente da API
│   ├── components.ts # Componentes UI
│   ├── app.ts        # Aplicação principal
│   └── styles.css    # Estilos modernos
├── index.html        # HTML principal
├── server.ts         # Servidor Express
└── tsconfig.json     # Config TypeScript
```

## 🎯 Funcionalidades

### ✨ Interface Moderna
- Design responsivo com gradientes
- Componentes reutilizáveis
- Animações suaves
- Tema futebol (verde/azul Brasil)

### 🔍 Busca Inteligente
- Busca em tempo real (debounce 500ms)
- Filtros por tipo de página
- Tags populares clicáveis
- Resultados com score TF-IDF

### 📱 Responsivo
- Mobile-first design
- Breakpoints otimizados
- Touch-friendly buttons
- Layouts flexíveis

## 🛠️ Como Usar

### 1. Iniciar API (Terminal 1)
```bash
npm run search-api
```

### 2. Iniciar Frontend (Terminal 2)
```bash
npm run frontend
```

### 3. Acessar
```
http://localhost:3000
```

## 🎨 Componentes

### SearchComponents
- `createSearchForm()` - Formulário de busca
- `createPopularSearches()` - Tags populares
- `createResultCard()` - Card de resultado
- `createLoadingSpinner()` - Loading animado
- `createErrorMessage()` - Mensagens de erro

### SearchAPI
- `search()` - Buscar na API
- `health()` - Verificar status da API

### BrasileiraoFinderApp
- Gerenciamento de estado
- Event listeners
- Debounce de busca
- Renderização de resultados

## 🎯 Tipos TypeScript

```typescript
interface SearchResult {
  docId: string;
  url: string;
  title: string;
  score: number;
  snippet: string;
  fetchedAt: string;
  pageType: string;
}

interface SearchFilters {
  pageType?: string;
  limit?: number;
  minScore?: number;
}
```

## 🎨 Design System

### Cores
- **Primária**: `#1e3c72` (Azul Brasil)
- **Secundária**: `#28a745` (Verde Brasil)
- **Accent**: `#ffc107` (Amarelo)
- **Background**: Gradiente azul

### Tipografia
- **Font**: Segoe UI, Tahoma, Geneva
- **Títulos**: 700 weight
- **Corpo**: 400 weight
- **Tamanhos**: 0.8rem - 2.5rem

### Componentes
- **Cards**: backdrop-filter blur
- **Buttons**: gradientes + hover effects
- **Inputs**: border-radius 50px
- **Shadows**: múltiplas camadas

## 🔧 Desenvolvimento

### Compilação TypeScript
O servidor Express compila TS em tempo real durante desenvolvimento.

### Hot Reload
Reinicie o servidor para mudanças no TypeScript.

### Produção
Para produção, use um bundler como Vite ou Webpack.

## 📊 Performance

- **Debounce**: 500ms para busca
- **Lazy Loading**: Componentes sob demanda
- **CSS Optimizado**: Seletores eficientes
- **Fetch Caching**: Headers apropriados

---

**⚽ Frontend TypeScript completo para o BrasileiraoFinder!**