const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/main/contests/daily-problems.cts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const loaded = new Module(filename, module);
loaded.filename = filename;
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '../ui/tag-presets.js' && parent?.filename === filename) return require('../ui/tag-presets.js');
  if (['./nowcoder-daily.cjs', './libreoj-daily.cjs'].includes(request) && parent?.filename === filename) {
    const dependencyPath = path.resolve(__dirname, '../src/main/contests/', request.replace('.cjs', '.cts'));
    const dependency = new Module(dependencyPath, module);
    dependency.filename = dependencyPath;
    const dependencyCompiled = ts.transpileModule(fs.readFileSync(dependencyPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    dependency._compile(dependencyCompiled.outputText, dependencyPath);
    return dependency.exports;
  }
  return originalLoad.call(this, request, parent, isMain);
};
loaded._compile(compiled.outputText, filename);
const { codeforcesDifficulty, parseCodeforces, fetchDailyProblems, parseLuoguProblemList, fetchLuoguProblems, parseLeetCode, fetchLeetCodeProblems, estimateLeetCodeRating, filterProblems, selectProblem, dailyDraw, resetLuoguSnapshot } = loaded.exports;
const nodeTest = require('node:test');
nodeTest.beforeEach(() => resetLuoguSnapshot());

const payload = { status: 'OK', result: { problems: [
  { contestId: 1, index: 'A', name: ' First ', rating: 800, tags: ['DP', 'dp', 'graphs'] },
  { contestId: 1, index: 'B', name: 'Second', tags: [] },
  { contestId: 1, index: '../bad', name: 'Bad' }
] } };

// Two-stage draws consume one random value for the platform and one for the
// problem inside it, so tests need a deterministic sequence.
const sequence = (...values) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
};

test('parses Luogu public list with native levels and complete tag preset names', () => {
  const html = `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 1, result: [
    { pid: 'P1000', name: ' 超级玛丽游戏 ', difficulty: 1, tags: [2, 999] },
    { pid: '../bad', name: 'ignored', difficulty: 8, tags: [] }
  ] } } })}</script>`;
  const parsed = parseLuoguProblemList(html);
  assert.equal(parsed.count, 1);
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].id, 'LG:P1000');
  assert.equal(parsed.problems[0].title, '超级玛丽游戏');
  assert.equal(parsed.problems[0].url, 'https://www.luogu.com.cn/problem/P1000');
  assert.equal(parsed.problems[0].luoguDifficulty, '入门');
  assert.equal(parsed.problems[0].rating, null);
  assert.equal(parsed.problems[0].estimatedLuoguDifficulty, null);
  assert.deepEqual(parsed.problems[0].tags, ['字符串', '洛谷标签#999']);
  const presetTagId = Number(require('../ui/tag-presets.js').categories.flatMap(category => category.tags).find(tag => tag.name === '背包 DP').id);
  const completeCatalog = parseLuoguProblemList(`<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 1, result: [{ pid: 'P1001', name: 'Catalog tag', difficulty: 2, tags: [presetTagId] }] } } })}</script>`);
  assert.deepEqual(completeCatalog.problems[0].tags, ['背包 DP']);
  assert.throws(() => parseLuoguProblemList('<html></html>'), /缺少公开数据/);
});

