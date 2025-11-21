import { getLocalTeamLogo } from '../utils/teamLogos';

interface PopularSearch {
  term: string;
  description: string;
  logo?: string;
  icon?: string;
}

const POPULAR_SEARCHES: PopularSearch[] = [
  {
    term: 'Cruzeiro',
    description: 'Proximos jogos e noticias',
    logo: getLocalTeamLogo('Cruzeiro')
  },
  {
    term: 'Palmeiras',
    description: 'Agenda e transmissoes',
    logo: getLocalTeamLogo('Palmeiras')
  },
  {
    term: 'Flamengo',
    description: 'Calendario de jogos',
    logo: getLocalTeamLogo('Flamengo')
  },
  {
    term: 'Brasileir\u00e3o',
    description: 'Tabela e rodadas',
    logo: getLocalTeamLogo('Brasileir\u00e3o')
  },
  {
    term: 'Copa do Brasil',
    description: 'Fase mata-mata nacional',
    logo: getLocalTeamLogo('Copa do Brasil')
  }
];

interface PopularSearchesProps {
  onSelectTerm: (term: string) => void;
}

export function PopularSearches({ onSelectTerm }: PopularSearchesProps) {
  return (
    <section className="popular-searches">
      <h3>Buscas Populares</h3>
      <div className="popular-tags">
        {POPULAR_SEARCHES.map(item => (
          <button
            type="button"
            key={item.term}
            className="popular-tag"
            onClick={() => onSelectTerm(item.term)}
            aria-label={item.description}
            title={item.description}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              {item.logo ? (
                <img
                  src={item.logo}
                  alt={`Escudo do ${item.term}`}
                  width={24}
                  height={24}
                  loading="lazy"
                />
              ) : item.icon ? (
                <span aria-hidden="true" style={{ fontSize: '1.2rem' }}>
                  {item.icon}
                </span>
              ) : null}
              <span>{item.term}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
