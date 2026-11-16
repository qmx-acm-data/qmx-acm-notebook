'use strict';
const { appPath } = require('./app-path.cjs');
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { GitHub, LEARNING_CURRICULUM_PATH: manifestPath, LEARNING_GATES_PREFIX, parseLearningCurriculumText, validateLearningCurriculumLayout } = require(appPath('electron/github.cjs'));
const base = require(appPath('ui/algorithm-learning-path-data.js'));
const repo = 'team/notebook', sourceKey = 'https://api.github.com|team/notebook';
const customId = 'custom-55c710aa-e083-4b14-94fe-a3a825d17f70';
const clone = value => structuredClone(value);
const layout = () => ({ stages: base.stages.map(stage => ({ id: stage.id, title: stage.title, gates: stage.gates.map(gate => ({ id: gate.id, title: gate.title, kind: gate.kind, sectionId: gate.sectionId, scope: gate.scope })) })) });
const custom = () => ({ id: customId, title: '新增关卡', kind: 'learning', sectionId: base.stages[1].sections[0].id, scope: 'core', description: '管理员新增学习内容', goals: ['完成一次独立验证'], topicIds: ['root'] });
const edited = () => { const value = layout(); value.stages[1].gates.shift(); value.stages[1].gates.unshift(custom()); value.stages[1].title = '公开新章节名'; return value; };
const document = (value = edited()) => ({ schema: 1, layout: value, updatedAt: '2026-11-16T10:00:00.000Z', author: { id: 42, login: 'alice' } });
function fixture({ files = {}, admin = true, push = true, noSha = false, failPut = 0, token = 'FAKE_TEST_TOKEN', serverUrl = '', permission } = {}) {
  const stored = new Map(Object.entries(files).map(([name, value]) => [name, { sha: value.sha || 'old-sha', text: typeof value === 'string' ? value : value.text }]));
  const calls = [], writes = [];
  const fetcher = async (url, opts = {}) => {
    const pathname = new URL(url).pathname.replace(/^\/api\/v1/, ''); calls.push({ pathname, opts });
    const reply = (data, status = 200) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => data });
    if (pathname === '/user') return reply({ id: 42, login: 'alice', token: 'never-publish' });
    if (pathname === `/repos/${repo}`) return reply({ default_branch: 'main', permissions: permission ? permission() : { admin, push } });
    const prefix = `/repos/${repo}/contents/`;
    if (pathname.startsWith(prefix)) {
      const name = decodeURIComponent(pathname.slice(prefix.length)), current = stored.get(name);
      if (opts.method === 'PUT') {
        const body = JSON.parse(opts.body); writes.push({ name, body });
        if (failPut) return reply({ message: 'conflict' }, failPut);
        assert.equal(body.sha, current?.sha);
        stored.set(name, { sha: 'new-sha', text: Buffer.from(body.content, 'base64').toString('utf8') });
        return reply(noSha ? {} : { content: { sha: 'new-sha' } });
      }
      return current ? reply({ type: 'file', encoding: 'base64', sha: current.sha, content: Buffer.from(current.text).toString('base64') }) : reply({}, 404);
    }
    if (pathname === `/repos/${repo}/git/trees/main`) return reply({ tree: [...stored].map(([name, value]) => ({ type: 'blob', path: name, sha: value.sha })) });
    if (pathname.startsWith(`/repos/${repo}/git/blobs/`)) {
      const sha = pathname.split('/').at(-1), value = [...stored.values()].find(item => item.sha === sha);
      return value ? reply({ encoding: 'base64', content: Buffer.from(value.text).toString('base64') }) : reply({}, 404);
    }
    if (pathname === `/repos/${repo}/issues`) return reply([]);
    throw new Error(`Unexpected request ${pathname}`);
  };
  return { gh: new GitHub({ repo, token, serverUrl, fetcher }), calls, writes, stored };
}
const input = (extra = {}) => ({ repo, layout: edited(), sha: null, ...extra });

