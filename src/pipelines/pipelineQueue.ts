import { DocumentRecord } from '../types';
import { persistDocumentMetadata } from './store';

const DEFAULT_BATCH_SIZE = Math.max(1, Number(process.env.PIPELINE_BATCH_SIZE ?? 25));

class PipelineQueue {
  private readonly batchSize = DEFAULT_BATCH_SIZE;
  private readonly queue: DocumentRecord[] = [];
  private processingPromise: Promise<void> | null = null;

  enqueue(record: DocumentRecord): void {
    this.queue.push(record);
    this.scheduleProcessing();
  }

  async flush(): Promise<void> {
    if (!this.processingPromise && this.queue.length) {
      this.scheduleProcessing();
    }
    if (this.processingPromise) await this.processingPromise;
  }

  private scheduleProcessing(): void {
    if (this.processingPromise) return;
    this.processingPromise = this.processQueue();
  }

  private async processQueue(): Promise<void> {
    try {
      while (this.queue.length) {
        const batch = this.queue.splice(0, this.batchSize);
        for (const record of batch) {
          await persistDocumentMetadata(record);
        }
      }
    } finally {
      this.processingPromise = null;
      if (this.queue.length) this.scheduleProcessing();
    }
  }
}

const pipelineQueue = new PipelineQueue();

export function scheduleDocumentPersist(record: DocumentRecord): void {
  pipelineQueue.enqueue(record);
}

export async function flushPipelineQueues(): Promise<void> {
  await pipelineQueue.flush();
}
