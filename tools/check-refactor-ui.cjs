'use strict';
// Run existing behavior tests sequentially; inherit output and fail on the first error.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const built = require('./build-app.cjs').main();
const suites = [
  'navigation-smoke.cjs',
  'repositories-ui-smoke.cjs',
  'public-local-solution-smoke.cjs',
  'search-ui-smoke.cjs',
  'algorithm-notes-ui-smoke.cjs',
  'algorithm-learning-path-ui-smoke.cjs',
  'algorithm-reading-ui-smoke.cjs',
  'markdown-format-ui-smoke.cjs',
  'markdown-color-ui-smoke.cjs',
  'platform-ui-smoke.cjs',
  'contests-ui-smoke.cjs',
  'update-ui-smoke.cjs',
  'startup-update-smoke.cjs'
];
fs.mkdirSync(path.join(root, 'release'), { recursive: true });
for (const suite of suites) {
  console.log(`\nBehavior regression: ${suite}`);
  const child = spawnSync(process.execPath, [path.join(root, 'tests', suite)], {
    cwd: root, stdio: 'inherit', env: { ...process.env, QMX_APP_ROOT: built }
  });
  if (child.error) { console.error(child.error.message); process.exit(1); }
  if (child.status !== 0) process.exit(child.status || 1);
}
console.log(`PASS: ${suites.length} existing UI behavior suites`);
