import { Worker } from 'worker_threads';
import { DocumentRecord } from '../types';

type PendingRequest = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

const baseExecArgv = process.execArgv;
const isTypeScriptRuntime = import.meta.url.endsWith('.ts');
const worker = isTypeScriptRuntime ? createTypeScriptWorker() : createJavaScriptWorker();

const pendingRequests = new Map<number, PendingRequest>();
let messageCounter = 0;

function createTypeScriptWorker(): Worker {
  const moduleUrl = new URL('./documentWorker.ts', import.meta.url).href;
  const bootstrap = `
    import { workerData } from 'worker_threads';
    import { register } from 'tsx/esm/api';
    register();
    try {
      await import(workerData.moduleUrl);
    } catch (error) {
      console.error('[document-worker-bootstrap]', error);
      throw error;
    }
  `;
  return new Worker(bootstrap, {
    eval: true,
    workerData: { moduleUrl },
    execArgv: baseExecArgv,
  });
}

function createJavaScriptWorker(): Worker {
  const workerScript = new URL('./documentWorker.js', import.meta.url);
  return new Worker(workerScript, { execArgv: baseExecArgv });
}

worker.on('message', (message: any) => {
  if (!message || typeof message !== 'object') return;
  const { id, type, error } = message;
  if (typeof id !== 'number') return;
  const pending = pendingRequests.get(id);
  if (!pending) return;
  pendingRequests.delete(id);
  if (error) pending.reject(new Error(error));
  else pending.resolve();
});

worker.on('error', error => {
  for (const pending of pendingRequests.values()) {
    pending.reject(error);
  }
  pendingRequests.clear();
  console.error('Document worker failed:', error);
});

worker.on('exit', code => {
  if (code !== 0) {
    const error = new Error(`Document worker exited with code ${code}`);
    for (const pending of pendingRequests.values()) {
      pending.reject(error);
    }
    pendingRequests.clear();
    console.error(error);
  }
});

function sendRequest(type: 'flush' | 'shutdown'): Promise<void> {
  const requestId = messageCounter++;
  return new Promise<void>((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
    worker.postMessage({ type, id: requestId });
  });
}

export function scheduleDocumentPersist(record: DocumentRecord): void {
  worker.postMessage({ type: 'document', record });
}

export function flushPipelineQueues(): Promise<void> {
  return sendRequest('flush');
}

export async function shutdownDocumentPipeline(): Promise<void> {
  await sendRequest('shutdown');
  await worker.terminate();
}
