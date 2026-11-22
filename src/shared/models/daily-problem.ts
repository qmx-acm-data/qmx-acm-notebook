export interface DailyDrawFilters {
  source?: string;
  platform?: string;
  ratingMin?: number;
  ratingMax?: number;
  communityDifficultyMin?: number;
  communityDifficultyMax?: number;
  luoguDifficulty?: string;
  luoguDifficultyMin?: string;
  luoguDifficultyMax?: string;
  difficulty?: string;
  tags?: string[];
  excludedIds?: string[];
}
export interface DailyDrawProblem {
  id: string;
  title: string;
  source: string;
  origin: 'local' | 'public' | 'codeforces' | 'atcoder-problems' | 'leetcode' | 'nowcoder' | 'libreoj' | 'clist-luogu' | 'clist-nowcoder' | 'library';
  /** CLIST's own problem rating; never presented as a native CF rating. */
  clistRating?: number | null;
  clistRatingStatus?: 'available' | 'no-data' | 'not-found' | 'not-configured' | 'not-obtained' | 'not-requested';
  clistRatingCached?: boolean;
  clistRatingStale?: boolean;
  clistRatingQueriedAt?: string;
  difficultyReference?: {
    method: string;
    basis: 'native-cf' | 'clist' | 'platform-heuristic';
    confidence: 'native' | 'low';
    calibrated: boolean;
    resource: string;
    rawRating?: number;
  };
  communityDifficulty?: number | null;
  estimatedCfRating?: number | null;
  ratingEstimateReason?: string;
  estimatedLuoguDifficulty: string | null;
  url: string;
  rating: number | null;
  luoguDifficulty: string;
  /** Official Luogu native code (0 unassessed, 1–8 rated). */
  luoguDifficultyCode?: number;
  tags: string[];
  /** Explicit source metadata; an empty list/null means the official field is missing. */
  officialTags?: string[];
  officialDifficulty?: string | null;
  supplementInfo?: { source: 'manual' | 'ai'; revision: number; tags: boolean; difficulty: boolean };
  statementText?: string;
}
export interface DailyDrawDiagnostics {
  durationMs: number;
  candidateCount: number;
  platforms: Record<string, { count: number; tagged: number }>;
  dataMode: 'index' | 'online' | 'mixed' | 'scoped';
}
export interface DailyDrawResult { problem: DailyDrawProblem; note?: string; diagnostics?: DailyDrawDiagnostics }
export interface DailyTagCatalog {
  tags: { name: string; sources: string[] }[];
  platforms: Record<string, { count: number; tagged: number; tagCount: number }>;
  builtAt: string | null;
  total: number;
}
export interface LibrarySyncPlatformResult {
  status: 'skipped' | 'updated' | 'rebuilt' | 'failed';
  before: number;
  after: number;
  added: number;
  message?: string;
}
export interface LibrarySyncResult {
  full: boolean;
  total: number;
  durationMs: number;
  platforms: Record<string, LibrarySyncPlatformResult>;
}
