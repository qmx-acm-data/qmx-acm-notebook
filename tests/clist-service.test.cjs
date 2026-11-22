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
const { createClistService, normalizeClistProblem, filterClistProblems, readClistRatingCache, createClistRatingCacheReader } = loaded.exports;

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
  assert.equal(normalizeClistProblem(row({ rating: 0 })).rating, null);
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

test('reads v4 meta.total_count before legacy total_count for random pagination', async () => {
  for (const meta of [{ total_count: 150 }, { total_count: null }]) {
    const offsets = [];
    const service = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0, random: () => 0.9, fetcher: async input => {
      offsets.push(Number(new URL(input).searchParams.get('offset')));
      return response({ meta, total_count: 100, objects: [row()] });
    } });
    await service.fetchProblems();
    assert.deepEqual(offsets, [0, meta.total_count === 150 ? 90 : 45]);
  }
});

test('looks up six supported platforms by canonical path regex instead of random pages', async () => {
  const cases = [
    ['https://www.codeforces.com/contest/1900/problem/d/?locale=en#statement', 'https://codeforces.com/problemset/problem/1900/D', 'codeforces.com', 'https://codeforces.com/contest/1900/problem/D', /contest\/1900\/problem\/D/],
    ['https://codeforces.com/problemset/problem/921/14', 'https://codeforces.com/problemset/problem/921/14', 'codeforces.com', 'http://codeforces.com/contest/921/problem/14', /contest\/921\/problem\/14/],
    ['https://www.atcoder.jp/contests/abc001/tasks/abc001_1/?lang=en', 'https://atcoder.jp/contests/abc001/tasks/abc001_1', 'atcoder.jp', 'https://atcoder.jp/contests/abc001/tasks/abc001_1', /contests\/abc001\/tasks\/abc001_1/],
    ['https://atcoder.jp/contests/DEGwer2023/tasks/1202Contest_a', 'https://atcoder.jp/contests/DEGwer2023/tasks/1202Contest_a', 'atcoder.jp', 'https://atcoder.jp/contests/DEGwer2023/tasks/1202Contest_a?lang=ja', /contests\/DEGwer2023\/tasks\/1202Contest_a/],
    ['https://leetcode.cn/problems/two-sum/?envType=daily-question#description', 'https://leetcode.com/problems/two-sum/', 'leetcode.com', 'https://leetcode.com/problems/two-sum/', /problems\/two-sum/],
    ['https://leetcode.com/problems/splitting-a-string-into-descending-consecutive-values/', 'https://leetcode.com/problems/splitting-a-string-into-descending-consecutive-values/', 'leetcode.com', 'https://leetcode.com/contest/weekly-contest-239/problems/splitting-a-string-into-descending-consecutive-values', /problems\/splitting-a-string-into-descending-consecutive-values/],
    ['https://leetcode.cn/contest/biweekly-contest-99/problems/split-with-minimum-sum/', 'https://leetcode.com/problems/split-with-minimum-sum/', 'leetcode.com', 'https://leetcode.com/problems/split-with-minimum-sum/', /problems\/split-with-minimum-sum/],
    ['https://luogu.com.cn/problem/P1001/?foo=bar#solution', LG, 'luogu.com.cn', `${LG}?contestId=1266`, /problem\/P1001/],
    ['https://www.nowcoder.com/acm/problem/12345/?from=search', NC, 'ac.nowcoder.com', NC, /acm\/problem\/12345/],
    ['https://ac.nowcoder.com/acm/contest/12345/a/?from=search', 'https://ac.nowcoder.com/acm/contest/12345/A', 'ac.nowcoder.com', 'https://ac.nowcoder.com/acm/contest/12345/A', /acm\/contest\/12345\/A/],
    ['https://www.loj.ac/problem/1000/?locale=zh', 'https://loj.ac/p/1000', 'loj.ac', 'https://loj.ac/problem/1000', /\(p\|problem\)\/1000/]
  ];
  for (const [input, canonical, resource, returned = canonical, pattern] of cases) {
    const calls = [];
    const service = createClistService({ credentials: { account: 'mock-account', key: 'mock-key' }, random: () => { throw new Error('lookup must not sample pages'); }, rateLimitMs: 0, fetcher: async (url, init) => {
      calls.push({ url: new URL(url), init });
      const filter = new RegExp(new URL(url).searchParams.get('url__regex'));
      assert.equal(filter.test(returned), true, 'the emitted query must discover the fixture before identity validation');
      return response({ meta: { total_count: 3 }, objects: [{ url: 'https://example.invalid/other', rating: 5 }, { url: returned, rating: 1729, difficulty: 8, points: 9 }] });
    } });
    const result = await service.lookupRating(input);
    assert.equal(result.rating, 1729);
    assert.equal(result.resource, resource);
    assert.equal(result.cached, false);
    assert.equal(result.stale, false);
    assert.ok(Number.isFinite(Date.parse(result.queriedAt)));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.pathname, '/api/v4/problem/');
    const params = Object.fromEntries(calls[0].url.searchParams);
    assert.equal(params.url, undefined, 'exact url filter misses contest query strings');
    assert.equal(params.limit, '10');
    assert.equal(params.resource, resource);
    assert.match(params.url__regex, pattern);
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.credentials, 'omit');
    assert.equal(calls[0].init.redirect, 'error');
    assert.equal(calls[0].init.headers.authorization, 'ApiKey mock-account:mock-key');
    assert.ok(calls[0].init.signal instanceof AbortSignal);
    assert.equal(calls[0].url.href.includes('mock-key'), false);
  }
});

