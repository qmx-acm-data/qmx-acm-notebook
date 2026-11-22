'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function loadSource(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : module.require(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return loaded.exports;
}
const service = loadSource('src/main/clist/service.cts');
const { createClistBulk, CLIST_BULK_RESOURCES } = loadSource('src/main/clist/bulk.cts', { './clist-service.cjs': service });
const { createClistSharedCache } = loadSource('src/main/clist/shared-cache.cts', { './clist-service.cjs': service });
const NOW = Date.parse('2026-11-20T00:00:00.000Z');
const CF = 'codeforces.com';
const URL1 = 'https://codeforces.com/problemset/problem/1/A';
const row = (id = 1, overrides = {}) => ({ id, url: URL1, archiveUrl: null, rating: 1200, resource: CF, ...overrides });
const ok = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
function api(fetcher, options = {}) { return service.createClistService({ credentials: { account: 'fake-account', key: 'fake-key' }, rateLimitMs: 0, fetcher, ...options }); }
function fixture(overrides = {}) {
  let disk;
  const saves = [];
  const merges = [];
  const calls = [];
  const options = { read: () => disk, save: value => { disk = structuredClone(value); saves.push(disk); }, now: () => NOW,
    fetchPage: async (resource, offset) => { calls.push([resource, offset]); return { rows: [], total: 0 }; },
    mergeRatings: doc => { merges.push(doc); return { canceled: false, imported: Object.keys(doc.ratings).length, updated: 0 }; }, ...overrides };
  return { create: extra => createClistBulk({ ...options, ...extra }), saves, merges, calls, disk: () => disk };
}

test('rated pages use v4 auth and bounded numeric ordered data without retaining private fields', async () => {
  let request;
  const client = api(async (url, init) => { request = { url: new URL(url), init }; return ok({ meta: { total_count: 1001 }, objects: [
    { id: 5, url: 'http://codeforces.com/contest/1/problem/A', archive_url: null, rating: 1234, name: 'private-title', resource: { id: 1, host: CF }, key: 'private-key' }
  ] }); });
  const page = await client.fetchRatedPage(CF, 1000);
  assert.deepEqual(Object.fromEntries(request.url.searchParams), { resource: CF, rating__gt: '0', offset: '1000', limit: '1000', order_by: 'id', total_count: 'true' });
  assert.equal(request.init.headers.authorization, 'ApiKey fake-account:fake-key');
  assert.equal(request.init.redirect, 'error');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.signal instanceof AbortSignal, true);
  assert.deepEqual(page, { total: 1001, rows: [{ id: 5, url: 'http://codeforces.com/contest/1/problem/A', archiveUrl: null, rating: 1234, resource: CF }] });
  assert.equal(JSON.stringify(page).includes('private'), false);
  assert.deepEqual(service.normalizeClistRatingIdentity(page.rows[0].url), { url: URL1, resource: CF });
});

test('rated pages reject invalid parameters, counts, ratings, ids and platform mismatches', async () => {
  let requests = 0;
  const client = api(async () => { requests++; return ok({ total_count: 0, objects: [] }); });
  for (const args of [['bad', 0], [CF, -1], [CF, 0, 1001], [CF, 1.2]]) await assert.rejects(client.fetchRatedPage(...args), /参数无效/);
  assert.equal(requests, 0);
  for (const body of [
    { objects: [] }, { total_count: '1', objects: [] }, { total_count: 1, objects: [] },
    { total_count: 0, objects: [{ id: 1, rating: 1 }] },
    ...[0, -1, NaN, '1200', null].map(rating => ({ total_count: 1, objects: [{ id: 1, rating }] })),
    ...[0, 1.2, '1'].map(id => ({ total_count: 1, objects: [{ id, rating: 1000 }] })),
    { total_count: 2, objects: [{ id: 2, rating: 1000 }, { id: 1, rating: 1000 }] },
    { total_count: 1, objects: [{ id: 1, rating: 1000, resource: 'atcoder.jp' }] }
  ]) await assert.rejects(api(async () => ok(body)).fetchRatedPage(CF, 0), /CLIST 批量评分.*HTTP 200/);
});

