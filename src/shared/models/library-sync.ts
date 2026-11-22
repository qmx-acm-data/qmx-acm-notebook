/** Per-platform library cache state, persisted so long crawls resume after restart. */
export type LibrarySyncMode = 'incremental' | 'full';
export type LibrarySyncPlatformStatus = 'idle' | 'probing' | 'fetching' | 'merging' | 'paused' | 'done' | 'failed' | 'skipped';
export interface LibrarySyncPlatformState {
  status: LibrarySyncPlatformStatus;
  known: number;
  total: number | null;
  fetched: number;
  added: number;
  /** Next page/skip cursor for a resumable full crawl. */
  cursor: number | null;
  message?: string;
  updatedAt: string | null;
}
export interface LibrarySyncState {
  running: boolean;
  pauseRequested: boolean;
  mode: LibrarySyncMode | null;
  startedAt: string | null;
  finishedAt: string | null;
  platforms: Record<string, LibrarySyncPlatformState>;
  totalCount: number;
}
export interface LibrarySyncProgress {
  platform: string;
  phase: 'probe' | 'fetch' | 'merge' | 'done';
  fetched?: number;
  total?: number;
}