test('lookup patterns match complete problem identities without numeric or letter prefixes', async () => {
  for (const [target, exact, wrong] of [
    ['https://codeforces.com/problemset/problem/140/E', 'http://codeforces.com/contest/140/problem/E?locale=en', ['https://codeforces.com/contest/1140/problem/E', 'https://codeforces.com/contest/140/problem/E1', 'https://codeforces.com/contest/140/problem/E2']],
    [LG, `${LG}?contestId=12`, ['https://www.luogu.com.cn/problem/P10010', 'https://www.luogu.com.cn/problem/P10011']],
    [NC, NC, ['https://ac.nowcoder.com/acm/problem/123456']],
    ['https://loj.ac/p/1000', 'https://loj.ac/problem/1000', ['https://loj.ac/problem/10000', 'https://loj.ac/p/10000', 'https://loj.ac/p/1000/solutions']]
  ]) {
    const service = createClistService({ credentials: { account: 'mock', key: 'mock' }, rateLimitMs: 0, fetcher: async input => {
      const pattern = new RegExp(new URL(input).searchParams.get('url__regex'));
      assert.equal(pattern.test(exact), true);
      for (const value of wrong) assert.equal(pattern.test(value), false, value);
      return response({ objects: [{ url: exact, rating: 2840 }] });
    } });
    assert.equal((await service.lookupRating(target)).rating, 2840);
  }
});

test('rejects unsupported or unsafe URLs before requesting CLIST', async () => {
  let calls = 0;
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, fetcher: async () => { calls += 1; return response({}); } });
  for (const url of [
    'http://codeforces.com/problemset/problem/1900/D', 'https://codeforces.com.evil.example/contest/1900/problem/D',
    'https://user:pass@codeforces.com/contest/1900/problem/D', 'https://codeforces.com:444/contest/1900/problem/D',
    'https://codeforces.com/api/problemset.problems', 'https://codeforces.com/problemset?problem=1900D',
    'https://atcoder.jp/contests/abc001', 'https://leetcode.com/graphql/', 'https://leetcode.com/problems/two-sum/description/',
    'https://www.luogu.com.cn/contest/1000', 'https://ac.nowcoder.com/acm/problem/0',
    'https://ac.nowcoder.com/practice/not-a-problem-id', 'https://loj.ac/p', 'javascript:alert(1)',
    'https://evil.example/?url=https://www.luogu.com.cn/problem/P1001'
  ]) {
    const result = await service.lookupRating(url);
    assert.equal(result.rating, null, url);
    assert.ok(result.error, url);
  }
  assert.equal(calls, 0);
});

test('validates returned canonical platform and problem identity before trusting a rating', async () => {
  for (const returned of [
    'https://codeforces.com/contest/1901/problem/D', 'https://codeforces.com/contest/1900/problem/D1',
    'https://atcoder.jp/contests/1900/tasks/D', 'https://evil.example/problemset/problem/1900/D',
    'https://codeforces.com/contest/1900/problem/X?id=D',
    '?url=https://codeforces.com/problemset/problem/1900/D', '#problem-D', ''
  ]) {
    const service = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0, fetcher: async () => response({ objects: [{ url: returned, rating: 2000 }] }) });
    const result = await service.lookupRating('https://codeforces.com/problemset/problem/1900/D');
    assert.equal(result.rating, null, returned);
    assert.ok(result.error);
  }
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0, fetcher: async () => response({ objects: [{ problem: { url: '/contest/1900/problem/D' }, rating: 1800 }] }) });
  const result = await service.lookupRating('https://codeforces.com/problemset/problem/1900/D');
  assert.equal(result.rating, 1800);
  assert.equal(result.resource, 'codeforces.com');
  // CLIST still stores legacy http:// links for old rounds; only the scheme is upgraded.
  const legacy = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0, fetcher: async () => response({ objects: [{ url: 'http://codeforces.com/contest/140/problem/E', rating: 2840 }] }) });
  assert.equal((await legacy.lookupRating('https://codeforces.com/problemset/problem/140/E')).rating, 2840);
  const legacyMismatch = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0, fetcher: async () => response({ objects: [{ url: 'http://codeforces.com/contest/141/problem/E', rating: 2000 }] }) });
  assert.equal((await legacyMismatch.lookupRating('https://codeforces.com/problemset/problem/140/E')).rating, null);
});

