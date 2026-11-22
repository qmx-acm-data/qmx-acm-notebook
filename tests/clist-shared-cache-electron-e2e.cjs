'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const { appPath } = require('./app-path.cjs');

// Real Electron main/preload/IPC and native profile files. Every score and HTTPS
// response is a local SYNTHETIC fixture, not a fetched/verified CLIST rating.
// No upload, real CLIST credential, provider request or public hosting is used.
const DATES = ['2026-01-01T01:02:03.000Z', '2026-02-01T01:02:03.000Z', '2026-03-01T01:02:03.000Z'];
const URLS = {
  CF: 'https://codeforces.com/problemset/problem/1999/A',
  AT: 'https://atcoder.jp/contests/abc999/tasks/abc999_a',
  LG: 'https://www.luogu.com.cn/problem/P1000',
  NC: 'https://ac.nowcoder.com/acm/problem/328351',
  LC: 'https://leetcode.com/problems/two-sum/',
  LOJ: 'https://loj.ac/p/1000'
};
const RESOURCES = { CF: 'codeforces.com', AT: 'atcoder.jp', LG: 'luogu.com.cn', NC: 'ac.nowcoder.com', LC: 'leetcode.com', LOJ: 'loj.ac' };
const SHARED_URL = 'https://cache.example.test/clist.json?version=2&download=1';
const IPC_NAMES = ['getClistSharedCacheStatus', 'exportClistSharedCache', 'importClistSharedCache', 'syncClistSharedCache'];
const OLD_IPC = ['getPublicDifficultyStatus', 'importPublicDifficultyTemplate', 'refreshAllPublicDifficulties'];
const row = (platform, rating, queriedAt = DATES[1]) => ({ rating, resource: RESOURCES[platform], queriedAt });
const document = ratings => ({ schema: 1, kind: 'qmx-clist-rating-cache', exportedAt: DATES[2], ratings });
const json = value => JSON.stringify(value, null, 2) + '\n';
function seedProfile(name, ratings) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `qmx-clist-shared-${name}-`));
  fs.writeFileSync(path.join(profile, 'settings.json'), json({ autoSync: false }));
  fs.writeFileSync(path.join(profile, 'contests.json'), json({ schema: 1, platforms: ['luogu', 'codeforces', 'atcoder', 'nowcoder'].map(id => ({ id, contests: [], updatedAt: new Date().toISOString() })) }));
  fs.mkdirSync(path.join(profile, 'library'));
  const originals = new Map();
  for (const platform of Object.keys(URLS)) {
    const problem = { id: `${platform}:synthetic-shared-cache`, platform, title: `SYNTHETIC shared ${platform} fixture`, url: URLS[platform], tags: [], rating: null, officialTags: [], officialDifficulty: null };
    if (platform === 'CF') Object.assign(problem, { rating: 1200, tags: ['dp'], officialTags: ['dp'], officialDifficulty: '1200' });
    if (platform === 'LC') Object.assign(problem, { tags: ['数组'], officialTags: ['数组'], officialDifficulty: 'Easy' });
    const file = path.join(profile, 'library', platform.toLowerCase() + '.ndjson');
    fs.writeFileSync(file, json(problem).replace(/\n\s*/g, '') + '\n');
    originals.set(file, fs.readFileSync(file));
  }
  const meta = path.join(profile, 'library', 'meta.json');
  fs.writeFileSync(meta, json({ schema: 1, builtAt: DATES[0] }));
  originals.set(meta, fs.readFileSync(meta));
  const supplements = path.join(profile, 'problem-enrichments.json');
  fs.writeFileSync(supplements, json({ schema: 1, records: { [URLS.LOJ]: { url: URLS.LOJ, revision: 1, source: 'manual', status: 'approved', updatedAt: DATES[0], tags: ['最短路'], cfRating: 1500, reason: 'PRIVATE_UNRELATED_MANUAL_SUPPLEMENT' } }, suggestions: {}, opaque: { keep: name } }));
  originals.set(supplements, fs.readFileSync(supplements));
  const ledger = path.join(profile, 'difficulty-backfill-ledger.json');
  fs.writeFileSync(ledger, json({ schema: 1, attempts: { [URLS.LOJ]: { at: DATES[0], result: 'none', reason: 'not-found' } }, privateLedger: 'PRIVATE_LEDGER_SENTINEL' }));
  originals.set(ledger, fs.readFileSync(ledger));
  const cacheFile = path.join(profile, 'clist-rating-cache.json');
  if (ratings) fs.writeFileSync(cacheFile, json({ schema: 1, ratings, localRoot: { owner: `PRIVATE_LOCAL_${name}`, arbitrary: [false, null, { keep: true }] }, apiKey: 'PRIVATE_ROOT_KEY_SENTINEL', metadata: { private: true } }));
  return { profile, originals, cacheFile, sourceFile: path.join(profile, 'clist-shared-source.json') };
}
function assertUnchanged(fixture) {
  for (const [file, bytes] of fixture.originals) assert.deepEqual(fs.readFileSync(file), bytes, `Unrelated local bytes changed: ${path.basename(file)}`);
  for (const name of ['auth.json', 'clist-auth.json', 'ai-auth.json']) assert.equal(fs.existsSync(path.join(fixture.profile, name)), false, 'Sharing must never create credential files: ' + name);
}
function exported(file, expectedTotal) {
  const text = fs.readFileSync(file, 'utf8'), result = JSON.parse(text);
  assert.deepEqual(Object.keys(result).sort(), ['exportedAt', 'kind', 'ratings', 'schema']);
  assert.equal(result.schema, 1); assert.equal(result.kind, 'qmx-clist-rating-cache');
  assert.equal(new Date(result.exportedAt).toISOString(), result.exportedAt);
  assert.ok(Date.parse(result.exportedAt) <= Date.now() + 300000);
  assert.equal(Object.keys(result.ratings).length, expectedTotal);
  for (const [url, value] of Object.entries(result.ratings)) {
    assert.ok(Object.values(URLS).includes(url));
    assert.deepEqual(Object.keys(value).sort(), ['queriedAt', 'rating', 'resource']);
    assert.ok(value.rating > 0);
  }
  assert.doesNotMatch(text, /PRIVATE_|IMPORT_ROOT|REMOTE_ROOT|apiKey|ledger|supplement|metadata|username|authorization/i);
  return result;
}
async function invoke(page, method, ...args) {
  return page.evaluate(({ method, args }) => window.notebook[method](...args), { method, args });
}
async function choose(app, kind, file, canceled = false) {
  await app.evaluate((_, choice) => { globalThis.__sharedE2E.choice = choice; }, { kind, file, canceled });
}
async function launch(fixture) {
  const env = { ...process.env, QMX_USER_DATA_DIR: fixture.profile, QMX_ISOLATED_SANDBOX: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: require('electron'), args: [appPath(''), '--disable-gpu', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'], env, timeout: 30000 });
  try {
    await app.evaluate(({ app, net, session, dialog, BrowserWindow }) => {
      const load = process.mainModule.require.bind(process.mainModule);
      const nativeFs = load('node:fs'), nativePath = load('node:path');
      globalThis.__sharedE2E = { calls: [], forbidden: [], dialogs: [], reads: [], repo: [], choice: null, remote: null };
      const state = globalThis.__sharedE2E;
      const originalRead = nativeFs.readFileSync;
      nativeFs.readFileSync = function(file, ...args) {
        const resolved = nativePath.resolve(String(file));
        if (resolved.startsWith(nativePath.join(app.getPath('userData'), 'library') + nativePath.sep) && resolved.endsWith('.ndjson')) state.reads.push(nativePath.basename(resolved));
        return originalRead.call(this, file, ...args);
      };
      for (const [name, kind] of [['showSaveDialog', 'save'], ['showOpenDialog', 'open']]) {
        dialog[name] = async (parent, options) => {
          state.dialogs.push({ kind, parentTrusted: parent === BrowserWindow.getAllWindows()[0], options });
          const choice = state.choice; state.choice = null;
          if (!choice || choice.kind !== kind) throw new Error('Missing locally trusted native dialog fixture');
          return kind === 'save' ? { canceled: choice.canceled, filePath: choice.file } : { canceled: choice.canceled, filePaths: choice.canceled ? [] : [choice.file] };
        };
      }
      const originalNet = net.fetch;
      net.fetch = async (input, options = {}) => {
        const url = String(input);
        if (!/^https?:/.test(url)) return originalNet.call(net, input, options);
        const headers = Object.fromEntries(new Headers(options.headers).entries());
        state.calls.push({ url, method: options.method, redirect: options.redirect, credentials: options.credentials, headers, bypassCustomProtocolHandlers: options.bypassCustomProtocolHandlers, signal: options.signal instanceof AbortSignal });
        const remote = state.remote;
        if (!remote || remote.url !== url) { state.forbidden.push(url); throw new Error('External network forbidden'); }
        return new Response(remote.body, { status: remote.status, headers: { 'content-type': 'application/json' } });
      };
      globalThis.fetch = async input => { state.forbidden.push(String(input)); throw new Error('Node network forbidden'); };
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const blocked = /^https?:/.test(details.url);
        if (blocked) state.forbidden.push(details.url);
        callback({ cancel: blocked });
      });
      const { GitHub } = load(nativePath.join(app.getAppPath(), 'electron/github.cjs'));
      GitHub.prototype.sync = async function() { state.repo.push({ method: 'sync', token: this.token || '', repo: this.repo }); return { records: [], issues: [], blobs: {}, lastSync: new Date().toISOString() }; };
      GitHub.prototype.getTagCatalog = async function() { state.repo.push({ method: 'getTagCatalog', token: this.token || '' }); return { schema: 1, tags: [] }; };
    });
    const page = await app.firstWindow();
    await page.waitForFunction(names => names.every(name => typeof window.notebook?.[name] === 'function'), IPC_NAMES, { timeout: 30000 });
    await page.locator('.daily-problem').waitFor({ state: 'visible', timeout: 30000 });
    const runtime = await app.evaluate(({ app, BrowserWindow }) => ({ root: app.getAppPath(), profile: app.getPath('userData'), preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences() }));
    assert.equal(path.resolve(runtime.root), appPath('')); assert.equal(path.resolve(runtime.profile), fixture.profile);
    assert.equal(runtime.preferences.sandbox, true); assert.equal(runtime.preferences.contextIsolation, true); assert.equal(runtime.preferences.nodeIntegration, false);
    assert.deepEqual(await page.evaluate(names => names.map(name => typeof window.notebook[name]), OLD_IPC), ['undefined', 'undefined', 'undefined']);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    assert.equal((await invoke(page, 'getClistStatus')).configured, false);
    const catalog = await invoke(page, 'getDailyTagCatalog');
    assert.equal(catalog.total, 6);
    assert.deepEqual(Object.fromEntries(Object.entries(catalog.platforms).map(([key, value]) => [key, value.count])), { AT: 1, CF: 1, LC: 1, LG: 1, LOJ: 1, NC: 1 });
    const reads = await app.evaluate(() => globalThis.__sharedE2E.reads);
    assert.deepEqual([...new Set(reads)].sort(), ['at.ndjson', 'cf.ndjson', 'lc.ndjson', 'lg.ndjson', 'loj.ndjson', 'nc.ndjson']);
    return { app, page, runtime };
  } catch (error) { await app.close(); throw error; }
}
async function remote(app, body, status = 200) {
  await app.evaluate((_, value) => { globalThis.__sharedE2E.remote = value; }, { url: SHARED_URL, body: typeof body === 'string' ? body : json(body), status });
}
async function calls(app) { return app.evaluate(() => globalThis.__sharedE2E.calls); }
function assertAnonymous(request) {
  assert.equal(request.url, SHARED_URL); assert.equal(request.method, 'GET'); assert.equal(request.redirect, 'error'); assert.equal(request.credentials, 'omit');
  assert.deepEqual(request.headers, { accept: 'application/json' }); assert.equal(request.signal, true); assert.equal(request.bypassCustomProtocolHandlers, true);
}
async function panel(page) {
  if (!(await page.locator('#settings-dialog').isVisible())) { await page.locator('.sidebar').hover(); await page.locator('#settings-button').click(); }
  await page.locator('#clist-shared-cache-panel .clist-shared-cache-summary').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#public-difficulty-panel').count(), 0);
  assert.equal(await page.locator('#clist-shared-cache-panel h3').innerText(), 'CLIST 缓存共享');
  assert.equal(await page.locator('#clist-shared-cache-panel input[type=password]').count(), 0);
  for (const action of ['export', 'import', 'sync']) assert.equal(await page.locator(`#clist-shared-cache-panel [data-action=${action}]`).isEnabled(), true);
}
async function drawUI(page, platform, rating, clistRating) {
  if (await page.locator('#settings-dialog').isVisible()) await page.evaluate(() => document.querySelector('[data-close="settings-dialog"]').click());
  await page.getByLabel('题目来源', { exact: true }).selectOption(platform);
  await page.getByLabel('最低 Codeforces Rating', { exact: true }).fill(String(rating));
  await page.getByLabel('最高 Codeforces Rating', { exact: true }).fill(String(rating));
  await page.locator('.daily-draw').click();
  await page.waitForFunction(({ url, clistRating }) => document.querySelector('.daily-problem-link')?.getAttribute('href') === url && document.querySelector('.daily-clist')?.textContent === `CLIST ${clistRating}`, { url: URLS[platform], clistRating });
  assert.equal(await page.locator('.daily-clist-cache').innerText(), '缓存');
  assert.match(await page.locator('.daily-clist').getAttribute('title'), /使用缓存评分；查询时间：2026-/);
  assert.equal(await page.locator('.daily-cf').innerText(), platform === 'CF' ? `CF 原生 ${rating}` : `CF 参考 ${rating}`);
}

