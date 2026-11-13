'use strict';
// Run with node tests/release-125-smoke.cjs after building 1.2.5.
// Uses only a newly created temporary profile. QMX_SMOKE_EXE may select the package.
const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..');
  const executablePath = process.env.QMX_SMOKE_EXE || path.join(root, 'release/QMX-Notebook-win32-x64/QMX-Notebook.exe');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-release125-'));
  const screenshots = path.join(root, 'screenshots');
  fs.mkdirSync(screenshots, { recursive: true });
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ autoSync: false }));
  const env = { ...process.env, QMX_USER_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const errors = [];
  const shots = [];
  let app;
  async function launch() {
    app = await electron.launch({ executablePath, args: ['--disable-gpu', '--no-sandbox'], env, timeout: 45000 });
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), profile);
    const page = await app.firstWindow();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => typeof window.notebook?.bootstrap === 'function' && document.querySelector('#sync-status').textContent !== '正在准备学习空间');
    return page;
  }
  async function shot(page, name) {
    const target = path.join(screenshots, `release125-${name}.png`);
    await page.screenshot({ path: target });
    shots.push(target);
  }
  async function navigate(page, view) {
    await page.locator(`.rail-nav-item[data-view="${view}"]`).click();
    await page.waitForFunction(view => document.querySelector(`.rail-nav-item[data-view="${view}"]`)?.getAttribute('aria-current') === 'page', view);
  }
  try {
    let page = await launch();
    const initial = await page.evaluate(() => window.notebook.bootstrap());
    assert.equal(initial.appVersion, '1.2.5');
    assert.equal(initial.account, null);
    assert.equal(initial.settings.repo, 'qmx-acm-data/2026');
    assert.equal(initial.settings.serverUrl, '');
    assert.equal(initial.settings.autoSync, false);
    assert.equal(initial.local.records.length, 0);
    assert.equal(await page.locator('.home-shortcut[data-view="mine"]').count(), 0);
    await navigate(page, 'public');
    await page.locator('#library-local-button').click();
    assert.equal(await page.locator('#library-local-button').getAttribute('aria-pressed'), 'true');
    await page.click('#submit-button');
    const form = page.locator('#submit-form');
    await form.locator('[name="url"]').fill('https://www.luogu.com.cn/problem/P1001');
    await form.locator('[name="title"]').fill('1.2.5 验收：整数求和与类型边界');
    await form.locator('[name="pid"]').fill('P1001');
    await form.locator('[name="platform"]').selectOption('LG');
    await form.locator('[name="body"]').fill('# 整数求和\n\n验收资料仅保存在隔离目录。\n\n<span style="color:#2f80ed">先分析边界，再选择类型。</span>\n\n$$a+b=b+a$$\n\n```cpp\nlong long a, b;\ncin >> a >> b;\ncout << a + b;\n```');
    await page.click('#save-local-button');
    await page.waitForFunction(() => !document.querySelector('#submit-dialog').open);
    await page.getByRole('button', { name: '☆ 收藏', exact: true }).click();
    await page.waitForFunction(async () => (await window.notebook.bootstrap()).local.favorites.length === 1);
    const saved = await page.evaluate(() => window.notebook.bootstrap());
    assert.equal(saved.local.records.length, 1);
    assert.equal(saved.local.records[0].kind, 'local');
    assert.equal(saved.local.records[0].ownerId, null);
    for (const theme of ['light', 'dark', 'cards']) {
      await page.selectOption('#theme-select', theme);
      await page.waitForFunction(theme => document.body.dataset.theme === theme, theme);
      await shot(page, `local-${theme}`);
    }
    await page.selectOption('#theme-select', 'light');
    await navigate(page, 'favorites');
    assert.match(await page.locator('#record-list').innerText(), /1\.2\.5 验收/);
    await page.click('#settings-button');
    await page.locator('#repo-fieldset details').evaluate(node => { node.open = true; });
    await page.fill('#new-repo-name', '隔离验收 Gitea');
    await page.fill('#new-repo-server', 'http://127.0.0.1:9');
    await page.fill('#new-repo-path', 'acceptance/notebook');
    await page.click('#new-repo-add-btn');
    const custom = page.locator('.repo-card-item').filter({ hasText: '隔离验收 Gitea' });
    await custom.getByRole('button', { name: '设为当前', exact: true }).click();
    assert.match(await custom.innerText(), /当前使用/);
    await shot(page, 'repositories');
    // Test tentative selection, then restore official before persisting: changing
    // the live source intentionally syncs even with autoSync:false.
    await page.locator('.repo-card-item').filter({ hasText: '官方公共题库' }).getByRole('button', { name: '设为当前', exact: true }).click();
    await page.locator('#settings-form [name="autoSync"]').uncheck();
    await page.locator('#settings-form button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#settings-dialog').open);
    await page.waitForFunction(async () => (await window.notebook.bootstrap()).settings.repositories.some(repo => repo.repo === 'acceptance/notebook'));
    const configured = await page.evaluate(() => window.notebook.bootstrap());
    assert.equal(configured.settings.repo, 'qmx-acm-data/2026');
    assert.equal(configured.settings.autoSync, false);
    assert.equal(configured.settings.repositories.find(repo => repo.repo === 'acceptance/notebook').serverUrl, 'http://127.0.0.1:9');
    await page.click('.sidebar-rail .sidebar-bottom');
    assert.equal(await page.locator('#app-version').innerText(), '1.2.5');
    assert(await page.locator('#update-status').isVisible());
    assert(await page.locator('#check-update-button').isEnabled());
    assert(await page.locator('#account-login').isVisible());
    await shot(page, 'account-update');
    await page.click('[data-close="account-dialog"]');

    // Exercise the updater loaded from the actual ASAR under Electron, so its
    // original-fs path is tested. Responses come exclusively from signed local
    // 1.2.2/1.2.3/1.2.4 release fixtures; no installer or external write runs.
    const fixturesAvailable = ['.official-122/resources/app.asar', '.official-123/feed/manifest.json', '.historical-delta/feed/delta.json']
      .every(file => fs.existsSync(path.join(root, file)));
    let chain = { skipped: 'Official release fixtures not present in this checkout' };
    if (fixturesAvailable) {
      chain = await app.evaluate(async ({ app }, root) => {
        const load = process.mainModule.require.bind(process.mainModule);
        const raw = load('original-fs');
        const path = load('node:path');
        const crypto = load('node:crypto');
        const { Readable } = load('node:stream');
        const createUpdater = load(path.join(app.getAppPath(), 'electron/updater.cjs'));
        const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
        const json = file => JSON.parse(raw.readFileSync(path.join(root, file), 'utf8'));
        const latest = json('feed/manifest.json');
        if (latest.version !== '1.2.4') return { skipped: 'Signed fixture target is no longer 1.2.4' };
        const latestDelta = json('feed/delta.json');
        const older = json('.official-123/feed/manifest.json');
        const olderDelta = json('.historical-delta/feed/delta.json');
        const installed = path.join(root, '.official-122/resources/app.asar');
        const before = hash(raw.readFileSync(installed));
        const sha = 'a'.repeat(40), old = 'b'.repeat(40);
        const response = value => ({ ok: true, status: 200, headers: new Headers(), body: Readable.from([Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))]) });
        let patchBytes = 0, fullDownloads = 0;
        const updater = createUpdater({ currentVersion: '1.2.2', runtimeVersion: process.versions.electron, installedArchive: installed,
          downloadDir: path.join(app.getPath('userData'), 'chain-smoke'), fetcher: async url => {
            if (url.endsWith('/commits/main')) return response({ sha });
            if (url.includes('/commits?')) return response([{ sha: old }]);
            const historical = url.includes(old);
            if (url.includes('feed/manifest.json')) return response(historical ? older : latest);
            if (url.includes('feed/delta.json')) return response(historical ? olderDelta : latestDelta);
            if (url.includes('resources/deltas/')) {
              const name = url.split('resources/deltas/')[1].split('?')[0];
              const bytes = raw.readFileSync(path.join(root, historical ? '.historical-delta' : '', 'resources/deltas', name));
              patchBytes += bytes.length;
              return response(bytes);
            }
            if (url.includes('resources/app.asar')) { fullDownloads++; return response(raw.readFileSync(path.join(root, 'resources/app.asar'))); }
            throw new Error('Unexpected fixture request');
          }
        });
        const checked = await updater.check();
        const ready = await updater.download();
        await updater.verifyReady();
        return { steps: checked.deltaSteps, kind: checked.downloadKind, patchBytes, fullDownloads, version: ready.version,
          finalHash: hash(raw.readFileSync(ready.path)), expectedHash: latest.files[0].sha256, installedUnchanged: before === hash(raw.readFileSync(installed)) };
      }, root);
      if (!chain.skipped) {
        assert.equal(chain.steps, 2); assert.equal(chain.kind, 'delta'); assert.equal(chain.patchBytes, 272526);
        assert.equal(chain.fullDownloads, 0); assert.equal(chain.version, '1.2.4');
        assert.equal(chain.finalHash, chain.expectedHash); assert.equal(chain.installedUnchanged, true);
      }
    }
    await app.close(); app = null;
    page = await launch();
    const restored = await page.evaluate(() => window.notebook.bootstrap());
    assert.equal(restored.appVersion, '1.2.5');
    assert.equal(restored.account, null);
    assert.deepEqual(restored.local.records, saved.local.records);
    assert.deepEqual(restored.local.favorites, saved.local.favorites);
    assert.equal(restored.settings.repositories.some(repo => repo.repo === 'acceptance/notebook'), true);
    assert.equal(restored.settings.repo, 'qmx-acm-data/2026');
    await navigate(page, 'public');
    await page.click('#library-local-button');
    assert.match(await page.locator('#record-list').innerText(), /1\.2\.5 验收/);
    await page.locator('.record-card').first().click();
    await shot(page, 'desktop-ready');
    assert.deepEqual(errors, []);
    console.log('RELEASE 1.2.5 PACKAGED PASS', JSON.stringify({ executablePath, profile, screenshots: shots, chain,
      checks: ['actual packaged bootstrap', 'isolated userData', 'anonymous official default', 'sidebar public/local/favorites', 'local save and favorite', 'three themes', 'repository add and tentative selection', 'restart persistence', 'account/update UI'] }));
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
