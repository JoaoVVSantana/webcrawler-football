export interface Team {
  id: string; // ex: "CRU"
  name: string; // "Cruzeiro"
  aliases: string[]; // ["Cuzeiro Esporte Clube","CruzeiroEC","CRU","Cabuloso"]
}

export const TEAMS: Team[] = [
    { id: 'CRU', name: 'Cruzeiro', aliases: ['Cruzeiro','Cruzeiro Esporte Clube','CRU','Cabuloso','Cruzeiro/MG'] },
    { id: 'FLA', name: 'Flamengo', aliases: ['Flamengo','CR Flamengo','FLA','Mengão','Flamengo/RJ'] },
    { id: 'CAM', name: 'Atlético-MG', aliases: ['Atlético-MG','Atlético Mineiro','CAM','Galo','Atlético/MG'] },
  // adicionar todos os times da serie A -> podemos criar uma interface pra cada campeonato, se for necessario 
];

export function normalizeTeamName(raw: string): string | undefined {
  const x = raw.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  for (const t of TEAMS) {
    for (const a of [t.name, ...t.aliases]) {
      const y = a.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
      if (x === y) return t.id;
    }
  }
  // fallback
  for (const t of TEAMS) {
    for (const a of [t.name, ...t.aliases]) {
      const y = a.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
      if (x.includes(y) || y.includes(x)) return t.id;
    }
  }
  return undefined;
}
