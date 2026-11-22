'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron: electron } = require('playwright');
const { appPath } = require('./app-path.cjs');

// Only the bundled baseline is real shipped data. All local library records,
// personal scores and mocked API pages are explicitly SYNTHETIC test fixtures.
// Profiles and OS-encrypted synthetic credentials are created under os.tmpdir().
const ROOT = appPath('');
const INITIAL = appPath('electron/data/clist-initial-cache.json');
const EXPECTED_VERSION = JSON.parse(fs.readFileSync(appPath('package.json'), 'utf8')).version;
const STARTUP_ONLY = process.argv.includes('--startup-preservation-only');
const BULK_METHODS = ['getClistBulkStatus', 'startClistBulkSync', 'pauseClistBulkSync'];
const RESOURCES = ['codeforces.com', 'atcoder.jp', 'leetcode.com', 'luogu.com.cn', 'ac.nowcoder.com', 'loj.ac'];
const URLS = {
  CF: 'https://codeforces.com/problemset/problem/1/A',
  AT: 'https://atcoder.jp/contests/abc999/tasks/abc999_a',
  LG: 'https://www.luogu.com.cn/problem/P1000',
  NC: 'https://ac.nowcoder.com/acm/problem/328351',
  LC: 'https://leetcode.com/problems/two-sum/',
  LOJ: 'https://loj.ac/p/1000'
};
const NEW_DATE = '2026-11-22T04:00:00.000Z';
const OLD_DATE = '2026-01-01T00:00:00.000Z';
const SOURCE = { url: 'https://public-cache.example.test/clist.json', lastSyncedAt: OLD_DATE };
const USER = 'synthetic_bulk_e2e_account';
const KEY = 'synthetic-bulk-e2e-key-never-a-real-credential';
const json = value => JSON.stringify(value, null, 2) + '\n';
const rating = (resource, score, queriedAt = OLD_DATE) => ({ resource, rating: score, queriedAt });
const bulkUrl = id => `https://codeforces.com/problemset/problem/9999/A${id}`;

function profile(name, cache) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `qmx-clist-bulk-${name}-`));
  fs.writeFileSync(path.join(directory, 'settings.json'), json({ autoSync: false }));
  fs.writeFileSync(path.join(directory, 'contests.json'), json({ schema: 1, platforms: ['luogu', 'codeforces', 'atcoder', 'nowcoder'].map(id => ({ id, contests: [], updatedAt: new Date().toISOString() })) }));
  fs.mkdirSync(path.join(directory, 'library'));
  const originals = new Map();
  for (const [platform, url] of Object.entries(URLS)) {
    const row = { id: `${platform}:synthetic-bulk-e2e`, platform, title: `SYNTHETIC offline ${platform} fixture`, url, tags: [], rating: null, officialTags: [], officialDifficulty: null };
    if (platform === 'CF') Object.assign(row, { rating: 1200, officialDifficulty: '1200', tags: ['dp'], officialTags: ['dp'] });
    if (platform === 'LC') Object.assign(row, { officialDifficulty: 'Easy', officialTags: ['数组'], tags: ['数组'] });
    const file = path.join(directory, 'library', `${platform.toLowerCase()}.ndjson`);
    fs.writeFileSync(file, JSON.stringify(row) + '\n'); originals.set(file, fs.readFileSync(file));
  }
  const meta = path.join(directory, 'library', 'meta.json');
  fs.writeFileSync(meta, json({ schema: 1, builtAt: OLD_DATE })); originals.set(meta, fs.readFileSync(meta));
  const cacheFile = path.join(directory, 'clist-rating-cache.json');
  if (cache) fs.writeFileSync(cacheFile, json(cache));
  return { directory, cacheFile, originals, marker: path.join(directory, 'clist-initial-cache-state.json'), source: path.join(directory, 'clist-shared-source.json'), progress: path.join(directory, 'clist-bulk-progress.json') };
}
function unchanged(fixture, allowClistAuth = false) {
  for (const [file, bytes] of fixture.originals) assert.deepEqual(fs.readFileSync(file), bytes, `Native shard changed: ${path.basename(file)}`);
  for (const name of ['auth.json', 'ai-auth.json', ...(allowClistAuth ? [] : ['clist-auth.json'])]) assert.equal(fs.existsSync(path.join(fixture.directory, name)), false, `Unexpected credential file: ${name}`);
}

