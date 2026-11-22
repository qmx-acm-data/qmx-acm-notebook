'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load the TypeScript source directly so this regression does not depend on generated artifacts.
const filename = path.resolve(__dirname, '../src/main/library/difficulty-backfill.cts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { createDifficultyBackfill, ledgerOutcomeCounts, readDifficultyBackfillState, createBackfillOutcomeReader } = loaded.exports;

test('only explicit not-found ledger outcomes identify unlisted problems', () => {
  const base = 'https://atcoder.jp/contests/abc999/tasks/';
  const at = '2026-11-20T12:00:00.000Z';
  const attempts = { [base+'a']: { at, result: 'none', reason: 'not-found' }, [base+'b']: { at, result: 'none', reason: 'no-rating' }, [base+'c']: { at, result: 'none' }, [base+'d']: { at, result: 'error', reason: 'request-error' } };
  const read = createBackfillOutcomeReader({ schema: 1, attempts });
  assert.equal(read(base+'a'), 'not-found');
  assert.equal(read(base+'b'), 'no-rating');
  assert.equal(read(base+'c'), null);
  assert.equal(read(base+'d'), null);
  assert.equal(read(base+'e'), null);
});

const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const iso = value => new Date(value).toISOString();

function urlFor(source, index) {
  if (source === 'AT') return `https://atcoder.jp/contests/abc${index}/tasks/abc${index}_a`;
  if (source === 'CF') return `https://codeforces.com/problemset/problem/${1000 + index}/A`;
  if (source === 'LOJ') return `https://loj.ac/p/${index}`;
  if (source === 'LC') return `https://leetcode.com/problems/two-sum-${index}/`;
  if (source === 'NC') return `https://ac.nowcoder.com/acm/problem/${index}`;
  return `https://www.luogu.com.cn/problem/P${index}`;
}
function rec(source, index, changes = {}) {
  return { id: `${source}:${index}`, source, url: urlFor(source, index), officialDifficulty: null, ...changes };
}
function ledgerOf(attempts) {
  return { schema: 1, attempts };
}
function harness(options = {}) {
  let ledgerValue = options.ledger;
  let stateValue = options.state;
  const writes = { ledger: 0, state: 0 };
  const lookups = [];
  const lookup = options.lookup ?? (async () => ({ rating: 1800, resource: 'test' }));
  const task = createDifficultyBackfill({
    records: options.records ?? [],
    lookup: async url => { lookups.push(url); return lookup(url); },
    readLedger: options.readLedger ?? (() => ledgerValue),
    writeLedger: value => { writes.ledger += 1; ledgerValue = structuredClone(value); },
    readState: options.readState ?? (() => stateValue),
    writeState: value => { writes.state += 1; stateValue = structuredClone(value); },
    now: options.now ?? (() => NOW),
    batchSize: options.batchSize,
    sleep: options.sleep ?? (() => Promise.resolve()),
    shouldPause: options.shouldPause
  });
  return { task, lookups, writes, ledger: () => ledgerValue, state: () => stateValue };
}
const STATE_KEYS = ['status', 'running', 'pauseRequested', 'batchSize', 'processed', 'found', 'notFound', 'noRating', 'skipped', 'failed', 'startedAt', 'finishedAt', 'platforms'];
const platformState = (missing, attempted, found, notFound = 0, noRating = 0, failed = 0) => ({ missing, attempted, found, notFound, noRating, failed });
function assertBatchCounts(state) {
  const platforms = Object.values(state.platforms);
  const sum = field => platforms.reduce((total, platform) => total + platform[field], 0);
  assert.equal(state.processed, sum('attempted'));
  assert.equal(state.processed, state.found + state.notFound + state.noRating + state.failed);
  assert.ok(state.processed <= state.batchSize);
  for (const field of ['found', 'notFound', 'noRating', 'failed']) assert.equal(state[field], sum(field), field);
  for (const platform of platforms) {
    assert.equal(platform.attempted, platform.found + platform.notFound + platform.noRating + platform.failed);
  }
}

test('includes all supported canonical problems regardless of native difficulty and deduplicates aliases', async () => {
  const aliasA = { id: 'CF:alias-a', source: 'CF', url: 'https://codeforces.com/contest/1000/problem/a', officialDifficulty: null };
  const aliasB = { id: 'CF:alias-b', source: 'CF', url: 'https://codeforces.com/problemset/problem/1000/A', officialDifficulty: null };
  const records = [
    rec('AT', 1),
    rec('CF', 1, { officialDifficulty: '1800' }),
    aliasA,
    aliasB,
    rec('LOJ', 1),
    rec('LC', 1),
    rec('NC', 1, { officialDifficulty: '300' }),
    rec('LG', 1, { luoguDifficulty: '暂无评定' }),
    rec('LG', 2, { officialDifficulty: '入门', luoguDifficulty: '入门' }),
    { id: 'BAD:1', source: 'XY', url: 'https://example.com/problem/1', officialDifficulty: null },
    { id: 'BAD:2', source: 'AT', url: 'http://atcoder.jp/contests/abc2/tasks/abc2_a', officialDifficulty: null },
    { id: 'BAD:3', source: 'CF', url: 'https://atcoder.jp/contests/abc3/tasks/abc3_a', officialDifficulty: null },
    { id: 'BAD:4', source: 'AT', url: 'not a url', officialDifficulty: null }
  ];
  const h = harness({ records, batchSize: 50 });
  const state = await h.task.run();
  assert.deepEqual(h.lookups, [
    urlFor('AT', 1),
    'https://codeforces.com/problemset/problem/1000/A',
    urlFor('CF', 1),
    urlFor('LOJ', 1),
    urlFor('LC', 1),
    urlFor('NC', 1),
    urlFor('LG', 1),
    urlFor('LG', 2)
  ]);
  assert.equal(state.status, 'done');
  assert.equal(state.processed, 8);
  assert.equal(state.found, 8);
  assert.equal(state.platforms.AT.missing, 1);
  assert.equal(state.platforms.CF.missing, 2, 'alias rows share one canonical candidate');
  assert.equal(state.platforms.LOJ.missing, 1);
  assert.equal(state.platforms.LC.missing, 1);
  assert.equal(state.platforms.LG.missing, 2);
  assert.equal(state.platforms.NC.missing, 1);
  assertBatchCounts(state);
});

test('native CF, LC, LG and explicit AT community values are queried without mutating the snapshot', async () => {
  const records = [
    rec('CF', 1, { officialDifficulty: '1200', rating: 1200, clistRating: null }),
    rec('LC', 1, { officialDifficulty: 'Medium', clistRating: null }),
    rec('LG', 1, { officialDifficulty: '入门', luoguDifficulty: '入门', clistRating: null }),
    rec('AT', 1, { officialDifficulty: '377', rating: 377, clistRating: null })
  ];
  const before = structuredClone(records);
  for (const record of records) Object.freeze(record);
  Object.freeze(records);
  const h = harness({ records });
  const state = await h.task.run();
  assert.deepEqual(h.lookups, [urlFor('AT', 1), urlFor('CF', 1), urlFor('LC', 1), urlFor('LG', 1)]);
  assert.equal(state.processed, 4);
  assert.equal(state.skipped, 0);
  assert.deepEqual(records, before, 'native/community source values and cache snapshot remain unchanged');
  assertBatchCounts(state);
});

test('positive cache and legacy found rows skip lookup while uncached new problems still enter a fresh batch', async () => {
  const legacy = rec('CF', 1, { officialDifficulty: '1200' });
  const cached = rec('AT', 1, { clistRating: 377 });
  const newProblem = rec('CF', 2, { officialDifficulty: '1200', clistRating: null });
  const h = harness({
    records: [legacy, cached, newProblem],
    batchSize: 1,
    state: { processed: 100, found: 100, skipped: 0 },
    ledger: ledgerOf({ [legacy.url]: { at: iso(NOW - 3650 * DAY), result: 'found' } })
  });
  const state = await h.task.run();
  assert.deepEqual(h.lookups, [newProblem.url]);
  assert.equal(state.skipped, 2);
  assert.equal(state.processed, 1);
  assert.equal(state.found, 1);
  assert.equal(Object.hasOwn(h.ledger().attempts, cached.url), false, 'cache skips do not fabricate ledger outcomes');
  assert.equal(state.platforms.AT.missing, 1);
  assert.equal(state.platforms.AT.attempted, 0);
  assert.equal(state.platforms.CF.missing, 2);
  assertBatchCounts(state);
});

test('authoritative null/zero cache misses retry found ledger rows while undefined keeps legacy skips', async () => {
  const records = [
    rec('AT', 1, { clistRating: null }),
    rec('AT', 2, { clistRating: 0 }),
    rec('AT', 3),
    rec('AT', 4, { clistRating: undefined }),
    rec('AT', 5, { clistRating: 900 })
  ];
  const attempts = Object.fromEntries(records.map(record => [record.url, { at: iso(NOW), result: 'found' }]));
  const h = harness({ records, ledger: ledgerOf(attempts) });
  const state = await h.task.run();
  assert.deepEqual(h.lookups, [records[0].url, records[1].url]);
  assert.equal(state.processed, 2);
  assert.equal(state.skipped, 3);
  assert.equal(state.found, 2);
  assertBatchCounts(state);
});

test('positive cache skips lookup even when the ledger would otherwise retry', async () => {
  for (const entry of [undefined, { at: iso(NOW - 31 * DAY), result: 'none', reason: 'no-rating' }, { at: iso(NOW - 2 * DAY), result: 'error', reason: 'request-error' }]) {
    const record = rec('CF', 1, { rating: 1200, clistRating: 377 });
    const h = harness({ records: [record], ledger: entry ? ledgerOf({ [record.url]: entry }) : undefined });
    const state = await h.task.run();
    assert.deepEqual(h.lookups, []);
    assert.equal(state.skipped, 1);
    assert.equal(state.processed, 0);
    assert.equal(state.found, 0, 'cached historical ratings do not count as current batch findings');
    assert.equal(h.writes.ledger, 0);
    assertBatchCounts(state);
  }
});

test('CF 921 numeric candidates preserve leading zeros, deduplicate contest aliases and isolate gym ledgers', async () => {
  const cf = (id, url) => ({ id, source: 'CF', url, officialDifficulty: null });
  const one = 'https://codeforces.com/problemset/problem/921/01';
  const fourteen = 'https://codeforces.com/problemset/problem/921/14';
  const gym = 'https://codeforces.com/gym/921/problem/01';
  const records = [
    cf('CF92101', one),
    cf('CF92101-alias', 'https://contest.codeforces.com/contest/921/problem/01/?locale=en'),
    cf('CF92114', 'https://codeforces.com/contest/921/problem/14'),
    cf('CF9211', 'https://codeforces.com/problemset/problem/921/1'),
    cf('GYM92101', gym),
    cf('invalid-extra', `${one}/extra`),
    cf('invalid-dot', `${fourteen}.json`),
    cf('invalid-index', `${fourteen}_extra`),
    cf('invalid-prefix', 'https://codeforces.com/prefix/contest/921/problem/14'),
    cf('invalid-contest', 'https://codeforces.com/contest/921/14'),
    cf('invalid-problemset', 'https://codeforces.com/problemset/problem/921/problem/01'),
    cf('invalid-gym', `${gym}/extra`),
    cf('invalid-host', 'https://unsupported.codeforces.com/contest/921/problem/14')
  ];
  const h = harness({ records });
  const state = await h.task.run();
  assert.deepEqual(h.lookups, [one, 'https://codeforces.com/problemset/problem/921/1', fourteen, gym]);
  assert.deepEqual(state.platforms.CF, platformState(4, 4, 4));
  assert.deepEqual(Object.keys(h.ledger().attempts), h.lookups);
  const restarted = harness({ records, ledger: h.ledger() });
  const resumed = await restarted.task.run();
  assert.deepEqual(restarted.lookups, []);
  assert.equal(resumed.skipped, 4, 'numeric and gym ledger keys survive strict validation');
  const isolated = harness({ records: [cf('GYM92101', gym)], ledger: ledgerOf({ [one]: { at: iso(NOW), result: 'found' } }) });
  await isolated.task.run();
  assert.deepEqual(isolated.lookups, [gym], 'contest found entries cannot suppress a gym candidate');
});

test('stops at batchSize and reports the remaining count', async () => {
  const records = [rec('AT', 5), rec('CF', 1), rec('LOJ', 4), rec('LC', 3), rec('LG', 2)];
  const h = harness({ records, batchSize: 2 });
  const state = await h.task.run();
  assert.equal(state.status, 'done');
  assert.equal(state.running, false);
  assert.equal(state.batchSize, 2);
  assert.equal(state.processed, 2);
  assert.equal(state.found, 2);
  assert.equal(h.lookups.length, 2);
  assert.match(state.message, /剩余 3 题/);
  assert.equal(state.platforms.AT.attempted, 1);
  assert.equal(state.platforms.CF.attempted, 1);
  assert.equal(state.platforms.LG.attempted, 0);
  assert.equal(Object.keys(h.ledger().attempts).length, 2);
  assert.equal(state.startedAt, iso(NOW));
  assert.equal(state.finishedAt, iso(NOW));
});

test('shouldPause pauses after a processed row and a later run resumes from the ledger', async () => {
  const records = [rec('AT', 1), rec('CF', 2), rec('LOJ', 3), rec('LC', 4)];
  let calls = 0;
  const first = harness({
    records,
    batchSize: 10,
    lookup: async () => { calls += 1; return { rating: 1800, resource: 'test' }; },
    shouldPause: () => calls >= 2
  });
  const paused = await first.task.run();
  assert.equal(first.lookups.length, 2);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.running, false);
  assert.equal(paused.pauseRequested, true);
  assert.equal(paused.processed, 2);
  assert.equal(paused.found, 2);
  assert.match(paused.message, /已暂停/);
  assert.match(paused.message, /剩余 2 题/);
  assert.deepEqual(first.state(), paused);

  const second = harness({ records, batchSize: 10, ledger: first.ledger(), state: first.state(), now: () => NOW + HOUR });
  const resumed = await second.task.run();
  assert.equal(second.lookups.length, 2, 'found ledger entries are never queried again');
  assert.equal(resumed.status, 'done');
  assert.equal(resumed.processed, 2);
  assert.equal(resumed.found, 2);
  assert.equal(resumed.skipped, 2, 'ledger skips are reported for this run');
  assert.equal(resumed.startedAt, iso(NOW + HOUR), 'continued work starts a new batch');
  assertBatchCounts(paused);
  assertBatchCounts(resumed);
  assert.equal(Object.keys(second.ledger().attempts).length, 4);
});