test('LeetCode contest and archive links share a slug identity while wrong tasks remain rejected', async () => {
  const slug = 'splitting-a-string-into-descending-consecutive-values';
  const url = `https://leetcode.com/problems/${slug}/`;
  for (const returned of [`https://leetcode.com/contest/weekly-contest-239/problems/${slug}`, `https://leetcode.cn/contest/biweekly-contest-239/problems/${slug}/?envType=contest`]) {
    const service = createClistService({ credentials: { account: 'mock', key: 'mock' }, rateLimitMs: 0, fetcher: async () => response({ objects: [{ url: returned, archive_url: url, rating: 1787 }] }) });
    assert.equal((await service.lookupRating(url)).rating, 1787);
  }
  for (const returned of [`https://evil.example/contest/weekly-contest-239/problems/${slug}`, `https://leetcode.com/contest/weekly-contest-239/problems/${slug}-ii`, `https://leetcode.com/contest/weekly-contest-239/problems/${slug}/solutions`]) {
    const service = createClistService({ credentials: { account: 'mock', key: 'mock' }, rateLimitMs: 0, fetcher: async () => response({ objects: [{ url: returned, archive_url: url, rating: 1787 }] }) });
    assert.equal((await service.lookupRating(url)).rating, null);
  }
});

test('unknown ratings never fall back to difficulty or points and ambiguous/API errors stay unknown', async () => {
  for (const value of [undefined, null, -1, NaN, Infinity, '1700']) {
    const service = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0, fetcher: async () => response({ objects: [{ url: LG, rating: value, difficulty: 1700, points: 1700 }] }) });
    const result = await service.lookupRating(LG);
    assert.equal(result.rating, null);
    assert.ok(result.error);
  }
  for (const body of [null, {}, { objects: [] }, { objects: [row({ url: 'https://luogu.com.cn/problem/P9999' })] }, { errors: [{ message: 'GraphQL mock-key' }], objects: [row()] }]) {
    const service = createClistService({ credentials: { account: 'a', key: 'mock-key' }, rateLimitMs: 0, fetcher: async () => response(body) });
    const result = await service.lookupRating(LG);
    assert.equal(result.rating, null);
    assert.ok(result.error);
    assert.equal(JSON.stringify(result).includes('mock-key'), false);
  }
  const zero = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0, fetcher: async () => response({ objects: [row({ rating: 0 })] }) });
  assert.deepEqual(await zero.lookupRating(LG), { rating: null, resource: 'luogu.com.cn', error: 'CLIST 暂无评分数据', noData: true });
});

test('canonical cache lasts 24 hours for successful ratings and coalesces queued/inflight requests', async () => {
  let clock = 0;
  let calls = 0;
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, now: () => clock, rateLimitMs: 0, fetcher: async () => { calls += 1; await Promise.resolve(); return response({ objects: [row()] }); } });
  const results = await Promise.all([service.lookupRating(LG), service.lookupRating('https://luogu.com.cn/problem/P1001/?foo=x'), service.lookupRating(LG)]);
  assert.equal(calls, 1);
  assert.deepEqual(results.map(result => result.rating), [1200, 1200, 1200]);
  results[0].rating = 9999;
  clock = 24 * 60 * 60 * 1000 - 1;
  assert.equal((await service.lookupRating(LG)).rating, 1200);
  assert.equal(calls, 1);
  clock += 1;
  await service.lookupRating(LG);
  assert.equal(calls, 2);
});

test('unknown and failed lookups cool down for 120 seconds then retry without leaking errors', async () => {
  for (const failure of ['unknown', 'throw', 'http', 'json']) {
    let clock = 0;
    let calls = 0;
    const service = createClistService({ credentials: { account: 'mock-account', key: 'mock-key' }, now: () => clock, rateLimitMs: 0, fetcher: async () => {
      calls += 1;
      if (failure === 'throw') throw new Error('https://mock-account:mock-key@clist.by/ GraphQL body');
      if (failure === 'json') return { ok: true, json: async () => { throw new Error('mock-key'); } };
      return response({ objects: [row({ rating: null })] }, failure !== 'http', 403);
    } });
    const result = await service.lookupRating(LG);
    assert.equal(result.rating, null);
    assert.equal(JSON.stringify(result).includes('mock-key'), false);
    assert.equal(JSON.stringify(result).includes('mock-account'), false);
    clock = 119999;
    await service.lookupRating(LG);
    assert.equal(calls, 1, failure);
    clock += 1;
    await service.lookupRating(LG);
    assert.equal(calls, 2, failure);
  }
});

