const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load current sources so this regression can run before the coordinated build.
const sourceFiles = new Map([
  ['./luogu-native.cjs', path.resolve(__dirname, '../src/main/library/luogu-native.cts')],
  ['./luogu-difficulty.js', path.resolve(__dirname, '../src/shared/luogu-difficulty.ts')],
  ['./library-normalize.cjs', path.resolve(__dirname, '../src/main/library/normalize.cts')],
  ['./nowcoder-daily.cjs', path.resolve(__dirname, '../src/main/contests/nowcoder-daily.cts')],
  ['./libreoj-daily.cjs', path.resolve(__dirname, '../src/main/contests/libreoj-daily.cts')]
]);
const modules = new Map();
function loadSource(sourcePath) {
  if (modules.has(sourcePath)) return modules.get(sourcePath).exports;
  const loaded = new Module(sourcePath, module);
  loaded.filename = sourcePath;
  modules.set(sourcePath, loaded);
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = request => {
    if (request === '../ui/tag-presets.js') return require('../ui/tag-presets.js');
    if (request === '../ui/luogu-tags.json') return require('../ui/luogu-tags.json');
    if (sourceFiles.has(request)) return loadSource(sourceFiles.get(request));
    return originalRequire(request);
  };
  const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  });
  loaded._compile(compiled.outputText, sourcePath);
  return loaded.exports;
}
const { dailyDraw, parseLuoguProblemList } = loadSource(path.resolve(__dirname, '../src/main/contests/daily-problems.cts'));
const offline = async () => { assert.fail('this draw must stay offline'); };
const indexed = (source, id, changes = {}) => ({
  id: `${source}:${id}`, title: `${source} ${id}`, source, origin: 'library',
  url: `https://example.com/${source}/${id}`, rating: null, estimatedCfRating: null,
  estimatedLuoguDifficulty: null, luoguDifficulty: '', tags: [], ...changes
});
const libraryFor = records => ({ builtAt: null, records });
const range = { luoguDifficultyMin: '普及', luoguDifficultyMax: '提高' };

// These are deliberately synthetic reference bands, not official equivalences.
test('all-source rank 3–5 bounds retain CF/LC/AT/NC/LOJ estimates and Luogu native aliases', async () => {
  const eligible = [
    indexed('CF', 'cf', { rating: 1200, estimatedLuoguDifficulty: '普及' }),
    indexed('LC', 'lc', { estimatedCfRating: 1600, estimatedLuoguDifficulty: '提高' }),
    indexed('AT', 'at', { estimatedCfRating: 1400, estimatedLuoguDifficulty: '普及+/提高−' }),
    indexed('NC', 'nc', { estimatedCfRating: 1600, estimatedLuoguDifficulty: '提高' }),
    indexed('LOJ', 'loj', { estimatedCfRating: 1300, estimatedLuoguDifficulty: '普及/提高-' }),
    indexed('LG', 'lg', { luoguDifficulty: '普及/提高−', estimatedLuoguDifficulty: '省选/NOI-' })
  ];
  const outside = ['CF', 'LC', 'AT', 'NC', 'LOJ', 'LG'].flatMap(source => [
    indexed(source, 'low', { estimatedLuoguDifficulty: '普及-', ...(source === 'LG' ? { luoguDifficulty: '普及−' } : {}) }),
    indexed(source, 'high', { estimatedLuoguDifficulty: '提高+/省选-', ...(source === 'LG' ? { luoguDifficulty: '提高+/省选−' } : {}) }),
    indexed(source, 'unknown')
  ]);
  const records = [...eligible, ...outside];
  const snapshot = structuredClone(records);
  const library = libraryFor(records);
  for (let index = 0; index < eligible.length; index += 1) {
    let calls = 0;
    const result = await dailyDraw({ source: 'all', ...range }, [], offline, () => calls++ === 0 ? (index + 0.5) / eligible.length : 0, undefined, library);
    assert.equal(result.problem.id, eligible[index].id);
    assert.equal(result.diagnostics.candidateCount, 6);
  }
  assert.deepEqual(records, snapshot, 'range comparison must not rewrite library difficulty labels');
});

test('min-only and max-only bounds include endpoints and exclude unknowns', async () => {
  const labels = ['入门', '普及-', '普及/提高−', '普及+/提高', '提高', '提高+/省选−', '省选/NOI−', 'NOI/NOI+/CTSC'];
  const records = labels.map((luoguDifficulty, index) => indexed('LG', String(index + 1), { luoguDifficulty }));
  records.push(indexed('LG', 'unknown', { luoguDifficulty: '暂无评定' }));
  const library = libraryFor(records);
  for (const [filter, count, first, last] of [
    [{ luoguDifficultyMin: '普及' }, 6, 'LG:3', 'LG:8'],
    [{ luoguDifficultyMax: '提高' }, 5, 'LG:1', 'LG:5'],
    [{ luoguDifficultyMin: '入门' }, 8, 'LG:1', 'LG:8'],
    [{ luoguDifficultyMax: 'NOI/NOI+/CTS' }, 8, 'LG:1', 'LG:8'],
    [{ luoguDifficultyMin: '普及', luoguDifficultyMax: '普及/提高-' }, 1, 'LG:3', 'LG:3']
  ]) {
    const low = await dailyDraw({ platform: 'LG', ...filter }, [], offline, () => 0, undefined, library);
    const high = await dailyDraw({ platform: 'LG', ...filter }, [], offline, () => 0.999, undefined, library);
    assert.equal(low.diagnostics.candidateCount, count);
    assert.equal(low.problem.id, first);
    assert.equal(high.problem.id, last);
  }
});