test('rated request sanitizes HTTP, thrown errors, malformed JSON and full body timeout', async () => {
  await assert.rejects(api(async () => ok({ secret: 'fake-key' }, 429)).fetchRatedPage(CF, 0), /HTTP 429/);
  await assert.rejects(api(async () => { throw new Error('fake-key private-user'); }).fetchRatedPage(CF, 0), error => !error.message.includes('fake-key') && /请求失败/.test(error.message));
  await assert.rejects(api(async () => new Response('not JSON fake-key')).fetchRatedPage(CF, 0), error => !error.message.includes('fake-key') && /HTTP 200/.test(error.message));
  await assert.rejects(api(async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }), { timeoutMs: 10 }).fetchRatedPage(CF, 0), /超时.*HTTP 200/);
  await assert.rejects(api(async () => new Response('{}', { headers: { 'content-length': String(9 * 1024 * 1024) } })).fetchRatedPage(CF, 0), /响应过大/);
  await assert.rejects(api(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(9 * 1024 * 1024)); controller.close(); } }))).fetchRatedPage(CF, 0), /响应过大/);
});

test('rated requests share serial six second rate limit with native lookup', async () => {
  let time = 0;
  const stamps = [];
  const client = api(async url => { stamps.push([time, new URL(url).searchParams.has('url__regex')]); return ok({ total_count: 0, objects: [] }); },
    { rateLimitMs: 6000, now: () => time, sleep: async ms => { time += ms; } });
  await Promise.all([client.fetchRatedPage(CF, 0), client.lookupRating(URL1), client.fetchRatedPage('atcoder.jp', 0)]);
  assert.deepEqual(stamps, [[0, false], [6000, true], [12000, false]]);
});

test('bulk walks fixed six platforms, valid empty pages and completed rerun starts from zero', async () => {
  const f = fixture();
  const bulk = f.create();
  assert.equal(bulk.state().status, 'idle');
  assert.equal((await bulk.run()).status, 'done');
  assert.deepEqual(f.calls, CLIST_BULK_RESOURCES.map(key => [key, 0]));
  assert.equal(f.merges.length, 6);
  for (const value of Object.values(bulk.state().resources)) assert.deepEqual(value, { offset: 0, total: 0, pages: 1, status: 'done', imported: 0, ignored: 0 });
  await bulk.run();
  assert.equal(f.calls.length, 12);
  assert.equal(bulk.state().resources[CF].pages, 1);
  const isolated = bulk.state();
  isolated.resources[CF].offset = 99;
  assert.equal(bulk.state().resources[CF].offset, 0);
});

test('page canonicalization skips unsupported and primary/archive conflicts, merges all positive rows despite cache hits', async () => {
  const f = fixture({ fetchPage: async resource => resource === CF ? { total: 6, rows: [
    row(1, { url: 'http://www.codeforces.com/contest/1/problem/a?secret=private', archiveUrl: URL1 }),
    row(2, { url: null, archiveUrl: 'https://codeforces.com/contest/2/problem/01' }),
    row(3, { url: 'https://evil.example/problem/1' }),
    row(4, { archiveUrl: 'https://codeforces.com/problemset/problem/2/B' }),
    row(5, { url: 'https://atcoder.jp/contests/a/tasks/a_a' }),
    row(6, { url: 'https://codeforces.com/problemset/problem/3/A', raw: { key: 'private' } })
  ] } : { total: 0, rows: [] } });
  const result = await f.create().run();
  assert.equal(result.status, 'done');
  assert.equal(result.resources[CF].ignored, 3);
  assert.equal(result.resources[CF].imported, 3);
  assert.deepEqual(Object.keys(f.merges[0].ratings), [URL1, 'https://codeforces.com/problemset/problem/2/01', 'https://codeforces.com/problemset/problem/3/A']);
  assert.equal(JSON.stringify(f.merges).includes('private'), false);
  assert.doesNotThrow(() => service.createClistRatingCacheReader(f.merges[0]));
  assert.equal(JSON.stringify(f.disk()).includes('raw'), false);
});