test('lookup and random drawing share the same default six-second serial request queue', async () => {
  let clock = 0;
  const starts = [];
  const waits = [];
  let active = 0;
  let maxActive = 0;
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, now: () => clock, random: () => 0, sleep: async ms => { waits.push(ms); clock += ms; }, fetcher: async input => {
    starts.push(clock);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
    const pattern = new URL(input).searchParams.get('url__regex') ?? '';
    const url = pattern.includes('12345') ? NC : LG;
    return response({ total_count: 1, objects: [row({ url })] });
  } });
  await Promise.all([service.fetchProblems(), service.lookupRating(LG), service.lookupRating('https://luogu.com.cn/problem/P1001/?x=1'), service.lookupRating(NC), service.fetchProblems()]);
  assert.equal(maxActive, 1);
  assert.deepEqual(starts, [0, 6000, 12000, 18000]);
  assert.deepEqual(waits, [6000, 6000, 6000]);
});

test('lookup rejects untrusted or non-problem API endpoints and invalid injected credentials locally', async () => {
  let calls = 0;
  for (const endpoint of ['http://clist.by/api/v4/problem/', 'https://evil.example/api/v4/problem/', 'https://user:pass@clist.by/api/v4/problem/', 'https://clist.by/graphql/', 'https://clist.by:444/api/v4/problem/', 'https://clist.by/api/v4/problem/?key=mock-key']) {
    const service = createClistService({ credentials: { account: 'a', key: 'mock-key' }, endpoint, fetcher: async () => { calls += 1; return response({}); } });
    const result = await service.lookupRating(LG);
    assert.equal(result.rating, null);
    assert.equal(JSON.stringify(result).includes('mock-key'), false);
  }
  const invalid = createClistService({ credentials: { account: '', key: '' }, fetcher: async () => { calls += 1; return response({}); } });
  assert.equal((await invalid.lookupRating(LG)).rating, null);
  assert.equal(calls, 0);
});

test('persists only successful ratings, preserves document metadata and reuses scores after restart indefinitely', async () => {
  let disk;
  let clock = 0;
  let calls = 0;
  const writes = [];
  const options = {
    credentials: { account: 'mock-account', key: 'mock-key' }, now: () => clock, rateLimitMs: 0,
    readRatingCache: () => disk,
    writeRatingCache: value => { disk = structuredClone(value); writes.push(disk); },
    fetcher: async () => { calls += 1; return response({ objects: [row({ rating: 1200 })] }); }
  };
  const first = await createClistService(options).lookupRating(LG);
  assert.deepEqual(first, { rating: 1200, resource: 'luogu.com.cn', queriedAt: '1970-01-01T00:00:00.000Z', cached: false, stale: false });
  assert.deepEqual(disk, { schema: 1, ratings: { [LG]: { rating: 1200, resource: 'luogu.com.cn', queriedAt: first.queriedAt } } });
  assert.equal(JSON.stringify(disk).includes('mock-key'), false);
  assert.equal(JSON.stringify(disk).includes('mock-account'), false);
  disk.metadata = { owner: 'test', extra: ['keep'] };
  clock += 365 * 24 * 60 * 60 * 1000;
  const restarted = createClistService({ ...options, credentials: { account: '', key: '' } });
  const cached = await restarted.lookupRating('https://luogu.com.cn/problem/P1001/?source=ignored');
  assert.deepEqual(cached, { ...first, cached: true });
  assert.equal(calls, 1);
  assert.equal(writes.length, 1);
  await createClistService(options).lookupRating(LG, true);
  assert.deepEqual(disk.metadata, { owner: 'test', extra: ['keep'] });
  assert.equal(calls, 2);
  assert.equal(writes.length, 2);
});

