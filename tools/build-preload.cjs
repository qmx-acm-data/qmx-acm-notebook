'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'electron/preload.cjs');

function assertStandalone(output) {
  const emitted = ts.createSourceFile('preload.js', output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isExportAssignment(node)
      || node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      throw new Error('Preload must remain a standalone sandbox script');
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      throw new Error('Preload must not load runtime imports');
    }
    if (ts.isIdentifier(node) && node.text === 'require') {
      const call = node.parent;
      if (!ts.isCallExpression(call) || call.expression !== node || call.arguments.length !== 1
        || !ts.isStringLiteral(call.arguments[0]) || call.arguments[0].text !== 'electron') {
        throw new Error("Preload may only load require('electron')");
      }
    }
    if (ts.isIdentifier(node) && (node.text === 'exports' || node.text === 'module')) {
      throw new Error('Preload must not depend on CommonJS exports globals');
    }
    ts.forEachChild(node, visit);
  }
  visit(emitted);
}

function compileTarget({ configName = 'tsconfig.preload.json', sourceName, header, validate }) {
  const source = path.join(root, sourceName);
  const configPath = path.join(root, configName);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  const program = ts.createProgram(parsed.fileNames, {
    ...parsed.options, strict: true, noEmit: false, noEmitOnError: true
  });
  const formatHost = {
    getCurrentDirectory: () => root, getCanonicalFileName: name => name, getNewLine: () => '\n'
  };
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
  let output;
  const emitted = program.emit(undefined, (name, text, _writeByteOrderMark, _onError, sourceFiles) => {
    if (name.endsWith('.js') && sourceFiles?.some(file => path.resolve(file.fileName) === source)) output = text;
  });
  if (emitted.diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(emitted.diagnostics, formatHost));
  if (emitted.emitSkipped || output === undefined) throw new Error(`${sourceName} did not emit`);
  if (validate) validate(output);
  return header + output.replace(/\r\n/g, '\n');
}

function compile() {
  return compileTarget({
    sourceName: 'src/preload/preload.ts',
    header: '// Generated from src/preload/preload.ts; run pnpm preload:build.\n',
    validate: assertStandalone
  });
}

function main(check = process.argv.includes('--check')) {
  const output = compile();
  if (check) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== output) {
      throw new Error('Generated preload differs from TypeScript source; run pnpm preload:build');
    }
    console.log('PASS generated preload matches strict TypeScript source');
  } else fs.writeFileSync(target, output);
  return output;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { compile, compileTarget, main };
