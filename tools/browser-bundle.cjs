'use strict';
const path = require('node:path');
const { buildSync } = require('esbuild');
const { generatedOutput } = require('./source-maps.cjs');

// Type checking belongs to the caller. Keep the compatibility adapter outside the
// entry point so source maps contain only the original modules, never a fake source.
function bundle({ root, source, target, exportName, globalName, commonjs = false, sourceMaps = false, outputRoot, header = '' }) {
  root = path.resolve(root);
  const outfile = path.resolve(root, target);
  const api = `__QMXStandalone[${JSON.stringify(exportName)}]`;
  const browser = `(typeof window !== 'undefined' ? window : globalThis)[${JSON.stringify(globalName)}]`;
  const assignment = commonjs
    ? `if (typeof module === 'object' && module.exports) module.exports = ${api};\nelse ${browser} = ${api};`
    : `${browser} = ${api};`;
  const result = buildSync({
    absWorkingDir: root, entryPoints: [path.resolve(root, source)], outfile,
    bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022',
    globalName: '__QMXStandalone',
    // The outer closure keeps esbuild's export namespace private in classic scripts.
    banner: { js: '(function () {' }, footer: { js: assignment + '\n})();' },
    sourcemap: sourceMaps ? 'external' : false, sourcesContent: true,
    charset: 'utf8', legalComments: 'none', logLevel: 'silent'
  });
  const text = result.outputFiles.find(file => file.path === outfile)?.text;
  const mapText = result.outputFiles.find(file => file.path === outfile + '.map')?.text;
  if (text === undefined || (sourceMaps && mapText === undefined)) throw new Error(`Standalone bundle did not emit: ${source}`);
  return generatedOutput({ root, target, header, text, mapText, mapName: outfile + '.map', outputRoot });
}

module.exports = { bundle };