test('pause after eight attempts starts a separate three-attempt batch and preserves continuation', async () => {
  const sources = ['AT', 'CF', 'LOJ', 'LC', 'NC', 'LG'];
  const records = Array.from({ length: 11 }, (_, index) => rec(sources[index % sources.length], index + 1));
  const results = [
    { rating: 377, resource: 'test' },
    { rating: null, resource: 'test', error: 'CLIST 未收录该题' },
    { rating: 0, resource: 'test' },
    { rating: null, resource: 'test', error: 'CLIST 请求失败' }
  ];
  let calls = 0;
  const first = harness({
    records, batchSize: 100,
    lookup: async () => results[calls++ % results.length],
    shouldPause: () => calls >= 8
  });
  const paused = await first.task.run();
  assert.equal(paused.status, 'paused');
  assert.equal(paused.processed, 8);
  for (const field of ['found', 'notFound', 'noRating', 'failed']) assert.equal(paused[field], 2);
  assertBatchCounts(paused);

  let nextCalls = 0;
  const second = harness({
    records, batchSize: 100, ledger: first.ledger(), state: first.state(), now: () => NOW + HOUR,
    lookup: async () => results[nextCalls++ % 3]
  });
  const continued = await second.task.run();
  assert.equal(continued.status, 'done');
  assert.equal(continued.processed, 3);
  assert.equal(continued.found, 1);
  assert.equal(continued.notFound, 1);
  assert.equal(continued.noRating, 1);
  assert.equal(continued.failed, 0);
  assert.equal(continued.skipped, 8);
  assert.equal(continued.startedAt, iso(NOW + HOUR));
  assert.equal(Object.keys(second.ledger().attempts).length, 11);
  assert.equal(second.lookups.some(url => first.lookups.includes(url)), false);
  assertBatchCounts(continued);
  assert.equal(first.state().status, 'paused', 'the persisted previous batch is not mutated');
});

