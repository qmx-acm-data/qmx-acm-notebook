'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appPath } = require('./app-path.cjs');
const { createSync } = require(appPath('electron/library-sync.cjs'));

const luoguHtml = (count, rows) => `<script id="lentille-context" type="application/json">${JSON.stringify({ data: { problems: { count, result: rows } } })}</script>`;
const luoguRow = id => ({ pid: `P${id}`, name: `Problem ${id}`, difficulty: 1, tags: [3] });
const textResponse = text => ({ ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) });
const noSleep = async () => {};

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function shardRows(dir, name = 'lg.ndjson') {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
}
function shardText(dir, name = 'lg.ndjson') {
  return fs.readFileSync(path.join(dir, name), 'utf8');
}
function readStateFile(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'sync-state.json'), 'utf8'));
}
function readMetaFile(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
}
function writeShard(dir, name, rows) {
  fs.writeFileSync(path.join(dir, name), rows.map(row => JSON.stringify(row)).join('\n') + '\n');
}
/** Existing library rows are only read back by id during sync. */
function libraryRows(count, platform = 'LG', prefix = 'P') {
  return Array.from({ length: count }, (_, index) => ({
    id: `${platform}:${prefix}${index + 1}`, platform, title: `Problem ${index + 1}`,
    url: `https://www.luogu.com.cn/problem/${prefix}${index + 1}`
  }));
}
function luoguPagesFetcher(size, hook) {
  const requests = [];
  const fetcher = async url => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    requests.push(page);
    if (hook) await hook(page);
    const first = (page - 1) * 50 + 1;
    const rows = [];
    for (let id = first; id <= Math.min(first + 49, size); id += 1) rows.push(luoguRow(id));
    return textResponse(luoguHtml(size, rows));
  };
  return { requests, fetcher };
}
function writeState(dir, value) {
  fs.writeFileSync(path.join(dir, 'sync-state.json'), JSON.stringify(value, null, 2));
}
function lcRow(id) {
  return { id: `LC:${id}`, platform: 'LC', title: `LC ${id}`, url: `https://leetcode.com/problems/lc-${id}/` };
}
/** LeetCode counts paid-only questions in `total` but the parser filters them out. */
function lcQuestions(total, free, paid) {
  const questions = [];
  for (let id = 1; id <= free; id += 1) {
    questions.push({ frontendQuestionId: String(id), title: `LC ${id}`, titleSlug: `lc-${id}`, difficulty: 'Easy', paidOnly: false, topicTags: [] });
  }
  for (let index = 0; index < paid; index += 1) {
    questions.push({ frontendQuestionId: String(free + 1 + index), title: `Paid ${index}`, titleSlug: `paid-${index}`, difficulty: 'Easy', paidOnly: true, topicTags: [] });
  }
  return { data: { problemsetQuestionList: { total, questions } } };
}
function completedState(platforms, mode = 'incremental') {
  return {
    running: false, pauseRequested: false, mode,
    startedAt: '2026-11-19T00:00:00.000Z', finishedAt: '2026-11-19T00:00:00.000Z',
    platforms, totalCount: 0
  };
}
function donePlatform(fields) {
  return { status: 'done', known: 0, total: null, fetched: 0, added: 0, cursor: null, updatedAt: '2026-11-19T00:00:00.000Z', ...fields };
}
function lcFetcher(payload, graphql) {
  return async url => {
    const target = String(url);
    if (target.includes('graphql')) {
      graphql.push(target);
      return { ok: true, status: 200, text: async () => '', json: async () => payload };
    }
    if (target.includes('zerotrac')) return { ok: true, status: 200, text: async () => '', json: async () => [] };
    throw new Error(`unexpected ${target}`);
  };
}

