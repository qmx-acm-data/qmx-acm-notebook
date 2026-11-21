'use strict';
const { appPath } = require('./app-path.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { GitHub, algorithmNodeContentPath, canonicalAlgorithmLeafId, ALGORITHM_NODE_CONTENT_PREFIX } = require(appPath('electron/github.cjs'));
const { builtinIndex, TOPICS_PATH } = require(appPath('electron/algorithm-topics.cjs'));
const tree = require(appPath('ui/algorithm-tree.js'));
const index = builtinIndex(tree);
const nodeId = [...index.values()].find(node => node.kind === 'algorithm' && !node.children.length).id;
const otherId = [...index.values()].find(node => node.kind === 'algorithm' && !node.children.length && node.id !== nodeId).id;
const directoryId = [...index.values()].find(node => node.kind === 'directory' && node.children.length && !index.has(`algorithm-content-${node.id}`)).id;
const UUID = '55c710aa-e083-4b14-94fe-a3a825d17f70';
const publicPath = `algorithms/notes/public/${UUID}.md`, ownPath = `algorithms/notes/personal/42/${UUID}.md`, otherPath = `algorithms/notes/personal/99/${UUID}.md`;
const input = (extra = {}) => ({ repo: 'team/notebook', nodeId, introduction: '# 算法介绍\n\n$O(n)$', featuredNotePaths: [], sha: null, ...extra });
const payload = (extra = {}) => ({ schema: 1, nodeId, introduction: '', featuredNotePaths: [], updatedAt: '2026-11-20T00:00:00Z', author: { id: 42, login: 'alice' }, ...extra });
const noteText = (extra = {}) => { const YAML = require('yaml'); return `---\n${YAML.stringify({ schema: 3, note_scope: 'public', node_id: nodeId, author_id: 42, author: 'alice', title: 'PRIVATE TEST TITLE', client_id: UUID, featured: true, ...extra })}---\nPRIVATE TEST BODY`; };
function fixture({ admin = true, token = 'TEST_TOKEN', files = {}, failPut = 0, noSha = false, permissions } = {}) {
  const data = new Map(Object.entries(files).map(([name, text]) => [name, { text, sha: require('node:crypto').createHash('sha256').update(name).digest('hex') }]));
  const calls = [], writes = [];
  const fetcher = async (url, options = {}) => {
    const u = new URL(url), pathname = decodeURIComponent(u.pathname); calls.push({ pathname, options });
    const reply = (body, status = 200) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body });
    if (pathname === '/user') return reply({ id: 42, login: 'alice' });
    if (pathname === '/repos/team/notebook') return reply({ default_branch: 'main', permissions: permissions ? permissions() : { push: true, admin } });
    if (pathname.startsWith('/repos/team/notebook/contents/')) {
      const name = pathname.slice('/repos/team/notebook/contents/'.length), file = data.get(name);
      if (options.method === 'PUT') { const body = JSON.parse(options.body); writes.push({ name, ...body }); if (failPut) return reply({}, failPut); const sha = writes.length === 1 ? 'new-sha' : `new-sha-${writes.length}`; data.set(name, { text: Buffer.from(body.content, 'base64').toString('utf8'), sha }); return reply(noSha ? {} : { content: { sha } }); }
      return file ? reply({ type: 'file', encoding: 'base64', sha: file.sha, content: Buffer.from(file.text).toString('base64') }) : reply({}, 404);
    }
    if (pathname === '/repos/team/notebook/git/trees/main') return reply({ tree: [...data].map(([name, file]) => ({ type: 'blob', path: name, sha: file.sha })) });
    if (pathname.startsWith('/repos/team/notebook/git/blobs/')) { const file = [...data.values()].find(item => item.sha === pathname.split('/').at(-1)); assert.ok(file); return reply({ encoding: 'base64', content: Buffer.from(file.text).toString('base64') }); }
    if (pathname === '/repos/team/notebook/issues') return reply([]);
    throw Error(`Unexpected ${pathname}`);
  };
  return { gh: new GitHub({ repo: 'team/notebook', token, fetcher }), data, calls, writes };
}

