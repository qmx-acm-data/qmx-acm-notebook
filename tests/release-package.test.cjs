'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { buildManifest } = require('../tools/update-manifest.cjs');
const { verifyFeed } = require('../tools/release-feed.cjs');

test('unsigned packaging stages the compiled application instead of source-tree runtime files', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-package-built-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const built = path.join(root, 'compiled-app');
  for (const dir of ['tools', 'electron', 'ui', 'docs', 'release/fixture-output', 'compiled-app/electron', 'compiled-app/ui', 'compiled-app/node_modules/fixture']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  const pkg = { name: 'fixture', version: '8.7.6', main: 'electron/main.cjs', dependencies: {} };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
  fs.writeFileSync(path.join(root, 'docs/USAGE.md'), 'fixture');
  fs.writeFileSync(path.join(root, 'electron/main.cjs'), 'uncompiled source entry');
  fs.writeFileSync(path.join(root, 'ui/app.js'), 'uncompiled source renderer');
  fs.writeFileSync(path.join(built, 'package.json'), JSON.stringify(pkg));
  fs.writeFileSync(path.join(built, 'electron/main.cjs'), 'compiled distinctive entry');
  fs.writeFileSync(path.join(built, 'ui/app.js'), 'compiled distinctive renderer');
  fs.writeFileSync(path.join(built, 'node_modules/fixture/asset.wasm'), 'compiled dependency asset');
  let builds = 0, packages = 0, staged;
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../tools/package.cjs'), 'utf8');
  const sandbox = {
    __dirname: path.join(root, 'tools'), module, console: { log() {} },
    process: { platform: 'win32', arch: 'x64', env: {} },
    require(name) {
      if (name === './build-app.cjs') return { main() { builds++; return built; } };
      if (name === '@electron/packager') return { packager: async options => {
        packages++;
        assert.equal(builds, 1, 'build completes before packager receives its input');
        staged = options.dir;
        assert.notEqual(staged, root);
        assert.notEqual(staged, built);
        assert.equal(options.prebuiltAsar, undefined);
        assert.equal(options.asar, true);
        assert.equal(fs.readFileSync(path.join(staged, 'electron/main.cjs'), 'utf8'), 'compiled distinctive entry');
        assert.equal(fs.readFileSync(path.join(staged, 'ui/app.js'), 'utf8'), 'compiled distinctive renderer');
        assert.equal(fs.readFileSync(path.join(staged, 'node_modules/fixture/asset.wasm'), 'utf8'), 'compiled dependency asset');
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(staged, 'package.json'), 'utf8')), pkg);
        return [path.join(root, 'release/fixture-output')];
      } };
      if (name === '../package.json') return pkg;
      if (name === 'electron/package.json') return { version: '40.2.1' };
      if (name === 'electron/checksums.json') return {};
      if (name === './release-feed.cjs') throw new Error('Unsigned fixture must not verify a signed feed');
      if (name === 'node:fs') return { ...fs, mkdtempSync: () => fs.mkdtempSync(path.join(root, 'stage-')) };
      return require(name);
    }
  };
  vm.runInNewContext(source, sandbox, { filename: 'package.cjs' });
  await module.exports.main();
  assert.equal(builds, 1);
  assert.equal(packages, 1);
  assert.ok(staged.startsWith(root + path.sep), 'packager stage stays in the disposable fixture');
});

for (const scenario of ['signed', 'tampered-input', 'tampered-output']) {
  test(`packager uses verified prebuiltAsar before integrity calculation: ${scenario}`, async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-package-test-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const dir of ['electron', 'ui', 'docs', 'tools', 'node_modules/electron', 'release/QMX-Notebook-win32-x64/resources']) fs.mkdirSync(path.join(root, dir), { recursive: true });
    const pkg = { name: 'fixture', version: '8.7.6', main: 'electron/main.cjs', dependencies: {} };
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    fs.writeFileSync(path.join(root, 'node_modules/electron/package.json'), JSON.stringify({ version: '40.2.1' }));
    fs.writeFileSync(path.join(root, 'docs/USAGE.md'), 'fixture');
    fs.writeFileSync(path.join(root, 'release/QMX-Notebook-win32-x64/resources/app.asar'), 'fixture-archive');
    const keys = crypto.generateKeyPairSync('ed25519');
    buildManifest({ rootDir: root, keyPem: keys.privateKey.export({ format: 'pem', type: 'pkcs8' }), publicKey: keys.publicKey });
    if (scenario === 'tampered-input') fs.appendFileSync(path.join(root, 'resources/app.asar'), 'tamper');
    let calls = 0;
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, '../tools/package.cjs'), 'utf8');
    const sandbox = {
      __dirname: path.join(root, 'tools'), module, console: { log() {} },
      process: { platform: 'win32', arch: 'x64', env: {} },
      require(name) {
        if (name === '@electron/packager') return { packager: async options => {
          calls++;
          assert.equal(options.prebuiltAsar, path.join(root, 'resources/app.asar'));
          assert.equal(options.asar, undefined);
          const output = path.join(root, 'release/QMX-Notebook-win32-x64');
          fs.copyFileSync(options.prebuiltAsar, path.join(output, 'resources/app.asar'));
          if (scenario === 'tampered-output') fs.appendFileSync(path.join(output, 'resources/app.asar'), 'tamper');
          return [output];
        } };
        if (name === '../package.json') return pkg;
        if (name === 'electron/package.json') return { version: '40.2.1' };
        if (name === 'electron/checksums.json') return {};
        if (name === './build-app.cjs') throw new Error('Signed packaging must not build application sources');
        if (name === './release-feed.cjs') return { verifyFeed: dir => verifyFeed(dir, { publicKey: keys.publicKey }) };
        if (name === 'node:fs') return { ...fs, mkdtempSync: () => fs.mkdtempSync(path.join(root, 'stage-')) };
        return require(name);
      }
    };
    vm.runInNewContext(source, sandbox, { filename: 'package.cjs' });
    if (scenario === 'signed') { await module.exports.main(); assert.equal(calls, 1); }
    else { await assert.rejects(module.exports.main(), /hash mismatch|differs from the signed feed/); assert.equal(calls, scenario === 'tampered-input' ? 0 : 1); }
  });
}