test('full crawl checkpoints each page batch and resumes from the saved cursor after a failure', async () => {
  const dir = tempDir('qmx-sync-checkpoint-');
  const first = luoguPagesFetcher(300, page => { if (page === 3) throw new Error('page 3 unavailable'); });
  const failed = await createSync({ directory: dir, fs, path, fetcher: first.fetcher, platforms: ['LG'], full: true, pageBatch: 2, sleep: noSleep, now: () => 1000 }).run();
  assert.equal(failed.platforms.LG.status, 'failed');
  assert.match(failed.platforms.LG.message, /page 3 unavailable/);
  assert.equal(shardRows(dir).length, 100, 'the batch before the failing page is already merged');
  assert.equal(fs.existsSync(path.join(dir, 'lg.ndjson.bak')), false, 'an empty first full crawl has nothing to back up');
  const checkpoint = readStateFile(dir);
  assert.equal(checkpoint.mode, 'full');
  assert.equal(checkpoint.running, false);
  assert.equal(checkpoint.platforms.LG.status, 'failed');
  assert.equal(checkpoint.platforms.LG.cursor, 3);
  assert.equal(checkpoint.platforms.LG.fetched, 100);

  const second = luoguPagesFetcher(300);
  const resumed = await createSync({ directory: dir, fs, path, fetcher: second.fetcher, platforms: ['LG'], full: true, pageBatch: 2, sleep: noSleep, now: () => 2000 }).run();
  assert.deepEqual(second.requests, [3, 4, 5, 6], 'resume starts at the saved cursor and never re-probes the first page');
  assert.equal(resumed.platforms.LG.status, 'rebuilt');
  assert.equal(resumed.platforms.LG.before, 100);
  assert.equal(resumed.platforms.LG.after, 300);
  assert.equal(shardRows(dir).length, 300);
  const done = readStateFile(dir);
  assert.equal(done.platforms.LG.status, 'done');
  assert.equal(done.platforms.LG.cursor, null);
  assert.equal(done.platforms.LG.fetched, 300);
  assert.equal(done.platforms.LG.added, 300);
});

test('an upstream shrink keeps every local row and asks for a full rebuild', async () => {
  const dir = tempDir('qmx-sync-shrink-');
  writeShard(dir, 'lg.ndjson', libraryRows(100));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ schema: 1 }));
  const pages = [];
  const fetcher = async url => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    pages.push(page);
    if (page === 1) return textResponse(luoguHtml(90, []));
    return textResponse(luoguHtml(90, [luoguRow(101), luoguRow(102)]));
  };
  const report = await createSync({ directory: dir, fs, path, fetcher, platforms: ['LG'], sleep: noSleep, now: () => 1000 }).run();
  assert.deepEqual(pages, [1, 2], 'only the overlapping tail is refreshed');
  assert.equal(report.platforms.LG.status, 'updated');
  assert.equal(report.platforms.LG.before, 100);
  assert.match(report.platforms.LG.message, /总数减少，建议完整重建/);
  const rows = shardRows(dir);
  const ids = new Set(rows.map(row => row.id));
  for (let id = 1; id <= 100; id += 1) assert.ok(ids.has(`LG:P${id}`), `LG:P${id} kept after the shrink`);
  assert.equal(rows.length, 102);
});

test('a short shard without a trusted upstream baseline fills from the overlapping tail', async () => {
  const dir = tempDir('qmx-sync-gap-');
  writeShard(dir, 'lg.ndjson', libraryRows(90));
  const pages = luoguPagesFetcher(100);
  const report = await createSync({ directory: dir, fs, path, fetcher: pages.fetcher, platforms: ['LG'], sleep: noSleep, now: () => 1000 }).run();
  assert.notEqual(report.platforms.LG.status, 'skipped', 'a short shard is filled instead of skipped');
  assert.deepEqual(pages.requests, [1, 2], 'probe plus the page that holds the missing rows');
  assert.equal(report.platforms.LG.status, 'updated');
  assert.equal(shardRows(dir).length, 100);
  assert.deepEqual(readStateFile(dir).platforms.LG.status, 'done');
});

