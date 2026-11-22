'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const { appPath } = require('./app-path.cjs');

// Real main, sandboxed preload and IPC; every rating below is a SYNTHETIC TEST
// fixture written locally. In particular, 377 is not claimed to be a fetched or
// verified CLIST score for Nowcoder 328351 (or for the Codeforces fixture).
const SYNTHETIC_RATING = 377;
const SYNTHETIC_QUERIED_AT = '2026-11-20T01:02:03.000Z';
const URLS = {
  AT: 'https://atcoder.jp/contests/abc999/tasks/abc999_a',
  CF: 'https://codeforces.com/problemset/problem/1999/A',
  LG: 'https://www.luogu.com.cn/problem/P1000',
  NC: 'https://ac.nowcoder.com/acm/problem/328351',
  LC: 'https://leetcode.com/problems/two-sum/',
  LOJ: 'https://loj.ac/p/1000'
};
const IPC_NAMES = ['dailyDraw', 'getDailyTagCatalog', 'getClistStatus', 'getProblemEnrichment', 'refreshProblemClistRating'];

function seedProfile() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-clist-cache-electron-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ autoSync: false }));
  // Avoid unrelated startup schedule traffic; all six library shards are local.
  fs.writeFileSync(path.join(profile, 'contests.json'), JSON.stringify({ schema: 1, platforms: ['luogu', 'codeforces', 'atcoder', 'nowcoder'].map(id => ({ id, contests: [], updatedAt: new Date().toISOString() })) }));
  const library = path.join(profile, 'library');
  fs.mkdirSync(library);
  const originals = new Map();
  for (const platform of Object.keys(URLS)) {
    const row = { id: `${platform}:synthetic-clist-cache-fixture`, platform, title: `Synthetic offline ${platform} cache fixture`, url: URLS[platform], tags: [], rating: null, officialTags: [], officialDifficulty: null };
    if (platform === 'CF') Object.assign(row, { tags: ['dp'], rating: 1200, officialTags: ['dp'], officialDifficulty: '1200' });
    if (platform === 'LC') Object.assign(row, { tags: ['数组'], officialTags: ['数组'], officialDifficulty: 'Easy' });
    if (platform === 'LOJ') Object.assign(row, { estimatedCfRating: 1300, estimatedLuoguDifficulty: '普及', estimateReason: 'Synthetic public estimate for an explicitly unlisted problem' });
    const file = path.join(library, `${platform.toLowerCase()}.ndjson`);
    fs.writeFileSync(file, JSON.stringify(row) + '\n');
    originals.set(file, fs.readFileSync(file));
  }
  const meta = path.join(library, 'meta.json');
  fs.writeFileSync(meta, JSON.stringify({ schema: 1, builtAt: '2026-11-20T00:00:00Z' }));
  originals.set(meta, fs.readFileSync(meta));
  const cacheFile = path.join(profile, 'clist-rating-cache.json');
  fs.writeFileSync(cacheFile, JSON.stringify({
    schema: 1,
    syntheticTestFixture: 'Locally seeded assertions only; these scores were not fetched from CLIST.',
    ratings: {
      [URLS.NC]: { rating: SYNTHETIC_RATING, resource: 'ac.nowcoder.com', queriedAt: SYNTHETIC_QUERIED_AT },
      [URLS.CF]: { rating: SYNTHETIC_RATING, resource: 'codeforces.com', queriedAt: SYNTHETIC_QUERIED_AT },
      [URLS.AT]: { rating: 0, resource: 'atcoder.jp', queriedAt: SYNTHETIC_QUERIED_AT }
    }
  }, null, 2) + '\n');
  fs.writeFileSync(path.join(profile, 'difficulty-backfill-ledger.json'), JSON.stringify({ schema: 1, attempts: { [URLS.LOJ]: { at: SYNTHETIC_QUERIED_AT, result: 'none', reason: 'not-found' } } }));
  return { profile, originals, cacheFile, cacheBytes: fs.readFileSync(cacheFile) };
}
function assertLibraryUnchanged(originals) {
  for (const [file, bytes] of originals) assert.deepEqual(fs.readFileSync(file), bytes, `Normalized library changed: ${path.basename(file)}`);
}
async function launch(profile) {
  const env = { ...process.env, QMX_USER_DATA_DIR: profile, QMX_ISOLATED_SANDBOX: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: require('electron'), args: [appPath(''), '--disable-gpu', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', ...(process.env.QMX_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])], env, timeout: 30000 });
  try {
    // Intercept both real main-process transports and Chromium requests. This
    // never supplies a response or rating: every HTTP(S) attempt is a failure.
    // DNS blackholing above is also active from process creation, before these
    // recorders are installed. The fresh local profile suppresses startup work.
    await app.evaluate(({ session, net }) => {
      globalThis.__clistCacheNetwork = { electron: [], node: [], chromium: [] };
      const requestUrl = input => typeof input === 'string' ? input : input.url || String(input);
      const intercept = (transport, original) => function(input, ...args) {
        const url = new URL(requestUrl(input));
        if (/^https?:$/.test(url.protocol)) {
          globalThis.__clistCacheNetwork[transport].push(url.origin + url.pathname);
          return Promise.reject(new Error('External network is forbidden in the synthetic CLIST cache test'));
        }
        return original.call(this, input, ...args);
      };
      net.fetch = intercept('electron', net.fetch);
      globalThis.fetch = intercept('node', globalThis.fetch);
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = new URL(details.url);
        const blocked = /^https?:$/.test(url.protocol);
        if (blocked) globalThis.__clistCacheNetwork.chromium.push(url.origin + url.pathname);
        callback({ cancel: blocked });
      });
    });
    const page = await app.firstWindow();
    await page.waitForFunction(names => names.every(name => typeof window.notebook?.[name] === 'function'), IPC_NAMES, { timeout: 30000 });
    await page.locator('.daily-problem-title').waitFor({ state: 'visible', timeout: 30000 });
    return { app, page };
  } catch (error) { await app.close(); throw error; }
}
async function invoke(page, method, ...args) {
  return page.evaluate(({ method, args }) => window.notebook[method](...args), { method, args });
}
async function assertZeroNetwork(app) {
  const attempts = await app.evaluate(() => globalThis.__clistCacheNetwork);
  const all = Object.values(attempts).flat();
  assert.deepEqual(all.filter(url => /^https?:\/\/(?:www\.)?clist\.by(?:\/|$)/.test(url)), [], 'CLIST request attempted despite no credentials and a disk cache');
  assert.deepEqual(attempts, { electron: [], node: [], chromium: [] }, 'Unexpected external network attempt');
  return attempts;
}
function assertCachedNowcoder(problem) {
  assert.equal(problem.url, URLS.NC);
  assert.equal(problem.source, 'NC');
  assert.equal(problem.rating, null);
  assert.equal(problem.clistRating, SYNTHETIC_RATING);
  assert.equal(problem.clistRatingStatus, 'available');
  assert.equal(problem.clistRatingCached, true);
  assert.equal(problem.clistRatingStale, false);
  assert.equal(problem.clistRatingQueriedAt, SYNTHETIC_QUERIED_AT);
  assert.equal(problem.estimatedCfRating, 400);
  assert.equal(problem.estimatedLuoguDifficulty, '入门');
  assert.equal(problem.officialDifficulty, null);
  assert.equal(problem.difficultyReference.rawRating, SYNTHETIC_RATING);
  assert.equal(problem.difficultyReference.calibrated, false);
}
function assertNativeCodeforces(problem) {
  assert.equal(problem.url, URLS.CF);
  assert.equal(problem.source, 'CF');
  assert.equal(problem.clistRating, SYNTHETIC_RATING);
  assert.equal(problem.clistRatingCached, true);
  assert.equal(problem.clistRatingQueriedAt, SYNTHETIC_QUERIED_AT);
  assert.equal(problem.rating, 1200, 'Native CF rating must take priority over synthetic CLIST 377');
  assert.equal(problem.officialDifficulty, '1200');
  assert.equal(problem.estimatedCfRating, null);
  assert.match(problem.ratingEstimateReason, /CF 参考 1200/);
}

