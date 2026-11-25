'use strict';
const { appPath } = require('./app-path.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const YAML = require('yaml');
const { GitHub, parseTrick, cachedTrick, validateTrickPath, repositoryKey } = require(appPath('electron/github.cjs'));
const { TOPICS_PATH } = require(appPath('electron/algorithm-topics.cjs'));
const UUID = '55c710aa-e083-4b14-94fe-a3a825d17f70', NAME = `tricks/${UUID}.md`;
const scope = { repo: 'team/notebook', serverUrl: '', sourceKey: 'https://api.github.com|team/notebook' };
const builtinLeaf = 'algorithm-二分查找', builtinAlias = 'xcpc-dsu-on-tree-1', canonicalAlias = 'xcpc-树的启发式合并-1';
const customLeaf = 'custom-55c710aa-e083-4b14-94fe-a3a825d17f71', customDirectory = 'custom-55c710aa-e083-4b14-94fe-a3a825d17f72';
const recommendation = (extra = {}) => ({ tier: 'S', prerequisiteIds: [builtinLeaf, customLeaf], reason: 'Shows the invariant clearly.', ...extra });
const directory = JSON.stringify({ schema: 1, topics: [
 { id: customDirectory, parentId: 'root', label: 'Test directory', fullLabel: 'Test directory', kind: 'directory', color: 'parent', createdAt: '2026-11-21T00:00:00Z', createdBy: { id: 42, login: 'alice' } },
 { id: customLeaf, parentId: customDirectory, label: 'Test algorithm', fullLabel: 'Test algorithm', kind: 'algorithm', color: 'basic', createdAt: '2026-11-21T00:00:00Z', createdBy: { id: 42, login: 'alice' } },
] });
const directoryRequests = h => h.calls.filter(call => call.pathname.endsWith(`/contents/${TOPICS_PATH}`));
const input = (extra = {}) => ({ ...scope, clientId: UUID, title: 'Binary boundary', introduction: 'A short public introduction', body: '# Content\n\n```cpp\nreturn 42;\n```', ...extra });
const text = (extra = {}, body = '# Original body') => `---\n${YAML.stringify({ schema: 1, kind: 'trick', title: 'Original title', introduction: 'Original intro', authorId: 42, author: 'alice', updatedAt: '2026-11-21T00:00:00Z', ...extra })}---\n${body}`;
function fixture({ files = {}, userId = 42, login = 'alice', permissions = { push: true, admin: false }, token = 'FAKE_TEST_TOKEN', serverUrl = '', failWrite = 0, noSha = false, networkWrite = false, paginated = false } = {}) {
 const data = new Map(Object.entries(files).map(([name, value], index) => [name, { text: value, sha: `old-sha-${index}` }]));
 const calls = [], writes = [];
 const fetcher = async (url, options = {}) => {
  const u = new URL(url), pathname = decodeURIComponent(u.pathname).replace(/^.*?\/api\/v1/, '');
  calls.push({ url, pathname, options });
  const reply = (body, status = 200) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body });
  if (pathname === '/user') return reply({ id: userId, login });
  if (pathname === '/repos/team/notebook') return reply({ default_branch: 'main', permissions: typeof permissions === 'function' ? permissions() : permissions });
  if (pathname.startsWith('/repos/team/notebook/contents/')) {
   const name = pathname.slice('/repos/team/notebook/contents/'.length), file = data.get(name);
   if (options.method === 'PUT' || options.method === 'DELETE') {
    const payload = JSON.parse(options.body); writes.push({ name, method: options.method, ...payload });
    if (networkWrite) throw Error('offline');
    if (failWrite) return reply({ message: 'conflict' }, failWrite);
    if (options.method === 'DELETE') { data.delete(name); return reply({}); }
    const sha = `saved-sha-${writes.length}`; data.set(name, { text: Buffer.from(payload.content, 'base64').toString('utf8'), sha });
    return reply(noSha ? {} : { content: { sha } });
   }
   return file ? reply({ type: 'file', ...(serverUrl ? {} : { encoding: 'base64' }), sha: file.sha, content: Buffer.from(file.text).toString('base64') }) : reply({}, 404);
  }
  if (pathname === '/repos/team/notebook/git/trees/main') {
   let tree = [...data].map(([name, file]) => ({ type: 'blob', path: name, sha: file.sha }));
   const total_count = tree.length;
   if (paginated) tree = tree.slice(Number(u.searchParams.get('page') || 1) - 1, Number(u.searchParams.get('page') || 1));
   return reply({ tree, ...(paginated ? { total_count } : {}) });
  }
  if (pathname.startsWith('/repos/team/notebook/git/blobs/')) {
   const file = [...data.values()].find(item => item.sha === pathname.split('/').at(-1)); assert.ok(file);
   return reply({ ...(serverUrl ? {} : { encoding: 'base64' }), content: Buffer.from(file.text).toString('base64') });
  }
  if (pathname === '/repos/team/notebook/issues') return reply([]);
  throw Error(`Unexpected ${pathname}`);
 };
 return { gh: new GitHub({ repo: scope.repo, token, serverUrl, fetcher }), data, calls, writes };
}