test('a paid-only filtered upstream total skips the next incremental run with no page requests', async () => {
  const dir = tempDir('qmx-sync-lc-paid-');
  writeShard(dir, 'lc.ndjson', [lcRow(1), lcRow(2), lcRow(3)]);
  writeState(dir, completedState({ LC: donePlatform({ known: 3, total: 5, fetched: 3, added: 3 }) }));
  const graphql = [];
  const report = await createSync({
    directory: dir, fs, path, platforms: ['LC'], sleep: noSleep, now: () => 1000,
    fetcher: lcFetcher(lcQuestions(5, 3, 2), graphql)
  }).run();
  assert.equal(report.platforms.LC.status, 'skipped');
  assert.equal(report.platforms.LC.before, 3);
  assert.equal(report.platforms.LC.after, 3);
  assert.equal(graphql.length, 1, 'only the probe request; the paid-filtered gap never triggers a page fetch');
  assert.equal(shardRows(dir, 'lc.ndjson').length, 3);
  const state = readStateFile(dir);
  assert.equal(state.platforms.LC.status, 'skipped');
  assert.equal(state.platforms.LC.total, 5, 'the upstream total stays recorded for the next run');
});

test('a real upstream growth still crawls the tail when the shard holds fewer rows than the last total', async () => {
  const dir = tempDir('qmx-sync-lc-grow-');
  writeShard(dir, 'lc.ndjson', [lcRow(1), lcRow(2), lcRow(3)]);
  writeState(dir, completedState({ LC: donePlatform({ known: 3, total: 5, fetched: 3, added: 3 }) }));
  const graphql = [];
  const report = await createSync({
    directory: dir, fs, path, platforms: ['LC'], sleep: noSleep, now: () => 1000,
    fetcher: lcFetcher(lcQuestions(6, 4, 2), graphql)
  }).run();
  assert.equal(report.platforms.LC.status, 'updated');
  assert.equal(report.platforms.LC.before, 3);
  assert.equal(report.platforms.LC.after, 4);
  assert.equal(report.platforms.LC.added, 1);
  assert.equal(graphql.length, 2, 'probe plus one overlapping tail page');
  const state = readStateFile(dir);
  assert.equal(state.platforms.LC.status, 'done');
  assert.equal(state.platforms.LC.total, 6);

  const graphqlAgain = [];
  const skipped = await createSync({
    directory: dir, fs, path, platforms: ['LC'], sleep: noSleep, now: () => 2000,
    fetcher: lcFetcher(lcQuestions(6, 4, 2), graphqlAgain)
  }).run();
  assert.equal(skipped.platforms.LC.status, 'skipped');
  assert.equal(graphqlAgain.length, 1, 'the recorded upstream total makes the following run a clean skip');
});

test('a new upstream total below the last completed total keeps local rows and warns', async () => {
  const dir = tempDir('qmx-sync-lc-shrink-');
  writeShard(dir, 'lc.ndjson', [lcRow(1), lcRow(2), lcRow(3)]);
  writeState(dir, completedState({ LC: donePlatform({ known: 3, total: 5, fetched: 3, added: 3 }) }));
  const graphql = [];
  const report = await createSync({
    directory: dir, fs, path, platforms: ['LC'], sleep: noSleep, now: () => 1000,
    fetcher: lcFetcher(lcQuestions(4, 3, 1), graphql)
  }).run();
  assert.equal(report.platforms.LC.status, 'updated');
  assert.match(report.platforms.LC.message, /总数减少，建议完整重建/);
  assert.deepEqual(shardRows(dir, 'lc.ndjson').map(row => row.id), ['LC:1', 'LC:2', 'LC:3']);
  assert.equal(graphql.length, 2, 'the overlapping tail page is refreshed without deleting rows');
});

function ncHtml(total, page) {
  const first = (page - 1) * 50 + 1;
  const rows = [];
  for (let id = first; id <= Math.min(first + 49, total); id += 1) {
    rows.push(`<tr data-problemId="${id}"><td>NC${id}</td><td><a class="title" href="/acm/problem/${id}">Problem ${id}</a></td><td>1200</td><td>1</td><td></td></tr>`);
  }
  return `共 ${total} 条<table>${rows.join('')}</table>`;
}