test('unrated candidates from every platform remain eligible without Luogu bounds', async () => {
  const records = ['CF', 'LC', 'AT', 'NC', 'LOJ', 'LG'].map(source => indexed(source, 'unknown', source === 'LG' ? { luoguDifficulty: '暂无评定' } : {}));
  const library = libraryFor(records);
  for (const platform of records.map(problem => problem.source)) {
    const result = await dailyDraw({ platform, luoguDifficultyMin: '', luoguDifficultyMax: '' }, [], offline, () => 0, undefined, library);
    assert.equal(result.problem.source, platform);
    assert.equal(result.diagnostics.candidateCount, 1);
    await assert.rejects(dailyDraw({ platform, luoguDifficultyMax: 'NOI/NOI+/CTS' }, [], offline, () => 0, undefined, library), /没有符合条件/);
  }
});

test('reversed, unassessed and invalid bounds fail before fetch, CLIST or sampling', async () => {
  let networkCalls = 0, clistCalls = 0, randomCalls = 0;
  const fetcher = async () => { networkCalls += 1; throw Error('must not fetch'); };
  const clist = { fetchProblems: async () => { clistCalls += 1; throw Error('must not list'); } };
  const random = () => { randomCalls += 1; return 0; };
  await assert.rejects(dailyDraw({ luoguDifficultyMin: '提高', luoguDifficultyMax: '普及' }, [], fetcher, random, clist), /最低洛谷难度不能高于最高洛谷难度/);
  for (const key of ['luoguDifficultyMin', 'luoguDifficultyMax']) {
    for (const value of ['暂无评定', 'unknown', '第9级', 0, 1, 8, 9, null, [], {}, true, ' '.repeat(3)]) {
      await assert.rejects(dailyDraw({ [key]: value }, [], fetcher, random, clist), /洛谷难度.*(?:不支持|格式不正确)/);
    }
  }
  for (const key of ['luoguDifficulty', 'difficulty']) {
    await assert.rejects(dailyDraw({ [key]: 'unknown' }, [], fetcher, random, clist), /洛谷难度不支持/);
  }
  assert.deepEqual([networkCalls, clistCalls, randomCalls], [0, 0, 0]);
});

test('legacy exact level aliases match canonical official numeric bands', async () => {
  const parsed = parseLuoguProblemList(JSON.stringify({ data: { problems: { count: 3, result: [
    { pid: 'P1001', name: 'Native third band', difficulty: 3, tags: [] },
    { pid: 'P1002', name: 'Native fifth band', difficulty: 5, tags: [] },
    { pid: 'P1003', name: 'Unassessed', difficulty: 0, tags: [] }
  ] } } }));
  assert.equal(parsed.problems[0].luoguDifficulty, '普及');
  assert.equal(parsed.problems[0].officialDifficulty, '普及');
  // Official /_lfe/config ProblemDifficulty (cached in .cache/luogu-config.json)
  // gives Senior/id 5 as 提高; the former 提高+/省选− assertion was one band too high.
  assert.equal(parsed.problems[1].luoguDifficulty, '提高', 'official numeric difficulty 5 is Senior/提高');
  assert.equal(parsed.problems[1].estimatedCfRating, 1800);
  const library = libraryFor(parsed.problems);
  for (const filter of [{ luoguDifficulty: '普及' }, { difficulty: '普及' }, { luoguDifficulty: '普及/提高-' }]) {
    const result = await dailyDraw({ platform: 'LG', ...filter }, [], offline, () => 0, undefined, library);
    assert.equal(result.problem.id, 'LG:P1001');
    assert.equal(result.problem.luoguDifficulty, '普及');
    assert.equal(result.problem.officialDifficulty, '普及');
  }
  assert.equal((await dailyDraw({ platform: 'LG', luoguDifficulty: '暂无评定' }, [], offline, () => 0, undefined, library)).problem.id, 'LG:P1003');
  assert.equal((await dailyDraw({ platform: 'LG', luoguDifficulty: '提高' }, [], offline, () => 0, undefined, library)).problem.id, 'LG:P1002');
  assert.equal((await dailyDraw({ platform: 'LG', ...range, excludedIds: ['LG:P1001'] }, [], offline, () => 0, undefined, library)).problem.id, 'LG:P1002', 'the corrected rank 5 is the inclusive maximum');
  await assert.rejects(dailyDraw({ platform: 'LG', ...range, excludedIds: ['LG:P1001', 'LG:P1002'] }, [], offline, () => 0, undefined, library), /没有其他符合条件/);
});

