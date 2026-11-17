'use strict';
const { appPath } = require('./app-path.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { GitHub, LEARNING_GATES_PREFIX, parseLearningGateText } = require(appPath('electron/github.cjs'));
const gateId = require(appPath('ui/algorithm-learning-path-data.js')).stages[1].gates[0].id;
const input = (extra = {}) => ({ repo: 'team/notebook', gateId, description: '管理员编写的公开学习说明', goals: ['理解输入输出边界', '独立完成相应练习'], practiceList: { title: '测试题单', url: 'https://example.com/list/learning' }, sha: null, ...extra });
const fileContent = (extra = {}) => ({ schema: 1, ...input(), sha: undefined, repo: undefined, updatedAt: '2026-11-15T05:00:00.000Z', author: { id: 42, login: 'alice' }, ...extra });
function fixture({ admin = true, push = true, file = null, sha = 'old-sha', failPut = 0, failBlob = 0, noSha = false, token = 'FAKE_TEST_TOKEN', serverUrl = '', permission } = {}) {
  let stored = file, currentSha = sha; const calls = [], writes = [];
  const fetcher = async (url, opts = {}) => {
    const pathname = new URL(url).pathname.replace(/^\/api\/v1/, ''); calls.push({ pathname, opts });
    const reply = (data, status = 200) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => data });
    if (pathname === '/user') return reply({ id: 42, login: 'alice', token: 'must-not-escape' });
    if (pathname === '/repos/team/notebook') return reply({ default_branch: 'main', permissions: permission ? permission() : { admin, push, maintain: true } });
    if (pathname === `/repos/team/notebook/contents/${LEARNING_GATES_PREFIX}${gateId}.json`) {
      if (opts.method === 'PUT') { const body = JSON.parse(opts.body); writes.push(body); if (failPut) return reply({ message: 'conflict' }, failPut); assert.equal(body.sha, stored ? currentSha : undefined); stored = Buffer.from(body.content, 'base64').toString('utf8'); currentSha = 'new-sha'; return reply(noSha ? {} : { content: { sha: currentSha } }); }
      return stored === null ? reply({}, 404) : reply({ type: 'file', encoding: 'base64', sha: currentSha, content: Buffer.from(stored).toString('base64') });
    }
    if (pathname === `/repos/team/notebook/git/blobs/${currentSha}`) return failBlob ? reply({ message: 'blob unavailable' }, failBlob) : reply({ encoding: 'base64', content: Buffer.from(stored).toString('base64') });
    if (pathname === '/repos/team/notebook/git/trees/main') return reply({ tree: stored === null ? [] : [{ type: 'blob', path: `${LEARNING_GATES_PREFIX}${gateId}.json`, sha: currentSha }] });
    if (pathname === '/repos/team/notebook/issues') return reply([]);
    if (pathname === '/repos/team/notebook/contents/algorithms/learning-path/curriculum.json') return reply({}, 404);
    throw new Error(`Unexpected request ${pathname}`);
  };
  return { gh: new GitHub({ repo: 'team/notebook', token, fetcher, serverUrl }), calls, writes, get saved() { return stored; } };
}

test('fresh strict admin writes schema-one public files and returns only public author metadata', async () => {
  const h = fixture(); const result = await h.gh.saveLearningGate(input());
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].sha, undefined); assert.equal(result.sha, 'new-sha');
  assert.equal(result.sourceKey, 'https://api.github.com|team/notebook'); assert.deepEqual(result.author, { id: 42, login: 'alice' });
  assert.equal(JSON.parse(h.saved).schema, 1); assert.equal(JSON.parse(h.saved).sha, undefined); assert.equal(JSON.parse(h.saved).repo, undefined);
  assert.ok(!JSON.stringify(result).includes('FAKE_TEST_TOKEN')); assert.ok(!h.saved.includes('must-not-escape'));
  assert.equal(h.calls.filter(c => c.pathname === '/repos/team/notebook').length, 2, 'write context plus fresh strict admin recheck');
});

test('push, maintain, truthy admin and cached permission fields cannot authorize public edits', async () => {
  for (const options of [{ admin: false }, { admin: 'true' }, { admin: 1 }, { admin: false, push: false }, { token: '' }]) {
    const h = fixture(options); await assert.rejects(h.gh.saveLearningGate(input({ permissions: { admin: true } })), /管理员|登录|权限/); assert.equal(h.writes.length, 0);
  }
  let calls = 0; const h = fixture({ permission: () => ({ push: true, admin: ++calls === 1 }) });
  await assert.rejects(h.gh.saveLearningGate(input()), /管理员/); assert.equal(h.writes.length, 0);
});

