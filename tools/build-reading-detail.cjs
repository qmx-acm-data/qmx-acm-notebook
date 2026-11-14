'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'ui/reading-detail.js');

function compile() {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: false, noEmitOnError: true });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root, getCanonicalFileName: name => name, getNewLine: () => '\n'
  }));
  let output;
  const emitted = program.emit(undefined, (name, text) => {
    if (name.replaceAll('\\', '/').endsWith('/src/renderer/reading/reading-detail.js')) output = text;
  });
  if (emitted.emitSkipped || output === undefined) throw new Error('Reading detail did not emit');
  if (/\brequire\s*\(|\bexports\b|^export\s/m.test(output)) throw new Error('Reader must remain a standalone browser script');
  return '// Generated from src/renderer/reading/reading-detail.ts; run pnpm reader:build.\n' + output.replace(/\r\n/g, '\n');
}
function main(check = process.argv.includes('--check')) {
  const output = compile();
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) {
      throw new Error('Generated reader differs from TypeScript source; run pnpm reader:build');
    }
    console.log('PASS generated reader matches strict TypeScript source');
  } else fs.writeFileSync(target, output);
  return output;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { compile, main };
