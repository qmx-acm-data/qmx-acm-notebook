'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appPath } = require('./app-path.cjs');
const { createLibraryLoader, toLibraryProblem } = require(appPath('electron/library-index.cjs'));

function makeDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-library-'));
  for (const [name, value] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), value);
  return dir;
}
const row = overrides => JSON.stringify({
  id: 'CF:1A', platform: 'CF', title: 'Problem', url: 'https://codeforces.com/problemset/problem/1/A',
  rating: 800, estimatedCfRating: 800, estimatedLuoguDifficulty: '入门', tags: ['二分'], ...overrides
});

test('library loader reads shards, keeps valid rows and reports build time', () => {
  const dir = makeDir({
    'meta.json': JSON.stringify({ schema: 1, builtAt: '2026-11-20T07:00:00.000Z', totalCount: 3 }),
    'cf.ndjson': [row({}), row({ id: 'CF:1B', rating: null })].join('\n') + '\n',
    'at.ndjson': row({ id: 'AT:ABC100_A', platform: 'AT', url: 'https://atcoder.jp/contests/abc100/tasks/abc100_a' }) + '\n'
  });
  const loader = createLibraryLoader(dir, fs, path);
  const snapshot = loader.load();
  assert.equal(snapshot.records.length, 3);
  assert.equal(snapshot.builtAt, '2026-11-20T07:00:00.000Z');
  assert.deepEqual(snapshot.counts, { CF: 2, AT: 1 });
  const byId = new Map(snapshot.records.map(record => [record.id, record]));
  assert.equal(byId.get('CF:1B').rating, null);
  assert.equal(byId.get('CF:1A').origin, 'library');
  assert.deepEqual(byId.get('CF:1A').tags, ['二分']);
});

test('library loader rejects unsafe or unsupported rows and survives broken json', () => {
  const dir = makeDir({
    'meta.json': JSON.stringify({ builtAt: '2026-11-20T07:00:00.000Z' }),
    'cf.ndjson': [
      row({}),
      row({ id: 'CF:1B', platform: 'XX' }),
      row({ id: 'CF:1C', url: 'http://codeforces.com/problemset/problem/1/C' }),
      row({ id: 'CF:1D', url: 'https://user:pass@codeforces.com/problemset/problem/1/D' }),
      row({ id: 'CF:1E', title: '' }),
      '{not json'
    ].join('\n') + '\n'
  });
  const snapshot = createLibraryLoader(dir, fs, path).load();
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.records[0].id, 'CF:1A');
  assert.equal(toLibraryProblem({ id: 'x', platform: 'CF', title: 't', url: 'ftp://x' }), null);
});

test('library loader limits reads to the requested platform shards', () => {
  const dir = makeDir({
    'meta.json': JSON.stringify({ builtAt: '2026-11-20T07:00:00.000Z' }),
    'cf.ndjson': row({}) + '\n',
    'lg.ndjson': row({ id: 'LG:P1', platform: 'LG', url: 'https://www.luogu.com.cn/problem/P1' }) + '\n'
  });
  const loader = createLibraryLoader(dir, fs, path);
  const onlyLuogu = loader.load(['LG']);
  assert.equal(onlyLuogu.records.length, 1);
  assert.deepEqual(onlyLuogu.counts, { LG: 1 });
  const all = loader.load();
  assert.equal(all.records.length, 2);
  assert.deepEqual(all.counts, { CF: 1, LG: 1 });
});

test('library loader returns an empty snapshot when no index exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-library-empty-'));
  const snapshot = createLibraryLoader(dir, fs, path).load();
  assert.deepEqual(snapshot, { records: [], builtAt: null, counts: {} });
});
