// Generated from src/main/contests/nowcoder-daily.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateNowcoderCfRating = estimateNowcoderCfRating;
exports.parseNowcoderTopicPage = parseNowcoderTopicPage;
exports.fetchNowcoderTopic = fetchNowcoderTopic;
exports.fetchNowcoderProblems = fetchNowcoderProblems;
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
/** Explicit heuristic only; Nowcoder's 1-5 scale is not a CF rating. */
function estimateNowcoderCfRating(difficulty) {
    if (difficulty === null || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)
        return null;
    return [800, 1200, 1600, 2000, 2400][difficulty - 1] ?? null;
}
function positiveInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
function finiteRate(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function parseProblem(value, expectedTopic) {
    const row = object(value);
    if (!row || row.tpId !== expectedTopic || !positiveInteger(row.questionId) ||
        typeof row.questionNo !== 'string' || !row.questionNo.trim() ||
        typeof row.questionTitle !== 'string' || !row.questionTitle.trim() ||
        typeof row.questionUUid !== 'string' || !/^[a-f0-9]{32}$/i.test(row.questionUUid))
        return null;
    const difficulty = typeof row.difficulty === 'number' && Number.isInteger(row.difficulty) && row.difficulty >= 1 && row.difficulty <= 5 ? row.difficulty : null;
    const tags = Array.isArray(row.tags) ? row.tags.flatMap((value) => {
        const tag = object(value);
        return typeof tag?.name === 'string' && tag.name.trim() ? [tag.name.trim()] : [];
    }) : [];
    return {
        id: `NC:${expectedTopic}:${row.questionId}`,
        source: 'nowcoder',
        topicId: expectedTopic,
        questionId: row.questionId,
        questionNo: row.questionNo.trim(),
        title: row.questionTitle.trim(),
        url: `https://www.nowcoder.com/practice/${row.questionUUid}?tpId=${expectedTopic}&tqId=${row.questionId}&sourceUrl=%2Fexam%2Foj`,
        difficulty,
        difficultyEstimated: false,
        acceptRate: finiteRate(row.acceptRate),
        tags: [...new Set(tags)]
    };
}
function parseNowcoderTopicPage(payload, expectedTopic, page) {
    if (!Number.isSafeInteger(page) || page < 1)
        throw new Error('牛客分页页码无效');
    const root = object(payload);
    const data = object(root?.data);
    if (root?.code !== 0 || root?.msg !== 'OK' || !data || data.tpId !== undefined && data.tpId !== expectedTopic ||
        !positiveInteger(data.totalPage) || !positiveInteger(data.totalCount) || !Array.isArray(data.questions)) {
        throw new Error('牛客题库响应格式错误');
    }
    const problems = data.questions.flatMap((value) => {
        const parsed = parseProblem(value, expectedTopic);
        return parsed ? [parsed] : [];
    });
    return { topicId: expectedTopic, page, totalPage: data.totalPage, totalCount: data.totalCount, problems };
}
const endpoint = 'https://www.nowcoder.com/api/questiontraining/coding/getTopicQuestion';
async function fetchNowcoderTopic(topic, fetcher = fetch, timeoutMs = 15000, pageSize = 100) {
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
        throw new Error('牛客分页大小无效');
    const problems = [];
    let totalPage = 1;
    for (let page = 1; page <= totalPage; page += 1) {
        const url = `${endpoint}?pageSize=${pageSize}&title=&topicId=${topic}&page=${page}`;
        const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit', headers: { accept: 'application/json' } });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const parsed = parseNowcoderTopicPage(await response.json(), topic, page);
        totalPage = parsed.totalPage;
        if (parsed.totalPage > 1000)
            throw new Error('牛客分页总页数异常');
        problems.push(...parsed.problems);
    }
    return [...new Map(problems.map(problem => [problem.id, problem])).values()];
}
async function fetchNowcoderProblems(fetcher = fetch, timeoutMs = 15000) {
    const problems = [];
    const errors = [];
    for (const topic of [295, 383]) {
        try {
            problems.push(...await fetchNowcoderTopic(topic, fetcher, timeoutMs));
        }
        catch (error) {
            errors.push({ topicId: topic, message: error instanceof Error ? error.message : 'Unknown source error' });
        }
    }
    return { problems: [...new Map(problems.map(problem => [problem.id, problem])).values()], errors };
}
