'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { main: buildApp, stageDependency } = require('../tools/build-app.cjs');
const { SourceMap } = require('node:module');
const { compile: compilePreload } = require('../tools/build-preload.cjs');
const vm = require('node:vm');
const { compile } = require('../tools/build-reading-detail.cjs');

test('build staging rejects source-tree and non-fixture cleanup targets', () => {
  assert.throws(() => buildApp({ outputRoot: path.resolve(__dirname, '../ui') }), /Unexpected build target/);
  assert.throws(() => buildApp({ outputRoot: os.tmpdir() }), /Unexpected build target/);
  assert.throws(() => buildApp({ outputRoot: path.join(os.tmpdir(), 'qmx-parent-only') }), /Unexpected build target/);
});

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
  pkg('source/node_modules/@scope/engine/src', {}, { 'runtime.js': 'runtime', 'runtime.js.map': '{}', 'types.d.ts': 'types' });
  pkg('source/node_modules/@scope/engine', { name: '@scope/engine', dependencies: { shared: '*' } }, { 'engine.wasm': 'wasm' });
  pkg('source/node_modules/@scope/engine/node_modules/shared', { name: 'shared', version: '2.0.0' });
  const output = path.join(fixture, 'output/node_modules/@scope/engine');
  stageDependency('@scope/engine', path.join(fixture, 'source'), output);
  assert.equal(fs.readFileSync(path.join(output, 'engine.wasm'), 'utf8'), 'wasm');
  assert.equal(fs.readFileSync(path.join(output, 'src/runtime.js'), 'utf8'), 'runtime');
  assert.equal(fs.existsSync(path.join(output, 'src/runtime.js.map')), false);
  assert.equal(fs.existsSync(path.join(output, 'src/types.d.ts')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'node_modules/shared/package.json'))).version, '2.0.0');
  for (const entry of fs.readdirSync(path.join(fixture, 'output'), { recursive: true, withFileTypes: true })) assert.equal(entry.isSymbolicLink(), false);
  assert.throws(() => stageDependency('missing', path.join(fixture, 'source'), path.join(fixture, 'missing')), /Missing production dependency/);
});

function assertMappedOutput(outputs, target, outputRoot, sourceName, marker) {
  const js = outputs.get(target);
  const map = JSON.parse(outputs.get(target + '.map'));
  assert.ok(js.endsWith(`//# sourceMappingURL=${path.basename(target)}.map\n`));
  assert.equal(map.file, path.basename(target));
  assert.equal(map.mappings.startsWith(';'), true, 'generated header has no source mapping');
  const source = path.resolve(__dirname, '..', sourceName);
  assert.equal(path.resolve(outputRoot, path.dirname(target), map.sources[0]), source);
  assert.equal(map.sourcesContent[0], fs.readFileSync(source, 'utf8'));
  const generatedLine = js.split('\n').findIndex(line => line.includes(marker));
  const originalLine = map.sourcesContent[0].split('\n').findIndex(line => line.includes(marker));
  assert.ok(generatedLine > 0 && originalLine >= 0);
  const decoded = new SourceMap(map);
  assert.deepEqual(decoded.findEntry(0, 0), {}, 'generated header stays unmapped');
  const entry = decoded.findEntry(generatedLine, js.split('\n')[generatedLine].indexOf(marker));
  assert.equal(entry.originalSource, map.sources[0], 'mapped statement belongs to the original TypeScript module');
  assert.equal(entry.originalLine, originalLine, 'mapping accounts for the generated header exactly');
  if (marker === 'stack') {
    assert.equal(entry.originalColumn, map.sourcesContent[0].split('\n')[originalLine].indexOf(marker), 'bundled declaration maps to the original identifier column');
  }
}

