// Generated from src/main/library/index.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLibraryProblem = toLibraryProblem;
exports.buildDailyTagCatalog = buildDailyTagCatalog;
exports.createLibraryLoader = createLibraryLoader;
const { normalizeSourceAlgorithmTags, normalizeOfficialMetadata } = require('./library-normalize.cjs');
const { parseLuoguNativeBaseline, recoverLuoguNativeRow } = require('./luogu-native.cjs');
const { luoguNativeDifficultyLabel } = require('./luogu-difficulty.js');
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
    const row = object(recoverLuoguNativeRow(value, null));
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
    const storedTags = Array.isArray(row.tags) ? row.tags : [];
    // Older non-Luogu shards retained source topics in rawTags even when the old
    // common vocabulary discarded them. Restore those real labels on read.
    // Luogu stays limited to official Algorithm names, including for legacy rows.
    const rawTags = source !== 'LG' && Array.isArray(row.rawTags) ? row.rawTags : [];
    const tags = normalizeSourceAlgorithmTags([...storedTags, ...rawTags], source);
    // Keep the validated original string: rebuilding it via URL.href allocates a
    // second copy of every URL and is the largest avoidable string cost.
    return {
        id, title, url, source, origin: 'library',
        rating: positive(row.rating),
        clistRating: typeof row.clistRating === 'number' && Number.isFinite(row.clistRating) && row.clistRating >= 0 ? row.clistRating : null,
        estimatedCfRating: positive(row.estimatedCfRating),
        estimatedLuoguDifficulty: text(row.estimatedLuoguDifficulty),
        luoguDifficulty: text(row.luoguDifficulty) ?? '',
        ...(source === 'LG' && typeof row.luoguDifficultyCode === 'number' && luoguNativeDifficultyLabel(row.luoguDifficultyCode) !== null ? { luoguDifficultyCode: row.luoguDifficultyCode } : {}),
        communityDifficulty: typeof row.communityDifficulty === 'number' && Number.isFinite(row.communityDifficulty) ? row.communityDifficulty : null,
        ratingEstimateReason: text(row.estimateReason) ?? undefined,
        tags,
        ...normalizeOfficialMetadata(row, source, tags)
    };
}
/** Compact catalog from real indexed topics; never sends problem rows over IPC. */
function buildDailyTagCatalog(snapshot) {
    const topics = new Map();
    const coverage = new Map();
    for (const record of snapshot.records) {
        if (!supported.has(record.source))
            continue;
        let platform = coverage.get(record.source);
        if (!platform) {
            platform = { count: 0, tagged: 0, tags: new Set() };
            coverage.set(record.source, platform);
        }
        platform.count += 1;
        const tags = normalizeSourceAlgorithmTags(record.tags, record.supplementInfo?.tags ? 'CF' : record.source);
        if (tags.length)
            platform.tagged += 1;
        for (const name of tags) {
            const key = name.toLowerCase();
            platform.tags.add(key);
            const topic = topics.get(key);
            if (topic)
                topic.sources.add(record.source);
            else
                topics.set(key, { name, sources: new Set([record.source]) });
        }
    }
    const platforms = {};
    for (const source of [...coverage.keys()].sort()) {
        const platform = coverage.get(source);
        if (platform)
            platforms[source] = { count: platform.count, tagged: platform.tagged, tagCount: platform.tags.size };
    }
    const tags = [...topics.values()]
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
        .slice(0, 1000)
        .map(topic => ({ name: topic.name, sources: [...topic.sources].sort() }));
    return { tags, platforms, builtAt: snapshot.builtAt, total: snapshot.records.length };
}
function createLibraryLoader(directory, fs, path, options = {}) {
    let baseline = null;
    if (options.luoguNativeFile) {
        let body = null;
        try {
            body = fs.readFileSync(options.luoguNativeFile, 'utf8');
        }
        catch (error) {
            if (object(error)?.code !== 'ENOENT')
                throw error;
        }
        if (body !== null)
            baseline = parseLuoguNativeBaseline(JSON.parse(body));
    }
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
                    const problem = toLibraryProblem(recoverLuoguNativeRow(value, baseline));
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
