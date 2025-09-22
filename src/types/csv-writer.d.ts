// isso é um modulo pra configurar como o csv vai ser escrito
declare module 'csv-writer' {
  type CsvHeader = {
    id: string;
    title: string;
  };

  interface CsvWriterOptions<T extends Record<string, unknown>> {
    path: string;
    header: CsvHeader[];
    append?: boolean;
  }

  interface ObjectCsvWriter<T extends Record<string, unknown>> {
    writeRecords(records: T[]): Promise<void>;
  }

  export function createObjectCsvWriter<T extends Record<string, unknown>>(
    options: CsvWriterOptions<T>
  ): ObjectCsvWriter<T>;
}