test('development reader and sandbox preload maps resolve original TypeScript at exact generated lines', () => {
  const outputRoot = path.resolve(__dirname, '../build/app');
  const reader = compile({ sourceMaps: true, outputRoot });
  assert.equal(path.isAbsolute(JSON.parse(reader.get('ui/reading-detail.js.map')).sources[0]), false);
  assertMappedOutput(reader, 'ui/reading-detail.js', outputRoot, 'src/renderer/reading/reading-detail.ts', 'stack');
  const window = {};
  vm.runInNewContext(reader.get('ui/reading-detail.js'), { window });
  assert.equal(typeof window.NotebookReadingDetail.open, 'function');
  const preload = compilePreload({ sourceMaps: true, outputRoot });
  assertMappedOutput(preload, 'electron/preload.cjs', outputRoot, 'src/preload/preload.ts', 'const { contextBridge');
  let bridge;
  const loads = [];
  vm.runInNewContext(preload.get('electron/preload.cjs'), { require(name) {
    loads.push(name);
    return { contextBridge: { exposeInMainWorld(_name, value) { bridge = value; } }, ipcRenderer: {} };
  } });
  assert.deepEqual(loads, ['electron']);
  assert.equal(typeof bridge.bootstrap, 'function');
});

test('application staging emits development maps only in output and drops them for release', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-build-map-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const root = path.resolve(__dirname, '..');
  const outputRoot = path.join(fixture, 'app');
  const originals = new Map();
  for (const directory of ['electron', 'ui']) {
    for (const filename of fs.readdirSync(path.join(root, directory), { recursive: true })) {
      const full = path.join(root, directory, filename);
      if (fs.statSync(full).isFile()) originals.set(full, fs.readFileSync(full));
    }
  }
  assert.equal(buildApp({ sourceMaps: true, outputRoot }), outputRoot);
  for (const [target, source, marker] of [
    ['ui/reading-detail.js', 'src/renderer/reading/reading-detail.ts', 'stack'],
    ['electron/preload.cjs', 'src/preload/preload.ts', 'const { contextBridge'],
    ['electron/ipc-boundary.cjs', 'src/main/ipc/boundary.ts', 'function registerBoundary'],
    ['ui/search.js', 'src/renderer/lib/search.ts', 'function text']
  ]) {
    const outputs = new Map([target, target + '.map'].map(name => [name, fs.readFileSync(path.join(outputRoot, name), 'utf8')]));
    assertMappedOutput(outputs, target, outputRoot, source, marker);
  }
  for (const filename of fs.readdirSync(outputRoot, { recursive: true }).filter(name => name.endsWith('.map'))) {
    const mapPath = path.join(outputRoot, filename);
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    assert.equal(map.mappings.startsWith(';'), true);
    for (const [index, source] of map.sources.entries()) {
      // Windows temporary fixtures may live on a different drive from the checkout.
      if (path.parse(root).root === path.parse(outputRoot).root) assert.equal(path.isAbsolute(source), false);
      const original = path.resolve(path.dirname(mapPath), source);
      assert.equal(map.sourcesContent[index], fs.readFileSync(original, 'utf8'));
      assert.match(path.relative(root, original).replaceAll('\\', '/'), /^src\/.+\.[cm]?ts$/);
    }
  }
  for (const [filename, content] of originals) assert.deepEqual(fs.readFileSync(filename), content, 'development staging leaves tracked originals intact');
  buildApp({ sourceMaps: false, outputRoot });
  for (const filename of fs.readdirSync(outputRoot, { recursive: true })) {
    assert.doesNotMatch(filename, /\.(?:map|[cm]?ts)$/i);
    if (!filename.startsWith('node_modules' + path.sep)) assert.equal(filename.split(path.sep).some(part => ['src', 'source'].includes(part)), false);
  }
  for (const directory of ['electron', 'ui']) for (const filename of fs.readdirSync(path.join(outputRoot, directory), { recursive: true })) {
    if (/\.(?:cjs|js)$/.test(filename)) assert.doesNotMatch(fs.readFileSync(path.join(outputRoot, directory, filename), 'utf8'), /sourceMappingURL=/);
  }
});