test('fresh admin writes deterministic safe schema-one paths, Markdown and multiple exact references', async () => {
  const h = fixture({ files: { [publicPath]: noteText(), [ownPath]: noteText({ note_scope: 'personal' }) } });
  const result = await h.gh.saveAlgorithmNodeContent(input({ featuredNotePaths: [publicPath, ownPath] }));
  assert.match(algorithmNodeContentPath('动态规划/../%'), /^algorithms\/node-content\/[a-f0-9]{64}\.json$/);
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].name, algorithmNodeContentPath(nodeId)); assert.equal(result.sha, 'new-sha');
  const committed = JSON.parse(h.data.get(algorithmNodeContentPath(nodeId)).text);
  assert.equal(committed.schema, 1); assert.deepEqual(committed.featuredNotePaths, [publicPath, ownPath]);
  assert.ok(!JSON.stringify(committed).includes('PRIVATE TEST')); assert.equal(committed.repo, undefined); assert.equal(committed.sha, undefined);
  assert.deepEqual(result.author, { id: 42, login: 'alice' });
  assert.equal((await fixture().gh.saveAlgorithmNodeContent(input({ introduction: '' }))).introduction, '');
});

test('admin curation rejects private foreign ownership, missing notes, cross-node membership and unsafe paths', async () => {
  const cases = [
    { featuredNotePaths: [otherPath], files: { [otherPath]: noteText({ note_scope: 'personal', author_id: 99 }) } },
    { featuredNotePaths: [ownPath], files: { [ownPath]: noteText({ note_scope: 'personal', author_id: 99 }) } },
    { featuredNotePaths: [publicPath], files: {} },
    { featuredNotePaths: [publicPath], files: { [publicPath]: noteText({ node_id: otherId }) } },
    { featuredNotePaths: [publicPath], files: { [publicPath]: noteText({ note_scope: 'personal' }) } },
  ];
  for (const value of cases) { const h = fixture({ files: value.files }); await assert.rejects(h.gh.saveAlgorithmNodeContent(input({ featuredNotePaths: value.featuredNotePaths }))); assert.equal(h.writes.length, 0); }
  for (const paths of [[publicPath, publicPath], ['algorithms/notes/public/../bad.md'], ['problems/qmx/42/a.md'], Array(101).fill(publicPath)]) { const h = fixture(); await assert.rejects(h.gh.saveAlgorithmNodeContent(input({ featuredNotePaths: paths }))); assert.equal(h.writes.length, 0); }
});

test('strict fresh admin, byte limits, explicit SHA and source checks fail before writes', async () => {
  for (const admin of [false, 1, 'true']) { const h = fixture({ admin }); await assert.rejects(h.gh.saveAlgorithmNodeContent(input({ admin: true })), /管理员/); assert.equal(h.writes.length, 0); }
  let checks = 0; const revoked = fixture({ permissions: () => ({ push: true, admin: ++checks === 1 }) }); await assert.rejects(revoked.gh.saveAlgorithmNodeContent(input()), /管理员/);
  for (const extra of [{ sha: undefined }, { sha: '' }, { repo: 'other/repo' }, { introduction: '汉'.repeat(33334) }, { nodeId: directoryId }, { nodeId: 'missing' }]) { const h = fixture(); await assert.rejects(h.gh.saveAlgorithmNodeContent(input(extra))); assert.equal(h.writes.length, 0); }
  const name = algorithmNodeContentPath(nodeId), text = JSON.stringify(payload());
  const stale = fixture({ files: { [name]: text } }); await assert.rejects(stale.gh.saveAlgorithmNodeContent(input()), /SHA冲突/); assert.equal(stale.writes.length, 0);
  const edit = fixture({ files: { [name]: text } }); const sha = edit.data.get(name).sha;
  await edit.gh.saveAlgorithmNodeContent(input({ sha })); assert.equal(edit.writes[0].sha, sha);
  for (const status of [409, 422]) { const h = fixture({ failPut: status }); await assert.rejects(h.gh.saveAlgorithmNodeContent(input()), /冲突/); }
  await assert.rejects(fixture({ noSha: true }).gh.saveAlgorithmNodeContent(input()), /结果未知/);
});