test('pause() checkpoints the current batch, stops later platforms, and a later run resumes', async () => {
  const dir = tempDir('qmx-sync-pause-');
  let sync;
  const ncRequests = [];
  const ncPausingFetcher = async url => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    ncRequests.push(page);
    if (ncRequests.length === 2) sync.pause();
    return textResponse(ncHtml(150, page));
  };
  let lgRequests = 0;
  const lgFetcher = async () => {
    lgRequests += 1;
    throw new Error('luogu must not run after a pause');
  };
  sync = createSync({
    directory: dir, fs, path, platforms: ['NC', 'LG'], full: true, pageBatch: 2, sleep: noSleep, now: () => 1000,
    fetcher: async url => String(url).includes('nowcoder') ? ncPausingFetcher(url) : lgFetcher()
  });
  assert.equal(typeof sync.pause, 'function');
  const paused = await sync.run();
  assert.equal(paused.platforms.NC.status, 'paused');
  assert.equal(paused.platforms.NC.after, 50, 'the page finished before the pause check is checkpointed');
  assert.equal(paused.platforms.LG, undefined, 'later platforms are not started once paused');
  assert.equal(lgRequests, 0);
  const pausedState = readStateFile(dir);
  assert.equal(pausedState.running, false);
  assert.equal(pausedState.pauseRequested, true);
  assert.equal(pausedState.platforms.NC.status, 'paused');
  assert.equal(pausedState.platforms.NC.cursor, 2);
  assert.equal(shardRows(dir, 'nc.ndjson').length, 50);

  const resumedPages = [];
  const resumed = await createSync({
    directory: dir, fs, path, platforms: ['NC'], full: true, pageBatch: 2, sleep: noSleep, now: () => 2000,
    fetcher: async url => {
      const page = Number(new URL(String(url)).searchParams.get('page'));
      resumedPages.push(page);
      return textResponse(ncHtml(150, page));
    }
  }).run();
  assert.deepEqual(resumedPages, [2, 3]);
  assert.equal(resumed.platforms.NC.status, 'rebuilt');
  assert.equal(resumed.platforms.NC.before, 50);
  assert.equal(resumed.platforms.NC.after, 150);
  assert.equal(shardRows(dir, 'nc.ndjson').length, 150);
  const done = readStateFile(dir);
  assert.equal(done.platforms.NC.status, 'done');
  assert.equal(done.platforms.NC.cursor, null);
  assert.equal(done.pauseRequested, false);
});

test('a default incremental run resumes a paused full rebuild and records full mode', async () => {
  const dir = tempDir('qmx-sync-should-pause-');
  let requested = 0;
  const first = luoguPagesFetcher(300, () => { requested += 1; });
  const paused = await createSync({
    directory: dir, fs, path, fetcher: first.fetcher, platforms: ['LG'], full: true, pageBatch: 2,
    sleep: noSleep, now: () => 1000, shouldPause: () => requested >= 3
  }).run();
  assert.equal(paused.platforms.LG.status, 'paused');
  assert.equal(paused.platforms.LG.after, 100);
  const pausedState = readStateFile(dir);
  assert.equal(pausedState.platforms.LG.cursor, 3);
  assert.equal(pausedState.platforms.LG.status, 'paused');
  assert.equal(pausedState.mode, 'full');

  const second = luoguPagesFetcher(300);
  const resumed = await createSync({ directory: dir, fs, path, fetcher: second.fetcher, platforms: ['LG'], pageBatch: 2, sleep: noSleep, now: () => 2000 }).run();
  assert.deepEqual(second.requests, [3, 4, 5, 6], 'a default incremental run continues the paused full crawl from its cursor');
  assert.equal(resumed.platforms.LG.status, 'updated');
  assert.equal(resumed.platforms.LG.before, 100);
  assert.equal(resumed.platforms.LG.after, 300);
  assert.equal(resumed.full, true, 'finishing a paused full rebuild is reported as a full run');
  const resumedState = readStateFile(dir);
  assert.equal(resumedState.mode, 'full', 'the state still describes the run as a full rebuild');
  assert.equal(resumedState.platforms.LG.status, 'done');
  const meta = readMetaFile(dir);
  assert.equal(meta.lastFullSync, new Date(2000).toISOString(), 'completing the resumed full rebuild records lastFullSync');
  assert.equal(meta.lastSyncMode, 'full');
});

