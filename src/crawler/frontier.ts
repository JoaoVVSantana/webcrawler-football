import { canonicalizeUrl } from '../utils/url';
import type { CrawlTask } from '../types';

export class Frontier {
  private q: CrawlTask[] = [];
  private enqueued = new Set<string>();
  private visited = new Set<string>();

  size(): number { return this.q.length; }

  push(task: CrawlTask): void 
  {
    const url = canonicalizeUrl(task.url);

    const maxDepth = Number(process.env.MAX_DEPTH ?? 2);
    
    if ((task.depth ?? 0) > maxDepth) return;

    // dedup: se já visitou ou já está na fila, ignora
    if (this.visited.has(url) || this.enqueued.has(url)) return;

    // normaliza a task
    const norm: CrawlTask = { ...task, url };
    this.q.push(norm);
    this.enqueued.add(url);
  }

  pop(): CrawlTask | undefined {
    const t = this.q.shift();
    if (!t) return undefined;
    const url = canonicalizeUrl(t.url);
    this.enqueued.delete(url);
    this.visited.add(url);
    return t;
  }

  has(url: string): boolean {
    const u = canonicalizeUrl(url);
    return this.enqueued.has(u) || this.visited.has(u);
  }
}