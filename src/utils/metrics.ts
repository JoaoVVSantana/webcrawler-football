import fs from 'fs';
import path from 'path';

interface CrawlMetrics {
  startTime: string;
  endTime?: string;
  pagesProcessed: number;
  matchesFound: number;
  errorCount: number;
  sourceBreakdown: Record<string, number>;
}

const metricsFile = path.join(process.cwd(), 'result', 'crawl-metrics.json');

export function saveMetrics(metrics: CrawlMetrics) {
  const dir = path.dirname(metricsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
}

export function loadMetrics(): CrawlMetrics | null {
  try {
    return JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
  } catch {
    return null;
  }
}