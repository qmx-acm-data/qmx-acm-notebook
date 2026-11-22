const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Exercise TypeScript sources without rebuilding or reading generated daily code.
const sourceFiles = new Map([
  ['./luogu-native.cjs', path.resolve(__dirname, '../src/main/library/luogu-native.cts')],
  ['./luogu-difficulty.js', path.resolve(__dirname, '../src/shared/luogu-difficulty.ts')],
  ['./library-normalize.cjs', path.resolve(__dirname, '../src/main/library/normalize.cts')],
  ['./nowcoder-daily.cjs', path.resolve(__dirname, '../src/main/contests/nowcoder-daily.cts')],
  ['./libreoj-daily.cjs', path.resolve(__dirname, '../src/main/contests/libreoj-daily.cts')]
]);
const filename = path.resolve(__dirname, '../src/main/contests/daily-problems.cts');
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
const { applyClistDifficultyReference, dailyDraw, mergeNativeProblemDifficulty, parseLuoguProblemList } = loadSource(filename);

const problem = (changes = {}) => ({
  id: 'LOJ:100', title: 'Synthetic reference fixture', source: 'LOJ', origin: 'library',
  url: 'https://loj.ac/p/100', rating: null, clistRating: null,
  estimatedCfRating: null, estimatedLuoguDifficulty: null, luoguDifficulty: '', tags: [], ...changes
});
const metadata = (source, rawRating) => ({
  method: 'clist-elo-reference-v2', basis: 'clist', confidence: 'low', calibrated: false, resource: source, rawRating
});
const offline = async () => { assert.fail('indexed source must not fetch'); };
const clistForLookup = lookupRating => ({
  fetchProblems: async () => { assert.fail('indexed source must not list CLIST candidates'); }, lookupRating
});
const libraryFor = (...records) => ({ builtAt: null, records });

test('native merge fills CF rating through official route aliases and preserves record identity', () => {
  const original = problem({ source: 'CF', id: 'repository-id', title: 'Repository title', origin: 'local', url: 'https://contest.codeforces.com/contest/921/problem/01/?locale=en#statement', tags: ['dp'], officialTags: [] });
  const indexed = problem({ source: 'CF', id: 'CF:92101', url: 'https://codeforces.com/problemset/problem/921/01', rating: 1800, title: 'Indexed title', tags: ['graphs'], officialTags: ['graphs'] });
  const snapshot = structuredClone({ original, indexed });
  const result = mergeNativeProblemDifficulty(original, indexed);
  assert.equal(result.rating, 1800);
  assert.equal(result.officialDifficulty, '1800');
  assert.equal(result.estimatedCfRating, null);
  assert.equal(result.estimatedLuoguDifficulty, '提高');
  for (const field of ['id', 'title', 'origin', 'url']) assert.equal(result[field], original[field]);
  assert.deepEqual(result.tags, ['dp']);
  assert.deepEqual(result.officialTags, []);
  assert.deepEqual({ original, indexed }, snapshot);
  const ownNative = { ...original, rating: 1200, officialDifficulty: '1200' };
  assert.equal(mergeNativeProblemDifficulty(ownNative, indexed), ownNative);
  for (const rating of [null, 0, -1, NaN, Infinity]) assert.equal(mergeNativeProblemDifficulty(original, { ...indexed, rating }), original);
});

