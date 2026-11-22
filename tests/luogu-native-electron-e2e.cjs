'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const { appPath } = require('./app-path.cjs');

// Offline regression for the reported P9234 duplicate: the scoped document has
// no difficulty, while the same official URL already has native index metadata.
// These are local fixtures, not newly fetched official tags or CLIST ratings.
const URL = 'https://www.luogu.com.cn/problem/P9234';
const LEVEL = '普及+/提高';
const DISPLAY_LEVEL = '普及+/提高-';
const TITLE = 'P9234 原公共文档标题（离线回归夹具）';
const REPO = 'synthetic-native/p9234';
const SOURCE_KEY = `https://api.github.com|${REPO}`;
const URLS = {
  CF: 'https://codeforces.com/problemset/problem/1999/A',
  AT: 'https://atcoder.jp/contests/abc999/tasks/abc999_a',
  LG: URL,
  NC: 'https://ac.nowcoder.com/acm/problem/1000',
  LC: 'https://leetcode.com/problems/two-sum/',
  LOJ: 'https://loj.ac/p/1000'
};
const IPC_NAMES = ['dailyDraw', 'getDailyTagCatalog', 'getClistStatus', 'getProblemEnrichment', 'refreshProblemClistRating'];

function seedProfile(local = false) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-luogu-native-electron-'));
  const originals = new Map();
  function seed(name, value) {
    const file = path.join(profile, name);
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
    originals.set(file, fs.readFileSync(file));
  }
  seed('settings.json', { repo: REPO, serverUrl: '', autoSync: false });
  // Six shards and fresh contests suppress unrelated provider requests. Isolated
  // mode disables packaged initial CLIST data and automatic update checks.
  seed('contests.json', { schema: 1, platforms: ['luogu', 'codeforces', 'atcoder', 'nowcoder'].map(id => ({ id, contests: [], updatedAt: new Date().toISOString() })) });
  fs.mkdirSync(path.join(profile, 'library'));
  for (const [platform, url] of Object.entries(URLS)) {
    const row = { id: platform === 'LG' ? 'LG:P9234' : `${platform}:offline-companion`, platform, title: `Offline ${platform} native index fixture`, url, rating: null, tags: [], officialTags: [], officialDifficulty: null };
    if (platform === 'LG') Object.assign(row, { luoguDifficulty: LEVEL, officialDifficulty: LEVEL, estimatedCfRating: 1600, estimatedLuoguDifficulty: null });
    const file = path.join(profile, 'library', `${platform.toLowerCase()}.ndjson`);
    fs.writeFileSync(file, JSON.stringify(row) + '\n');
    originals.set(file, fs.readFileSync(file));
  }
  seed('library/meta.json', { schema: 1, builtAt: new Date().toISOString() });
  const record = { id: local ? 'local:original-p9234-note' : 'document:original-p9234', kind: local ? 'local' : 'document', clientId: 'offline-p9234-fixture', ownerId: null, pid: 'P9234', platform: 'LG', title: TITLE, problemUrl: URL, url: URL, rating: null, difficulty: '', luoguDifficulty: '', tags: ['自定义算法'], officialTags: [], officialDifficulty: null, body: 'Original user note bytes must survive native metadata reads.', opaque: { preserved: true } };
  const cache = { repo: REPO, sourceKey: SOURCE_KEY, serverUrl: '', records: local ? [] : [record], issues: [], algorithmNotes: [], algorithmTopics: [] };
  seed('cache.json', { ...cache, repos: { [SOURCE_KEY]: cache } });
  seed('local.json', { records: local ? [record] : [], favorites: [], mastery: {}, draft: {}, opaque: { original: true } });
  return { profile, originals, origin: local ? 'local' : 'public' };
}
function assertUnchanged(fixture) {
  for (const [file, bytes] of fixture.originals) assert.deepEqual(fs.readFileSync(file), bytes, `Read-only native merge rewrote ${path.basename(file)}`);
  for (const name of ['auth.json', 'clist-auth.json', 'ai-auth.json', 'problem-enrichments.json']) {
    assert.equal(fs.existsSync(path.join(fixture.profile, name)), false, `Unexpected credentials or persisted enrichment: ${name}`);
  }
}
async function invoke(page, method, ...args) {
  return page.evaluate(({ method, args }) => window.notebook[method](...args), { method, args });
}
async function launch(profile) {
  const env = { ...process.env, QMX_USER_DATA_DIR: profile, QMX_ISOLATED_SANDBOX: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: require('electron'), args: [appPath(''), '--disable-gpu', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'], env, timeout: 30000 });
  try {
    await app.evaluate(({ net, session }) => {
      globalThis.__luoguNativeNetwork = { electron: [], node: [], chromium: [] };
      const requestUrl = input => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url || String(input);
      const intercept = (transport, original) => function(input, ...args) {
        const url = new URL(requestUrl(input));
        if (/^https?:$/.test(url.protocol)) {
          globalThis.__luoguNativeNetwork[transport].push(url.origin + url.pathname);
          return Promise.reject(new Error('External network forbidden in offline native Luogu regression'));
        }
        return original.call(this, input, ...args);
      };
      net.fetch = intercept('electron', net.fetch);
      globalThis.fetch = intercept('node', globalThis.fetch);
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = new URL(details.url);
        const blocked = /^https?:$/.test(url.protocol);
        if (blocked) globalThis.__luoguNativeNetwork.chromium.push(url.origin + url.pathname);
        callback({ cancel: blocked });
      });
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.waitForFunction(names => names.every(name => typeof window.notebook?.[name] === 'function'), IPC_NAMES, { timeout: 30000 });
    await page.locator('.daily-problem-title').waitFor({ state: 'visible', timeout: 30000 });
    return { app, page };
  } catch (error) { await app.close(); throw error; }
}
function assertNative(problem, scopedOrigin) {
  assert.equal(problem.id, 'LG:P9234');
  assert.equal(problem.url, URL);
  assert.equal(problem.source, 'LG');
  if (scopedOrigin) {
    assert.equal(problem.origin, scopedOrigin, 'The index duplicate must not win after filtering');
    assert.equal(problem.title, TITLE, 'Keep the original scoped document display title');
  }
  assert.equal(problem.luoguDifficulty, LEVEL);
  assert.equal(problem.officialDifficulty, LEVEL);
  assert.equal(problem.rating, null);
  assert.equal(problem.estimatedCfRating, 1600);
  assert.equal(problem.estimatedLuoguDifficulty, null, 'Native Luogu must not become a reference badge');
  assert.equal(problem.clistRating ?? null, null, 'Native metadata must not invent a CLIST rating');
  assert.deepEqual(problem.officialTags, [], 'Custom document tags must not become fabricated official tags');
  assert.equal(problem.supplementInfo, undefined);
}
async function checkDraws(page, origin) {
  const source = origin === 'local' ? 'local' : 'public';
  const variants = [
    { source: 'all', platform: 'LG' },
    { source },
    { source, platform: 'LG', ratingMin: 1600, ratingMax: 1600 },
    { source, platform: 'LG', luoguDifficulty: LEVEL },
    { source, platform: 'LG', luoguDifficultyMin: DISPLAY_LEVEL, luoguDifficultyMax: DISPLAY_LEVEL },
    { source: 'all', platform: 'LG', ratingMin: 1600, ratingMax: 1600, luoguDifficultyMin: DISPLAY_LEVEL, luoguDifficultyMax: DISPLAY_LEVEL },
    { source, platform: 'LG', tags: ['自定义算法'], ratingMin: 1600, ratingMax: 1600 }
  ];
  for (const filters of variants) {
    const result = await invoke(page, 'dailyDraw', filters);
    assertNative(result.problem, origin);
    assert.equal(result.diagnostics.candidateCount, 1);
    assert.equal(result.diagnostics.dataMode, filters.source === 'all' ? 'index' : 'scoped');
  }
  await assert.rejects(() => invoke(page, 'dailyDraw', { source, platform: 'LG', ratingMin: 1700, ratingMax: 1700 }), /没有符合条件/);
  const view = await invoke(page, 'getProblemEnrichment', URL);
  assert.equal(view.officialDifficulty, LEVEL);
  assert.equal(view.canSupplementDifficulty, false);
  assert.equal(view.revision, 0);
  assert.equal(view.supplement, null);
  assertNative(view.problem);
  await assert.rejects(() => invoke(page, 'saveProblemEnrichment', { url: URL, expectedRevision: 0, cfRating: 1900, reason: 'Synthetic attempt to overwrite protected native difficulty' }), /官方难度/);
  const refresh = await invoke(page, 'refreshProblemClistRating', URL);
  assert.match(refresh.message, /配置 CLIST/);
  assertNative(refresh.problem);
  return { filters: variants.length, officialDifficulty: view.officialDifficulty, canSupplementDifficulty: view.canSupplementDifficulty };
}
async function assertBadges(page, expectedTitle = TITLE) {
  assert.equal(await page.locator('.daily-cf').innerText(), 'CF 参考 1600');
  assert.equal(await page.locator('.daily-luogu').innerText(), `洛谷难度：${DISPLAY_LEVEL}`);
  const classes = await page.locator('.daily-luogu').getAttribute('class');
  assert.match(classes, /\bdifficulty-badge\b/);
  assert.match(classes, /\btone-green\b/);
  assert.doesNotMatch(classes, /daily-estimated|daily-unrated/);
  assert.equal(await page.locator('.daily-problem-link').getAttribute('href'), URL);
  if (expectedTitle !== null) assert.equal(await page.locator('.daily-problem-title').innerText(), expectedTitle);
}
async function checkUI(page) {
  await page.getByLabel('题目来源').selectOption('LG');
  await page.getByLabel('最低 Codeforces Rating').fill('1600');
  await page.getByLabel('最高 Codeforces Rating').fill('1600');
  await page.getByLabel('最低洛谷难度').selectOption(DISPLAY_LEVEL);
  await page.getByLabel('最高洛谷难度').selectOption(DISPLAY_LEVEL);
  for (const source of ['LG', 'public']) {
    await page.getByLabel('题目来源').selectOption(source);
    await page.locator('.daily-draw').click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-result')?.getAttribute('aria-busy') === 'false');
    await assertBadges(page);
    assert.equal(await page.getByLabel('题目来源').inputValue(), source);
    // There is only one URL. Redraw must exclude both scoped/index copies and
    // retain the previous result, without silently changing the selected source.
    await page.locator('.daily-change').click();
    await page.locator('.daily-problem-error').filter({ hasText: '没有其他符合条件的题目，请调整筛选条件后重试' }).waitFor();
    await assertBadges(page);
    assert.equal(await page.getByLabel('题目来源').inputValue(), source);
  }
  await page.locator('.daily-clist-refresh').click();
  await page.locator('.daily-clist-refresh-status').filter({ hasText: '配置 CLIST' }).waitFor();
  // Metadata views resolve the canonical indexed problem; the draw assertions
  // above separately guarantee that scoped selection keeps the document title.
  await assertBadges(page, null);
  await page.locator('.daily-enrichment-open').click();
  const dialog = page.locator('.problem-enrichment-dialog');
  await dialog.getByText(`官方难度：${DISPLAY_LEVEL}`, { exact: true }).waitFor();
  assert.equal(await dialog.locator('.enrichment-cf').isDisabled(), true);
  assert.equal(await dialog.locator('.enrichment-luogu').isDisabled(), true);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  // Do not invoke refreshLibrary/updateLibrary: its genuine public sync is
  // networked. This test exercises already-cached native metadata entirely offline.
}

// Install transport guards before production main is required. Unlike the
// isolated P9234 fixture, this exercises the normal bundled baseline/CLIST seed
// startup. Only the updater's check is suppressed; no problem data is mocked.
function installProductionBootstrap(root) {
  const { app, net, session } = require('electron');
  const state = globalThis.__luoguProduction = { electron: [], node: [], chromium: [], updaterChecks: 0 };
  const requestUrl = input => typeof input === 'string' || input instanceof URL ? String(input) : input?.url || `${input?.protocol || 'https:'}//${input?.hostname || input?.host || 'unknown'}${input?.path || '/'}`;
  const blocked = (kind, input) => { const url = new URL(requestUrl(input)); state[kind].push(url.origin + url.pathname); throw new Error('External network forbidden in production native baseline regression'); };
  net.fetch = async input => blocked('electron', input);
  net.request = input => blocked('electron', input);
  globalThis.fetch = async input => blocked('node', input);
  for (const name of ['node:http', 'node:https']) {
    const transport = require(name);
    transport.request = input => blocked('node', input);
    transport.get = input => blocked('node', input);
  }
  app.whenReady().then(() => session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const block = /^https?:/.test(details.url);
    if (block) { const url = new URL(details.url); state.chromium.push(url.origin + url.pathname); }
    callback({ cancel: block });
  }));
  const updater = require(require('node:path').join(root, 'electron', 'updater.cjs'));
  const create = updater.createUpdater;
  updater.createUpdater = options => {
    const instance = create(options);
    return { ...instance, check: async () => { state.updaterChecks += 1; return instance.getState(); } };
  };
}
async function checkProductionBaseline() {
  const fixture = seedProfile();
  const highest = 'NOI/NOI+/CTS';
  const cases = [
    { pid: 'P11834', code: 8, level: highest, rating: 2800, legacy: null },
    { pid: 'P3756', code: 8, level: highest, rating: 2800, legacy: null },
    // These PIDs are synthetic. The stored codes, not their deliberately stale
    // labels or the bundled snapshot, must define the native difficulty.
    { pid: 'P99999901', code: 5, level: '提高', rating: 1800, legacy: '提高+/省选−' },
    { pid: 'P99999902', code: 6, level: '提高+/省选−', rating: 2100, legacy: '省选/NOI−' },
    { pid: 'P99999903', code: 7, level: '省选/NOI−', rating: 2400, legacy: 'NOI/NOI+/CTSC' },
    { pid: 'P99999904', code: 8, level: highest, rating: 2800, legacy: '' }
  ];
  const baselineFile = appPath('electron/data/luogu-native-difficulties.json');
  const baselineBytes = fs.readFileSync(baselineFile);
  const baseline = JSON.parse(baselineBytes);
  assert.equal(baseline.mappingVersion, 'luogu-native-2026-11');
  for (const item of cases.slice(0, 2)) assert.equal(baseline.difficulties[item.pid], 8, `Bundled native snapshot lacks ${item.pid}`);
  const lgFile = path.join(fixture.profile, 'library', 'lg.ndjson');
  const rows = cases.map(item => ({ id: `LG:${item.pid}`, platform: 'LG', title: `${item.pid} original legacy index`, url: `https://www.luogu.com.cn/problem/${item.pid}`, rating: null, tags: [], officialTags: [], officialDifficulty: item.legacy, luoguDifficulty: item.legacy, estimatedCfRating: null, estimatedLuoguDifficulty: null, ...(item.legacy !== null ? { luoguDifficultyCode: item.code } : {}) }));
  fs.writeFileSync(lgFile, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  fixture.originals.set(lgFile, fs.readFileSync(lgFile));
  const records = cases.map(item => ({ id: `document:${item.pid}`, kind: 'document', pid: item.pid, platform: 'LG', title: `${item.pid} original public title`, problemUrl: `https://www.luogu.com.cn/problem/${item.pid}`, rating: null, difficulty: '', luoguDifficulty: '', tags: [`自定义算法${item.pid}`], officialTags: [], officialDifficulty: null, body: 'Original public note remains unmodified.' }));
  const cache = { repo: REPO, sourceKey: SOURCE_KEY, serverUrl: '', records, issues: [], algorithmNotes: [], algorithmTopics: [] };
  const cacheFile = path.join(fixture.profile, 'cache.json');
  fs.writeFileSync(cacheFile, JSON.stringify({ ...cache, repos: { [SOURCE_KEY]: cache } }, null, 2) + '\n');
  fixture.originals.set(cacheFile, fs.readFileSync(cacheFile));
  const bootstrap = path.join(fixture.profile, 'native-production-bootstrap.cjs');
  fs.writeFileSync(bootstrap, `(${installProductionBootstrap.toString()})(${JSON.stringify(appPath(''))});\nrequire('electron').app.setAppPath(${JSON.stringify(appPath(''))});\nrequire(${JSON.stringify(appPath('electron/main.cjs'))});\n`);
  const env = { ...process.env, QMX_USER_DATA_DIR: fixture.profile };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.QMX_ISOLATED_SANDBOX;
  const app = await electron.launch({ executablePath: require('electron'), args: [bootstrap, '--disable-gpu', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'], env, timeout: 30000 });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.locator('.daily-problem-title').waitFor({ state: 'visible', timeout: 30000 });
    const runtime = await app.evaluate(({ app, BrowserWindow }) => ({ root: app.getAppPath(), profile: app.getPath('userData'), isolated: process.env.QMX_ISOLATED_SANDBOX ?? null, preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences() }));
    assert.equal(path.resolve(runtime.root), appPath(''));
    assert.equal(path.resolve(runtime.profile), fixture.profile);
    assert.equal(runtime.isolated, null, 'Production bundled recovery must run without the isolated bypass');
    assert.equal(runtime.preferences.sandbox, true);
    assert.equal(runtime.preferences.contextIsolation, true);
    assert.equal(runtime.preferences.nodeIntegration, false);
    assert.deepEqual(await invoke(page, 'getClistStatus'), { configured: false, username: null });
    assert.equal((await invoke(page, 'getDailyTagCatalog')).total, cases.length + 5);
    const seedFile = path.join(fixture.profile, 'clist-rating-cache.json');
    assert.equal(fs.existsSync(seedFile), true, 'Normal startup must run its real bundled CLIST seed path');
    const seededBytes = fs.readFileSync(seedFile);
    const ratings = JSON.parse(seededBytes).ratings;
    const results = [];
    for (const item of cases) {
      const url = `https://www.luogu.com.cn/problem/${item.pid}`;
      const cached = ratings[url];
      const hasClist = typeof cached?.rating === 'number' && cached.rating > 0;
      if (['P11834', 'P3756'].includes(item.pid)) assert.equal(hasClist, false, 'Reported native-only problem unexpectedly has a positive seeded CLIST rating');
      const assertLevel = problem => {
        assert.equal(problem.id, `LG:${item.pid}`);
        assert.equal(problem.url, url);
        assert.equal(problem.luoguDifficultyCode, item.code);
        assert.equal(problem.luoguDifficulty, item.level);
        assert.equal(problem.officialDifficulty, item.level);
        assert.equal(problem.estimatedLuoguDifficulty, null);
        assert.deepEqual(problem.officialTags, []);
        if (!hasClist) assert.equal(problem.estimatedCfRating, item.rating);
      };
      for (const source of ['all', 'public']) {
        const result = await invoke(page, 'dailyDraw', { source, platform: 'LG', tags: [`自定义算法${item.pid}`], luoguDifficultyMin: item.level, luoguDifficultyMax: item.level, ...(!hasClist ? { ratingMin: item.rating, ratingMax: item.rating } : {}) });
        assertLevel(result.problem);
        assert.equal(result.problem.origin, 'public');
        assert.equal(result.problem.title, `${item.pid} original public title`);
        assert.equal(result.diagnostics.candidateCount, 1);
      }
      const view = await invoke(page, 'getProblemEnrichment', url);
      assertLevel(view.problem);
      assert.equal(view.officialDifficulty, item.level);
      assert.equal(view.canSupplementDifficulty, false);
      assert.equal(view.revision, 0);
      const refresh = await invoke(page, 'refreshProblemClistRating', url);
      assert.match(refresh.message, /配置 CLIST/);
      assertLevel(refresh.problem);
      results.push({ pid: item.pid, code: item.code, native: item.level, cfReference: refresh.problem.estimatedCfRating, positiveClist: hasClist, restoredFromBundledSnapshot: item.legacy === null });
    }
    // The production highest tier is visible in the real daily UI. IPC checks
    // above isolate both reported PIDs and every explicit-code fixture.
    await page.getByLabel('题目来源').selectOption('public');
    await page.getByLabel('最低洛谷难度').selectOption(highest);
    await page.getByLabel('最高洛谷难度').selectOption(highest);
    await page.getByLabel('最低 Codeforces Rating').fill('2800');
    await page.getByLabel('最高 Codeforces Rating').fill('2800');
    await page.locator('.daily-draw').click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-result')?.getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('.daily-luogu').innerText(), `洛谷难度：${highest}`);
    assert.match(await page.locator('.daily-luogu').getAttribute('class'), /\btone-black\b/);
    assert.doesNotMatch(await page.locator('.daily-luogu').getAttribute('class'), /daily-estimated|daily-unrated/);
    assert.equal(await page.locator('.daily-cf').innerText(), 'CF 参考 2800');
    assert.equal(await page.getByLabel('题目来源').inputValue(), 'public');
    assertUnchanged(fixture);
    assert.deepEqual(fs.readFileSync(seedFile), seededBytes, 'Native recovery/no-key refresh rewrote the real seeded CLIST cache');
    assert.deepEqual(fs.readFileSync(baselineFile), baselineBytes, 'Bundled native baseline was rewritten');
    const network = await app.evaluate(() => globalThis.__luoguProduction);
    assert.deepEqual(network.electron, []);
    assert.deepEqual(network.node, []);
    assert.deepEqual(network.chromium, []);
    assert.ok(network.updaterChecks >= 1, 'Production startup updater stub was not reached');
    return { profile: fixture.profile, isolated: runtime.isolated, sandbox: runtime.preferences.sandbox, baselineCount: Object.keys(baseline.difficulties).length, seedCount: Object.keys(ratings).length, results, network };
  } finally { await app.close(); }
}

(async () => {
  const evidence = [];
  for (const local of [false, true]) {
    const fixture = seedProfile(local);
    const { app, page } = await launch(fixture.profile);
    try {
      const runtime = await app.evaluate(({ app, BrowserWindow }) => ({ root: app.getAppPath(), profile: app.getPath('userData'), preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences() }));
      assert.equal(path.resolve(runtime.root), appPath(''));
      assert.equal(path.resolve(runtime.profile), fixture.profile);
      assert.equal(runtime.preferences.sandbox, true);
      assert.equal(runtime.preferences.contextIsolation, true);
      assert.equal(runtime.preferences.nodeIntegration, false);
      assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
      assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
      assert.deepEqual(await invoke(page, 'getClistStatus'), { configured: false, username: null });
      assert.equal((await invoke(page, 'getDailyTagCatalog')).total, 6);
      assert.equal(fs.existsSync(path.join(fixture.profile, 'clist-rating-cache.json')), false);
      const draws = await checkDraws(page, fixture.origin);
      if (!local) await checkUI(page);
      assertUnchanged(fixture);
      // Legacy zero is no data, never grounds to clear the native level/1600.
      const cacheFile = path.join(fixture.profile, 'clist-rating-cache.json');
      fs.writeFileSync(cacheFile, JSON.stringify({ schema: 1, ratings: { [URL]: { rating: 0, resource: 'luogu.com.cn', queriedAt: '2026-11-20T01:02:03.000Z' } } }, null, 2) + '\n');
      const zeroBytes = fs.readFileSync(cacheFile);
      await checkDraws(page, fixture.origin);
      const zero = await invoke(page, 'dailyDraw', { source: 'all', platform: 'LG', ratingMin: 1600, ratingMax: 1600 });
      assert.equal(zero.problem.clistRatingStatus, 'no-data');
      assertNative(zero.problem, fixture.origin);
      assert.deepEqual(fs.readFileSync(cacheFile), zeroBytes, 'Read/no-key refresh rewrote legacy zero cache');
      if (!local) {
        await page.locator('.daily-draw').click();
        await page.waitForFunction(() => document.querySelector('.daily-problem-result')?.getAttribute('aria-busy') === 'false');
        await assertBadges(page);
      }
      assertUnchanged(fixture);
      const network = await app.evaluate(() => globalThis.__luoguNativeNetwork);
      assert.deepEqual(network, { electron: [], node: [], chromium: [] }, 'Unexpected external network attempt');
      evidence.push({ profile: fixture.profile, origin: fixture.origin, sandbox: runtime.preferences.sandbox, contextIsolation: runtime.preferences.contextIsolation, nodeIntegration: runtime.preferences.nodeIntegration, draws, legacyZeroRetainsNative: true, network });
    } catch (error) {
      console.error(JSON.stringify({ profile: fixture.profile, origin: fixture.origin, visibleDailyError: await page.locator('.daily-problem-error').innerText().catch(() => ''), result: await page.locator('.daily-problem-result').innerText().catch(() => '') }));
      throw error;
    } finally { await app.close(); }
  }
  const production = await checkProductionBaseline();
  console.log('PASS real Electron P9234 native difficulty before scoped/index dedup and filters; public/local identity, original title, CF reference 1600, protected native level, green Luogu badge, no-key refresh, legacy CLIST zero, retained redraw result; production bundled native recovery P11834/P3756 code 8 and explicit-code correction 5/6/7/8, unchanged user notes/cache/six shards, default sandbox, zero external requests');
  console.log(JSON.stringify({ root: appPath(''), fetchedClistScores: 0, evidence, production }));
})().catch(error => { console.error(error); process.exitCode = 1; });
