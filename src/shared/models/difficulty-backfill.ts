/** Resumable CLIST rating cache queue covering every supported local problem. */
export type DifficultyBackfillStatus = 'idle' | 'running' | 'pausing' | 'paused' | 'done' | 'failed';
export interface DifficultyBackfillPlatformState {
  missing: number;
  /** All local problems, including those with native or community difficulty. */
  total?: number;
  clistCached?: number;
  /** Problems without a positive CLIST score; ledger cooldown may defer requests. */
  clistPending?: number;
  /** Source-native/community gaps, before applying approved supplements or CLIST. */
  sourceMissing?: number;
  /** Missing-source problems that now have a usable supplemental reference. */
  resolved?: number;
  attempted: number;
  found: number;
  /** Outcomes from this batch; absent on historical display state. */
  notFound?: number;
  noRating?: number;
  failed?: number;
}
export interface DifficultyBackfillState {
  status: DifficultyBackfillStatus;
  running: boolean;
  pauseRequested: boolean;
  batchSize: number;
  processed: number;
  found: number;
  /** CLIST has no record for the problem. */
  notFound?: number;
  /** CLIST has no usable rating, including zero. */
  noRating?: number;
  /** Historical ledger entries skipped without a lookup in this batch. */
  skipped: number;
  failed: number;
  startedAt: string | null;
  finishedAt: string | null;
  platforms: Record<string, DifficultyBackfillPlatformState>;
  message?: string;
}