test('native merge restores assessed Luogu levels and leaves CLIST and supplement references intact', () => {
  const original = problem({ source: 'LG', id: 'repository-id', origin: 'public', url: 'https://luogu.com/problem/p9234/?locale=en#statement' });
  const indexed = problem({ source: 'LG', id: 'LG:P9234', url: 'https://www.luogu.com.cn/problem/P9234', luoguDifficulty: '普及+/提高', officialDifficulty: '普及+/提高', estimatedCfRating: 1600 });
  const result = mergeNativeProblemDifficulty(original, indexed);
  assert.equal(result.luoguDifficulty, '普及+/提高');
  assert.equal(result.officialDifficulty, '普及+/提高');
  assert.equal(result.estimatedCfRating, 1600);
  assert.equal(result.estimatedLuoguDifficulty, null);
  assert.equal(result.rating, null);
  assert.equal(result.clistRating, null);
  assert.equal(result.difficultyReference, undefined);
  for (const changes of [{ luoguDifficulty: '入门' }, { luoguDifficulty: '提高+/省选−' }]) {
    const ownNative = { ...original, ...changes };
    assert.equal(mergeNativeProblemDifficulty(ownNative, indexed), ownNative);
  }
  const ownOfficial = mergeNativeProblemDifficulty({ ...original, officialDifficulty: '入门' }, indexed);
  assert.equal(ownOfficial.luoguDifficulty, '入门');
  assert.equal(ownOfficial.estimatedCfRating, 900);
  const officialOnly = mergeNativeProblemDifficulty(original, { ...indexed, luoguDifficulty: '', officialDifficulty: '普及加/提高' });
  assert.equal(officialOnly.luoguDifficulty, '普及加/提高');
  assert.equal(officialOnly.estimatedCfRating, 1600);
  for (const source of ['LG', 'CF']) {
    const own = source === 'LG' ? original : { ...original, source, url: 'https://codeforces.com/contest/1/problem/A' };
    const native = source === 'LG' ? indexed : { ...indexed, source, url: 'https://codeforces.com/problemset/problem/1/A', rating: 1800 };
    for (const reference of [
      { clistRating: 1255, estimatedCfRating: 1300, difficultyReference: metadata(source, 1255), ratingEstimateReason: 'CLIST reference' },
      { estimatedCfRating: 2100, supplementInfo: { source: 'manual', revision: 1, tags: false, difficulty: true }, ratingEstimateReason: 'Manual reference' }
    ]) {
      const input = { ...own, ...reference };
      const merged = mergeNativeProblemDifficulty(input, native);
      for (const field of Object.keys(reference)) assert.deepEqual(merged[field], input[field], `${source} ${field} must survive native merge`);
      assert.equal(merged.officialDifficulty, source === 'LG' ? '普及+/提高' : '1800');
    }
  }
  for (const level of ['', '暂无评定', 'unknown', '1600', '普及+/提高;process.exit()']) assert.equal(mergeNativeProblemDifficulty(original, { ...indexed, luoguDifficulty: level, officialDifficulty: level }), original);
});

test('code 8 survives native merge and scoped normalization without CLIST or an unrated placeholder', async () => {
  const parsed = parseLuoguProblemList(JSON.stringify({ data: { problems: { count: 2, result: ['P11834', 'P3756'].map(pid => ({ pid, name: `Official code 8 ${pid}`, difficulty: 8, tags: [] })) } } })).problems;
  for (const indexed of parsed) {
    const original = problem({ source: 'LG', id: indexed.id, url: indexed.url, origin: 'public', title: 'Repository title' });
    const merged = mergeNativeProblemDifficulty(original, indexed);
    assert.equal(merged.luoguDifficultyCode, 8);
    assert.equal(merged.officialDifficulty, 'NOI/NOI+/CTS');
    assert.equal(merged.luoguDifficulty, 'NOI/NOI+/CTS');
    assert.equal(merged.estimatedCfRating, 2800);
    assert.equal(merged.estimatedLuoguDifficulty, null);
    assert.equal(merged.clistRating, null);
    assert.equal(merged.difficultyReference, undefined);
    const record = { kind: 'document', platform: 'LG', pid: indexed.id.slice(3), title: 'Repository title', problemUrl: indexed.url, luoguDifficultyCode: 8, luoguDifficulty: '', officialDifficulty: null };
    const drawn = await dailyDraw({ source: 'public', platform: 'LG', ratingMin: 2800, ratingMax: 2800 }, [record], offline, () => 0);
    assert.equal(drawn.problem.luoguDifficultyCode, 8);
    assert.equal(drawn.problem.officialDifficulty, 'NOI/NOI+/CTS');
    assert.equal(drawn.problem.luoguDifficulty, 'NOI/NOI+/CTS');
    assert.equal(drawn.problem.estimatedCfRating, 2800);
    assert.equal(drawn.problem.estimatedLuoguDifficulty, null);
    assert.equal(drawn.problem.clistRating, undefined);
    assert.equal(drawn.problem.difficultyReference, undefined);
  }
});

