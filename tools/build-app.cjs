'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { main: buildReader } = require('./build-reading-detail.cjs');
const { main: buildPreload } = require('./build-preload.cjs');
const root = path.resolve(__dirname, '..');

function isRuntimeAsset(filename) {
  const name = path.basename(filename);
  return !['src', 'source'].includes(name) && !/\.(?:map|[cm]?ts)$/i.test(name);
}

// Preserve pnpm's per-package resolution and every production asset, including WASM.
function stageDependency(name, from, destination, ancestors = new Set()) {
  let search = from, manifest;
  while (true) {
    const candidate = path.join(search, 'node_modules', name, 'package.json');
    if (fs.existsSync(candidate)) { manifest = candidate; break; }
    const parent = path.dirname(search);
    if (parent === search) throw new Error(`Missing production dependency: ${name}`);
    search = parent;
  }
  const sourceDir = path.dirname(fs.realpathSync(manifest));
  if (ancestors.has(sourceDir)) throw new Error(`Cyclic production dependency: ${name}`);
  fs.cpSync(sourceDir, destination, {
    recursive: true, dereference: true,
    filter: file => path.basename(file) !== 'node_modules' && !/\.(?:map|[cm]?ts)$/i.test(file)
  });
  const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const next = new Set(ancestors).add(sourceDir);
  for (const child of Object.keys(metadata.dependencies || {})) {
    stageDependency(child, sourceDir, path.join(destination, 'node_modules', child), next);
  }
}
function main({ sourceMaps = process.env.QMX_SOURCE_MAPS === '1', outputRoot } = {}) {
  const output = path.resolve(outputRoot || path.join(root, 'build/app'));
  // Allow the normal build target or a named child in an isolated temporary fixture.
  if (output !== path.join(root, 'build/app')) {
    const relative = path.relative(root, output);
    const temporary = path.relative(path.resolve(os.tmpdir()), output);
    if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))
      || temporary.startsWith('..' + path.sep) || path.isAbsolute(temporary) || temporary.split(path.sep).length < 2) {
      throw new Error('Unexpected build target');
    }
  }
  for (let entry = output; ; entry = path.dirname(entry)) {
    if (fs.existsSync(entry) && fs.lstatSync(entry).isSymbolicLink()) throw new Error(`Linked build target: ${entry}`);
    if (path.dirname(entry) === entry) break;
  }
  // Every generator checks map-free tracked output even when its emitted dev map is requested.
  const options = { sourceMaps, outputRoot: output };
  const reader = buildReader(true, options);
  const preload = buildPreload(true, options);
  const boundaries = require('./build-ipc-boundary.cjs').main(true, options);
  const modules = require('./build-modules.cjs').main(true, options);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const name of ['electron', 'ui']) fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true, filter: isRuntimeAsset });
  if (sourceMaps) {
    for (const outputs of [reader, preload, boundaries, modules]) for (const [target, text] of outputs) {
      // The module generator also owns repository tools and server entrypoints.
      if (!target.startsWith('electron/') && !target.startsWith('ui/')) continue;
      fs.writeFileSync(path.join(output, target), text);
    }
  } else {
    fs.writeFileSync(path.join(output, 'ui/reading-detail.js'), reader);
    fs.writeFileSync(path.join(output, 'electron/preload.cjs'), preload);
  }
  fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify({
    name: pkg.name, version: pkg.version, main: pkg.main, dependencies: pkg.dependencies
  }, null, 2) + '\n');
  for (const name of Object.keys(pkg.dependencies)) stageDependency(name, root, path.join(output, 'node_modules', name));
  console.log(`Built application: ${output}`);
  return output;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error); process.exitCode = 1; } }
module.exports = { main, stageDependency };
