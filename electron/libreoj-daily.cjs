// Generated from src/main/contests/libreoj-daily.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLibreOJ = requestLibreOJ;
exports.parseLibreOJProblems = parseLibreOJProblems;
exports.fetchLibreOJProblems = fetchLibreOJProblems;
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
const tagAliases = {
    '动态规划': 'dp', '图论': 'graphs', '数据结构': 'data structures', '数学': 'math', '字符串': 'strings',
    '贪心': 'greedy', '二分': 'binary search', '搜索': 'dfs and similar', '树': 'trees', '构造': 'constructive algorithms'
};
/** Only the two verified public read endpoints are permitted. No cookies or challenge retries. */
async function requestLibreOJ(route, body, fetcher = fetch, timeoutMs = 15000, maxBytes = 1500000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000 || !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 2000000)
        throw new Error('LibreOJ 请求限制无效');
    const response = await fetcher(`https://api.loj.ac/api/problem/${route}`, {
        method: 'POST', body: JSON.stringify(body), headers: { accept: 'application/json', 'content-type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit'
    });
    if (!response.ok || response.redirected)
        throw new Error(`LibreOJ HTTP ${response.status}`);
    if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? ''))
        throw new Error('LibreOJ 返回非 JSON 响应，未尝试绕过平台验证');
    if (!response.body)
        throw new Error('LibreOJ 响应为空');
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
        while (true) {
            const part = await reader.read();
            if (part.done)
                break;
            bytes += part.value.byteLength;
            if (bytes > maxBytes) {
                await reader.cancel();
                throw new Error('LibreOJ 响应超过大小限制');
            }
            chunks.push(part.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    try {
        return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
    }
    catch {
        throw new Error('LibreOJ JSON 格式错误');
    }
}
function parseLibreOJProblems(payload) {
    const root = object(payload);
    if (!root || !Number.isSafeInteger(root.count) || typeof root.count !== 'number' || root.count < 0 || !Array.isArray(root.result))
        throw new Error('LibreOJ 题库格式错误');
    const seen = new Set();
    const problems = root.result.flatMap((value) => {
        const row = object(value), meta = object(row?.meta);
        if (!row || !meta || meta.isPublic !== true || typeof meta.id !== 'number' || !Number.isSafeInteger(meta.id) || meta.id <= 0 || typeof meta.displayId !== 'number' || !Number.isSafeInteger(meta.displayId) || meta.displayId <= 0 || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 1000 || seen.has(meta.displayId))
            return [];
        seen.add(meta.displayId);
        const tags = Array.isArray(row.tags) ? row.tags.flatMap((value) => {
            const tag = object(value);
            if (typeof tag?.name !== 'string' || !tag.name.trim() || tag.name.length > 100)
                return [];
            const name = tag.name.trim();
            return tagAliases[name] ? [name, tagAliases[name]] : [name];
        }) : [];
        // Submission acceptance is an uncalibrated proxy, not a native difficulty or an official rating.
        const submissions = meta.submissionCount;
        const accepted = meta.acceptedSubmissionCount;
        let estimatedCfRating = null;
        let estimatedLuoguDifficulty = null;
        let ratingEstimateReason;
        if (typeof submissions === 'number' && Number.isSafeInteger(submissions) && submissions >= 100 &&
            typeof accepted === 'number' && Number.isSafeInteger(accepted) && accepted > 0 && accepted <= submissions) {
            const ratio = accepted / submissions;
            const [rating, level] = ratio >= 0.5 ? [900, '入门']
                : ratio >= 0.3 ? [1300, '普及']
                    : ratio >= 0.15 ? [1700, '提高']
                        : ratio >= 0.05 ? [2100, '提高+/省选-']
                            : [2500, '省选/NOI-'];
            estimatedCfRating = rating;
            estimatedLuoguDifficulty = level;
            ratingEstimateReason = `低置信度、未经校准的粗估，依据 LibreOJ ${accepted}/${submissions} 次提交通过比例 ${(ratio * 100).toFixed(1)}%；CF ${rating}、洛谷 ${level} 均非官方等价，通过率受重复提交及题目人群影响`;
        }
        return [{ id: `LOJ:${meta.displayId}`, source: 'LOJ', origin: 'libreoj', title: row.title.trim(), url: `https://loj.ac/p/${meta.displayId}`, rating: null, communityDifficulty: null, estimatedCfRating, estimatedLuoguDifficulty, ratingEstimateReason, luoguDifficulty: '', tags: [...new Set(tags)] }];
    });
    return { count: root.count, problems };
}
async function fetchLibreOJProblems(fetcher = fetch, timeoutMs = 15000, random = Math.random) {
    const problems = [];
    // The public endpoint rejects takeCount above 100. Bound the crawl even if its count grows unexpectedly.
    const pageSize = 100, maxPages = 100;
    let count = 0;
    const errors = [];
    const deadline = Date.now() + timeoutMs;
    const pages = [0];
    for (let index = 0; index < pages.length; index++) {
        const page = pages[index];
        try {
            const remainingMs = Math.floor(deadline - Date.now());
            if (remainingMs < 1)
                throw new Error('LibreOJ 列表总超时');
            const payload = await requestLibreOJ('queryProblemSet', { locale: 'zh_CN', skipCount: page * pageSize, takeCount: pageSize }, fetcher, remainingMs);
            const parsed = parseLibreOJProblems(payload);
            count = parsed.count;
            problems.push(...parsed.problems);
            if (index === 0) {
                const remaining = Array.from({ length: Math.min(maxPages - 1, Math.max(0, Math.ceil(count / pageSize) - 1)) }, (_, i) => i + 1);
                // Select across the entire listing before revisiting any region.
                for (let i = remaining.length - 1; i > 0; i--) {
                    const value = random();
                    if (!Number.isFinite(value) || value < 0 || value >= 1)
                        throw new RangeError('random must return a value in [0, 1)');
                    const j = Math.floor(value * (i + 1));
                    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
                }
                pages.push(...remaining);
            }
            const rows = object(payload)?.result;
            if (Array.isArray(rows) && rows.length === 0)
                break;
        }
        catch (error) {
            errors.push(`第 ${page + 1} 页获取失败：${error instanceof Error ? error.message : 'LibreOJ 获取失败'}`);
            break;
        }
    }
    const unique = [...new Map(problems.map(problem => [problem.id, problem])).values()];
    if (count > unique.length && unique.length > 0 && !errors.length)
        errors.push(`LibreOJ 仅获取前 ${unique.length} 道有效公开题（共 ${count} 题），随机范围受分页上限限制`);
    if (errors.length && unique.length)
        errors[0] = `LibreOJ 已保留 ${unique.length} 道已获取题目；${errors[0]}`;
    return { problems: unique, errors };
}