test('new runs reset all counters and keep the batch bound even after a full paused batch', async () => {
  const records = Array.from({ length: 205 }, (_, index) => rec('AT', index + 1));
  let calls = 0;
  const first = harness({ records, batchSize: 100, lookup: async () => { calls += 1; return { rating: 377, resource: 'test' }; }, shouldPause: () => calls >= 100 });
  const paused = await first.task.run();
  assert.equal(paused.processed, 100);
  const second = harness({ records, batchSize: 100, ledger: first.ledger(), state: first.state(), now: () => NOW + HOUR });
  const next = await second.task.run();
  assert.equal(next.processed, 100);
  assert.equal(next.skipped, 100);
  assert.equal(next.found, 100);
  assert.equal(next.startedAt, iso(NOW + HOUR));
  assert.match(next.message, /剩余 5 题/);
  assertBatchCounts(paused);
  assertBatchCounts(next);
});

test('records found, none and error results in the ledger', async () => {
  const records = [rec('AT', 1), rec('CF', 2), rec('LOJ', 3), rec('NC', 4)];
  const outcomes = new Map([
    [urlFor('AT', 1), { rating: 1800, resource: 'test' }],
    [urlFor('CF', 2), { rating: null, resource: 'test' }],
    [urlFor('LOJ', 3), { rating: null, resource: 'test', error: 'CLIST 未找到唯一匹配题目' }],
    [urlFor('NC', 4), { rating: null, resource: 'test', error: 'CLIST 未收录该题' }]
  ]);
  const h = harness({ records, batchSize: 10, lookup: async url => outcomes.get(url) });
  const state = await h.task.run();
  assert.equal(state.status, 'done');
  assert.equal(state.processed, 4);
  assert.equal(state.found, 1);
  assert.equal(state.failed, 1);
  assert.deepEqual(h.ledger().attempts[urlFor('AT', 1)], { at: iso(NOW), result: 'found' });
  assert.equal(state.notFound, 1);
  assert.equal(state.noRating, 1);
  assertBatchCounts(state);
  assert.deepEqual(h.ledger().attempts[urlFor('CF', 2)], { at: iso(NOW), result: 'none', reason: 'no-rating' });
  assert.deepEqual(h.ledger().attempts[urlFor('LOJ', 3)], { at: iso(NOW), result: 'error', reason: 'request-error' });
  assert.deepEqual(h.ledger().attempts[urlFor('NC', 4)], { at: iso(NOW), result: 'none', reason: 'not-found' }, 'missing CLIST coverage uses the long retry interval');
});