(async () => {
  for (const date of DATES) assert.ok(Date.parse(date) <= Date.now(), 'Synthetic fixture dates must not be in the future');
  const a = seedProfile('a', { [URLS.CF]: row('CF', 1000), [URLS.AT]: row('AT', 800, DATES[0]), [URLS.NC]: row('NC', 377), [URLS.LOJ]: row('LOJ', 0) });
  const b = seedProfile('b');
  const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-shared-clist-dialogs-'));
  const firstExport = path.join(fixtures, 'baseline.json'), mergedExport = path.join(fixtures, 'merged.json'), secondExport = path.join(fixtures, 'second-user.json');
  let app, page;
  const evidence = { syntheticTestFixture: true, actualUploads: 0, fetchedClistRatings: 0, profiles: [a.profile, b.profile], network: [], counts: {} };
  try {
    ({ app, page } = await launch(a));
    assert.equal((await invoke(page, 'getClistSharedCacheStatus')).total, 3);
    const originalCache = fs.readFileSync(a.cacheFile);
    await choose(app, 'save', firstExport);
    const output = await invoke(page, 'exportClistSharedCache');
    assert.equal(output.canceled, false); exported(firstExport, 3);
    assert.deepEqual(fs.readFileSync(a.cacheFile), originalCache);
    assert.equal(JSON.stringify(output).includes(fixtures), false, 'Raw native paths must not escape through IPC results');
    await choose(app, 'save', firstExport, true);
    assert.equal((await invoke(page, 'exportClistSharedCache')).canceled, true);
    await choose(app, 'open', firstExport, true);
    assert.equal((await invoke(page, 'importClistSharedCache')).canceled, true);
    const incoming = path.join(fixtures, 'incoming.json');
    fs.writeFileSync(incoming, json({ ...document({ [URLS.CF]: row('CF', 2400, DATES[0]), [URLS.AT]: row('AT', 1100), [URLS.NC]: row('NC', 999), [URLS.LC]: row('LC', 1400), [URLS.LG]: row('LG', 0) }), importRoot: 'IMPORT_ROOT_PRIVATE', username: 'IMPORT_ROOT_USERNAME', metadata: { arbitrary: true } }));
    await choose(app, 'open', incoming);
    const imported = await invoke(page, 'importClistSharedCache');
    assert.deepEqual({ imported: imported.imported, updated: imported.updated, kept: imported.kept, ignored: imported.ignored }, { imported: 1, updated: 1, kept: 2, ignored: 1 });
    const merged = JSON.parse(fs.readFileSync(a.cacheFile, 'utf8'));
    assert.deepEqual(merged.localRoot, JSON.parse(originalCache).localRoot);
    assert.equal(merged.apiKey, 'PRIVATE_ROOT_KEY_SENTINEL'); assert.deepEqual(merged.metadata, { private: true });
    assert.equal(merged.importRoot, undefined); assert.equal(merged.username, undefined);
    assert.equal(merged.ratings[URLS.CF].rating, 1000); assert.equal(merged.ratings[URLS.AT].rating, 1100); assert.equal(merged.ratings[URLS.NC].rating, 377); assert.equal(merged.ratings[URLS.LC].rating, 1400);
    assert.equal(merged.ratings[URLS.LG], undefined); assert.equal(merged.ratings[URLS.LOJ].rating, 0);
    assert.deepEqual(fs.readFileSync(a.cacheFile + '.bak'), originalCache);
    evidence.counts.import = { imported: imported.imported, updated: imported.updated, kept: imported.kept, ignored: imported.ignored };
    const cached = await invoke(page, 'dailyDraw', { source: 'all', platform: 'NC', ratingMin: 400, ratingMax: 400 });
    assert.equal(cached.diagnostics.dataMode, 'index'); assert.equal(cached.problem.clistRating, 377); assert.equal(cached.problem.clistRatingCached, true); assert.equal(cached.problem.estimatedCfRating, 400);
    const native = await invoke(page, 'dailyDraw', { source: 'all', platform: 'CF', ratingMin: 1200, ratingMax: 1200 });
    assert.equal(native.diagnostics.dataMode, 'index'); assert.equal(native.problem.rating, 1200); assert.equal(native.problem.clistRating, 1000); assert.equal(native.problem.clistRatingCached, true);
    await drawUI(page, 'NC', 400, 377); await drawUI(page, 'CF', 1200, 1000);
    await panel(page);
    assert.match(await page.locator('#clist-shared-cache-panel').innerText(), /不会自动上传/);
    for (const invalid of ['{malformed\n', document({ [URLS.AT]: row('AT', 2500, DATES[2]), [URLS.CF]: row('LG', 2300) }), document({ [URLS.AT]: row('AT', 2500, '2099-01-01T00:00:00.000Z') }), { schema: 1, kind: 'public-difficulty', ratings: {} }]) {
      fs.writeFileSync(incoming, typeof invalid === 'string' ? invalid : json(invalid));
      const before = fs.readFileSync(a.cacheFile), backup = fs.readFileSync(a.cacheFile + '.bak');
      await choose(app, 'open', incoming);
      await assert.rejects(() => invoke(page, 'importClistSharedCache'), /CLIST/);
      assert.deepEqual(fs.readFileSync(a.cacheFile), before); assert.deepEqual(fs.readFileSync(a.cacheFile + '.bak'), backup);
    }
    assert.equal((await calls(app)).length, 0, 'Imports, exports and native draws perform no provider lookups');
    await remote(app, { ...document({ [URLS.NC]: row('NC', 580, DATES[2]), [URLS.LG]: row('LG', 1800) }), remoteRoot: 'REMOTE_ROOT_PRIVATE' });
    const synced = await invoke(page, 'syncClistSharedCache', SHARED_URL);
    assert.equal(synced.imported, 1); assert.equal(synced.updated, 1); assert.equal(synced.status.total, 5); assert.equal(synced.status.sourceUrl, SHARED_URL);
    assert.ok(Date.parse(synced.status.lastSyncedAt) <= Date.now());
    assert.deepEqual(JSON.parse(fs.readFileSync(a.sourceFile, 'utf8')), { url: SHARED_URL, lastSyncedAt: synced.status.lastSyncedAt });
    assert.equal(JSON.parse(fs.readFileSync(a.cacheFile)).remoteRoot, undefined);
    assert.equal((await calls(app)).length, 1); assertAnonymous((await calls(app))[0]);
    // The real normal sync handler obtains the configured shared source after the
    // repository mock completes; only the repository provider methods are mocked.
    await remote(app, document({ [URLS.NC]: row('NC', 780, DATES[2].replace('01:02:03', '02:02:03')) }));
    const normal = await invoke(page, 'sync');
    assert.equal(normal.authStatus.status, 'anonymous');
    assert.equal((await calls(app)).length, 2); assertAnonymous((await calls(app))[1]);
    assert.equal(JSON.parse(fs.readFileSync(a.cacheFile)).ratings[URLS.NC].rating, 780);
    assert.deepEqual(await app.evaluate(() => globalThis.__sharedE2E.repo.map(item => item.method)), ['sync', 'getTagCatalog']);
    // Wait for the visible panel to observe the cache changed through direct IPC.
    await page.waitForFunction(() => document.querySelector('#clist-shared-cache-panel .clist-shared-cache-summary')?.textContent === '有效 CLIST 评分 5 条');
    // HTTP failure is exercised by the public UI with a real rejected IPC result.
    const before503 = fs.readFileSync(a.cacheFile), source503 = fs.readFileSync(a.sourceFile);
    await remote(app, 'PRIVATE_HTTP503_BODY', 503);
    await page.locator('#clist-shared-cache-panel .clist-shared-cache-url').fill(SHARED_URL);
    await page.locator('#clist-shared-cache-panel [data-action=sync]').click();
    await page.waitForFunction(() => document.querySelector('#clist-shared-cache-panel .clist-shared-cache-error')?.textContent?.includes('下载失败'));
    assert.equal((await calls(app)).length, 3); assertAnonymous((await calls(app))[2]);
    assert.deepEqual(fs.readFileSync(a.cacheFile), before503); assert.deepEqual(fs.readFileSync(a.sourceFile), source503);
    assert.doesNotMatch(await page.locator('#clist-shared-cache-panel').innerText(), /PRIVATE_HTTP503|公开难度缓存|替换缓存|导出空白模板/);
    assert.match(await page.locator('#clist-shared-cache-panel .clist-shared-cache-summary').innerText(), /有效 CLIST 评分 5 条/);
    await choose(app, 'save', mergedExport); await invoke(page, 'exportClistSharedCache'); exported(mergedExport, 5);
    assertUnchanged(a);
    evidence.network.push(...await calls(app));
    assert.deepEqual(await app.evaluate(() => globalThis.__sharedE2E.forbidden), []);
    const dialogs = await app.evaluate(() => globalThis.__sharedE2E.dialogs);
    assert.ok(dialogs.length >= 8); assert.ok(dialogs.every(item => item.parentTrusted));
    assert.ok(dialogs.filter(item => item.kind === 'open').every(item => item.options.properties.includes('openFile')));
    await app.close(); app = undefined;

    ({ app, page } = await launch(b));
    assert.equal((await invoke(page, 'getClistSharedCacheStatus')).total, 0);
    assert.equal(fs.existsSync(b.cacheFile), false);
    await choose(app, 'open', firstExport);
    assert.equal((await invoke(page, 'importClistSharedCache')).imported, 3);
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(b.cacheFile))).sort(), ['ratings', 'schema']);
    // Emulate a separately obtained personal positive cache on the second device;
    // no credential setup or CLIST lookup is needed to verify the merge contract.
    const personal = JSON.parse(fs.readFileSync(b.cacheFile)); personal.localRoot = { owner: 'PRIVATE_LOCAL_B_PERSONAL' };
    personal.ratings[URLS.AT] = row('AT', 1250, DATES[2]); personal.ratings[URLS.LOJ] = row('LOJ', 1600, DATES[2]);
    fs.writeFileSync(b.cacheFile, json(personal));
    await choose(app, 'open', mergedExport);
    const second = await invoke(page, 'importClistSharedCache');
    assert.equal(second.imported, 2); assert.equal(second.updated, 1); assert.equal(second.kept, 2); assert.equal(second.status.total, 6);
    assert.equal(JSON.parse(fs.readFileSync(b.cacheFile)).ratings[URLS.AT].rating, 1250);
    assert.equal(JSON.parse(fs.readFileSync(b.cacheFile)).localRoot.owner, 'PRIVATE_LOCAL_B_PERSONAL');
    await choose(app, 'save', secondExport); await invoke(page, 'exportClistSharedCache');
    const forEveryone = exported(secondExport, 6); assert.equal(forEveryone.ratings[URLS.AT].rating, 1250); assert.equal(forEveryone.ratings[URLS.LOJ].rating, 1600); assert.equal(forEveryone.ratings[URLS.NC].rating, 780);
    assert.equal((await calls(app)).length, 0); assert.deepEqual(await app.evaluate(() => globalThis.__sharedE2E.forbidden), []); assertUnchanged(b);
    await app.close(); app = undefined;

    ({ app, page } = await launch(a));
    assert.equal((await invoke(page, 'getClistSharedCacheStatus')).sourceUrl, SHARED_URL);
    await choose(app, 'open', secondExport);
    const returned = await invoke(page, 'importClistSharedCache');
    assert.equal(returned.imported, 1); assert.equal(returned.updated, 1); assert.equal(returned.kept, 4); assert.equal(returned.status.total, 6);
    assert.equal(JSON.parse(fs.readFileSync(a.cacheFile)).localRoot.owner, 'PRIVATE_LOCAL_a');
    assert.equal((await calls(app)).length, 0, 'Restart and roundtrip import do not auto-fetch');
    assert.deepEqual(await app.evaluate(() => globalThis.__sharedE2E.forbidden), []); assertUnchanged(a);
    evidence.counts.secondUser = { imported: second.imported, updated: second.updated, kept: second.kept, total: second.status.total };
    evidence.counts.roundtrip = { imported: returned.imported, updated: returned.updated, kept: returned.kept, total: returned.status.total };
    console.log('PASS real sandboxed Electron + four shared IPCs; native dialogs; two isolated profiles; six immutable native shards; timestamp merge + zero filtering; strict private-free export; no-key HTTPS mock + normal sync; HTTP503/malformed/resource/future rejection preserves bytes; daily cache badge + native priority; no external traffic or uploads');
    console.log(JSON.stringify(evidence));
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