test('scoped original code zero stays explicitly unassessed while invalid codes remain unknown', async () => {
  const record = { kind: 'local', platform: 'LG', pid: 'P12000', title: 'Code boundary', problemUrl: 'https://www.luogu.com.cn/problem/P12000' };
  for (const luoguDifficultyCode of [0, 9, 5.5]) {
    const drawn = await dailyDraw({ source: 'local', platform: 'LG' }, [{ ...record, luoguDifficultyCode }], offline, () => 0);
    assert.equal(drawn.problem.luoguDifficulty, luoguDifficultyCode === 0 ? '暂无评定' : '');
    assert.equal(drawn.problem.luoguDifficultyCode, luoguDifficultyCode === 0 ? 0 : undefined);
    assert.equal(drawn.problem.officialDifficulty, null);
    assert.equal(drawn.problem.estimatedCfRating, null);
    assert.equal(drawn.problem.estimatedLuoguDifficulty, null);
  }
});

test('native merge refuses cross-source, untrusted URLs and different official problem routes', () => {
  const indexed = problem({ source: 'CF', url: 'https://codeforces.com/problemset/problem/921/01', rating: 1600 });
  for (const changes of [
    { source: 'LG' }, { source: 'AT' }, { url: 'https://codeforces.com/problemset/problem/921/1' },
    { url: 'https://codeforces.com/gym/921/problem/01' }, { url: 'https://codeforces.com/problemset/problem/922/01' },
    { url: 'https://example.com/problemset/problem/921/01' }, { url: 'https://codeforces.com.example.com/problemset/problem/921/01' },
    { url: 'http://codeforces.com/problemset/problem/921/01' }, { url: 'https://user@codeforces.com/problemset/problem/921/01' },
    { url: 'https://codeforces.com:8443/problemset/problem/921/01' }, { url: 'https://codeforces.com/problemset/problem/921/01/solutions' }
  ]) {
    const input = problem({ source: 'CF', url: indexed.url, ...changes });
    assert.equal(mergeNativeProblemDifficulty(input, indexed), input);
  }
  const lg = problem({ source: 'LG', url: 'https://www.luogu.com.cn/problem/P9234', luoguDifficulty: '普及+/提高' });
  const different = { ...lg, luoguDifficulty: '', url: 'https://www.luogu.com.cn/problem/P9235' };
  assert.equal(mergeNativeProblemDifficulty(different, lg), different);
});

// Synthetic inputs verify the declared heuristic only, never empirical calibration.
test('rounds raw CLIST to hundreds, clamps references and retains every raw value', () => {
  const cases = [
    [49, 0, '入门'], [377, 400, '入门'], [799, 800, '入门'], [800, 800, '入门'],
    [849, 800, '入门'], [850, 900, '入门'],
    [1254, 1300, '普及'], [1255, 1300, '普及'],
    [1701, 1700, '提高'], [3500, 3500, 'NOI/NOI+/CTS'],
    [3501, 3500, 'NOI/NOI+/CTS'], [9876, 3500, 'NOI/NOI+/CTS']
  ];
  for (const [raw, cfReference, luoguReference] of cases) {
    const input = problem({ clistRating: raw });
    const result = applyClistDifficultyReference(input);
    assert.equal(result.clistRating, raw);
    assert.equal(result.rating, null, `raw ${raw} must not become native CF`);
    assert.equal(result.estimatedCfRating, cfReference);
    assert.equal(result.estimatedLuoguDifficulty, luoguReference);
    assert.deepEqual(result.difficultyReference, metadata('LOJ', raw));
    assert.match(result.ratingEstimateReason, /未跨平台校准.*低置信参考.*不是官方等价/);
    assert.match(result.ratingEstimateReason, /未标准化/);
    assert.ok(result.ratingEstimateReason.includes(`CLIST 原始评分 ${raw}`));
    if (raw > 3500) assert.match(result.ratingEstimateReason, /上限为 3500/);
    if (raw < 800) assert.doesNotMatch(result.ratingEstimateReason, /800–3500/);
    assert.equal(input.estimatedCfRating, null, 'mapping must not mutate its input');
    assert.equal(input.difficultyReference, undefined);
  }
});