test('classifies positive low ratings, zero, missing records, absent ratings and request errors independently', async () => {
  const cases = [
    [{ rating: 377, resource: 'test' }, 'found'],
    [{ rating: 0, resource: 'test' }, 'noRating'],
    [{ rating: null, resource: 'test', error: 'CLIST 未收录该题' }, 'notFound'],
    [{ rating: null, resource: 'test', error: 'CLIST 暂无评分数据' }, 'noRating'],
    [{ rating: null, resource: 'test', error: 'CLIST 题目评分未知' }, 'noRating'],
    [{ rating: null, resource: 'test', noData: true }, 'noRating'],
    [{ rating: null, resource: 'test' }, 'noRating'],
    [null, 'noRating'],
    [undefined, 'noRating'],
    [{ rating: -1, resource: 'test' }, 'failed'],
    [{ rating: NaN, resource: 'test' }, 'failed'],
    [{ rating: null, resource: 'test', error: '不支持的题目 URL' }, 'failed'],
    [{ rating: null, resource: 'test', error: 'CLIST 请求超时' }, 'failed']
  ];
  for (const [result, field] of cases) {
    const h = harness({ records: [rec('AT', 1)], lookup: async () => result });
    const state = await h.task.run();
    assert.equal(state[field], 1, `${JSON.stringify(result)} => ${field}`);
    assert.equal(state.skipped, 0);
    assertBatchCounts(state);
  }
});

