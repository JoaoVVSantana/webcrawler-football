const RAW_PUBLIC_BASE = import.meta.env.BASE_URL ?? '/';
const PUBLIC_BASE =
  RAW_PUBLIC_BASE.endsWith('/') && RAW_PUBLIC_BASE !== '/' ? RAW_PUBLIC_BASE.slice(0, -1) : RAW_PUBLIC_BASE;

export const TEAM_ICON_BASE_PATH = `${PUBLIC_BASE === '/' ? '' : PUBLIC_BASE}/team-logos`;

export const TEAM_ICON_MAP: Record<string, string> = {
  'america-mg': 'america-mg.png',
  'american-mineiro': 'america-mg.png',
  'athletico-pr': 'athletico-pr.png',
  'athletico-paranaense': 'athletico-pr.png',
  'atletico-go': 'atletico-go.png',
  'atletico-mg': 'atletico-mg.png',
  'atletico-mineiro': 'atletico-mg.png',
  'bahia': 'bahia.png',
  'bolivar': 'bolivar.png',
  'botafogo': 'botafogo.png',
  'ceara': 'ceara.png',
  'chapecoense': 'chapecoense.png',
  'corinthians': 'corinthians.png',
  'crb': 'crb.png',
  'criciuma': 'criciuma.png',
  'cruzeiro': 'cruzeiro.png',
  'cuiaba': 'cuiaba.png',
  'estudiantes': 'estudiantes.png',
  'ferroviaria': 'ferroviaria.png',
  'flamengo': 'flamengo.png',
  'fluminense': 'fluminense.png',
  'fortaleza': 'fortaleza.png',
  'foz-do-iguacu': 'foz-do-iguacu.png',
  'goias': 'goias.png',
  'gremio': 'gremio.png',
  'internacional': 'internacional.png',
  'juventude': 'juventude.png',
  'lanus': 'lanus.png',
  'ldu': 'ldu.png',
  'mirassol': 'mirassol.png',
  'palmeiras': 'palmeiras.png',
  'red-bull-bragantino': 'red-bull-bragantino.png',
  'bragantino': 'red-bull-bragantino.png',
  'river-plate': 'river-plate.png',
  'santos': 'santos.png',
  'sao-paulo': 'sao-paulo.png',
  'sport-recife': 'sport-recife.png',
  'vasco': 'vasco-da-gama.png',
  'vasco-da-gama': 'vasco-da-gama.png',
  'vila-nova': 'vila-nova.png',
  'vitoria': 'vitoria.png',
  'volta-redonda': 'volta-redonda.png',
  'copa-do-brasil': 'copabrasil.png',
  'copadobrasil': 'copabrasil.png',
  'brasileirao': 'brasileirao.png'
};

const normalizeTeamName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function getLocalTeamLogo(teamName: string): string | undefined {
  const slug = normalizeTeamName(teamName);
  const fileName = TEAM_ICON_MAP[slug];
  return fileName ? `${TEAM_ICON_BASE_PATH}/${fileName}` : undefined;
}
