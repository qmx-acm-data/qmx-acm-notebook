import type { DailyDrawProblem } from '../../shared/models/daily-problem.js';

export interface DailyLibrary {
  records: readonly DailyDrawProblem[];
  builtAt: string | null;
}

export interface LibrarySnapshot extends DailyLibrary {
  counts: Record<string, number>;
}

export interface LibraryLoader {
  /** Loads only the requested platform shards when provided. */
  load(platforms?: readonly string[]): LibrarySnapshot;
}

type Fields = Record<string, unknown>;
const supported = new Set(['CF', 'AT', 'LG', 'NC', 'LC', 'LOJ']);

function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Index rows are already normalised, so only shape and allowlist checks apply. */
export function toLibraryProblem(value: unknown): DailyDrawProblem | null {
  const row = object(value);
  if (!row) return null;
  const id = text(row.id), title = text(row.title), url = text(row.url), source = text(row.platform);
  if (!id || !title || !url || !source || !supported.has(source)) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
  const tags = Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0) : [];
  // Keep the validated original string: rebuilding it via URL.href allocates a
  // second copy of every URL and is the largest avoidable string cost.
  return {
    id, title, url, source, origin: 'library',
    rating: positive(row.rating),
    estimatedCfRating: positive(row.estimatedCfRating),
    estimatedLuoguDifficulty: text(row.estimatedLuoguDifficulty),
    luoguDifficulty: text(row.luoguDifficulty) ?? '',
    communityDifficulty: typeof row.communityDifficulty === 'number' && Number.isFinite(row.communityDifficulty) ? row.communityDifficulty : null,
    ratingEstimateReason: text(row.estimateReason) ?? undefined,
    tags
  };
}

export function createLibraryLoader(directory: string, fs: typeof import('node:fs'), path: typeof import('node:path')): LibraryLoader {
  const cache = new Map<string, { stamp: number; snapshot: LibrarySnapshot }>();
  const metaPath = path.join(directory, 'meta.json');
  return {
    load(platforms?: readonly string[]): LibrarySnapshot {
      let stamp = -1;
      try { stamp = fs.statSync(metaPath).mtimeMs; } catch { stamp = -1; }
      if (stamp < 0) return { records: [], builtAt: null, counts: {} };
      const wanted = platforms && platforms.length ? [...new Set(platforms.map(value => value.toUpperCase()))].sort() : [];
      const key = wanted.length ? wanted.join(',') : '*';
      const cached = cache.get(key);
      if (cached && cached.stamp === stamp) return cached.snapshot;
      let builtAt: string | null = null;
      try {
        const meta = object(JSON.parse(fs.readFileSync(metaPath, 'utf8')));
        builtAt = text(meta?.builtAt);
      } catch { builtAt = null; }
      const records: DailyDrawProblem[] = [];
      const counts: Record<string, number> = {};
      let files: string[] = [];
      try {
        files = fs.readdirSync(directory).filter(name => name.endsWith('.ndjson'));
      } catch { files = []; }
      if (wanted.length) files = files.filter(name => wanted.includes(name.replace('.ndjson', '').toUpperCase()));
      for (const file of files) {
        let lines: string[] = [];
        try { lines = fs.readFileSync(path.join(directory, file), 'utf8').split('\n').filter(Boolean); } catch { continue; }
        for (const line of lines) {
          let value: unknown;
          try { value = JSON.parse(line); } catch { continue; }
          const problem = toLibraryProblem(value);
          if (!problem) continue;
          records.push(problem);
          counts[problem.source] = (counts[problem.source] ?? 0) + 1;
        }
      }
      const snapshot: LibrarySnapshot = { records, builtAt, counts };
      cache.set(key, { stamp, snapshot });
      return snapshot;
    }
  };
}