test('reason-bearing and legacy ledger rows share unchanged retry periods without counting historical outcomes', async () => {
  const entries = [
    ['none', 'not-found', 29 * DAY, false],
    ['none', 'not-found', 30 * DAY, true],
    ['none', 'no-rating', 29 * DAY, false],
    ['none', 'no-rating', 30 * DAY, true],
    ['error', 'request-error', 23 * HOUR, false],
    ['error', 'request-error', DAY, true]
  ];
  for (const [result, reason, age, due] of entries) {
    const entry = { at: iso(NOW - age), result, reason };
    const h = harness({ records: [rec('AT', 1, { clistRating: null })], ledger: ledgerOf({ [urlFor('AT', 1)]: entry }) });
    const state = await h.task.run();
    assert.equal(state.processed, due ? 1 : 0);
    assert.equal(state.skipped, due ? 0 : 1);
    assert.equal(state.notFound, 0);
    assert.equal(state.noRating, 0);
    assert.equal(state.failed, 0);
    if (!due) assert.deepEqual(h.ledger().attempts[urlFor('AT', 1)], entry);
    assertBatchCounts(state);
  }
});

test('read-only ledger audit leaves old none outcomes unclassified and rejects malformed ledgers', () => {
  const ledger = ledgerOf({
    [urlFor('AT', 1)]: { at: iso(NOW), result: 'found' },
    [urlFor('CF', 2)]: { at: iso(NOW), result: 'none' },
    [urlFor('LOJ', 3)]: { at: iso(NOW), result: 'none', reason: 'not-found' },
    [urlFor('LC', 4)]: { at: iso(NOW), result: 'none', reason: 'no-rating' },
    [urlFor('NC', 5)]: { at: iso(NOW), result: 'error' },
    [urlFor('LG', 6)]: { at: iso(NOW), result: 'error', reason: 'request-error' }
  });
  const before = structuredClone(ledger);
  assert.deepEqual(ledgerOutcomeCounts(ledger), { found: 1, notFound: 1, noRating: 1, failed: 2, unclassified: 1 });
  assert.deepEqual(ledger, before);
  assert.deepEqual(ledgerOutcomeCounts(undefined), { found: 0, notFound: 0, noRating: 0, failed: 0, unclassified: 0 });
  assert.throws(() => ledgerOutcomeCounts({ schema: 2, attempts: {} }), /损坏|版本/);
});

