'use strict';

// Structural boundaries keep electron-builder's runtime require unchanged.
type BuilderArch = 1 | 3;
type BuilderTargets = Map<BuilderPlatform, Map<BuilderArch, string[]>>;
interface BuilderPlatform {
  createTarget(targets: string[], arch: BuilderArch): BuilderTargets;
}
interface InstallerConfiguration {
  appId: string;
  productName: string;
  executableName: string;
  artifactName: string;
  directories: { output: string };
  mac?: { category: string; identity: null };
  linux?: { category: string; executableName: string };
  win?: { target: string[]; signAndEditExecutable: boolean };
  nsis?: {
    oneClick: boolean;
    perMachine: boolean;
    allowElevation: boolean;
    allowToChangeInstallationDirectory: boolean;
    createDesktopShortcut: boolean;
    createStartMenuShortcut: boolean;
    shortcutName: string;
    runAfterFinish: boolean;
    deleteAppDataOnUninstall: boolean;
    installerLanguages: string[];
    language: string;
  };
}
interface ElectronBuilderModule {
  build(options: {
    prepackaged: string;
    targets: BuilderTargets;
    config: InstallerConfiguration;
  }): Promise<string[]>;
  Platform: { MAC: BuilderPlatform; LINUX: BuilderPlatform; WINDOWS: BuilderPlatform };
  Arch: { x64: 1; arm64: 3 };
}

const path = require('node:path') as typeof import('node:path');
const fs = require('node:fs') as typeof import('node:fs');
const { build, Platform, Arch } = require('electron-builder') as ElectronBuilderModule;
// Emitted to tools/installer.cjs: __dirname is the original tools directory.
const root = path.resolve(__dirname, '..');

async function main(): Promise<void> {
  const platform = process.env.QMX_PLATFORM || process.platform;
  const arch = process.env.QMX_ARCH || process.arch;
  if (!['win32', 'linux', 'darwin'].includes(platform) || !['x64', 'arm64'].includes(arch)) throw new Error('Unsupported build platform or architecture');
  if (platform !== process.platform) throw new Error('安装包请在目标平台构建；跨平台目录打包可使用 pnpm package。');
  const app = path.join(root, 'release', `QMX-Notebook-${platform}-${arch}`);
  const executable = platform === 'darwin' ? path.join('QMX-Notebook.app', 'Contents', 'MacOS', 'QMX-Notebook') : platform === 'win32' ? 'QMX-Notebook.exe' : 'QMX-Notebook';
  if (!fs.existsSync(path.join(app, executable))) throw new Error('请先运行 pnpm package。');
  if (platform !== 'win32') {
    const target = platform === 'darwin' ? Platform.MAC : Platform.LINUX;
    const files = await build({ prepackaged: platform === 'darwin' ? path.join(app, 'QMX-Notebook.app') : app,
      targets: target.createTarget(platform === 'darwin' ? ['dmg', 'zip'] : ['tar.gz'], arch === 'arm64' ? Arch.arm64 : Arch.x64),
      config: { appId: 'org.qmx.acm.notebook', productName: 'QMX Notebook', executableName: 'QMX-Notebook',
        artifactName: 'QMX-Notebook-${version}-${os}-${arch}.${ext}', directories: { output: path.join(root, 'release', 'installer') },
        mac: { category: 'public.app-category.education', identity: null }, linux: { category: 'Education', executableName: 'QMX-Notebook' } }
    });
    console.log('Package output:', files.join('\n')); return;
  }
  const files = await build({
    prepackaged: app,
    targets: Platform.WINDOWS.createTarget(['nsis'], arch === 'arm64' ? Arch.arm64 : Arch.x64),
    config: {
      appId: 'org.qmx.acm.notebook',
      productName: 'QMX Notebook',
      executableName: 'QMX-Notebook',
      artifactName: 'QMX-Notebook-Setup-${version}.${ext}',
      directories: { output: path.join(root, 'release', 'installer') },
      win: { target: ['nsis'], signAndEditExecutable: false },
      nsis: {
        oneClick: false,
        perMachine: false,
        allowElevation: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: '拾题 QMX Notebook',
        runAfterFinish: true,
        deleteAppDataOnUninstall: false,
        installerLanguages: ['zh_CN', 'en_US'],
        language: '2052'
      }
    }
  });
  console.log('Installer output:', files.join('\n'));
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
// Preserve the original empty CommonJS export without an __esModule marker.
export = {};
