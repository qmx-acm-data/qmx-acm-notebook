'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/main/clist/service.cts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded._compile(compiled.outputText, filename);
const { createClistService, normalizeClistProblem, filterClistProblems } = loaded.exports;

const LG = 'https://www.luogu.com.cn/problem/P1001';
const NC = 'https://ac.nowcoder.com/acm/problem/12345';
const row = (overrides = {}) => ({ id: 'a', name: '题目', url: LG, rating: 1200, tags: ['图论'], ...overrides });
function response(body, ok = true, status = 200) { return { ok, status, json: async () => body }; }

test('normalizes only HTTPS allowlisted Luogu and Nowcoder problem URLs', () => {
  assert.equal(normalizeClistProblem(row()).platform, 'luogu');
  assert.equal(normalizeClistProblem(row({ url: NC, platform: 'nowcoder' })).platform, 'nowcoder');
  assert.equal(normalizeClistProblem(row({ url: 'https://ac.nowcoder.com/acm/contest/12345/A', platform: 'nowcoder' })).platform, 'nowcoder');
  assert.equal(normalizeClistProblem(row({ url: 'https://ac.nowcoder.com/acm/contest/12345/A', platform: 'nowcoder' })).url, 'https://ac.nowcoder.com/acm/contest/12345/A');
  for (const url of ['http://www.luogu.com.cn/problem/P1001', 'https://evil.example/problem/P1001', 'javascript:alert(1)', 'https://www.luogu.com.cn/contest/1', 'https://ac.nowcoder.com/practice/not-a-uuid', 'https://ac.nowcoder.com/acm/problem/0', 'https://ac.nowcoder.com/acm/contest/12345']) {
    assert.equal(normalizeClistProblem(row({ url })), null);
  }
});

test('normalizes CLIST resource rows with linked problem URL fields', () => {
  const clistRow = { id: 100, name: 'Problem', url: LG, resource: { id: 1, name: 'Luogu' }, rating: null };
  assert.equal(normalizeClistProblem(clistRow).platform, 'luogu');
  assert.equal(normalizeClistProblem({ ...clistRow, url: 'https://ac.nowcoder.com/acm/problem/12345', resource: { id: 2, name: 'Nowcoder' } }).platform, 'nowcoder');
  assert.equal(normalizeClistProblem({ id: 101, name: 'Nested link', problem: { url: NC }, resource: { name: 'Nowcoder' } }).platform, 'nowcoder');
  assert.equal(normalizeClistProblem({ id: 102, name: 'String link', problem: NC }).url, NC);
});

test('validates rating and keeps unknown rating as null', () => {
  assert.equal(normalizeClistProblem(row({ rating: 1500 })).rating, 1500);
  assert.equal(normalizeClistProblem(row({ rating: -1 })).rating, null);
  assert.equal(normalizeClistProblem(row({ rating: NaN })).rating, null);
});

test('unknown tags never match a tag filter', () => {
  const known = normalizeClistProblem(row({ id: 'known', tags: ['图论'] }));
  const unknown = normalizeClistProblem(row({ id: 'unknown', tags: undefined }));
  assert.deepEqual(filterClistProblems([known, unknown], { tag: '图论' }).map(item => item.id), ['known']);
  assert.deepEqual(filterClistProblems([known, unknown], {}).map(item => item.id), ['known', 'unknown']);
});

test('injects credentials without reading environment and uses strict request options', async () => {
  const calls = [];
  const service = createClistService({ credentials: { account: 'mock-account', key: 'mock-key' }, random: () => 0, rateLimitMs: 0, fetcher: async (input, init) => { calls.push({ input: String(input), init }); return response({ count: 1, objects: [row()] }); } });
  const result = await service.fetchProblems();
  assert.equal(result.problems.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.match(calls[0].init.headers.authorization, /^ApiKey mock-account:mock-key$/);
  assert.equal(calls[0].init.signal instanceof AbortSignal, true);
  assert.match(calls[0].input, /^https:\/\/clist\.by\//);
});

test('classifies invalid and valid nested CLIST problem links without exposing row data', async () => {
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, random: () => 0, rateLimitMs: 0, fetcher: async () => response({ objects: [
    { id: 1, name: 'Nested LG', problem: { url: '/problem/P2' }, resource: { name: 'Luogu' } },
    { id: 2, name: 'Nested NC', problem: 'https://ac.nowcoder.com/acm/problem/123' },
    { id: 3, name: 'Invalid link', problem: 'javascript:alert(1)' }
  ] }) });
  const result = await service.fetchProblems();
  assert.deepEqual(result.problems.map(item => item.url), ['https://www.luogu.com.cn/problem/P2', 'https://ac.nowcoder.com/acm/problem/123']);
  assert.equal(result.report.requested, 3);
  assert.equal(result.report.accepted, 2);
  assert.equal(result.report.rejected, 1);
  assert.deepEqual(result.report.rejectionCategories, { url_unsafe: 1 });
  assert.equal(JSON.stringify(result.report).includes('Nested'), false);
});

test('maps Nowcoder platform to its CLIST resource host', async () => {
  let requested;
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, random: () => 0, rateLimitMs: 0, fetcher: async input => { requested = new URL(input).searchParams.get('resource'); return response({ total_count: 0, objects: [] }); } });
  await service.fetchProblems({ platform: 'nowcoder' });
  assert.equal(requested, 'ac.nowcoder.com');
});

