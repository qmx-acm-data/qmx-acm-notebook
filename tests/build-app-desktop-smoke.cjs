'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { _electron: electron } = require('playwright');

async function waitForApp(page) {
  await page.locator('#home-panel .home-intro h2').waitFor({ state: 'visible' });
  await page.locator('.sidebar-rail .rail-nav-item[data-view="home"]').waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.notebook && !['正在准备学习空间', '正在载入…'].includes(document.querySelector('#sync-status')?.textContent));
  assert.deepEqual(await page.evaluate(() => ({
    require: typeof window.require,
    process: typeof window.process,
    internalGlobals: Object.getOwnPropertyNames(window).filter(name => name.startsWith('Notebook') || name === 'ReadingDetail')
  })), { require: 'undefined', process: 'undefined', internalGlobals: [] }, 'app renders with Node isolation and no internal API globals');
}

async function loadTestAdapters(page, appRoot) {
  // Standalone entry points are exercised explicitly by the test, after the app
  // has rendered without them; the app bundle uses its own explicit imports.
  for (const filename of ['ipc-boundary.js', 'local-records.js']) {
    await page.addScriptTag({ url: pathToFileURL(path.join(appRoot, 'ui', filename)).href });
  }
  await page.evaluate(() => {
    window.__desktopSmokeAdapters = { createNotebookIPC: window.NotebookIPC, createNormalizer: window.NotebookLocal.createNormalizer };
    delete window.NotebookIPC;
    delete window.NotebookLocal;
  });
}

(async () => {
  const root = path.resolve(__dirname, '..');
  const built = path.join(root, 'build/app');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-ts-build-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ autoSync: false }));
  const env = { ...process.env, QMX_USER_DATA_DIR: profile }; delete env.ELECTRON_RUN_AS_NODE;
  const packaged = process.env.QMX_PACKAGED_EXE;
  const app = await electron.launch({ executablePath: packaged || require('electron'), args: packaged ? ['--disable-gpu'] : [built, '--disable-gpu'], env });
  try {
    const page = await app.firstWindow();
    await waitForApp(page);
    const info = await app.evaluate(({ app }) => ({ root: app.getAppPath(), version: app.getVersion() }));
    const expectedRoot = packaged ? path.join(path.dirname(packaged), 'resources/app.asar') : built;
    assert.equal(path.resolve(info.root), path.resolve(expectedRoot));
    const reader = packaged
      ? require(require.resolve('@electron/asar', { paths: [require.resolve('@electron/packager')] })).extractFile(expectedRoot, 'ui/reading-detail.js').toString('utf8')
      : fs.readFileSync(path.join(info.root, 'ui/reading-detail.js'), 'utf8');
    assert.equal(reader, fs.readFileSync(path.join(built, 'ui/reading-detail.js'), 'utf8'), 'desktop and tests run identical compiled reader');
    assert.equal(info.version, require('../package.json').version);
    await loadTestAdapters(page, info.root);
    const loaded = await page.evaluate(async () => {
      const boundary = window.__desktopSmokeAdapters.createNotebookIPC(window.notebook);
      const bootstrap = await boundary.bootstrap();
      const record = { id: 'local:ts-record', kind: 'local', clientId: '5c07e37b-b6bb-4ded-a27b-da13cc897bee', ownerId: null, title: 'TypeScript persistence check', opaque: { legacy: ['keep', 0, null] } };
      const saved = await boundary.updateLocal({ records: [record], favorites: [record.id], mastery: {}, draft: { extra: { preserved: true } }, learningPaths: { legacy: { progress: 0 } }, customRoot: { unknown: true } });
      if (JSON.stringify(saved.records) !== JSON.stringify([record]) || !saved.customRoot?.unknown) throw new Error('Local IPC must retain unknown metadata');
      const normalized = window.__desktopSmokeAdapters.createNormalizer(() => 'unused')(saved);
      if (normalized.records[0].clientId !== record.clientId || normalized.records[0].opaque.legacy[1] !== 0) throw new Error('Typed normalization must preserve local fields');
      await boundary.cancelLogin();
      const stopAuth = window.notebook.onAuthProgress(() => {});
      const stopUpdate = window.notebook.onUpdateProgress(() => {});
      stopAuth(); stopUpdate();
      const invalid = await boundary.formatCode('original input', 'unsupported');
      if (invalid.code !== 'original input' || !invalid.error) throw new Error('Formatter failure must retain original input');
      const results = [];
      for (const [language, code] of [['cpp', 'int main(){return 0;}'], ['python', 'x=1\n'], ['rust', 'fn main(){let x=1;}']]) {
        results.push({ language, ...(await boundary.formatCode(code, language)) });
      }
      return { version: bootstrap.appVersion, results };
    });
    assert.equal(loaded.version, info.version);
    for (const result of loaded.results) { assert.equal(result.error, undefined, JSON.stringify(result)); assert.ok(result.code.length); }
    // Every staged dependency resolves within the stage, with no junction back to source.
    const dependencyRoot = path.join(built, 'node_modules');
    for (const entry of fs.readdirSync(dependencyRoot, { recursive: true, withFileTypes: true })) assert.equal(entry.isSymbolicLink(), false);
    for (const excluded of ['src', 'types', 'tests', 'docs', 'auth.json', 'local.json', 'node_modules/typescript']) assert.equal(fs.existsSync(path.join(built, excluded)), false, excluded);
    console.log('PASS built Electron app: real preload, bootstrap, staged root, C++/Python/Rust offline formatters, production-only dependencies');
  } finally { await app.close(); }
  const restarted = await electron.launch({ executablePath: packaged || require('electron'), args: packaged ? ['--disable-gpu'] : [built, '--disable-gpu'], env });
  try {
    const page = await restarted.firstWindow();
    await waitForApp(page);
    await page.locator('.sidebar-rail .rail-nav-item[data-view="public"]').click();
    await page.locator('#library-local-button').click();
    await page.locator('#record-list').getByRole('heading', { name: 'TypeScript persistence check', exact: true }).waitFor({ state: 'visible' });
    const restored = await page.evaluate(async () => (await window.notebook.bootstrap()).local);
    assert.equal(restored.records[0].id, 'local:ts-record');
    assert.deepEqual(restored.records[0].opaque, { legacy: ['keep', 0, null] });
    assert.deepEqual(restored.customRoot, { unknown: true });
    assert.deepEqual(restored.draft, { extra: { preserved: true } });
    assert.deepEqual(restored.learningPaths, { legacy: { progress: 0 } });
    console.log('PASS typed local IPC: unknown metadata, normalization, disk save and real restart');
  } finally { await restarted.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
