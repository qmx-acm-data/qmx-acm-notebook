'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { sourceMapOptions, stripSourceMapComment, generatedOutput } = require('./source-maps.cjs');
const root = path.resolve(__dirname, '..');
const targets = [
  [
    "src/renderer/lib/search.ts",
    "ui/search.js",
    "Search",
    "NotebookSearch",
    true
  ],
  [
    "src/renderer/reading/markdown-table.ts",
    "ui/markdown-table.js",
    "MarkdownTable",
    "NotebookMarkdownTable",
    true
  ],
  [
    "src/renderer/reading/markdown-color.ts",
    "ui/markdown-color.js",
    "MarkdownColor",
    "NotebookMarkdownColor",
    true
  ],
  [
    "src/renderer/reading/markdown-math.ts",
    "ui/markdown-math.js",
    "MarkdownMath",
    "NotebookMarkdownMath",
    true
  ],
  [
    "src/renderer/planner/deadline.ts",
    "ui/planner-deadline.js",
    "Deadline",
    "NotebookDeadline",
    true
  ],
  [
    "src/renderer/planner/planner.ts",
    "ui/planner.js",
    "Planner",
    "NotebookPlanner",
    false
  ],
  [
    "src/renderer/algorithms/directory.ts",
    "ui/algorithm-directory.js",
    "AlgorithmDirectory",
    "NotebookAlgorithmDirectory",
    true
  ],
  [
    "src/renderer/reading/code-blocks.ts",
    "ui/code-blocks.js",
    "CodeBlocks",
    "NotebookCodeBlocks",
    false
  ],
  [
    "src/renderer/algorithms/browser.ts",
    "ui/algorithm-browser.js",
    "AlgorithmBrowser",
    "NotebookAlgorithms",
    false
  ],
  [
    "src/renderer/algorithms/learning-path.ts",
    "ui/algorithm-learning-path.js",
    "LearningPath",
    "NotebookLearningPath",
    false
  ],
  [
    "src/renderer/platforms/dashboard.ts",
    "ui/platforms.js",
    "Platforms",
    "NotebookPlatforms",
    false
  ],
  [
    "src/renderer/home/contests.ts",
    "ui/home-contests.js",
    "HomeContests",
    "NotebookHomeContests",
    false
  ],
  [
    "src/renderer/account/updates.ts",
    "ui/account-updates.js",
    "Updates",
    "NotebookUpdates",
    false
  ]
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
  ['src/main/platforms/service.cts', 'electron/platform-service.cjs'],
  ['src/main/format/code.cts', 'electron/code-formatter.cjs'],
  ['src/main/storage/settings.cts', 'electron/settings.cjs'],
  ['src/main/update/delta-codec.cts', 'electron/delta-codec.cjs'],
  ['src/main/update/delta-manifest.cts', 'electron/delta-manifest.cjs'],
  ['src/main/update/delta-chain.cts', 'electron/delta-chain.cjs'],
  ['src/main/update/storage.cts', 'electron/update-storage.cjs'],
  ['src/main/update/helper.cts', 'electron/update-helper.cjs'],
  ['src/main/update/file-upgrade.cts', 'electron/file-upgrade.cjs'],
  ['src/main/update/upgrade.cts', 'electron/upgrade.cjs'],
  ['src/main/update/updater.cts', 'electron/updater.cjs'],
  ['src/main/platforms/data.cts', 'electron/platform-data.cjs'],
  ['src/main/links/external.cts', 'electron/external-links.cjs'],
  ['src/tools/update-manifest.cts', 'tools/update-manifest.cjs'],
  ['src/tools/release-feed.cts', 'tools/release-feed.cjs'],
  ['src/tools/delta-feed.cts', 'tools/delta-feed.cjs'],
  ['src/tools/package.cts', 'tools/package.cjs'],
  ['src/tools/installer.cts', 'tools/installer.cjs'],
  ['src/server/server.cts', 'server.js'],
  ['src/main/app/main.cts', 'electron/main.cjs'],
  ['src/main/app/ipc-handlers.cts', 'electron/ipc-handlers.cjs'],
  ['src/main/app/session.cts', 'electron/session.cjs'],
  ['src/tools/build-algorithm-directory.cts', 'tools/build-algorithm-directory.cjs'],
  ['src/tools/render-algorithm-directory.cts', 'tools/render-algorithm-directory.cjs'],
  ['src/tools/build-algorithm-learning-path.cts', 'tools/build-algorithm-learning-path.cjs']
];
function compileGroup(configName, group, options = {}) {
  const configPath = path.join(root, configName);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, ...sourceMapOptions(options.sourceMaps === true), strict: true, noEmit: false, noEmitOnError: true });
  const host = { getCurrentDirectory: () => root, getCanonicalFileName: name => name, getNewLine: () => '\n' };
  const errors = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, host));
  const emitted = new Map();
  const result = program.emit(undefined, (name, text, _bom, _error, sources) => {
    emitted.set(path.resolve(name), { text, sources });
  });
  const outputs = new Map();
  for (const [source, target] of group) {
    const entry = [...emitted].find(([name, value]) => !name.endsWith('.map') && value.sources?.some(file => path.resolve(file.fileName) === path.join(root, source)));
    if (!entry) throw new Error(`Migrated module did not emit: ${source}`);
    const [name, { text }] = entry;
    if (configName === 'tsconfig.modules.json' && /\bimport\s*\(|^export\s/m.test(text)) throw new Error(`Standalone module has runtime import: ${source}`);
    const relocated = generatedOutput({ root, target, header: `// Generated from ${source}; run pnpm modules:build.\n`, text, mapText: emitted.get(name + '.map')?.text, mapName: name + '.map', outputRoot: options.outputRoot });
    for (const [filename, content] of relocated) outputs.set(filename, content);
  }
  if (result.emitSkipped) throw new Error('Not all migrated modules emitted');
  return outputs;
}
function compileBundle(options = {}) {
  // compileGroup checks the whole renderer program before bundling its imports.
  const target = 'ui/app.js';
  const outfile = path.join(root, target);
  const result = require('esbuild').buildSync({
    absWorkingDir: root, entryPoints: ['src/renderer/app/app.ts'], outfile,
    bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2022',
    sourcemap: options.sourceMaps ? 'external' : false, sourcesContent: true,
    charset: 'utf8', legalComments: 'none', logLevel: 'silent'
  });
  const text = result.outputFiles.find(file => file.path === outfile)?.text;
  if (!text) throw new Error('Renderer application bundle did not emit');
  return generatedOutput({ root, target, header: '// Generated from src/renderer/app/app.ts; run pnpm modules:build.\n', text,
    mapText: result.outputFiles.find(file => file.path === outfile + '.map')?.text,
    mapName: outfile + '.map', outputRoot: options.outputRoot });
}
function compile(options = {}) {
  return new Map([
    ...compileGroup('tsconfig.modules.json', [], options),
    ...targets.flatMap(([source, target, exportName, globalName, commonjs]) => [...require('./browser-bundle.cjs').bundle({ root, source, target, exportName, globalName, commonjs, ...options, header: `// Generated from ${source}; run pnpm modules:build.\n` })]),
    ...compileGroup('tsconfig.node.json', nodeTargets, options),
    ...compileBundle(options)
  ]);
}
function main(check = process.argv.includes('--check'), options = {}) {
  const outputs = compile(options);
  for (const [target, text] of outputs) {
    if (target.endsWith('.map')) continue;
    const filename = path.join(root, target);
    const releaseText = stripSourceMapComment(text);
    if (check || options.sourceMaps) {
      if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n') !== releaseText) throw new Error(`Generated ${target} differs; run pnpm modules:build`);
    } else fs.writeFileSync(filename, releaseText);
  }
  if (check) console.log(`PASS ${targets.length + nodeTargets.length + 1} migrated modules match strict TypeScript source`);
  return outputs;
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { main, compile };