test('found is permanent, none retries after 30 days and error after one day', async () => {
  const url = urlFor('LOJ', 1);
  const cases = [
    ['none', 29 * DAY, false],
    ['none', 30 * DAY, true],
    ['error', 23 * HOUR, false],
    ['error', 24 * HOUR, true],
    ['found', 3650 * DAY, false]
  ];
  for (const [result, age, due] of cases) {
    const seed = { at: iso(NOW - age), result };
    const h = harness({ records: [rec('LOJ', 1)], batchSize: 10, ledger: ledgerOf({ [url]: seed }) });
    const state = await h.task.run();
    if (due) {
      assert.equal(h.lookups.length, 1, `${result} age ${age} must retry`);
      assert.equal(state.processed, 1);
      assert.equal(state.skipped, 0);
      assert.deepEqual(h.ledger().attempts[url], { at: iso(NOW), result: 'found' });
    } else {
      assert.equal(h.lookups.length, 0, `${result} age ${age} must be skipped`);
      assert.equal(state.processed, 0);
      assert.equal(state.skipped, 1);
      assert.equal(state.status, 'done');
      assert.equal(state.message, '没有需要补全 CLIST 缓存的题目');
      assert.deepEqual(h.ledger().attempts[url], seed);
    }
  }
});

test('lookup exceptions become ledger errors without leaking exception text', async () => {
  const h = harness({
    records: [rec('AT', 1)],
    batchSize: 10,
    lookup: async () => { throw new Error('ApiKey account:secret-token'); }
  });
  const state = await h.task.run();
  assert.equal(state.status, 'done');
  assert.equal(state.processed, 1);
  assert.equal(state.failed, 1);
  assert.equal(state.found, 0);
  assert.deepEqual(h.ledger().attempts[urlFor('AT', 1)], { at: iso(NOW), result: 'error', reason: 'request-error' });
  assert.doesNotMatch(JSON.stringify(state), /secret-token/);
  assert.doesNotMatch(JSON.stringify(h.ledger()), /secret-token/);
});

test('corrupt or unreadable ledgers are rejected before any write', async () => {
  const url = urlFor('CF', 1);
  const bad = [
    null,
    false,
    [],
    {},
    { schema: 2, attempts: {} },
    { schema: 1, attempts: [] },
    { schema: 1, attempts: { [url]: {} } },
    { schema: 1, attempts: { [url]: { at: iso(NOW), result: 'maybe' } } },
    { schema: 1, attempts: { [url]: { at: 'yesterday', result: 'found' } } },
    { schema: 1, attempts: { [url]: { at: iso(NOW), result: 'found', extra: 1 } } },
    { schema: 1, attempts: { [url]: { at: iso(NOW), result: 'found', reason: 'no-rating' } } },
    { schema: 1, attempts: { [url]: { at: iso(NOW), result: 'none', reason: 'request-error' } } },
    { schema: 1, attempts: { [url]: { at: iso(NOW), result: 'error', reason: 'not-found' } } },
    { schema: 1, attempts: { [url]: { at: iso(NOW), result: 'none', reason: 'unknown' } } },
    { schema: 1, attempts: { [url]: { at: iso(NOW), result: 'none', reason: null } } },
    { schema: 1, attempts: { [url]: { result: 'found' } } },
    { schema: 1, attempts: { 'https://codeforces.com/contest/1000/problem/A': { at: iso(NOW), result: 'found' } } },
    { schema: 1, attempts: { 'https://evil.test/problem/1': { at: iso(NOW), result: 'found' } } }
  ];
  for (const initial of bad) {
    const h = harness({ records: [rec('CF', 1)], ledger: structuredClone(initial) });
    const before = h.ledger();
    await assert.rejects(() => h.task.run(), /损坏|版本/);
    assert.equal(h.writes.ledger, 0);
    assert.equal(h.writes.state, 0);
    assert.equal(h.ledger(), before, 'a damaged ledger must never be overwritten');
  }
  const throwing = harness({ records: [rec('CF', 1)], readLedger: () => { throw new Error('invalid JSON'); } });
  await assert.rejects(() => throwing.task.run(), /读取失败/);
  assert.equal(throwing.writes.ledger, 0);
});

test('preserves unknown ledger root fields while appending attempts', async () => {
  const seed = { schema: 1, futureRoot: { version: 2 }, attempts: {} };
  const h = harness({ records: [rec('AT', 1)], ledger: seed, batchSize: 10 });
  await h.task.run();
  const written = h.ledger();
  assert.equal(written.schema, 1);
  assert.deepEqual(written.futureRoot, { version: 2 });
  assert.deepEqual(written.attempts[urlFor('AT', 1)], { at: iso(NOW), result: 'found' });
  assert.equal(seed.futureRoot.version, 2, 'the read snapshot is not mutated');
});

