'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { appPath } = require('./app-path.cjs');
const { GitHub, algorithmNodeContentPath, LEARNING_CURRICULUM_PATH } = require(appPath('electron/github.cjs'));
const curriculum = require(appPath('ui/algorithm-learning-path-data.js'));
const { TOPICS_PATH, OVERRIDES_PATH } = require(appPath('electron/algorithm-topics.cjs'));

const repo = 'team/notebook';
const branch = 'main';
const head = 'a'.repeat(40);
const treeSha = 'b'.repeat(40);
const topic = { id: 'custom-11111111-1111-4111-8111-111111111111', parentId: 'root', kind: 'algorithm', label: '仓库算法', fullLabel: '仓库算法', color: 'basic', scope: '', createdBy: { id: 1, login: 'admin' }, createdAt: '2026-01-01T00:00:00Z' };
const { id, createdBy, createdAt, ...expected } = topic;
const input = { repo, sourceKey: `https://api.github.com|${repo}`, id, expected };
const markdown = meta => `---\n${JSON.stringify(meta)}\n---\nExample.`;

function fixture({ files = {}, failHead = false, changedCatalog = false, truncated = false } = {}) {
  const catalog = JSON.stringify({ schema: 1, topics: [topic] });
  const documents = Object.entries({ [TOPICS_PATH]: catalog, ...files }).map(([path, text]) => ({ path, text, sha: createHash('sha1').update(text).digest('hex') }));
  const mutations = [];
  const gh = new GitHub({ token: 'fixture-token', repo, fetcher: async (url, options) => {
    const { pathname, searchParams } = new URL(url);
    const base = `/repos/${repo}`;
    const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data, headers: new Headers() });
    if (pathname === `${base}/contents/${OVERRIDES_PATH}`) return response({}, 404);
    if (pathname === '/user') return response({ id: 1, login: 'admin' });
    if (pathname === base) return response({ default_branch: branch, permissions: { admin: true, push: true } });
    if (pathname === `${base}/git/ref/heads/${branch}`) return response({ object: { sha: head } });
    if (pathname === `${base}/git/commits/${head}`) return response({ tree: { sha: treeSha } });
    if (pathname === `${base}/git/trees/${treeSha}`) {
      assert.equal(searchParams.get('recursive'), '1');
      return response({ truncated, tree: documents.map(({ path, sha }) => ({ type: 'blob', path, sha: changedCatalog && path === TOPICS_PATH ? 'c'.repeat(40) : sha })) });
    }
    const document = documents.find(file => pathname === `${base}/contents/${file.path}` || pathname === `${base}/git/blobs/${file.sha}`);
    if (document && options.method === undefined) return response({ type: 'file', encoding: 'base64', content: Buffer.from(document.text).toString('base64'), sha: document.sha });
    if (pathname === '/graphql') {
      const mutation = JSON.parse(options.body);
      assert.equal(options.method, 'POST');
      assert.match(mutation.query, /createCommitOnBranch/);
      mutations.push(mutation.variables.input);
      return response(failHead ? { errors: [{ message: 'expected commit mismatch' }] } : { data: { createCommitOnBranch: { commit: { oid: 'c'.repeat(40) } } } });
    }
    throw new Error(`Unexpected fixture request ${pathname}`);
  } });
  return { gh, mutations };
}

test('deletes unused nodes at the same branch head used for the reference check', async () => {
  const h = fixture();
  assert.deepEqual(await h.gh.deleteAlgorithmTopic(input), { topics: [], overrides: [] });
  const [mutation] = h.mutations;
  assert.equal(mutation.expectedHeadOid, head);
  assert.deepEqual(mutation.branch, { repositoryNameWithOwner: repo, branchName: branch });
  assert.equal(mutation.fileChanges.additions[0].path, TOPICS_PATH);
  assert.deepEqual(JSON.parse(Buffer.from(mutation.fileChanges.additions[0].contents, 'base64')), { schema: 1, topics: [] });
});

test('refuses nodes referenced by notes, introductions, curriculum or Trick recommendations', async () => {
  const stages = curriculum.stages.map(stage => ({ id: stage.id, title: stage.title, gates: stage.gates.map(gate => ({ id: gate.id, title: gate.title, kind: gate.kind, sectionId: gate.sectionId, scope: gate.scope })) }));
  stages[1].gates.push({ id: 'custom-33333333-3333-4333-8333-333333333333', title: '测试关卡', kind: 'learning', sectionId: curriculum.stages[1].sections[0].id, scope: 'core', description: '关联仓库算法', goals: ['理解仓库算法'], topicIds: [id] });
  const course = JSON.stringify({ schema: 1, layout: { stages }, author: createdBy, updatedAt: createdAt });
  const cases = [
    [LEARNING_CURRICULUM_PATH, course, /学习课程引用/],
    ['algorithms/notes/personal/99/note.md', markdown({ node_id: id }), /仍有算法笔记/],
    [algorithmNodeContentPath(id), JSON.stringify({ schema: 1, nodeId: id, introduction: '范围', featuredNotePaths: [], author: { id: 1, login: 'admin' }, updatedAt: createdAt }), /简介或精选/],
    ['tricks/22222222-2222-4222-8222-222222222222.md', markdown({ recommendation: { prerequisiteIds: [id] } }), /前置算法/],
  ];
  for (const [path, text, error] of cases) {
    const h = fixture({ files: { [path]: text } });
    await assert.rejects(h.gh.deleteAlgorithmTopic(input), error);
    assert.deepEqual(h.mutations, []);
  }
});

test('fails closed for incomplete trees, a changed directory, or a competing commit', async () => {
  for (const options of [{ truncated: true }, { changedCatalog: true }]) {
    const h = fixture(options);
    await assert.rejects(h.gh.deleteAlgorithmTopic(input), /无法完整|已更新/);
    assert.deepEqual(h.mutations, []);
  }
  const race = fixture({ failHead: true });
  await assert.rejects(race.gh.deleteAlgorithmTopic(input), /仓库可能已更新/);
  assert.equal(race.mutations.length, 1);
});
