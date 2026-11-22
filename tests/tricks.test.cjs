'use strict';
const { appPath } = require('./app-path.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const YAML = require('yaml');
const { GitHub, parseTrick, cachedTrick, validateTrickPath, repositoryKey } = require(appPath('electron/github.cjs'));
const UUID = '55c710aa-e083-4b14-94fe-a3a825d17f70', NAME = `tricks/${UUID}.md`;
const scope = { repo: 'team/notebook', serverUrl: '', sourceKey: 'https://api.github.com|team/notebook' };
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

test('main persists successful writes/deletes, restores offline and isolates source caches', async () => {
 const result = cached(); let fail = false;
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
