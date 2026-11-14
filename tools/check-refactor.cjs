'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const packageManager = process.env.npm_execpath;
if (!packageManager) throw new Error('Run this check with pnpm check:refactor');
for (const script of ['typecheck', 'check', 'algorithms:check', 'test']) {
  const child = spawnSync(process.execPath, [packageManager, 'run', script], { cwd: root, stdio: 'inherit' });
  if (child.error) { console.error(child.error.message); process.exit(1); }
  if (child.status !== 0) process.exit(child.status || 1);
}
