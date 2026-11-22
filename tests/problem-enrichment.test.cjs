const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/main/library/enrichment.cts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { canonicalProblemUrl, createProblemEnrichment } = loaded.exports;
const URL_AT = 'https://atcoder.jp/contests/abc100/tasks/abc100_a';
const URL_CF = 'https://codeforces.com/problemset/problem/100/A';
function problem(overrides = {}) {
  return { id: 'AT:ABC100_A', title: 'Example', source: 'AT', origin: 'library', url: URL_AT, rating: null, luoguDifficulty: '', estimatedCfRating: 1200, estimatedLuoguDifficulty: '普及−', communityDifficulty: 400, tags: [], officialTags: [], officialDifficulty: null, ...overrides };
}
function fixture(initial = undefined, initialProblems = [problem()]) {
  let stored = initial, writes = 0, reads = 0;
  const problems = new Map(initialProblems.map(value => [canonicalProblemUrl(value.url), value]));
  const service = createProblemEnrichment({ read: () => { reads++; return stored; }, save: value => { writes++; stored = structuredClone(value); }, findProblem: url => problems.get(url) ?? null, now: () => '2026-11-20T12:00:00.000Z' });
  return { service, problems, value: () => stored, writes: () => writes, reads: () => reads, replace: value => { stored = value; } };
}
const fields = { tags: ['动态规划'], cfRating: 1600, luoguDifficulty: '普及+/提高', reason: '根据状态转移和实现复杂度估算' };

// URL aliases share device metadata, while arbitrary host/routes never resolve.
test('canonicalizes six official platforms with safe aliases and routes', () => {
  const cases = [
    ['https://www.codeforces.com/contest/100/problem/a?locale=zh#tags', URL_CF],
    ['https://codeforces.com/contest/921/problem/14', 'https://codeforces.com/problemset/problem/921/14'],
    ['https://codeforces.com/problemset/problem/921/01', 'https://codeforces.com/problemset/problem/921/01'],
    ['https://codeforces.com/gym/100/problem/A', 'https://codeforces.com/gym/100/problem/A'],
    ['https://www.atcoder.jp/contests/abc100/tasks/abc100_a/', URL_AT],
    ['https://luogu.com/problem/p1000', 'https://www.luogu.com.cn/problem/P1000'],
    ['https://leetcode.cn/problems/two-sum/description/?envType=daily-question', 'https://leetcode.com/problems/two-sum/'],
    ['https://www.nowcoder.com/acm/problem/1234/', 'https://ac.nowcoder.com/acm/problem/1234'],
    ['https://ac.nowcoder.com/acm/contest/123/A', 'https://ac.nowcoder.com/acm/contest/123/A'],
    ['https://ac.nowcoder.com/practice/ABCDEF0123456789ABCDEF0123456789', 'https://www.nowcoder.com/practice/abcdef0123456789abcdef0123456789'],
    ['https://www.loj.ac/p/100', 'https://loj.ac/p/100']
  ];
  for (const [input, expected] of cases) assert.equal(canonicalProblemUrl(input), expected);
  for (const input of ['https://atcoder.jp.evil.test/contests/abc/tasks/a', 'https://user:secret@atcoder.jp/contests/abc/tasks/a', 'https://atcoder.jp:444/contests/abc/tasks/a', 'http://atcoder.jp/contests/abc/tasks/a', 'file:///etc/passwd', 'https://atcoder.jp/settings', 'https://atcoder.jp/contests/abc/tasks/../a', 'https://leetcode.com/problems/a/../../settings', 'https://loj.ac\\@evil.test/p/100']) assert.throws(() => canonicalProblemUrl(input));
});

test('Nowcoder practice supplements resolve to the NC platform', () => {
  const url = 'https://www.nowcoder.com/practice/abcdef0123456789abcdef0123456789';
  const record = problem({ source: 'NC', url });
  const f = fixture(undefined, [record]);
  assert.equal(f.service.view(url).platform, 'NC');
  f.service.saveSupplement({ url, expectedRevision: 0, ...fields });
  assert.deepEqual(f.service.apply(record).tags, fields.tags);
});