test('sync reads immutable metadata blobs, revalidates caches and treats deleted identities as absence', async () => {
  const name = algorithmNodeContentPath(nodeId), text = JSON.stringify(payload());
  const first = fixture({ token: '', files: { [name]: text } }); const snapshot = await first.gh.sync();
  assert.equal(snapshot.algorithmNodeContents.length, 1); assert.equal(snapshot.algorithmNodeContents[0].nodeId, nodeId);
  assert.ok(first.calls.every(call => !call.pathname.includes('/contents/')));
  const unchanged = fixture({ token: '', files: { [name]: text } }); await unchanged.gh.sync(snapshot); assert.ok(unchanged.calls.every(call => !call.pathname.includes('/git/blobs/')));
  assert.deepEqual((await fixture({ token: '' }).gh.sync(snapshot)).algorithmNodeContents, []);
  const missing = fixture({ token: '', files: { [algorithmNodeContentPath('deleted-node')]: JSON.stringify(payload({ nodeId: 'deleted-node' })) } }); assert.deepEqual((await missing.gh.sync()).algorithmNodeContents, []);
  const forged = fixture({ token: '', files: { [`${ALGORITHM_NODE_CONTENT_PREFIX}${'f'.repeat(64)}.json`]: text } }); await assert.rejects(forged.gh.sync(), /文件名/);
  const previous = structuredClone(snapshot); previous.blobs[Object.keys(previous.blobs)[0]] = JSON.stringify(payload({ introduction: 123 })); const before = structuredClone(previous);
  await assert.rejects(unchanged.gh.sync(previous)); assert.deepEqual(previous, before);
});

const splitParent = 'custom-3d12970c-1ea6-4da8-809c-a8f85b2db247', splitChild = 'custom-cc720a4b-31e5-4a89-a438-ea74ab9886c4';
const topics = [splitParent, splitChild].map((id, i) => ({ id, parentId: i ? splitParent : directoryId, label: `测试${i}`, fullLabel: `测试${i}`, kind: 'algorithm', color: 'basic', scope: '', createdAt: '2026-11-20T00:00:00Z', createdBy: { id: 42, login: 'alice' } }));
const additions = JSON.stringify({ schema: 1, topics });
test('note and curation saves reject directories and canonicalize split parent targets; historic notes remap without moving files', async () => {
  const h = fixture({ files: { [TOPICS_PATH]: additions, [publicPath]: noteText({ node_id: splitParent }) } });
  const result = await h.gh.saveAlgorithmNote({ repo: 'team/notebook', nodeId: splitParent, noteScope: 'public', clientId: 'a1d16a2e-502f-4a76-9f60-c5a6dca6b210', body: 'body', featured: true });
  assert.equal(result.nodeId, `algorithm-content-${splitParent}`); assert.equal(h.writes.length, 1); assert.ok(h.calls.every(call => !call.pathname.includes('/git/trees/')), 'no global featured clearing');
  const curated = await h.gh.saveAlgorithmNodeContent(input({ nodeId: splitParent, featuredNotePaths: [publicPath] })); assert.equal(curated.nodeId, result.nodeId);
  const synced = await h.gh.sync(); assert.equal(synced.algorithmNotes.find(note => note.path === publicPath).nodeId, result.nodeId); assert.ok(h.data.has(publicPath));
  const bad = fixture(); await assert.rejects(bad.gh.saveAlgorithmNote({ nodeId: directoryId, clientId: UUID, body: 'body' }), /叶节点|目录/); assert.equal(bad.writes.length, 0);
  assert.equal(canonicalAlgorithmLeafId(directoryId), null);
});

