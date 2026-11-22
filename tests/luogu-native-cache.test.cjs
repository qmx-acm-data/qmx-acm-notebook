'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');
const sources = new Map([
  ['./luogu-difficulty.js', 'src/shared/luogu-difficulty.ts'],
  ['./luogu-native.cjs', 'src/main/library/luogu-native.cts'],
  ['./library-normalize.cjs', 'src/main/library/normalize.cts'],
  ['./library-index.cjs', 'src/main/library/index.cts']
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
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
  return loaded.exports;
}
const { parseLuoguNativeBaseline, recoverLuoguNativeRow } = loadSource(sources.get('./luogu-native.cjs'));
const { createLibraryLoader, toLibraryProblem } = loadSource(sources.get('./library-index.cjs'));
const { createNormalizer, toDrawProblem } = loadSource(sources.get('./library-normalize.cjs'));
const labels = ['暂无评定', '入门', '普及−', '普及', '普及+/提高−', '提高', '提高+/省选−', '省选/NOI−', 'NOI/NOI+/CTS'];
const snapshot = (changes = {}) => ({ schema: 1, mappingVersion: 'luogu-native-2026-11', queriedAt: '2026-11-22T06:00:00.000Z', source: 'https://www.luogu.com.cn/problem/list?type=P', difficulties: { P11834: 8, P3756: 8, P5: 5, P6: 6, P7: 7, P0: 0 }, ...changes });
const row = (pid, changes = {}) => ({ id: `LG:${pid}`, platform: 'LG', title: `Stored ${pid}`, url: `https://www.luogu.com.cn/problem/${pid}`, rating: null, estimatedCfRating: null, luoguDifficulty: null, estimatedLuoguDifficulty: null, officialDifficulty: null, tags: ['dp'], rawTags: ['dp'], officialTags: ['dp'], custom: { preserved: true }, ...changes });
const digest = body => crypto.createHash('sha256').update(body).digest('hex');
function fixture(rows, baseline = snapshot()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-native-cache-'));
  fs.writeFileSync(path.join(directory, 'meta.json'), JSON.stringify({ builtAt: '2026-11-21T00:00:00Z' }));
  const shard = path.join(directory, 'lg.ndjson');
  fs.writeFileSync(shard, rows.map(value => JSON.stringify(value)).join('\n') + '\n');
  const native = path.join(directory, 'native.json');
  fs.writeFileSync(native, JSON.stringify(baseline));
  return { directory, shard, native };
}

test('verified baseline restores dropped highest grades and shifted grades without changing disk', t => {
  const input = [row('P11834'), row('P3756'), row('P5', { luoguDifficulty: '提高+/省选−', estimatedCfRating: 2100 }), row('P6', { luoguDifficulty: '省选/NOI−', estimatedCfRating: 2400 }), row('P7', { luoguDifficulty: 'NOI/NOI+/CTS', estimatedCfRating: 2800 }), row('P0')];
  const { directory, shard, native } = fixture(input);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const before = fs.readFileSync(shard);
  const original = structuredClone(input);
  let baselineReads = 0;
  const reader = Object.create(fs);
  reader.readFileSync = (filename, ...args) => {
    if (filename === native) baselineReads++;
    return fs.readFileSync(filename, ...args);
  };
  const loader = createLibraryLoader(directory, reader, path, { luoguNativeFile: native });
  assert.equal(baselineReads, 1);
  const loaded = loader.load(['LG']);
  assert.deepEqual(loaded.records.map(record => record.luoguDifficultyCode), [8, 8, 5, 6, 7, 0]);
  assert.deepEqual(loaded.records.map(record => record.estimatedCfRating), [2800, 2800, 1800, 2100, 2400, null]);
  assert.deepEqual(loaded.records.map(record => record.officialDifficulty), [labels[8], labels[8], labels[5], labels[6], labels[7], null]);
  assert.equal(loaded.records[5].luoguDifficulty, labels[0]);
  assert.deepEqual(loaded.records.map(record => record.title), input.map(record => record.title));
  assert.ok(loaded.records.every(record => record.tags.join() === '动态规划 DP'));
  assert.equal(loader.load(['LG']), loaded, 'validated baseline and index are reused');
  loader.load();
  assert.equal(baselineReads, 1, 'snapshot is read only during construction, never per row or load');
  assert.equal(digest(fs.readFileSync(shard)), digest(before));
  assert.deepEqual(input, original);
});

test('valid row code wins over stale baseline while explicit CLIST and manual references survive', () => {
  const baseline = parseLuoguNativeBaseline(snapshot());
  for (const reference of [{}, { clistRating: 3137, communityDifficulty: 25 }, { supplementInfo: { difficulty: true } }, { difficultyReference: { basis: 'clist' } }]) {
    const input = row('P11834', { luoguDifficultyCode: 6, luoguDifficulty: labels[8], estimatedCfRating: 3137, estimateReason: 'saved reference', ...reference });
    const before = structuredClone(input);
    const recovered = recoverLuoguNativeRow(input, baseline);
    assert.equal(recovered.luoguDifficultyCode, 6);
    assert.equal(recovered.luoguDifficulty, labels[6]);
    assert.equal(recovered.officialDifficulty, labels[6]);
    assert.deepEqual(recovered.custom, input.custom);
    assert.deepEqual(recovered.rawTags, input.rawTags);
    assert.equal(recovered.estimatedCfRating, Object.keys(reference).length ? 3137 : 2100);
    assert.deepEqual(input, before);
  }
  const codeWithoutBaseline = toLibraryProblem(row('P11834', { luoguDifficultyCode: 6, luoguDifficulty: 'stale', url: 'https://example.com/problem/P11834' }));
  assert.equal(codeWithoutBaseline.luoguDifficulty, labels[6], 'a row code is self-contained; URL matching guards only baseline lookup');
  const ungraded = recoverLuoguNativeRow(row('P11834', { luoguDifficultyCode: 0, officialDifficulty: labels[8] }), baseline);
  assert.equal(ungraded.officialDifficulty, null);
  assert.equal(ungraded.estimatedCfRating, null);
});

test('baseline recovery requires official LG source, canonical P ID and matching route', () => {
  const baseline = parseLuoguNativeBaseline(snapshot());
  for (const changes of [
    { platform: 'CF' }, { id: 'P11834' }, { id: 'LG:P3756' },
    { url: 'https://example.com/problem/P11834' }, { url: 'http://www.luogu.com.cn/problem/P11834' },
    { url: 'https://www.luogu.com.cn/problem/P3756' }, { url: 'https://www.luogu.com.cn/problem/CF11834' },
    { url: 'https://user@www.luogu.com.cn/problem/P11834' }, { url: 'https://www.luogu.com.cn:123/problem/P11834' },
    { url: 'https://www.luogu.com.cn/problem/P11834/foreign' }, { id: 'LG:P11834x' }
  ]) {
    const input = row('P11834', changes);
    assert.equal(recoverLuoguNativeRow(input, baseline), input, JSON.stringify(changes));
  }
  const valid = recoverLuoguNativeRow(row('P11834', { url: 'https://luogu.com.cn/problem/P11834/?from=list#data' }), baseline);
  assert.equal(valid.luoguDifficultyCode, 8);
});

test('whole baseline validation rejects corruption before loading rows; absent optional file is harmless', t => {
  const bad = [null, [], {}, snapshot({ schema: 2 }), snapshot({ mappingVersion: 'old' }), snapshot({ queriedAt: 'yesterday' }), snapshot({ queriedAt: '2026-02-30T00:00:00.000Z' }), snapshot({ source: 'https://example.com' }), snapshot({ difficulties: {} }), ...[9, -1, 1.5, '8', null].map(code => snapshot({ difficulties: { P11834: 8, P3756: code } })), snapshot({ difficulties: { CF1: 8 } })];
  for (const input of bad) assert.throws(() => parseLuoguNativeBaseline(input), /洛谷原生难度基线/);
  const { directory, native } = fixture([row('P11834')], snapshot({ difficulties: { P11834: 9 } }));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.throws(() => createLibraryLoader(directory, fs, path, { luoguNativeFile: native }), /洛谷原生难度基线/);
  assert.equal(createLibraryLoader(directory, fs, path, { luoguNativeFile: path.join(directory, 'absent.json') }).load().records[0].officialDifficulty, null);
});

test('no option preserves legacy labels; unknown or invalid codes never invent native grades', t => {
  const input = row('P5', { luoguDifficulty: '提高+/省选−', estimatedCfRating: 2100 });
  const { directory } = fixture([input, row('P11834', { luoguDifficultyCode: 9 }), row('P3756', { luoguDifficultyCode: 1.5 })]);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const loaded = createLibraryLoader(directory, fs, path).load().records;
  assert.equal(loaded[0].luoguDifficulty, input.luoguDifficulty);
  assert.equal(loaded[0].estimatedCfRating, 2100);
  assert.equal(loaded[1].luoguDifficulty, '');
  assert.equal(loaded[1].luoguDifficultyCode, undefined);
  assert.equal(loaded[2].officialDifficulty, null);
});

test('native code survives normalizer, JSON persistence, draw conversion and loader without a baseline', t => {
  const normalizer = createNormalizer(rating => rating === null ? null : 'estimated');
  const rows = Array.from({ length: 9 }, (_, code) => normalizer.record({
    id: `LG:P${code}`, source: 'LG', title: `Code ${code}`, url: `https://www.luogu.com.cn/problem/P${code}`,
    luoguDifficultyCode: code, luoguDifficulty: 'stale', officialDifficulty: null, estimatedCfRating: 9999, tags: []
  }));
  const { directory } = fixture(rows);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const loaded = createLibraryLoader(directory, fs, path).load().records;
  for (let code = 0; code <= 8; code++) {
    assert.equal(rows[code].luoguDifficultyCode, code);
    for (const record of [toDrawProblem(rows[code]), toLibraryProblem(JSON.parse(JSON.stringify(rows[code]))), loaded[code]]) {
      assert.equal(record.luoguDifficultyCode, code);
      assert.equal(record.luoguDifficulty, labels[code]);
      assert.equal(record.officialDifficulty, code === 0 ? null : labels[code]);
      assert.equal(record.estimatedCfRating, [null, 900, 1100, 1300, 1600, 1800, 2100, 2400, 2800][code]);
    }
  }
  const clist = normalizer.record({ id: 'LG:P6', source: 'LG', title: 'Saved reference', url: 'https://www.luogu.com.cn/problem/P6', luoguDifficultyCode: 6, clistRating: 2222, estimatedCfRating: 2222 });
  assert.equal(clist.estimatedCfRating, 2222);
  assert.equal(clist.clistRating, 2222);
  const invalid = normalizer.record({ id: 'LG:P9', source: 'LG', title: 'Unknown', url: 'https://www.luogu.com.cn/problem/P9', luoguDifficultyCode: 9 });
  assert.equal(invalid.luoguDifficultyCode, undefined);
  assert.equal(invalid.officialDifficulty, null);
});
