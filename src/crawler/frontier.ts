import { canonicalizeUrl } from '../utils/url';
import { isBlockedUrl } from '../utils/urlFilters';
import type { CrawlTask } from '../types';

function resolvePriority(task: CrawlTask): number {
  return task.priority ?? 0;
}

export class CrawlFrontier {
  private readonly maxDepth = Number(process.env.MAX_DEPTH ?? 3);
  private queue: CrawlTask[] = [];
  private queuedUrls = new Set<string>();
  private visitedUrls = new Set<string>();

  size(): number {
    return this.queue.length;
  }

  visitedCount(): number {
    return this.visitedUrls.size;
  }

  push(task: CrawlTask): void {
    const normalizedUrl = canonicalizeUrl(task.url);

    if ((task.depth ?? 0) > this.maxDepth) return;
    if (isBlockedUrl(normalizedUrl)) return;
    if (this.visitedUrls.has(normalizedUrl) || this.queuedUrls.has(normalizedUrl)) return;

    const normalizedTask: CrawlTask = { ...task, url: normalizedUrl };
    this.enqueue(normalizedTask);
    this.queuedUrls.add(normalizedUrl);
  }

  pop(): CrawlTask | undefined {
    const nextTask = this.queue.shift();
    if (!nextTask) return undefined;
    this.queuedUrls.delete(nextTask.url);
    this.visitedUrls.add(nextTask.url);
    return nextTask;
  }

  has(url: string): boolean {
    const normalizedUrl = canonicalizeUrl(url);
    return this.queuedUrls.has(normalizedUrl) || this.visitedUrls.has(normalizedUrl);
  }

  private enqueue(task: CrawlTask): void {
    if (this.queue.length === 0) {
      this.queue.push(task);
      return;
    }

    const priority = resolvePriority(task);
    let low = 0;
    let high = this.queue.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const midPriority = resolvePriority(this.queue[mid]);
      if (midPriority < priority) high = mid;
      else low = mid + 1;
    }

    this.queue.splice(low, 0, task);
  }
}