test('reads without writing, requires a matching trusted index record and rejects spoofed platforms', () => {
  const f = fixture();
  assert.equal(f.service.view(URL_AT).revision, 0);
  assert.equal(f.service.view(URL_AT).supplement, null);
  assert.equal(f.writes(), 0);
  assert.throws(() => f.service.saveSupplement({ url: URL_CF, expectedRevision: 0, ...fields }), /可信/);
  f.problems.set(URL_AT, problem({ source: 'CF' }));
  assert.throws(() => f.service.view(URL_AT), /可信/);
  assert.equal(f.writes(), 0);
});

test('manual supplements apply only missing fields, preserve native and community metrics, and are idempotent', () => {
  const f = fixture();
  const first = f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields });
  assert.equal(first.revision, 1);
  assert.equal(first.supplement.source, 'manual');
  assert.equal(f.value().schema, 1);
  assert.deepEqual(Object.keys(f.value().records), [URL_AT]);
  assert.deepEqual(f.value().suggestions, {});
  assert.deepEqual(f.service.saveSupplement({ url: URL_AT, expectedRevision: 1, ...fields }), first);
  assert.equal(f.writes(), 1);
  const original = problem();
  const applied = f.service.apply(original);
  assert.deepEqual(original.tags, []);
  assert.deepEqual(applied.tags, fields.tags);
  assert.equal(applied.estimatedCfRating, 1600);
  assert.equal(applied.estimatedLuoguDifficulty, fields.luoguDifficulty);
  assert.equal(applied.rating, null);
  assert.equal(applied.luoguDifficulty, '');
  assert.equal(applied.communityDifficulty, 400);
  assert.match(applied.ratingEstimateReason, /手动补充/);
  assert.deepEqual(applied.supplementInfo, { source: 'manual', revision: 1, tags: true, difficulty: true });
  assert.deepEqual(f.service.apply(applied), applied);
  assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields }), /刷新/);
  assert.equal(f.writes(), 1);
});

test('revision survives deletion and recreation, rejects stale deletion, and supports repeated removal', () => {
  const f = fixture();
  f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields });
  assert.throws(() => f.service.removeSupplement({ url: URL_AT, expectedRevision: 0 }), /刷新/);
  const removed = f.service.removeSupplement({ url: URL_AT, expectedRevision: 1 });
  assert.equal(removed.supplement, null);
  assert.equal(removed.revision, 2);
  assert.equal(f.value().records[URL_AT].removed, true);
  assert.equal(f.service.removeSupplement({ url: URL_AT, expectedRevision: 2 }).revision, 2);
  assert.equal(f.writes(), 2);
  assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields }), /刷新/);
  assert.equal(f.service.saveSupplement({ url: URL_AT, expectedRevision: 2, ...fields }).revision, 3);
  assert.equal(f.value().records[URL_AT].removed, undefined);
});

test('AI suggestions persist pending and never affect applied problems before exact confirmation', () => {
  const f = fixture();
  const pending = f.service.storeSuggestion(URL_AT, fields, 'test-model');
  assert.equal(pending.supplement, null);
  assert.equal(pending.suggestion.status, 'pending');
  assert.equal(pending.revision, 0);
  assert.deepEqual(f.service.apply(problem()), problem());
  assert.equal(f.value().suggestions[URL_AT].id, pending.suggestion.id);
  assert.equal(f.service.storeSuggestion(URL_AT, fields, 'test-model').suggestion.id, pending.suggestion.id);
  assert.equal(f.writes(), 1);
  assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, suggestionId: 'forged', ...fields }), /AI 建议/);
  assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, suggestionId: pending.suggestion.id, ...fields, cfRating: 1800 }), /不一致/);
  const approved = f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, suggestionId: pending.suggestion.id, ...fields });
  assert.equal(approved.supplement.source, 'ai');
  assert.equal(approved.supplement.model, 'test-model');
  assert.equal(approved.suggestion, null);
  assert.equal(f.value().suggestions[URL_AT], undefined);
  assert.equal(f.service.apply(problem()).supplementInfo.source, 'ai');
  assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision: 1, suggestionId: pending.suggestion.id, ...fields }), /AI 建议/);
});

