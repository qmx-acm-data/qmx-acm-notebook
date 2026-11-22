export interface ClistBulkResourceState {
  offset: number;
  total: number | null;
  pages: number;
  status: 'idle' | 'running' | 'paused' | 'done' | 'failed';
  imported: number;
  lastId?: number;
  ignored?: number;
}
export interface ClistBulkState {
  schema: 1;
  running: boolean;
  pauseRequested: boolean;
  status: 'idle' | 'running' | 'paused' | 'done' | 'failed';
  resources: Record<string, ClistBulkResourceState>;
  startedAt: string | null;
  finishedAt: string | null;
  message?: string;
}
