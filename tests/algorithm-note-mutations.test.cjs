'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const YAML = require('yaml');
const { appPath } = require('./app-path.cjs');
const { GitHub } = require(appPath('electron/github.cjs'));
const { builtinIndex } = require(appPath('electron/algorithm-topics.cjs'));
const { frontmatter } = require(appPath('electron/record-parser.cjs'));
const tree = require(appPath('ui/algorithm-tree.js'));

const [firstLeaf, secondLeaf] = [...builtinIndex(tree).values()].filter(node => node.kind === 'algorithm' && !node.children.length);
const repo = 'team/notebook';
const sourceKey = `https://api.github.com|${repo}`;
const publicPath = 'algorithms/notes/public/历史笔记.md';
const personalPath = 'algorithms/notes/personal/42/my-note.md';
const foreignPath = 'algorithms/notes/personal/99/other-note.md';
const clientId = '55c710aa-e083-4b14-94fe-a3a825d17f70';
const sha = 'initial-sha';
const oldDate = '2026-01-04T12:00:00.000Z';

function noteText(fields = {}) {
  return `---\n${YAML.stringify({
    schema: 3, note_scope: 'public', node_id: firstLeaf.id, author_id: 99, author: 'original-author',
    title: 'Original title', client_id: clientId, featured: true, updated_at: oldDate,
    tags: ['original-tag'], legacy: { color: 'blue', counter: 0 }, ...fields,
  })}---\nOriginal body`;
}

function fixture({ files = {}, permissions = { push: true, admin: false }, writeStatus } = {}) {
  const docs = new Map(Object.entries(files).map(([path, text]) => [path, { text, sha }]));
  const reads = [], writes = [];
  const base = `/repos/${repo}`;
  const fetcher = async (url, options) => {
    const { pathname, searchParams } = new URL(url);
    const respond = (body, status = 200) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body });
    if (pathname === '/user') return respond({ id: 42, login: 'signed-in' });
    if (pathname === base) return respond({ permissions, default_branch: 'notes/stable' });
    const prefix = `${base}/contents/`;
    if (!pathname.startsWith(prefix)) throw Error(`Unexpected request to ${pathname}`);
    const path = decodeURIComponent(pathname.slice(prefix.length));
    const current = docs.get(path);
    const method = options.method || 'GET';
    if (method === 'GET') {
      reads.push({ path, branch: searchParams.get('ref') });
      return current ? respond({ type: 'file', encoding: 'base64', sha: current.sha, content: Buffer.from(current.text).toString('base64') }) : respond({}, 404);
    }
    const body = JSON.parse(options.body);
    writes.push({ path, method, ...body });
    if (writeStatus) return respond({}, writeStatus);
    if (body.sha !== current?.sha) return respond({}, 409);
    if (method === 'DELETE') {
      docs.delete(path);
      return respond({ content: null });
    }
    assert.equal(method, 'PUT');
    const savedSha = `written-${writes.length}`;
    docs.set(path, { sha: savedSha, text: Buffer.from(body.content, 'base64').toString('utf8') });
    return respond({ content: { sha: savedSha } });
  };
  return { gh: new GitHub({ repo, token: 'mock-session', fetcher }), docs, reads, writes };
}

const target = (path, extra = {}) => ({ repo, sourceKey, path, sha, ...extra });
const change = (path, extra = {}) => ({ ...target(path), body: 'Edited body', ...extra });
const ownNote = () => noteText({ schema: undefined, note_scope: 'personal', author_id: 42, author: 'previous-login', client_id: 'legacy-client-id' });

test('administrator edits and deletes another author’s public note at its original legacy path', async () => {
  const h = fixture({ permissions: { push: true, admin: true }, files: { [publicPath]: noteText() } });
  const edited = await h.gh.saveAlgorithmNote(change(publicPath, {
    nodeId: secondLeaf.id, author: 'forged', authorId: 42, clientId: 'forged', title: 'Revised',
    body: noteText({ author_id: 42, note_scope: 'personal', client_id: 'forged', featured: false, legacy: null }),
  }));
  assert.equal(edited.id, `document:${publicPath}`);
  assert.equal(edited.path, publicPath);
  assert.equal(edited.nodeId, secondLeaf.id);
  assert.equal(edited.sha, 'written-1');
  const metadata = frontmatter(h.docs.get(publicPath).text, true).meta;
  assert.deepEqual(metadata, {
    schema: 3, note_scope: 'public', node_id: secondLeaf.id, author_id: 99, author: 'original-author',
    title: 'Revised', client_id: clientId, featured: true, updated_at: edited.updatedAt,
    tags: ['original-tag'], legacy: { color: 'blue', counter: 0 },
  });
  assert.ok(Date.parse(edited.updatedAt) > Date.parse(oldDate));
  assert.deepEqual(h.reads[0], { path: publicPath, branch: 'notes/stable' });
  assert.equal(h.writes[0].sha, sha);
  assert.equal(h.writes[0].branch, 'notes/stable');
  await assert.rejects(h.gh.deleteAlgorithmNote(target(publicPath)), /SHA.*冲突/);
  assert.deepEqual(await h.gh.deleteAlgorithmNote(target(publicPath, { sha: edited.sha })), { id: edited.id, path: publicPath, deleted: true });
  assert.deepEqual(h.writes.map(write => [write.path, write.method, write.sha, write.branch]), [
    [publicPath, 'PUT', sha, 'notes/stable'], [publicPath, 'DELETE', edited.sha, 'notes/stable'],
  ]);
  assert.equal(h.docs.has(publicPath), false);
});