test('cache reader needs no credentials and validates all supported canonical identities and every entry', () => {
  const queriedAt = '2026-01-02T03:04:05.000Z';
  const entries = [
    ['https://codeforces.com/problemset/problem/1900/D', 'codeforces.com'],
    ['https://atcoder.jp/contests/abc001/tasks/abc001_1', 'atcoder.jp'],
    ['https://leetcode.com/problems/two-sum/', 'leetcode.com'],
    [LG, 'luogu.com.cn'], [NC, 'ac.nowcoder.com'], ['https://loj.ac/p/1000', 'loj.ac']
  ];
  const ratings = Object.fromEntries(entries.map(([url, resource]) => [url, { rating: 1500, resource, queriedAt }]));
  const disk = { schema: 1, ratings };
  assert.equal(readClistRatingCache(undefined, LG), null);
  assert.equal(readClistRatingCache(disk, 'https://evil.example/problem/P1001'), null);
  assert.deepEqual(readClistRatingCache(disk, 'https://luogu.com.cn/problem/P1001/?x=1'), { ...ratings[LG], cached: true, stale: false });
  for (const [url] of entries) assert.equal(readClistRatingCache(disk, url).rating, 1500);
  const invalidEntries = [
    ['https://evil.example/problem/1', { rating: 1, resource: 'evil.example', queriedAt }],
    ['https://codeforces.com/contest/1900/problem/D', { rating: 1, resource: 'codeforces.com', queriedAt }],
    [`${LG}?key=secret`, ratings[LG]],
    [LG, { ...ratings[LG], rating: null }], [LG, { ...ratings[LG], rating: -1 }],
    [LG, { ...ratings[LG], rating: Infinity }], [LG, { ...ratings[LG], rating: '1500' }],
    [LG, { ...ratings[LG], resource: 'evil.example' }],
    [LG, { ...ratings[LG], queriedAt: 'secret' }], [LG, { ...ratings[LG], queriedAt: '2026-02-30T00:00:00.000Z' }],
    [LG, { ...ratings[LG], key: 'secret' }]
  ];
  for (const [url, entry] of invalidEntries) {
    assert.throws(() => readClistRatingCache({ schema: 1, ratings: { ...ratings, [url]: entry } }, NC), error => {
      assert.equal(error.message, 'CLIST 评分缓存格式无效，未覆盖原文件');
      assert.equal(error.message.includes('secret'), false);
      return true;
    });
  }
  for (const value of [null, [], {}, { schema: 2, ratings: {} }, { schema: 1, ratings: [] }]) {
    assert.throws(() => readClistRatingCache(value, LG), /CLIST 评分缓存格式无效/);
  }
});

test('AT cache fallback uses full case-preserved task IDs across contests without changing stored keys', () => {
  const queriedAt = '2026-01-02T03:04:05.000Z';
  const tasks = ['abc123_x', 'abc007_3', '1202Contest_a', 'archive-task_with_underscores'];
  const ratings = Object.fromEntries(tasks.map((task, i) => [
    `https://atcoder.jp/contests/original/tasks/${task}`,
    { rating: 1500 + i, resource: 'atcoder.jp', queriedAt }
  ]));
  const disk = { schema: 1, ratings };
  const before = JSON.stringify(disk);
  const read = createClistRatingCacheReader(disk);
  for (const [i, task] of tasks.entries()) {
    assert.deepEqual(read(`https://www.atcoder.jp/contests/adt_all_20261101_1/tasks/${task}/?lang=en#statement`), {
      rating: 1500 + i, resource: 'atcoder.jp', queriedAt, cached: true, stale: false
    });
  }
  for (const task of ['ABC123_X', 'abc123_X', 'abc124_x', 'x', 'abc123_x_extra', '1202contest_a']) {
    assert.equal(read(`https://atcoder.jp/contests/other/tasks/${task}`), null);
  }
  for (const url of [
    'https://atcoder.jp/contests/other/tasks/',
    'https://atcoder.jp/contests/other/tasks/abc123_x/editorial',
    'https://evil.example/contests/other/tasks/abc123_x',
    'http://atcoder.jp/contests/other/tasks/abc123_x'
  ]) assert.equal(read(url), null);
  assert.equal(JSON.stringify(disk), before);
  const fallback = read('https://atcoder.jp/contests/other/tasks/abc123_x');
  fallback.rating = 9;
  ratings['https://atcoder.jp/contests/original/tasks/abc123_x'].rating = 10;
  assert.equal(read('https://atcoder.jp/contests/other/tasks/abc123_x').rating, 1500);
});

test('AT cache fallback accepts agreeing scores with the latest query time and keeps exact hits first', () => {
  const older = '2026-01-02T03:04:05.000Z';
  const newer = '2026-01-03T03:04:05.000Z';
  const first = 'https://atcoder.jp/contests/abc123/tasks/abc123_x';
  const second = 'https://atcoder.jp/contests/adt_all_1/tasks/abc123_x';
  for (const reverse of [false, true]) {
    const entries = [
      [first, { rating: 1500, resource: 'atcoder.jp', queriedAt: older }],
      [second, { rating: 1500, resource: 'atcoder.jp', queriedAt: newer }]
    ];
    const read = createClistRatingCacheReader({ schema: 1, ratings: Object.fromEntries(reverse ? entries.reverse() : entries) });
    assert.equal(read('https://atcoder.jp/contests/third/tasks/abc123_x').queriedAt, newer);
    assert.equal(read(first).queriedAt, older);
    assert.equal(read(second).queriedAt, newer);
  }
});

