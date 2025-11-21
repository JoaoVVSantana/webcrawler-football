# ⚽ Frontend React + TypeScript

Interface do **BrasileirãoFinder** reescrita em React com TypeScript e Vite, mantendo o visual original e adicionando uma base moderna para evoluções futuras.

## 🚀 Scripts

Dentro da pasta `frontend/`:

```bash
npm install        # Instala dependências
npm run dev        # Ambiente de desenvolvimento (http://localhost:5173)
npm run build      # Gera versão de produção em dist/
npm run preview    # Serve a build para testes locais
```

> Para manter compatibilidade, ainda é possível usar `npm run frontend` a partir da raiz do repositório – agora o script executa `npm --prefix frontend run dev`.

## 🔌 Configuração da API

Por padrão o frontend chama `http://localhost:3001`. Para apontar para outro host defina uma variável em `.env`:

```bash
VITE_API_BASE="https://meu-servidor:3001"
```

## 🧱 Estrutura

```
frontend/
├── public/ball.svg           # Ícone da página
├── src/
│   ├── api/searchApi.ts      # Cliente da API
│   ├── components/           # Componentes React
│   ├── types/search.ts       # Tipos compartilhados
│   ├── App.tsx               # Página principal
│   └── styles.css            # Estilos originais preservados
├── index.html                # Entrada Vite
├── package.json
└── vite.config.ts
```

## 🧩 Componentes principais

- `ThemeToggle` – Alternância claro/escuro com persistência no `localStorage`.
- `SearchForm` – Campo de busca com filtros e debounce integrado.
- `PopularSearches` – Atalhos configurados para pesquisas recorrentes.
- `ResultsSection`/`ResultCard` – Renderização dos resultados, estados de loading, erro e vazio.

Todas as classes CSS originais foram mantidas para preservar o visual, animações e responsividade.

## ✅ Fluxo de desenvolvimento

1. `npm run search-api` na raiz para iniciar o backend.
2. `npm run dev` dentro de `frontend/` (ou `npm run frontend` na raiz) para subir o React.
3. Acesse `http://localhost:5173` e realize as buscas.

---

**🇧🇷 BrasileirãoFinder – Sistema de RI | PUC**