test('bulk pause waits for queued page, concurrent run deduplicates and restart resumes after merged page', async () => {
  let release;
  const requests = [];
  const f = fixture({ fetchPage: async (resource, offset) => {
    requests.push([resource, offset]);
    if (resource === CF && offset === 0) return new Promise(resolve => { release = () => resolve({ total: 2, rows: [row()] }); });
    return resource === CF ? { total: 2, rows: [row(2, { url: 'https://codeforces.com/problemset/problem/2/A' })] } : { total: 0, rows: [] };
  } });
  const bulk = f.create();
  const running = bulk.run();
  assert.equal(bulk.run(), running);
  assert.equal(bulk.pause().pauseRequested, true);
  assert.equal(f.merges.length, 0);
  release();
  const paused = await running;
  assert.equal(paused.status, 'paused');
  assert.equal(paused.resources[CF].offset, 1);
  assert.equal(paused.resources[CF].lastId, 1);
  assert.equal(f.merges.length, 1);
  assert.equal(requests.length, 1);
  const resumed = await f.create().run();
  assert.equal(resumed.status, 'done');
  assert.deepEqual(requests[1], [CF, 1]);
  assert.equal(resumed.resources[CF].pages, 2);
});

test('failed fetch or merge keeps cursor; cross-page id repeats cannot advance', async () => {
  let mode = 'fetch';
  const f = fixture({ fetchPage: async (resource, offset) => {
    if (resource !== CF) return { total: 0, rows: [] };
    if (offset === 0) return { total: 2, rows: [row()] };
    if (mode === 'fetch') throw new Error('private fake-key');
    return { total: 2, rows: [row(mode === 'order' ? 1 : 2)] };
  }, mergeRatings: () => { if (mode === 'merge') throw new Error('private fake-key'); return { canceled: false, imported: 1, updated: 0 }; } });
  let result = await f.create().run();
  assert.equal(result.status, 'failed');
  assert.equal(result.resources[CF].offset, 1);
  assert.equal(result.resources[CF].lastId, 1);
  assert.equal(result.message.includes('private'), false);
  mode = 'order';
  result = await f.create().run();
  assert.equal(result.resources[CF].offset, 1);
  assert.match(result.message, /跨页顺序/);
  mode = 'merge';
  result = await f.create().run();
  assert.equal(result.resources[CF].offset, 1);
  mode = 'ok';
  result = await f.create().run();
  assert.equal(result.status, 'done');
  assert.equal(result.resources[CF].offset, 2);
});

test('corrupt persisted state is never overwritten, resumed running state is paused and messages are not echoed', async () => {
  for (const value of [null, {}, { schema: 2 }, { ...fixture().create().state(), extra: 'fake-key' }, { ...fixture().create().state(), resources: {} }]) {
    let writes = 0;
    let requests = 0;
    const bulk = fixture({ read: () => value, save: () => { writes++; }, fetchPage: async () => { requests++; throw Error(); } }).create();
    assert.equal((await bulk.run(true)).status, 'failed');
    assert.equal(writes, 0);
    assert.equal(requests, 0);
  }
  const saved = fixture().create().state();
  saved.running = true;
  saved.status = 'running';
  saved.message = 'private fake-key';
  saved.resources[CF].status = 'running';
  const bulk = fixture({ read: () => saved }).create();
  assert.equal(bulk.state().status, 'paused');
  assert.equal(JSON.stringify(bulk.state()).includes('fake-key'), false);
});

