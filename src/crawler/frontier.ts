import { canonicalizeUrl } from '../utils/url';
import { isBlockedUrl } from '../utils/urlFilters';
import type { CrawlTask } from '../types';

function resolvePriority(task: CrawlTask): number {
  return task.priority ?? 0;
}

export interface FrontierSerializedState {
  queue: CrawlTask[];
  visited: string[];
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
    this.tryEnqueue(task);
  }

  pushIfAbsent(task: CrawlTask): boolean {
    return this.tryEnqueue(task);
  }

  private tryEnqueue(task: CrawlTask): boolean {
    const normalizedUrl = canonicalizeUrl(task.url);

    if ((task.depth ?? 0) > this.maxDepth) return false;
    if (isBlockedUrl(normalizedUrl)) return false;
    if (this.visitedUrls.has(normalizedUrl) || this.queuedUrls.has(normalizedUrl)) return false;

    const normalizedTask: CrawlTask = { ...task, url: normalizedUrl };
    this.enqueue(normalizedTask);
    this.queuedUrls.add(normalizedUrl);
    return true;
  }

  pop(): CrawlTask | undefined {
    if (this.queue.length === 0) return undefined;

    const nextTask = this.queue[0];
    const lastTask = this.queue.pop();
    if (this.queue.length > 0 && lastTask) {
      this.queue[0] = lastTask;
      this.heapifyDown(0);
    }

    if (nextTask) {
      this.queuedUrls.delete(nextTask.url);
      this.visitedUrls.add(nextTask.url);
    }

    return nextTask;
  }

  has(url: string): boolean {
    const normalizedUrl = canonicalizeUrl(url);
    return this.queuedUrls.has(normalizedUrl) || this.visitedUrls.has(normalizedUrl);
  }

  serialize(): FrontierSerializedState {
    return {
      queue: this.queue.map(task => ({ ...task })),
      visited: Array.from(this.visitedUrls)
    };
  }

  restore(state: FrontierSerializedState): void {
    const restoredQueue: CrawlTask[] = [];
    const restoredQueued = new Set<string>();

    for (const task of state.queue ?? []) {
      if (!task?.url) continue;
      const normalizedUrl = canonicalizeUrl(task.url);
      if (isBlockedUrl(normalizedUrl)) continue;
      restoredQueue.push({ ...task, url: normalizedUrl });
      restoredQueued.add(normalizedUrl);
    }

    this.queue = restoredQueue;
    this.heapifyAll();
    this.queuedUrls = restoredQueued;
    this.visitedUrls = new Set(
      (state.visited ?? []).map(url => canonicalizeUrl(url)).filter(url => !isBlockedUrl(url))
    );
  }

  clear(): void {
    this.queue = [];
    this.queuedUrls.clear();
    this.visitedUrls.clear();
  }

  private enqueue(task: CrawlTask): void {
    this.queue.push(task);
    this.heapifyUp(this.queue.length - 1);
  }

  private heapifyUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(parentIndex, index) >= 0) break;
      this.swap(parentIndex, index);
      index = parentIndex;
    }
  }

  private heapifyDown(index: number): void {
    const length = this.queue.length;
    while (true) {
      const left = 2 * index + 1;
      const right = left + 1;
      let largest = index;

      if (left < length && this.compare(left, largest) > 0) largest = left;
      if (right < length && this.compare(right, largest) > 0) largest = right;

      if (largest === index) break;
      this.swap(index, largest);
      index = largest;
    }
  }

  private heapifyAll(): void {
    for (let i = Math.floor(this.queue.length / 2) - 1; i >= 0; i--) {
      this.heapifyDown(i);
    }
  }

  private compare(firstIndex: number, secondIndex: number): number {
    return resolvePriority(this.queue[firstIndex]) - resolvePriority(this.queue[secondIndex]);
  }

  private swap(i: number, j: number): void {
    [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
  }
}