test('resuming a paused incremental crawl keeps incremental mode and leaves lastFullSync alone', async () => {
  const dir = tempDir('qmx-sync-incremental-mode-');
  writeShard(dir, 'lg.ndjson', libraryRows(100));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ schema: 1, builtAt: '2026-11-19T00:00:00.000Z' }));
  let requested = 0;
  const first = luoguPagesFetcher(300, () => { requested += 1; });
  const paused = await createSync({
    directory: dir, fs, path, fetcher: first.fetcher, platforms: ['LG'], pageBatch: 2,
    sleep: noSleep, now: () => 1000, shouldPause: () => requested >= 2
  }).run();
  assert.equal(paused.full, false);
  assert.equal(paused.platforms.LG.status, 'paused');
  const pausedState = readStateFile(dir);
  assert.equal(pausedState.mode, 'incremental');
  assert.equal(pausedState.platforms.LG.status, 'paused');
  assert.equal(pausedState.platforms.LG.cursor, 3);
  assert.equal(readMetaFile(dir).lastFullSync, undefined);

  const second = luoguPagesFetcher(300);
  const resumed = await createSync({ directory: dir, fs, path, fetcher: second.fetcher, platforms: ['LG'], pageBatch: 2, sleep: noSleep, now: () => 2000 }).run();
  assert.deepEqual(second.requests, [3, 4, 5, 6], 'the incremental crawl continues from its cursor');
  assert.equal(resumed.platforms.LG.status, 'updated');
  assert.equal(resumed.platforms.LG.after, 300);
  assert.equal(resumed.full, false, 'a resumed incremental crawl is not a full rebuild');
  const resumedState = readStateFile(dir);
  assert.equal(resumedState.mode, 'incremental');
  assert.equal(resumedState.platforms.LG.status, 'done');
  const meta = readMetaFile(dir);
  assert.equal(meta.lastFullSync, undefined, 'incremental resumes never claim a full rebuild');
  assert.equal(meta.lastSyncMode, 'incremental');
});

test('full sync backs up the previous shard to a single overwritten .bak before clearing it', async () => {
  const dir = tempDir('qmx-sync-backup-');
  writeShard(dir, 'lg.ndjson', libraryRows(100));
  const original = shardText(dir);
  const first = luoguPagesFetcher(2);
  const rebuilt = await createSync({ directory: dir, fs, path, fetcher: first.fetcher, platforms: ['LG'], full: true, sleep: noSleep, now: () => 1000 }).run();
  assert.equal(rebuilt.platforms.LG.status, 'rebuilt');
  assert.equal(shardText(dir, 'lg.ndjson.bak'), original);
  assert.equal(shardRows(dir).length, 2);

  const beforeSecond = shardText(dir);
  const second = luoguPagesFetcher(4);
  await createSync({ directory: dir, fs, path, fetcher: second.fetcher, platforms: ['LG'], full: true, sleep: noSleep, now: () => 2000 }).run();
  assert.equal(shardText(dir, 'lg.ndjson.bak'), beforeSecond, 'the backup is overwritten instead of appended');
  assert.deepEqual(fs.readdirSync(dir).filter(name => name.startsWith('lg.ndjson.bak')), ['lg.ndjson.bak']);
  assert.equal(shardRows(dir).length, 4);
});

test('a failing platform preserves its shard and does not block the following platforms', async () => {
  const dir = tempDir('qmx-sync-isolate-');
  writeShard(dir, 'lg.ndjson', libraryRows(3));
  const original = shardText(dir);
  const ncHtml = '共 1 条<table><tr data-problemId="7"><td>NC7</td><td><a class="title" href="/acm/problem/7">Problem 7</a></td><td>1200</td><td>1</td><td></td></tr></table>';
  const report = await createSync({
    directory: dir, fs, path, platforms: ['LG', 'NC'], sleep: noSleep, now: () => 1000,
    fetcher: async url => {
      if (String(url).includes('luogu')) throw new Error('luogu probe unavailable');
      return textResponse(ncHtml);
    }
  }).run();
  assert.equal(report.platforms.LG.status, 'failed');
  assert.match(report.platforms.LG.message, /luogu probe unavailable/);
  assert.equal(shardText(dir), original, 'the failed shard is untouched');
  assert.equal(report.platforms.NC.status, 'rebuilt');
  assert.equal(shardRows(dir, 'nc.ndjson').length, 1);
  const state = readStateFile(dir);
  assert.equal(state.platforms.LG.status, 'failed');
  assert.equal(state.platforms.NC.status, 'done');
  assert.equal(state.running, false);
});