test('curriculum commits exact schema with fresh strict admin identity and explicit SHA', async () => {
  const h = fixture(), saved = await h.gh.saveLearningCurriculum(input({ author: { id: 9, login: 'forged' } }));
  assert.deepEqual(saved.author, { id: 42, login: 'alice' }); assert.equal(saved.sourceKey, sourceKey); assert.equal(saved.sha, 'new-sha');
  const payload = JSON.parse(h.stored.get(manifestPath).text);
  assert.deepEqual(Object.keys(payload).sort(), ['author', 'layout', 'schema', 'updatedAt']);
  assert.equal(payload.schema, 1); assert.equal(payload.layout.stages[1].gates[0].id, customId);
  assert.equal(h.calls.filter(call => call.pathname === `/repos/${repo}`).length, 2);
  assert.ok(!JSON.stringify(payload).includes('never-publish')); assert.ok(!JSON.stringify(saved).includes('FAKE_TEST_TOKEN'));
  const existing = { [manifestPath]: { sha: 'old-sha', text: JSON.stringify(document()) } };
  for (const sha of [null, 'stale']) { const stale = fixture({ files: existing }); await assert.rejects(stale.gh.saveLearningCurriculum(input({ sha })), /SHA冲突/); assert.equal(stale.writes.length, 0); }
  const edit = fixture({ files: existing }); await edit.gh.saveLearningCurriculum(input({ sha: 'old-sha' })); assert.equal(edit.writes[0].body.sha, 'old-sha');
  await assert.rejects(fixture().gh.saveLearningCurriculum(input({ sha: 'old-sha' })), /SHA冲突/);
  for (const status of [409, 422]) await assert.rejects(fixture({ failPut: status }).gh.saveLearningCurriculum(input()), /冲突/);
  await assert.rejects(fixture({ noSha: true }).gh.saveLearningCurriculum(input()), /结果未知/);
});

test('push permissions, truthy admin, custom sources and omitted SHA cannot authorize layout saves', async () => {
  for (const options of [{ admin: false }, { admin: 1 }, { admin: 'true' }, { push: false, admin: false }, { token: '' }, { serverUrl: 'https://git.example.com' }]) {
    const h = fixture(options); await assert.rejects(h.gh.saveLearningCurriculum(input())); assert.equal(h.writes.length, 0);
  }
  let n = 0; const revoked = fixture({ permission: () => ({ push: true, admin: ++n === 1 }) });
  await assert.rejects(revoked.gh.saveLearningCurriculum(input()), /管理员/); assert.equal(revoked.writes.length, 0);
  for (const bad of [{ sha: undefined }, { sha: '' }, { repo: 'other/repo' }, { repo: undefined }, { sourceKey: 'https://evil|team/notebook' }]) {
    const h = fixture(); await assert.rejects(h.gh.saveLearningCurriculum(input(bad))); assert.equal(h.writes.length, 0);
  }
});

