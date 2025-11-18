import { DocumentRecord, MatchItem } from '../types';
import { persistDocumentMetadata, persistMatches } from './store';
import { appendMatchesToCsv } from './csvStore';

type PipelineJob =
  | { type: 'document'; record: DocumentRecord }
  | { type: 'matches'; matches: MatchItem[] };

const DEFAULT_BATCH_SIZE = Math.max(1, Number(process.env.PIPELINE_BATCH_SIZE ?? 25));

class PipelineQueue {
  private readonly batchSize = DEFAULT_BATCH_SIZE;
  private readonly queue: PipelineJob[] = [];
  private processingPromise: Promise<void> | null = null;

  enqueue(job: PipelineJob): void {
    this.queue.push(job);
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
        for (const job of batch) {
          if (job.type === 'document') await persistDocumentMetadata(job.record);
          else if (job.type === 'matches') await appendMatchesToCsv(job.matches);
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
  pipelineQueue.enqueue({ type: 'document', record });
}

export function scheduleMatchesPersist(matches: MatchItem[]): void {
  if (!matches.length) return;
  pipelineQueue.enqueue({ type: 'matches', matches });
  persistMatches(matches);
}

export async function flushPipelineQueues(): Promise<void> {
  await pipelineQueue.flush();
}