test('AT cache fallback rejects any conflicting score including zero while exact hits remain usable', () => {
  const queriedAt = '2026-01-02T03:04:05.000Z';
  for (const conflictingRating of [1600, 0]) {
    const first = 'https://atcoder.jp/contests/first/tasks/abc123_x';
    const second = 'https://atcoder.jp/contests/second/tasks/abc123_x';
    const entries = [
      [first, { rating: 1500, resource: 'atcoder.jp', queriedAt }],
      [second, { rating: conflictingRating, resource: 'atcoder.jp', queriedAt }],
      ['https://atcoder.jp/contests/third/tasks/abc123_x', { rating: 1500, resource: 'atcoder.jp', queriedAt }]
    ];
    for (const reverse of [false, true]) {
      const read = createClistRatingCacheReader({ schema: 1, ratings: Object.fromEntries(reverse ? [...entries].reverse() : entries) });
      assert.equal(read('https://atcoder.jp/contests/missing/tasks/abc123_x'), null);
      assert.equal(read(first).rating, 1500);
      assert.equal(read(second).rating, conflictingRating === 0 ? null : conflictingRating);
      if (conflictingRating === 0) assert.equal(read(second).noData, true);
    }
  }
});

test('task fallback never joins other resources and still requires exact AT resource validation', () => {
  const queriedAt = '2026-01-02T03:04:05.000Z';
  const read = createClistRatingCacheReader({ schema: 1, ratings: {
    'https://ac.nowcoder.com/acm/contest/123/A': { rating: 1500, resource: 'ac.nowcoder.com', queriedAt },
    'https://codeforces.com/problemset/problem/123/A': { rating: 1500, resource: 'codeforces.com', queriedAt }
  } });
  assert.equal(read('https://ac.nowcoder.com/acm/contest/124/A'), null);
  assert.equal(read('https://codeforces.com/problemset/problem/124/A'), null);
  assert.equal(read('https://atcoder.jp/contests/other/tasks/A'), null);
  assert.throws(() => createClistRatingCacheReader({ schema: 1, ratings: {
    'https://atcoder.jp/contests/abc123/tasks/abc123_x': { rating: 1500, resource: 'codeforces.com', queriedAt }
  } }), /CLIST 评分缓存格式无效/);
});

test('legacy zero cache entries remain valid no-data markers alongside positive scores', async () => {
  const queriedAt = '2026-01-02T03:04:05.000Z';
  let disk = { schema: 1, metadata: 'keep', ratings: {
    [LG]: { rating: 0, resource: 'luogu.com.cn', queriedAt },
    [NC]: { rating: 1700, resource: 'ac.nowcoder.com', queriedAt }
  } };
  const read = createClistRatingCacheReader(disk);
  assert.deepEqual(read('https://luogu.com.cn/problem/P1001/?x=1'), { rating: null, resource: 'luogu.com.cn', noData: true, queriedAt, cached: true });
  assert.equal(readClistRatingCache(disk, NC).rating, 1700);
  for (const invalid of [
    { ...disk.ratings[LG], resource: 'evil.example' },
    { ...disk.ratings[LG], queriedAt: '2026-02-30T00:00:00.000Z' },
    { ...disk.ratings[LG], extra: 'invalid' }
  ]) {
    assert.throws(() => createClistRatingCacheReader({ ...disk, ratings: { ...disk.ratings, [LG]: invalid } }), /CLIST 评分缓存格式无效/);
  }
  let calls = 0;
  let writes = 0;
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0,
    readRatingCache: () => disk, writeRatingCache: value => { writes += 1; disk = value; },
    fetcher: async () => { calls += 1; return response({ objects: [row({ rating: 0 })] }); }
  });
  assert.equal((await service.lookupRating(NC)).rating, 1700);
  assert.equal(calls, 0);
  assert.deepEqual(await service.lookupRating(LG), { rating: null, resource: 'luogu.com.cn', noData: true, error: 'CLIST 暂无评分数据' });
  assert.equal(calls, 1, 'a legacy zero must never become a successful cached rating');
  assert.equal(writes, 0);
  assert.equal(disk.ratings[LG].rating, 0);
  const refreshed = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0,
    readRatingCache: () => disk, writeRatingCache: value => { writes += 1; disk = value; },
    fetcher: async () => response({ objects: [row({ rating: 1200 })] })
  });
  assert.equal((await refreshed.lookupRating(LG)).rating, 1200);
  assert.equal(disk.ratings[LG].rating, 1200);
  assert.equal(disk.ratings[NC].rating, 1700);
  assert.equal(disk.metadata, 'keep');
  assert.equal(writes, 1);
});