test('layout rejects stage deletion, foreign ownership, duplicate IDs, content overrides and invalid custom fields', () => {
  const bad = [];
  const mutate = fn => { const value = edited(); fn(value); bad.push(value); };
  mutate(v => v.stages.pop()); mutate(v => v.stages[1].id = 'new-stage'); mutate(v => v.stages[1].id = v.stages[0].id);
  mutate(v => v.stages[1].gates = []); mutate(v => v.stages[1].gates = Array(101).fill(custom()));
  mutate(v => v.stages[1].gates.push(v.stages[1].gates[0]));
  mutate(v => v.stages[1].gates[1].id = v.stages[0].gates[0].id);
  mutate(v => v.stages[1].gates[1].description = 'override');
  mutate(v => v.stages[1].gates[0].id = customId.toUpperCase());
  mutate(v => v.stages[1].gates[0].sectionId = v.stages[0].gates[0].sectionId);
  mutate(v => v.stages[1].gates[0].scope = 'route'); mutate(v => v.stages[1].gates[0].kind = 'unknown');
  mutate(v => v.stages[1].gates[0].title = 'x'.repeat(161)); mutate(v => v.stages[1].gates[0].description = '');
  mutate(v => v.stages[1].gates[0].description = 'x'.repeat(6001)); mutate(v => v.stages[1].gates[0].goals = []);
  mutate(v => v.stages[1].gates[0].goals = Array(21).fill('x')); mutate(v => v.stages[1].gates[0].goals = ['x'.repeat(501)]);
  mutate(v => v.stages[1].gates[0].goals = Array(20).fill('x'.repeat(400)));
  mutate(v => v.stages[1].gates[0].topicIds = ['missing-topic']); mutate(v => v.stages[1].gates[0].topicIds = Array(21).fill('root'));
  for (const value of bad) assert.throws(() => validateLearningCurriculumLayout(value));
  const tooMany = edited(); let count = 0;
  for (const stage of tooMany.stages) stage.gates = Array.from({ length: 70 }, () => ({ ...custom(), id: `custom-${(++count).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`, sectionId: base.stages.find(s => s.id === stage.id).sections[0].id }));
  assert.throws(() => validateLearningCurriculumLayout(tooMany), /1000/);
  assert.throws(() => parseLearningCurriculumText('x'.repeat(1000001), 'sha'), /过大/);
  for (const extra of [{ schema: 2 }, { author: { id: 0, login: 'bad' } }, { updatedAt: 'invalid' }]) assert.throws(() => parseLearningCurriculumText(JSON.stringify({ ...document(), ...extra }), 'sha'));
});

test('topic references accept bundled IDs, legacy aliases and only supplied published custom topics', () => {
  const value = edited(), topicId = 'custom-00000000-0000-4000-8000-000000000001';
  value.stages[1].gates[0].topicIds = [topicId];
  assert.throws(() => validateLearningCurriculumLayout(value), /不存在/);
  const topic = { id: topicId, parentId: 'xcpc-函数-1', label: '测试扩展知识点', fullLabel: '测试扩展知识点', kind: 'algorithm', color: 'basic', scope: '', createdAt: '2026-11-16T10:00:00Z', createdBy: { id: 42, login: 'alice' } };
  assert.equal(validateLearningCurriculumLayout(value, [topic]).stages[1].gates[0].topicIds[0], topicId);
  const contentId = 'algorithm-content-xcpc-函数-1';
  value.stages[1].gates[0].topicIds = [contentId];
  assert.throws(() => validateLearningCurriculumLayout(value), /不存在/);
  assert.equal(validateLearningCurriculumLayout(value, [topic]).stages[1].gates[0].topicIds[0], contentId, 'same hydrated original algorithm content offered by editor is valid');
  value.stages[1].gates[0].topicIds = ['algorithm-content-missing-topic'];
  assert.throws(() => validateLearningCurriculumLayout(value, [topic]), /不存在/);
  const tree = require(appPath('ui/algorithm-tree.js')); let alias;
  (function visit(node) { alias ||= node.legacyIds?.[0]; for (const child of node.children || []) visit(child); })(tree);
  assert.ok(alias); value.stages[1].gates[0].topicIds = [alias]; assert.doesNotThrow(() => validateLearningCurriculumLayout(value));
});