test('metadata survives algorithm splitting, edits its original file and preserves storage identity across bootstrap restarts', async () => {
  const originalPath = algorithmNodeContentPath(splitParent), canonicalId = `algorithm-content-${splitParent}`;
  const h = fixture({ files: { [TOPICS_PATH]: additions, [originalPath]: JSON.stringify(payload({ nodeId: splitParent, introduction: 'original intro' })) } });
  const snapshot = await h.gh.sync(), content = snapshot.algorithmNodeContents[0];
  assert.equal(content.nodeId, canonicalId); assert.equal(content.storageNodeId, splitParent); assert.equal(content.introduction, 'original intro');
  const saved = await h.gh.saveAlgorithmNodeContent(input({ nodeId: content.nodeId, storageNodeId: content.storageNodeId, sha: content.sha, introduction: 'edited intro' }));
  assert.equal(saved.nodeId, canonicalId); assert.equal(saved.storageNodeId, splitParent); assert.equal(h.writes[0].name, originalPath); assert.equal(h.writes[0].sha, content.sha);
  assert.equal(JSON.parse(h.data.get(originalPath).text).nodeId, splitParent); assert.ok(!h.data.has(algorithmNodeContentPath(canonicalId)), 'editing retains one original metadata file');
  assert.equal((await h.gh.sync()).algorithmNodeContents[0].introduction, 'edited intro');
  for (const extra of [{ storageNodeId: otherId, sha: saved.sha }, { storageNodeId: splitParent, sha: null }, { storageNodeId: splitParent, sha: content.sha }]) await assert.rejects(h.gh.saveAlgorithmNodeContent(input({ nodeId: canonicalId, ...extra })), /存储|SHA冲突/);
  const scope = { repo: 'team/notebook', serverUrl: '', sourceKey: 'https://api.github.com|team/notebook' };
  for (const cached of [{ ...payload({ nodeId: splitParent }), sha: 'old-sha', ...scope }, saved]) {
    const disk = { repo: scope.repo, algorithmTopics: topics, algorithmNodeContents: [cached] };
    const first = mainHarness({ account: null, files: { 'cache.json': disk } });
    const boot = (await first.invoke('bootstrap')).algorithmNodeContents[0]; assert.equal(boot.nodeId, canonicalId); assert.equal(boot.storageNodeId, splitParent);
    const restarted = mainHarness({ account: null, files: { 'cache.json': { ...disk, algorithmNodeContents: [boot] } } });
    assert.deepEqual((await restarted.invoke('bootstrap')).algorithmNodeContents[0], boot);
  }
});

test('roadmap introductions have independent approved identities, empty curation and no note permissions', async () => {
  const h = fixture();
  for (const id of ['roadmap:xh', 'roadmap:sz', 'roadmap:offline']) await h.gh.saveAlgorithmNodeContent(input({ nodeId: id, introduction: `intro ${id}` }));
  assert.equal(h.writes.length, 3); assert.equal(new Set(h.writes.map(write => write.name)).size, 3);
  const synced = await h.gh.sync(); assert.deepEqual(synced.algorithmNodeContents.map(content => [content.nodeId, content.introduction]).sort(), ['roadmap:xh', 'roadmap:sz', 'roadmap:offline'].map(id => [id, `intro ${id}`]).sort());
  const old = synced.algorithmNodeContents.find(content => content.nodeId === 'roadmap:xh');
  await h.gh.saveAlgorithmNodeContent(input({ nodeId: old.nodeId, sha: old.sha, introduction: 'only loop changes' }));
  assert.equal((await h.gh.sync()).algorithmNodeContents.find(content => content.nodeId === 'roadmap:sz').introduction, 'intro roadmap:sz');
  for (const fields of [{ nodeId: 'roadmap:unknown' }, { nodeId: 'roadmap:xh', featuredNotePaths: [publicPath] }, { nodeId: 'roadmap:xh', storageNodeId: 'roadmap:sz' }]) await assert.rejects(h.gh.saveAlgorithmNodeContent(input(fields)));
  assert.equal(canonicalAlgorithmLeafId('roadmap:xh'), null);
  await assert.rejects(h.gh.saveAlgorithmNote({ nodeId: 'roadmap:xh', clientId: UUID, body: 'forbidden' }), /叶节点|目录/);
  const main = mainHarness({ account: null, files: { 'cache.json': { repo: 'team/notebook', algorithmNodeContents: synced.algorithmNodeContents } } });
  assert.equal((await main.invoke('bootstrap')).algorithmNodeContents.length, 3);
});

