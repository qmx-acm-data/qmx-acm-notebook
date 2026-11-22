'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const { appPath } = require('./app-path.cjs');

// Real main, sandboxed preload, IPC, storage and six-second CLIST limiter.
// Only the transport is replaced: every response and credential is synthetic.
const TEST_USERNAME = 'SYNTHETIC_BACKFILL_TEST_USER';
const TEST_KEY = 'SYNTHETIC_BACKFILL_TEST_KEY';
const PLATFORMS = ['AT', 'CF', 'LOJ', 'LC', 'NC', 'LG'];
const IPC_NAMES = ['getDifficultyBackfillStatus', 'startDifficultyBackfill', 'pauseDifficultyBackfill', 'getClistStatus', 'saveClistCredentials', 'saveProblemEnrichment', 'removeProblemEnrichment', 'getProblemEnrichment'];
const atUrl = index => `https://atcoder.jp/contests/abc999/tasks/abc999_${String(index).padStart(2, '0')}`;
const OTHER_URLS = { CF: 'https://codeforces.com/problemset/problem/1999/A', LOJ: 'https://loj.ac/p/1000', LC: 'https://leetcode.com/problems/two-sum/', NC: 'https://ac.nowcoder.com/acm/problem/1000', LG: 'https://www.luogu.com.cn/problem/P1000' };
const RESOURCES = { AT: 'atcoder.jp', CF: 'codeforces.com', LOJ: 'loj.ac', LC: 'leetcode.com', NC: 'ac.nowcoder.com', LG: 'luogu.com.cn' };
const CF_UNCACHED_URL = 'https://codeforces.com/problemset/problem/1999/B';
const SYNTHETIC_QUERIED_AT = '2026-11-20T01:02:03.000Z';
function seedPositiveCache(profile, urls) {
  const file = path.join(profile, 'clist-rating-cache.json');
  fs.writeFileSync(file, JSON.stringify({ schema: 1, syntheticTestFixture: 'Locally seeded positive scores, not remote CLIST data.', ratings: Object.fromEntries(Object.entries(urls).map(([platform, url]) => [url, { rating: 1500, resource: RESOURCES[platform], queriedAt: SYNTHETIC_QUERIED_AT }])) }, null, 2) + '\n');
  return file;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function seedProfile() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-backfill-electron-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ autoSync: false }));
  fs.writeFileSync(path.join(profile, 'contests.json'), JSON.stringify({ schema: 1, platforms: ['luogu', 'codeforces', 'atcoder', 'nowcoder'].map(id => ({ id, contests: [], updatedAt: new Date().toISOString() })) }));
  const library = path.join(profile, 'library');
  fs.mkdirSync(library);
  const originals = new Map();
  for (const platform of PLATFORMS) {
    const rows = platform === 'AT'
      ? Array.from({ length: 9 }, (_, offset) => ({ id: `AT:synthetic-${String(offset + 1).padStart(2, '0')}`, platform, title: 'Synthetic offline AtCoder backfill fixture', url: atUrl(offset + 1), tags: [], rating: null, communityDifficulty: null, officialTags: [], officialDifficulty: null }))
      : [{ id: `${platform}:synthetic-native`, platform, title: `Synthetic offline ${platform} native fixture`, url: OTHER_URLS[platform], tags: [], rating: platform === 'CF' ? 1200 : null, officialTags: [], officialDifficulty: platform === 'LC' ? 'Easy' : platform === 'LG' ? '入门' : '1200' }];
    const file = path.join(library, `${platform.toLowerCase()}.ndjson`);
    fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    originals.set(file, fs.readFileSync(file));
  }
  const meta = path.join(library, 'meta.json');
  fs.writeFileSync(meta, JSON.stringify({ schema: 1, builtAt: new Date().toISOString() }));
  originals.set(meta, fs.readFileSync(meta));
  seedPositiveCache(profile, OTHER_URLS);
  const oldAt = new Date(Date.now() - 60_000).toISOString();
  const ledger = { schema: 1, syntheticFixture: 'Legacy none rows have no known outcome reason.', attempts: Object.fromEntries([1, 2, 3].map(index => [atUrl(index), { at: oldAt, result: 'none' }])) };
  const ledgerFile = path.join(profile, 'difficulty-backfill-ledger.json');
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');
  const oldState = { status: 'running', running: true, pauseRequested: false, batchSize: 100, processed: 113, found: 11, skipped: 102, failed: 2, startedAt: oldAt, finishedAt: null, platforms: { AT: { missing: 9, attempted: 3, found: 1 } } };
  const stateFile = path.join(profile, 'difficulty-backfill.json');
  fs.writeFileSync(stateFile, JSON.stringify(oldState, null, 2) + '\n');
  return { profile, originals, ledger, ledgerFile, ledgerBytes: fs.readFileSync(ledgerFile), stateFile, stateBytes: fs.readFileSync(stateFile), oldState };
}
function seedNativeProfile() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-backfill-native-electron-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ autoSync: false }));
  fs.writeFileSync(path.join(profile, 'contests.json'), JSON.stringify({ schema: 1, platforms: ['luogu', 'codeforces', 'atcoder', 'nowcoder'].map(id => ({ id, contests: [], updatedAt: new Date().toISOString() })) }));
  const library = path.join(profile, 'library');
  fs.mkdirSync(library);
  const originals = new Map();
  for (const platform of PLATFORMS) {
    const rows = platform === 'CF'
      ? [OTHER_URLS.CF, CF_UNCACHED_URL].map((url, index) => ({ id: `CF:synthetic-native-${index}`, platform, title: 'Synthetic native CF cache coverage fixture', url, tags: [], rating: 1200, officialTags: [], officialDifficulty: '1200' }))
      : [{ id: `${platform}:synthetic-cached`, platform, title: 'Synthetic offline positive-cache companion', url: platform === 'AT' ? atUrl(1) : OTHER_URLS[platform], tags: [], rating: null, communityDifficulty: platform === 'AT' ? 1000 : null, officialTags: [], officialDifficulty: platform === 'LC' ? 'Easy' : platform === 'LG' ? '入门' : platform === 'AT' ? null : '1200' }];
    const file = path.join(library, `${platform.toLowerCase()}.ndjson`);
    fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
    originals.set(file, fs.readFileSync(file));
  }
  const meta = path.join(library, 'meta.json');
  fs.writeFileSync(meta, JSON.stringify({ schema: 1, builtAt: new Date().toISOString() }));
  originals.set(meta, fs.readFileSync(meta));
  const cacheFile = seedPositiveCache(profile, { ...OTHER_URLS, AT: atUrl(1) });
  return { profile, originals, cacheFile };
}
function assertCacheCoverage(state, expected) {
  for (const [platform, total, cached] of expected) {
    const row = state.platforms[platform];
    assert.ok(row, `Missing ${platform} cache coverage row`);
    assert.equal(row.total, total, `${platform} total`);
    assert.equal(row.clistCached, cached, `${platform} positive CLIST cache`);
    assert.equal(row.clistPending, total - cached, `${platform} CLIST pending`);
  }
}
function assertMainCacheCoverage(state, atCached) {
  assertCacheCoverage(state, [['AT', 9, atCached], ...Object.keys(OTHER_URLS).map(platform => [platform, 1, 1])]);
}
function assertNativeCoverage(state, cached) {
  assertCacheCoverage(state, [['CF', 2, cached], ...PLATFORMS.filter(platform => platform !== 'CF').map(platform => [platform, 1, 1])]);
  for (const row of Object.values(state.platforms)) {
    assert.equal(row.sourceMissing, 0, 'Native CF difficulty must leave no source gap');
    assert.equal(row.missing, 0);
    assert.equal(row.resolved, 0);
  }
}
function assertLibraryUnchanged(originals) {
  for (const [file, bytes] of originals) assert.deepEqual(fs.readFileSync(file), bytes, `Library changed: ${path.basename(file)}`);
}
function assertGaps(state, { missing, resolved }) {
  assert.equal(state.platforms.AT.sourceMissing, 9, 'Original native/community gap must remain nine');
  assert.equal(state.platforms.AT.missing, missing, 'Only positive effective references resolve pending gaps');
  assert.equal(state.platforms.AT.resolved, resolved);
  assert.equal(missing + resolved, state.platforms.AT.sourceMissing);
  for (const [platform, row] of Object.entries(state.platforms)) {
    if (platform === 'AT') continue;
    assert.equal(row.sourceMissing, 0, `Native ${platform} difficulty must prevent a source gap`);
    assert.equal(row.missing, 0, `Native ${platform} difficulty must prevent a pending gap`);
    assert.equal(row.resolved, 0, `Native ${platform} fixture does not need a reference`);
  }
}
function assertPersistedBatch(file, returned) {
  const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(stored.platforms.AT.missing, 9, 'Core persisted missing retains the original candidate count');
  const batchFields = state => ({ ...state, platforms: Object.fromEntries(Object.entries(state.platforms).map(([platform, row]) => {
    const { missing, sourceMissing, resolved, total, clistCached, clistPending, ...batch } = row;
    return [platform, batch];
  })) });
  assert.deepEqual(batchFields(stored), batchFields(returned), 'Persisted and returned batch fields disagree');
}
function assertCounts(state, expected, gaps) {
  for (const [field, value] of Object.entries(expected)) assert.equal(state[field], value, field);
  const sum = field => Object.values(state.platforms).reduce((total, row) => total + (row[field] ?? 0), 0);
  assert.equal(state.processed, state.found + state.notFound + state.noRating + state.failed);
  assert.equal(state.processed, sum('attempted'));
  assert.ok(state.processed <= state.batchSize);
  for (const field of ['found', 'notFound', 'noRating', 'failed']) assert.equal(state[field], sum(field), `platform ${field}`);
  for (const [platform, row] of Object.entries(state.platforms)) {
    assert.equal(row.attempted, row.found + (row.notFound ?? 0) + (row.noRating ?? 0) + (row.failed ?? 0), platform);
    if (platform !== 'AT') assert.equal(row.attempted, 0, `Native ${platform} fixture must not be queried`);
  }
  assertGaps(state, gaps);
  assertMainCacheCoverage(state, gaps.cached ?? gaps.resolved);
  assert.ok(!JSON.stringify(state).includes(TEST_KEY), 'Credential escaped main process');
}
async function invoke(page, method, ...args) {
  return page.evaluate(({ method, args }) => window.notebook[method](...args), { method, args });
}
async function begin(page) {
  // Keep the IPC promise inside the real renderer so another IPC can pause it.
  await page.evaluate(() => {
    window.__backfillTestRun = { result: null, error: null, done: false };
    window.notebook.startDifficultyBackfill().then(result => { window.__backfillTestRun.result = result; }, error => { window.__backfillTestRun.error = error.message; }).finally(() => { window.__backfillTestRun.done = true; });
  });
}
async function completed(page) {
  await page.waitForFunction(() => window.__backfillTestRun?.done, null, { timeout: 30_000 });
  const run = await page.evaluate(() => window.__backfillTestRun);
  assert.equal(run.error, null);
  return run.result;
}
async function launch(profile, mode = 'at') {
  const env = { ...process.env, QMX_USER_DATA_DIR: profile, QMX_ISOLATED_SANDBOX: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  // DNS is blocked from process creation, before the startup interception below.
  // The default Electron sandbox is required; no --no-sandbox escape hatch.
  const app = await electron.launch({ executablePath: require('electron'), args: [appPath(''), '--disable-gpu', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'], env, timeout: 30_000 });
  try {
    await app.evaluate(({ net, session }, mode) => {
      globalThis.__backfillNetwork = { mocked: [], unexpected: [], node: [], chromium: [], held: null, release: null };
      const network = globalThis.__backfillNetwork;
      const requestUrl = input => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url || String(input);
      const originalFetch = net.fetch;
      net.fetch = async function(input, options) {
        const url = new URL(requestUrl(input));
        if (!/^https?:$/.test(url.protocol)) return originalFetch.call(this, input, options);
        // Record only a safe origin/path and the fixture identity; never headers.
        const safe = url.origin + url.pathname;
        const pattern = url.searchParams.get('url__regex') || '';
        const match = /tasks\/abc999_(0[4-9])/.exec(pattern);
        const cfMatch = mode === 'cf' && pattern === '/(contest/1999/problem/B|problemset/problem/1999/B)/?([?#].*)?$' && url.searchParams.get('resource') === 'codeforces.com' && network.mocked.length === 0;
        const supported = mode === 'at' ? url.searchParams.get('resource') === 'atcoder.jp' && match : cfMatch;
        if (url.protocol !== 'https:' || url.hostname !== 'clist.by' || url.pathname !== '/api/v4/problem/' || url.searchParams.get('limit') !== '10' || !supported) {
          network.unexpected.push({ safe, resource: url.searchParams.get('resource'), pattern, limit: url.searchParams.get('limit'), stack: new Error('Synthetic unexpected request origin').stack });
          throw new Error('Unexpected external request blocked by synthetic backfill test');
        }
        if (cfMatch) {
          network.mocked.push({ safe, platform: 'CF', url: 'https://codeforces.com/problemset/problem/1999/B', at: Date.now() });
          return new Response(JSON.stringify({ objects: [{ url: 'https://codeforces.com/contest/1999/problem/B', rating: 1700 }] }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        const index = Number(match[1]);
        network.mocked.push({ safe, index, at: Date.now() });
        const respond = () => {
          if (index === 7) return new Response('Synthetic unavailable', { status: 503 });
          const objects = index === 6 ? [] : [{ url: `https://atcoder.jp/contests/abc999/tasks/abc999_${match[1]}`, ...(index === 8 ? {} : { rating: index === 5 ? 0 : 1700 }) }];
          return new Response(JSON.stringify({ objects }), { status: 200, headers: { 'content-type': 'application/json' } });
        };
        // The resolver lives in the main process; no serialized Promise or fake
        // worker implementation crosses the Playwright evaluation boundary.
        if (index === 8 || index === 9) {
          network.held = index;
          return new Promise(resolve => { network.release = () => { network.release = null; network.held = null; resolve(respond()); }; });
        }
        return respond();
      };
      const nodeFetch = globalThis.fetch;
      globalThis.fetch = function(input, ...args) {
        const url = new URL(requestUrl(input));
        if (/^https?:$/.test(url.protocol)) { network.node.push(url.origin + url.pathname); return Promise.reject(new Error('Node external network blocked by synthetic backfill test')); }
        return nodeFetch.call(this, input, ...args);
      };
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = new URL(details.url);
        const blocked = /^https?:$/.test(url.protocol);
        if (blocked) network.chromium.push(url.origin + url.pathname);
        callback({ cancel: blocked });
      });
    }, mode);
    const page = await app.firstWindow();
    await page.waitForFunction(names => names.every(name => typeof window.notebook?.[name] === 'function'), IPC_NAMES, { timeout: 30_000 });
    await page.locator('.daily-problem-title').waitFor({ state: 'visible', timeout: 30_000 });
    return { app, page };
  } catch (error) { await app.close(); throw error; }
}
async function gate(app, index) {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    const held = await app.evaluate(() => globalThis.__backfillNetwork.held);
    if (held === index) return;
    await delay(100);
  }
  assert.fail(`Synthetic request ${index} never reached its main-process transport gate`);
}
async function release(app) {
  await app.evaluate(() => {
    if (typeof globalThis.__backfillNetwork.release !== 'function') throw new Error('Missing synthetic request resolver');
    globalThis.__backfillNetwork.release();
  });
}
async function evidence(app) {
  const value = await app.evaluate(() => {
    const { mocked, unexpected, node, chromium } = globalThis.__backfillNetwork;
    return { mocked, unexpected, node, chromium };
  });
  assert.deepEqual(value.unexpected, [], 'Unexpected Electron transport request');
  assert.deepEqual(value.node, [], 'Unexpected Node transport request');
  assert.deepEqual(value.chromium, [], 'Unexpected Chromium request');
  return value;
}

(async () => {
  const fixture = seedProfile();
  const { profile, originals, ledger, ledgerFile, ledgerBytes, stateFile, stateBytes, oldState } = fixture;
  const networkEvidence = [];
  let app, page;
  try {
    ({ app, page } = await launch(profile));
    const runtime = await app.evaluate(({ app, BrowserWindow, safeStorage }) => ({ root: app.getAppPath(), userData: app.getPath('userData'), safeStorage: safeStorage.isEncryptionAvailable(), preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences() }));
    assert.equal(path.resolve(runtime.root), appPath(''));
    assert.equal(path.resolve(runtime.userData), profile);
    assert.equal(runtime.preferences.sandbox, true);
    assert.equal(runtime.preferences.contextIsolation, true);
    assert.equal(runtime.preferences.nodeIntegration, false);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    assert.equal(runtime.safeStorage, true, 'Real OS safeStorage is required for the synthetic CLIST credentials');
    const recoveredOld = await invoke(page, 'getDifficultyBackfillStatus');
    assert.equal(recoveredOld.status, 'paused', 'A persisted running state has no worker after process startup');
    assert.equal(recoveredOld.running, false);
    assertGaps(recoveredOld, { missing: 9, resolved: 0 });
    assertMainCacheCoverage(recoveredOld, 0);
    for (const field of ['processed', 'found', 'skipped', 'failed', 'startedAt']) assert.equal(recoveredOld[field], oldState[field]);
    assert.equal(Object.hasOwn(recoveredOld, 'notFound'), false, 'Legacy unknown outcomes must stay unknown');
    assert.equal(Object.hasOwn(recoveredOld, 'noRating'), false);
    assert.equal(Object.hasOwn(recoveredOld.platforms.AT, 'notFound'), false);
    assert.equal(Object.hasOwn(recoveredOld.platforms.AT, 'noRating'), false);
    assert.deepEqual(fs.readFileSync(stateFile), stateBytes, 'Read-only startup recovery rewrote old state');
    assert.equal((await invoke(page, 'getClistStatus')).configured, false);
    await assert.rejects(() => invoke(page, 'startDifficultyBackfill'), /配置 CLIST/);
    assert.deepEqual(fs.readFileSync(ledgerFile), ledgerBytes, 'No-key start rewrote history');
    assert.deepEqual(fs.readFileSync(stateFile), stateBytes, 'No-key start rewrote state');
    assert.deepEqual((await evidence(app)).mocked, [], 'No-key start must not request CLIST');

    const saved = await invoke(page, 'saveClistCredentials', { username: TEST_USERNAME, apiKey: TEST_KEY });
    assert.deepEqual(saved, { configured: true, username: TEST_USERNAME });
    const authFile = path.join(profile, 'clist-auth.json');
    const authBytes = fs.readFileSync(authFile, 'utf8');
    const auth = JSON.parse(authBytes);
    assert.equal(typeof auth.encrypted, 'string');
    assert.ok(auth.encrypted.length > 20);
    assert.ok(!authBytes.includes(TEST_KEY) && !authBytes.includes(TEST_USERNAME), 'Synthetic credentials were saved as plaintext');
    assert.deepEqual(await invoke(page, 'getClistStatus'), saved);
    await begin(page);
    await gate(app, 8); // Real limiter: first five calls take at least 24 seconds.
    const beforePause = await invoke(page, 'getDifficultyBackfillStatus');
    assertCounts(beforePause, { status: 'running', running: true, batchSize: 100, processed: 4, found: 1, notFound: 1, noRating: 1, failed: 1, skipped: 8 }, { missing: 8, resolved: 1 });
    const pause = await invoke(page, 'pauseDifficultyBackfill');
    assertCounts(pause, { status: 'pausing', running: true, pauseRequested: true, processed: 4, found: 1, notFound: 1, noRating: 1, failed: 1, skipped: 8 }, { missing: 8, resolved: 1 });
    await release(app);
    const paused = await completed(page);
    assertCounts(paused, { status: 'paused', running: false, pauseRequested: true, processed: 5, found: 1, notFound: 1, noRating: 2, failed: 1, skipped: 8 }, { missing: 8, resolved: 1 });
    assert.match(paused.message, /剩余 1 题/);
    assert.deepEqual(await invoke(page, 'getDifficultyBackfillStatus'), paused, 'Returned and status IPC counters disagree');
    assertPersistedBatch(stateFile, paused);
    const firstLedger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    assert.equal(firstLedger.schema, 1);
    assert.equal(firstLedger.syntheticFixture, ledger.syntheticFixture);
    assert.equal(Object.keys(firstLedger.attempts).length, 8);
    for (const index of [1, 2, 3]) assert.deepEqual(firstLedger.attempts[atUrl(index)], ledger.attempts[atUrl(index)], 'Old none history was reclassified');
    assert.equal(firstLedger.attempts[atUrl(4)].result, 'found');
    for (const [index, result, reason] of [[5, 'none', 'no-rating'], [6, 'none', 'not-found'], [7, 'error', 'request-error'], [8, 'none', 'no-rating']]) {
      assert.equal(firstLedger.attempts[atUrl(index)].result, result);
      assert.equal(firstLedger.attempts[atUrl(index)].reason, reason);
    }
    assert.equal(Object.hasOwn(firstLedger.attempts, atUrl(9)), false, 'Pause consumed the remaining candidate');
    const firstEvidence = await evidence(app);
    assert.deepEqual(firstEvidence.mocked.map(row => row.index), [4, 5, 6, 7, 8]);
    for (let i = 1; i < firstEvidence.mocked.length; i += 1) assert.ok(firstEvidence.mocked[i].at - firstEvidence.mocked[i - 1].at >= 5700, 'Production six-second rate limiter was bypassed');
    networkEvidence.push(firstEvidence);
    assertLibraryUnchanged(originals);
    await app.close(); app = undefined;

    ({ app, page } = await launch(profile));
    assert.deepEqual(await invoke(page, 'getClistStatus'), saved, 'OS-encrypted synthetic credentials did not survive restart');
    const restored = await invoke(page, 'getDifficultyBackfillStatus');
    assertCounts(restored, { status: 'paused', running: false, processed: 5, found: 1, notFound: 1, noRating: 2, failed: 1, skipped: 8 }, { missing: 8, resolved: 1 });
    assert.equal(restored.startedAt, paused.startedAt);
    assert.deepEqual((await evidence(app)).mocked, [], 'Restoring status performed a lookup');
    await begin(page);
    await gate(app, 9);
    const fresh = await invoke(page, 'getDifficultyBackfillStatus');
    assertCounts(fresh, { status: 'running', running: true, batchSize: 100, processed: 0, found: 0, notFound: 0, noRating: 0, failed: 0, skipped: 13 }, { missing: 8, resolved: 1 });
    assert.ok(Date.parse(fresh.startedAt) > Date.parse(paused.startedAt), 'A continued batch must have a new startedAt');
    assert.equal(fresh.finishedAt, null);
    await release(app);
    const done = await completed(page);
    assertCounts(done, { status: 'done', running: false, processed: 1, found: 1, notFound: 0, noRating: 0, failed: 0, skipped: 13 }, { missing: 7, resolved: 2 });
    assert.match(done.message, /剩余 0 题/);
    assert.deepEqual(await invoke(page, 'getDifficultyBackfillStatus'), done);
    assertPersistedBatch(stateFile, done);
    const finalLedger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
    assert.equal(Object.keys(finalLedger.attempts).length, 9);
    for (const [url, entry] of Object.entries(firstLedger.attempts)) assert.deepEqual(finalLedger.attempts[url], entry, 'Restart changed historical attempts');
    assert.equal(finalLedger.attempts[atUrl(9)].result, 'found');
    // Historical none entries still lack references; cooldown only prevents a new
    // lookup. An approved manual reference resolves AT1 independently of CLIST.
    const cacheFile = path.join(profile, 'clist-rating-cache.json');
    const cacheBytes = fs.readFileSync(cacheFile);
    const finalLedgerBytes = fs.readFileSync(ledgerFile);
    const finalStateBytes = fs.readFileSync(stateFile);
    const manual = await invoke(page, 'saveProblemEnrichment', { url: atUrl(1), expectedRevision: 0, cfRating: 1500, luoguDifficulty: '普及/提高-', reason: 'Synthetic manual difficulty reference for the historical none fixture.' });
    assert.equal(manual.revision, 1);
    assert.equal(manual.supplement.status, 'approved');
    assert.equal(manual.supplement.source, 'manual');
    const manuallyResolved = await invoke(page, 'getDifficultyBackfillStatus');
    assertCounts(manuallyResolved, { status: 'done', running: false, processed: 1, found: 1, notFound: 0, noRating: 0, failed: 0, skipped: 13 }, { missing: 6, resolved: 3, cached: 2 });
    assertPersistedBatch(stateFile, manuallyResolved);
    const removed = await invoke(page, 'removeProblemEnrichment', { url: atUrl(1), expectedRevision: manual.revision });
    assert.equal(removed.revision, 2);
    assert.equal(removed.supplement, null);
    assert.deepEqual(await invoke(page, 'getDifficultyBackfillStatus'), done, 'Removing the manual reference must restore seven pending gaps and unchanged batch fields');
    assert.deepEqual(fs.readFileSync(cacheFile), cacheBytes, 'Manual references rewrote the CLIST cache');
    assert.deepEqual(fs.readFileSync(ledgerFile), finalLedgerBytes, 'Manual references rewrote lookup history');
    assert.deepEqual(fs.readFileSync(stateFile), finalStateBytes, 'Manual references rewrote persisted batch state');
    const secondEvidence = await evidence(app);
    assert.deepEqual(secondEvidence.mocked.map(row => row.index), [9]);
    networkEvidence.push(secondEvidence);
    assertLibraryUnchanged(originals);
    await app.close(); app = undefined;

    ({ app, page } = await launch(profile));
    const persistedDone = await invoke(page, 'getDifficultyBackfillStatus');
    assertCounts(persistedDone, { status: 'done', running: false, processed: 1, found: 1, notFound: 0, noRating: 0, failed: 0, skipped: 13 }, { missing: 7, resolved: 2 });
    assert.equal(persistedDone.startedAt, done.startedAt);
    assert.equal(persistedDone.finishedAt, done.finishedAt);
    assert.deepEqual((await evidence(app)).mocked, [], 'Completed state restoration performed a lookup');
    networkEvidence.push(await evidence(app));
    assertLibraryUnchanged(originals);
    await app.close(); app = undefined;

    // A native CF score resolves source difficulty, but it must not suppress a
    // real CLIST cache lookup. Keep this in a tiny fresh profile so only one
    // request is required, without repeating the 30-second AT pause sequence.
    const native = seedNativeProfile();
    ({ app, page } = await launch(native.profile, 'cf'));
    const nativeBefore = await invoke(page, 'getDifficultyBackfillStatus');
    assertNativeCoverage(nativeBefore, 1);
    assert.equal((await invoke(page, 'getClistStatus')).configured, false);
    const nativeProblemBefore = (await invoke(page, 'getProblemEnrichment', CF_UNCACHED_URL)).problem;
    assert.equal(nativeProblemBefore.rating, 1200);
    assert.equal(nativeProblemBefore.officialDifficulty, '1200');
    assert.equal(nativeProblemBefore.clistRating, null);
    const seededCache = JSON.parse(fs.readFileSync(native.cacheFile, 'utf8'));
    assert.equal(Object.keys(seededCache.ratings).length, 6);
    assert.equal(seededCache.ratings[OTHER_URLS.CF].rating, 1500);
    assert.equal(Object.hasOwn(seededCache.ratings, CF_UNCACHED_URL), false);
    assert.deepEqual((await evidence(app)).mocked, [], 'Status or metadata eagerly queried an uncached native problem');
    assert.deepEqual(await invoke(page, 'saveClistCredentials', { username: TEST_USERNAME, apiKey: TEST_KEY }), saved);
    const nativeAuthBytes = fs.readFileSync(path.join(native.profile, 'clist-auth.json'), 'utf8');
    assert.equal(typeof JSON.parse(nativeAuthBytes).encrypted, 'string');
    assert.ok(!nativeAuthBytes.includes(TEST_KEY) && !nativeAuthBytes.includes(TEST_USERNAME));
    await begin(page);
    const nativeDone = await completed(page);
    assertNativeCoverage(nativeDone, 2);
    for (const [field, expected] of Object.entries({ status: 'done', running: false, processed: 1, found: 1, notFound: 0, noRating: 0, failed: 0, skipped: 6 })) assert.equal(nativeDone[field], expected, `native ${field}`);
    assert.equal(nativeDone.platforms.CF.attempted, 1);
    assert.equal(nativeDone.platforms.CF.found, 1);
    for (const [platform, row] of Object.entries(nativeDone.platforms)) if (platform !== 'CF') assert.equal(row.attempted, 0);
    assert.deepEqual(await invoke(page, 'getDifficultyBackfillStatus'), nativeDone);
    const nativeCache = JSON.parse(fs.readFileSync(native.cacheFile, 'utf8'));
    for (const [url, entry] of Object.entries(seededCache.ratings)) assert.deepEqual(nativeCache.ratings[url], entry, 'Unrelated seeded positive cache changed');
    assert.equal(nativeCache.ratings[CF_UNCACHED_URL].rating, 1700);
    assert.equal(nativeCache.ratings[CF_UNCACHED_URL].resource, 'codeforces.com');
    assert.ok(Number.isFinite(Date.parse(nativeCache.ratings[CF_UNCACHED_URL].queriedAt)));
    const nativeProblem = (await invoke(page, 'getProblemEnrichment', CF_UNCACHED_URL)).problem;
    assert.equal(nativeProblem.rating, 1200, 'CLIST 1700 must not replace native CF 1200');
    assert.equal(nativeProblem.officialDifficulty, '1200');
    assert.equal(nativeProblem.clistRating, 1700);
    assert.equal(nativeProblem.clistRatingCached, true);
    assert.equal(nativeProblem.estimatedCfRating, null);
    const nativeLedger = JSON.parse(fs.readFileSync(path.join(native.profile, 'difficulty-backfill-ledger.json'), 'utf8'));
    assert.deepEqual(Object.keys(nativeLedger.attempts), [CF_UNCACHED_URL]);
    assert.equal(nativeLedger.attempts[CF_UNCACHED_URL].result, 'found');
    const nativeEvidence = await evidence(app);
    assert.deepEqual(nativeEvidence.mocked.map(row => [row.platform, row.url]), [['CF', CF_UNCACHED_URL]], 'Only the uncached native CF problem should be queried');
    networkEvidence.push(nativeEvidence);
    assertLibraryUnchanged(native.originals);
    await app.close(); app = undefined;

    ({ app, page } = await launch(native.profile, 'cf'));
    assert.deepEqual(await invoke(page, 'getClistStatus'), saved, 'Native-profile encrypted credentials did not survive restart');
    assertNativeCoverage(await invoke(page, 'getDifficultyBackfillStatus'), 2);
    const nativeCacheBytes = fs.readFileSync(native.cacheFile);
    const nativeLedgerBytes = fs.readFileSync(path.join(native.profile, 'difficulty-backfill-ledger.json'));
    await begin(page);
    const nativeAllSkipped = await completed(page);
    assertNativeCoverage(nativeAllSkipped, 2);
    for (const [field, expected] of Object.entries({ status: 'done', running: false, processed: 0, found: 0, notFound: 0, noRating: 0, failed: 0, skipped: 7 })) assert.equal(nativeAllSkipped[field], expected, `cached native ${field}`);
    assert.deepEqual(fs.readFileSync(native.cacheFile), nativeCacheBytes, 'Positive-cache skip rewrote ratings');
    assert.deepEqual(fs.readFileSync(path.join(native.profile, 'difficulty-backfill-ledger.json')), nativeLedgerBytes, 'Positive-cache skip rewrote lookup history');
    assert.deepEqual((await evidence(app)).mocked, [], 'Restart with all positive cache must make no request');
    assertLibraryUnchanged(native.originals);
    networkEvidence.push(await evidence(app));
    console.log('PASS real Electron default sandbox/main/preload/IPC, synthetic OS-encrypted CLIST credentials, no-key rejection, legacy statistics, four outcome classes, held-transport pause, restart continuation, AT gaps/manual references, all-platform positive-cache skips, native CF 1200 queried once for CLIST 1700 with pending 1 to 0 and restart cache reuse, unchanged shards, zero external transport');
    console.log(JSON.stringify({ syntheticTestFixture: true, root: runtime.root, profile, sandbox: runtime.preferences.sandbox, contextIsolation: runtime.preferences.contextIsolation, nodeIntegration: runtime.preferences.nodeIntegration, safeStorage: runtime.safeStorage, paused: { processed: paused.processed, found: paused.found, notFound: paused.notFound, noRating: paused.noRating, failed: paused.failed, skipped: paused.skipped }, continued: { processed: done.processed, found: done.found, notFound: done.notFound, noRating: done.noRating, failed: done.failed, skipped: done.skipped }, gaps: { initial: recoveredOld.platforms.AT, firstPositive: beforePause.platforms.AT, restarted: restored.platforms.AT, secondPositive: done.platforms.AT, manual: manuallyResolved.platforms.AT, removed: persistedDone.platforms.AT }, native: { profile: native.profile, before: nativeBefore.platforms.CF, after: nativeDone.platforms.CF, allCached: nativeAllSkipped.platforms.CF, nativeRating: nativeProblem.rating, clistRating: nativeProblem.clistRating }, externalRequests: 0, networkEvidence }));
  } finally {
    if (app) await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
