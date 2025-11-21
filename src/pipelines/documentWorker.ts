import { parentPort } from 'worker_threads';
import { DocumentRecord } from '../types';
import { persistDocumentMetadata, closeDocumentStream } from './store';
import { finalizeInvertedIndex } from '../indexing/invertedIndex';

if (!parentPort) {
  throw new Error('Document worker requires a parent port');
}

let pendingChain: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): void {
  pendingChain = pendingChain
    .then(task)
    .catch(error => {
      console.error('Document worker task failed:', error);
    })
    .then(() => undefined);
}

function handleFlushRequest(requestId: number): void {
  pendingChain.then(() => {
    parentPort!.postMessage({ type: 'flush_complete', id: requestId });
  });
}

function handleShutdownRequest(requestId: number): void {
  pendingChain
    .then(() => closeDocumentStream())
    .then(() => finalizeInvertedIndex())
    .then(() => {
      parentPort!.postMessage({ type: 'shutdown_complete', id: requestId });
    })
    .catch(error => {
      parentPort!.postMessage({ type: 'shutdown_complete', id: requestId, error: (error as Error)?.message });
    });
}

parentPort.on('message', (message: any) => {
  if (!message || typeof message !== 'object') return;
  const { type } = message;
  switch (type) {
    case 'document': {
      const record = message.record as DocumentRecord;
      if (!record) return;
      enqueue(async () => {
        await persistDocumentMetadata(record);
      });
      break;
    }
    case 'flush': {
      handleFlushRequest(message.id);
      break;
    }
    case 'shutdown': {
      handleShutdownRequest(message.id);
      break;
    }
    default:
      break;
  }
});