test('batch cache reader validates once and isolates both source and returned score mutations', () => {
  const queriedAt = '2026-01-02T03:04:05.000Z';
  let validations = 0;
  const ratings = { [LG]: { rating: 1500, resource: 'luogu.com.cn', queriedAt } };
  const disk = { schema: 1, get ratings() { validations += 1; return ratings; } };
  const read = createClistRatingCacheReader(disk);
  assert.equal(validations, 1);
  ratings[LG].rating = 9999;
  ratings[NC] = { rating: 2000, resource: 'ac.nowcoder.com', queriedAt };
  const first = read('https://luogu.com.cn/problem/P1001/?x=1');
  assert.deepEqual(first, { rating: 1500, resource: 'luogu.com.cn', queriedAt, cached: true, stale: false });
  first.rating = 42;
  for (let i = 0; i < 100; i += 1) assert.equal(read(LG).rating, 1500);
  assert.equal(read(NC), null);
  assert.equal(read('https://evil.example/problem/1'), null);
  assert.equal(validations, 1);
  assert.equal(createClistRatingCacheReader(undefined)(LG), null);
  assert.throws(() => createClistRatingCacheReader({ schema: 1, ratings: { [LG]: { rating: null } } }), /CLIST 评分缓存格式无效/);
});

test('force bypasses success and failure cooldowns while merging concurrent canonical refreshes', async () => {
  let calls = 0;
  let fail = false;
  let disk;
  const service = createClistService({
    credentials: { account: 'a', key: 'k' }, now: () => 0, rateLimitMs: 0,
    readRatingCache: () => disk, writeRatingCache: value => { disk = value; },
    fetcher: async () => { calls += 1; await Promise.resolve(); return response({ objects: [row({ rating: fail ? null : calls * 100 })] }); }
  });
  assert.equal((await service.lookupRating(LG)).rating, 100);
  const refreshed = await Promise.all([service.lookupRating(LG, true), service.lookupRating('https://luogu.com.cn/problem/P1001/?x=1', true), service.lookupRating(LG)]);
  assert.equal(calls, 2);
  assert.deepEqual(refreshed.map(result => [result.rating, result.cached, result.stale]), [[200, false, false], [200, false, false], [200, false, false]]);
  fail = true;
  const failed = await service.lookupRating(LG, true);
  assert.equal(failed.rating, 200);
  assert.equal(failed.cached, true);
  assert.equal(failed.stale, true);
  assert.ok(failed.error);
  await service.lookupRating(LG);
  assert.equal(calls, 3);
  fail = false;
  const retried = await service.lookupRating(LG, true);
  assert.equal(calls, 4);
  assert.equal(retried.rating, 400);
  assert.equal(retried.stale, false);
  assert.equal(retried.cached, false);
  assert.equal(disk.ratings[LG].rating, 400);
});

test('API errors and null or zero scores retain last good disk data and original query time', async () => {
  for (const failure of ['null', 'zero', 'http', 'throw', 'json', 'identity']) {
    const queriedAt = '2020-01-02T00:00:00.000Z';
    const disk = { schema: 1, ratings: { [LG]: { rating: 1700, resource: 'luogu.com.cn', queriedAt } } };
    let writes = 0;
    const service = createClistService({ credentials: { account: 'mock-account', key: 'mock-key' }, rateLimitMs: 0, readRatingCache: () => disk, writeRatingCache: () => { writes += 1; }, fetcher: async () => {
      if (failure === 'throw') throw new Error('mock-account mock-key');
      if (failure === 'json') return { ok: true, json: async () => { throw new Error('mock-key'); } };
      return response({ objects: [row({ url: failure === 'identity' ? NC : LG, rating: failure === 'null' ? null : failure === 'zero' ? 0 : 2000 })] }, failure !== 'http');
    } });
    const result = await service.lookupRating(LG, true);
    assert.equal(result.rating, 1700, failure);
    assert.equal(result.queriedAt, queriedAt);
    assert.equal(result.cached, true);
    assert.equal(result.stale, true);
    assert.ok(result.error);
    assert.equal(result.noData, undefined, 'a retained positive score is still available');
    if (failure === 'zero') assert.equal(result.error, 'CLIST 暂无评分数据');
    assert.equal(JSON.stringify(result).includes('mock-key'), false);
    assert.equal(JSON.stringify(result).includes('mock-account'), false);
    assert.equal(writes, 0);
    assert.equal(disk.ratings[LG].rating, 1700);
  }
});

