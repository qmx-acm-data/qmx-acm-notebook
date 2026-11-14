'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { SourceMap } = require('node:module');
const { bundle } = require('../tools/browser-bundle.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-browser-bundle-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sources = {
    'src/normalize.ts': `globalThis.initializations = (globalThis.initializations || 0) + 1;
export function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}
`,
    'src/search.ts': `import { normalize } from './normalize';
const api = Object.freeze({ search: normalize, noDOM: typeof document === 'undefined' });
globalThis.originalAPI = api;
export { api as Search };
`
  };
  fs.mkdirSync(path.join(root, 'src'));
  for (const [name, text] of Object.entries(sources)) fs.writeFileSync(path.join(root, name), text);
  return { root, source: 'src/search.ts', target: 'ui/search.js', exportName: 'Search', globalName: 'NotebookSearch', sources };
}

function run(text, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(text, context);
  return context;
}

function assertAPI(context, api, noDOM) {
  assert.equal(api, context.originalAPI, 'adapter preserves the original API identity');
  assert.equal(Object.isFrozen(api), true);
  assert.deepEqual(Object.keys(api), ['search', 'noDOM']);
  assert.equal(api.search('ＡＢＣ'), 'abc');
  assert.equal(api.noDOM, noDOM);
  assert.equal(context.initializations, 1, 'the module is initialized once');
  assert.equal(context.__QMXStandalone, undefined, 'bundle namespace stays private');
}

test('standalone UMD exports the frozen API in Node without DOM or a runtime loader', t => {
  const options = fixture(t);
  const outputs = bundle({ ...options, commonjs: true });
  assert.deepEqual([...outputs.keys()], ['ui/search.js']);
  const text = outputs.get('ui/search.js');
  assert.doesNotMatch(text, /\brequire\s*\(|\bimport\s*(?:\(|[{'"*])|^\s*export\s/m);
  const context = run(text, { module: { exports: {} } });
  assertAPI(context, context.module.exports, true);
  assert.equal(context.NotebookSearch, undefined);
});

test('standalone UMD supports browser windows and DOM-free global fallback', t => {
  const options = fixture(t);
  const text = bundle({ ...options, commonjs: true }).get(options.target);
  const browser = run(text, { window: {}, document: {} });
  assertAPI(browser, browser.window.NotebookSearch, false);
  assert.equal(browser.NotebookSearch, undefined);
  const noDOM = run(text, {});
  assertAPI(noDOM, noDOM.NotebookSearch, true);
});

test('classic browser adapter attaches to the host even when a CommonJS object exists', t => {
  const options = fixture(t);
  const text = bundle(options).get(options.target);
  assert.doesNotMatch(text, /\bmodule\b|\brequire\s*\(|\bimport\s*(?:\(|[{'"*])|^\s*export\s/m);
  const exports = {};
  const context = run(text, { window: {}, module: { exports } });
  assertAPI(context, context.window.NotebookSearch, true);
  assert.equal(context.module.exports, exports);
  const noWindow = run(text, {});
  assertAPI(noWindow, noWindow.NotebookSearch, true);
});

test('external maps resolve only original TypeScript files and account for generated headers exactly', t => {
  const options = fixture(t);
  const outputRoot = path.join(options.root, 'staged/development');
  const header = '// Generated standalone API.\n// Two unmapped header lines.\n';
  const outputs = bundle({ ...options, source: path.join(options.root, options.source), commonjs: true, sourceMaps: true, outputRoot, header });
  assert.deepEqual([...outputs.keys()], ['ui/search.js', 'ui/search.js.map']);
  const text = outputs.get(options.target);
  const map = JSON.parse(outputs.get(options.target + '.map'));
  assert.equal(map.file, 'search.js');
  assert.ok(text.startsWith(header));
  assert.ok(text.endsWith('//# sourceMappingURL=search.js.map\n'));
  assert.ok(map.mappings.startsWith(';;'));
  assert.equal(map.sources.length, 2);
  const resolved = map.sources.map((source, index) => {
    assert.equal(path.isAbsolute(source), false);
    const original = path.resolve(outputRoot, path.dirname(options.target), source);
    assert.match(original, /\.ts$/);
    assert.equal(map.sourcesContent[index], fs.readFileSync(original, 'utf8'));
    return original;
  });
  assert.deepEqual(new Set(resolved), new Set(Object.keys(options.sources).map(name => path.join(options.root, name))));
  const decoded = new SourceMap(map);
  assert.deepEqual(decoded.findEntry(0, 0), {});
  assert.deepEqual(decoded.findEntry(1, 0), {});
  const lines = text.split('\n');
  for (const [source, marker] of [['src/search.ts', 'Object.freeze'], ['src/normalize.ts', 'value.normalize']]) {
    const generatedLine = lines.findIndex(line => line.includes(marker));
    const originalLine = options.sources[source].split('\n').findIndex(line => line.includes(marker));
    assert.ok(generatedLine >= 0 && originalLine >= 0);
    const entry = decoded.findEntry(generatedLine, lines[generatedLine].indexOf(marker));
    assert.equal(entry.originalLine, originalLine);
    assert.equal(entry.originalSource, map.sources[resolved.indexOf(path.join(options.root, source))]);
  }
  assert.equal(bundle({ ...options, commonjs: true, header }).get(options.target), text.replace(/\/\/# sourceMappingURL=.*\n$/, ''), 'map mode leaves the standalone JavaScript unchanged');
  const context = run(text, { module: { exports: {} } });
  assertAPI(context, context.module.exports, true);
  assert.equal(fs.existsSync(path.join(options.root, options.target)), false, 'bundling does not write emitted files');
});
