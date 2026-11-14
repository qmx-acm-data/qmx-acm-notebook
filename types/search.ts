/** Structural inputs are deliberately unknown: search coerces legacy record values. */
export interface SearchRecord {
  platform?: unknown;
  difficulty?: unknown;
  rating?: unknown;
  pid?: unknown;
  problemUrl?: unknown;
  url?: unknown;
  link?: unknown;
  title?: unknown;
  tags?: unknown;
  author?: unknown;
  body?: unknown;
}

export interface Difficulty {
  tone: 'neutral' | 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'black';
  rank: '' | 'grandmaster' | 'legendary';
  label: string;
  native: string;
  level: number | null;
}

export interface SearchApi {
  normalizePlatform(value: unknown): string;
  difficulty(record: unknown): Difficulty;
  match(record: unknown, query: unknown): number;
  tagHits(record: unknown, selected: unknown): number;
}