test('state matches the shared shape for idle and completed runs', async () => {
  const idle = harness({ records: [] }).task.state();
  assert.deepEqual(Object.keys(idle).sort(), [...STATE_KEYS].sort());
  assert.equal(idle.status, 'idle');
  assert.equal(idle.running, false);
  assert.equal(idle.pauseRequested, false);
  assert.equal(idle.batchSize, 50);
  assert.equal(idle.startedAt, null);
  assert.deepEqual(Object.keys(idle.platforms).sort(), ['AT', 'CF', 'LC', 'LG', 'LOJ', 'NC']);
  for (const key of Object.keys(idle.platforms)) assert.deepEqual(idle.platforms[key], platformState(0, 0, 0));

  const records = ['AT', 'CF', 'LOJ', 'LC', 'NC', 'LG'].map((source, index) => rec(source, index + 1));
  const h = harness({ records, batchSize: 100 });
  const state = await h.task.run();
  assert.deepEqual(Object.keys(state).sort(), [...STATE_KEYS, 'message'].sort());
  assert.equal(state.status, 'done');
  assert.equal(state.running, false);
  assert.equal(state.pauseRequested, false);
  assert.equal(state.batchSize, 100);
  assert.equal(state.processed, 6);
  assert.equal(state.found, 6);
  assert.equal(state.skipped, 0);
  assert.equal(state.failed, 0);
  assert.equal(state.startedAt, iso(NOW));
  assert.equal(state.finishedAt, iso(NOW));
  assert.match(state.message, /剩余 0 题/);
  for (const key of ['AT', 'CF', 'LOJ', 'LC', 'NC', 'LG']) {
    assert.deepEqual(state.platforms[key], platformState(1, 1, 1));
  }
  assert.deepEqual(h.task.state(), state);
  state.platforms.AT.missing = 999;
  assert.equal(h.task.state().platforms.AT.missing, 1, 'returned states are isolated copies');
});

test('historical display state preserves absent outcome provenance and never rewrites persisted data', () => {
  const old = {
    status: 'paused', running: false, pauseRequested: true, batchSize: 100,
    processed: 113, found: 11, skipped: 102, failed: 2,
    startedAt: iso(NOW - DAY), finishedAt: iso(NOW),
    platforms: { AT: { missing: 1000, attempted: 3, found: 1 }, CF: { missing: -1, attempted: 2.9, found: NaN } }
  };
  const h = harness({ state: old });
  const view = h.task.state();
  assert.equal(view.processed, 113, 'old inconsistent totals remain detectable by the renderer');
  assert.equal(view.found, 11);
  assert.equal(Object.hasOwn(view, 'notFound'), false);
  assert.equal(Object.hasOwn(view, 'noRating'), false);
  assert.deepEqual(view.platforms.AT, { missing: 1000, attempted: 3, found: 1 });
  assert.deepEqual(view.platforms.CF, { missing: 0, attempted: 2, found: 0 });
  assert.equal(h.writes.state, 0);
  assert.equal(h.writes.ledger, 0);
  assert.equal(h.state(), old);
});

test('display state safely parses all new outcome fields and preserves isolated snapshots', () => {
  const h = harness({ state: {
    status: 'done', processed: 4, found: 1, failed: 1, notFound: 1.9, noRating: 1,
    platforms: { AT: { missing: 4, attempted: 4, found: 1, notFound: 1, noRating: 1, failed: 1 }, CF: { notFound: -4, noRating: Infinity, failed: 'bad' } }
  } });
  const state = h.task.state();
  assert.equal(state.notFound, 1);
  assert.equal(state.noRating, 1);
  assert.deepEqual(state.platforms.AT, platformState(4, 4, 1, 1, 1, 1));
  assert.deepEqual(state.platforms.CF, platformState(0, 0, 0));
  state.platforms.AT.failed = 999;
  assert.equal(h.task.state().platforms.AT.failed, 1);
  assert.equal(h.writes.state, 0);
});

