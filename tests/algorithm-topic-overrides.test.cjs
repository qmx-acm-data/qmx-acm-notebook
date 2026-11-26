'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { appPath } = require('./app-path.cjs');
const { AlgorithmTopics, TOPICS_PATH, OVERRIDES_PATH, builtinIndex, parseOverrides, validateOverrides } = require(appPath('electron/algorithm-topics.cjs'));

const branch = 'main';
const customId = 'custom-11111111-1111-4111-8111-111111111111';
const secondCustomId = 'custom-22222222-2222-4222-8222-222222222222';
const synthetic = id => `algorithm-content-${id}`;
const leaf = (id, label, extra = {}) => ({ id, label, color: 'basic', kind: 'algorithm', ...extra });
const tree = { id: 'root', label: '目录', color: 'parent', kind: 'directory', children: [
  leaf('stable-leaf', '内置算法', { fullLabel: '内置算法全称', legacyIds: ['stable-legacy'], scope: '内置范围' }),
  leaf('mixed', '内置混合节点', { children: [leaf('mixed-child', '内置子算法')] }),
  leaf('sibling', '另一个内置算法'),
] };
const customTopic = (extra = {}) => ({
  id: customId, parentId: 'root', kind: 'algorithm', label: '共享算法', fullLabel: '共享算法全称', color: 'beginner', scope: '',
  createdAt: '2026-01-01T00:00:00Z', createdBy: { id: 1, login: 'maintainer' }, ...extra,
});
const changes = { label: '新算法', fullLabel: '新算法全称', color: 'expert', scope: '新学习范围' };
const overrideRecord = { id: 'stable-leaf', ...changes };
const overrideText = (...overrides) => JSON.stringify({ schema: 1, overrides });
const topicText = (...topics) => JSON.stringify({ schema: 1, topics });
function selection(id, topics = [], overrides = []) {
  const { parentId, label, fullLabel, kind, color, scope } = builtinIndex(tree, topics, overrides).get(id);
  return { id, expected: { parentId, label, fullLabel, kind, color, scope } };
}
function fixture({ topics, overrides, admin = true } = {}) {
  const documents = new Map();
  const calls = [], commits = [];
  const document = text => ({ text, sha: createHash('sha1').update(text).digest('hex') });
  if (topics !== undefined) documents.set(TOPICS_PATH, document(topicText(...topics)));
  if (overrides !== undefined) documents.set(OVERRIDES_PATH, document(overrideText(...overrides)));
  const service = new AlgorithmTopics({
    token: 'fixture-token', repo: 'team/notebook',
    currentDocument: async (path, ref) => {
      assert.equal(ref, branch);
      return documents.get(path) ?? null;
    },
    contentEndpoint: path => path,
    request: async (path, options) => {
      calls.push(path);
      if (path === '/user') return { data: { id: 1, login: 'maintainer' } };
      if (path === '/repos/team/notebook') return { data: { default_branch: branch, permissions: { admin } } };
      assert.equal(options?.method, 'PUT');
      assert.equal(path, TOPICS_PATH, 'built-in changes require a branch-head commit hook');
      const body = JSON.parse(options.body);
      assert.equal(body.sha, documents.get(path)?.sha);
      const stored = document(Buffer.from(body.content, 'base64').toString('utf8'));
      documents.set(path, stored);
      return { data: { content: { sha: stored.sha } } };
    },
  }, { tree, uuid: () => secondCustomId.slice('custom-'.length) });
  function guard(inspect) {
    return async context => {
      assert.equal(context.branch, branch);
      assert.equal(context.topicsSha, documents.get(TOPICS_PATH)?.sha ?? null);
      assert.equal(context.overridesSha, documents.get(OVERRIDES_PATH)?.sha ?? null);
      assert.equal(context.sha, documents.get(context.path)?.sha ?? null);
      await inspect?.(context);
      return async write => {
        assert.equal(write.path, context.path);
        assert.equal(write.branch, branch);
        assert.equal(write.sha, context.sha);
        commits.push(write);
        documents.set(write.path, document(write.text));
      };
    };
  }
  return { service, documents, commits, calls, guard };
}