test('official numeric bands 5, 6, 7 and 8 match their own exact rank and inclusive bounds', async () => {
  const labels = ['提高', '提高+/省选−', '省选/NOI−', 'NOI/NOI+/CTS'];
  const ratings = [1800, 2100, 2400, 2800];
  const parsed = parseLuoguProblemList(JSON.stringify({ data: { problems: { count: 4, result: labels.map((_, index) => ({ pid: `P${12000 + index}`, name: `Official band ${index + 5}`, difficulty: index + 5, tags: [] })) } } }));
  const library = libraryFor(parsed.problems);
  for (let index = 0; index < labels.length; index += 1) {
    const drawn = await dailyDraw({ platform: 'LG', luoguDifficulty: labels[index], luoguDifficultyMin: labels[index], luoguDifficultyMax: labels[index], ratingMin: ratings[index], ratingMax: ratings[index] }, [], offline, () => 0, undefined, library);
    assert.equal(drawn.problem.id, `LG:P${12000 + index}`);
    assert.equal(drawn.problem.luoguDifficultyCode, index + 5);
    assert.equal(drawn.problem.luoguDifficulty, labels[index]);
    assert.equal(drawn.problem.estimatedCfRating, ratings[index]);
    assert.equal(drawn.diagnostics.candidateCount, 1);
  }
});

test('native unassessed falls back to stored or CLIST estimates and remains available without bounds', async () => {
  const records = [
    indexed('LG', 'stored', { luoguDifficulty: '暂无评定', estimatedLuoguDifficulty: '普及/提高−' }),
    indexed('LG', 'clist', { luoguDifficulty: '暂无评定', clistRating: 1700 }),
    indexed('LG', 'unknown', { luoguDifficulty: '暂无评定' })
  ];
  const library = libraryFor(records);
  const result = await dailyDraw({ platform: 'LG', ...range }, [], offline, () => 0.999, undefined, library);
  assert.equal(result.problem.id, 'LG:clist');
  assert.equal(result.problem.luoguDifficulty, '暂无评定');
  assert.equal(result.problem.estimatedLuoguDifficulty, '提高');
  assert.equal(result.diagnostics.candidateCount, 2);
  assert.equal((await dailyDraw({ platform: 'LG' }, [], offline, () => 0.999, undefined, library)).problem.id, 'LG:unknown');
  const local = [{ kind: 'local', platform: 'LG', pid: 'P2', title: 'Stored fallback', problemUrl: 'https://www.luogu.com.cn/problem/P2', luoguDifficulty: '暂无评定', estimatedCfRating: 1300, estimatedLuoguDifficulty: '普及/提高−' }];
  const snapshot = structuredClone(local);
  const scoped = await dailyDraw({ source: 'local', ...range }, local, offline, () => 0);
  assert.equal(scoped.problem.id, 'LG:P2');
  assert.equal(scoped.problem.estimatedLuoguDifficulty, '普及/提高−');
  assert.equal(scoped.problem.luoguDifficulty, '暂无评定');
  assert.deepEqual(local, snapshot);
});

test('assessed native Luogu ranks override a conflicting estimate', async () => {
  const native = indexed('LG', 'native', { luoguDifficulty: '普及−', estimatedLuoguDifficulty: '提高' });
  await assert.rejects(dailyDraw({ platform: 'LG', ...range }, [], offline, () => 0, undefined, libraryFor([native])), /没有符合条件/);
  const high = indexed('LG', 'high', { luoguDifficulty: '提高+/省选−', estimatedLuoguDifficulty: '普及' });
  await assert.rejects(dailyDraw({ platform: 'LG', luoguDifficultyMax: '提高' }, [], offline, () => 0, undefined, libraryFor([high])), /没有符合条件/);
});

test('manual estimated aliases apply before inclusive maximum filtering', async () => {
  const record = indexed('LOJ', 'manual', { supplementInfo: { difficulty: true } });
  let supplementCalls = 0;
  const supplement = problem => {
    supplementCalls += 1;
    return { ...problem, estimatedCfRating: 1300, estimatedLuoguDifficulty: '普及/提高−', supplementInfo: { difficulty: true } };
  };
  const result = await dailyDraw({ platform: 'LOJ', luoguDifficultyMax: '普及' }, [], offline, () => 0, undefined, libraryFor([record]), supplement);
  assert.equal(result.problem.id, 'LOJ:manual');
  assert.equal(result.problem.estimatedLuoguDifficulty, '普及/提高−');
  assert.equal(supplementCalls, 1);
  await assert.rejects(dailyDraw({ platform: 'LOJ', luoguDifficultyMax: '普及-' }, [], offline, () => 0, undefined, libraryFor([record]), supplement), /没有符合条件/);
});
