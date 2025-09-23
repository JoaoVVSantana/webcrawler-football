import { canonicalizeUrl } from '../utils/url';
import type { CrawlTask } from '../types';

export class CrawlFrontier {
  private queue: CrawlTask[] = [];
  private queuedUrls = new Set<string>();
  private visitedUrls = new Set<string>();

  size(): number { return this.queue.length; }

  push(task: CrawlTask): void 
  {
    const normalizedUrl = canonicalizeUrl(task.url);

    const maximumDepth = Number(process.env.MAX_DEPTH ?? 2);
    
    if ((task.depth ?? 0) > maximumDepth) return;

    // dedup: se já visitou ou já está na fila, ignora
    if (this.visitedUrls.has(normalizedUrl) || this.queuedUrls.has(normalizedUrl)) return;

    // normaliza a task
    const normalizedTask: CrawlTask = { ...task, url: normalizedUrl };
    this.queue.push(normalizedTask);
    this.queuedUrls.add(normalizedUrl);
  }

  pop(): CrawlTask | undefined {
    const nextTask = this.queue.shift();
    if (!nextTask) return undefined;
    const normalizedUrl = canonicalizeUrl(nextTask.url);
    this.queuedUrls.delete(normalizedUrl);
    this.visitedUrls.add(normalizedUrl);
    return nextTask;
  }

  has(url: string): boolean {
    const normalizedUrl = canonicalizeUrl(url);
    return this.queuedUrls.has(normalizedUrl) || this.visitedUrls.has(normalizedUrl);
  }
}
