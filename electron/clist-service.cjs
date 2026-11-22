// Generated from src/main/clist/service.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeClistRatingIdentity = normalizeClistRatingIdentity;
exports.createClistRatingCacheReader = createClistRatingCacheReader;
exports.readClistRatingCache = readClistRatingCache;
exports.normalizeClistProblem = normalizeClistProblem;
exports.filterClistProblems = filterClistProblems;
exports.createClistService = createClistService;
/** Only supported problem routes are identities; query strings never identify a problem. */
function ratingTarget(value) {
    if (typeof value !== 'string')
        return null;
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        return null;
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port)
        return null;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;
    let match;
    if (host === 'codeforces.com' || host === 'www.codeforces.com') {
        match = path.match(/^\/problemset\/problem\/([1-9]\d*)\/([A-Za-z0-9]+)\/?$/)
            ?? path.match(/^\/contest\/([1-9]\d*)\/problem\/([A-Za-z0-9]+)\/?$/);
        if (match)
            return { url: `https://codeforces.com/problemset/problem/${match[1]}/${match[2].toUpperCase()}`, resource: 'codeforces.com' };
    }
    else if (host === 'atcoder.jp' || host === 'www.atcoder.jp') {
        // Contest and task identifiers can contain uppercase letters (e.g. DEGwer2023,
        // 1202Contest_a), so the path grammar must not be limited to lowercase.
        match = path.match(/^\/contests\/([A-Za-z0-9_-]+)\/tasks\/([A-Za-z0-9_-]+)\/?$/);
        if (match)
            return { url: `https://atcoder.jp/contests/${match[1]}/tasks/${match[2]}`, resource: 'atcoder.jp' };
    }
    else if (host === 'leetcode.com' || host === 'www.leetcode.com' || host === 'leetcode.cn' || host === 'www.leetcode.cn') {
        match = path.match(/^\/(?:contest\/[a-z0-9-]+\/)?problems\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
        if (match)
            return { url: `https://leetcode.com/problems/${match[1]}/`, resource: 'leetcode.com' };
    }
    else if (host === 'luogu.com.cn' || host === 'www.luogu.com.cn') {
        match = path.match(/^\/problem\/([A-Za-z0-9_-]+)\/?$/);
        if (match)
            return { url: `https://www.luogu.com.cn/problem/${match[1]}`, resource: 'luogu.com.cn' };
    }
    else if (host === 'ac.nowcoder.com' || host === 'www.nowcoder.com' || host === 'nowcoder.com') {
        match = path.match(/^\/acm\/problem\/([1-9]\d*)\/?$/);
        if (match)
            return { url: `https://ac.nowcoder.com/acm/problem/${match[1]}`, resource: 'ac.nowcoder.com' };
        match = path.match(/^\/acm\/contest\/([1-9]\d*)\/([A-Za-z][A-Za-z0-9_-]*)\/?$/);
        if (match)
            return { url: `https://ac.nowcoder.com/acm/contest/${match[1]}/${match[2].toUpperCase()}`, resource: 'ac.nowcoder.com' };
    }
    else if (host === 'loj.ac' || host === 'www.loj.ac') {
        match = path.match(/^\/(?:p|problem)\/([1-9]\d*)\/?$/);
        if (match)
            return { url: `https://loj.ac/p/${match[1]}`, resource: 'loj.ac' };
    }
    return null;
}
/** Normalize source identities, including CLIST's historical plain HTTP URLs. */
function normalizeClistRatingIdentity(url) {
    return ratingTarget(url.replace(/^http:\/\//i, 'https://'));
}
const RATED_RESOURCES = new Set(['codeforces.com', 'atcoder.jp', 'leetcode.com', 'luogu.com.cn', 'ac.nowcoder.com', 'loj.ac']);
class RatedPageError extends Error {
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function ratingLookupPattern(target) {
    const path = new URL(target.url).pathname.replace(/^\/+/, '').replace(/\/$/, '');
    const boundary = (route) => `/${route}/?([?#].*)?$`;
    if (target.resource === 'codeforces.com') {
        const problemset = /^problemset\/problem\/([1-9]\d*)\/([A-Za-z0-9]+)$/.exec(path);
        const contest = /^contest\/([1-9]\d*)\/problem\/([A-Za-z0-9]+)$/.exec(path);
        const identity = problemset ?? contest;
        if (identity)
            return boundary(`(contest/${identity[1]}/problem/${identity[2]}|problemset/problem/${identity[1]}/${identity[2]})`);
    }
    if (target.resource === 'loj.ac') {
        const id = /^p\/([1-9]\d*)$/.exec(path)?.[1];
        if (id)
            return boundary(`(p|problem)/${id}`);
    }
    // End boundaries keep E from matching E1/E2 and P1001 from matching P10010,
    // so a response limit cannot hide the exact problem behind prefix matches.
    return boundary(escapeRegex(path));
}
const DEFAULT_ENDPOINT = 'https://clist.by/api/v4/problem/';
const ALLOWED_HOSTS = new Set(['clist.by', 'www.clist.by', 'www.luogu.com.cn', 'luogu.com.cn', 'ac.nowcoder.com', 'www.nowcoder.com']);
const DEFAULT_TIMEOUT = 15_000;
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function nonEmpty(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function safeUrl(value, allowedHosts = ALLOWED_HOSTS) {
    if (typeof value !== 'string')
        return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase()) || url.username || url.password)
            return null;
        return url.href;
    }
    catch {
        return null;
    }
}
function finiteRating(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
const INVALID_RATING_CACHE = 'CLIST 评分缓存格式无效，未覆盖原文件';
/** Validate the whole document so a later save cannot erase malformed entries. */
function ratingStore(value) {
    if (value === undefined)
        return { root: {}, ratings: {} };
    const root = object(value);
    const source = object(root?.ratings);
    if (!root || root.schema !== 1 || !source)
        throw new Error(INVALID_RATING_CACHE);
    const ratings = {};
    for (const [url, value] of Object.entries(source)) {
        const target = ratingTarget(url);
        const entry = object(value);
        // Historical zero entries remain valid cache documents, but never scores.
        const rating = entry?.rating === 0 ? 0 : finiteRating(entry?.rating);
        const queriedAt = entry?.queriedAt;
        if (!target || target.url !== url || !entry || rating === null || entry.resource !== target.resource
            || typeof queriedAt !== 'string' || !Number.isFinite(Date.parse(queriedAt))
            || new Date(queriedAt).toISOString() !== queriedAt
            || Object.keys(entry).some(key => !['rating', 'resource', 'queriedAt'].includes(key))) {
            throw new Error(INVALID_RATING_CACHE);
        }
        ratings[url] = { rating, resource: target.resource, queriedAt };
    }
    return { root, ratings };
}
/** Validate once and keep an isolated score snapshot for batches of candidate URLs. */
function createClistRatingCacheReader(value) {
    const store = ratingStore(value);
    const atTasks = new Map();
    for (const [url, entry] of Object.entries(store.ratings)) {
        if (entry.resource !== 'atcoder.jp')
            continue;
        // Validated AT routes end in the full, case-sensitive task identifier.
        const task = url.slice(url.lastIndexOf('/') + 1);
        const previous = atTasks.get(task);
        if (previous === null)
            continue;
        if (previous && previous.rating !== entry.rating) {
            atTasks.set(task, null);
        }
        else if (!previous || Date.parse(entry.queriedAt) > Date.parse(previous.queriedAt)) {
            atTasks.set(task, entry);
        }
    }
    return (url) => {
        const target = ratingTarget(url);
        let entry = target ? store.ratings[target.url] : undefined;
        if (!entry && target?.resource === 'atcoder.jp') {
            entry = atTasks.get(target.url.slice(target.url.lastIndexOf('/') + 1)) ?? undefined;
        }
        if (!entry)
            return null;
        if (entry.rating === 0)
            return { rating: null, resource: entry.resource, noData: true, queriedAt: entry.queriedAt, cached: true };
        return { ...entry, cached: true, stale: false };
    };
}
/** Read cached scores without credentials or network access. Invalid files throw safely. */
function readClistRatingCache(value, url) {
    return createClistRatingCacheReader(value)(url);
}
function strings(value) {
    if (!Array.isArray(value))
        return [];
    return [...new Set(value.flatMap(item => {
            if (typeof item === 'string')
                return item.trim() ? [item.trim()] : [];
            const row = object(item);
            const label = nonEmpty(row?.name) ?? nonEmpty(row?.title) ?? nonEmpty(row?.slug);
            return label ? [label] : [];
        }))];
}
function platformFor(url) {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'luogu.com.cn' || host === 'www.luogu.com.cn')
        return 'luogu';
    if (host === 'ac.nowcoder.com' || host === 'www.nowcoder.com')
        return 'nowcoder';
    return 'unknown';
}
function problemUrl(row) {
    const direct = row.url ?? row.problem_url ?? row.problemUrl ?? row.href;
    if (typeof direct === 'string' && direct.trim())
        return direct;
    const linked = object(row.problem);
    return linked?.url ?? linked?.href ?? linked?.problem_url ?? (typeof row.problem === 'string' ? row.problem : undefined);
}
function absoluteProblemUrl(value, row) {
    if (typeof value !== 'string' || !value.trim())
        return null;
    try {
        return new URL(value, resourceOrigin(row)).href;
    }
    catch {
        return null;
    }
}
function resourceOrigin(row) {
    const resource = object(row.resource);
    const resourceName = nonEmpty(row.resource) ?? nonEmpty(resource?.name) ?? nonEmpty(resource?.short) ?? nonEmpty(resource?.url);
    const rawPlatform = nonEmpty(row.platform)?.toLowerCase();
    const hint = rawPlatform ?? (resourceName && /luogu/i.test(resourceName) ? 'luogu' : resourceName && /nowcoder/i.test(resourceName) ? 'nowcoder' : undefined);
    if (hint === 'luogu')
        return 'https://www.luogu.com.cn';
    if (hint === 'nowcoder')
        return 'https://ac.nowcoder.com';
    return undefined;
}
function rejectionCategory(value) {
    const row = object(value);
    if (!row)
        return 'row_not_object';
    const candidate = absoluteProblemUrl(problemUrl(row), row);
    if (!candidate)
        return problemUrl(row) ? 'url_invalid' : 'url_missing_or_not_string';
    let parsed;
    try {
        parsed = new URL(candidate);
    }
    catch {
        return 'url_invalid';
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
        return 'url_unsafe';
    const resource = object(row.resource);
    const resourceName = nonEmpty(row.resource) ?? nonEmpty(resource?.name) ?? nonEmpty(resource?.short) ?? nonEmpty(resource?.url);
    const rawPlatform = nonEmpty(row.platform)?.toLowerCase();
    const hinted = rawPlatform ?? (resourceName && /luogu/i.test(resourceName) ? 'luogu' : resourceName && /nowcoder/i.test(resourceName) ? 'nowcoder' : undefined);
    const platform = hinted === 'luogu' || hinted === 'nowcoder' ? hinted : platformFor(parsed.href);
    if (platform === 'unknown')
        return 'unsupported_platform_domain';
    if (!validatePlatformUrl(parsed.href, platform))
        return 'platform_url_pattern_mismatch';
    if (!(nonEmpty(row.name) ?? nonEmpty(row.title) ?? nonEmpty(row.problem_name)))
        return 'name_missing_or_not_string';
    return 'other_normalization_reject';
}
function validatePlatformUrl(value, platform) {
    const url = safeUrl(value);
    if (!url)
        return null;
    const parsed = new URL(url);
    if (platform === 'luogu' && !/^(?:www\.)?luogu\.com\.cn$/i.test(parsed.hostname))
        return null;
    if (platform === 'nowcoder' && !/^(?:www\.)?nowcoder\.com$/i.test(parsed.hostname) && parsed.hostname.toLowerCase() !== 'ac.nowcoder.com')
        return null;
    if (platform === 'luogu' && !/^\/problem\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname))
        return null;
    if (platform === 'nowcoder' && !(/^(?:\/acm\/problem\/[1-9]\d*|\/acm\/contest\/[1-9]\d*\/[A-Za-z][A-Za-z0-9_-]*)\/?$/i.test(parsed.pathname)))
        return null;
    return url;
}
function normalizeClistProblem(value) {
    const row = object(value);
    if (!row)
        return null;
    const candidateUrl = problemUrl(row);
    const resource = object(row.resource);
    const rawPlatform = nonEmpty(row.platform)?.toLowerCase();
    const resourceName = nonEmpty(row.resource) ?? nonEmpty(resource?.name) ?? nonEmpty(resource?.short) ?? nonEmpty(resource?.url);
    const platformHint = rawPlatform ?? (resourceName && /luogu/i.test(resourceName) ? 'luogu' : resourceName && /nowcoder/i.test(resourceName) ? 'nowcoder' : undefined);
    const hinted = platformHint === 'luogu' || platformHint === 'nowcoder' ? platformHint : undefined;
    const rawUrl = safeUrl(absoluteProblemUrl(candidateUrl, row));
    if (!rawUrl)
        return null;
    const platform = hinted ?? platformFor(rawUrl);
    if (platform === 'unknown')
        return null;
    const url = validatePlatformUrl(rawUrl, platform);
    if (!url)
        return null;
    const name = nonEmpty(row.name) ?? nonEmpty(row.title) ?? nonEmpty(row.problem_name);
    if (!name)
        return null;
    const rating = finiteRating(row.rating ?? row.difficulty ?? row.points);
    const hasTagField = Array.isArray(row.tags) || Array.isArray(row.tag) || Array.isArray(row.categories);
    const tags = strings(row.tags ?? row.tag ?? row.categories);
    return { id: nonEmpty(row.id) ?? url, name, url, platform, rating, tags, tagsKnown: hasTagField, raw: value };
}
function filterClistProblems(problems, filter = {}) {
    if (filter.minRating !== undefined && (!Number.isFinite(filter.minRating) || filter.minRating < 0))
        throw new Error('最低 rating 无效');
    if (filter.maxRating !== undefined && (!Number.isFinite(filter.maxRating) || filter.maxRating < 0))
        throw new Error('最高 rating 无效');
    if (filter.minRating !== undefined && filter.maxRating !== undefined && filter.minRating > filter.maxRating)
        throw new Error('rating 范围无效');
    const tag = filter.tag?.trim();
    return problems.filter(problem => {
        if (filter.platform && problem.platform !== filter.platform)
            return false;
        if (filter.minRating !== undefined && (problem.rating === null || problem.rating < filter.minRating))
            return false;
        if (filter.maxRating !== undefined && (problem.rating === null || problem.rating > filter.maxRating))
            return false;
        // Missing/unknown tags are deliberately never a match for tag filtering.
        if (tag && (!problem.tagsKnown || !problem.tags.includes(tag)))
            return false;
        return true;
    });
}
function authHeader(credentials) {
    if (!credentials || typeof credentials.account !== 'string' || typeof credentials.key !== 'string' || !credentials.account || !credentials.key)
        throw new Error('CLIST 账号与 key 必须由调用方注入');
    return `ApiKey ${credentials.account}:${credentials.key}`;
}
function randomOffset(totalCount, limit, random) {
    const maxOffset = Math.max(0, totalCount - limit);
    const sample = random();
    const normalized = Number.isFinite(sample) && sample >= 0 && sample < 1 ? sample : 0;
    return Math.floor(normalized * (maxOffset + 1));
}
function createClistService(options) {
    const fetcher = options.fetcher ?? fetch;
    const now = options.now ?? (() => Date.now());
    const random = options.random ?? Math.random;
    const sleep = options.sleep ?? ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
    const rateLimitMs = options.rateLimitMs ?? 6_000;
    const pageSize = options.pageSize ?? 50;
    let serial = Promise.resolve();
    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    let nextAllowedAt = 0;
    // A failed CLIST request must not stall every later draw, so a successful
    // page is kept per filter and reused while the endpoint is unhealthy.
    let lastGood = null;
    let cooldownUntil = 0;
    const COOLDOWN_MS = 120_000;
    const RATING_TTL_MS = 24 * 60 * 60 * 1000;
    const persistentRatings = Boolean(options.readRatingCache || options.writeRatingCache);
    const ratingCache = new Map();
    const lastGoodRatings = new Map();
    let savedRatingStore;
    const readRatingStore = () => ratingStore(options.readRatingCache ? options.readRatingCache() : savedRatingStore);
    const ratingInflight = new Map();
    function endpointUrl() {
        const safe = safeUrl(endpoint, new Set(['clist.by', 'www.clist.by']));
        if (!safe)
            throw new Error('CLIST endpoint 必须使用 HTTPS 且属于 allowlist');
        return new URL(safe);
    }
    async function waitRateLimit() {
        const delay = Math.max(0, nextAllowedAt - now());
        if (delay)
            await sleep(delay);
        nextAllowedAt = Math.max(now(), nextAllowedAt) + rateLimitMs;
    }
    async function request(offset, filter) {
        await waitRateLimit();
        const url = endpointUrl();
        url.searchParams.set('offset', String(offset));
        url.searchParams.set('limit', String(pageSize));
        url.searchParams.set('total_count', 'true');
        if (filter.resource)
            url.searchParams.set('resource', filter.resource);
        if (filter.minRating !== undefined)
            url.searchParams.set('rating__gte', String(filter.minRating));
        if (filter.maxRating !== undefined)
            url.searchParams.set('rating__lte', String(filter.maxRating));
        const response = await fetcher(url, { method: 'GET', redirect: 'error', credentials: 'omit', headers: { accept: 'application/json', authorization: authHeader(options.credentials) }, signal: AbortSignal.timeout(timeoutMs) });
        if (!response.ok)
            throw new Error(`CLIST HTTP ${response.status}`);
        const body = object(await response.json());
        if (!body)
            throw new Error('CLIST 响应格式无效');
        const rows = Array.isArray(body.objects) ? body.objects : Array.isArray(body.results) ? body.results : null;
        if (!rows)
            throw new Error('CLIST 响应缺少题目列表');
        const metaCount = object(body.meta)?.total_count;
        const count = typeof metaCount === 'number' && Number.isFinite(metaCount) && metaCount >= 0 ? metaCount : body.total_count;
        return { rows, totalCount: typeof count === 'number' && Number.isFinite(count) && count >= 0 ? count : rows.length };
    }
    async function fetchProblemsInternal(filter = {}) {
        const started = now();
        const key = `${filter.resource ?? ''}|${filter.minRating ?? ''}|${filter.maxRating ?? ''}`;
        const cached = lastGood && lastGood.key === key ? lastGood : null;
        if (cached && now() < cooldownUntil) {
            return { problems: cached.result.problems, report: { ...cached.result.report, errors: [], durationMs: 0 } };
        }
        const pages = [];
        const errors = [];
        let rows = [];
        try {
            const resource = filter.resource ?? (filter.platform === 'luogu' ? 'luogu.com.cn' : filter.platform === 'nowcoder' ? 'ac.nowcoder.com' : undefined);
            const requestFilter = resource === filter.resource ? filter : { ...filter, resource };
            const first = await request(0, requestFilter);
            pages.push(0);
            const selected = randomOffset(first.totalCount, pageSize, random);
            if (selected === 0)
                rows = first.rows;
            else {
                const page = await request(selected, requestFilter);
                pages.push(selected);
                rows = page.rows;
            }
        }
        catch (error) {
            errors.push(error instanceof Error ? error.message : 'CLIST 请求失败');
        }
        const normalized = rows.flatMap(value => { const item = normalizeClistProblem(value); return item ? [item] : []; });
        const rejectionCategories = {};
        for (const value of rows)
            if (!normalizeClistProblem(value)) {
                const category = rejectionCategory(value);
                rejectionCategories[category] = (rejectionCategories[category] ?? 0) + 1;
            }
        const filtered = filterClistProblems(normalized, filter);
        if (errors.length && cached) {
            cooldownUntil = now() + COOLDOWN_MS;
            const ageSeconds = Math.max(0, Math.round((now() - cached.at) / 1000));
            return { problems: cached.result.problems, report: { ...cached.result.report, errors: [`CLIST 暂时不可用，使用约 ${ageSeconds} 秒前缓存；${errors[0]}`], durationMs: Math.max(0, now() - started) } };
        }
        if (!errors.length && filtered.length > 0) {
            lastGood = { at: now(), key, result: { problems: filtered, report: { requested: rows.length, accepted: filtered.length, rejected: rows.length - normalized.length, rejectionCategories, pages, errors: [], durationMs: Math.max(0, now() - started) } } };
            cooldownUntil = 0;
        }
        return { problems: filtered, report: { requested: rows.length, accepted: filtered.length, rejected: rows.length - normalized.length, rejectionCategories, pages, errors, durationMs: Math.max(0, now() - started) } };
    }
    function fetchProblems(filter = {}) {
        const run = serial.then(() => fetchProblemsInternal(filter));
        serial = run.then(() => undefined, () => undefined);
        return run;
    }
    async function fetchRatedPageInternal(resource, offset, limit) {
        if (!RATED_RESOURCES.has(resource) || !Number.isSafeInteger(offset) || offset < 0
            || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
            throw new RatedPageError('CLIST 批量评分分页参数无效');
        let status = null;
        let timer;
        const controller = new AbortController();
        try {
            const url = endpointUrl();
            if (url.pathname !== '/api/v4/problem/' || url.search || url.hash || url.port)
                throw new RatedPageError('CLIST 批量评分查询配置无效');
            url.searchParams.set('resource', resource);
            url.searchParams.set('rating__gt', '0');
            url.searchParams.set('offset', String(offset));
            url.searchParams.set('limit', String(limit));
            url.searchParams.set('order_by', 'id');
            url.searchParams.set('total_count', 'true');
            const authorization = authHeader(options.credentials);
            await waitRateLimit();
            const deadline = new Promise((_resolve, reject) => {
                timer = setTimeout(() => { controller.abort(); reject(new RatedPageError('CLIST 批量评分请求超时')); }, timeoutMs);
            });
            const fetchPage = async () => {
                const response = await fetcher(url, { method: 'GET', redirect: 'error', credentials: 'omit', headers: { accept: 'application/json', authorization }, signal: controller.signal });
                status = Number.isSafeInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
                if (!response.ok || response.redirected) {
                    if (response.body)
                        void response.body.cancel().catch(() => undefined);
                    throw new RatedPageError('CLIST 批量评分请求失败');
                }
                const maxBytes = 8 * 1024 * 1024;
                const length = response.headers?.get('content-length');
                if (length && /^\d+$/.test(length) && Number(length) > maxBytes) {
                    if (response.body)
                        void response.body.cancel().catch(() => undefined);
                    throw new RatedPageError('CLIST 批量评分响应过大');
                }
                let parsed;
                if (response.body) {
                    const reader = response.body.getReader();
                    const chunks = [];
                    let bytes = 0;
                    const cancel = () => { void reader.cancel().catch(() => undefined); };
                    controller.signal.addEventListener('abort', cancel, { once: true });
                    try {
                        for (;;) {
                            const part = await reader.read();
                            if (part.done)
                                break;
                            bytes += part.value.byteLength;
                            if (bytes > maxBytes)
                                throw new RatedPageError('CLIST 批量评分响应过大');
                            chunks.push(part.value);
                        }
                        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    }
                    finally {
                        controller.signal.removeEventListener('abort', cancel);
                        cancel();
                        reader.releaseLock();
                    }
                }
                else
                    parsed = await response.json();
                const body = object(parsed);
                const rawRows = Array.isArray(body?.objects) ? body.objects : Array.isArray(body?.results) ? body.results : null;
                const total = object(body?.meta)?.total_count ?? body?.total_count;
                if (!body || body.error || body.errors || !rawRows || rawRows.length > limit
                    || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0 || offset > total
                    || (rawRows.length === 0 ? offset < total : offset + rawRows.length > total)) {
                    throw new RatedPageError('CLIST 批量评分响应格式无效');
                }
                let previousId = 0;
                const rows = rawRows.map(value => {
                    const row = object(value);
                    if (!row || typeof row.id !== 'number' || !Number.isSafeInteger(row.id) || row.id <= previousId
                        || finiteRating(row.rating) === null || (row.url !== null && row.url !== undefined && typeof row.url !== 'string')
                        || (row.archive_url !== null && row.archive_url !== undefined && typeof row.archive_url !== 'string')) {
                        throw new RatedPageError('CLIST 批量评分题目或顺序无效');
                    }
                    const rating = finiteRating(row.rating);
                    if (rating === null)
                        throw new RatedPageError('CLIST 批量评分题目评分无效');
                    previousId = row.id;
                    const returnedResource = object(row.resource);
                    const resourceName = typeof row.resource === 'string' ? row.resource : returnedResource?.host;
                    if (resourceName !== undefined && resourceName !== resource)
                        throw new RatedPageError('CLIST 批量评分平台不匹配');
                    return { id: row.id, url: typeof row.url === 'string' ? row.url : null,
                        archiveUrl: typeof row.archive_url === 'string' ? row.archive_url : null, rating, resource };
                });
                return { rows, total };
            };
            return await Promise.race([fetchPage(), deadline]);
        }
        catch (error) {
            const message = error instanceof RatedPageError ? error.message : 'CLIST 批量评分请求失败';
            throw new Error(`${message}${status === null ? '' : `（HTTP ${status}）`}`);
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
            controller.abort();
        }
    }
    function fetchRatedPage(resource, offset, limit = 1000) {
        const run = serial.then(() => fetchRatedPageInternal(resource, offset, limit));
        serial = run.then(() => undefined, () => undefined);
        return run;
    }
    async function lookupRatingInternal(target) {
        const unknown = (error) => ({ rating: null, resource: target.resource, error });
        try {
            const url = endpointUrl();
            if (url.pathname !== '/api/v4/problem/' || url.search || url.hash || url.port)
                return unknown('CLIST 评分查询配置无效');
            // CLIST stores source URLs with contest query strings (Luogu ?contestId=…)
            // and Codeforces contest paths, so an exact `url` filter returns nothing.
            // Match the canonical problem path instead, then verify the identity below.
            url.searchParams.set('resource', target.resource);
            url.searchParams.set('url__regex', ratingLookupPattern(target));
            url.searchParams.set('limit', '10');
            const authorization = authHeader(options.credentials);
            await waitRateLimit();
            const response = await fetcher(url, { method: 'GET', redirect: 'error', credentials: 'omit', headers: { accept: 'application/json', authorization }, signal: AbortSignal.timeout(timeoutMs) });
            if (!response.ok)
                return unknown('CLIST 评分查询失败');
            const body = object(await response.json());
            if (!body || body.error || body.errors)
                return unknown('CLIST 评分响应无效');
            const rows = Array.isArray(body.objects) ? body.objects : Array.isArray(body.results) ? body.results : null;
            if (!rows)
                return unknown('CLIST 评分响应无效');
            if (!rows.length)
                return unknown('CLIST 未收录该题');
            for (const value of rows) {
                const row = object(value);
                if (!row)
                    continue;
                const rawUrl = problemUrl(row);
                let absolute = null;
                // CLIST still stores legacy http:// source links (e.g. old Codeforces
                // rounds). Upgrade the scheme for identity matching only; nothing is fetched.
                const upgraded = typeof rawUrl === 'string' ? rawUrl.replace(/^http:\/\//i, 'https://') : rawUrl;
                if (typeof upgraded === 'string' && (/^https:\/\//i.test(upgraded) || /^\/(?!\/)/.test(upgraded))) {
                    try {
                        absolute = new URL(upgraded, target.url).href;
                    }
                    catch { /* Invalid response URL. */ }
                }
                // Returned URLs are untrusted: neither a query filter nor a resource label
                // establishes identity without the same supported platform and problem ID.
                const returned = ratingTarget(absolute);
                if (!returned || returned.url !== target.url || returned.resource !== target.resource)
                    continue;
                if (row.rating === 0)
                    return { ...unknown('CLIST 暂无评分数据'), noData: true };
                const rating = finiteRating(row.rating);
                return rating === null ? unknown('CLIST 题目评分未知') : { rating, resource: target.resource };
            }
            return unknown('CLIST 返回题目不匹配');
        }
        catch {
            // Fetch/JSON errors can contain injected credentials or server bodies.
            return unknown('CLIST 评分查询失败');
        }
    }
    function lookupRating(url, force = false) {
        const target = ratingTarget(url);
        if (!target)
            return Promise.resolve({ rating: null, resource: '', error: '不支持的题目 URL' });
        const pending = ratingInflight.get(target.url);
        if (pending)
            return pending.then(result => ({ ...result }));
        const cached = ratingCache.get(target.url);
        if (!force && cached && cached.expiresAt > now()) {
            return Promise.resolve({ ...cached.result, ...(cached.result.rating === null ? {} : { cached: true }) });
        }
        const run = serial.then(async () => {
            let store;
            try {
                store = readRatingStore();
            }
            catch {
                const previous = lastGoodRatings.get(target.url);
                return previous ? { ...previous, cached: true, stale: true, error: INVALID_RATING_CACHE }
                    : { rating: null, resource: target.resource, error: INVALID_RATING_CACHE };
            }
            const stored = store.ratings[target.url];
            const remembered = lastGoodRatings.get(target.url);
            if (stored && stored.rating > 0 && (!remembered || Date.parse(stored.queriedAt) > Date.parse(remembered.queriedAt))) {
                lastGoodRatings.set(target.url, stored);
            }
            const previous = lastGoodRatings.get(target.url);
            if (!force && persistentRatings && previous)
                return { ...previous, cached: true, stale: false };
            const fetched = await lookupRatingInternal(target);
            if (fetched.rating === null) {
                const result = previous
                    ? { ...previous, cached: true, stale: true, error: fetched.error }
                    : fetched;
                ratingCache.set(target.url, { result, expiresAt: now() + COOLDOWN_MS });
                return result;
            }
            const entry = { rating: fetched.rating, resource: target.resource, queriedAt: new Date(now()).toISOString() };
            const result = { ...entry, cached: false, stale: false };
            lastGoodRatings.set(target.url, entry);
            if (options.writeRatingCache) {
                try {
                    // Re-read after the request so writes preserve intervening document metadata.
                    const latest = readRatingStore();
                    const next = { ...latest.root, schema: 1, ratings: { ...latest.ratings, [target.url]: entry } };
                    options.writeRatingCache(next);
                    savedRatingStore = next;
                }
                catch {
                    return { ...result, error: 'CLIST 评分缓存保存失败，未覆盖原文件' };
                }
            }
            ratingCache.set(target.url, { result, expiresAt: persistentRatings ? Infinity : now() + RATING_TTL_MS });
            return result;
        });
        ratingInflight.set(target.url, run);
        serial = run.then(() => undefined, () => undefined);
        void run.then(() => ratingInflight.delete(target.url), () => ratingInflight.delete(target.url));
        return run.then(result => ({ ...result }));
    }
    return Object.freeze({ fetchProblems, lookupRating, fetchRatedPage });
}
