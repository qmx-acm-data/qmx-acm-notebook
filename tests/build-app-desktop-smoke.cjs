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
  const app = await electron.launch({ executablePath: require('electron'), args: [built, '--disable-gpu'], env });
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => typeof window.NotebookReadingDetail?.open === 'function' && window.notebook);
    const info = await app.evaluate(({ app }) => ({ root: app.getAppPath(), version: app.getVersion() }));
    assert.equal(path.resolve(info.root), built);
    assert.equal(info.version, require('../package.json').version);
    const loaded = await page.evaluate(async () => {
      const bootstrap = await window.notebook.bootstrap();
      const results = [];
      for (const [language, code] of [['cpp', 'int main(){return 0;}'], ['python', 'x=1\n'], ['rust', 'fn main(){let x=1;}']]) {
        results.push({ language, ...(await window.notebook.formatCode(code, language)) });
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
