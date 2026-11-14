'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stageDependency } = require('../tools/build-app.cjs');
const vm = require('node:vm');
const { compile } = require('../tools/build-reading-detail.cjs');

test('compiled reader loads as a classic browser script with no CommonJS globals', () => {
  const window = {};
  vm.runInNewContext(compile(), { window });
  assert.equal(typeof window.NotebookReadingDetail.open, 'function');
  assert.equal(typeof window.NotebookReadingDetail.closeAll, 'function');
  assert.equal(window.NotebookReadingDetail.open(), undefined);
  window.NotebookReadingDetail.closeAll();
});

test('build staging preserves scoped and nested dependency versions and assets without links', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-stage-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  function pkg(relative, metadata, files = {}) {
    const dir = path.join(fixture, relative); fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(metadata));
    for (const [name, value] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), value);
    return dir;
  }
  pkg('source/node_modules/shared', { name: 'shared', version: '1.0.0' });
  pkg('source/node_modules/@scope/engine', { name: '@scope/engine', dependencies: { shared: '*' } }, { 'engine.wasm': 'wasm' });
  pkg('source/node_modules/@scope/engine/node_modules/shared', { name: 'shared', version: '2.0.0' });
  const output = path.join(fixture, 'output/node_modules/@scope/engine');
  stageDependency('@scope/engine', path.join(fixture, 'source'), output);
  assert.equal(fs.readFileSync(path.join(output, 'engine.wasm'), 'utf8'), 'wasm');
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'node_modules/shared/package.json'))).version, '2.0.0');
  for (const entry of fs.readdirSync(path.join(fixture, 'output'), { recursive: true, withFileTypes: true })) assert.equal(entry.isSymbolicLink(), false);
  assert.throws(() => stageDependency('missing', path.join(fixture, 'source'), path.join(fixture, 'missing')), /Missing production dependency/);
});
