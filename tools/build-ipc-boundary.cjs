'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { compileTarget } = require('./build-preload.cjs');
const { stripSourceMapComment } = require('./source-maps.cjs');
const { bundle } = require('./browser-bundle.cjs');
const root = path.resolve(__dirname, '..');
function main(check = process.argv.includes('--check'), options = {}) {
  const outputs = new Map();
  for (const [sourceName, target, exportName, globalName] of [
    ['src/main/ipc/boundary.ts', 'electron/ipc-boundary.cjs'],
    ['src/renderer/ipc/boundary.ts', 'ui/ipc-boundary.js', 'createNotebookIPC', 'NotebookIPC'],
    ['src/renderer/records/local.ts', 'ui/local-records.js', 'LocalRecords', 'NotebookLocal']
  ]) {
    const header = `// Generated from ${sourceName}; run pnpm ipc:build.\n`;
    // The main target checks the entire strict boundary program before any bundle.
    let output;
    if (!exportName) {
      output = compileTarget({ ...options, configName: 'tsconfig.boundary.json', sourceName, targetName: target, header,
        validate(text) {
          if (/\brequire\s*\(|\bimport\s*\(|^export\s/m.test(text)) throw new Error('IPC boundary must remain standalone');
        }
      });
    } else {
      const bundled = bundle({ root, source: sourceName, target, exportName, globalName, header,
        sourceMaps: options.sourceMaps === true, outputRoot: options.outputRoot });
      output = options.sourceMaps ? bundled : bundled.get(target);
    }
    const filename = path.join(root, target);
    const release = options.sourceMaps ? stripSourceMapComment(output.get(target)) : output;
    if (check) {
      if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n') !== release) throw new Error(`Generated ${target} differs; run pnpm ipc:build`);
    } else if (!options.sourceMaps) fs.writeFileSync(filename, output);
    if (options.sourceMaps) for (const [name, text] of output) outputs.set(name, text);
    else outputs.set(target, output);
  }
  if (check) console.log('PASS generated IPC boundaries match strict TypeScript source');
  return outputs;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { main };