test('editing an AI suggestion explicitly as manual never claims AI attribution', () => {
  const f = fixture();
  f.service.storeSuggestion(URL_AT, fields, 'test-model');
  const result = f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields, cfRating: 1800 });
  assert.equal(result.supplement.source, 'manual');
  assert.equal(result.supplement.model, undefined);
  assert.equal(result.suggestion.status, 'pending');
  assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision: 1, ...fields, source: 'ai' }), /参数/);
});

test('official tags and difficulty are protected independently, and legacy fields are conservative', () => {
  const cf = problem({ url: URL_CF, source: 'CF', rating: 1500, tags: ['官方'], officialTags: undefined, officialDifficulty: undefined });
  const f = fixture(undefined, [cf]);
  const view = f.service.view(URL_CF);
  assert.deepEqual(view.officialTags, ['官方']);
  assert.equal(view.officialDifficulty, '1500');
  assert.equal(view.canSupplementTags, false);
  assert.equal(view.canSupplementDifficulty, false);
  assert.throws(() => f.service.saveSupplement({ url: URL_CF, expectedRevision: 0, ...fields }), /官方标签/);
  assert.throws(() => f.service.storeSuggestion(URL_CF, { cfRating: 1700, reason: 'test' }, 'test'), /官方难度/);
  const tagsOnly = fixture(undefined, [problem({ officialDifficulty: 'Easy' })]);
  assert.equal(tagsOnly.service.saveSupplement({ url: URL_AT, expectedRevision: 0, tags: ['数学'], reason: 'test' }).revision, 1);
  assert.equal(tagsOnly.service.apply(problem({ officialDifficulty: 'Easy' })).estimatedCfRating, 1200);
  const difficultyOnly = fixture(undefined, [problem({ tags: ['官方'], officialTags: ['官方'] })]);
  assert.equal(difficultyOnly.service.saveSupplement({ url: URL_AT, expectedRevision: 0, cfRating: 1700, reason: 'test' }).revision, 1);
  assert.deepEqual(difficultyOnly.service.apply(problem({ tags: ['官方'], officialTags: ['官方'] })).tags, ['官方']);
  const lgUrl = 'https://www.luogu.com.cn/problem/P1000';
  const lg = fixture(undefined, [problem({ url: lgUrl, source: 'LG', luoguDifficulty: '入门', officialDifficulty: undefined })]);
  assert.equal(lg.service.view(lgUrl).canSupplementDifficulty, false);
  const lcUrl = 'https://leetcode.com/problems/two-sum/';
  const lc = fixture(undefined, [problem({ url: lcUrl, source: 'LC', difficulty: 'Easy', officialDifficulty: undefined })]);
  assert.equal(lc.service.view(lcUrl).officialDifficulty, 'Easy');
  assert.equal(lc.service.view(lcUrl).canSupplementDifficulty, false);
});

test('later official metadata masks matching supplements while retaining review history', () => {
  const f = fixture();
  f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields });
  const officialTags = problem({ tags: ['官方标签'], officialTags: ['官方标签'] });
  f.problems.set(URL_AT, officialTags);
  assert.equal(f.service.view(URL_AT).canSupplementTags, false);
  const partial = f.service.apply(officialTags);
  assert.deepEqual(partial.tags, ['官方标签']);
  assert.equal(partial.estimatedCfRating, 1600);
  assert.equal(partial.supplementInfo.tags, false);
  const officialAll = problem({ tags: ['官方标签'], officialTags: ['官方标签'], officialDifficulty: '1500', rating: 1500 });
  f.problems.set(URL_AT, officialAll);
  assert.equal(f.service.view(URL_AT).canSupplementDifficulty, false);
  assert.deepEqual(f.service.apply(officialAll), officialAll);
  assert.equal(f.service.view(URL_AT).supplement.cfRating, 1600);
  assert.equal(f.writes(), 1);
});