test('parses anonymous LeetCode list, real numeric IDs, free-only and estimated difficulty', () => {
  const payload = { data: { problemsetQuestionList: { total: 2, questions: [
    { frontendQuestionId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy', paidOnly: false, topicTags: [{ name: 'Array' }] },
    { frontendQuestionId: '42', title: 'Trapping Rain Water', titleSlug: 'trapping-rain-water', difficulty: 'Hard', paidOnly: false, topicTags: [] },
    { frontendQuestionId: '999', title: 'Premium', titleSlug: 'premium', difficulty: 'Medium', paidOnly: true, topicTags: [] },
    { frontendQuestionId: 'LCP 01', title: 'Bad ID', titleSlug: 'bad-id', difficulty: 'Easy', paidOnly: false, topicTags: [] }
  ] } } };
  const problems = parseLeetCode(payload);
  assert.deepEqual(problems.map(problem => problem.id), ['LC:1', 'LC:42']);
  assert.equal(problems[0].title, 'Two Sum');
  assert.equal(problems[0].url, 'https://leetcode.com/problems/two-sum/');
  assert.deepEqual([problems[0].estimatedCfRating, problems[1].estimatedCfRating], [1000, 2200]);
  assert.equal(problems[0].rating, null);
  assert.deepEqual(problems[0].tags, ['Array']);
  assert.deepEqual(['Easy', 'Medium', 'Hard', 'unknown'].map(estimateLeetCodeRating), [1000, 1600, 2200, null]);
  assert.throws(() => parseLeetCode({ data: { problemsetQuestionList: { questions: null } } }));
});

test('normalizes API shape and rating boundaries', () => {
  const problems = parseCodeforces(payload);
  assert.equal(problems.length, 2);
  assert.deepEqual(problems[0].tags, ['dp', 'graphs']);
  assert.equal(problems[0].url, 'https://codeforces.com/problemset/problem/1/A');
  assert.equal(problems[1].difficulty, null);
  assert.deepEqual([800, 1200, 1600, 2000, 2400, null].map(codeforcesDifficulty), [1, 2, 3, 4, 5, null]);
  assert.throws(() => parseCodeforces({ status: 'FAILED' }));
});

test('matches algorithm tag aliases in both directions and complete Luogu preset tags', async () => {
  const records = [
    { kind: 'local', platform: 'CF', pid: '1A', title: 'DP label', problemUrl: 'https://codeforces.com/problemset/problem/1/A', tags: ['动态规划 DP'] },
    { kind: 'local', platform: 'LG', pid: 'P1001', title: 'Luogu preset label', problemUrl: 'https://www.luogu.com.cn/problem/P1001', tags: ['背包 DP'] }
  ];
  const noFetch = async () => { throw new Error('local source must not fetch'); };
  assert.equal((await dailyDraw({ source: 'local', platform: 'CF', tags: ['dp'] }, records, noFetch, () => 0)).problem.id, 'CF:1A');
  assert.equal((await dailyDraw({ source: 'local', platform: 'CF', tags: ['动态规划'] }, records, noFetch, () => 0)).problem.id, 'CF:1A');
  assert.equal((await dailyDraw({ source: 'local', platform: 'LG', tags: ['背包 DP'] }, records, noFetch, () => 0)).problem.id, 'LG:P1001');
});

test('uses stored source difficulty metadata for estimates and bounded draws', async () => {
  const records = [
    { kind: 'local', platform: 'LC', pid: '1', title: 'Easy', problemUrl: 'https://leetcode.com/problems/easy/', difficulty: 'Easy' },
    { kind: 'local', platform: 'LC', pid: '2', title: 'Hard', problemUrl: 'https://leetcode.com/problems/hard/', difficulty: 'Hard' },
    { kind: 'local', platform: 'AT', pid: 'a', title: 'AtCoder', problemUrl: 'https://atcoder.jp/contests/abc/tasks/a', communityDifficulty: 123 },
    { kind: 'local', platform: 'LOJ', pid: '1', title: 'Unknown', problemUrl: 'https://loj.ac/p/1' }
  ];
  const noFetch = async () => { throw new Error('unexpected network'); };
  const easy = await dailyDraw({ source: 'local', platform: 'LC', ratingMin: 1000, ratingMax: 1000 }, records, noFetch, () => 0);
  const hard = await dailyDraw({ source: 'local', platform: 'LC', ratingMin: 2200, ratingMax: 2200 }, records, noFetch, () => 0);
  assert.equal(easy.problem.rating, null);
  assert.equal(easy.problem.estimatedCfRating, 1000);
  assert.equal(hard.problem.estimatedCfRating, 2200);
  assert.match(easy.problem.ratingEstimateReason, /低置信度.*力扣原生难度/);
  const at = await dailyDraw({ source: 'local', platform: 'AT', ratingMin: 900, ratingMax: 900 }, records, noFetch, () => 0);
  assert.match(at.problem.ratingEstimateReason, /低置信度.*社区难度 123/);
  await assert.rejects(dailyDraw({ source: 'local', platform: 'LOJ', ratingMin: 1 }, records, noFetch), /没有符合条件/);
});

test('filters tags, unknown difficulty, excluded IDs and duplicates', () => {
  const p = parseCodeforces(payload);
  assert.deepEqual(filterProblems([...p, ...p], { tags: ['DP'], minDifficulty: 1 }), [p[0]]);
  assert.deepEqual(filterProblems(p, { excludedIds: [p[0].id] }), [p[1]]);
  assert.equal(selectProblem(p, { sourceWeights: { codeforces: 0 } }), null);
  assert.equal(selectProblem([...p, ...p], {}, () => 0.75), p[1]);
  assert.throws(() => selectProblem(p, {}, () => 1), RangeError);
});

test('recovers stored LOJ estimates from local/cache and preserves native values first', async () => {
  const records = [
    { kind: 'local', platform: 'LOJ', pid: 'known', title: 'Estimated LOJ', problemUrl: 'https://loj.ac/p/100', estimatedCfRating: 1700, estimatedLuoguDifficulty: '提高', ratingEstimateReason: '统计估值说明', tags: [] },
    { kind: 'document', platform: 'LOJ', pid: 'unknown', title: 'Unknown LOJ', problemUrl: 'https://loj.ac/p/101', tags: [] }
  ];
  const noFetch = async () => { throw new Error('local source must not fetch'); };
  const byRating = await dailyDraw({ source: 'local', platform: 'LOJ', ratingMin: 1700, ratingMax: 1700 }, records, noFetch, () => 0);
  assert.equal(byRating.problem.estimatedCfRating, 1700);
  assert.equal(byRating.problem.estimatedLuoguDifficulty, '提高');
  assert.equal(byRating.problem.ratingEstimateReason, '统计估值说明');
  const byLevel = await dailyDraw({ source: 'local', platform: 'LOJ', luoguDifficulty: '提高' }, records, noFetch, () => 0);
  assert.equal(byLevel.problem.id, 'LOJ:KNOWN');
  await assert.rejects(dailyDraw({ source: 'local', platform: 'LOJ', ratingMin: 1700 }, [records[1]], noFetch), /没有符合条件/);
});

test('retains stored Luogu estimates when native difficulty is absent', async () => {
  const records = [{ kind: 'local', platform: 'LG', pid: 'P2000', title: 'Stored estimate', problemUrl: 'https://www.luogu.com.cn/problem/P2000', estimatedCfRating: 1800, ratingEstimateReason: '已保存的低置信度估算' }];
  const result = await dailyDraw({ source: 'local', ratingMin: 1800, ratingMax: 1800, luoguDifficulty: '提高' }, records, async () => { throw new Error('unused'); }, () => 0);
  assert.equal(result.problem.id, 'LG:P2000');
  assert.equal(result.problem.estimatedCfRating, 1800);
  assert.equal(result.problem.estimatedLuoguDifficulty, '提高');
  assert.equal(result.problem.ratingEstimateReason, '已保存的低置信度估算');
});

test('all-source rating and level filters retain eligible records from every supported platform', async () => {
  const records = [
    { kind: 'local', platform: 'CF', pid: '100A', title: 'CF', problemUrl: 'https://codeforces.com/problemset/problem/100/A', rating: 1800 },
    { kind: 'local', platform: 'LG', pid: 'P2000', title: 'LG', problemUrl: 'https://www.luogu.com.cn/problem/P2000', luoguDifficulty: '提高' },
    { kind: 'local', platform: 'AT', pid: 'abc100_a', title: 'AT', problemUrl: 'https://atcoder.jp/contests/abc100/tasks/abc100_a', communityDifficulty: 900 },
    { kind: 'local', platform: 'NC', pid: '100', title: 'NC', problemUrl: 'https://ac.nowcoder.com/acm/problem/100', communityDifficulty: 3 },
    { kind: 'local', platform: 'LC', pid: '100', title: 'LC', problemUrl: 'https://leetcode.com/problems/same-tree/', difficulty: 'Medium' },
    { kind: 'local', platform: 'LOJ', pid: '100', title: 'LOJ', problemUrl: 'https://loj.ac/p/100', estimatedCfRating: 1700, ratingEstimateReason: '低置信度提交统计估算' }
  ];
  const offline = async () => { throw new Error('controlled offline source'); };
  for (const target of records) {
    const excludedIds = records.filter(record => record !== target).map(record => record.problemUrl);
    const result = await dailyDraw({ source: 'all', ratingMin: 1600, ratingMax: 1899, luoguDifficulty: '提高', excludedIds }, records, offline, () => 0);
    assert.equal(result.problem.source, target.platform);
    assert.equal(result.problem.url, target.problemUrl);
    const comparable = result.problem.rating ?? result.problem.estimatedCfRating;
    assert.ok(comparable >= 1600 && comparable <= 1899);
  }
});

test('draws from the local library without any network access', async () => {
  const library = {
    builtAt: '2026-11-20T07:00:00.000Z',
    records: [
      { id: 'CF:1A', title: 'CF problem', source: 'CF', origin: 'library', url: 'https://codeforces.com/problemset/problem/1/A', rating: 1200, estimatedCfRating: null, estimatedLuoguDifficulty: '提高', luoguDifficulty: '', tags: ['二分'] },
      { id: 'LG:P1000', title: 'LG problem', source: 'LG', origin: 'library', url: 'https://www.luogu.com.cn/problem/P1000', rating: null, estimatedCfRating: 900, estimatedLuoguDifficulty: null, luoguDifficulty: '入门', tags: [] }
    ]
  };
  const offline = async () => { throw new Error('library draws must not fetch'); };
  const all = await dailyDraw({ source: 'all' }, [], offline, () => 0, undefined, library);
  assert.equal(all.problem.source, 'CF');
  assert.match(all.note, /本地题库索引 2 题（更新于 2026-11-20）/);
  assert.equal((await dailyDraw({ source: 'LG' }, [], offline, () => 0, undefined, library)).problem.id, 'LG:P1000');
  assert.equal((await dailyDraw({ tags: ['二分'] }, [], offline, () => 0, undefined, library)).problem.id, 'CF:1A');
  assert.equal((await dailyDraw({ ratingMin: 900, ratingMax: 900 }, [], offline, () => 0, undefined, library)).problem.id, 'LG:P1000');
  await assert.rejects(dailyDraw({ ratingMin: 3000 }, [], offline, () => 0, undefined, library), /没有符合条件/);
  await assert.rejects(dailyDraw({ luoguDifficulty: '省选/NOI-' }, [], offline, () => 0, undefined, library), /没有符合条件/);
});

test('draws from scoped records and reports remote fallback', async () => {
  const records = [{ kind: 'local', platform: 'LG', pid: 'P1000', title: 'Local', problemUrl: 'https://www.luogu.com.cn/problem/P1000', difficulty: '入门', tags: ['动态规划'] }];
  const offline = async () => { throw new Error('offline'); };
  const local = await dailyDraw({ source: 'LG', luoguDifficulty: '入门', tags: ['动态规划'] }, records, offline, () => 0);
  assert.equal(local.problem.title, 'Local');
  const fallback = await dailyDraw({}, records, offline, () => 0);
  assert.match(fallback.note, /offline/);
  const remote = await dailyDraw({ source: 'CF', ratingMin: 800, tags: ['动态规划'] }, [], async () => ({ ok: true, json: async () => payload }), () => 0);
  assert.equal(remote.problem.id, 'CF:1A');
  await assert.rejects(dailyDraw({ source: 'LG', ratingMin: 1000 }, records, offline), /没有符合条件/);
  const estimated = await dailyDraw({ source: 'local', platform: 'LG', ratingMin: 900, ratingMax: 900, tags: ['动态规划'] }, records, offline, () => 0);
  assert.equal(estimated.problem.estimatedCfRating, 900);
  assert.equal(estimated.problem.rating, null);
  assert.match(estimated.note, /启发式估算/);
  await assert.rejects(dailyDraw({ ratingMin: 2000, ratingMax: 1000 }, [], offline), /评分/);
});

test('redraw excludes the current ID across cached and remote copies before weighting', async () => {
  const records = [
    { kind: 'local', platform: 'CF', pid: 'CF1A', title: 'Current local', problemUrl: 'https://codeforces.com/problemset/problem/1/A', rating: 800, tags: ['dp'] },
    { kind: 'document', platform: 'CF', pid: '1A', title: 'Current cached', problemUrl: 'https://codeforces.com/problemset/problem/1/A', rating: 800, tags: ['dp'] }
  ];
  const fetcher = async () => ({ ok: true, json: async () => payload });
  for (const value of [0, 0.5, 0.999]) {
    const result = await dailyDraw({ source: 'CF', excludedIds: ['CF:1A'] }, records, fetcher, () => value);
    assert.equal(result.problem.id, 'CF:1B');
  }
  assert.equal((await dailyDraw({ source: 'CF' }, records, fetcher, () => 0)).problem.id, 'CF:1A', 'ordinary draws can still return the current problem');
  await assert.rejects(dailyDraw({ source: 'CF', ratingMin: 800, tags: ['动态规划'], excludedIds: ['CF:1A'] }, records, fetcher), /没有其他符合条件的题目/);
});

test('redraw supports URL-only records and does not fall back to an excluded singleton', async () => {
  const records = [
    { kind: 'local', platform: 'LG', title: 'Current', problemUrl: 'https://www.luogu.com.cn/problem/P1000', tags: [] },
    { kind: 'local', platform: 'LG', pid: 'P1001', title: 'Other', problemUrl: 'https://www.luogu.com.cn/problem/P1001', tags: [] }
  ];
  const offline = async () => { throw new Error('offline'); };
  assert.equal((await dailyDraw({ source: 'local', excludedIds: [records[0].problemUrl] }, records, offline, () => 0)).problem.id, 'LG:P1001');
  await assert.rejects(dailyDraw({ source: 'local', excludedIds: [records[0].problemUrl] }, records.slice(0, 1), offline, () => { throw new Error('must not sample an empty pool'); }), /没有其他符合条件的题目/);
  await assert.rejects(dailyDraw({ source: 'LG', excludedIds: [records[0].problemUrl] }, records.slice(0, 1), offline), /没有其他符合条件的题目.*offline/);
});

test('validates exclusion lists at the service boundary before fetching', async () => {
  const unexpectedFetch = async () => { throw new Error('must not fetch'); };
  for (const excludedIds of [null, 'CF:1A', [1], [''], ['  '], ['x'.repeat(2049)], Array(101).fill('CF:1A')]) {
    await assert.rejects(dailyDraw({ excludedIds }, [], unexpectedFetch), /排除题目格式不正确/);
  }
  const records = [{ kind: 'local', platform: 'CF', pid: '1A', title: 'Current', problemUrl: 'https://codeforces.com/problemset/problem/1/A', tags: [] }];
  assert.equal((await dailyDraw({ source: 'local', excludedIds: [] }, records, unexpectedFetch, () => 0)).problem.id, 'CF:1A');
  await assert.rejects(dailyDraw({ source: 'local', excludedIds: [' CF:1A ', 'CF:1A'] }, records, unexpectedFetch), /没有其他符合条件的题目/);
});

test('separates local and public sources and preserves estimated difficulty', async () => {
  const records = [
    { kind: 'local', platform: 'LOJ', pid: '100', title: 'Private', problemUrl: 'https://loj.ac/p/100', tags: [] },
    { kind: 'document', platform: 'LOJ', pid: '101', title: 'Public', problemUrl: 'https://loj.ac/p/101', tags: [] }
  ];
  const offline = async () => { throw new Error('should not fetch'); };
  assert.equal((await dailyDraw({ source: 'local', platform: 'LOJ' }, records, offline, () => 0)).problem.title, 'Private');
  assert.equal((await dailyDraw({ source: 'public', platform: 'LOJ' }, records, offline, () => 0)).problem.title, 'Private');
  assert.equal((await dailyDraw({ source: 'public', platform: 'LOJ' }, records, offline, () => 0.75)).problem.title, 'Public');
  await assert.rejects(dailyDraw({ source: 'public', platform: 'CF' }, [], offline), /没有符合条件/);
  await assert.rejects(dailyDraw({ source: 'all', platform: 'LOJ' }, [], offline), /should not fetch/);
  const result = await dailyDraw({ source: 'all', platform: 'CF', luoguDifficulty: '入门' }, [], async () => ({ ok: true, json: async () => payload }), () => 0);
  assert.equal(result.problem.estimatedLuoguDifficulty, '入门');
  assert.equal(result.problem.luoguDifficulty, '');
});

test('draws a platform uniformly before choosing a problem inside it', async () => {
  const records = [
    { kind: 'local', platform: 'LG', pid: 'P1', title: 'Local', problemUrl: 'https://www.luogu.com.cn/problem/P1', tags: [] },
    { kind: 'document', platform: 'LG', pid: 'P2', title: 'Cached', problemUrl: 'https://www.luogu.com.cn/problem/P2', tags: [] }
  ];
  const remote = async () => ({ ok: true, json: async () => ({ status: 'OK', result: { problems: [payload.result.problems[0]] } }) });
  assert.equal((await dailyDraw({ source: 'all' }, records, remote, sequence(0, 0))).problem.title, 'Local');
  assert.equal((await dailyDraw({ source: 'all' }, records, remote, sequence(0, 0.9))).problem.title, 'Cached');
  assert.equal((await dailyDraw({ source: 'all' }, records, remote, sequence(0.9, 0))).problem.source, 'CF');
  assert.equal((await dailyDraw({ source: 'CF' }, records, remote, () => 0)).problem.source, 'CF');
});

test('two-stage draws give every eligible platform equal probability regardless of pool size', async () => {
  const records = [
    { kind: 'local', platform: 'NC', pid: 'local', title: 'Local', problemUrl: 'https://example.com/local' },
    { kind: 'document', platform: 'LC', pid: 'cache', title: 'Cached', problemUrl: 'https://example.com/cache' }
  ];
  const clist = { fetchProblems: async () => ({ problems: [{ id: 'nc', name: 'NC', url: 'https://example.com/nc', platform: 'nowcoder', rating: 900, tags: [] }], report: { errors: [] } }) };
  const fetcher = async url => {
    if (url.includes('codeforces.com')) return { ok: true, json: async () => ({ status: 'OK', result: { problems: [payload.result.problems[0]] } }) };
    if (url.endsWith('problems.json')) return { ok: true, json: async () => [{ id: 'abc_a', contest_id: 'abc', title: 'AT' }] };
    if (url.endsWith('problem-models.json')) return { ok: true, json: async () => ({}) };
    if (url.includes('leetcode.com')) return { ok: true, json: async () => ({ data: { problemsetQuestionList: { total: 1, questions: [{ frontendQuestionId: '1', title: 'LC', titleSlug: 'one', difficulty: 'Easy', paidOnly: false }] } } }) };
    throw new Error('offline');
  };
  // Bucket order is NC, LC, CF, AT and each platform owns one quarter of the draw.
  assert.equal((await dailyDraw({ source: 'all' }, records, fetcher, sequence(0.1, 0), clist)).problem.title, 'Local');
  assert.equal((await dailyDraw({ source: 'all' }, records, fetcher, sequence(0.1, 0.9), clist)).problem.title, 'NC');
  assert.equal((await dailyDraw({ source: 'all' }, records, fetcher, sequence(0.3, 0), clist)).problem.title, 'Cached');
  assert.equal((await dailyDraw({ source: 'all' }, records, fetcher, sequence(0.3, 0.9), clist)).problem.title, 'LC');
  assert.equal((await dailyDraw({ source: 'all' }, records, fetcher, sequence(0.6, 0), clist)).problem.source, 'CF');
  assert.equal((await dailyDraw({ source: 'all' }, records, fetcher, sequence(0.9, 0), clist)).problem.source, 'AT');
  // A specified platform narrows the draw to one bucket and stays uniform inside it.
  assert.equal((await dailyDraw({ source: 'all', platform: 'NC' }, records, fetcher, sequence(0.2), clist)).problem.title, 'Local');
  assert.equal((await dailyDraw({ source: 'all', platform: 'NC' }, records, fetcher, sequence(0.8), clist)).problem.title, 'NC');
  assert.equal((await dailyDraw({ source: 'NC' }, records, fetcher, sequence(0.2), clist)).problem.title, 'Local');
  assert.equal((await dailyDraw({ source: 'NC' }, records, fetcher, sequence(0.8), clist)).problem.title, 'NC');
});

test('AtCoder directory uses community estimates, unknowns and filters', async () => {
  const directory = [{ id: 'abc100_a', contest_id: 'abc100', title: 'A. Happy Birthday!' }, { id: 'abc100_b', contest_id: 'abc100', title: 'B. Ringo' }, { id: '../bad', contest_id: 'abc100', title: 'bad' }];
  const models = { abc100_a: { difficulty: 123 }, abc100_b: {} };
  const fetcher = async url => ({ ok: true, json: async () => url.endsWith('problems.json') ? directory : models });
  const rated = await dailyDraw({ source: 'AT', communityDifficultyMin: 100 }, [], fetcher, () => 0);
  assert.equal(rated.problem.communityDifficulty, 123);
  assert.match(rated.note, /社区估算难度/);
  assert.equal(rated.problem.rating, null);
  assert.equal(rated.problem.estimatedCfRating, 900);
  assert.equal(rated.problem.estimatedLuoguDifficulty, '入门');
  assert.match(rated.note, /启发式/);
  assert.equal((await dailyDraw({ source: 'AT', ratingMin: 900, ratingMax: 900, luoguDifficulty: '入门' }, [], fetcher, () => 0)).problem.id, 'AT:ABC100_A');
  await assert.rejects(dailyDraw({ source: 'AT', ratingMin: 901 }, [], fetcher), /没有符合条件/);
  assert.equal(rated.problem.url, 'https://atcoder.jp/contests/abc100/tasks/abc100_a');
  const unknown = await dailyDraw({ source: 'AT' }, [], fetcher, () => 0.75);
  assert.equal(unknown.problem.communityDifficulty, null);
  assert.match(unknown.note, /未知/);
  await assert.rejects(dailyDraw({ source: 'AT', communityDifficultyMin: 200 }, [], fetcher), /没有符合条件/);
  const partial = async url => { if (url.endsWith('problem-models.json')) throw Error('offline'); return { ok: true, json: async () => directory }; };
  const fallback = await dailyDraw({ source: 'AT' }, [], partial, () => 0);
  assert.match(fallback.note, /难度获取失败/);
  await assert.rejects(dailyDraw({ source: 'AT' }, [], async () => { throw Error('offline'); }), /题库获取失败/);
});

test('fetches Luogu listing pages and warns when the bounded sample is incomplete', async () => {
  const requests = [];
  const result = await fetchLuoguProblems(async url => {
    requests.push(url);
    const page = Number(new URL(url).searchParams.get('page'));
    const text = `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: {
      count: 151, result: [{ pid: `P${page}`, name: `Problem ${page}`, difficulty: page, tags: [] }]
    } } })}</script>`;
    return { ok: true, text: async () => text };
  }, 15000, () => 0.99);
  assert.equal(requests.length, 3);
  assert.deepEqual(requests.map(url => Number(new URL(url).searchParams.get('page'))), [1, 4, 3]);
  assert.equal(result.problems.length, 3);
  assert.equal(result.problems[0].luoguDifficulty, '入门');
  assert.match(result.errors.join(' '), /抽样 3 题（共 151 题）/);
  const partialPages = await fetchLuoguProblems(async url => {
    const page = Number(new URL(url).searchParams.get('page'));
    if (page === 4) throw new TypeError("Failed to fetch: Attempted to redirect, but redirect policy was 'error'");
    const text = `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 151, result: [{ pid: `P${page}`, name: `Problem ${page}`, difficulty: 1, tags: [] }] } } })}</script>`;
    return { ok: true, text: async () => text };
  }, 15000, () => 0.99);
  assert.equal(partialPages.problems.length, 2);
  assert.match(partialPages.errors.join(' '), /第 4 页获取失败（公开页面返回 HTTP 重定向，匿名请求未跟随）/);
  resetLuoguSnapshot();
  const failed = await fetchLuoguProblems(async () => ({ ok: false, status: 403 }));
  assert.equal(failed.problems.length, 0);
  assert.match(failed.errors[0], /第 1 页获取失败（HTTP 403）/);
  const redirect = await fetchLuoguProblems(async () => { throw new TypeError("Failed to fetch: Attempted to redirect, but redirect policy was 'error'"); });
  assert.equal(redirect.problems.length, 0);
  assert.match(redirect.errors[0], /第 1 页获取失败（公开页面返回 HTTP 重定向，匿名请求未跟随）/);
});

test('reuses the last Luogu snapshot when the listing is challenged', async () => {
  const html = `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 1, result: [{ pid: 'P3000', name: 'Snapshot', difficulty: 1, tags: [] }] } } })}</script>`;
  const served = await fetchLuoguProblems(async () => ({ ok: true, text: async () => html }), 15000, () => 0);
  assert.equal(served.problems.length, 1);
  assert.deepEqual(served.errors, []);
  const blocked = async () => { throw new TypeError("Failed to fetch: Attempted to redirect, but redirect policy was 'error'"); };
  const fallback = await fetchLuoguProblems(blocked, 15000, () => 0);
  assert.equal(fallback.problems.length, 1);
  assert.equal(fallback.problems[0].id, 'LG:P3000');
  assert.match(fallback.errors[0], /使用约 \d+ 秒前的题库快照/);
  const drawn = await dailyDraw({ source: 'LG' }, [], blocked, () => 0);
  assert.equal(drawn.problem.id, 'LG:P3000');
  assert.match(drawn.note, /题库快照/);
});

test('draws from the public Luogu source and filters on native difficulty', async () => {
  const html = `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 1,
    result: [{ pid: 'P1000', name: 'Sample', difficulty: 1, tags: [3] }]
  } } })}</script>`;
  const result = await dailyDraw({ source: 'LG', luoguDifficulty: '入门', tags: ['动态规划'] }, [], async () => ({ ok: true, text: async () => html }), () => 0);
  assert.equal(result.problem.id, 'LG:P1000');
  assert.equal(result.problem.source, 'LG');
});

test('Luogu estimates and filters native levels without inventing unknown ratings', async () => {
  const html = `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 3, result: [
    { pid: 'P1002', name: '过河卒', difficulty: 3, tags: [3] },
    { pid: 'P1003', name: '铺地毯', difficulty: 2, tags: [1] },
    { pid: 'P1004', name: '未知', difficulty: 0, tags: [3] }
  ] } } })}</script>`;
  const fetcher = async () => ({ ok: true, text: async () => html });
  const result = await dailyDraw({ source: 'LG', ratingMin: 1300, ratingMax: 1300, luoguDifficulty: '普及/提高-', tags: ['动态规划'] }, [], fetcher, () => 0);
  assert.equal(result.problem.id, 'LG:P1002');
  assert.equal(result.problem.rating, null);
  assert.equal(result.problem.estimatedCfRating, 1300);
  assert.match(result.note, /非官方等价/);
  assert.equal((await dailyDraw({ source: 'LG', luoguDifficulty: '普及-', tags: ['模拟'] }, [], fetcher, () => 0)).problem.id, 'LG:P1003');
  await assert.rejects(dailyDraw({ source: 'LG', ratingMin: 1301, tags: ['动态规划'] }, [], fetcher), /没有符合条件/);
});

test('fetches LeetCode anonymously in pages and applies estimated rating filters', async () => {
  const pages = [
    { data: { problemsetQuestionList: { total: 1001, questions: [{ frontendQuestionId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy', paidOnly: false, topicTags: [] }] } } },
    { data: { problemsetQuestionList: { total: 1001, questions: [{ frontendQuestionId: '42', title: 'Hard Problem', titleSlug: 'hard-problem', difficulty: 'Hard', paidOnly: false, topicTags: [] }] } } }
  ];
  const requests = [];
  const fetched = await fetchLeetCodeProblems(async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) });
    const page = requests.length - 1;
    return { ok: true, json: async () => pages[page] };
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(request => request.body.variables.skip), [0, 1000]);
  assert.equal(requests[0].url, 'https://leetcode.com/graphql/');
  assert.equal(requests[0].init.credentials, 'omit');
  assert.equal(fetched.problems.length, 2);
  const hard = await dailyDraw({ source: 'LC', ratingMin: 2200, ratingMax: 2200 }, [], async () => ({ ok: true, json: async () => pages[1] }), () => 0);
  assert.equal(hard.problem.id, 'LC:42');
  assert.match(hard.note, /启发式/);
});

test('draws Nowcoder problems with a marked origin and explicit estimated rating', async () => {
  const uuid = '75e878df47f24fdc9dc3e400ec6058ca';
  const responseFor = (topicId, difficulty) => ({ msg: 'OK', code: 0, data: { totalPage: 1, totalCount: 1, questions: [{ tpId: topicId, questionId: 23286, questionNo: 'BM1', questionTitle: '反转链表', questionUUid: uuid, difficulty, acceptRate: 40.4, tags: [{ name: '链表' }] }] } });
  const fetcher = async url => {
    const topicId = Number(new URL(url).searchParams.get('topicId'));
    return { ok: true, json: async () => responseFor(topicId, topicId === 295 ? 2 : null) };
  };
  const mapped = await dailyDraw({ source: 'NC', ratingMin: 1200, ratingMax: 1200 }, [], fetcher, () => 0);
  assert.equal(mapped.problem.id, 'NC:295:23286');
  assert.equal(mapped.problem.source, 'NC');
  assert.equal(mapped.problem.origin, 'nowcoder');
  assert.notEqual(mapped.problem.origin, 'public');
  assert.equal(mapped.problem.rating, null);
  assert.equal(mapped.problem.communityDifficulty, 2);
  assert.equal(mapped.problem.estimatedCfRating, 1200);
  assert.match(mapped.note, /1=800、2=1200/);
  await assert.rejects(dailyDraw({ source: 'NC', ratingMin: 1 }, [], async url => ({ ok: true, json: async () => responseFor(Number(new URL(url).searchParams.get('topicId')), null) })), /没有符合条件/);
  const unfilteredUnknown = await dailyDraw({ source: 'NC' }, [], async url => ({ ok: true, json: async () => responseFor(Number(new URL(url).searchParams.get('topicId')), null) }), () => 0);
  assert.equal(unfilteredUnknown.problem.estimatedCfRating, null);
  assert.match(unfilteredUnknown.note, /难度未知/);
});

test('uses injected CLIST only for LG/NC/all without tags and never for local/public or tagged draws', async () => {
  const records = [{ kind: 'local', platform: 'LG', pid: 'P1', title: 'Local', problemUrl: 'https://www.luogu.com.cn/problem/P1', tags: ['图论'] }];
  let calls = 0;
  const clist = { fetchProblems: async filter => { calls += 1; assert.equal(filter.resource, 'luogu.com.cn'); return { problems: [{ id: 'clist-1', name: 'CLIST LG', url: 'https://www.luogu.com.cn/problem/P2', platform: 'luogu', rating: 1200, tags: [], tagsKnown: true }], report: { requested: 1, accepted: 1, rejected: 0, pages: [0], errors: [], durationMs: 0 } }; } };
  const noFetch = async () => { throw new Error('must not fetch'); };
  const clistResult = await dailyDraw({ source: 'LG' }, [], noFetch, () => 0, clist);
  assert.equal(clistResult.problem.title, 'CLIST LG');
  assert.equal(clistResult.problem.origin, 'clist-luogu');
  assert.match(clistResult.note, /候选来源：CLIST 洛谷题库/);
  assert.equal(calls, 1);
  assert.equal((await dailyDraw({ source: 'LG', tags: ['图论'] }, records, noFetch, () => 0, clist)).problem.title, 'Local');
  assert.equal(calls, 1);
  assert.equal((await dailyDraw({ source: 'local', platform: 'LG' }, records, noFetch, () => 0, clist)).problem.title, 'Local');
  assert.equal(calls, 1);
  assert.equal((await dailyDraw({ source: 'public', platform: 'LG' }, records, noFetch, () => 0, clist)).problem.title, 'Local');
  assert.equal(calls, 1);
  const allResources = [];
  const all = await dailyDraw({ source: 'all' }, [], noFetch, () => 0, { fetchProblems: async filter => {
    calls += 1; allResources.push(filter.resource);
    const isLuogu = filter.resource === 'luogu.com.cn';
    return { problems: [{ id: isLuogu ? 'clist-2' : 'clist-3', name: isLuogu ? 'CLIST LG' : 'CLIST NC', url: isLuogu ? 'https://www.luogu.com.cn/problem/P3' : 'https://ac.nowcoder.com/acm/problem/123', platform: isLuogu ? 'luogu' : 'nowcoder', rating: 900, tags: [], tagsKnown: true }], report: { requested: 1, accepted: 1, rejected: 0, pages: [0], errors: [], durationMs: 0 } };
  } });
  assert.deepEqual(allResources, ['luogu.com.cn', 'ac.nowcoder.com']);
  assert.equal(calls, 3);
  assert.equal(all.problem.source, 'LG');
  assert.equal(all.problem.origin, 'clist-luogu');
  assert.match(all.note, /候选来源：CLIST 洛谷题库/);
});

test('requests the Nowcoder CLIST resource for the NC daily source', async () => {
  let requested;
  const clist = { fetchProblems: async filter => { requested = filter.resource; return { problems: [{ id: 'nc-1', name: 'CLIST NC', url: 'https://ac.nowcoder.com/acm/problem/123', platform: 'nowcoder', rating: 1200, tags: [], tagsKnown: true }], report: { requested: 1, accepted: 1, rejected: 0, pages: [0], errors: [], durationMs: 0 } }; } };
  const result = await dailyDraw({ source: 'NC' }, [], async () => { throw new Error('CLIST should be used'); }, () => 0, clist);
  assert.equal(requested, 'ac.nowcoder.com');
  assert.equal(result.problem.source, 'NC');
});

test('applies Luogu difficulty and remaining filters to CLIST candidates', async () => {
  const clist = { fetchProblems: async filter => {
    assert.deepEqual(filter, { resource: 'luogu.com.cn' });
    return { problems: [
      { id: 'P1002', name: 'Matching', url: 'https://www.luogu.com.cn/problem/P1002', platform: 'luogu', rating: 1300, tags: [], tagsKnown: true },
      { id: 'P1003', name: 'Wrong rating', url: 'https://www.luogu.com.cn/problem/P1003', platform: 'luogu', rating: 1400, tags: [], tagsKnown: true }
    ], report: { requested: 2, accepted: 2, rejected: 0, pages: [0], errors: [], durationMs: 0 } };
  } };
  const result = await dailyDraw({ source: 'LG', ratingMin: 1300, ratingMax: 1300, luoguDifficulty: '普及' }, [], async () => { throw new Error('fallback source should not be required'); }, () => 0, clist);
  assert.equal(result.problem.id, 'LG:P1002');
  assert.equal(result.problem.estimatedLuoguDifficulty, '普及');
});

test('retains native and estimated Luogu-level matching for directed remote sources', async () => {
  const luogu = { fetchProblems: async () => ({ problems: [
    { id: 'exact', name: 'Matching native level', url: 'https://www.luogu.com.cn/problem/P2001', platform: 'luogu', rating: 1700, tags: [], tagsKnown: true }
  ], report: { requested: 1, accepted: 1, rejected: 0, rejectionCategories: {}, pages: [0], errors: [], durationMs: 0 } }) };
  const nativeRecords = [
    { kind: 'local', platform: 'LG', pid: 'P2001', title: 'Exact native', problemUrl: 'https://www.luogu.com.cn/problem/P2001', luoguDifficulty: '普及+/提高-', tags: [] },
    { kind: 'local', platform: 'LG', pid: 'P2002', title: 'Different native', problemUrl: 'https://www.luogu.com.cn/problem/P2002', luoguDifficulty: '提高', tags: [] },
    { kind: 'local', platform: 'LG', pid: 'P2005', title: 'Unknown native', problemUrl: 'https://www.luogu.com.cn/problem/P2005', luoguDifficulty: '暂无评定', tags: [] }
  ];
  const exact = await dailyDraw({ source: 'local', platform: 'LG', luoguDifficulty: '普及+/提高-' }, nativeRecords, async () => { throw new Error('unused'); }, () => 0);
  assert.equal(exact.problem.id, 'LG:P2001');
  assert.equal((await dailyDraw({ source: 'local', platform: 'LG', luoguDifficulty: '提高' }, nativeRecords, async () => { throw new Error('unused'); }, () => 0)).problem.id, 'LG:P2002');
  assert.equal((await dailyDraw({ source: 'local', platform: 'LG', luoguDifficulty: '暂无评定' }, nativeRecords, async () => { throw new Error('unused'); }, () => 0)).problem.id, 'LG:P2005');
  await assert.rejects(dailyDraw({ source: 'local', platform: 'LG', luoguDifficulty: '提高' }, [nativeRecords[2]], async () => { throw new Error('unused'); }), /没有符合条件/);
  assert.equal((await dailyDraw({ source: 'LG', luoguDifficulty: '普及+/提高' }, [], async () => ({ ok: true, text: async () => `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 2, result: [{ pid: 'P2003', name: 'Native level A', difficulty: 4, tags: [] }, { pid: 'P2004', name: 'Native level B', difficulty: 4, tags: [] }] } } })}</script>` }), () => 0)).problem.id, 'LG:P2003');
  await assert.rejects(dailyDraw({ source: 'LG', luoguDifficulty: '提高+/省选-' }, [], async () => ({ ok: true, text: async () => `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 1, result: [{ pid: 'P2003', name: 'Native level A', difficulty: 4, tags: [] }] } } })}</script>` }), () => 0), /没有符合条件/);
  const ncEstimate = { fetchProblems: async () => ({ problems: [{ id: 'nc-estimated', name: 'NC estimated', url: 'https://ac.nowcoder.com/acm/problem/123', platform: 'nowcoder', rating: 1700, tags: [], tagsKnown: true }], report: { requested: 1, accepted: 1, rejected: 0, rejectionCategories: {}, pages: [0], errors: [], durationMs: 0 } }) };
  const estimated = await dailyDraw({ source: 'NC', luoguDifficulty: '提高' }, [], async () => { throw new Error('unused'); }, () => 0, ncEstimate);
  assert.equal(estimated.problem.estimatedLuoguDifficulty, '提高');
  assert.equal((await dailyDraw({ source: 'NC', luoguDifficulty: '提高' }, [], async () => { throw new Error('unused'); }, () => 0, ncEstimate)).problem.source, 'NC');
  await assert.rejects(dailyDraw({ source: 'NC', luoguDifficulty: '省选/NOI-' }, [], async () => { throw new Error('unused'); }, () => 0, ncEstimate), /没有符合条件/);
  const html = `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 1, result: [{ pid: 'P2001', name: 'Matching native level', difficulty: 4, tags: [] }] } } })}</script>`;
  const clistResult = await dailyDraw({ source: 'LG', luoguDifficulty: '普及+/提高' }, [], async () => ({ ok: true, text: async () => html }), () => 0);
  assert.equal(clistResult.problem.id, 'LG:P2001');
  assert.equal(clistResult.problem.estimatedLuoguDifficulty, null);
  await assert.rejects(dailyDraw({ source: 'LG', luoguDifficulty: '提高' }, [], async () => ({ ok: true, text: async () => html }), () => 0), /没有符合条件/);
});

test('falls back to original source and preserves CLIST and source failure notices', async () => {
  const html = `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count: 1, result: [{ pid: 'P1000', name: 'Fallback', difficulty: 1, tags: [] }] } } })}</script>`;
  const fallbackFetcher = async url => {
    assert.match(String(url), /luogu\.com\.cn\/problem\/list/);
    return { ok: true, text: async () => html };
  };
  const clistFailure = { fetchProblems: async () => { throw new Error('mock CLIST unavailable'); } };
  const fallback = await dailyDraw({ source: 'LG' }, [], fallbackFetcher, () => 0, clistFailure);
  assert.equal(fallback.problem.id, 'LG:P1000');
  assert.match(fallback.note, /CLIST 获取失败：mock CLIST unavailable/);
  resetLuoguSnapshot();
  await assert.rejects(dailyDraw({ source: 'LG', luoguDifficulty: 'NOI' }, [], async () => ({ ok: false, status: 503 }), () => 0, clistFailure), /CLIST 获取失败：mock CLIST unavailable.*洛谷获取提示：第 1 页获取失败（HTTP 503）/);
});

test('returns source errors for HTTP, malformed response and network errors', async () => {
  assert.equal((await fetchDailyProblems(async () => ({ ok: false, status: 429 }))).errors[0].message, 'HTTP 429');
  assert.equal((await fetchDailyProblems(async () => ({ ok: true, json: async () => payload }))).problems.length, 2);
  assert.equal((await fetchDailyProblems(async () => ({ ok: true, json: async () => ({ status: 'FAILED' }) }))).errors.length, 1);
  assert.equal((await fetchDailyProblems(async () => { throw new Error('offline'); })).errors[0].message, 'offline');
});
