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

function makeIndex(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-sync-'));
  fs.writeFileSync(path.join(dir, 'lg.ndjson'), rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ schema: 1, builtAt: '2026-11-19T00:00:00.000Z', platforms: { LG: { count: rows.length } }, totalCount: rows.length }));
  return dir;
}
const existingRows = Array.from({ length: 100 }, (_, index) => ({
  id: `LG:P${index + 1}`, platform: 'LG', title: `Problem ${index + 1}`, url: `https://www.luogu.com.cn/problem/P${index + 1}`,
  rating: null, estimatedCfRating: 900, luoguDifficulty: '入门', estimatedLuoguDifficulty: null,
  communityDifficulty: null, tags: ['动态规划'], rawTags: ['dp'], tagsKnown: true, tagsMapped: true, estimateReason: null
}));

test('incremental sync only requests pages after the known count', async () => {
  const dir = makeIndex(existingRows);
  const pages = [];
  const fetcher = async url => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    pages.push(page);
    if (page === 1) return textResponse(luoguHtml(150, []));
    return textResponse(luoguHtml(150, [luoguRow(page * 50 - 49), luoguRow(page * 50 - 48)]));
  };
  const report = await createSync({ directory: dir, fs, path, fetcher, platforms: ['LG'], now: () => 1000 }).run();
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(report.platforms.LG.status, 'updated');
  assert.equal(report.platforms.LG.before, 100);
  assert.equal(report.platforms.LG.after, 102);
  assert.equal(report.platforms.LG.added, 2);
  const lines = fs.readFileSync(path.join(dir, 'lg.ndjson'), 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 102);
});

test('incremental sync skips fetching when the count is unchanged', async () => {
  const dir = makeIndex(existingRows);
  const pages = [];
  const fetcher = async url => { pages.push(Number(new URL(String(url)).searchParams.get('page'))); return textResponse(luoguHtml(100, [])); };
  const report = await createSync({ directory: dir, fs, path, fetcher, platforms: ['LG'], now: () => 1000 }).run();
  assert.deepEqual(pages, [1]);
  assert.equal(report.platforms.LG.status, 'skipped');
  assert.equal(fs.readFileSync(path.join(dir, 'lg.ndjson'), 'utf8').split('\n').filter(Boolean).length, 100);
});

test('a failed incremental fetch keeps the previous shard intact', async () => {
  const dir = makeIndex(existingRows);
  const fetcher = async url => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    if (page === 1) return textResponse(luoguHtml(150, []));
    throw new Error('simulated network failure');
  };
  const report = await createSync({ directory: dir, fs, path, fetcher, platforms: ['LG'], now: () => 1000 }).run();
  assert.equal(report.platforms.LG.status, 'failed');
  assert.match(report.platforms.LG.message, /simulated network failure/);
  assert.equal(fs.readFileSync(path.join(dir, 'lg.ndjson'), 'utf8').split('\n').filter(Boolean).length, 100);
});

test('applies community LeetCode ratings and falls back to the native tier', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-sync-lc-'));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ schema: 1, builtAt: '2026-11-19T00:00:00.000Z' }));
  const fetcher = async (url, init) => {
    const target = String(url);
    if (target.includes('graphql')) {
      return {
        ok: true, status: 200, text: async () => '',
        json: async () => ({ data: { problemsetQuestionList: { total: 2, questions: [
          { frontendQuestionId: '1', title: 'Two Sum', titleSlug: 'two-sum', difficulty: 'Easy', paidOnly: false, topicTags: [] },
          { frontendQuestionId: '3743', title: 'Hard One', titleSlug: 'hard-one', difficulty: 'Hard', paidOnly: false, topicTags: [] }
        ] } } })
      };
    }
    if (target.includes('zerotrac')) return { ok: true, status: 200, text: async () => '', json: async () => [{ ID: 3743, Rating: 3124.6 }] };
    throw new Error(`unexpected ${target}`);
  };
  await createSync({ directory: dir, fs, path, fetcher, platforms: ['LC'], now: () => 1000 }).run();
  const rows = fs.readFileSync(path.join(dir, 'lc.ndjson'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  const byId = new Map(rows.map(row => [row.id, row]));
  assert.equal(byId.get('LC:3743').estimatedCfRating, 3125);
  assert.match(byId.get('LC:3743').estimateReason, /LeetCode 竞赛 rating 3125/);
  assert.equal(byId.get('LC:1').estimatedCfRating, 1000);
  assert.match(byId.get('LC:1').estimateReason, /力扣原生难度/);
});

test('a full sync replaces the shard and records lastFullSync', async () => {
  const dir = makeIndex(existingRows);
  const fetcher = async url => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    if (page === 1) return textResponse(luoguHtml(2, [luoguRow(1), luoguRow(2)]));
    return textResponse(luoguHtml(2, []));
  };
  const report = await createSync({ directory: dir, fs, path, fetcher, platforms: ['LG'], full: true, now: () => 1000 }).run();
  assert.equal(report.platforms.LG.status, 'rebuilt');
  const rows = fs.readFileSync(path.join(dir, 'lg.ndjson'), 'utf8').split('\n').filter(Boolean);
  assert.equal(rows.length, 2);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  assert.equal(meta.lastFullSync, new Date(1000).toISOString());
  assert.equal(meta.totalCount, 2);
});