// Loaded by an Electron launch bootstrap before production main. This closes the startup
// race: DNS is blackholed from process creation and every app transport is mocked
// before a window/renderer or main setup can request anything. Only update.check
// is stubbed; main, preload, setup, seed, credentials, CLIST service and IPC run.
function installBootstrap(root, directory) {
  const { app, net, session } = require('electron');
  const nativeFs = require('node:fs'), nativePath = require('node:path');
  const state = globalThis.__bulkE2E = { requests: [], unexpected: [], node: [], chromium: [], reads: [], writes: [], updaterChecks: 0, choice: null, gated: false, release: null, gateFirst: false };
  const normalize = file => nativePath.resolve(String(file));
  const read = nativeFs.readFileSync;
  nativeFs.readFileSync = function(file, ...args) {
    const resolved = normalize(file);
    if (/(?:^|[\\/])(?:auth|clist-auth|ai-auth)\.json$/.test(resolved) && !resolved.startsWith(directory + nativePath.sep)) throw new Error('Credential access outside synthetic profile forbidden');
    if (resolved.startsWith(nativePath.join(directory, 'library') + nativePath.sep) && resolved.endsWith('.ndjson')) state.reads.push(nativePath.basename(resolved));
    return read.call(this, file, ...args);
  };
  for (const method of ['writeFileSync', 'renameSync']) {
    const original = nativeFs[method];
    nativeFs[method] = function(...args) {
      for (const file of args.slice(0, method === 'renameSync' ? 2 : 1)) {
        if (typeof file === 'string' && normalize(file).startsWith(directory + nativePath.sep)) state.writes.push(nativePath.basename(file));
      }
      return original.apply(this, args);
    };
  }
  const originalNet = net.fetch;
  net.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    if (!/^https?:$/.test(url.protocol)) return originalNet.call(net, input, options);
    if (url.origin !== 'https://clist.by' || url.pathname !== '/api/v4/problem/' || !state.mock) {
      state.unexpected.push(url.origin + url.pathname); throw new Error('External network forbidden by local bulk fixture');
    }
    const headers = new Headers(options.headers);
    const expectedAuth = `ApiKey ${state.mock.username}:${state.mock.apiKey}`;
    const request = { resource: url.searchParams.get('resource'), offset: Number(url.searchParams.get('offset')), params: Object.fromEntries(url.searchParams), method: options.method, redirect: options.redirect, credentials: options.credentials,
      headerNames: [...headers.keys()].sort(), accept: headers.get('accept'), authMatches: headers.get('authorization') === expectedAuth, signal: options.signal instanceof AbortSignal, bypass: options.bypassCustomProtocolHandlers, at: Date.now() };
    // Never record authorization values, even when an assertion later fails.
    state.requests.push(request);
    if (request.resource === 'codeforces.com' && request.offset === 0 && state.gateFirst) {
      state.gated = true;
      await new Promise(resolve => { state.release = resolve; });
      state.gated = false;
    }
    const ids = request.resource === 'codeforces.com' ? request.offset === 0 ? Array.from({ length: 1000 }, (_, index) => index + 1) : request.offset === 1000 ? [1001] : null : request.offset === 0 ? [] : null;
    if (!ids) throw new Error('Unexpected synthetic pagination offset');
    const objects = ids.map(id => ({ id, rating: 1300 + id % 700, resource: 'codeforces.com', url: `https://codeforces.com/contest/9999/problem/A${id}`, archive_url: `https://codeforces.com/problemset/problem/9999/A${id}` }));
    return new Response(JSON.stringify({ objects, meta: { total_count: request.resource === 'codeforces.com' ? 1001 : 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  globalThis.fetch = async input => { const url = new URL(String(input)); state.node.push(url.origin + url.pathname); throw new Error('Node network forbidden'); };
  const blockTransport = (transport, input) => {
    const value = typeof input === 'string' || input instanceof URL ? String(input) : input?.url || `${input?.protocol || 'https:'}//${input?.hostname || input?.host || 'unknown'}${input?.path || '/'}`;
    const url = new URL(value); state.node.push(`${transport}:${url.origin}${url.pathname}`); throw new Error('Unmocked native network forbidden');
  };
  net.request = input => blockTransport('electron.net.request', input);
  for (const name of ['node:http', 'node:https']) {
    const transport = require(name);
    transport.request = input => blockTransport(name + '.request', input);
    transport.get = input => blockTransport(name + '.get', input);
  }
  app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const blocked = /^https?:/.test(details.url);
      if (blocked) { const url = new URL(details.url); state.chromium.push(url.origin + url.pathname); }
      callback({ cancel: blocked });
    });
  });
  const updater = require(nativePath.join(root, 'electron', 'updater.cjs'));
  const create = updater.createUpdater;
  updater.createUpdater = options => {
    const instance = create(options);
    return { ...instance, check: async () => { state.updaterChecks += 1; return instance.getState(); } };
  };
}
async function invoke(page, method, ...args) { return page.evaluate(({ method, args }) => window.notebook[method](...args), { method, args }); }
async function launch(fixture, isolated) {
  const bootstrap = path.join(fixture.directory, 'electron-transport-bootstrap.cjs');
  fs.writeFileSync(bootstrap, `(${installBootstrap.toString()})(${JSON.stringify(ROOT)}, ${JSON.stringify(fixture.directory)});\nrequire('electron').app.setAppPath(${JSON.stringify(ROOT)});\nrequire(${JSON.stringify(appPath('electron/main.cjs'))});\n`);
  const env = { ...process.env, QMX_USER_DATA_DIR: fixture.directory };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.QMX_ISOLATED_SANDBOX;
  if (isolated) env.QMX_ISOLATED_SANDBOX = '1';
  const app = await electron.launch({ executablePath: require('electron'), args: [bootstrap, '--disable-gpu', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'], env, timeout: 30000 });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(names => names.every(name => typeof window.notebook?.[name] === 'function'), BULK_METHODS, { timeout: 30000 });
    await page.locator('.daily-problem').waitFor({ state: 'visible', timeout: 30000 });
    const runtime = await app.evaluate(({ app, BrowserWindow, safeStorage }) => ({ root: app.getAppPath(), profile: app.getPath('userData'), isolated: process.env.QMX_ISOLATED_SANDBOX ?? null, safeStorage: safeStorage.isEncryptionAvailable(), preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(), bootstrap: !!globalThis.__bulkE2E }));
    assert.equal(path.resolve(runtime.root), ROOT); assert.equal(path.resolve(runtime.profile), fixture.directory);
    assert.equal(runtime.bootstrap, true); assert.equal(runtime.isolated, isolated ? '1' : null);
    assert.equal(runtime.preferences.sandbox, true); assert.equal(runtime.preferences.contextIsolation, true); assert.equal(runtime.preferences.nodeIntegration, false);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined'); assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    return { app, page, runtime };
  } catch (error) { await app.close(); throw error; }
}
async function evidence(app) {
  const result = await app.evaluate(() => { const { requests, unexpected, node, chromium, reads, writes, updaterChecks } = globalThis.__bulkE2E; return { requests, unexpected, node, chromium, reads, writes, updaterChecks }; });
  assert.deepEqual(result.unexpected, []); assert.deepEqual(result.node, []); assert.deepEqual(result.chromium, []);
  return result;
}
async function localCatalog(app, page) {
  const result = await invoke(page, 'getDailyTagCatalog');
  assert.equal(result.total, 6);
  assert.deepEqual(Object.fromEntries(Object.entries(result.platforms).map(([key, value]) => [key, value.count])), { AT: 1, CF: 1, LC: 1, LG: 1, LOJ: 1, NC: 1 });
  const reads = await app.evaluate(() => globalThis.__bulkE2E.reads);
  assert.deepEqual([...new Set(reads)].sort(), ['at.ndjson', 'cf.ndjson', 'lc.ndjson', 'lg.ndjson', 'loj.ndjson', 'nc.ndjson']);
}
async function openSettings(page) {
  if (!(await page.locator('#settings-dialog').isVisible())) { await page.locator('.sidebar').hover(); await page.locator('#settings-button').click(); }
  await page.locator('#clist-shared-cache-panel .clist-shared-cache-summary').waitFor({ state: 'visible' });
}
async function choose(app, kind, file) {
  await app.evaluate(({ dialog, BrowserWindow }, choice) => {
    globalThis.__bulkE2E.choice = choice;
    dialog.showSaveDialog = async parent => { if (parent !== BrowserWindow.getAllWindows()[0]) throw new Error('Untrusted save dialog'); return { canceled: false, filePath: globalThis.__bulkE2E.choice.file }; };
    dialog.showOpenDialog = async parent => { if (parent !== BrowserWindow.getAllWindows()[0]) throw new Error('Untrusted open dialog'); return { canceled: false, filePaths: [globalThis.__bulkE2E.choice.file] }; };
  }, { kind, file });
}
function assertRequests(requests) {
  for (const request of requests) {
    assert.deepEqual(request.params, { resource: request.resource, rating__gt: '0', offset: String(request.offset), limit: '1000', order_by: 'id', total_count: 'true' });
    assert.equal(request.method, 'GET'); assert.equal(request.redirect, 'error'); assert.equal(request.credentials, 'omit');
    assert.deepEqual(request.headerNames, ['accept', 'authorization']); assert.equal(request.accept, 'application/json'); assert.equal(request.authMatches, true); assert.equal(request.signal, true); assert.equal(request.bypass, true);
  }
}
function privateFree(value) { assert.doesNotMatch(typeof value === 'string' ? value : JSON.stringify(value), /synthetic_bulk_e2e_account|synthetic-bulk-e2e-key|PRIVATE_LOCAL|PRIVATE_SOURCE|authorization|apiKey|encrypted/i); }

async function startupPreservation() {
  const results = [];
  for (const kind of ['bad-cache-json', 'bad-source-and-marker']) {
    const fixture = profile(`production-${kind}`, { schema: 1, ratings: { [URLS.CF]: rating('codeforces.com', 999, NEW_DATE) }, localRoot: { owner: 'PRIVATE_LOCAL_STARTUP', preserve: [null, false] } });
    // Malformed bytes deliberately contain private sentinels so raw JSON parser
    // errors cannot pass as the user-facing, sanitized CLIST cache failure.
    const damaged = label => Buffer.from(`{ "PRIVATE_${label}": "${USER}", "apiKey": "${KEY}", broken-json\r\n`, 'utf8');
    if (kind === 'bad-cache-json') fs.writeFileSync(fixture.cacheFile, damaged('LOCAL_STARTUP'));
    else {
      fs.writeFileSync(fixture.source, damaged('SOURCE_STARTUP'));
      // A broken marker alone is recoverable; invalid source metadata must stop
      // that recovery before either the personal cache or marker is replaced.
      fs.writeFileSync(fixture.marker, damaged('MARKER_STARTUP'));
    }
    const files = [fixture.cacheFile, fixture.source, fixture.marker];
    const before = new Map(files.map(file => [file, fs.existsSync(file) ? fs.readFileSync(file) : null]));
    function preserved() {
      for (const [file, bytes] of before) {
        if (bytes === null) assert.equal(fs.existsSync(file), false, `Startup created ${path.basename(file)} after failure`);
        else assert.deepEqual(fs.readFileSync(file), bytes, `Startup overwrote ${path.basename(file)} after failure`);
      }
      unchanged(fixture);
    }
    let app;
    try {
      const launched = await launch(fixture, false);
      app = launched.app;
      const { page, runtime } = launched;
      const bootstrap = await invoke(page, 'bootstrap');
      assert.equal(bootstrap.appVersion, EXPECTED_VERSION); privateFree(bootstrap);
      await openSettings(page);
      assert.equal(await page.locator('#settings-dialog').isVisible(), true);
      assert.equal(await page.locator('.daily-problem').isVisible(), true);
      const error = page.locator('#clist-shared-cache-panel .clist-shared-cache-error');
      await error.waitFor({ state: 'visible', timeout: 10000 });
      const errorText = await error.innerText();
      assert.match(errorText, /不是有效的 CLIST 评分缓存/); privateFree(errorText);
      assert.doesNotMatch(errorText, /SyntaxError|Unexpected token|JSON\.parse|broken-json|PRIVATE_|[A-Z]:\\/i);
      assert.ok(!errorText.includes(fixture.directory), 'Cache failure exposed the private profile path');
      await assert.rejects(() => invoke(page, 'getClistSharedCacheStatus'), error => {
        assert.match(error.message, /不是有效的 CLIST 评分缓存/); privateFree(error.message);
        assert.doesNotMatch(error.message, /SyntaxError|Unexpected token|broken-json|PRIVATE_/i);
        return true;
      });
      preserved();
      const transport = await evidence(app);
      assert.equal(transport.requests.length, 0); assert.ok(transport.updaterChecks >= 1);
      assert.deepEqual(transport.writes.filter(name => /^clist-(?:rating-cache|shared-source|initial-cache-state)\.json/.test(name)), [], 'Failed startup must not stage or write CLIST files');
      await app.close(); app = undefined;
      preserved();
      results.push({ scenario: kind, appVersion: bootstrap.appVersion, noEnvSkip: runtime.isolated, dailyVisible: true, settingsOpened: true, safeError: errorText, preservedFiles: [...before].filter(([, bytes]) => bytes !== null).map(([file]) => path.basename(file)), clistWrites: 0, externalRequests: 0, updaterChecks: transport.updaterChecks });
    } finally { if (app) await app.close(); }
  }
  return results;
}

(async () => {
  const startup = await startupPreservation();
  if (STARTUP_ONLY) {
    console.log('PASS CLIST production startup preservation: bad cache JSON and bad source/initial marker; daily/settings visible, safe status rejection, original bytes unchanged, no env skip, zero external transport');
    console.log(JSON.stringify({ syntheticTestFixture: true, appVersion: EXPECTED_VERSION, startup }));
    return;
  }
  const initialBytes = fs.readFileSync(INITIAL), baseline = JSON.parse(initialBytes);
  assert.equal(Object.keys(baseline.ratings).length, 37200); assert.ok(baseline.ratings[URLS.CF]);
  assert.ok(Date.parse(NEW_DATE) <= Date.now());
  const baselineCounts = {};
  for (const row of Object.values(baseline.ratings)) baselineCounts[row.resource] = (baselineCounts[row.resource] ?? 0) + 1;
  assert.equal(baselineCounts['loj.ac'] ?? 0, 0);
  const clean = profile('production-fresh');
  const personalOnly = 'https://loj.ac/p/999999';
  assert.equal(baseline.ratings[personalOnly], undefined);
  const seeded = profile('production-personal', { schema: 1, ratings: { [URLS.CF]: rating('codeforces.com', 999, NEW_DATE), [personalOnly]: rating('loj.ac', 1444, NEW_DATE) }, localRoot: { owner: 'PRIVATE_LOCAL_PRODUCTION', preserve: [null, false] } });
  const bulk = profile('isolated-pages', { schema: 1, ratings: { [URLS.CF]: rating('codeforces.com', 377), [URLS.LOJ]: rating('loj.ac', 1555) }, localRoot: { owner: 'PRIVATE_LOCAL_BULK', preserve: [null, false] } });
  fs.writeFileSync(bulk.source, json(SOURCE));
  const exportFile = path.join(bulk.directory, 'shared-export.json'), rawFile = path.join(bulk.directory, 'shared-raw.json');
  let app, page, runtime;
  const report = { syntheticTestFixture: true, startup, phaseA: {}, phaseB: {}, network: [] };
  try {
    // Phase A: ordinary production setup; no QMX_ISOLATED_SANDBOX seed bypass.
    ({ app, page, runtime } = await launch(clean, false));
    assert.equal((await invoke(page, 'getClistStatus')).configured, false);
    const fresh = await invoke(page, 'getClistSharedCacheStatus');
    assert.equal(fresh.total, 37200); assert.equal(fresh.initialTotal, 37200); assert.ok(fresh.initialAppliedAt);
    assert.deepEqual(fresh.platforms, baselineCounts);
    assert.deepEqual(JSON.parse(fs.readFileSync(clean.cacheFile)).ratings[URLS.CF], baseline.ratings[URLS.CF]);
    const marker = JSON.parse(fs.readFileSync(clean.marker));
    assert.equal(marker.sha256, crypto.createHash('sha256').update(initialBytes).digest('hex'));
    await localCatalog(app, page);
    const native = await invoke(page, 'dailyDraw', { source: 'all', platform: 'CF', ratingMin: 1200, ratingMax: 1200 });
    assert.equal(native.diagnostics.dataMode, 'index'); assert.equal(native.problem.rating, 1200); assert.equal(native.problem.clistRating, baseline.ratings[URLS.CF].rating); assert.equal(native.problem.clistRatingCached, true);
    const loj = await invoke(page, 'dailyDraw', { source: 'all', platform: 'LOJ' });
    assert.equal(loj.diagnostics.dataMode, 'index'); assert.equal(loj.problem.clistRating, null); assert.equal(loj.problem.estimatedCfRating, null);
    const sourceCoverage = await invoke(page, 'getDifficultyBackfillStatus');
    for (const [platform, url] of Object.entries(URLS)) {
      const expectedCached = baseline.ratings[url] ? 1 : 0;
      assert.equal(sourceCoverage.platforms[platform].total, 1); assert.equal(sourceCoverage.platforms[platform].clistCached, expectedCached); assert.equal(sourceCoverage.platforms[platform].clistPending, 1 - expectedCached);
    }
    assert.equal(sourceCoverage.platforms.LOJ.clistCached, 0); assert.equal(sourceCoverage.platforms.LOJ.missing, 1);
    await openSettings(page);
    assert.equal(await page.locator('#difficulty-backfill-panel').count(), 0, 'New bulk bridge should replace the legacy per-item controls');
    const sharedText = await page.locator('#clist-shared-cache-panel').innerText();
    assert.match(sharedText, /37,200/); assert.match(sharedText, /不等于本地题库匹配/); assert.match(sharedText, /LibreOJ/);
    assert.match(await page.locator('#clist-shared-cache-panel [data-platform="LOJ"]').innerText(), /0 题/);
    assert.equal(await page.locator('#clist-shared-cache-panel input[type=password]').count(), 0);
    await assert.rejects(() => invoke(page, 'startClistBulkSync'), /配置 CLIST|API Key/);
    assert.equal((await invoke(page, 'getClistBulkStatus')).status, 'idle');
    unchanged(clean); const firstEvidence = await evidence(app); assert.equal(firstEvidence.requests.length, 0); assert.ok(firstEvidence.updaterChecks >= 1);
    report.phaseA = { root: runtime.root, noEnvSkip: runtime.isolated, total: fresh.total, initialTotal: fresh.initialTotal, baselineCounts, baselineCF: baseline.ratings[URLS.CF], nativeCF: native.problem.rating, localProblems: 6, localLojHasNoRating: loj.problem.clistRating === null };
    report.network.push(firstEvidence);
    await app.close(); app = undefined;

    ({ app, page } = await launch(seeded, false));
    const personalStatus = await invoke(page, 'getClistSharedCacheStatus'); assert.equal(personalStatus.initialTotal, 37200); assert.equal(personalStatus.total, 37201);
    const merged = JSON.parse(fs.readFileSync(seeded.cacheFile));
    assert.equal(merged.ratings[URLS.CF].rating, 999); assert.equal(merged.ratings[URLS.CF].queriedAt, NEW_DATE); assert.equal(merged.ratings[personalOnly].rating, 1444); assert.deepEqual(merged.localRoot, { owner: 'PRIVATE_LOCAL_PRODUCTION', preserve: [null, false] });
    assert.equal((await invoke(page, 'dailyDraw', { source: 'all', platform: 'CF' })).problem.rating, 1200);
    unchanged(seeded); report.network.push(await evidence(app));
    await app.close(); app = undefined;
    const unchangedCache = fs.readFileSync(seeded.cacheFile), unchangedMarker = fs.readFileSync(seeded.marker);
    ({ app, page } = await launch(seeded, false));
    assert.equal((await invoke(page, 'getClistSharedCacheStatus')).total, 37201);
    assert.deepEqual(fs.readFileSync(seeded.cacheFile), unchangedCache); assert.deepEqual(fs.readFileSync(seeded.marker), unchangedMarker);
    const restartEvidence = await evidence(app);
    assert.deepEqual(restartEvidence.writes.filter(name => /^clist-(?:rating-cache|initial-cache-state)\.json/.test(name)), [], 'Restart must not rewrite matching cache/marker, including temporary files');
    assert.equal(restartEvidence.requests.length, 0); unchanged(seeded); report.network.push(restartEvidence);
    await app.close(); app = undefined;

    // Phase B: isolated tiny shards; exercise the real rate-limited service with
    // 1000 + 1 mocked CF rows, a held first transport, and five empty resources.
    ({ app, page, runtime } = await launch(bulk, true));
    assert.equal(runtime.safeStorage, true, 'OS safeStorage required for synthetic credentials');
    assert.equal(fs.existsSync(bulk.marker), false); assert.equal((await invoke(page, 'getClistSharedCacheStatus')).total, 2);
    await localCatalog(app, page);
    const rejectedSenders = await app.evaluate(async ({ BrowserWindow }, { preload, methods }) => {
      const other = new BrowserWindow({ show: false, webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false } });
      try { await other.loadURL('data:text/html,<title>Untrusted bulk sender</title>'); return await other.webContents.executeJavaScript(`Promise.all(${JSON.stringify(methods)}.map(method => window.notebook[method]().then(() => 'UNEXPECTED_SUCCESS', error => error.message)))`); }
      finally { other.destroy(); }
    }, { preload: appPath('electron/preload.cjs'), methods: BULK_METHODS });
    for (const message of rejectedSenders) assert.match(message, /非法调用/);
    await invoke(page, 'saveClistCredentials', { username: USER, apiKey: KEY });
    const authBytes = fs.readFileSync(path.join(bulk.directory, 'clist-auth.json'), 'utf8');
    assert.ok(JSON.parse(authBytes).encrypted.length > 20); assert.ok(!authBytes.includes(USER) && !authBytes.includes(KEY));
    privateFree(await invoke(page, 'bootstrap')); privateFree(await invoke(page, 'getClistBulkStatus'));
    await app.evaluate((_, mock) => { globalThis.__bulkE2E.mock = mock; globalThis.__bulkE2E.gateFirst = true; }, { username: USER, apiKey: KEY });
    await page.evaluate(() => { globalThis.__bulkPending = window.notebook.startClistBulkSync(); });
    await app.evaluate(async () => { for (let i = 0; i < 1000 && !globalThis.__bulkE2E.gated; i++) await new Promise(resolve => setTimeout(resolve, 5)); if (!globalThis.__bulkE2E.gated) throw new Error('First page did not reach held transport'); });
    const beforePause = await invoke(page, 'getClistBulkStatus'); assert.equal(beforePause.running, true); assert.equal(beforePause.resources['codeforces.com'].offset, 0);
    const pausedRequest = await invoke(page, 'pauseClistBulkSync'); assert.equal(pausedRequest.pauseRequested, true); assert.equal(pausedRequest.running, true);
    assert.equal(Object.keys(JSON.parse(fs.readFileSync(bulk.cacheFile)).ratings).length, 2, 'Held page must not merge before transport resolves');
    await app.evaluate(() => { globalThis.__bulkE2E.release(); });
    const paused = await page.evaluate(() => globalThis.__bulkPending);
    assert.equal(paused.status, 'paused'); assert.equal(paused.running, false); assert.equal(paused.resources['codeforces.com'].offset, 1000); assert.equal(paused.resources['codeforces.com'].total, 1001); assert.equal(paused.resources['codeforces.com'].imported, 1000);
    assert.equal(Object.keys(JSON.parse(fs.readFileSync(bulk.cacheFile)).ratings).length, 1002);
    const firstPageEvidence = await evidence(app); assertRequests(firstPageEvidence.requests); assert.equal(firstPageEvidence.requests.length, 1); unchanged(bulk, true); report.network.push(firstPageEvidence);
    await app.close(); app = undefined;
    const pausedCache = fs.readFileSync(bulk.cacheFile), pausedProgress = fs.readFileSync(bulk.progress), sourceBytes = fs.readFileSync(bulk.source);

    ({ app, page } = await launch(bulk, true));
    assert.equal((await invoke(page, 'getClistStatus')).configured, true);
    const restored = await invoke(page, 'getClistBulkStatus'); assert.equal(restored.status, 'paused'); assert.equal(restored.resources['codeforces.com'].offset, 1000);
    assert.deepEqual(fs.readFileSync(bulk.cacheFile), pausedCache); assert.deepEqual(fs.readFileSync(bulk.progress), pausedProgress);
    assert.equal((await evidence(app)).requests.length, 0);
    await app.evaluate((_, mock) => { globalThis.__bulkE2E.mock = mock; }, { username: USER, apiKey: KEY });
    const done = await invoke(page, 'startClistBulkSync');
    assert.equal(done.status, 'done'); assert.equal(done.running, false);
    assert.equal(done.resources['codeforces.com'].offset, 1001); assert.equal(done.resources['codeforces.com'].total, 1001); assert.equal(done.resources['codeforces.com'].pages, 2); assert.equal(done.resources['codeforces.com'].imported, 1001);
    for (const resource of RESOURCES.slice(1)) assert.deepEqual(done.resources[resource], { offset: 0, total: 0, pages: 1, status: 'done', imported: 0, ignored: 0 });
    const resumedEvidence = await evidence(app); assertRequests(resumedEvidence.requests);
    assert.deepEqual(resumedEvidence.requests.map(row => [row.resource, row.offset]), RESOURCES.map(resource => [resource, resource === 'codeforces.com' ? 1000 : 0]));
    const intervals = resumedEvidence.requests.slice(1).map((row, index) => row.at - resumedEvidence.requests[index].at);
    assert.ok(intervals.every(ms => ms >= 5900), `Six-second limiter bypassed: ${intervals}`);
    const result = JSON.parse(fs.readFileSync(bulk.cacheFile));
    assert.equal(Object.keys(result.ratings).length, 1003); assert.equal(result.ratings[URLS.CF].rating, 377); assert.equal(result.ratings[URLS.LOJ].rating, 1555); assert.deepEqual(result.localRoot, { owner: 'PRIVATE_LOCAL_BULK', preserve: [null, false] });
    for (let id = 1; id <= 1001; id++) { assert.equal(result.ratings[bulkUrl(id)].rating, 1300 + id % 700); assert.equal(result.ratings[bulkUrl(id)].resource, 'codeforces.com'); assert.ok(Number.isFinite(Date.parse(result.ratings[bulkUrl(id)].queriedAt))); }
    assert.deepEqual(fs.readFileSync(bulk.source), sourceBytes, 'Bulk merge replaced shared-source metadata');
    const cachedNative = await invoke(page, 'dailyDraw', { source: 'all', platform: 'CF', ratingMin: 1200, ratingMax: 1200 });
    assert.equal(cachedNative.problem.rating, 1200); assert.equal(cachedNative.problem.clistRating, 377); assert.equal(cachedNative.problem.clistRatingCached, true);
    assert.equal((await invoke(page, 'getProblemEnrichment', URLS.CF)).problem.rating, 1200);
    assert.equal((await evidence(app)).requests.length, 6, 'Drawing/status must not fall back to CLIST random/exact API');
    await openSettings(page);
    await page.waitForFunction(() => document.querySelector('#clist-bulk-panel .clist-bulk-resources')?.textContent?.includes('1,001'));
    assert.match(await page.locator('#clist-bulk-panel .clist-bulk-resources').innerText(), /1,001/);
    assert.equal(await page.locator('#clist-bulk-panel input[type=password]').count(), 0);
    await choose(app, 'save', exportFile); await invoke(page, 'exportClistSharedCache');
    const exportedText = fs.readFileSync(exportFile, 'utf8'), exported = JSON.parse(exportedText);
    assert.deepEqual(Object.keys(exported).sort(), ['exportedAt', 'kind', 'ratings', 'schema']); assert.equal(exported.kind, 'qmx-clist-rating-cache'); assert.equal(Object.keys(exported.ratings).length, 1003); privateFree(exportedText);
    const raw = { schema: 1, ratings: exported.ratings }; fs.writeFileSync(rawFile, json(raw));
    const beforeImport = fs.readFileSync(bulk.cacheFile);
    await choose(app, 'open', rawFile); const imported = await invoke(page, 'importClistSharedCache');
    assert.deepEqual({ imported: imported.imported, updated: imported.updated, kept: imported.kept, ignored: imported.ignored }, { imported: 0, updated: 0, kept: 1003, ignored: 0 });
    assert.deepEqual(fs.readFileSync(bulk.cacheFile), beforeImport);
    fs.writeFileSync(rawFile, json({ ...raw, ratings: { ...raw.ratings, [bulkUrl(1)]: rating('atcoder.jp', 999) } }));
    await choose(app, 'open', rawFile); await assert.rejects(() => invoke(page, 'importClistSharedCache'), /CLIST/);
    assert.deepEqual(fs.readFileSync(bulk.cacheFile), beforeImport); assert.deepEqual(fs.readFileSync(bulk.source), sourceBytes);
    for (const invalid of ['null\n', '{broken local fixture\n', { schema: 2, ratings: exported.ratings }, { schema: 1, kind: 'public-difficulty', ratings: exported.ratings }]) {
      fs.writeFileSync(rawFile, typeof invalid === 'string' ? invalid : json(invalid));
      await choose(app, 'open', rawFile); await assert.rejects(() => invoke(page, 'importClistSharedCache'), /CLIST/);
      assert.deepEqual(fs.readFileSync(bulk.cacheFile), beforeImport); assert.deepEqual(fs.readFileSync(bulk.source), sourceBytes);
    }
    privateFree(done); privateFree(imported); unchanged(bulk, true);
    const finalEvidence = await evidence(app); assert.equal(finalEvidence.requests.length, 6); report.network.push(finalEvidence);
    report.phaseB = { sandbox: runtime.preferences.sandbox, contextIsolation: runtime.preferences.contextIsolation, nodeIntegration: runtime.preferences.nodeIntegration, safeStorage: runtime.safeStorage, wrongSenderRejected: rejectedSenders.length, paused: paused.resources['codeforces.com'], done: done.resources, importedScores: 1001, queriedRows: 1001, requestCount: 7, resumeIntervalsMs: intervals, cacheTotalWithPersonal: 1003, rawImport: { imported: imported.imported, kept: imported.kept }, externalRequests: 0 };
    console.log('PASS CLIST bulk real Electron two phases: production no-env-skip 37200 baseline/native CF1200/newer personal999/marker restart; isolated safeStorage, 1000+1 real-service pages, held-transport pause/restart offset1000, six-second limiter, six immutable shards, strict raw import/private-free export, native priority, three sender guards, zero external transport');
    console.log(JSON.stringify(report));
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
