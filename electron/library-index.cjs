// Generated from src/main/library/index.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLibraryProblem = toLibraryProblem;
exports.createLibraryLoader = createLibraryLoader;
const supported = new Set(['CF', 'AT', 'LG', 'NC', 'LC', 'LOJ']);
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function positive(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
/** Index rows are already normalised, so only shape and allowlist checks apply. */
function toLibraryProblem(value) {
    const row = object(value);
    if (!row)
        return null;
    const id = text(row.id), title = text(row.title), url = text(row.url), source = text(row.platform);
    if (!id || !title || !url || !source || !supported.has(source))
        return null;
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        return null;
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
        return null;
    const tags = Array.isArray(row.tags) ? row.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0) : [];
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
function createLibraryLoader(directory, fs, path) {
    const cache = new Map();
    const metaPath = path.join(directory, 'meta.json');
    return {
        load(platforms) {
            let stamp = -1;
            try {
                stamp = fs.statSync(metaPath).mtimeMs;
            }
            catch {
                stamp = -1;
            }
            if (stamp < 0)
                return { records: [], builtAt: null, counts: {} };
            const wanted = platforms && platforms.length ? [...new Set(platforms.map(value => value.toUpperCase()))].sort() : [];
            const key = wanted.length ? wanted.join(',') : '*';
            const cached = cache.get(key);
            if (cached && cached.stamp === stamp)
                return cached.snapshot;
            let builtAt = null;
            try {
                const meta = object(JSON.parse(fs.readFileSync(metaPath, 'utf8')));
                builtAt = text(meta?.builtAt);
            }
            catch {
                builtAt = null;
            }
            const records = [];
            const counts = {};
            let files = [];
            try {
                files = fs.readdirSync(directory).filter(name => name.endsWith('.ndjson'));
            }
            catch {
                files = [];
            }
            if (wanted.length)
                files = files.filter(name => wanted.includes(name.replace('.ndjson', '').toUpperCase()));
            for (const file of files) {
                let lines = [];
                try {
                    lines = fs.readFileSync(path.join(directory, file), 'utf8').split('\n').filter(Boolean);
                }
                catch {
                    continue;
                }
                for (const line of lines) {
                    let value;
                    try {
                        value = JSON.parse(line);
                    }
                    catch {
                        continue;
                    }
                    const problem = toLibraryProblem(value);
                    if (!problem)
                        continue;
                    records.push(problem);
                    counts[problem.source] = (counts[problem.source] ?? 0) + 1;
                }
            }
            const snapshot = { records, builtAt, counts };
            cache.set(key, { stamp, snapshot });
            return snapshot;
        }
    };
}
