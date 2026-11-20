export interface DailyDrawFilters {
  source?: string;
  platform?: string;
  ratingMin?: number;
  ratingMax?: number;
  communityDifficultyMin?: number;
  communityDifficultyMax?: number;
  luoguDifficulty?: string;
  difficulty?: string;
  tags?: string[];
  excludedIds?: string[];
}
export interface DailyDrawProblem {
  id: string;
  title: string;
  source: string;
  origin: 'local' | 'public' | 'codeforces' | 'atcoder-problems' | 'leetcode' | 'nowcoder' | 'libreoj' | 'clist-luogu' | 'clist-nowcoder' | 'library';
  communityDifficulty?: number | null;
  estimatedCfRating?: number | null;
  ratingEstimateReason?: string;
  estimatedLuoguDifficulty: string | null;
  url: string;
  rating: number | null;
  luoguDifficulty: string;
  tags: string[];
  statementText?: string;
}
export interface DailyDrawResult { problem: DailyDrawProblem; note?: string }
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
