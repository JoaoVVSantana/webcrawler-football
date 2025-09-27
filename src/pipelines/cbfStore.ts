import fs from 'fs';
import path from 'path';

interface PlayerData {
  name: string;
  position: string;
  team: string;
  sourceUrl: string;
}

interface TeamStats {
  teamName: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  sourceUrl: string;
}

const playersFile = path.join(process.cwd(), 'result', 'players.csv');
const statsFile = path.join(process.cwd(), 'result', 'team-stats.csv');

export async function appendPlayersToCsv(players: PlayerData[]) {
  if (!players.length) return;
  
  const dir = path.dirname(playersFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const headers = 'name,position,team,sourceUrl\n';
  const fileExists = fs.existsSync(playersFile);
  
  if (!fileExists) {
    fs.writeFileSync(playersFile, headers);
  }

  const rows = players.map(p => 
    `"${p.name}","${p.position}","${p.team}","${p.sourceUrl}"`
  ).join('\n') + '\n';
  
  fs.appendFileSync(playersFile, rows);
}

export async function appendTeamStatsToCsv(stats: TeamStats[]) {
  if (!stats.length) return;
  
  const dir = path.dirname(statsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const headers = 'teamName,wins,draws,losses,goalsFor,goalsAgainst,sourceUrl\n';
  const fileExists = fs.existsSync(statsFile);
  
  if (!fileExists) {
    fs.writeFileSync(statsFile, headers);
  }

  const rows = stats.map(s => 
    `"${s.teamName}",${s.wins},${s.draws},${s.losses},${s.goalsFor},${s.goalsAgainst},"${s.sourceUrl}"`
  ).join('\n') + '\n';
  
  fs.appendFileSync(statsFile, rows);
}