test('CLIST zero means no data and never produces zero CF or an introductory Luogu reference', () => {
  const result = applyClistDifficultyReference(problem({ source: 'AT', clistRating: 0, estimatedCfRating: 0, estimatedLuoguDifficulty: '入门' }));
  assert.equal(result.clistRating, null);
  assert.equal(result.clistRatingStatus, 'no-data');
  assert.equal(result.estimatedCfRating, null);
  assert.equal(result.estimatedLuoguDifficulty, null);
  const native = applyClistDifficultyReference(problem({ source: 'CF', rating: 1200, clistRating: 0, estimatedCfRating: 1200 }));
  assert.equal(native.rating, 1200);
  assert.equal(native.estimatedCfRating, 1200);
  const community = applyClistDifficultyReference(problem({ source: 'AT', clistRating: 0, communityDifficulty: 0, estimatedCfRating: 800, estimatedLuoguDifficulty: '入门' }));
  assert.equal(community.estimatedCfRating, 800, 'a real community difficulty of zero remains valid');
});

test('uses the versioned project Luogu bands for intermediate CLIST references', () => {
  for (const [raw, level] of [[900, '入门'], [1000, '普及-'], [1200, '普及'], [1400, '普及+/提高-'], [1600, '提高'], [1900, '提高+/省选-'], [2200, '省选/NOI-'], [2600, 'NOI/NOI+/CTS']]) {
    const result = applyClistDifficultyReference(problem({ clistRating: raw }));
    assert.equal(result.estimatedLuoguDifficulty, level);
    assert.equal(result.difficultyReference.method, 'clist-elo-reference-v2');
    assert.equal(result.difficultyReference.calibrated, false);
  }
});

test('does not fabricate references for absent, malformed or nonfinite CLIST ratings', () => {
  for (const raw of [undefined, null, -1, NaN, Infinity, -Infinity, '1255']) {
    const input = problem({ clistRating: raw });
    const result = applyClistDifficultyReference(input);
    assert.equal(result.clistRating, raw);
    assert.equal(result.rating, null);
    assert.equal(result.estimatedCfRating, null);
    assert.equal(result.estimatedLuoguDifficulty, null);
    assert.equal(result.difficultyReference, undefined);
    assert.equal(result.ratingEstimateReason, undefined);
  }
});

test('preserves native CF ratings and native Luogu levels before CLIST references', () => {
  const nativeCf = applyClistDifficultyReference(problem({ source: 'CF', rating: 2400, clistRating: 1255, estimatedCfRating: 900 }));
  assert.equal(nativeCf.rating, 2400);
  assert.equal(nativeCf.clistRating, 1255);
  assert.equal(nativeCf.estimatedCfRating, null);
  assert.equal(nativeCf.estimatedLuoguDifficulty, '省选/NOI-');
  assert.equal(nativeCf.difficultyReference.calibrated, false);
  for (const nativeLevel of ['提高+/省选−', '暂无评定']) {
    const nativeLg = applyClistDifficultyReference(problem({ source: 'LG', luoguDifficulty: nativeLevel, clistRating: 1255 }));
    assert.equal(nativeLg.luoguDifficulty, nativeLevel);
    assert.equal(nativeLg.clistRating, 1255);
    assert.equal(nativeLg.rating, null);
    assert.equal(nativeLg.estimatedCfRating, 1300);
    assert.equal(nativeLg.estimatedLuoguDifficulty, nativeLevel === '暂无评定' ? '普及' : null, 'assessed native levels take precedence; unassessed levels may use a reference');
  }
});

test('maps indexed CLIST candidates before applying CF bounds and Luogu level filters', async () => {
  const low = problem({ id: 'LOJ:100', clistRating: 1255 });
  const high = problem({ id: 'LOJ:101', url: 'https://loj.ac/p/101', clistRating: 1701 });
  const library = libraryFor(low, high);
  const clist = clistForLookup(async () => { assert.fail('existing CLIST ratings must not be queried again'); });
  const result = await dailyDraw({ platform: 'LOJ', ratingMin: 1300, ratingMax: 1300, luoguDifficulty: '普及' }, [], offline, () => 0, clist, library);
  assert.equal(result.problem.id, low.id);
  assert.equal(result.problem.clistRating, 1255);
  assert.equal(result.problem.estimatedCfRating, 1300);
  assert.equal(result.problem.rating, null);
  assert.deepEqual(result.problem.difficultyReference, metadata('LOJ', 1255));
  assert.equal(result.diagnostics.candidateCount, 1);
  assert.deepEqual(result.diagnostics.platforms, { LOJ: { count: 2, tagged: 0 } });
  assert.equal(result.diagnostics.dataMode, 'index');
  assert.ok(Number.isFinite(result.diagnostics.durationMs) && result.diagnostics.durationMs >= 0);
  assert.equal(low.estimatedCfRating, null, 'the shared library must not receive mapped fields');
  await assert.rejects(dailyDraw({ platform: 'LOJ', ratingMin: 1800 }, [], offline, () => 0, clist, library), /没有符合条件/);
});