test('override schema accepts canonical bundled leaves and rejects aliases, branches and injected fields', () => {
  const bundledSynthetic = { ...overrideRecord, id: synthetic('mixed'), color: 'unrated', hidden: true };
  assert.deepEqual(parseOverrides(overrideText(overrideRecord, bundledSynthetic), tree), [overrideRecord, bundledSynthetic]);
  for (const record of [
    { ...overrideRecord, id: 'stable-legacy' }, { ...overrideRecord, id: 'root' }, { ...overrideRecord, id: 'mixed' },
    { ...overrideRecord, id: synthetic('stable-leaf') }, { ...overrideRecord, id: customId }, { ...overrideRecord, id: ['stable-leaf'] },
    { ...overrideRecord, parentId: 'root' }, { ...overrideRecord, kind: 'directory' }, { ...overrideRecord, hidden: false },
    { ...overrideRecord, hidden: 'true' }, { ...overrideRecord, color: 'parent' }, { ...overrideRecord, scope: undefined },
    { ...overrideRecord, scope: 'invalid\nline' }, { ...overrideRecord, label: ' unnormalized ' },
  ]) assert.throws(() => validateOverrides([record], tree));
  assert.throws(() => validateOverrides([overrideRecord, overrideRecord], tree), /重复/);
  assert.throws(() => parseOverrides('{', tree), /JSON/);
  assert.throws(() => parseOverrides(' '.repeat(1000001), tree), /过大/);
  assert.throws(() => parseOverrides(JSON.stringify({ schema: 2, overrides: [] }), tree), /版本/);
  assert.throws(() => parseOverrides(JSON.stringify({ schema: 1, overrides: [], topics: [] }), tree), /格式/);
});

test('built-in edits use fresh snapshots and atomic override writes without changing additions', async () => {
  const original = customTopic();
  const h = fixture({ topics: [original] });
  const originalCatalog = h.documents.get(TOPICS_PATH);
  const input = { ...selection('stable-leaf'), ...changes, label: ' 新算法 ', parentId: 'forged', kind: 'directory' };
  await assert.rejects(h.service.update(input), /仓库提交/);
  assert.equal(h.commits.length, 0);
  const result = await h.service.update(input, h.guard(({ id, path, sha, removedIds }) => {
    assert.equal(id, 'stable-leaf');
    assert.equal(path, OVERRIDES_PATH);
    assert.equal(sha, null);
    assert.equal(removedIds.size, 0);
  }));
  assert.deepEqual(result, { topics: [{ ...original, repo: 'team/notebook' }], overrides: [overrideRecord], override: overrideRecord });
  assert.equal(h.documents.get(TOPICS_PATH), originalCatalog);
  assert.deepEqual(parseOverrides(h.documents.get(OVERRIDES_PATH).text, tree), [overrideRecord]);
  const index = builtinIndex(tree, result.topics, result.overrides);
  assert.equal(index.get('stable-leaf').label, changes.label);
  assert.equal(index.get('stable-legacy'), index.get('stable-leaf'));
  await assert.rejects(h.service.update(input, h.guard()), /先同步/);
  const fresh = { ...selection('stable-leaf', [original], result.overrides), ...changes };
  await assert.rejects(h.service.update({ ...fresh, label: original.label }, h.guard()), /已存在/);
  const sha = h.documents.get(OVERRIDES_PATH).sha;
  const updated = await h.service.update({ ...fresh, color: 'unrated' }, h.guard(context => assert.equal(context.sha, sha)));
  assert.equal(updated.overrides[0].color, 'unrated');
  assert.equal(h.commits.length, 2);
  assert.equal(h.calls.filter(path => path === '/user').length, 5);
  const unauthorized = fixture({ admin: 'true' });
  await assert.rejects(unauthorized.service.update(input, unauthorized.guard()), /管理员/);
  await assert.rejects(unauthorized.service.remove(selection('stable-leaf'), unauthorized.guard()), /管理员/);
});