const gateFile = id => JSON.stringify({ schema: 1, gateId: id, description: '公开关卡覆盖说明', goals: ['通过练习检查'], practiceList: null, updatedAt: '2026-11-16T10:00:00.000Z', author: { id: 42, login: 'alice' } });
test('sync reads manifest tree blob first, skips removed overrides and revalidates cached manifest bytes', async () => {
  const deleted = base.stages[1].gates[0].id;
  const files = {
    [manifestPath]: { text: JSON.stringify(document()), sha: 'layout-sha' },
    [`${LEARNING_GATES_PREFIX}${customId}.json`]: { text: gateFile(customId), sha: 'custom-sha' },
    [`${LEARNING_GATES_PREFIX}${deleted}.json`]: { text: 'invalid archived override', sha: 'removed-sha' },
    [`${LEARNING_GATES_PREFIX}custom-00000000-0000-4000-8000-000000000000.json`]: { text: 'invalid removed custom override', sha: 'removed-custom-sha' }
  };
  const h = fixture({ files, token: '' }), synced = await h.gh.sync();
  assert.equal(synced.learningCurriculum.sha, 'layout-sha'); assert.deepEqual(synced.learningGateContents.map(g => g.gateId), [customId]);
  const blobs = h.calls.filter(c => c.pathname.includes('/git/blobs/')).map(c => c.pathname.split('/').at(-1));
  assert.deepEqual(blobs, ['layout-sha', 'custom-sha']); assert.deepEqual(Object.keys(synced.blobs).sort(), ['custom-sha', 'layout-sha']);
  assert.ok(h.calls.every(c => !c.pathname.includes('/contents/') && !c.opts.headers.Authorization));
  const reused = fixture({ files, token: '' }); assert.deepEqual((await reused.gh.sync(synced)).learningCurriculum, synced.learningCurriculum);
  assert.equal(reused.calls.filter(c => c.pathname.includes('/git/blobs/')).length, 0);
  for (const bad of ['bad-json', {}, JSON.stringify(document({ stages: [] }))]) {
    const previous = { blobs: { ...synced.blobs, 'layout-sha': bad } }, before = clone(previous);
    await assert.rejects(fixture({ files, token: '' }).gh.sync(previous)); assert.deepEqual(previous, before);
  }
  const removed = await fixture({ token: '' }).gh.sync(synced); assert.equal(removed.learningCurriculum, null); assert.deepEqual(removed.blobs, {});
});

test('custom content writes require published membership and deleted builtins reject saves', async () => {
  const save = gateId => ({ repo, gateId, description: '独立保存的公开说明', goals: ['完成检查'], practiceList: null, sha: null });
  await assert.rejects(fixture().gh.saveLearningGate(save(customId)), /已发布/);
  const h = fixture({ files: { [manifestPath]: { text: JSON.stringify(document()), sha: 'layout-sha' } } });
  const saved = await h.gh.saveLearningGate(save(customId)); assert.equal(saved.gateId, customId);
  await assert.rejects(h.gh.saveLearningGate(save(base.stages[1].gates[0].id)), /已发布/);
});

function mainHarness(options) {
  const source = fs.readFileSync(path.join(__dirname, 'main.test.cjs'), 'utf8').split('// END_MAIN_HARNESS')[0];
  return new Function('require', '__dirname', 'Buffer', source + '\nreturn harness;')(require, __dirname, Buffer)(options);
}
const cached = () => ({ ...document(), schema: undefined, sha: 'layout-sha', repo, serverUrl: '', sourceKey });
test('main persistence validates source, survives offline restart, isolates repositories and clears removed overrides', async () => {
  const value = cached(); let fail = false;
  const h = mainHarness({ backend: { saveLearningCurriculum: async () => { if (fail) throw new Error('result unknown'); return value; }, sync: async () => ({ records: [], issues: [], learningCurriculum: null }) } });
  assert.equal((await h.invoke('bootstrap')).learningCurriculum, null);
  await h.invoke('saveLearningCurriculum', input()); assert.equal((await h.invoke('bootstrap')).learningCurriculum.sha, 'layout-sha');
  fail = true; const before = h.writes.length; await assert.rejects(h.invoke('saveLearningCurriculum', input()), /unknown/); assert.equal(h.writes.length, before);
  const offline = mainHarness({ account: null, files: { 'cache.json': h.stored('cache.json') } }); assert.equal((await offline.invoke('bootstrap')).learningCurriculum.sha, 'layout-sha'); assert.equal(offline.calls.length, 0);
  await h.invoke('saveSettings', { repo: 'other/repo' }); assert.equal((await h.invoke('bootstrap')).learningCurriculum, null);
  await h.invoke('saveSettings', { repo }); assert.equal((await h.invoke('bootstrap')).learningCurriculum.sha, 'layout-sha');
  await h.invoke('sync'); assert.equal((await h.invoke('bootstrap')).learningCurriculum, null);
  await assert.rejects(h.handlers.get('saveLearningCurriculum')({ sender: {} }, input()), /非法调用/);
  for (const change of [{ sourceKey: 'evil' }, { serverUrl: undefined }, { repo: undefined }, { author: { id: 0, login: 'bad' } }, { layout: { stages: [] } }]) {
    const invalid = mainHarness({ files: { 'cache.json': { repo, learningCurriculum: { ...value, ...change } } } }); assert.equal((await invalid.invoke('bootstrap')).learningCurriculum, null);
  }
});

