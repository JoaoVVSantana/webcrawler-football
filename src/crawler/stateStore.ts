import fs from 'fs';
import path from 'path';
import type { CrawlTask } from '../types';

export interface FrontierSnapshot {
  queue: CrawlTask[];
  visited: string[];
  createdAt: string;
}

export function loadFrontierSnapshot(snapshotPath: string): FrontierSnapshot | null {
  try {
    if (!fs.existsSync(snapshotPath)) return null;
    const raw = fs.readFileSync(snapshotPath, 'utf8');
    const parsed = JSON.parse(raw) as FrontierSnapshot;
    if (!Array.isArray(parsed.queue) || !Array.isArray(parsed.visited)) return null;
    return parsed;
  } catch (error) {
    console.error('Falha ao carregar snapshot da frontier:', error);
    return null;
  }
}

export async function saveFrontierSnapshot(snapshotPath: string, snapshot: FrontierSnapshot): Promise<void> {
  try {
    const dir = path.dirname(snapshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (error) {
    console.error('Falha ao salvar snapshot da frontier:', error);
  }
}