test('drawing uses an already cached CLIST score without any rate-limited lookup', async () => {
  const item = problem({ id: 'NC:328351', source: 'NC', url: 'https://ac.nowcoder.com/acm/problem/328351', title: 'qc的纸带', clistRating: 377, officialDifficulty: null });
  const clist = clistForLookup(async () => { throw new Error('draws must not query CLIST'); });
  const result = await dailyDraw({ platform: 'NC' }, [], offline, () => 0, clist, libraryFor(item));
  assert.equal(result.problem.clistRating, 377);
  assert.equal(result.problem.clistRatingStatus, 'available');
  assert.equal(result.problem.estimatedCfRating, 400);
  assert.equal(result.problem.estimatedLuoguDifficulty, '入门');
  assert.equal(result.problem.officialDifficulty, null);
  assert.deepEqual(result.problem.difficultyReference, metadata('NC', 377));
});

test('a configured but uncached problem is reported as not obtained without blocking the draw', async () => {
  const first = problem();
  const chosen = problem({ id: 'LOJ:101', url: 'https://loj.ac/p/101' });
  const clist = clistForLookup(async () => { throw new Error('draws must not query CLIST'); });
  let randomCalls = 0;
  const result = await dailyDraw({ platform: 'LOJ' }, [], offline, () => { randomCalls += 1; return randomCalls === 2 ? 0.99 : 0; }, clist, libraryFor(first, chosen));
  assert.equal(result.problem.id, chosen.id);
  assert.equal(result.problem.clistRating, null);
  assert.equal(result.problem.clistRatingStatus, 'not-obtained');
  assert.equal(result.problem.estimatedCfRating, null);
  assert.equal(randomCalls, 2, 'no lookup may consume randomness or redraw');
});

test('cached CLIST references never overwrite native CF or Luogu difficulty', async () => {
  const fixtures = [
    problem({ source: 'CF', id: 'CF:1A', url: 'https://codeforces.com/problemset/problem/1/A', rating: 2400, clistRating: 1255 }),
    problem({ source: 'LG', id: 'LG:P2822', url: 'https://www.luogu.com.cn/problem/P2822', luoguDifficulty: '普及/提高−', clistRating: 1255 })
  ];
  const clist = clistForLookup(async () => { throw new Error('draws must not query CLIST'); });
  for (const native of fixtures) {
    const result = await dailyDraw({ platform: native.source }, [], offline, () => 0, clist, libraryFor(native));
    assert.equal(result.problem.rating, native.rating);
    assert.equal(result.problem.luoguDifficulty, native.luoguDifficulty);
    assert.equal(result.problem.clistRating, 1255);
    assert.equal(result.problem.difficultyReference.calibrated, false);
  }
});

test('missing CLIST credentials preserve unknown source difficulty with an explicit note', async () => {
  const result = await dailyDraw({ platform: 'LOJ' }, [], offline, () => 0, undefined, libraryFor(problem()));
  assert.equal(result.problem.rating, null);
  assert.equal(result.problem.clistRating, null);
  assert.equal(result.problem.estimatedCfRating, null);
  assert.equal(result.problem.estimatedLuoguDifficulty, null);
  assert.equal(result.problem.difficultyReference, undefined);
  assert.match(result.note, /CLIST 未配置 API Key/);
});

test('scoped local and public draws never perform optional CLIST lookup', async () => {
  const record = { kind: 'local', platform: 'LOJ', pid: '100', title: 'Scoped', problemUrl: 'https://loj.ac/p/100' };
  const clist = clistForLookup(async () => { assert.fail('scoped draws must not query CLIST'); });
  for (const source of ['local', 'public']) {
    const result = await dailyDraw({ source, platform: 'LOJ' }, [record], offline, () => 0, clist);
    assert.equal(result.problem.id, 'LOJ:100');
    assert.equal(result.problem.estimatedCfRating, null);
    assert.equal(result.problem.difficultyReference, undefined);
    assert.equal(result.diagnostics.dataMode, 'scoped');
  }
});