test('personal owners retain legacy metadata and can delete without admin privileges', async () => {
  const h = fixture({ files: { [personalPath]: ownNote() } });
  const saved = await h.gh.saveAlgorithmNote(change(personalPath, { featured: false }));
  assert.equal(saved.author, 'previous-login');
  assert.equal(saved.authorId, 42);
  assert.equal(saved.noteScope, 'personal');
  assert.equal(saved.clientId, 'legacy-client-id');
  assert.equal(saved.featured, true);
  assert.equal(saved.schema, null);
  assert.equal(frontmatter(h.docs.get(personalPath).text, true).meta.schema, undefined);
  assert.equal(saved.title, 'Original title');
  assert.equal(saved.body, 'Edited body');
  assert.deepEqual(saved.tags, ['original-tag']);
  const retry = await h.gh.saveAlgorithmNote(change(personalPath, { sha: saved.sha }));
  assert.equal(retry.sha, saved.sha);
  assert.equal(h.writes.length, 1);
  const deleted = await h.gh.deleteAlgorithmNote(target(personalPath, { sha: saved.sha }));
  assert.equal(deleted.id, saved.id);
  assert.equal(h.docs.size, 0);
});

test('backend rejects mismatched sources, insufficient privileges and other personal accounts before reading note contents', async () => {
  const scenarios = [
    { path: foreignPath, extra: { admin: true }, permissions: { push: true, admin: true }, error: /归属/ },
    { path: publicPath, extra: { admin: true }, permissions: { push: true, admin: 'true' }, error: /管理员/ },
    { path: personalPath, extra: { authorId: 42 }, permissions: { push: 'true', admin: 1 }, error: /权限/ },
    { path: personalPath, extra: { repo: 'other/notebook' }, error: /仓库/ },
    { path: personalPath, extra: { sourceKey: 'https://example.invalid|team/notebook' }, error: /Git 服务|来源/ },
    { path: personalPath, extra: { sourceKey: '' }, error: /来源/ },
    { path: personalPath, extra: { serverUrl: 'https://example.invalid' }, error: /Git 服务/ },
  ];
  for (const { path, extra, permissions, error } of scenarios) {
    const h = fixture({ permissions, files: { [path]: ownNote() } });
    await assert.rejects(h.gh.saveAlgorithmNote(change(path, extra)), error);
    await assert.rejects(h.gh.deleteAlgorithmNote(target(path, extra)), error);
    assert.deepEqual(h.reads, []);
    assert.deepEqual(h.writes, []);
  }
});

test('generic document operations cannot mutate algorithm notes', async () => {
  const h = fixture({ files: { [publicPath]: noteText({ author_id: 42 }) } });
  await assert.rejects(h.gh.saveDocument(change(publicPath)), /算法笔记编辑入口/);
  await assert.rejects(h.gh.deleteDocument(target(publicPath)), /算法笔记删除入口/);
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.writes, []);
});

test('edit and delete reject invalid paths, malformed notes and unsafe SHA values without writes', async () => {
  const h = fixture({ files: { [personalPath]: ownNote() } });
  for (const path of ['problems/qmx/42/note.md', 'algorithms/notes/personal/42/sub/note.md', 'algorithms/notes/personal/42/../note.md', 'algorithms/notes/personal/42/encoded%2fnote.md']) {
    await assert.rejects(h.gh.saveAlgorithmNote(change(path)), /路径/);
    await assert.rejects(h.gh.deleteAlgorithmNote(target(path)), /路径/);
  }
  for (const invalidSha of [undefined, '', {}, 40, ` ${sha}`, 'stale-sha']) {
    await assert.rejects(h.gh.saveAlgorithmNote(change(personalPath, { sha: invalidSha })), /SHA/);
    await assert.rejects(h.gh.deleteAlgorithmNote(target(personalPath, { sha: invalidSha })), /SHA/);
  }
  await assert.rejects(h.gh.saveAlgorithmNote(change(personalPath, { noteScope: 'public' })), /范围/);
  await assert.rejects(h.gh.saveAlgorithmNote(change(undefined)), /SHA/);
  await assert.rejects(h.gh.deleteAlgorithmNote(target(personalPath, { repo: undefined })), /仓库/);
  assert.deepEqual(h.writes, []);

  for (const text of [undefined, 'arbitrary Markdown', noteText(), noteText({ note_scope: 'personal' }), noteText({ note_scope: 'personal', author_id: 42, schema: 99 })]) {
    const stale = fixture({ files: text === undefined ? {} : { [personalPath]: text } });
    await assert.rejects(stale.gh.saveAlgorithmNote(change(personalPath)));
    await assert.rejects(stale.gh.deleteAlgorithmNote(target(personalPath)));
    assert.deepEqual(stale.writes, []);
  }
});

test('remote conflict uses caller SHA and retries of creation cannot overwrite an existing note', async () => {
  const conflicted = fixture({ files: { [personalPath]: ownNote() }, writeStatus: 409 });
  await assert.rejects(conflicted.gh.saveAlgorithmNote(change(personalPath)), /冲突/);
  await assert.rejects(conflicted.gh.deleteAlgorithmNote(target(personalPath)), /冲突/);
  assert.deepEqual(conflicted.writes.map(write => write.sha), [sha, sha]);
  assert.equal(conflicted.docs.get(personalPath).sha, sha);

  const h = fixture();
  const create = { repo, clientId, nodeId: firstLeaf.id, body: 'New body' };
  const created = await h.gh.saveAlgorithmNote(create);
  const retry = await h.gh.saveAlgorithmNote(create);
  assert.equal(retry.sha, created.sha);
  await assert.rejects(h.gh.saveAlgorithmNote({ ...create, body: 'Overwrite without an edit SHA' }), /路径和 SHA/);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].sha, undefined);
  assert.equal(frontmatter(h.docs.get(created.path).text, true).body, 'New body');
});
