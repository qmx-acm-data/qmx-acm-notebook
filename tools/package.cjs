// Generated from src/tools/package.cts; run pnpm modules:build.
"use strict";
const { packager } = require('@electron/packager');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const platform = process.env.QMX_PLATFORM || process.platform;
const arch = process.env.QMX_ARCH || process.arch;
if (!['win32', 'linux', 'darwin'].includes(platform) || !['x64', 'arm64'].includes(arch))
    throw new Error('Unsupported QMX_PLATFORM or QMX_ARCH');
async function main() {
    // A fresh temporary directory prevents old source or private data entering releases.
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-notebook-build-'));
    const pkg = require('../package.json');
    const manifestPath = path.join(root, 'feed', 'manifest.json');
    const useSignedArchive = fs.existsSync(manifestPath) && process.env.QMX_BUILD_UPDATE_FEED !== '1';
    if (!useSignedArchive) {
        // Dev, tests and the unsigned release archive all consume the same build layout.
        const built = require('./build-app.cjs').main({ sourceMaps: false });
        fs.cpSync(built, stage, { recursive: true });
    }
    else {
        // Signed packaging never recompiles or repacks the accepted archive.
        fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
            name: pkg.name, version: pkg.version, main: pkg.main, dependencies: pkg.dependencies
        }, null, 2));
    }
    const version = require('electron/package.json').version;
    const archiveDir = path.join(root, '.electron-zip');
    const archive = path.join(archiveDir, `electron-v${version}-${platform}-${arch}.zip`);
    const options = {
        dir: stage, name: 'QMX-Notebook', platform: platform, arch: arch,
        out: path.join(root, 'release'), overwrite: true, electronVersion: version,
        asar: true, prune: false,
        download: { checksums: require('electron/checksums.json') }
    };
    // Optional local runtime archive; clean GitHub runners download automatically.
    if (fs.existsSync(archive))
        options.electronZipDir = archiveDir;
    // Supply signed bytes before packager computes macOS/Windows ASAR integrity metadata.
    // Replacing app.asar after packager returns leaves embedded integrity hashes stale.
    let signedHash;
    if (useSignedArchive) {
        const { manifest, file, archivePath } = require('./release-feed.cjs').verifyFeed(root);
        if (manifest.version !== pkg.version)
            throw new Error('Update feed version differs from package version; build a fresh feed first');
        options.prebuiltAsar = archivePath;
        delete options.asar;
        delete options.prune;
        signedHash = file.sha256.toLowerCase();
    }
    const outputs = await packager(options);
    for (const output of outputs) {
        if (signedHash) {
            const resources = platform === 'darwin' ? path.join(output, 'QMX-Notebook.app', 'Contents', 'Resources') : path.join(output, 'resources');
            const hash = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(resources, 'app.asar'))).digest('hex');
            if (hash !== signedHash)
                throw new Error('Packaged application differs from the signed feed');
        }
        if (platform === 'win32')
            for (const [name, flags] of [['启动.cmd', '--disable-gpu'], ['兼容启动.cmd', '--disable-gpu --no-sandbox']]) {
                fs.writeFileSync(path.join(output, name), `@echo off\r\nsetlocal\r\nset ELECTRON_RUN_AS_NODE=\r\ncd /d "%~dp0"\r\nstart "" "QMX-Notebook.exe" ${flags}\r\n`);
            }
        fs.copyFileSync(path.join(root, 'docs', 'USAGE.md'), path.join(output, '使用说明.md'));
    }
    console.log('Build output:', outputs.join('\n'));
    console.log('Temporary build directory:', stage);
}
if (require.main === module)
    main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { main };
