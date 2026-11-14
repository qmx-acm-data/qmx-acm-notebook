'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const targets = [
  ['src/renderer/lib/search.ts', 'ui/search.js'],
  ['src/renderer/reading/markdown-table.ts', 'ui/markdown-table.js'],
  ['src/renderer/reading/markdown-color.ts', 'ui/markdown-color.js'],
  ['src/renderer/reading/markdown-math.ts', 'ui/markdown-math.js'],
  ['src/renderer/planner/deadline.ts', 'ui/planner-deadline.js'],
  ['src/renderer/planner/planner.ts', 'ui/planner.js'],
  ['src/renderer/algorithms/directory.ts', 'ui/algorithm-directory.js']
];
const nodeTargets = [
  ['src/main/records/parser.cts', 'electron/record-parser.cjs'],
  ['src/main/auth/auth.cts', 'electron/auth.cjs'],
  ['src/main/planner/service.cts', 'electron/planner-service.cjs'],
  ['src/main/github/client.cts', 'electron/github.cjs'],
  ['src/main/tags/service.cts', 'electron/tags.cjs'],
  ['src/main/contests/sources.cts', 'electron/contest-sources.cjs'],
  ['src/main/contests/service.cts', 'electron/contests.cjs'],
  ['src/main/algorithms/topics.cts', 'electron/algorithm-topics.cjs'],
  ['src/main/platforms/page.cts', 'electron/platform-page.cjs'],
  ['src/main/platforms/service.cts', 'electron/platform-service.cjs']
];
function compileGroup(configName, group) {
  const configPath = path.join(root, configName);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, strict: true, noEmit: false, noEmitOnError: true });
  const host = { getCurrentDirectory: () => root, getCanonicalFileName: name => name, getNewLine: () => '\n' };
  const errors = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, host));
  const outputs = new Map();
  const result = program.emit(undefined, (_name, text, _bom, _error, sources) => {
    for (const [source, target] of group) if (sources?.some(file => path.resolve(file.fileName) === path.join(root, source))) {
      if (/\bimport\s*\(|^export\s/m.test(text)) throw new Error(`Standalone module has runtime import: ${source}`);
      outputs.set(target, `// Generated from ${source}; run pnpm modules:build.\n` + text.replace(/\r\n/g, '\n'));
    }
  });
  if (result.emitSkipped || outputs.size !== group.length) throw new Error('Not all migrated modules emitted');
  return outputs;
}
function compile() {
  return new Map([
    ...compileGroup('tsconfig.modules.json', targets),
    ...compileGroup('tsconfig.node.json', nodeTargets)
  ]);
}
function main(check = process.argv.includes('--check')) {
  const outputs = compile();
  for (const [target, text] of outputs) {
    const filename = path.join(root, target);
    if (check) {
      if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n') !== text) throw new Error(`Generated ${target} differs; run pnpm modules:build`);
    } else fs.writeFileSync(filename, text);
  }
  if (check) console.log(`PASS ${outputs.size} migrated modules match strict TypeScript source`);
  return outputs;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { main, compile };