test('tombstone checks canonical and legacy references and blocks new children', async () => {
  const h = fixture();
  const input = selection('stable-leaf');
  await assert.rejects(h.service.remove(input, h.guard(({ path, sha, removedIds }) => {
    assert.equal(path, OVERRIDES_PATH);
    assert.equal(sha, null);
    assert.deepEqual(removedIds, new Set(['stable-leaf', 'stable-legacy']));
    throw new Error('仍有引用');
  })), /仍有引用/);
  assert.equal(h.documents.has(OVERRIDES_PATH), false);
  const result = await h.service.remove(input, h.guard());
  assert.deepEqual(result, { topics: [], overrides: [{ id: 'stable-leaf', label: '内置算法', fullLabel: '内置算法全称', color: 'basic', scope: '内置范围', hidden: true }] });
  assert.equal(h.documents.has(TOPICS_PATH), false);
  assert.equal(builtinIndex(tree, [], result.overrides).has('stable-legacy'), false);
  await assert.rejects(h.service.remove(input, h.guard()), /先同步/);
  await assert.rejects(h.service.save({ ...changes, parentId: 'stable-leaf' }), /已隐藏/);
  assert.equal(h.commits.length, 1);
});

test('effective built-in content keeps a canonical override across custom splits and collapse', async () => {
  const child = customTopic({ parentId: 'stable-leaf' });
  const h = fixture({ topics: [child] });
  const contentId = synthetic('stable-leaf');
  const updated = await h.service.update({ ...selection(contentId, [child]), ...changes }, h.guard());
  assert.equal(updated.override.id, 'stable-leaf');
  assert.equal(builtinIndex(tree, [child], updated.overrides).get(contentId).label, changes.label);
  await assert.rejects(h.service.remove(selection('stable-leaf', [child], updated.overrides), h.guard()), /子节点/);
  const tombstone = await h.service.remove(selection(contentId, [child], updated.overrides), h.guard(({ removedIds }) => {
    assert.deepEqual(removedIds, new Set(['stable-leaf', 'stable-legacy', contentId]));
  }));
  assert.deepEqual(tombstone.overrides, [{ ...overrideRecord, hidden: true }]);
  const after = builtinIndex(tree, tombstone.topics, tombstone.overrides);
  assert.equal(after.has(contentId), false);
  assert.equal(after.get('stable-leaf').kind, 'directory');
  assert.equal(after.get(customId).parentId, 'stable-leaf');
  const { id, createdAt, createdBy, ...expected } = child;
  const deleted = await h.service.remove({ id, expected }, h.guard());
  assert.equal(builtinIndex(tree, deleted.topics, deleted.overrides).has('stable-leaf'), false);
});

test('bundled synthetic leaves can be removed, including when a custom child split them again', async () => {
  const bundledContent = synthetic('mixed');
  const child = customTopic({ parentId: bundledContent });
  const h = fixture({ topics: [child] });
  const nestedContent = synthetic(bundledContent);
  const result = await h.service.remove(selection(nestedContent, [child]), h.guard());
  assert.deepEqual(result.overrides.map(({ id, hidden }) => [id, hidden]), [[bundledContent, true]]);
  const index = builtinIndex(tree, result.topics, result.overrides);
  assert.equal(index.has(nestedContent), false);
  assert.equal(index.get(bundledContent).kind, 'directory');
  assert.equal(index.get(customId).parentId, bundledContent);
  assert.equal(index.get('mixed-child').kind, 'algorithm');
  await assert.rejects(h.service.remove({ ...selection(customId, [child]), id: synthetic(customId) }, h.guard()), /内置算法叶节点/);
});

