'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appPath } = require('./app-path.cjs');
const { parseLibreOJProblems, fetchLibreOJProblems } = require(appPath('electron/libreoj-daily.cjs'));
const { parseLibreOJStatement, fetchLibreOJStatement } = require(appPath('electron/libreoj-statement.cjs'));
const { dailyDraw } = require(appPath('electron/daily-problems.cjs'));
const response = (body, status = 201, type = 'application/json') => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } });
const row = (id = 1) => ({ meta: { id, displayId: id, isPublic: true, submissionCount: 500 }, title: ' A + B ', tags: [{ name: '动态规划' }, { name: '图论' }, { name: '系统测试' }, { name: '动态规划' }, {}] });
const statement = () => ({ meta: { id: 8, displayId: 1, isPublic: true }, localizedContentsOfLocale: { title: 'A + B', contentSections: [{ sectionTitle: '题目描述', type: 'Text', text: '计算 $a+b$。<script>alert(1)</script>' }, { sectionTitle: '样例', type: 'Sample', sampleId: 0, text: '说明' }] }, samples: [{ inputData: '1  2\n<node>&lt;', outputData: '3' }] });
const url = 'https://loj.ac/p/1';

test('LibreOJ validates public list IDs, metadata and tags while leaving unsupported estimates unknown', () => {
  const payload = { count: 10, result: [row(), row(), { ...row(2), meta: { id: 2, displayId: 2, isPublic: false } }, { ...row(3), meta: { id: 3, displayId: '../bad', isPublic: true } }, { ...row(4), title: '' }] };
  const parsed = parseLibreOJProblems(payload);
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].id, 'LOJ:1');
  assert.equal(parsed.problems[0].origin, 'libreoj');
  assert.equal(parsed.problems[0].url, url);
  assert.deepEqual(parsed.problems[0].tags, ['动态规划', 'dp', '图论', 'graphs', '系统测试']);
  for (const field of ['rating', 'communityDifficulty', 'estimatedCfRating', 'estimatedLuoguDifficulty']) assert.equal(parsed.problems[0][field], null);
  for (const bad of [{}, { count: -1, result: [] }, { count: 1.2, result: [] }, { count: 1, result: {} }]) assert.throws(() => parseLibreOJProblems(bad));
});

test('LibreOJ uses sufficiently sampled valid submission counts only for explicitly labelled estimates', () => {
  const withCounts = (id, submissions, accepted) => ({ ...row(id), meta: { ...row(id).meta, submissionCount: submissions, acceptedSubmissionCount: accepted } });
  const inputs = [withCounts(1, 100, 50), withCounts(2, 100, 30), withCounts(3, 100, 15), withCounts(4, 100, 5), withCounts(5, 100, 1), withCounts(6, 99, 50), withCounts(7, 100, 0), withCounts(8, 100, 101), withCounts(9, 100, -1), withCounts(10, 100, 1.5)];
  const problems = parseLibreOJProblems({ count: inputs.length, result: inputs }).problems;
  assert.deepEqual(problems.slice(0, 5).map(p => p.estimatedCfRating), [900, 1300, 1700, 2100, 2500]);
  assert.deepEqual(problems.slice(0, 5).map(p => p.estimatedLuoguDifficulty), ['入门', '普及', '提高', '提高+/省选-', '省选/NOI-']);
  assert.match(problems[0].ratingEstimateReason, /低置信度.*未经校准.*50\/100.*非官方/);
  assert.ok(problems.every(p => p.rating === null && p.communityDifficulty === null));
  assert.ok(problems.slice(5).every(p => p.estimatedCfRating === null && p.estimatedLuoguDifficulty === null));
});