test('cached custom overrides require an active validated curriculum and removed overrides disappear immediately', async () => {
  const deleted = base.stages[1].gates[0].id;
  const content = id => ({ ...JSON.parse(gateFile(id)), schema: undefined, sha: 'gate-sha', repo, serverUrl: '', sourceKey });
  const withoutCustom = edited(); withoutCustom.stages[1].gates.shift();
  const h = mainHarness({ files: { 'cache.json': { repo, learningCurriculum: cached(), learningGateContents: [content(customId), content(deleted)] } }, backend: { saveLearningCurriculum: async () => ({ ...cached(), layout: withoutCustom }) } });
  assert.deepEqual((await h.invoke('bootstrap')).learningGateContents.map(g => g.gateId), [customId]);
  const offline = mainHarness({ account: null, files: { 'cache.json': h.stored('cache.json') } });
  assert.deepEqual((await offline.invoke('bootstrap')).learningGateContents.map(g => g.gateId), [customId]);
  await h.invoke('saveLearningCurriculum', input({ layout: withoutCustom, sha: 'layout-sha' }));
  assert.deepEqual((await h.invoke('bootstrap')).learningGateContents, []);
  assert.deepEqual(h.stored('cache.json').learningGateContents, []);
  const orphan = mainHarness({ files: { 'cache.json': { repo, learningGateContents: [content(customId)] } } });
  assert.deepEqual((await orphan.invoke('bootstrap')).learningGateContents, []);
});

test('custom Git public sync scopes curriculum without transmitting credentials', async () => {
  const h = fixture({ serverUrl: 'https://git.example.com', files: { [manifestPath]: { text: JSON.stringify(document()), sha: 'layout-sha' } } });
  const synced = await h.gh.sync();
  assert.equal(synced.learningCurriculum.sourceKey, 'https://git.example.com|team/notebook');
  assert.ok(h.calls.every(call => !call.opts.headers.Authorization));
});

test('main curriculum writes preserve write lock, account generation guard and custom-source boundary', async () => {
  let release; const waiting = new Promise(resolve => { release = resolve; });
  const h = mainHarness({ backend: { saveLearningCurriculum: async () => { await waiting; return cached(); } } });
  const pending = h.invoke('saveLearningCurriculum', input()); await Promise.resolve();
  for (const [method, arg] of [['saveSettings', { repo: 'other/repo' }], ['logout'], ['saveLearningGate', {}], ['saveLearningCurriculum', input()]]) await assert.rejects(h.invoke(method, arg), /等待|操作/);
  await h.invoke('cancelLogin'); release(); await assert.rejects(pending, /配置已改变/); assert.equal(h.stored('cache.json'), null);
  const gitea = mainHarness({ files: { 'settings.json': { repo, serverUrl: 'https://git.example.com' } } });
  await assert.rejects(gitea.invoke('saveLearningCurriculum', input()), /匿名读取/); assert.equal(gitea.calls.length, 0);
});