test('maps explicit platforms to CLIST resources and reports safe rejection categories', async () => {
  const requested = [];
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, random: () => 0, rateLimitMs: 0, fetcher: async input => { const url = new URL(input); requested.push(url); return response({ total_count: 3, objects: [
    { id: 1, name: 'Problem', url: LG, resource: { id: 1, name: 'Luogu' }, rating: null },
    { id: 2, name: 'Missing URL', url: null },
    { id: 3, name: 'Other host', url: 'https://codeforces.com/contest/1/problem/A' }
  ] }); } });
  const result = await service.fetchProblems({ platform: 'luogu' });
  assert.equal(requested[0].searchParams.get('resource'), 'luogu.com.cn');
  assert.equal(result.problems.length, 1);
  assert.deepEqual(result.report.rejectionCategories, { url_missing_or_not_string: 1, unsupported_platform_domain: 1 });
  assert.equal(JSON.stringify(result.report.rejectionCategories).includes('codeforces'), false);
});

test('uses CLIST v4 offset pagination and server-side resource/rating filters', async () => {
  const requested = [];
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, random: () => 0.9, rateLimitMs: 0, fetcher: async input => { const url = new URL(input); requested.push(url); const offset = Number(url.searchParams.get('offset')); return response({ total_count: 150, objects: [row({ id: String(offset), name: `P${offset}` })] }); } });
  const result = await service.fetchProblems({ resource: 'luogu.com.cn', minRating: 1000, maxRating: 1800 });
  assert.deepEqual(requested.map(url => Number(url.searchParams.get('offset'))), [0, 90]);
  assert.equal(requested[0].searchParams.get('limit'), '50');
  assert.equal(requested[0].searchParams.get('total_count'), 'true');
  assert.equal(requested[0].searchParams.get('resource'), 'luogu.com.cn');
  assert.equal(requested[0].searchParams.get('rating__gte'), '1000');
  assert.equal(requested[0].searchParams.get('rating__lte'), '1800');
  assert.deepEqual(result.report.pages, [0, 90]);
});

test('enforces rate limiting between requests and returns an actionable report on errors', async () => {
  let clock = 0;
  const waits = [];
  let calls = 0;
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, now: () => clock, random: () => 0.5, rateLimitMs: 100, sleep: async ms => { waits.push(ms); clock += ms; }, fetcher: async () => { calls += 1; if (calls === 1) return response({ total_count: 100, objects: [] }); throw new Error('mock failure'); } });
  const result = await service.fetchProblems();
  assert.deepEqual(waits, [100]);
  assert.deepEqual(result.report.pages, [0]);
  assert.deepEqual(result.report.errors, ['mock failure']);
  assert.equal(result.problems.length, 0);
});

test('falls back to the last good page while CLIST keeps timing out', async () => {
  let clock = 0;
  let failing = false;
  let calls = 0;
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, now: () => clock, random: () => 0, rateLimitMs: 0, fetcher: async () => {
    calls += 1;
    clock += 5;
    if (failing) throw new Error('The operation was aborted due to timeout');
    return response({ total_count: 1, objects: [row()] });
  } });
  const good = await service.fetchProblems({ resource: 'luogu.com.cn' });
  assert.equal(good.problems.length, 1);
  assert.deepEqual(good.report.errors, []);
  failing = true;
  const fallback = await service.fetchProblems({ resource: 'luogu.com.cn' });
  assert.equal(fallback.problems.length, 1);
  assert.match(fallback.report.errors[0], /CLIST 暂时不可用，使用约 \d+ 秒前缓存/);
  const before = calls;
  clock += 10_000;
  const cooling = await service.fetchProblems({ resource: 'luogu.com.cn' });
  assert.equal(cooling.problems.length, 1);
  assert.deepEqual(cooling.report.errors, []);
  assert.equal(calls, before);
});

test('reports untrusted endpoint and invalid credentials without network access', async () => {
  let calls = 0;
  const endpointResult = await createClistService({ credentials: { account: 'a', key: 'k' }, endpoint: 'https://evil.example/api', fetcher: async () => { calls += 1; return response({}); } }).fetchProblems();
  assert.deepEqual(endpointResult.report.errors, ['CLIST endpoint 必须使用 HTTPS 且属于 allowlist']);
  const credentialResult = await createClistService({ credentials: { account: '', key: '' }, rateLimitMs: 0, fetcher: async () => { calls += 1; return response({}); } }).fetchProblems();
  assert.deepEqual(credentialResult.report.errors, ['CLIST 账号与 key 必须由调用方注入']);
  assert.equal(calls, 0);
});

test('default limiter is at least six seconds and concurrent calls share one serial queue', async () => {
  let clock = 0;
  const waits = [];
  let active = 0;
  let maxActive = 0;
  const service = createClistService({ credentials: { account: 'mock', key: 'mock' }, now: () => clock, random: () => 0, sleep: async ms => { waits.push(ms); clock += ms; }, fetcher: async () => { active += 1; maxActive = Math.max(maxActive, active); await Promise.resolve(); active -= 1; return response({ total_count: 1, objects: [row()] }); } });
  await Promise.all([service.fetchProblems(), service.fetchProblems()]);
  assert.equal(maxActive, 1);
  assert.ok(waits.some(ms => ms >= 6000));
});
