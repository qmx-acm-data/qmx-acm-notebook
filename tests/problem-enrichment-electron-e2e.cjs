'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const { appPath } = require('./app-path.cjs');

// Real application + sandboxed preload + IPC. No real credentials or provider traffic.
const SYNTHETIC_TEST_KEY = 'SYNTHETIC_TEST_KEY';
const URLS = {
  AT: 'https://atcoder.jp/contests/abc999/tasks/abc999_a',
  CF: 'https://codeforces.com/problemset/problem/1999/A',
  LG: 'https://www.luogu.com.cn/problem/P1000',
  NC: 'https://ac.nowcoder.com/acm/problem/1000',
  LC: 'https://leetcode.com/problems/two-sum/',
  LOJ: 'https://loj.ac/p/1000'
};
const AI_FIELDS = { tags: ['最短路'], cfRating: 1500, luoguDifficulty: '普及/提高−', reason: '根据图上路径题面推测，低置信度，请人工审核。' };
const IPC_NAMES = ['getProblemEnrichment', 'saveProblemEnrichment', 'removeProblemEnrichment', 'getProblemAIStatus', 'saveProblemAIConfig', 'clearProblemAIConfig', 'suggestProblemEnrichment'];

function seedProfile() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-enrichment-electron-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ autoSync: false }));
  // A fresh schedule cache also prevents unrelated startup schedule requests.
  fs.writeFileSync(path.join(profile, 'contests.json'), JSON.stringify({ schema: 1, platforms: ['luogu', 'codeforces', 'atcoder', 'nowcoder'].map(id => ({ id, contests: [], updatedAt: new Date().toISOString() })) }));
  const library = path.join(profile, 'library');
  fs.mkdirSync(library);
  const originals = new Map();
  for (const platform of Object.keys(URLS)) {
    const row = { id: `${platform}:enrichment-fixture`, platform, title: `Offline ${platform} enrichment fixture`, url: URLS[platform], tags: [], rating: null, officialTags: [], officialDifficulty: null };
    if (platform === 'CF') Object.assign(row, { tags: ['dp'], rating: 1200, officialTags: ['dp'], officialDifficulty: '1200' });
    if (platform === 'LC') Object.assign(row, { tags: ['数组'], officialTags: ['数组'], officialDifficulty: 'Easy' });
    const file = path.join(library, `${platform.toLowerCase()}.ndjson`);
    fs.writeFileSync(file, JSON.stringify(row) + '\n');
    originals.set(file, fs.readFileSync(file));
  }
  const meta = path.join(library, 'meta.json');
  fs.writeFileSync(meta, JSON.stringify({ schema: 1, builtAt: '2026-11-20T00:00:00Z' }));
  originals.set(meta, fs.readFileSync(meta));
  return { profile, originals };
}
function assertLibraryUnchanged(originals) {
  for (const [file, bytes] of originals) assert.deepEqual(fs.readFileSync(file), bytes, `Normalized library changed: ${path.basename(file)}`);
}
function assertNoSecret(value) {
  const serialized = JSON.stringify(value);
  assert.ok(!serialized.includes(SYNTHETIC_TEST_KEY), 'Synthetic key escaped main process');
  const visit = item => {
    if (!item || typeof item !== 'object') return;
    for (const [name, child] of Object.entries(item)) {
      assert.ok(!/^(?:apiKey|encrypted|authorization)$/i.test(name), `Credential field exposed to renderer: ${name}`);
      visit(child);
    }
  };
  visit(value);
}
async function launch(profile) {
  const env = { ...process.env, QMX_USER_DATA_DIR: profile, QMX_ISOLATED_SANDBOX: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ executablePath: require('electron'), args: [appPath(''), '--disable-gpu', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', ...(process.env.QMX_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])], env, timeout: 30000 });
  try {
    // Block and record any unexpected nonlocal Chromium requests as well as DNS.
    await app.evaluate(({ session }) => {
      globalThis.__enrichmentBlockedRequests = [];
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const url = new URL(details.url);
        const blocked = /^https?:$/.test(url.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (blocked) globalThis.__enrichmentBlockedRequests.push(url.origin + url.pathname);
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
async function rejected(page, method, args, expected) {
  await assert.rejects(() => invoke(page, method, ...args), expected);
}
async function serveAI() {
  const requests = [];
  let hold;
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      requests.push({ method: request.method, path: request.url, authorization: request.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      const respond = () => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(AI_FIELDS) } }] }));
      };
      if (hold) { const pending = hold; hold = undefined; pending.release = respond; pending.arrived(); }
      else respond();
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, requests, endpoint: `http://127.0.0.1:${server.address().port}/v1`, holdNext() {
    assert.equal(hold, undefined);
    let arrived;
    const ready = new Promise(resolve => { arrived = resolve; });
    const pending = { arrived, release: undefined };
    hold = pending;
    return { ready, release() { assert.equal(typeof pending.release, 'function'); pending.release(); } };
  } };
}

(async () => {
  const { profile, originals } = seedProfile();
  const enrichmentFile = path.join(profile, 'problem-enrichments.json');
  const configFile = path.join(profile, 'ai-auth.json');
  const ai = await serveAI();
  let app, page;
  let aiResult = 'not run';
  try {
    ({ app, page } = await launch(profile));
    const runtime = await app.evaluate(({ app, BrowserWindow, safeStorage }) => ({ root: app.getAppPath(), userData: app.getPath('userData'), safeStorage: safeStorage.isEncryptionAvailable(), preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences() }));
    assert.equal(path.resolve(runtime.root), appPath(''));
    assert.equal(path.resolve(runtime.userData), profile);
    assert.equal(runtime.preferences.contextIsolation, true);
    assert.equal(runtime.preferences.nodeIntegration, false);
    assert.equal(runtime.preferences.sandbox, true);
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.process), 'undefined');
    const initial = await invoke(page, 'getProblemEnrichment', URLS.AT);
    assert.deepEqual(initial.officialTags, []);
    assert.equal(initial.officialDifficulty, null);
    assert.equal(initial.revision, 0);
    assert.equal(initial.canSupplementTags, true);
    assert.equal(initial.canSupplementDifficulty, true);
    assert.equal(initial.supplement, null);
    assert.equal(initial.problem.url, URLS.AT);
    // Resolver and storage must use the same canonical key for official aliases/routes.
    assert.equal((await invoke(page, 'getProblemEnrichment', 'https://www.atcoder.jp/contests/abc999/tasks/abc999_a/?lang=en#task-statement')).url, URLS.AT);
    assert.equal((await invoke(page, 'getProblemEnrichment', 'https://contest.codeforces.com/contest/1999/problem/a?locale=en')).url, URLS.CF);
    assert.equal((await invoke(page, 'getProblemEnrichment', 'https://leetcode.cn/problems/two-sum/description/')).url, URLS.LC);
    for (const url of ['https://example.com/problems/fake', 'https://atcoder.jp.evil.invalid/contests/abc999/tasks/abc999_a', 'https://atcoder.jp/contests/abc999/tasks/absent', 'https://codeforces.com/blog/entry/1999', 'http://atcoder.jp/contests/abc999/tasks/abc999_a']) {
      await rejected(page, 'getProblemEnrichment', [url], /官方|可信|HTTPS/);
    }
    // Another sandboxed renderer cannot invoke the trusted main window's handlers.
    const senderGuard = await app.evaluate(async ({ BrowserWindow }, preload) => {
      const other = new BrowserWindow({ show: false, webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true } });
      try {
        await other.loadURL('data:text/html,<title>Untrusted IPC sender</title>');
        return await other.webContents.executeJavaScript(`window.notebook.getProblemAIStatus().then(() => 'unexpected success', error => error.message)`);
      } finally { other.destroy(); }
    }, appPath('electron/preload.cjs'));
    assert.match(senderGuard, /非法调用/);

    const fields = { tags: [' 最短路 ', '最短路'], cfRating: 1500, luoguDifficulty: '普及/提高-', reason: '  根据图上最短路径题面手动补充。  ' };
    const saved = await invoke(page, 'saveProblemEnrichment', { url: URLS.AT, expectedRevision: 0, ...fields });
    assert.equal(saved.revision, 1);
    assert.deepEqual(saved.supplement.tags, ['最短路']);
    assert.equal(saved.supplement.cfRating, 1500);
    assert.equal(saved.supplement.luoguDifficulty, '普及/提高−');
    assert.equal(saved.supplement.reason, fields.reason.trim());
    assert.equal(saved.supplement.source, 'manual');
    assert.equal(saved.supplement.status, 'approved');
    assert.deepEqual(saved.officialTags, []);
    assert.equal(saved.officialDifficulty, null);
    const persisted = JSON.parse(fs.readFileSync(enrichmentFile, 'utf8'));
    assert.equal(persisted.schema, 1);
    assert.deepEqual(persisted.records[URLS.AT], saved.supplement);
    assert.deepEqual(persisted.suggestions, {});
    assertLibraryUnchanged(originals);
    await rejected(page, 'saveProblemEnrichment', [{ url: URLS.AT, expectedRevision: 0, tags: ['贪心'], reason: 'stale write' }], /已被更新/);
    const manualDraw = await invoke(page, 'dailyDraw', { source: 'AT', tags: ['最短路'], ratingMin: 1500, ratingMax: 1500 });
    assert.equal(manualDraw.problem.url, URLS.AT);
    assert.deepEqual(manualDraw.problem.tags, ['最短路']);
    assert.equal(manualDraw.problem.estimatedCfRating, 1500);
    assert.equal(manualDraw.problem.estimatedLuoguDifficulty, '普及/提高−');
    assert.deepEqual(manualDraw.problem.supplementInfo, { source: 'manual', revision: 1, tags: true, difficulty: true });
    assert.match(manualDraw.problem.ratingEstimateReason, /手动补充/);
    const catalog = await invoke(page, 'getDailyTagCatalog');
    assert.equal(catalog.total, 6);
    assert.ok(catalog.tags.some(tag => tag.name === '最短路' && tag.sources.includes('AT')));
    assert.equal(catalog.platforms.AT.tagged, 1);
    const cf = await invoke(page, 'getProblemEnrichment', URLS.CF);
    assert.deepEqual(cf.officialTags, ['动态规划 DP']);
    assert.equal(cf.officialDifficulty, '1200');
    assert.equal(cf.canSupplementTags, false);
    assert.equal(cf.canSupplementDifficulty, false);
    await rejected(page, 'saveProblemEnrichment', [{ url: URLS.CF, expectedRevision: 0, tags: ['最短路'], reason: 'attempt official overwrite' }], /官方标签/);
    await rejected(page, 'saveProblemEnrichment', [{ url: URLS.CF, expectedRevision: 0, cfRating: 1500, reason: 'attempt official overwrite' }], /官方难度/);
    const lc = await invoke(page, 'getProblemEnrichment', URLS.LC);
    assert.deepEqual(lc.officialTags, ['数组']);
    assert.equal(lc.officialDifficulty, 'Easy');
    await rejected(page, 'saveProblemEnrichment', [{ url: URLS.LC, expectedRevision: 0, cfRating: 1500, reason: 'attempt native tier overwrite' }], /官方难度/);
    const removed = await invoke(page, 'removeProblemEnrichment', { url: URLS.AT, expectedRevision: 1 });
    assert.equal(removed.revision, 2);
    assert.equal(removed.supplement, null);
    assert.deepEqual((await invoke(page, 'dailyDraw', { source: 'AT' })).problem.tags, []);
    await rejected(page, 'dailyDraw', [{ source: 'AT', tags: ['最短路'], ratingMin: 1500, ratingMax: 1500 }], /没有符合条件/);
    const removedCatalog = await invoke(page, 'getDailyTagCatalog');
    assert.equal(removedCatalog.platforms.AT.tagged, 0);
    assert.ok(!removedCatalog.tags.some(tag => tag.name === '最短路'));

    assert.deepEqual(await invoke(page, 'getProblemAIStatus'), { configured: false, endpoint: null, model: null });
    if (!runtime.safeStorage) {
      await rejected(page, 'saveProblemAIConfig', [{ endpoint: ai.endpoint, model: 'synthetic-e2e-model', apiKey: SYNTHETIC_TEST_KEY }], /安全保存/);
      assert.equal(fs.existsSync(configFile), false);
      assert.equal(ai.requests.length, 0);
      aiResult = 'SKIP AI persistence/HTTP/acceptance: host safeStorage.isEncryptionAvailable() is false';
      console.log(aiResult);
    } else {
      const configured = await invoke(page, 'saveProblemAIConfig', { endpoint: ai.endpoint, model: 'synthetic-e2e-model', apiKey: SYNTHETIC_TEST_KEY });
      assert.deepEqual(configured, { configured: true, endpoint: `${ai.endpoint}/chat/completions`, model: 'synthetic-e2e-model' });
      assertNoSecret(configured);
      const diskConfig = fs.readFileSync(configFile, 'utf8');
      const encrypted = JSON.parse(diskConfig);
      assert.deepEqual(Object.keys(encrypted), ['encrypted']);
      assert.equal(typeof encrypted.encrypted, 'string');
      assert.ok(encrypted.encrypted.length > 20);
      assert.ok(!diskConfig.includes(SYNTHETIC_TEST_KEY));
      assert.ok(!Buffer.from(encrypted.encrypted, 'base64').includes(Buffer.from(SYNTHETIC_TEST_KEY)));
      // Validate the actual OS ciphertext without returning the decrypted key to Node/renderer.
      assert.equal(await app.evaluate(({ safeStorage }, { ciphertext, expected }) => {
        const decrypted = JSON.parse(safeStorage.decryptString(Buffer.from(ciphertext, 'base64')));
        return decrypted.apiKey === expected;
      }, { ciphertext: encrypted.encrypted, expected: SYNTHETIC_TEST_KEY }), true);
      assertNoSecret(await invoke(page, 'getProblemAIStatus'));
      assertNoSecret(await invoke(page, 'bootstrap'));
      // Relaunch the real app to prove encrypted config and manual tombstone persist.
      assert.deepEqual(await app.evaluate(() => globalThis.__enrichmentBlockedRequests), [], 'Unexpected third-party Chromium request attempted');
      await app.close(); app = undefined;
      ({ app, page } = await launch(profile));
      assert.deepEqual(await invoke(page, 'getProblemAIStatus'), configured);
      assert.equal((await invoke(page, 'getProblemEnrichment', URLS.AT)).revision, 2);
      assertNoSecret(await invoke(page, 'bootstrap'));
      const changedModel = await invoke(page, 'saveProblemAIConfig', { endpoint: ai.endpoint, model: 'synthetic-e2e-model-restored' });
      assert.equal(changedModel.configured, true);
      assertNoSecret(changedModel);
      const held = ai.holdNext();
      const generation = invoke(page, 'suggestProblemEnrichment', { url: URLS.AT, statementText: '给定带非负权的图，求起点到终点的最短路径。此为本地合成测试题面。' });
      // Observe errors immediately while the recorder holds the actual HTTP response.
      const generated = generation.then(value => ({ value }), error => ({ error }));
      let waitTimer;
      try {
        await Promise.race([held.ready, new Promise((_, reject) => { waitTimer = setTimeout(() => reject(new Error('Local AI HTTP request did not arrive')), 15000); })]);
      } finally { clearTimeout(waitTimer); }
      try {
        const configBeforeBusy = fs.readFileSync(configFile);
        await rejected(page, 'suggestProblemEnrichment', [{ url: URLS.AT, statementText: 'duplicate generation while busy' }], /操作正在进行|重复操作/);
        await rejected(page, 'clearProblemAIConfig', [], /操作正在进行|重复操作/);
        await rejected(page, 'saveProblemEnrichment', [{ url: URLS.AT, expectedRevision: 2, tags: ['贪心'], reason: 'busy save must not race AI' }], /操作正在进行|重复操作/);
        await rejected(page, 'saveSettings', [{ repo: 'synthetic-enrichment/other' }], /等待当前操作|操作正在进行/);
        assert.deepEqual(fs.readFileSync(configFile), configBeforeBusy);
        assert.equal((await invoke(page, 'getProblemEnrichment', URLS.CF)).officialDifficulty, '1200');
        assert.equal((await invoke(page, 'getProblemAIStatus')).configured, true);
        assert.equal(ai.requests.length, 1);
      } finally { held.release(); }
      const outcome = await generated;
      if (outcome.error) throw outcome.error;
      const pending = outcome.value;
      assert.equal(ai.requests.length, 1);
      const request = ai.requests[0];
      assert.equal(request.path, '/v1/chat/completions');
      assert.equal(request.method, 'POST');
      assert.equal(request.authorization, `Bearer ${SYNTHETIC_TEST_KEY}`);
      assert.equal(request.body.model, 'synthetic-e2e-model-restored');
      assert.equal(request.body.stream, false);
      assert.deepEqual(request.body.response_format, { type: 'json_object' });
      assert.deepEqual(JSON.parse(request.body.messages[1].content).requestedFields, ['tags', 'cfRating', 'luoguDifficulty', 'reason']);
      assert.equal(pending.revision, 2);
      assert.equal(pending.supplement, null);
      assert.equal(pending.suggestion.source, 'ai');
      assert.equal(pending.suggestion.status, 'pending');
      assert.deepEqual(pending.suggestion.tags, ['最短路']);
      assertNoSecret(pending);
      assert.deepEqual((await invoke(page, 'dailyDraw', { source: 'AT' })).problem.tags, []);
      await rejected(page, 'dailyDraw', [{ source: 'AT', tags: ['最短路'], ratingMin: 1500, ratingMax: 1500 }], /没有符合条件/);
      assert.ok(!(await invoke(page, 'getDailyTagCatalog')).tags.some(tag => tag.name === '最短路'));
      const suggestion = pending.suggestion;
      const acceptance = { url: URLS.AT, expectedRevision: 2, suggestionId: suggestion.id, tags: suggestion.tags, cfRating: suggestion.cfRating, luoguDifficulty: suggestion.luoguDifficulty, reason: suggestion.reason };
      await rejected(page, 'saveProblemEnrichment', [{ ...acceptance, reason: 'altered suggestion cannot be labeled AI' }], /内容不一致/);
      const accepted = await invoke(page, 'saveProblemEnrichment', acceptance);
      assert.equal(accepted.revision, 3);
      assert.equal(accepted.suggestion, null);
      assert.equal(accepted.supplement.source, 'ai');
      assert.equal(accepted.supplement.status, 'approved');
      assert.equal(accepted.supplement.model, 'synthetic-e2e-model-restored');
      const aiDraw = await invoke(page, 'dailyDraw', { source: 'AT', tags: ['最短路'], ratingMin: 1500, ratingMax: 1500 });
      assert.deepEqual(aiDraw.problem.supplementInfo, { source: 'ai', revision: 3, tags: true, difficulty: true });
      assert.match(aiDraw.problem.ratingEstimateReason, /AI 建议（已确认）/);
      assertNoSecret(aiDraw);
      assertNoSecret(await invoke(page, 'getProblemEnrichment', URLS.AT));
      const cleared = await invoke(page, 'clearProblemAIConfig');
      assert.deepEqual(cleared, { configured: false, endpoint: null, model: null });
      assert.deepEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')), {});
      assert.deepEqual(await invoke(page, 'getProblemAIStatus'), cleared);
      assertNoSecret(await invoke(page, 'bootstrap'));
      await rejected(page, 'suggestProblemEnrichment', [{ url: URLS.AT, statementText: 'synthetic statement after clear' }], /配置 AI/);
      assert.equal(ai.requests.length, 1);
      aiResult = 'PASS real OS safeStorage encrypted config, relaunch, localhost HTTP request, pending suggestion, exact acceptance, application, explicit clear';
    }

    // Both parse corruption and invalid schema must reject reads/writes without replacing bytes.
    for (const corrupt of ['{broken JSON\n', JSON.stringify({ schema: 999, records: {}, suggestions: {}, keep: 'original bytes' })]) {
      const bytes = Buffer.from(corrupt);
      fs.writeFileSync(enrichmentFile, bytes);
      await rejected(page, 'getProblemEnrichment', [URLS.AT], /缓存.*(?:读取失败|损坏|版本)/);
      assert.deepEqual(fs.readFileSync(enrichmentFile), bytes);
      await rejected(page, 'saveProblemEnrichment', [{ url: URLS.AT, expectedRevision: 0, tags: ['最短路'], reason: 'must preserve corrupt cache' }], /缓存.*(?:读取失败|损坏|版本)/);
      assert.deepEqual(fs.readFileSync(enrichmentFile), bytes);
      await rejected(page, 'removeProblemEnrichment', [{ url: URLS.AT, expectedRevision: 0 }], /缓存.*(?:读取失败|损坏|版本)/);
      assert.deepEqual(fs.readFileSync(enrichmentFile), bytes);
    }
    assertLibraryUnchanged(originals);
    assert.deepEqual(await app.evaluate(() => globalThis.__enrichmentBlockedRequests), [], 'Unexpected third-party Chromium request attempted');
    assert.equal(fs.existsSync(path.join(profile, 'auth.json')), false, 'No account credentials are used');
    assert.equal(fs.existsSync(path.join(profile, 'clist-auth.json')), false, 'No CLIST credentials are used');
    console.log('PASS real Electron enrichment IPC, default sandbox, sender guard, canonical resolver, manual persistence/filter/catalog, official protection, removal, corrupt-cache preservation, unchanged six shards');
    console.log(aiResult);
    console.log(JSON.stringify({ root: runtime.root, profile, sandbox: runtime.preferences.sandbox, contextIsolation: runtime.preferences.contextIsolation, nodeIntegration: runtime.preferences.nodeIntegration, safeStorage: runtime.safeStorage, localhostRequests: ai.requests.length }));
  } finally {
    // Clear credentials even if an earlier assertion fails. This touches only the fresh temp profile.
    if (app && page && !page.isClosed()) await invoke(page, 'clearProblemAIConfig').catch(() => {});
    if (app) await app.close();
    await new Promise(resolve => { ai.server.close(resolve); ai.server.closeAllConnections(); });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
