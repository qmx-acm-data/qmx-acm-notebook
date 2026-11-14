'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');

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
    await page.waitForFunction(() => typeof window.NotebookReadingDetail?.open === 'function' && window.notebook);
    const info = await app.evaluate(({ app }) => ({ root: app.getAppPath(), version: app.getVersion() }));
    const expectedRoot = packaged ? path.join(path.dirname(packaged), 'resources/app.asar') : built;
    assert.equal(path.resolve(info.root), path.resolve(expectedRoot));
    const reader = packaged
      ? require(require.resolve('@electron/asar', { paths: [require.resolve('@electron/packager')] })).extractFile(expectedRoot, 'ui/reading-detail.js').toString('utf8')
      : fs.readFileSync(path.join(info.root, 'ui/reading-detail.js'), 'utf8');
    assert.equal(reader, fs.readFileSync(path.join(built, 'ui/reading-detail.js'), 'utf8'), 'desktop and tests run identical compiled reader');
    assert.equal(info.version, require('../package.json').version);
    const loaded = await page.evaluate(async () => {
      if (typeof window.require !== 'undefined' || typeof window.process !== 'undefined') throw new Error('Renderer must remain isolated from Node');
      const bootstrap = await window.notebook.bootstrap();
      const boundary = window.NotebookIPC(window.notebook);
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
})().catch(error => { console.error(error); process.exitCode = 1; });
