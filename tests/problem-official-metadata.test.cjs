'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Keep this source regression independent of generated application artifacts.
const sources = new Map([
  ['./library-normalize.cjs', 'src/main/library/normalize.cts'],
  ['./library-index.cjs', 'src/main/library/index.cts'],
  ['./library-sync.cjs', 'src/main/library/sync.cts'],
  ['./daily-problems.cjs', 'src/main/contests/daily-problems.cts'],
  ['./libreoj-daily.cjs', 'src/main/contests/libreoj-daily.cts']
]);
const modules = new Map();
function loadSource(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (modules.has(filename)) return modules.get(filename).exports;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  modules.set(filename, loaded);
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = request => {
    if (request === '../ui/tag-presets.js') return require('../ui/tag-presets.js');
    if (request === '../ui/luogu-tags.json') return require('../ui/luogu-tags.json');
    return sources.has(request) ? loadSource(sources.get(request)) : originalRequire(request);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  loaded._compile(compiled.outputText, filename);
  return loaded.exports;
}
const { createNormalizer, toDrawProblem } = loadSource(sources.get('./library-normalize.cjs'));
const { toLibraryProblem, createLibraryLoader, buildDailyTagCatalog } = loadSource(sources.get('./library-index.cjs'));
const { createSync } = loadSource(sources.get('./library-sync.cjs'));
const { parseLeetCode } = loadSource(sources.get('./daily-problems.cjs'));
const normalizer = createNormalizer(rating => rating === null ? null : '参考难度');
const raw = (source, changes = {}) => ({
  id: `${source}:1`, source, title: 'Metadata fixture', url: 'https://example.com/problem/1',
  rating: null, estimatedCfRating: 2200, luoguDifficulty: '', tags: ['dp'], ...changes
});
const indexRow = (source, changes = {}) => {
  const { source: ignored, ...row } = raw(source, changes);
  return { ...row, platform: source };
};
const lcPayload = difficulties => ({ data: { problemsetQuestionList: {
  total: difficulties.length,
  questions: difficulties.map((difficulty, index) => ({
    frontendQuestionId: String(index + 1), title: `LC ${index + 1}`, titleSlug: `lc-${index + 1}`,
    difficulty, paidOnly: false, topicTags: [{ name: 'Array' }]
  }))
} } });

// All index and sync writes stay in memory; no user or formal library is touched.
function memoryFs(initial = {}) {
  const files = new Map(Object.entries(initial).map(([name, body]) => [path.resolve('/official-fixture', name), body]));
  const writes = [];
  return {
    files, writes,
    mkdirSync() {},
    readFileSync(filename) {
      const key = path.resolve(filename);
      if (!files.has(key)) throw Error(`ENOENT ${key}`);
      return files.get(key);
    },
    writeFileSync(filename, body) {
      writes.push(path.resolve(filename));
      files.set(path.resolve(filename), body);
    },
    renameSync(from, to) {
      files.set(path.resolve(to), files.get(path.resolve(from)));
      files.delete(path.resolve(from));
    },
    statSync(filename) {
      const body = files.get(path.resolve(filename));
      if (body === undefined) throw Error('ENOENT');
      return { mtimeMs: 1000, size: Buffer.byteLength(body) };
    },
    readdirSync(directory) {
      return [...files.keys()].filter(name => path.dirname(name) === path.resolve(directory)).map(name => path.basename(name));
    }
  };
}

test('explicit official metadata survives normalization, persistence and draw conversion', () => {
  for (const tier of ['Easy', 'Medium', 'Hard']) {
    const input = raw('LC', { officialTags: ['Array', '2016', 'Array'], officialDifficulty: tier });
    const before = structuredClone(input);
    const row = normalizer.record(input);
    assert.deepEqual(row.officialTags, ['数组']);
    assert.equal(row.officialDifficulty, tier);
    assert.deepEqual(input, before);
    for (const problem of [toDrawProblem(row), toLibraryProblem(JSON.parse(JSON.stringify(row)))]) {
      assert.deepEqual(problem.officialTags, ['数组']);
      assert.equal(problem.officialDifficulty, tier);
    }
  }
  const missing = normalizer.record(raw('CF', { rating: 1800, officialTags: [], officialDifficulty: null }));
  assert.deepEqual(missing.officialTags, []);
  assert.equal(missing.officialDifficulty, null, 'explicit missing must override native fallback');
  assert.equal(toLibraryProblem(missing).officialDifficulty, null);
});

test('legacy official difficulty uses native fields and never community estimates from AT or LOJ', () => {
  const cases = [
    ['CF', { rating: 1700 }, '1700'],
    ['CF', { rating: null, clistRating: 2600 }, null],
    ['AT', { communityDifficulty: 1800, clistRating: 2700 }, null],
    ['LG', { luoguDifficulty: '普及−' }, '普及−'],
    ['LG', { luoguDifficulty: '暂无评定' }, null],
    ['NC', { communityDifficulty: 300 }, '300'],
    ['NC', { communityDifficulty: 3 }, '3'],
    ['NC', { communityDifficulty: 0 }, null],
    ['NC', { communityDifficulty: -1 }, null],
    ['LOJ', { communityDifficulty: 2000, clistRating: 2600 }, null]
  ];
  for (const [source, fields, expected] of cases) {
    assert.equal(normalizer.record(raw(source, fields)).officialDifficulty, expected, source);
    assert.equal(toLibraryProblem(indexRow(source, fields)).officialDifficulty, expected, `${source} legacy read`);
  }
  for (const invalid of [0, -1, NaN, Infinity, '1700']) {
    assert.equal(normalizer.record(raw('CF', { rating: invalid })).officialDifficulty, null);
  }
});

test('legacy LeetCode unknown native tiers stay protected until refreshed', () => {
  for (const fields of [
    {}, { estimatedCfRating: 1000, ratingEstimateReason: '依据力扣原生难度 Easy' },
    { estimatedCfRating: 3200, ratingEstimateReason: 'LeetCode 竞赛 rating 3200（社区估算）' }
  ]) {
    assert.equal(normalizer.record(raw('LC', fields)).officialDifficulty, '平台原生难度待同步');
    assert.equal(toLibraryProblem(indexRow('LC', fields)).officialDifficulty, '平台原生难度待同步');
  }
  assert.equal(toLibraryProblem(indexRow('LC', { officialDifficulty: null })).officialDifficulty, null);
});

test('LeetCode parser supplies all three official native tiers independently of estimated ratings', () => {
  const parsed = parseLeetCode(lcPayload(['Easy', 'Medium', 'Hard', 'Unknown']));
  assert.deepEqual(parsed.map(problem => problem.officialDifficulty), ['Easy', 'Medium', 'Hard', null]);
  for (const problem of parsed) {
    const row = normalizer.record(problem);
    assert.equal(row.officialDifficulty, problem.officialDifficulty);
    assert.deepEqual(row.officialTags, ['数组']);
  }
});

test('legacy official tags follow canonical source topics and respect unknown coverage', () => {
  assert.deepEqual(toLibraryProblem(indexRow('LOJ', { tags: ['dp'], rawTags: ['Custom Algorithm'] })).officialTags, ['动态规划 DP', 'Custom Algorithm']);
  assert.deepEqual(toLibraryProblem(indexRow('AT', { tags: ['dp'] })).officialTags, []);
  assert.deepEqual(toLibraryProblem(indexRow('NC', { tagsKnown: false })).officialTags, []);
  assert.deepEqual(normalizer.record(raw('NC', { tagsKnown: false })).officialTags, []);
  const explicit = toLibraryProblem(indexRow('LOJ', { officialTags: [], tags: ['dp'], rawTags: ['Array'] }));
  assert.deepEqual(explicit.tags, ['动态规划 DP', '数组']);
  assert.deepEqual(explicit.officialTags, [], 'supplemented/display topics cannot refill an explicit empty official field');
  assert.deepEqual(toLibraryProblem(indexRow('LG', { officialTags: ['dp', '2016', 'Custom Algorithm'] })).officialTags, ['动态规划 DP']);
});

test('reading legacy metadata and building catalogs never rewrite shards or promote supplements', () => {
  const original = indexRow('LC', { tags: ['dp'], rawTags: ['Array'], customUnknown: { keep: true } });
  const body = `${JSON.stringify(original)}\n`;
  const disk = memoryFs({ 'meta.json': JSON.stringify({ builtAt: '2026-11-20T00:00:00Z' }), 'lc.ndjson': body });
  const snapshot = createLibraryLoader('/official-fixture', disk, path).load();
  const problem = snapshot.records[0];
  assert.deepEqual(problem.officialTags, ['动态规划 DP', '数组']);
  problem.tags.push('滑动窗口');
  const catalog = buildDailyTagCatalog(snapshot);
  assert.ok(catalog.tags.some(tag => tag.name === '滑动窗口'));
  assert.deepEqual(problem.officialTags, ['动态规划 DP', '数组']);
  assert.equal(disk.readFileSync(path.resolve('/official-fixture/lc.ndjson')), body);
  assert.deepEqual(disk.writes, []);
  assert.deepEqual(original.customUnknown, { keep: true });
});

test('skipped and failed syncs preserve legacy shards and unknown metadata byte for byte', async () => {
  const body = `${JSON.stringify(indexRow('CF', { rating: 1700, customUnknown: { keep: true } }))}\n`;
  for (const failure of [false, true]) {
    const disk = memoryFs({ 'cf.ndjson': body });
    const fetcher = async () => {
      if (failure) throw Error('offline fixture');
      return Response.json({ status: 'OK', result: { problems: [{ contestId: 1, index: 'A', name: 'CF', rating: 1700, tags: ['dp'] }] } });
    };
    const report = await createSync({ directory: '/official-fixture', fs: disk, path, fetcher, platforms: ['CF'], full: failure, now: () => 1000 }).run();
    assert.equal(report.platforms.CF.status, failure ? 'failed' : 'skipped');
    assert.equal(disk.readFileSync(path.resolve('/official-fixture/cf.ndjson')), body);
    assert.ok(disk.writes.every(filename => ['meta.json', 'sync-state.json'].includes(path.basename(filename))));
  }
});

test('sync persists CF native, AT community, NC native scores and LC tiers without cross-contamination', async () => {
  const disk = memoryFs();
  const fetcher = async url => {
    const target = String(url);
    if (target.includes('codeforces.com')) return Response.json({ status: 'OK', result: { problems: [{ contestId: 1, index: 'A', name: 'CF', rating: 1600, tags: ['dp'] }] } });
    if (target.endsWith('problems.json')) return Response.json([{ id: 'abc_a', contest_id: 'abc', title: 'AT' }]);
    if (target.endsWith('problem-models.json')) return Response.json({ abc_a: { difficulty: 1700 } });
    if (target.includes('graphql')) return Response.json(lcPayload(['Easy', 'Medium', 'Hard']));
    if (target.includes('zerotrac')) return Response.json([{ ID: 1, Rating: 3100 }]);
    if (target.includes('nowcoder.com')) return new Response('共 1 条<table><tr data-problemId="7"><td>7</td><td><a class="title">NC</a></td><td>1700</td></tr></table>');
    throw Error(`Unexpected URL: ${target}`);
  };
  const report = await createSync({ directory: '/official-fixture', fs: disk, path, fetcher, platforms: ['CF', 'AT', 'LC', 'NC'], full: true, now: () => 1000 }).run();
  assert.ok(Object.values(report.platforms).every(result => result.status === 'rebuilt'), JSON.stringify(report.platforms));
  const rows = source => disk.readFileSync(path.resolve(`/official-fixture/${source}.ndjson`)).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rows('cf')[0].officialDifficulty, '1600');
  assert.deepEqual(rows('cf')[0].officialTags, ['动态规划 DP']);
  assert.equal(rows('at')[0].officialDifficulty, null);
  assert.deepEqual(rows('at')[0].officialTags, []);
  assert.equal(rows('at')[0].communityDifficulty, 1700);
  assert.equal(rows('nc')[0].officialDifficulty, '1700');
  assert.deepEqual(rows('nc')[0].officialTags, []);
  assert.deepEqual(rows('lc').map(row => row.officialDifficulty), ['Easy', 'Medium', 'Hard']);
  assert.equal(rows('lc')[0].estimatedCfRating, 3100);
});
