export type PlatformCode = 'CF' | 'AT' | 'LG' | 'NC' | 'LC';

export interface PlatformBinding {
  platform: PlatformCode;
  id: string;
  username: string;
  url: string;
}

export interface PlatformContest {
  name: string;
  url: string | null;
  date: string | null;
  rank: number | null;
  rating: number | null;
  delta: number | null;
  solvedCount: number | null;
  problemCount: number | null;
  rated?: boolean;
}

export interface PlatformActivity {
  days: Record<string, number>;
  complete: boolean;
  note: string;
  rangeComplete?: boolean;
  metric?: 'platformDailySolved';
  timezone?: 'Asia/Shanghai';
  startDate?: string;
  endDate?: string;
}

export interface PlatformData {
  username: string;
  profileUrl: string;
  solvedCount: number | null;
  submissionCount: number | null;
  rating: number | null;
  maxRating: number | null;
  ratedContests: number | null;
  contests: PlatformContest[];
  ratingHistory: PlatformContest[];
  activity: PlatformActivity;
  sourceNote: string;
  // Legacy thrown values may expose a non-string truthy message; preserve it verbatim.
  submissionCountNote?: unknown;
  observedMaxRating?: number;
}

export interface PlatformRequestOptions {
  signal: AbortSignal;
  redirect: 'error';
  credentials: 'omit';
  headers: Record<string, string>;
  method?: string;
  body?: string;
}

/** Network and browser boundaries return unknown; consumers retain the original checks. */
export type PlatformFetcher = (url: string, options: PlatformRequestOptions) => Promise<unknown>;
export type PlatformPageReader = (url: string) => Promise<unknown>;

export interface FetchPlatformOptions {
  fetcher?: PlatformFetcher;
  readPage?: PlatformPageReader;
  cfRequestInterval?: number;
}

/** Structural access descriptions below are assertions, not runtime validation. */
export interface FetchResponseAccess {
  ok?: unknown;
  status?: unknown;
  headers?: { get?: (name: string) => string | null };
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
  body?: { getReader?: () => {
    read(): Promise<{ done: boolean; value: Uint8Array }>;
    cancel(): Promise<unknown>;
    releaseLock(): void;
  } };
}

export interface CFEnvelopeAccess {
  status?: unknown;
  comment?: unknown;
  result?: unknown;
}
export interface CFInfoAccess {
  handle?: unknown;
  rating?: unknown;
  maxRating?: unknown;
}
export interface CFHistoryAccess {
  contestName?: unknown;
  contestId?: unknown;
  ratingUpdateTimeSeconds?: unknown;
  rank?: unknown;
  newRating?: unknown;
  oldRating?: unknown;
}
export interface CFSubmissionAccess {
  id?: unknown;
  contestId?: unknown;
  verdict?: unknown;
  creationTimeSeconds?: unknown;
  problem?: { contestId?: unknown; index?: unknown; problemsetName?: unknown };
  author?: { participantType?: unknown };
}
export interface CFStandingsAccess {
  contest?: { id?: unknown };
  problems?: { contestId?: unknown; index?: unknown }[];
}
export interface CFStandingsEnvelopeAccess extends CFEnvelopeAccess {
  result?: CFStandingsAccess;
}

export interface ATHistoryAccess {
  IsRated?: unknown;
  EndTime?: unknown;
  NewRating?: unknown;
  OldRating?: unknown;
  ContestScreenName?: unknown;
  ContestName?: unknown;
  Place?: unknown;
}
export interface ATInfoAccess {
  user_id?: unknown;
  accepted_count?: unknown;
}
export interface ATSubmissionAccess {
  id?: unknown;
  user_id?: unknown;
  epoch_second?: unknown;
  result?: unknown;
  problem_id?: unknown;
}
export interface ATContestTasks {
  ids: Set<string>;
  start: number;
  end: number;
}

export interface PageLinkAccess {
  text?: unknown;
  url: string;
}
export interface FirstAcceptedAccess {
  records?: { problemId?: unknown; timestamp?: unknown }[];
  complete?: unknown;
}
export interface PageActivityAccess {
  metric?: unknown;
  timezone?: unknown;
  days?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  complete?: unknown;
}
export interface PracticeRowAccess {
  submissionId?: unknown;
  problemId?: unknown;
  time?: unknown;
  verdict?: unknown;
}
export interface RenderedPageAccess {
  title?: unknown;
  text?: unknown;
  links?: PageLinkAccess[];
  firstAccepted?: FirstAcceptedAccess;
  activity?: PageActivityAccess;
  practiceRows?: PracticeRowAccess[];
  publicData?: { uid?: unknown; dailyCounts?: unknown };
}
export interface RenderedPage extends Omit<RenderedPageAccess, 'title' | 'text' | 'links'> {
  title: string;
  text: string;
  links: PageLinkAccess[];
}
export interface PracticeRow {
  id: string;
  problem: unknown;
  time: unknown;
  accepted: boolean;
  valid: boolean;
}

export interface LCDifficultyAccess {
  difficulty?: unknown;
  count?: unknown;
}
export interface LCContestAccess {
  attended?: unknown;
  rating?: unknown;
  ranking?: unknown;
  problemsSolved?: unknown;
  totalProblems?: unknown;
  contest?: { titleCn?: unknown; title?: unknown; startTime?: unknown };
}
export interface LCDataAccess {
  userProfilePublicProfile?: { profile?: { userSlug?: unknown; realName?: unknown } };
  userProfileUserQuestionProgress?: { numAcceptedQuestions?: LCDifficultyAccess[] };
  userProfileUserQuestionSubmitStats?: { totalSubmissionNum?: LCDifficultyAccess[] };
  recentACSubmissions?: unknown[];
  matchedUser?: {
    username?: unknown;
    profile?: { realName?: unknown };
    submitStatsGlobal?: { acSubmissionNum?: LCDifficultyAccess[]; totalSubmissionNum?: LCDifficultyAccess[] };
  };
  userContestRanking?: { rating?: unknown; attendedContestsCount?: unknown };
  userContestRankingHistory?: LCContestAccess[];
}
export interface LCEnvelopeAccess {
  errors?: { length?: unknown };
  data?: LCDataAccess;
}