test('creates public Markdown with authoritative fresh author; supplied metadata cannot forge identity', async () => {
 const h = fixture();
 const body = '---\nauthorId: 99\nauthor: mallory\n---\n# User Markdown';
 const result = await h.gh.saveTrick(input({ body, authorId: 99, author: { id: 99, login: 'mallory' }, path: undefined, admin: true }));
 assert.equal(result.kind, 'trick'); assert.equal(result.path, NAME); assert.equal(result.id, `trick:${NAME}`);
 assert.equal(result.authorId, 42); assert.deepEqual(result.author, { id: 42, login: 'alice' }); assert.equal(result.body, body);
 const saved = h.data.get(NAME), meta = YAML.parse(saved.text.match(/^---\n([\s\S]*?)\n---/)[1]);
 assert.equal(meta.schema, 1); assert.equal(meta.kind, 'trick'); assert.equal(meta.authorId, 42); assert.equal(meta.author, 'alice');
 assert.equal(meta.repo, undefined); assert.equal(meta.sha, undefined); assert.equal(h.writes.length, 1);
 assert.ok(h.calls.some(call => call.pathname === '/user'));
 assert.ok(h.calls.some(call => call.pathname === '/repos/team/notebook'));
 assert.equal(h.writes[0].sha, undefined);
});

test('stable client UUID retry is idempotent and a changed payload cannot overwrite a collision', async () => {
 const h = fixture(); const first = await h.gh.saveTrick(input()); const retry = await h.gh.saveTrick(input());
 assert.deepEqual(retry, first); assert.equal(h.writes.length, 1);
 await assert.rejects(h.gh.saveTrick(input({ body: 'different' })), /已存在但内容不同/); assert.equal(h.writes.length, 1);
});

test('only freshly confirmed administrators can add, change or remove recommendations', async () => {
 const added = recommendation({ prerequisiteIds: [] });
 for (const permissions of [{ push: true, admin: false }, { push: true, admin: 'true' }, { push: true, admin: 1 }]) {
  const h = fixture({ permissions });
  await assert.rejects(h.gh.saveTrick(input({ recommendation: added, admin: true, permissions: { admin: true }, authorId: 42 })), /管理员/);
  assert.equal(h.writes.length, 0); assert.equal(directoryRequests(h).length, 0);
 }
 let isAdmin = true;
 const h = fixture({ permissions: () => ({ push: true, admin: isAdmin }) });
 const first = await h.gh.saveTrick(input({ recommendation: added }));
 isAdmin = false;
 for (const changed of [null, { ...added, tier: 'A' }, { ...added, reason: 'Different reason' }, recommendation()]) {
  await assert.rejects(h.gh.saveTrick(input({ path: NAME, sha: first.sha, recommendation: changed, admin: true })), /管理员/);
 }
 assert.equal(h.writes.length, 1); assert.equal(directoryRequests(h).length, 0);
 assert.equal(h.calls.filter(call => call.pathname === '/repos/team/notebook').length, 5);
 const echoed = await h.gh.saveTrick(input({ path: NAME, sha: first.sha, title: 'Content edit', recommendation: added }));
 assert.deepEqual(echoed.recommendation, added); assert.equal(h.writes.at(-1).sha, first.sha);
 const plain = await fixture().gh.saveTrick(input({ recommendation: null }));
 assert.equal(Object.hasOwn(plain, 'recommendation'), false);
});