test('missing and zero scores are never persisted and force can immediately retry a failed lookup', async () => {
  for (const rating of [null, 0]) {
    let calls = 0;
    let writes = 0;
    const service = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0,
      readRatingCache: () => undefined, writeRatingCache: () => { writes += 1; },
      fetcher: async () => { calls += 1; return response({ objects: [row({ rating })] }); }
    });
    const first = await service.lookupRating(LG);
    const cached = await service.lookupRating(LG);
    assert.equal(first.rating, null);
    assert.deepEqual(cached, first);
    if (rating === 0) assert.equal(first.noData, true);
    assert.equal(calls, 1);
    await service.lookupRating(LG, true);
    assert.equal(calls, 2);
    assert.equal(writes, 0);
  }
});

test('corrupt cache or read failures stop before network/write and never reveal storage error contents', async () => {
  for (const readRatingCache of [() => ({ schema: 1, ratings: { [LG]: { rating: null } } }), () => { throw new Error('mock-key private path'); }]) {
    let calls = 0;
    let writes = 0;
    const service = createClistService({ credentials: { account: 'a', key: 'mock-key' }, rateLimitMs: 0, readRatingCache,
      writeRatingCache: () => { writes += 1; }, fetcher: async () => { calls += 1; return response({ objects: [row()] }); }
    });
    for (const force of [false, true]) {
      const result = await service.lookupRating(LG, force);
      assert.equal(result.rating, null);
      assert.equal(result.error, 'CLIST 评分缓存格式无效，未覆盖原文件');
      assert.equal(JSON.stringify(result).includes('mock-key'), false);
    }
    assert.equal(calls, 0);
    assert.equal(writes, 0);
  }
});

test('revalidates storage before saving a successful request and preserves changed metadata', async () => {
  for (const corrupt of [false, true]) {
    let disk = { schema: 1, ratings: {}, metadata: 'before' };
    let writes = 0;
    const service = createClistService({ credentials: { account: 'a', key: 'k' }, rateLimitMs: 0,
      readRatingCache: () => disk, writeRatingCache: value => { writes += 1; disk = value; },
      fetcher: async () => { disk = corrupt ? { schema: 2, ratings: {} } : { ...disk, metadata: 'after' }; return response({ objects: [row()] }); }
    });
    const result = await service.lookupRating(LG);
    assert.equal(result.rating, 1200);
    assert.equal(writes, corrupt ? 0 : 1);
    if (corrupt) assert.equal(result.error, 'CLIST 评分缓存保存失败，未覆盖原文件');
    else assert.equal(disk.metadata, 'after');
  }
});

test('write-only storage keeps all successful entries and sanitizes write errors', async () => {
  let disk;
  let failing = false;
  const service = createClistService({ credentials: { account: 'a', key: 'mock-key' }, rateLimitMs: 0,
    writeRatingCache: value => { if (failing) throw new Error('mock-key private path'); disk = value; },
    fetcher: async input => {
      const pattern = new URL(input).searchParams.get('url__regex') ?? '';
      return response({ objects: [row({ url: pattern.includes('12345') ? NC : LG })] });
    }
  });
  await service.lookupRating(LG);
  await service.lookupRating(NC);
  assert.deepEqual(Object.keys(disk.ratings).sort(), [LG, NC].sort());
  failing = true;
  const result = await service.lookupRating(LG, true);
  assert.equal(result.rating, 1200);
  assert.equal(result.error, 'CLIST 评分缓存保存失败，未覆盖原文件');
  assert.equal(JSON.stringify(result).includes('mock-key'), false);
});

test('failed persistence never replaces a newer in-memory score with older disk data', async () => {
  let clock = 1000;
  let failing = false;
  const disk = { schema: 1, ratings: { [LG]: { rating: 1000, resource: 'luogu.com.cn', queriedAt: new Date(0).toISOString() } } };
  const service = createClistService({ credentials: { account: 'a', key: 'k' }, now: () => clock, rateLimitMs: 0,
    readRatingCache: () => disk, writeRatingCache: () => { throw new Error('storage unavailable'); },
    fetcher: async () => { if (failing) throw new Error('API unavailable'); return response({ objects: [row({ rating: 2000 })] }); }
  });
  assert.equal((await service.lookupRating(LG, true)).rating, 2000);
  failing = true;
  clock += 1;
  const fallback = await service.lookupRating(LG, true);
  assert.equal(fallback.rating, 2000);
  assert.equal(fallback.queriedAt, new Date(1000).toISOString());
  assert.equal(fallback.stale, true);
  assert.equal(disk.ratings[LG].rating, 1000);
});