test('input identity, field bounds, explicit SHA, goal count and URL validation precede all writes', async () => {
  const bad = [null, [], input({ repo: 'other/repo' }), input({ repo: undefined }), input({ gateId: '../bad' }), input({ description: '' }), input({ description: 'x'.repeat(6001) }), input({ goals: [] }), input({ goals: Array(21).fill('x') }), input({ goals: ['x'.repeat(501)] }), input({ goals: Array(20).fill('x'.repeat(400)) }), input({ sha: undefined }), input({ sha: '' }), input({ practiceList: undefined })];
  for (const url of ['javascript:alert(1)', 'ftp://example.com/a', 'https://alice:password@example.com/list', 'https://example.com/\\bad', 'https://example.com/list\nsecret']) bad.push(input({ practiceList: { title: '测试', url } }));
  for (const value of bad) { const h = fixture(); await assert.rejects(h.gh.saveLearningGate(value)); assert.equal(h.writes.length, 0); }
});

test('create, edit and deletion races reject stale SHA without silently refreshing it', async () => {
  const stored = JSON.stringify(fileContent());
  for (const extra of [{ sha: null }, { sha: 'stale-sha' }]) { const h = fixture({ file: stored }); await assert.rejects(h.gh.saveLearningGate(input(extra)), /SHA冲突/); assert.equal(h.writes.length, 0); }
  const deleted = fixture(); await assert.rejects(deleted.gh.saveLearningGate(input({ sha: 'old-sha' })), /SHA冲突/); assert.equal(deleted.writes.length, 0);
  const h = fixture({ file: stored }); await h.gh.saveLearningGate(input({ sha: 'old-sha', practiceList: null })); assert.equal(h.writes[0].sha, 'old-sha'); assert.equal(JSON.parse(h.saved).practiceList, null);
  for (const status of [409, 422]) { const conflict = fixture({ file: stored, failPut: status }); await assert.rejects(conflict.gh.saveLearningGate(input({ sha: 'old-sha' })), /冲突/); assert.equal(conflict.saved, stored); }
  await assert.rejects(fixture({ noSha: true }).gh.saveLearningGate(input()), /结果未知/);
});

test('anonymous sync reads validated public contents and deletion clears previous overrides', async () => {
  const h = fixture({ token: '', file: JSON.stringify(fileContent()) }); const synced = await h.gh.sync();
  assert.equal(synced.learningGateContents.length, 1); assert.equal(synced.learningGateContents[0].gateId, gateId); assert.equal(synced.learningGateContents[0].sha, 'old-sha');
  assert.ok(h.calls.every(call => !call.opts.headers.Authorization));
  assert.deepEqual((await fixture({ token: '' }).gh.sync(synced)).learningGateContents, []);
  for (const value of [fileContent({ schema: 2 }), fileContent({ gateId: 'missing' }), fileContent({ author: { id: 0, login: 'bad' } }), fileContent({ updatedAt: 'bad' }), fileContent({ practiceList: { title: 'bad', url: 'javascript:alert(1)' } })]) {
    await assert.rejects(fixture({ token: '', file: JSON.stringify(value) }).gh.sync());
  }
  assert.throws(() => parseLearningGateText('x'.repeat(64001), gateId, 'sha'), /过大/);
});

test('public sync retains tree-SHA blobs, reuses unchanged files, refreshes changed files and removes deletions', async () => {
  const stored = JSON.stringify(fileContent());
  const first = fixture({ token: '', file: stored });
  const synced = await first.gh.sync();
  const blobCalls = h => h.calls.filter(call => call.pathname.includes('/git/blobs/'));
  assert.equal(blobCalls(first).length, 1);
  assert.deepEqual(synced.blobs, { 'old-sha': stored });
  assert.ok(first.calls.every(call => !call.pathname.includes('/contents/')), 'sync reads the immutable tree blob rather than the current branch contents');

  const unchanged = fixture({ token: '', file: stored });
  const reused = await unchanged.gh.sync(synced);
  assert.equal(blobCalls(unchanged).length, 0, 'unchanged public content adds no blob requests');
  assert.deepEqual(reused.learningGateContents, synced.learningGateContents);
  assert.deepEqual(reused.blobs, synced.blobs);

  const updatedText = JSON.stringify(fileContent({ description: '已经更新的公开关卡说明' }));
  const changed = fixture({ token: '', file: updatedText, sha: 'changed-sha' });
  const updated = await changed.gh.sync(synced);
  assert.equal(blobCalls(changed).length, 1);
  assert.equal(updated.learningGateContents[0].sha, 'changed-sha');
  assert.equal(updated.learningGateContents[0].description, '已经更新的公开关卡说明');
  assert.deepEqual(updated.blobs, { 'changed-sha': updatedText }, 'superseded gate blobs are discarded');
  assert.deepEqual(synced.blobs, { 'old-sha': stored }, 'previous cache remains unchanged');

  const deleted = await fixture({ token: '' }).gh.sync(updated);
  assert.deepEqual(deleted.learningGateContents, []);
  assert.deepEqual(deleted.blobs, {}, 'deleted gate blobs are discarded');
});

