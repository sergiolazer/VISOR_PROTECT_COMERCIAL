import type { ExportMessageRow } from '../entities/ExportMessageRow';

export interface IExportMessageStream {
  on(event: 'data', listener: (row: ExportMessageRow) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  pause(): void;
  resume(): void;
  close(): Promise<void>;
}
