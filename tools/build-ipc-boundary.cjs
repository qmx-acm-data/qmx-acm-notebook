'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { compileTarget } = require('./build-preload.cjs');
const root = path.resolve(__dirname, '..');
function main(check = process.argv.includes('--check')) {
  for (const [sourceName, target, commonjs] of [
    ['src/main/ipc/boundary.ts', 'electron/ipc-boundary.cjs', true],
    ['src/renderer/ipc/boundary.ts', 'ui/ipc-boundary.js', false]
  ]) {
    const output = compileTarget({ configName: 'tsconfig.boundary.json', sourceName,
      header: `// Generated from ${sourceName}; run pnpm ipc:build.\n`,
      validate(text) {
        if (/\brequire\s*\(|\bimport\s*\(|^export\s/m.test(text) || (!commonjs && /\b(?:exports|module)\b/.test(text))) throw new Error('IPC boundary must remain standalone');
      }
    });
    const filename = path.join(root, target);
    if (check) {
      if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n') !== output) throw new Error(`Generated ${target} differs; run pnpm ipc:build`);
    } else fs.writeFileSync(filename, output);
  }
  if (check) console.log('PASS generated IPC boundaries match strict TypeScript source');
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { main };