test('state keeps the shared shape and meta preserves unknown fields', async () => {
  const dir = tempDir('qmx-sync-state-');
  writeShard(dir, 'meta.json', [{ schema: 1 }]);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    schema: 1,
    builtAt: '2026-11-19T00:00:00.000Z',
    platforms: { LG: { count: 99, customFlag: true } },
    totalCount: 99,
    customRoot: { keep: 1 },
    lastError: 'stale failure'
  }));
  const states = [];
  const first = luoguPagesFetcher(60);
  const report = await createSync({
    directory: dir, fs, path, fetcher: first.fetcher, platforms: ['LG'], sleep: noSleep, now: () => 1000,
    onState: state => states.push(state)
  }).run();
  assert.equal(report.platforms.LG.status, 'rebuilt');

  const state = readStateFile(dir);
  assert.deepEqual(Object.keys(state).sort(), ['finishedAt', 'mode', 'pauseRequested', 'platforms', 'running', 'startedAt', 'totalCount']);
  assert.equal(state.mode, 'incremental');
  assert.equal(state.running, false);
  assert.equal(typeof state.finishedAt, 'string');
  assert.deepEqual(Object.keys(state.platforms.LG).sort(), ['added', 'cursor', 'fetched', 'known', 'status', 'total', 'updatedAt']);
  assert.equal(state.platforms.LG.status, 'done');
  assert.equal(state.platforms.LG.total, 60);
  assert.equal(state.platforms.LG.fetched, 60);
  assert.equal(state.totalCount, 60);
  assert.ok(states.length >= 2, 'state is reported while crawling and after finishing');
  assert.equal(states[states.length - 1].platforms.LG.status, 'done');
  assert.equal(states[states.length - 1].running, false);

  const meta = readMetaFile(dir);
  assert.deepEqual(meta.customRoot, { keep: 1 });
  assert.equal(meta.platforms.LG.customFlag, true);
  assert.equal(meta.platforms.LG.count, 60);
  assert.equal(meta.lastSyncMode, 'incremental');
  assert.equal(meta.lastSyncAt, new Date(1000).toISOString());
  assert.equal(meta.lastFullSync, undefined);
  assert.equal(meta.lastError, undefined);
  assert.equal(meta.totalCount, 60);
  assert.equal(typeof meta.totalBytes, 'number');
  assert.equal(typeof meta.estimatedMemoryBytes, 'number');
  assert.equal(typeof meta.tagVocabulary, 'number');
});

test('injected state IO replaces the default sync-state.json and supports resume', async () => {
  const dir = tempDir('qmx-sync-injected-');
  let stored = null;
  const io = { readState: () => stored, writeState: value => { stored = value; } };
  const first = luoguPagesFetcher(300, page => { if (page === 3) throw new Error('checkpoint failure'); });
  await createSync({ directory: dir, fs, path, fetcher: first.fetcher, platforms: ['LG'], full: true, pageBatch: 2, sleep: noSleep, now: () => 1000, ...io }).run();
  assert.equal(fs.existsSync(path.join(dir, 'sync-state.json')), false);
  assert.equal(stored.platforms.LG.status, 'failed');
  assert.equal(stored.platforms.LG.cursor, 3);
  assert.deepEqual(Object.keys(stored).sort(), ['finishedAt', 'mode', 'pauseRequested', 'platforms', 'running', 'startedAt', 'totalCount']);

  const second = luoguPagesFetcher(300);
  const resumed = await createSync({ directory: dir, fs, path, fetcher: second.fetcher, platforms: ['LG'], full: true, pageBatch: 2, sleep: noSleep, now: () => 2000, ...io }).run();
  assert.deepEqual(second.requests, [3, 4, 5, 6]);
  assert.equal(resumed.platforms.LG.after, 300);
  assert.equal(stored.platforms.LG.status, 'done');
  assert.equal(stored.platforms.LG.cursor, null);
});

