'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { sourceMapOptions, stripSourceMapComment } = require('./source-maps.cjs');
const { bundle } = require('./browser-bundle.cjs');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'ui/reading-detail.js');

function compile(options = {}) {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, {
    ...parsed.options, ...sourceMapOptions(options.sourceMaps === true), strict: true, noEmit: true
  });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root, getCanonicalFileName: name => name, getNewLine: () => '\n'
  }));
  const outputs = bundle({ root, source: 'src/renderer/reading/reading-detail.ts', target: 'ui/reading-detail.js',
    exportName: 'ReadingDetail', globalName: 'NotebookReadingDetail',
    header: '// Generated from src/renderer/reading/reading-detail.ts; run pnpm reader:build.\n',
    sourceMaps: options.sourceMaps === true, outputRoot: options.outputRoot });
  return options.sourceMaps ? outputs : outputs.get('ui/reading-detail.js');
}
function main(check = process.argv.includes('--check'), options = {}) {
  const output = compile(options);
  const release = options.sourceMaps ? stripSourceMapComment(output.get('ui/reading-detail.js')) : output;
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== release) {
      throw new Error('Generated reader differs from TypeScript source; run pnpm reader:build');
    }
    console.log('PASS generated reader matches strict TypeScript source');
  } else if (!options.sourceMaps) fs.writeFileSync(target, output);
  return output;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { compile, main };
