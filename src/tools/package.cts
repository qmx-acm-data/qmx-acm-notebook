// Emitted to tools/package.cjs so runtime helper names and __dirname stay unchanged.
type PackagePlatform = 'win32' | 'linux' | 'darwin';
type PackageArch = 'x64' | 'arm64';

interface PackageOptions {
  dir: string;
  name: string;
  platform: PackagePlatform;
  arch: PackageArch;
  out: string;
  overwrite: boolean;
  electronVersion: string;
  asar?: boolean;
  prune?: boolean;
  download: { checksums: Record<string, string> };
  electronZipDir?: string;
  prebuiltAsar?: string;
}

interface PackagerModule {
  packager(options: PackageOptions): Promise<string[]>;
}

interface PackageMetadata {
  readonly name: string;
  readonly version: string;
  readonly main: string;
  readonly dependencies: Readonly<Record<string, string>>;
}

interface BuildAppModule {
  main(options?: { sourceMaps?: boolean }): string;
}

// verifyFeed authenticates the manifest and archive before these fields are used.
interface ReleaseFeedModule {
  verifyFeed(root: string): {
    readonly manifest: { readonly version: string };
    readonly file: { readonly sha256: string };
    readonly archivePath: string;
  };
}

const { packager } = require('@electron/packager') as PackagerModule;
const path = require('node:path') as typeof import('node:path');
const fs = require('node:fs') as typeof import('node:fs');
const os = require('node:os') as typeof import('node:os');

const root = path.resolve(__dirname, '..');
const platform = process.env.QMX_PLATFORM || process.platform;
const arch = process.env.QMX_ARCH || process.arch;
if (!['win32', 'linux', 'darwin'].includes(platform) || !['x64', 'arm64'].includes(arch)) throw new Error('Unsupported QMX_PLATFORM or QMX_ARCH');
async function main(): Promise<void> {
  // A fresh temporary directory prevents old source or private data entering releases.
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-notebook-build-'));
  const pkg = require('../package.json') as PackageMetadata;
  const manifestPath = path.join(root, 'feed', 'manifest.json');
  const useSignedArchive = fs.existsSync(manifestPath) && process.env.QMX_BUILD_UPDATE_FEED !== '1';
  if (!useSignedArchive) {
    // Dev, tests and the unsigned release archive all consume the same build layout.
    const built = (require('./build-app.cjs') as BuildAppModule).main({ sourceMaps: false });
    fs.cpSync(built, stage, { recursive: true });
  } else {
    // Signed packaging never recompiles or repacks the accepted archive.
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify({
      name: pkg.name, version: pkg.version, main: pkg.main, dependencies: pkg.dependencies
    }, null, 2));
  }
  const version = (require('electron/package.json') as { readonly version: string }).version;
  const archiveDir = path.join(root, '.electron-zip');
  const archive = path.join(archiveDir, `electron-v${version}-${platform}-${arch}.zip`);
  const options: PackageOptions = {
    dir: stage, name: 'QMX-Notebook', platform: platform as PackagePlatform, arch: arch as PackageArch,
    out: path.join(root, 'release'), overwrite: true, electronVersion: version,
    asar: true, prune: false,
    download: { checksums: require('electron/checksums.json') as Record<string, string> }
  };
  // Optional local runtime archive; clean GitHub runners download automatically.
  if (fs.existsSync(archive)) options.electronZipDir = archiveDir;
  // Supply signed bytes before packager computes macOS/Windows ASAR integrity metadata.
  // Replacing app.asar after packager returns leaves embedded integrity hashes stale.
  let signedHash: string | undefined;
  if (useSignedArchive) {
    const { manifest, file, archivePath } = (require('./release-feed.cjs') as ReleaseFeedModule).verifyFeed(root);
    if (manifest.version !== pkg.version) throw new Error('Update feed version differs from package version; build a fresh feed first');
    options.prebuiltAsar = archivePath;
    delete options.asar;
    delete options.prune;
    signedHash = file.sha256.toLowerCase();
  }
  const outputs = await packager(options);
  for (const output of outputs) {
    if (signedHash) {
      const resources = platform === 'darwin' ? path.join(output, 'QMX-Notebook.app', 'Contents', 'Resources') : path.join(output, 'resources');
      const hash = (require('node:crypto') as typeof import('node:crypto')).createHash('sha256').update(fs.readFileSync(path.join(resources, 'app.asar'))).digest('hex');
      if (hash !== signedHash) throw new Error('Packaged application differs from the signed feed');
    }
    if (platform === 'win32') for (const [name, flags] of [['启动.cmd', '--disable-gpu'], ['兼容启动.cmd', '--disable-gpu --no-sandbox']]) {
      fs.writeFileSync(path.join(output, name), `@echo off\r\nsetlocal\r\nset ELECTRON_RUN_AS_NODE=\r\ncd /d "%~dp0"\r\nstart "" "QMX-Notebook.exe" ${flags}\r\n`);
    }
    fs.copyFileSync(path.join(root, 'docs', 'USAGE.md'), path.join(output, '使用说明.md'));
  }
  console.log('Build output:', outputs.join('\n'));
  console.log('Temporary build directory:', stage);
}
if (require.main === module) main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
export = { main };