test('changed recommendations validate hydrated leaves, canonicalize aliases and store no credentials', async () => {
 const token = 'SYNTHETIC_TRICK_AUTH_SENTINEL';
 const h = fixture({ permissions: { admin: true }, token, files: { [TOPICS_PATH]: directory } });
 const requested = recommendation({ prerequisiteIds: [builtinLeaf, builtinAlias, customLeaf], reason: '  Useful invariant: yes.  ', token, permissions: { admin: true } });
 const result = await h.gh.saveTrick(input({ recommendation: requested, token, scope }));
 const expected = recommendation({ prerequisiteIds: [builtinLeaf, canonicalAlias, customLeaf], reason: 'Useful invariant: yes.' });
 assert.deepEqual(result.recommendation, expected);
 const committed = h.data.get(NAME).text;
 const meta = YAML.parse(committed.match(/^---\n([\s\S]*?)\n---/)[1]);
 assert.deepEqual(meta.recommendation, expected); assert.equal(meta.schema, 1); assert.equal(meta.token, undefined);
 assert.equal(committed.includes(token), false); assert.equal(JSON.stringify(result).includes(token), false);
 assert.equal(JSON.stringify(h.writes).includes(token), false);
 assert.equal(directoryRequests(h).length, 1); assert.equal(new URL(directoryRequests(h)[0].url).searchParams.get('ref'), 'main');
 assert.ok(h.calls.every(call => call.options.headers.Authorization === `Bearer ${token}`));
 assert.deepEqual(await h.gh.saveTrick(input({ recommendation: requested })), result, 'alias-form retry finds the canonical payload');
 assert.equal(h.writes.length, 1);
 for (const ids of [['missing-leaf'], ['root'], ['roadmap:xh'], [customDirectory], [builtinAlias, canonicalAlias]]) {
  const bad = fixture({ permissions: { admin: true }, files: { [TOPICS_PATH]: directory } });
  await assert.rejects(bad.gh.saveTrick(input({ recommendation: recommendation({ prerequisiteIds: ids }) })), /叶节点|重复/);
  assert.equal(bad.writes.length, 0);
 }
 const missing = fixture({ permissions: { admin: true } });
 await assert.rejects(missing.gh.saveTrick(input({ recommendation: recommendation({ prerequisiteIds: [customLeaf] }) })), /叶节点/);
 assert.equal(missing.writes.length, 0);
 assert.deepEqual((await missing.gh.saveTrick(input({ recommendation: recommendation({ prerequisiteIds: [builtinLeaf] }) }))).recommendation.prerequisiteIds, [builtinLeaf]);
});

test('validates bounded single-line reasons and syntactically unique prerequisite IDs before requesting the directory', async () => {
 const valid = recommendation({ prerequisiteIds: [], reason: '  ' + '汉'.repeat(200) + '  ' });
 const h = fixture({ permissions: { admin: true } });
 for (const invalid of [false, [], {}, { ...valid, tier: 'a' }, { ...valid, tier: 'F' },
  ...['', '  ', 'x\ny', '\nx', 'x\ry', 'x\ty', 'x\u0085y', 'x\u2028y', 'x\u2029y', '\0', '汉'.repeat(201), 42].map(reason => ({ ...valid, reason })),
  ...[null, [42], [''], ['a/b'], ['a\\b'], ['a%20b'], ['a b'], ['x\n'], Array(1), ['x'.repeat(1001)], [builtinLeaf, builtinLeaf], Array.from({ length: 9 }, (_, n) => `algorithm-${n}`)].map(prerequisiteIds => ({ ...valid, prerequisiteIds })),
 ]) await assert.rejects(h.gh.saveTrick(input({ recommendation: invalid })), /推荐/);
 assert.equal(h.writes.length, 0);
 const saved = await h.gh.saveTrick(input({ recommendation: valid }));
 assert.equal(Buffer.byteLength(saved.recommendation.reason), 600); assert.equal(directoryRequests(h).length, 0);
});