test('public blob reuse revalidates cached JSON, identity, field bounds and unsafe links without publishing bad cache', async () => {
  for (const cached of [
    {}, 'not json', 'x'.repeat(64001),
    JSON.stringify(fileContent({ gateId: 'missing' })),
    JSON.stringify(fileContent({ goals: [] })),
    JSON.stringify(fileContent({ practiceList: { title: 'bad', url: 'javascript:alert(1)' } })),
  ]) {
    const previous = { blobs: { 'old-sha': cached } }, before = structuredClone(previous);
    const h = fixture({ token: '', file: JSON.stringify(fileContent()) });
    await assert.rejects(h.gh.sync(previous));
    assert.deepEqual(previous, before);
    assert.ok(h.calls.every(call => !call.pathname.includes('/git/blobs/')), 'malicious cache is rejected rather than silently replaced');
  }
});

test('failed public blob fetch leaves the prior cache available and unchanged', async () => {
  const previous = { blobs: { 'old-sha': JSON.stringify(fileContent()) }, learningGateContents: [cachedContent()] };
  const before = structuredClone(previous);
  const h = fixture({ token: '', file: JSON.stringify(fileContent({ description: '待下载的新公共版本' })), sha: 'changed-sha', failBlob: 503 });
  await assert.rejects(h.gh.sync(previous), /GitHub 503/);
  assert.deepEqual(previous, before);
});

test('custom public source never receives credentials and cannot write', async () => {
  const h = fixture({ serverUrl: 'https://git.example.com', file: JSON.stringify(fileContent()) });
  const synced = await h.gh.sync(); assert.equal(synced.learningGateContents[0].serverUrl, 'https://git.example.com');
  assert.ok(h.calls.every(call => !call.opts.headers.Authorization));
  await assert.rejects(h.gh.saveLearningGate(input()), /登录/); assert.equal(h.writes.length, 0);
});

function mainHarness(options) {
  const source = fs.readFileSync(path.join(__dirname, 'main.test.cjs'), 'utf8').split('// END_MAIN_HARNESS')[0];
  return new Function('require', '__dirname', 'Buffer', source + '\nreturn harness;')(require, __dirname, Buffer)(options);
}
const cachedContent = () => ({ ...fileContent(), schema: undefined, sha: 'new-sha', repo: 'team/notebook', serverUrl: '', sourceKey: 'https://api.github.com|team/notebook' });
test('real main caches committed saves, persists bootstrap, clears deletions and isolates repositories', async () => {
  const content = cachedContent(); let fail = false, entries = [content];
  const h = mainHarness({ backend: { saveLearningGate: async () => { if (fail) throw new Error('SHA conflict'); return content; }, sync: async () => ({ records: [], issues: [], learningGateContents: entries }) } });
  assert.deepEqual((await h.invoke('bootstrap')).learningGateContents, []);
  assert.equal((await h.invoke('saveLearningGate', input())).sha, 'new-sha');
  assert.equal((await h.invoke('bootstrap')).learningGateContents.length, 1);
  const before = h.writes.length; fail = true; await assert.rejects(h.invoke('saveLearningGate', input()), /SHA conflict/); assert.equal(h.writes.length, before);
  assert.equal((await h.invoke('sync')).learningGateContents.length, 1); entries = []; assert.deepEqual((await h.invoke('sync')).learningGateContents, []);
  fail = false; await h.invoke('saveLearningGate', input()); await h.invoke('saveSettings', { repo: 'other/repo' }); assert.deepEqual((await h.invoke('bootstrap')).learningGateContents, []);
  await h.invoke('saveSettings', { repo: 'team/notebook' }); assert.equal((await h.invoke('bootstrap')).learningGateContents.length, 1);
  const offline = mainHarness({ account: null, files: { 'cache.json': h.stored('cache.json') } }); assert.equal((await offline.invoke('bootstrap')).learningGateContents.length, 1); assert.equal(offline.calls.length, 0);
  await assert.rejects(h.handlers.get('saveLearningGate')({ sender: {} }, input()), /非法调用/);
});

test('invalid cached contents or foreign source notes do not enter bootstrap', async () => {
  for (const bad of [{ ...cachedContent(), goals: [] }, { ...cachedContent(), sourceKey: 'https://evil.example|team/notebook' }, { ...cachedContent(), practiceList: { title: 'bad', url: 'javascript:alert(1)' } }]) {
    const h = mainHarness({ files: { 'cache.json': { repo: 'team/notebook', learningGateContents: [bad] } } }); assert.deepEqual((await h.invoke('bootstrap')).learningGateContents, []);
  }
});

test('write lock and account generation guard reject concurrent changes or stale cache publication', async () => {
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const h = mainHarness({ backend: { saveLearningGate: async () => { await waiting; return cachedContent(); } } });
  const pending = h.invoke('saveLearningGate', input()); await Promise.resolve();
  await assert.rejects(h.invoke('saveSettings', { repo: 'other/repo' }), /等待/); await assert.rejects(h.invoke('logout'), /等待/);
  await assert.rejects(h.invoke('saveLearningGate', input()), /操作/);
  await h.invoke('cancelLogin'); release(); await assert.rejects(pending, /配置已改变/);
  assert.equal(h.stored('cache.json'), null);
});