const { GitHub, algorithmNodeContentPath, LEARNING_CURRICULUM_PATH } = require(appPath('electron/github.cjs'));
const curriculum = require(appPath('ui/algorithm-learning-path-data.js'));
const builtinId = 'algorithm-快读快写';
const builtinAlias = 'xcpc-读入优化-1';
const repo = 'team/notebook';
const updateTime = '2026-01-01T00:00:00Z';
const author = { id: 1, login: 'maintainer' };

function githubFixture({ files = {}, headConflict = false, mismatchedPath } = {}) {
  const documents = new Map(), mutations = [];
  const base = `/repos/${repo}`;
  const put = (path, text) => documents.set(path, { text, sha: createHash('sha1').update(text).digest('hex') });
  for (const [path, text] of Object.entries(files)) put(path, text);
  const head = 'a'.repeat(40), treeSha = 'b'.repeat(40), nextHead = 'c'.repeat(40);
  const gh = new GitHub({ token: 'fixture-token', repo, fetcher: async (url, options) => {
    const { pathname, searchParams } = new URL(url);
    const response = (data, status = 200) => ({ ok: status === 200, status, headers: new Headers(), json: async () => data });
    const encode = file => ({ type: 'file', encoding: 'base64', sha: file.sha, content: Buffer.from(file.text).toString('base64') });
    if (pathname === '/user') return response(author);
    if (pathname === base) return response({ default_branch: branch, permissions: { admin: true } });
    if (pathname === `${base}/issues`) return response([]);
    if (pathname === `${base}/git/ref/heads/${branch}`) return response({ object: { sha: head } });
    if (pathname === `${base}/git/commits/${head}`) return response({ tree: { sha: treeSha } });
    if ([treeSha, branch].some(ref => pathname === `${base}/git/trees/${ref}`)) {
      assert.equal(searchParams.get('recursive'), '1');
      const tree = [...documents].map(([path, file]) => ({ path, type: 'blob', sha: path === mismatchedPath && pathname.endsWith(treeSha) ? nextHead : file.sha }));
      return response({ tree, truncated: false });
    }
    if (pathname.startsWith(`${base}/contents/`)) {
      assert.equal(options.method, undefined);
      const path = pathname.slice(`${base}/contents/`.length);
      const file = documents.get(path);
      return file ? response(encode(file)) : response({ message: 'Not Found' }, 404);
    }
    if (pathname.startsWith(`${base}/git/blobs/`)) {
      const sha = pathname.split('/').at(-1);
      const file = [...documents.values()].find(file => file.sha === sha);
      assert.ok(file, 'Reads only blobs reported by the fixture');
      return response(encode(file));
    }
    if (pathname === '/graphql') {
      const mutation = JSON.parse(options.body);
      assert.equal(options.method, 'POST');
      assert.match(mutation.query, /createCommitOnBranch/);
      const input = mutation.variables.input;
      assert.equal(input.expectedHeadOid, head);
      assert.deepEqual(input.branch, { repositoryNameWithOwner: repo, branchName: branch });
      mutations.push(input);
      if (headConflict) return response({ errors: [{ message: 'expected commit mismatch' }] });
      for (const { path, contents } of input.fileChanges.additions) put(path, Buffer.from(contents, 'base64').toString('utf8'));
      return response({ data: { createCommitOnBranch: { commit: { oid: nextHead } } } });
    }
    assert.fail(`Unexpected fixture request ${pathname}`);
  } });
  return { gh, documents, mutations };
}

function builtinSelection(overrides = []) {
  const { parentId, label, fullLabel, kind, color, scope } = builtinIndex(undefined, [], overrides).get(builtinId);
  return { id: builtinId, repo, sourceKey: `https://api.github.com|${repo}`, expected: { parentId, label, fullLabel, kind, color, scope } };
}