test('omission preserves existing reviews even after an algorithm is deleted; rating changes honor SHA and idempotency', async () => {
 const firstRating = recommendation();
 for (const admin of [false, true]) {
  const h = fixture({ permissions: { push: true, admin }, files: { [NAME]: text({ recommendation: firstRating }), [TOPICS_PATH]: 'broken directory' } });
  const saved = await h.gh.saveTrick(input({ path: NAME, sha: 'old-sha-0' }));
  assert.deepEqual(saved.recommendation, firstRating); assert.deepEqual(parseTrick(NAME, h.data.get(NAME).text, saved.sha, scope).recommendation, firstRating);
  assert.equal(h.writes[0].sha, 'old-sha-0'); assert.equal(directoryRequests(h).length, 0);
  assert.deepEqual(await h.gh.saveTrick(input({ path: NAME, sha: saved.sha, recommendation: firstRating })), saved);
  assert.equal(h.writes.length, 1); assert.equal(directoryRequests(h).length, 0);
 }
 const h = fixture({ permissions: { admin: true }, files: { [TOPICS_PATH]: directory } });
 const first = await h.gh.saveTrick(input({ recommendation: firstRating }));
 assert.deepEqual(await h.gh.saveTrick(input({ recommendation: firstRating })), first);
 assert.deepEqual(await h.gh.saveTrick(input()), first, 'old client retry omits rating');
 assert.equal(directoryRequests(h).length, 1);
 const nextRating = { ...firstRating, tier: 'A' };
 for (const value of [nextRating, null]) await assert.rejects(h.gh.saveTrick(input({ recommendation: value })), /已存在但内容不同/);
 await assert.rejects(h.gh.saveTrick(input({ path: NAME, sha: 'stale', recommendation: nextRating })), /SHA冲突/);
 assert.equal(h.writes.length, 1);
 const second = await h.gh.saveTrick(input({ path: NAME, sha: first.sha, recommendation: nextRating }));
 assert.equal(second.recommendation.tier, 'A'); assert.equal(h.writes.at(-1).sha, first.sha);
 h.data.delete(TOPICS_PATH);
 const beforeClear = directoryRequests(h).length;
 const cleared = await h.gh.saveTrick(input({ path: NAME, sha: second.sha, recommendation: null }));
 assert.equal(Object.hasOwn(cleared, 'recommendation'), false); assert.doesNotMatch(h.data.get(NAME).text, /^recommendation:/m);
 assert.deepEqual(await h.gh.saveTrick(input({ path: NAME, sha: cleared.sha, recommendation: null })), cleared);
 assert.equal(h.writes.length, 3); assert.equal(h.writes.at(-1).sha, second.sha); assert.equal(directoryRequests(h).length, beforeClear);
});

test('owners update/delete; administrators manage others while preserving original authorship', async () => {
 const own = fixture({ files: { [NAME]: text() } });
 const saved = await own.gh.saveTrick(input({ path: NAME, sha: own.data.get(NAME).sha }));
 assert.equal(own.writes[0].sha, 'old-sha-0'); assert.equal(saved.authorId, 42);
 assert.equal((await own.gh.deleteTrick({ ...scope, path: NAME, sha: saved.sha })).deleted, true);
 const other = fixture({ files: { [NAME]: text({ authorId: 99, author: 'bob' }) } });
 for (const action of ['saveTrick', 'deleteTrick']) await assert.rejects(other.gh[action](input({ path: NAME, sha: 'old-sha-0', admin: true, authorId: 42 })), /本人/);
 assert.equal(other.writes.length, 0);
 const admin = fixture({ permissions: { admin: true }, files: { [NAME]: text({ authorId: 99, author: 'bob' }) } });
 const managed = await admin.gh.saveTrick(input({ path: NAME, sha: 'old-sha-0' }));
 assert.deepEqual(managed.author, { id: 99, login: 'bob' }); assert.equal(managed.authorId, 99);
 await admin.gh.deleteTrick({ path: NAME, sha: managed.sha }); assert.equal(admin.writes.length, 2);
});

test('fresh strict permission, identity and current SHA are required for every write', async () => {
 for (const permissions of [{ push: false, admin: false }, { push: 'true' }, { admin: 1 }]) {
  const h = fixture({ permissions }); await assert.rejects(h.gh.saveTrick(input()), /权限/); assert.equal(h.writes.length, 0);
 }
 for (const userId of [null, '42', 0]) await assert.rejects(fixture({ userId }).gh.saveTrick(input()), /身份/);
 await assert.rejects(fixture({ token: '' }).gh.saveTrick(input()), /登录/);
 const h = fixture({ files: { [NAME]: text() } });
 for (const sha of [undefined, '', 'stale']) {
  await assert.rejects(h.gh.saveTrick(input({ path: NAME, sha })), /SHA/);
  await assert.rejects(h.gh.deleteTrick({ path: NAME, sha }), /SHA/);
 }
 await assert.rejects(fixture().gh.saveTrick(input({ path: NAME, sha: 'gone' })), /删除/);
 await assert.rejects(fixture().gh.deleteTrick({ path: NAME, sha: 'gone' }), /不存在/);
 assert.equal(h.writes.length, 0);
});