test('ordinary owner edits retain featured fallback and cannot spoof public/personal ownership', async () => {
  const h = fixture({ admin: false, files: { [ownPath]: noteText({ note_scope: 'personal' }) } });
  const result = await h.gh.saveAlgorithmNote({ nodeId, noteScope: 'personal', clientId: UUID, body: 'new body', path: ownPath, sha: h.data.get(ownPath).sha, featured: false }); assert.equal(result.featured, true);
  const collision = fixture({ files: { [ownPath]: noteText({ note_scope: 'personal', author_id: 99 }) } }); await assert.rejects(collision.gh.saveAlgorithmNote({ nodeId, clientId: UUID, body: 'spoof' }), /自己|归属/); assert.equal(collision.writes.length, 0);
  const foreign = fixture({ files: { [otherPath]: noteText({ note_scope: 'personal', author_id: 99 }) } }); await assert.rejects(foreign.gh.saveAlgorithmNote({ nodeId, noteScope: 'public', clientId: UUID, body: 'spoof', path: otherPath, sha: foreign.data.get(otherPath).sha }), /归属/); assert.equal(foreign.writes.length, 0);
});

function mainHarness(options) { const source = fs.readFileSync(path.join(__dirname, 'main.test.cjs'), 'utf8').split('// END_MAIN_HARNESS')[0]; return new Function('require', '__dirname', 'Buffer', source + '\nreturn harness;')(require, __dirname, Buffer)(options); }
const scopedContent = () => ({ ...payload(), schema: undefined, sha: 'new-sha', repo: 'team/notebook', serverUrl: '', sourceKey: 'https://api.github.com|team/notebook' });
test('main caches committed metadata, isolates sources, rejects invalid cache and preserves sender/generation/locks', async () => {
  const content = scopedContent(); let fail = false, entries = [content];
  const h = mainHarness({ backend: { saveAlgorithmNodeContent: async () => { if (fail) throw Error('conflict'); return content; }, sync: async () => ({ records: [], issues: [], algorithmNodeContents: entries }) } });
  assert.deepEqual((await h.invoke('bootstrap')).algorithmNodeContents, []); await h.invoke('saveAlgorithmNodeContent', input()); assert.equal((await h.invoke('bootstrap')).algorithmNodeContents.length, 1);
  const count = h.writes.length; fail = true; await assert.rejects(h.invoke('saveAlgorithmNodeContent', input()), /conflict/); assert.equal(h.writes.length, count);
  entries = []; assert.deepEqual((await h.invoke('sync')).algorithmNodeContents, []);
  fail = false; await h.invoke('saveAlgorithmNodeContent', input()); await h.invoke('saveSettings', { repo: 'other/repo' }); assert.deepEqual((await h.invoke('bootstrap')).algorithmNodeContents, []);
  const offline = mainHarness({ account: null, files: { 'cache.json': { repo: 'team/notebook', algorithmNodeContents: [content, { ...content, nodeId: directoryId }, { ...content, sourceKey: 'evil' }] } } }); assert.equal((await offline.invoke('bootstrap')).algorithmNodeContents.length, 1); assert.equal(offline.calls.length, 0);
  await assert.rejects(h.handlers.get('saveAlgorithmNodeContent')({ sender: {} }, input()), /非法调用/);
  let release; const waiting = new Promise(resolve => { release = resolve; }); const locked = mainHarness({ backend: { saveAlgorithmNodeContent: async () => { await waiting; return content; } } });
  const pending = locked.invoke('saveAlgorithmNodeContent', input()); await Promise.resolve(); await assert.rejects(locked.invoke('saveSettings', { repo: 'other/repo' }), /等待/); await assert.rejects(locked.invoke('saveAlgorithmNodeContent', input()), /操作/); await locked.invoke('cancelLogin'); release(); await assert.rejects(pending, /配置已改变/); assert.equal(locked.stored('cache.json'), null);
});
