import { CrawlTask } from '../types.js';

export class Frontier {
  private heap: CrawlTask[] = [];

  push(task: CrawlTask) {
    task.priority ??= 0;
    this.heap.push(task);
    this.heap.sort((a, b) => (b.priority! - a.priority!)); //simples p/ esqueleto
  }

  pop(): CrawlTask | undefined {
    return this.heap.shift();
  }

  size(): number { return this.heap.length; }
}