test('newest-first Nowcoder increments scan the head through a known page without missing interleaved additions', async () => {
  for (const layout of ['prepend', 'interleaved', 'later']) {
    const dir = tempDir('qmx-sync-nc-head-');
    const old = libraryRows(150, 'NC', '');
    writeShard(dir, 'nc.ndjson', old);
    writeState(dir, completedState({ NC: donePlatform({ total: 150, known: 150 }) }));
    const priorIds = old.map(row => Number(row.id.slice(3))).reverse();
    const ids = layout === 'prepend' ? [151, ...priorIds] : layout === 'interleaved' ? [150, 151, ...priorIds.slice(1)] : [...priorIds.slice(0, 50), 151, ...priorIds.slice(50)];
    const requests = [];
    const report = await createSync({ directory: dir, fs, path, platforms: ['NC'], sleep: noSleep, fetcher: async url => {
      const page = Number(new URL(String(url)).searchParams.get('page'));
      requests.push(page);
      const rows = ids.slice((page - 1) * 50, page * 50);
      return textResponse(`共 ${ids.length} 条<table>${rows.map(id => `<tr data-problemId="${id}"><td>NC${id}</td><td><a class="title">Problem ${id}</a></td><td>1200</td></tr>`).join('')}</table>`);
    } }).run();
    assert.deepEqual(requests, layout === 'later' ? [1, 1, 2, 3] : [1, 1, 2]);
    assert.equal(report.platforms.NC.after, 151);
    assert.equal(report.platforms.NC.added, 1);
    assert.ok(shardRows(dir, 'nc.ndjson').some(row => row.id === 'NC:151'));
    assert.equal(readStateFile(dir).platforms.NC.total, 151);
  }
});

test('newest-first Nowcoder first build traverses every page and insufficient growth stays failed', async () => {
  for (const existing of [0, 150]) {
    const dir = tempDir('qmx-sync-nc-complete-');
    if (existing) {
      writeShard(dir, 'nc.ndjson', libraryRows(existing, 'NC', ''));
      writeState(dir, completedState({ NC: donePlatform({ total: existing, known: existing }) }));
    }
    const requests = [];
    const report = await createSync({ directory: dir, fs, path, platforms: ['NC'], sleep: noSleep, fetcher: async url => {
      const page = Number(new URL(String(url)).searchParams.get('page'));
      requests.push(page);
      const ids = Array.from({ length: 150 }, (_, index) => 150 - index).slice((page - 1) * 50, page * 50);
      return textResponse(`共 ${existing ? 151 : 150} 条<table>${ids.map(id => `<tr data-problemId="${id}"><td>NC${id}</td><td><a class="title">Problem ${id}</a></td><td>1200</td></tr>`).join('')}</table>`);
    } }).run();
    assert.deepEqual(requests, existing ? [1, 1, 2, 3, 4] : [1, 1, 2, 3]);
    assert.equal(report.platforms.NC.after, 150);
    assert.equal(report.platforms.NC.status, existing ? 'failed' : 'rebuilt');
    if (existing) {
      assert.equal(readStateFile(dir).platforms.NC.cursor, 1);
      assert.match(report.platforms.NC.message, /新增题目数量不足/);
    }
  }
});

test('unfinished full sync preserves the last completed full sync timestamp', async () => {
  const timestamp = '2026-11-19T00:00:00.000Z';
  for (const failure of ['paused', 'failed']) {
    const dir = tempDir('qmx-sync-full-timestamp-');
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ lastFullSync: timestamp }));
    let requests = 0;
    const pages = luoguPagesFetcher(100, () => { requests += 1; if (failure === 'failed' && requests === 3) throw Error('interrupted'); });
    const report = await createSync({ directory: dir, fs, path, platforms: ['LG'], full: true, fetcher: pages.fetcher, sleep: noSleep, now: () => 1000, shouldPause: () => failure === 'paused' && requests >= 2 }).run();
    assert.equal(report.platforms.LG.status, failure);
    assert.equal(readMetaFile(dir).lastFullSync, timestamp);
    const resumed = await createSync({ directory: dir, fs, path, platforms: ['LG'], full: true, fetcher: luoguPagesFetcher(100).fetcher, sleep: noSleep, now: () => 2000 }).run();
    assert.equal(resumed.platforms.LG.after, 100);
    assert.equal(readMetaFile(dir).lastFullSync, new Date(2000).toISOString());
  }
});