test('later official metadata blocks approval of a pending AI suggestion', () => {
  const f = fixture();
  const pending = f.service.storeSuggestion(URL_AT, fields, 'test').suggestion;
  f.problems.set(URL_AT, problem({ officialDifficulty: 'Medium' }));
  assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, suggestionId: pending.id, ...fields }), /官方难度/);
  assert.equal(f.service.view(URL_AT).suggestion.id, pending.id);
  assert.equal(f.service.view(URL_AT).supplement, null);
});

test('bounds and unknown request fields fail before persistence', () => {
  for (const bad of [
    { ...fields, tags: Array.from({ length: 31 }, (_, i) => `tag${i}`) },
    { ...fields, tags: ['x'.repeat(101)] }, { ...fields, tags: [1] }, { ...fields, tags: ['https://secret.test'] },
    ...['2026', '2026年', '二〇二六年', '年份', '地区', '题目来源', 'interactive', '提交答案题'].map(tag => ({ ...fields, tags: [tag] })),
    { ...fields, cfRating: 799 }, { ...fields, cfRating: 3501 }, { ...fields, cfRating: 1200.5 }, { ...fields, cfRating: '1600' },
    { ...fields, luoguDifficulty: '自定义难度' }, { ...fields, reason: 'x'.repeat(4001) }, { ...fields, reason: '' },
    { ...fields, reason: 'text\u0000' }, { ...fields, rawData: { apiKey: 'do-not-persist' } }
  ]) {
    const f = fixture();
    assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...bad }));
    assert.equal(f.writes(), 0);
    assert.equal(f.value(), undefined);
  }
  for (const expectedRevision of [-1, 0.5, '0', null, Number.MAX_SAFE_INTEGER + 1]) {
    const f = fixture();
    assert.throws(() => f.service.saveSupplement({ url: URL_AT, expectedRevision, ...fields }));
    assert.equal(f.writes(), 0);
  }
});

test('each supported Luogu level is accepted and ASCII minus is normalized', () => {
  for (const level of ['暂无评定', '入门', '普及−', '普及/提高−', '普及+/提高', '提高+/省选−', '省选/NOI−', 'NOI/NOI+/CTSC']) {
    const f = fixture();
    const result = f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, tags: ['数学'], luoguDifficulty: level, reason: 'test' });
    assert.equal(result.supplement.luoguDifficulty, level);
  }
  for (const level of ['普及', '普及+/提高−', '提高', 'NOI/NOI+/CTS']) {
    const f = fixture();
    const saved = f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, luoguDifficulty: level, reason: 'daily filter compatibility' });
    assert.equal(saved.supplement.luoguDifficulty, level);
    assert.equal(f.service.apply(problem()).estimatedLuoguDifficulty, level);
  }
  for (const [input, expected] of [['普及-', '普及−'], ['普及+/提高-', '普及+/提高−'], ['提高+/省选-', '提高+/省选−']]) {
    assert.equal(fixture().service.saveSupplement({ url: URL_AT, expectedRevision: 0, luoguDifficulty: input, reason: 'test' }).supplement.luoguDifficulty, expected);
  }
});

test('preserves unknown root and entry extensions without exposing or accepting raw fields', () => {
  const f = fixture();
  f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields });
  const initial = structuredClone(f.value());
  initial.futureRoot = { version: 2 };
  initial.records[URL_AT].futureEntry = { value: 7 };
  const g = fixture(initial);
  const returned = g.service.saveSupplement({ url: URL_AT, expectedRevision: 1, tags: ['数学'], reason: 'updated' });
  assert.deepEqual(g.value().futureRoot, { version: 2 });
  assert.deepEqual(g.value().records[URL_AT].futureEntry, { value: 7 });
  assert.equal(g.value().records[URL_AT].cfRating, undefined);
  assert.equal(returned.supplement.futureEntry, undefined);
  returned.supplement.tags.push('view mutation');
  assert.deepEqual(g.service.view(URL_AT).supplement.tags, ['数学']);
  g.service.removeSupplement({ url: URL_AT, expectedRevision: 2 });
  assert.deepEqual(g.value().records[URL_AT].futureEntry, { value: 7 });
  assert.equal(initial.records[URL_AT].reason, fields.reason);
});

