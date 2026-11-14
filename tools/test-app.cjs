'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const built = require('./build-app.cjs').main();
const files = require('node:fs').readdirSync(path.join(root, 'tests')).filter(name => name.endsWith('.test.cjs')).sort().map(name => path.join(root, 'tests', name));
const child = spawnSync(process.execPath, ['--test', '--test-isolation=none', ...files], {
  cwd: root, stdio: 'inherit', env: { ...process.env, QMX_APP_ROOT: built }
});
if (child.error) { console.error(child.error.message); process.exit(1); }
process.exitCode = child.status || (child.signal ? 1 : 0);