test('LibreOJ list traverses pages, respects its cap, and reports source failures', async () => {
  const calls = [];
  const result = await fetchLibreOJProblems(async (endpoint, init) => {
    assert.equal(endpoint, 'https://api.loj.ac/api/problem/queryProblemSet');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body); calls.push(body);
    const size = Math.min(100, 442 - body.skipCount);
    return response({ count: 442, result: Array.from({ length: size }, (_, i) => row(body.skipCount + i + 1)) });
  }, 15000, () => 0.999);
  assert.deepEqual(calls.map(body => body.skipCount), [0, 100, 200, 300, 400]);
  assert.ok(calls.every(body => body.takeCount === 100 && body.locale === 'zh_CN'));
  assert.equal(result.problems.length, 442);
  assert.deepEqual(result.errors, []);
  const capped = await fetchLibreOJProblems(async (_endpoint, init) => {
    const { skipCount } = JSON.parse(init.body);
    return response({ count: 10001, result: [row(skipCount + 1)] });
  });
  assert.equal(capped.problems.length, 100);
  assert.match(capped.errors[0], /分页上限/);
  for (const make of [() => response('verify', 200, 'text/html'), () => response({}, 403), () => response('{}'), () => response('{bad')]) {
    let count = 0;
    const failed = await fetchLibreOJProblems(async () => { count++; return make(); });
    assert.equal(count, 1); assert.equal(failed.problems.length, 0); assert.equal(failed.errors.length, 1);
  }
  let page = 0;
  const partial = await fetchLibreOJProblems(async () => {
    page++;
    if (page === 2) throw new Error('simulated timeout');
    return response({ count: 250, result: [row(21)] });
  }, 15000, () => 0.999);
  assert.equal(partial.problems.length, 1);
  assert.match(partial.errors.join(' '), /保留 1 道/);
  assert.match(partial.errors.join(' '), /第 2 页获取失败：simulated timeout/);
  assert.equal(page, 2);
  const budgets = [];
  let now = 1000;
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    await fetchLibreOJProblems(async (_endpoint, init) => {
      budgets.push(init.signal); now += 800;
      return response({ count: 250, result: [row(budgets.length)] });
    }, 1500);
  } finally { Date.now = originalNow; }
  assert.equal(budgets.length, 2);
  assert.ok(budgets.every(signal => signal.aborted === false));
});

test('LibreOJ dailyDraw supports tags but excludes unknown difficulty with bounded filters', async () => {
  const fetcher = async () => response({ count: 1, result: [row()] });
  const result = await dailyDraw({ source: 'LOJ', tags: ['动态规划'] }, [], fetcher, () => 0);
  assert.equal(result.problem.id, 'LOJ:1'); assert.match(result.note, /统计不足/);
  assert.equal((await dailyDraw({ source: 'LOJ', tags: ['dp'] }, [], fetcher, () => 0)).problem.id, 'LOJ:1');
  for (const filter of [{ ratingMin: 800 }, { luoguDifficulty: '入门' }, { communityDifficultyMin: 0 }]) await assert.rejects(dailyDraw({ source: 'LOJ', ...filter }, [], fetcher), /没有符合条件/);
});

test('LibreOJ statement preserves formula, ordered sections and literal sample whitespace as safe text', () => {
  const parsed = parseLibreOJStatement(url, statement());
  assert.match(parsed.statementText, /\$a\+b\$/);
  assert.match(parsed.statementText, /1  2\n<node>&lt;/);
  assert.match(parsed.statementHtml, /&lt;node&gt;&amp;lt;/);
  assert.doesNotMatch(parsed.statementHtml, /<script|alert\(1\)/);
  for (const bad of [{ ...statement(), error: 'NO_SUCH_PROBLEM' }, { ...statement(), meta: { displayId: 2, isPublic: true } }, { ...statement(), meta: { displayId: 1, isPublic: false } }, { ...statement(), samples: [] }]) assert.throws(() => parseLibreOJStatement(url, bad));
});

test('LibreOJ statement fetch uses only verified endpoint and rejects redirects, challenges, large and malformed JSON', async () => {
  let calls = 0;
  await fetchLibreOJStatement(url, { fetcher: async (endpoint, init) => {
    calls++; assert.equal(endpoint, 'https://api.loj.ac/api/problem/getProblem');
    assert.deepEqual(JSON.parse(init.body), { displayId: 1, localizedContentsOfLocale: 'zh_CN', samples: true });
    assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error'); return response(statement());
  } });
  assert.equal(calls, 1);
  for (const badUrl of ['http://loj.ac/p/1', 'https://loj.ac.evil/p/1', 'https://user@loj.ac/p/1', 'https://loj.ac/p/1?x=1', 'https://loj.ac/p/1#x', 'https://loj.ac/p/0']) await assert.rejects(fetchLibreOJStatement(badUrl));
  for (const make of [() => response('verify', 200, 'text/html'), () => response({}, 403), () => response('{}'), () => response('{bad'), () => response('x'.repeat(1025))]) {
    let count = 0;
    await assert.rejects(fetchLibreOJStatement(url, { maxBytes: 1024, fetcher: async () => { count++; return make(); } }));
    assert.equal(count, 1);
  }
});
