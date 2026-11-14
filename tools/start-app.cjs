'use strict';
const { spawn } = require('node:child_process');
const built = require('./build-app.cjs').main();
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(require('electron'), [built, ...process.argv.slice(2)], { stdio: 'inherit', env });
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