(async () => {
  const { profile, originals, cacheFile, cacheBytes } = seedProfile();
  let app, page;
  const networkEvidence = [];
  try {
    ({ app, page } = await launch(profile));
    const runtime = await app.evaluate(({ app, BrowserWindow }) => ({ root: app.getAppPath(), userData: app.getPath('userData'), preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences() }));
    assert.equal(path.resolve(runtime.root), appPath(''));
    assert.equal(path.resolve(runtime.userData), profile);
    assert.equal(runtime.preferences.contextIsolation, true);
    assert.equal(runtime.preferences.nodeIntegration, false);
    assert.equal(runtime.preferences.sandbox, true);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    assert.equal((await invoke(page, 'getClistStatus')).configured, false);
    assert.equal((await invoke(page, 'getDailyTagCatalog')).total, 6);

    // All-platform mode uses the six seeded shards, so no provider is needed.
    const unlisted = await invoke(page, 'dailyDraw', { source: 'all', platform: 'LOJ' });
    assert.equal(unlisted.problem.clistRatingStatus, 'not-found');
    assert.equal(unlisted.problem.estimatedCfRating, 1300);
    assert.equal((await invoke(page, 'getProblemEnrichment', URLS.LOJ)).problem.clistRatingStatus, 'not-found');
    const zero = await invoke(page, 'dailyDraw', { source: 'all', platform: 'AT' });
    assert.equal(zero.problem.clistRating, null);
    assert.equal(zero.problem.clistRatingStatus, 'no-data');
    assert.equal(zero.problem.estimatedCfRating, null);
    assert.equal(zero.problem.estimatedLuoguDifficulty, null);
    const zeroView = await invoke(page, 'getProblemEnrichment', URLS.AT);
    assert.equal(zeroView.problem.clistRatingStatus, 'no-data');
    const first = await invoke(page, 'dailyDraw', { source: 'all', platform: 'NC', ratingMin: 400, ratingMax: 400, luoguDifficulty: '入门' });
    assertCachedNowcoder(first.problem);
    // The editor's view/callback must keep the same disk-backed difficulty.
    assertCachedNowcoder((await invoke(page, 'getProblemEnrichment', URLS.NC)).problem);
    assert.equal(first.diagnostics.dataMode, 'index');
    assert.deepEqual(fs.readFileSync(cacheFile), cacheBytes);
    const noKey = await invoke(page, 'refreshProblemClistRating', 'https://www.nowcoder.com/acm/problem/328351/?from=synthetic-test#statement');
    assert.match(noKey.message, /配置 CLIST/);
    assertCachedNowcoder(noKey.problem);
    assert.deepEqual(fs.readFileSync(cacheFile), cacheBytes, 'No-key refresh must preserve the last good cache bytes');
    assertNativeCodeforces((await invoke(page, 'dailyDraw', { source: 'all', platform: 'CF', ratingMin: 1200, ratingMax: 1200 })).problem);
    const nativeRefresh = await invoke(page, 'refreshProblemClistRating', 'https://contest.codeforces.com/contest/1999/problem/a?locale=en');
    assert.match(nativeRefresh.message, /配置 CLIST/);
    assertNativeCodeforces(nativeRefresh.problem);
    assertLibraryUnchanged(originals);
    networkEvidence.push(await assertZeroNetwork(app));

    await app.close(); app = undefined;
    ({ app, page } = await launch(profile));
    assert.equal((await invoke(page, 'getClistStatus')).configured, false);
    assertCachedNowcoder((await invoke(page, 'dailyDraw', { source: 'all', platform: 'NC' })).problem);
    const reused = await invoke(page, 'refreshProblemClistRating', URLS.NC);
    assert.match(reused.message, /配置 CLIST/);
    assertCachedNowcoder(reused.problem);
    assert.deepEqual(fs.readFileSync(cacheFile), cacheBytes, 'Restart must reuse disk cache without rewriting it');
    assertLibraryUnchanged(originals);
    networkEvidence.push(await assertZeroNetwork(app));

    // The existing process must reread disk for each operation; neither corrupt
    // JSON nor the valid JSON value null may silently become an empty cache.
    for (const corrupt of ['{broken synthetic CLIST JSON\n', 'null\n']) {
      const bytes = Buffer.from(corrupt);
      fs.writeFileSync(cacheFile, bytes);
      await assert.rejects(() => invoke(page, 'dailyDraw', { source: 'all', platform: 'NC' }), /JSON|Unexpected|Expected|缓存格式无效/i);
      assert.deepEqual(fs.readFileSync(cacheFile), bytes, 'Draw replaced corrupt cache bytes');
      await assert.rejects(() => invoke(page, 'refreshProblemClistRating', URLS.NC), /JSON|Unexpected|Expected|缓存格式无效/i);
      assert.deepEqual(fs.readFileSync(cacheFile), bytes, 'Refresh replaced corrupt cache bytes');
    }
    // Restore only the locally seeded fixture to verify recovery and lock release.
    fs.writeFileSync(cacheFile, cacheBytes);
    assertCachedNowcoder((await invoke(page, 'dailyDraw', { source: 'all', platform: 'NC' })).problem);
    assertCachedNowcoder((await invoke(page, 'refreshProblemClistRating', URLS.NC)).problem);
    assert.deepEqual(fs.readFileSync(cacheFile), cacheBytes);
    assertLibraryUnchanged(originals);
    for (const name of ['auth.json', 'clist-auth.json', 'ai-auth.json']) assert.equal(fs.existsSync(path.join(profile, name)), false, `No credentials expected: ${name}`);
    networkEvidence.push(await assertZeroNetwork(app));
    console.log('PASS real Electron main/preload/IPC, default sandbox, synthetic disk score 377 => CF reference 400 / Luogu 入门, no-key refresh, restart reuse, corrupt JSON/null byte preservation, native CF 1200 priority, unchanged six shards, zero CLIST/external network');
    console.log(JSON.stringify({ syntheticTestFixture: true, fetchedClistScores: 0, root: runtime.root, profile, sandbox: runtime.preferences.sandbox, contextIsolation: runtime.preferences.contextIsolation, nodeIntegration: runtime.preferences.nodeIntegration, queriedAt: SYNTHETIC_QUERIED_AT, networkEvidence }));
  } finally {
    if (app) await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