test('GitHub commits only the overrides path and sync reads edits, tombstones and file removal', async () => {
  const h = githubFixture({ files: { [TOPICS_PATH]: topicText(customTopic()) } });
  const originalCatalog = h.documents.get(TOPICS_PATH);
  const saved = await h.gh.updateAlgorithmTopic({ ...builtinSelection(), ...changes });
  assert.deepEqual(saved.overrides, [{ id: builtinId, ...changes }]);
  const edited = await h.gh.sync();
  assert.deepEqual(edited.algorithmOverrides, saved.overrides);
  assert.equal(edited.algorithmTopics[0].id, customId);
  assert.equal(edited.blobs[h.documents.get(OVERRIDES_PATH).sha], h.documents.get(OVERRIDES_PATH).text);
  const removed = await h.gh.deleteAlgorithmTopic(builtinSelection(saved.overrides));
  assert.deepEqual(removed.overrides, [{ id: builtinId, ...changes, hidden: true }]);
  const synced = await h.gh.sync(edited);
  assert.deepEqual(synced.algorithmOverrides, removed.overrides);
  assert.equal(builtinIndex(undefined, synced.algorithmTopics, synced.algorithmOverrides).has(builtinAlias), false);
  assert.equal(h.mutations.length, 2);
  assert.ok(h.mutations.every(input => input.fileChanges.additions.length === 1 && input.fileChanges.additions[0].path === OVERRIDES_PATH));
  assert.equal(h.documents.get(TOPICS_PATH), originalCatalog);
  h.documents.delete(OVERRIDES_PATH);
  assert.deepEqual((await h.gh.sync(synced)).algorithmOverrides, []);

  const empty = githubFixture();
  const first = await empty.gh.deleteAlgorithmTopic(builtinSelection());
  assert.equal(first.overrides[0].hidden, true);
  assert.equal(empty.mutations[0].fileChanges.additions[0].path, OVERRIDES_PATH);
  assert.equal(empty.documents.has(TOPICS_PATH), false);
});

test('GitHub refuses built-in deletion when persisted references or branch head changed', async () => {
  const stages = curriculum.stages.map(stage => ({ id: stage.id, title: stage.title,
    gates: stage.gates.map(({ id, title, kind, sectionId, scope }) => ({ id, title, kind, sectionId, scope })) }));
  stages[0].gates.push({ id: secondCustomId, title: '附加关卡', kind: 'learning', sectionId: curriculum.stages[0].sections[0].id,
    scope: 'core', description: '关联内置算法', goals: ['学习内置算法'], topicIds: [builtinAlias] });
  const markdown = meta => `---\n${JSON.stringify(meta)}\n---\nExample.`;
  const cases = [
    ['algorithms/notes/personal/99/note.md', markdown({ node_id: builtinAlias }), /仍有算法笔记/],
    [algorithmNodeContentPath(builtinId), JSON.stringify({ schema: 1, nodeId: builtinId, introduction: '简介', featuredNotePaths: [], author, updatedAt: updateTime }), /简介或精选/],
    [LEARNING_CURRICULUM_PATH, JSON.stringify({ schema: 1, layout: { stages }, author, updatedAt: updateTime }), /学习课程引用/],
    [`tricks/${secondCustomId.slice('custom-'.length)}.md`, markdown({ recommendation: { prerequisiteIds: [builtinId] } }), /前置算法/],
  ];
  for (const [path, text, error] of cases) {
    const h = githubFixture({ files: { [path]: text } });
    await assert.rejects(h.gh.deleteAlgorithmTopic(builtinSelection()), error);
    assert.equal(h.mutations.length, 0);
  }
  const stale = githubFixture({ files: { [OVERRIDES_PATH]: overrideText() }, mismatchedPath: OVERRIDES_PATH });
  await assert.rejects(stale.gh.deleteAlgorithmTopic(builtinSelection()), /已更新/);
  assert.equal(stale.mutations.length, 0);
  const raced = githubFixture({ headConflict: true });
  await assert.rejects(raced.gh.deleteAlgorithmTopic(builtinSelection()), /已更新/);
  assert.equal(raced.mutations.length, 1);
  assert.equal(raced.documents.has(OVERRIDES_PATH), false);
});