test('LeetCode short pages advance by raw rows and an early empty page stays resumable', async () => {
  const questions = [false, true, false, false, false].map((paidOnly, index) => ({ frontendQuestionId: String(index + 1), title: `LC ${index + 1}`, titleSlug: `lc-${index + 1}`, difficulty: 'Easy', paidOnly, topicTags: [] }));
  for (const empty of [false, true]) {
    const dir = tempDir('qmx-sync-lc-short-');
    const skips = [];
    const fetcher = async (url, init) => {
      if (String(url).includes('zerotrac')) return { ok: true, json: async () => [] };
      const { skip } = JSON.parse(init.body).variables;
      skips.push(skip);
      return { ok: true, json: async () => ({ data: { problemsetQuestionList: { total: questions.length, questions: empty && skip === 2 ? [] : questions.slice(skip, skip + 2) } } }) };
    };
    const report = await createSync({ directory: dir, fs, path, platforms: ['LC'], full: true, fetcher, sleep: noSleep }).run();
    const state = readStateFile(dir).platforms.LC;
    if (empty) {
      assert.deepEqual(skips, [0, 0, 2]);
      assert.equal(report.platforms.LC.status, 'failed');
      assert.match(report.platforms.LC.message, /分页提前为空.*偏移 2/);
      assert.equal(state.cursor, 2);
      assert.equal(state.total, 5);
      assert.deepEqual(shardRows(dir, 'lc.ndjson').map(row => row.id), ['LC:1']);
      assert.equal(readMetaFile(dir).lastFullSync, undefined);
      skips.length = 0;
      const resumed = await createSync({ directory: dir, fs, path, platforms: ['LC'], fetcher: async (url, init) => {
        if (String(url).includes('zerotrac')) return { ok: true, json: async () => [] };
        const { skip } = JSON.parse(init.body).variables;
        skips.push(skip);
        return { ok: true, json: async () => ({ data: { problemsetQuestionList: { total: 5, questions: questions.slice(skip, skip + 2) } } }) };
      }, sleep: noSleep }).run();
      assert.deepEqual(skips, [2, 4]);
      assert.equal(resumed.platforms.LC.after, 4);
      assert.equal(readStateFile(dir).platforms.LC.status, 'done');
    } else {
      assert.deepEqual(skips, [0, 0, 2, 4]);
      assert.equal(report.platforms.LC.after, 4);
      assert.equal(state.status, 'done');
      assert.equal(state.total, 5);
      assert.equal(state.cursor, null);
    }
  }
});

test('page requests are throttled by 250ms while single-request platforms are not', async () => {
  const lgDir = tempDir('qmx-sync-throttle-lg-');
  const slept = [];
  const pages = luoguPagesFetcher(300);
  await createSync({
    directory: lgDir, fs, path, fetcher: pages.fetcher, platforms: ['LG'], full: true, pageBatch: 2, now: () => 1000,
    sleep: async ms => { slept.push(ms); }
  }).run();
  assert.deepEqual(slept, [250, 250, 250, 250, 250, 250], 'six gaps between the probe and the six page requests');

  const cfDir = tempDir('qmx-sync-throttle-cf-');
  const cfSlept = [];
  const cfFetcher = async () => ({ ok: true, status: 200, json: async () => ({ status: 'OK', result: { problems: [{ contestId: 1, index: 'A', name: 'CF One', rating: 800, tags: [] }] } }) });
  await createSync({
    directory: cfDir, fs, path, fetcher: cfFetcher, platforms: ['CF'], full: true, now: () => 1000,
    sleep: async ms => { cfSlept.push(ms); }
  }).run();
  assert.deepEqual(cfSlept, [], 'CF and AtCoder issue a single request per sync');
});