test('malformed schema or any corrupt record blocks reads and all writes without replacement', () => {
  const badStates = [null, false, [], {}, { schema: 2, records: {}, suggestions: {} }, { schema: 1, records: [], suggestions: {} }, { schema: 1, records: {}, suggestions: [] }, { schema: 1, records: { [URL_AT]: {} }, suggestions: {} }, { schema: 1, records: {}, suggestions: { [URL_AT]: {} } }];
  for (const initial of badStates) {
    const f = fixture(initial);
    for (const action of [() => f.service.view(URL_AT), () => f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields }), () => f.service.removeSupplement({ url: URL_AT, expectedRevision: 0 }), () => f.service.storeSuggestion(URL_AT, fields, 'test'), () => f.service.apply(problem())]) assert.throws(action, /损坏|版本/);
    assert.equal(f.value(), initial);
    assert.equal(f.writes(), 0);
  }
});

test('read failures and save failures propagate without mutating loaded records', () => {
  let writes = 0;
  const failing = createProblemEnrichment({ read: () => { throw new Error('invalid JSON'); }, save: () => { writes++; }, findProblem: () => problem() });
  assert.throws(() => failing.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields }), /读取失败/);
  assert.equal(writes, 0);
  const f = fixture();
  f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields });
  const original = structuredClone(f.value());
  const failedWrite = createProblemEnrichment({ read: () => original, save: () => { throw new Error('disk full'); }, findProblem: () => problem() });
  assert.throws(() => failedWrite.removeSupplement({ url: URL_AT, expectedRevision: 1 }), /disk full/);
  assert.equal(original.records[URL_AT].removed, undefined);
  assert.equal(original.records[URL_AT].revision, 1);
});

test('apply batches reuse a validated snapshot and refresh picks up disk changes or corruption', () => {
  const f = fixture();
  f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields });
  const diskChanged = structuredClone(f.value());
  diskChanged.records[URL_AT].cfRating = 1900;
  diskChanged.records[URL_AT].revision = 2;
  f.replace(diskChanged);
  const reads = f.reads();
  for (let i = 0; i < 100; i++) assert.equal(f.service.apply(problem()).estimatedCfRating, 1600);
  assert.equal(f.reads(), reads);
  f.service.refresh();
  assert.equal(f.reads(), reads + 1);
  assert.equal(f.service.apply(problem()).estimatedCfRating, 1900);
  assert.equal(f.reads(), reads + 1);
  f.replace({ schema: 2 });
  assert.throws(() => f.service.refresh(), /损坏|版本/);
  assert.throws(() => f.service.apply(problem()), /损坏|版本/);
});

test('failed save leaves the cached approved snapshot unchanged', () => {
  const f = fixture();
  f.service.saveSupplement({ url: URL_AT, expectedRevision: 0, ...fields });
  const service = createProblemEnrichment({ read: f.value, save: () => { throw new Error('disk full'); }, findProblem: () => problem() });
  assert.equal(service.apply(problem()).estimatedCfRating, 1600);
  assert.throws(() => service.saveSupplement({ url: URL_AT, expectedRevision: 1, ...fields, cfRating: 1900 }), /disk full/);
  assert.equal(service.apply(problem()).estimatedCfRating, 1600);
});

test('metadata is shared across sources by canonical platform URL and survives service recreation', () => {
  const f = fixture();
  f.service.saveSupplement({ url: URL_AT + '?lang=en', expectedRevision: 0, ...fields });
  for (const origin of ['local', 'public', 'library', 'atcoder-problems']) assert.deepEqual(f.service.apply(problem({ origin })).tags, fields.tags);
  const reopened = fixture(structuredClone(f.value()));
  assert.equal(reopened.service.view(URL_AT).supplement.revision, 1);
  assert.equal(reopened.service.apply(problem()).estimatedCfRating, 1600);
  assert.deepEqual(fixture().service.apply(problem()), problem());
});