test('read-only state recovery restores legacy counters and leaves interrupted-worker status to the parent', () => {
  const old = {
    status: 'running', running: true, pauseRequested: false, batchSize: 100,
    processed: 113, found: 11, skipped: 102, failed: 2,
    startedAt: iso(NOW - DAY), finishedAt: null,
    platforms: { AT: { missing: 1000, attempted: 3, found: 1 } }
  };
  const before = structuredClone(old);
  const recovered = readDifficultyBackfillState(old);
  assert.equal(recovered.processed, 113);
  assert.equal(recovered.found, 11);
  assert.equal(recovered.skipped, 102);
  assert.equal(recovered.startedAt, old.startedAt);
  assert.equal(recovered.status, 'running');
  assert.equal(recovered.running, true, 'only the parent knows whether a worker exists');
  assert.equal(Object.hasOwn(recovered, 'notFound'), false);
  assert.equal(Object.hasOwn(recovered, 'noRating'), false);
  assert.deepEqual(recovered.platforms.AT, { missing: 1000, attempted: 3, found: 1 });
  recovered.platforms.AT.found = 999;
  assert.deepEqual(old, before, 'recovered state is detached from storage');
  for (const invalid of [undefined, null, false, [], 'bad']) {
    const fallback = readDifficultyBackfillState(invalid);
    assert.equal(fallback.status, 'idle');
    assert.equal(fallback.batchSize, 100);
    assertBatchCounts(fallback);
  }
  assert.equal(readDifficultyBackfillState(undefined, 12).batchSize, 12);
});

test('orders platforms AT, CF, LOJ, LC, NC, LG and sorts ids inside a platform', async () => {
  const records = [rec('LG', 2), rec('CF', 9), rec('AT', 5), rec('NC', 1), rec('LC', 3), rec('LOJ', 4), rec('CF', 1)];
  const batched = harness({ records, batchSize: 3 });
  const state = await batched.task.run();
  assert.deepEqual(batched.lookups, [urlFor('AT', 5), urlFor('CF', 1), urlFor('CF', 9)]);
  assert.equal(state.status, 'done');
  assert.match(state.message, /剩余 4 题/);

  const all = harness({ records, batchSize: 100 });
  await all.task.run();
  assert.deepEqual(all.lookups, [
    urlFor('AT', 5),
    urlFor('CF', 1),
    urlFor('CF', 9),
    urlFor('LOJ', 4),
    urlFor('LC', 3),
    urlFor('NC', 1),
    urlFor('LG', 2)
  ]);
});

test('prioritizes missing native difficulty within each platform before native/community values', async () => {
  const records = [
    rec('CF', 1, { officialDifficulty: '1200', clistRating: null }),
    rec('LC', 1, { officialDifficulty: 'Medium', clistRating: null }),
    rec('AT', 1, { officialDifficulty: '377', clistRating: null }),
    rec('CF', 9, { clistRating: null }),
    rec('AT', 9, { clistRating: null }),
    rec('LC', 9, { clistRating: null })
  ];
  const h = harness({ records });
  const state = await h.task.run();
  assert.deepEqual(h.lookups, [urlFor('AT', 9), urlFor('AT', 1), urlFor('CF', 9), urlFor('CF', 1), urlFor('LC', 9), urlFor('LC', 1)]);
  assertBatchCounts(state);
});

test('finishes immediately when no record has a supported canonical problem URL', async () => {
  const records = [
    { id: 'BAD:1', source: 'XY', url: 'https://example.com/problem/1', officialDifficulty: null },
    rec('AT', 1, { officialDifficulty: '800', url: 'https://atcoder.jp/not-a-problem' }),
    rec('CF', 2, { officialDifficulty: '1800', url: 'https://unsupported.codeforces.com/problemset/problem/1002/A' })
  ];
  const h = harness({ records, batchSize: 10 });
  const state = await h.task.run();
  assert.equal(state.status, 'done');
  assert.equal(state.processed, 0);
  assert.equal(state.found, 0);
  assert.equal(state.skipped, 0);
  assert.equal(state.running, false);
  assert.equal(state.message, '本地题库没有需要补全 CLIST 缓存的题目');
  assert.equal(h.lookups.length, 0);
  assert.equal(h.writes.ledger, 0);
});

test('scans a full 60918-row library snapshot in one pass', async () => {
  const platforms = ['AT', 'CF', 'LOJ', 'LC', 'NC', 'LG'];
  const records = [];
  for (let index = 0; index < 60918; index += 1) records.push(rec(platforms[index % platforms.length], index + 1));
  const h = harness({ records, batchSize: 5 });
  const state = await h.task.run();
  assert.equal(state.status, 'done');
  assert.equal(state.processed, 5);
  assert.match(state.message, /剩余 60913 题/);
  assert.equal(h.lookups.length, 5);
  for (const key of platforms) {
    assert.equal(state.platforms[key].missing, 10153);
    assert.equal(state.platforms[key].attempted, key === 'AT' ? 5 : 0);
  }
});
