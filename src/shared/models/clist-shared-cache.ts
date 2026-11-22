export interface ClistSharedCacheStatus {
  total: number;
  initialTotal?: number;
  libraryTotal?: number;
  libraryMatched?: number;
  initialAppliedAt?: string;
  platforms: Record<string, number>;
  oldestQuery: string | null;
  newestQuery: string | null;
  sourceUrl: string | null;
  lastSyncedAt: string | null;
}
export interface ClistSharedCacheResult {
  canceled: boolean;
  imported: number;
  updated: number;
  kept: number;
  ignored: number;
  status: ClistSharedCacheStatus;
}