test('strict input and source/path boundaries reject traversal, cross-source and byte-limit payloads', async () => {
 for (const invalid of [null, [], 'x', input({ title: '' }), input({ introduction: '' }), input({ title: '汉'.repeat(201) }), input({ introduction: '汉'.repeat(2001) }), input({ body: '汉'.repeat(333334) }), input({ body: '' }), input({ introduction: '\u0000' }), input({ clientId: 'x' }), input({ repo: 'other/repo' }), input({ sourceKey: '' }), input({ sourceKey: 'https://other|team/notebook' }), input({ serverUrl: 'https://gitea.test' })]) {
  const h = fixture(); await assert.rejects(h.gh.saveTrick(invalid)); assert.equal(h.writes.length, 0);
 }
 for (const name of ['problems/x.md', 'tricks/../x.md', 'tricks/%2e%2e.md', 'tricks/'+UUID+'.MD', 'tricks/x.md', 'tricks/sub/'+UUID+'.md']) {
  assert.throws(() => validateTrickPath(name));
  const h = fixture(); await assert.rejects(h.gh.saveTrick(input({ path: name, sha: 'x' }))); await assert.rejects(h.gh.deleteTrick({ path: name, sha: 'x' })); assert.equal(h.writes.length, 0);
 }
});

test('conflict and unknown network result never silently succeed', async () => {
 for (const failWrite of [409, 422]) await assert.rejects(fixture({ failWrite }).gh.saveTrick(input()), /冲突/);
 await assert.rejects(fixture({ noSha: true }).gh.saveTrick(input()), /结果未知/);
 await assert.rejects(fixture({ networkWrite: true }).gh.saveTrick(input()), /结果未知/);
 const h = fixture({ files: { [NAME]: text() }, failWrite: 409 });
 await assert.rejects(h.gh.deleteTrick({ path: NAME, sha: 'old-sha-0' }), /冲突/);
});

test('sync separates tricks from solutions, validates immutable/cached bytes, and removes deleted entries', async () => {
 const h = fixture({ token: '', files: { [NAME]: text(), 'problems/test.md': '# Solution' } });
 const first = await h.gh.sync(); assert.equal(first.tricks.length, 1); assert.equal(first.records.length, 1);
 assert.ok(first.records.every(r => !r.path.startsWith('tricks/'))); assert.equal(first.tricks[0].authorId, 42);
 const unchanged = fixture({ token: '', files: { [NAME]: text(), 'problems/test.md': '# Solution' } });
 await unchanged.gh.sync(first); assert.ok(unchanged.calls.every(c => !c.pathname.includes('/git/blobs/')));
 assert.deepEqual((await fixture({ token: '' }).gh.sync(first)).tricks, []);
 const corrupt = structuredClone(first); corrupt.blobs['old-sha-0'] = text({ authorId: '42' });
 await assert.rejects(unchanged.gh.sync(corrupt), /作者/);
 for (const value of [text({ kind: 'document' }), text({ schema: 2 }), text({ updatedAt: 'invalid' }), text({ title: '汉'.repeat(201) })]) await assert.rejects(fixture({ token: '', files: { [NAME]: value } }).gh.sync());
 const documented = await fixture({ token: '', files: { [NAME]: text(), 'tricks/README.md': '# Guide', 'tricks/unsafe.md': text(), 'tricks/examples/example.md': '# Example' } }).gh.sync();
  assert.equal(documented.tricks.length, 1, 'unmanaged Markdown does not block repository sync');
});