test('cursor save failure retries merged page without dropping successful scores', async () => {
  let disk;
  let rejectCursor = true;
  const offsets = [];
  const ratings = {};
  const f = fixture({ read: () => disk, save: value => { if (rejectCursor && value.resources[CF].offset === 1) throw Error('private'); disk = structuredClone(value); },
    fetchPage: async (resource, offset) => { offsets.push([resource, offset]); return resource === CF ? { total: 1, rows: [row()] } : { total: 0, rows: [] }; },
    mergeRatings: doc => { Object.assign(ratings, doc.ratings); return { canceled: false, imported: 1, updated: 0 }; } });
  assert.equal((await f.create().run()).resources[CF].offset, 0);
  assert.equal(ratings[URL1].rating, 1200);
  rejectCursor = false;
  assert.equal((await f.create().run()).status, 'done');
  assert.deepEqual(offsets.slice(0, 2), [[CF, 0], [CF, 0]]);
  assert.equal(Object.keys(ratings).length, 1);
});

test('force resets a paused cursor and invalid short/empty or regressing total pages keep the cursor', async () => {
  const requests = [];
  let bulk;
  const f = fixture({ fetchPage: async (resource, offset) => {
    requests.push([resource, offset]);
    if (resource !== CF) return { total: 0, rows: [] };
    bulk.pause();
    return { total: 2, rows: [row()] };
  } });
  bulk = f.create();
  assert.equal((await bulk.run()).resources[CF].offset, 1);
  assert.equal((await bulk.run(true)).resources[CF].offset, 1);
  assert.deepEqual(requests, [[CF, 0], [CF, 0]]);
  for (const page of [{ total: 0, rows: [] }, { total: 2, rows: [] }, { total: 1, rows: [row(2)] }]) {
    const resumed = f.create({ fetchPage: async () => page });
    const failed = await resumed.run();
    assert.equal(failed.status, 'failed');
    assert.equal(failed.resources[CF].offset, 1);
  }
});

test('safe service HTTP failures survive bulk while untrusted injected errors are suppressed', async () => {
  const f = fixture({ fetchPage: async () => { throw new Error('CLIST 批量评分请求失败（HTTP 429）'); } });
  assert.match((await f.create().run()).message, /HTTP 429/);
  const untrusted = fixture({ fetchPage: async () => { throw new Error('CLIST 批量评分fake-key-private（HTTP 429）'); } });
  assert.equal((await untrusted.create().run()).message.includes('fake-key'), false);
});

test('conflicting duplicate canonical identities do not overwrite a rating', async () => {
  const f = fixture({ fetchPage: async resource => resource === CF ? { total: 3, rows: [row(), row(2, { rating: 1300 }), row(3)] } : { total: 0, rows: [] } });
  const result = await f.create().run();
  assert.equal(result.status, 'done');
  assert.deepEqual(f.merges[0].ratings, {});
  assert.equal(result.resources[CF].ignored, 3);
});

test('bulk feeds real shared-cache merge safely and preserves native local metadata', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-bulk-source-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cacheFile = path.join(directory, 'clist-rating-cache.json');
  fs.writeFileSync(cacheFile, JSON.stringify({ schema: 1, ratings: { [URL1]: { rating: 1000, resource: CF, queriedAt: '2025-01-01T00:00:00.000Z' } }, localMetadata: { nativeRating: 800 } }));
  const shared = createClistSharedCache({ directory, fs, path, now: () => NOW });
  assert.equal(typeof shared.importDocument, 'function');
  const bulk = fixture({ fetchPage: async resource => resource === CF ? { total: 1, rows: [row()] } : { total: 0, rows: [] }, mergeRatings: doc => shared.importDocument(doc) }).create();
  return bulk.run().then(result => {
    assert.equal(result.status, 'done');
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    assert.equal(cache.ratings[URL1].rating, 1200);
    assert.equal(cache.localMetadata.nativeRating, 800);
    assert.equal(result.resources[CF].imported, 1);
  });
});
