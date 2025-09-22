export interface Team {
  id: string; // ex: "CRU"
  name: string; // "Cruzeiro"
  aliases: string[]; // ["Cuzeiro Esporte Clube","CruzeiroEC","CRU","Cabuloso"]
}

export const TEAMS: Team[] = [
    { id: 'CRU', name: 'Cruzeiro', aliases: ['Cruzeiro', 'Cruzeiro Esporte Clube', 'CRU', 'Cabuloso', 'Raposa', 'Cruzeiro/MG'] },
    { id: 'FLA', name: 'Flamengo', aliases: ['Flamengo', 'CR Flamengo', 'FLA', 'Mengão', 'Mengo', 'Flamengo/RJ'] },
    { id: 'CAM', name: 'Atlético-MG', aliases: ['Atlético-MG', 'Atlético Mineiro', 'CAM', 'Galo', 'Galo Doido', 'Atlético/MG'] },
    { id: 'ATH', name: 'Athletico-PR', aliases: ['Athletico-PR', 'Athletico Paranaense', 'ATH', 'Furacão', 'CAP'] },
    { id: 'BAH', name: 'Bahia', aliases: ['Bahia', 'Esporte Clube Bahia', 'BAH', 'Tricolor de Aço', 'Esquadrão'] },
    { id: 'BOT', name: 'Botafogo', aliases: ['Botafogo', 'Botafogo de Futebol e Regatas', 'BOT', 'Fogão', 'Glorioso'] },
    { id: 'BRG', name: 'Red Bull Bragantino', aliases: ['Red Bull Bragantino', 'Bragantino', 'BRG', 'Massa Bruta', 'Toro Loko'] },
    { id: 'CEA', name: 'Ceará', aliases: ['Ceará', 'Ceará Sporting Club', 'CEA', 'Vozão', 'Alvinegro'] },
    { id: 'COR', name: 'Corinthians', aliases: ['Corinthians', 'Sport Club Corinthians Paulista', 'COR', 'Timão', 'Coringão'] },
    { id: 'CRI', name: 'Criciúma', aliases: ['Criciúma', 'Criciúma Esporte Clube', 'CRI', 'Tigre', 'Tricolor Carvoeiro'] },
    { id: 'FLU', name: 'Fluminense', aliases: ['Fluminense', 'Fluminense Football Club', 'FLU', 'Fluzão', 'Nense', 'Tricolor das Laranjeiras'] },
    { id: 'FOR', name: 'Fortaleza', aliases: ['Fortaleza', 'Fortaleza Esporte Clube', 'FOR', 'Leão do Pici', 'Tricolor de Aço'] },
    { id: 'GRE', name: 'Grêmio', aliases: ['Grêmio', 'Grêmio Foot-Ball Porto Alegrense', 'GRE', 'Imortal Tricolor', 'Tricolor Gaúcho'] },
    { id: 'INT', name: 'Internacional', aliases: ['Internacional', 'Sport Club Internacional', 'INT', 'Colorado', 'Inter'] },
    { id: 'JUV', name: 'Juventude', aliases: ['Juventude', 'Esporte Clube Juventude', 'JUV', 'Juve', 'Papo'] },
    { id: 'PAL', name: 'Palmeiras', aliases: ['Palmeiras', 'Sociedade Esportiva Palmeiras', 'PAL', 'Verdão', 'Porco', 'Alviverde'] },
    { id: 'SAO', name: 'São Paulo', aliases: ['São Paulo', 'São Paulo Futebol Clube', 'SAO', 'Tricolor Paulista', 'Soberano'] },
    { id: 'VAS', name: 'Vasco da Gama', aliases: ['Vasco da Gama', 'Club de Regatas Vasco da Gama', 'VAS', 'Gigante da Colina', 'Cruzmaltino'] },
    { id: 'VIT', name: 'Vitória', aliases: ['Vitória', 'Esporte Clube Vitória', 'VIT', 'Leão da Barra', 'Rubro-Negro'] },
    { id: 'MIR', name: 'Mirassol', aliases: ['Mirassol', 'Mirassol Futebol Clube', 'MIR', 'Leão da Alta Araraquarense', 'Leãozão'] }
];

export function normalizeTeamName(raw: string): string | undefined 
{
  const x = raw.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');

  for (const t of TEAMS) 
  {
    for (const a of [t.name, ...t.aliases]) 
    {
      const y = a.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
      if (x === y) return t.id;
    }
  }
  // fallback
  for (const t of TEAMS) 
  {
    for (const a of [t.name, ...t.aliases]) 
    {
      const y = a.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');

      if (x.includes(y) || y.includes(x)) return t.id;
    }
  }
  return undefined;
}