test('Gitea anonymously reads paginated public tricks and rejects all writes', async () => {
 const next = `tricks/55c710aa-e083-4b14-94fe-a3a825d17f71.md`;
 const h = fixture({ serverUrl: 'https://git.example/team', token: 'MUST_NOT_LEAK', paginated: true, files: { [NAME]: text(), [next]: text() } });
 const snapshot = await h.gh.sync(); assert.equal(snapshot.tricks.length, 2);
 assert.equal(snapshot.tricks[0].sourceKey, repositoryKey(scope.repo, 'https://git.example/team'));
 assert.ok(h.calls.every(call => !('Authorization' in call.options.headers)));
 await assert.rejects(h.gh.saveTrick({ title: 'x', introduction: 'intro', body: 'y' }), /登录|Gitea/);
 await assert.rejects(h.gh.deleteTrick({ path: NAME, sha: 'old-sha-0' }), /登录|Gitea/);
 assert.equal(h.writes.length, 0);
});

function mainHarness(options) { const source = fs.readFileSync(path.join(__dirname, 'main.test.cjs'), 'utf8').split('// END_MAIN_HARNESS')[0]; return new Function('require', '__dirname', 'Buffer', source+'\nreturn harness;')(require, __dirname, Buffer)(options); }
const cached = () => parseTrick(NAME, text(), 'cache-sha', scope);

test('cached records are revalidated by source, identity, byte limits and kind', () => {
 const good = cached(); assert.deepEqual(cachedTrick(good, scope), good);
 for (const record of [null, [], { ...good, sourceKey: 'evil' }, { ...good, serverUrl: 'https://evil' }, { ...good, repo: 'other/repo' }, { ...good, body: 1 }, { ...good, introduction: '汉'.repeat(2001) }, { ...good, title: '汉'.repeat(201) }, { ...good, author: { id: 99, login: 'bob' } }, { ...good, kind: 'document' }, { ...good, id: 'forged' }, { ...good, clientId: 'forged' }, { ...good, sha: '' }]) assert.equal(cachedTrick(record, scope), null);
});

test('valid recommendations roundtrip through parse, cache, sync, and cached blobs without a directory match', async () => {
 const review = recommendation({ tier: 'B' });
 const source = text({ recommendation: review });
 const parsed = parseTrick(NAME, source, 'old-sha-0', scope);
 assert.deepEqual(parsed.recommendation, review); assert.deepEqual(cachedTrick(parsed, scope), parsed);
 assert.equal(Object.hasOwn(cached(), 'recommendation'), false);
 const files = { [NAME]: source };
 const h = fixture({ files, token: '' }), snapshot = await h.gh.sync();
 assert.deepEqual(snapshot.tricks, [parsed]); assert.equal(snapshot.blobs[parsed.sha], source);
 const unchanged = fixture({ files, token: '' });
 assert.deepEqual((await unchanged.gh.sync(snapshot)).tricks, [parsed]);
 assert.ok(unchanged.calls.every(call => !call.pathname.includes('/git/blobs/')));
});

test('all six recommendation tiers save, sync and roundtrip without treating E as unrated', async () => {
 for (const tier of ['S', 'A', 'B', 'C', 'D', 'E']) {
  const review = recommendation({ tier, prerequisiteIds: [] });
  const h = fixture({ permissions: { admin: true } });
  const saved = await h.gh.saveTrick(input({ recommendation: review }));
  assert.deepEqual(saved.recommendation, review); assert.deepEqual(cachedTrick(saved, scope), saved);
  const snapshot = await fixture({ files: { [NAME]: h.data.get(NAME).text }, token: '' }).gh.sync();
  assert.deepEqual(snapshot.tricks[0].recommendation, review);
 }
});

