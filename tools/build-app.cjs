'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { main: buildReader } = require('./build-reading-detail.cjs');
const root = path.resolve(__dirname, '..');

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
    recursive: true, dereference: true, filter: file => path.basename(file) !== 'node_modules'
  });
  const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const next = new Set(ancestors).add(sourceDir);
  for (const child of Object.keys(metadata.dependencies || {})) {
    stageDependency(child, sourceDir, path.join(destination, 'node_modules', child), next);
  }
}
function main() {
  const output = path.join(root, 'build', 'app');
  // Exact allowlisted target; never follow an existing junction during cleanup.
  if (output !== path.join(root, 'build/app')) throw new Error('Unexpected build target');
  const buildDir = path.dirname(output);
  for (const entry of [buildDir, output]) {
    if (fs.existsSync(entry) && fs.lstatSync(entry).isSymbolicLink()) throw new Error(`Linked build target: ${entry}`);
  }
  const reader = buildReader(true); // Drift check does not rewrite source-tree output.
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const name of ['electron', 'ui']) fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
  fs.writeFileSync(path.join(output, 'ui/reading-detail.js'), reader);
  fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify({
    name: pkg.name, version: pkg.version, main: pkg.main, dependencies: pkg.dependencies
  }, null, 2) + '\n');
  for (const name of Object.keys(pkg.dependencies)) stageDependency(name, root, path.join(output, 'node_modules', name));
  console.log(`Built application: ${output}`);
  return output;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error); process.exitCode = 1; } }
module.exports = { main, stageDependency };