test('malformed stored reviews fail closed without making the Trick unreadable or silently rewriting bytes', async () => {
 for (const bad of [null, 42, [], recommendation({ tier: 'F' }), recommendation({ reason: 'x\ny' }), recommendation({ prerequisiteIds: [builtinLeaf, builtinLeaf] })]) {
  const source = text({ recommendation: bad }, 'Existing content must survive.');
  const files = { [NAME]: source }, parsed = parseTrick(NAME, source, 'old-sha-0', scope);
  assert.equal(parsed.body, 'Existing content must survive.'); assert.equal(Object.hasOwn(parsed, 'recommendation'), false);
  assert.deepEqual(cachedTrick({ ...parsed, recommendation: bad }, scope), parsed);
  const snapshot = await fixture({ files, token: '' }).gh.sync();
  assert.deepEqual(snapshot.tricks, [parsed]); assert.equal(snapshot.blobs[parsed.sha], source);
  const h = fixture({ files });
  const edit = { path: NAME, sha: parsed.sha };
  await assert.rejects(h.gh.saveTrick(input(edit)), /推荐格式无效/);
  await assert.rejects(h.gh.saveTrick(input({ ...edit, recommendation: null })), /管理员/);
  assert.equal(h.writes.length, 0); assert.deepEqual(h.data.get(NAME), { text: source, sha: parsed.sha });
  const admin = fixture({ files, permissions: { admin: true } });
  await assert.rejects(admin.gh.saveTrick(input(edit)), /推荐格式无效/);
  assert.equal(admin.data.get(NAME).text, source); assert.equal(admin.writes.length, 0);
  const cleared = await admin.gh.saveTrick(input({ ...edit, recommendation: null }));
  assert.equal(Object.hasOwn(cleared, 'recommendation'), false); assert.equal(admin.writes[0].sha, parsed.sha);
  assert.doesNotMatch(admin.data.get(NAME).text, /^recommendation:/m);
 }
});

test('main persists successful writes/deletes, restores offline and isolates source caches', async () => {
 const result = parseTrick(NAME, text({ recommendation: recommendation() }), 'cache-sha', scope); let fail = false;
 const h = mainHarness({ backend: { saveTrick: async () => { if (fail) throw Error('conflict'); return result; }, deleteTrick: async () => ({ ...scope, id: result.id, path: result.path, deleted: true }), sync: async () => ({ records: [], issues: [], tricks: [] }) } });
 assert.deepEqual((await h.invoke('bootstrap')).tricks, []);
 assert.deepEqual(await h.invoke('saveTrick', input()), result); assert.equal((await h.invoke('bootstrap')).tricks.length, 1);
 const restart = mainHarness({ account: null, files: { 'cache.json': h.stored('cache.json') } });
 assert.deepEqual((await restart.invoke('bootstrap')).tricks, [result]); assert.equal(restart.calls.length, 0);
 const writes = h.writes.length; fail = true; await assert.rejects(h.invoke('saveTrick', input()), /conflict/); assert.equal(h.writes.length, writes);
 fail = false; await h.invoke('deleteTrick', { path: NAME, sha: result.sha }); assert.deepEqual((await h.invoke('bootstrap')).tricks, []);
 await h.invoke('saveTrick', input()); assert.deepEqual((await h.invoke('sync')).tricks, []);
 await h.invoke('saveTrick', input()); await h.invoke('saveSettings', { repo: 'other/repo' }); assert.deepEqual((await h.invoke('bootstrap')).tricks, []);
 await h.invoke('saveSettings', { repo: 'team/notebook' }); assert.equal((await h.invoke('bootstrap')).tricks.length, 1);
 const bad = mainHarness({ account: null, files: { 'cache.json': { repo: scope.repo, tricks: [result, { ...result, sourceKey: 'evil' }, { ...result, title: 22 }] } } });
 assert.deepEqual((await bad.invoke('bootstrap')).tricks, [result]);
});

test('main sender/write locks/login-generation protect cache on save and delete', async () => {
 const result = cached();
 for (const action of ['saveTrick', 'deleteTrick']) {
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const h = mainHarness({ backend: { [action]: async () => { await waiting; return action === 'saveTrick' ? result : { ...scope, id: result.id, path: NAME, deleted: true }; } } });
  await assert.rejects(h.handlers.get(action)({ sender: {} }, input()), /非法调用/);
  const pending = h.invoke(action, input({ path: NAME, sha: result.sha })); await Promise.resolve();
  await assert.rejects(h.invoke('saveTrick', input()), /操作/); await assert.rejects(h.invoke('sync'), /等待/); await assert.rejects(h.invoke('saveSettings', { repo: 'other/repo' }), /等待/);
  await h.invoke('cancelLogin'); release(); await assert.rejects(pending, /配置已改变/); assert.equal(h.stored('cache.json'), null);
 }
 const gitea = mainHarness({ files: { 'settings.json': { repo: scope.repo, serverUrl: 'https://gitea.test' } } });
 await assert.rejects(gitea.invoke('saveTrick', input()), /Gitea/); await assert.rejects(gitea.invoke('deleteTrick', input()), /Gitea/); assert.equal(gitea.calls.length, 0);
});
