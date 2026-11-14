import * as path from 'node:path';

interface ExternalChild {
  once(event: 'error' | 'spawn', listener: () => void): unknown;
  once(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown;
  removeListener(event: 'spawn', listener: () => void): unknown;
  removeListener(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown;
  unref(): unknown;
}

export interface ExternalLinksDependencies {
  shell: { openExternal(url: string): unknown };
  fs: { existsSync(path: string): boolean };
  spawn(command: string, args: string[], options: { detached: true; stdio: 'ignore' }): ExternalChild;
  env?: Readonly<Record<string, string | undefined>>;
  platform?: string;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
}

export interface ExternalLinks {
  assertExternal(url: unknown): URL;
  external(url: unknown): Promise<void>;
  openAuthUrl(url: unknown): Promise<boolean>;
  chromePath(): string | null;
}

export function createExternalLinks({ shell, fs, spawn, env = process.env, platform = process.platform, setTimeout = globalThis.setTimeout, clearTimeout = globalThis.clearTimeout }: ExternalLinksDependencies): ExternalLinks {
  function assertExternal(url: unknown): URL {
    const invalid = () => new Error('仅允许打开不含账号密码的 HTTP 或 HTTPS 网页链接');
    if (typeof url !== 'string' || url.length > 8192 || /[\u0000-\u0020\u007f\\]/.test(url) || !/^https?:\/\//i.test(url)) throw invalid();
    let u: URL;
    try { u = new URL(url); } catch { throw invalid(); }
    if (!['https:', 'http:'].includes(u.protocol) || !u.hostname || u.username || u.password) throw invalid();
    return u;
  }
  async function external(url: unknown): Promise<void> {
    const u = assertExternal(url);
    await shell.openExternal(u.href);
  }
  // Prefer Chrome for the device-flow page; fall back to the default handler if it is missing or
  // fails during startup. Existing Chrome instances may accept the URL and exit successfully.
  const AUTH_BROWSER_STARTUP_GRACE_MS = 1000;
  function chromePath(): string | null {
    const candidates = platform === 'win32'
      ? [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].map(base => base && path.join(base, 'Google\\Chrome\\Application\\chrome.exe'))
      : platform === 'darwin'
        ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
    return candidates.find(candidate => candidate && fs.existsSync(candidate)) || null;
  }
  async function openAuthUrl(url: unknown): Promise<boolean> {
    const u = assertExternal(url);
    if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port) throw new Error('仅允许打开 GitHub 授权链接');
    const chrome = chromePath();
    if (chrome) {
      const launched = await new Promise<boolean>(resolve => {
        let child: ExternalChild, timer: ReturnType<typeof setTimeout> | undefined, settled = false, spawned = false;
        const finish = (success: boolean): void => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          child?.removeListener('spawn', onSpawn);
          child?.removeListener('exit', onExit);
          resolve(success);
        };
        const onSpawn = (): void => { spawned = true; child.unref(); };
        const onExit = (code: number | null, signal: string | null): void => finish(code === 0 && !signal);
        try { child = spawn(chrome, [u.href], { detached: true, stdio: 'ignore' }); }
        catch { finish(false); return; }
        // Keep the one-shot error handler after the grace period to consume late process errors.
        child.once('error', () => finish(false));
        child.once('spawn', onSpawn);
        child.once('exit', onExit);
        timer = setTimeout(() => finish(spawned), AUTH_BROWSER_STARTUP_GRACE_MS);
      });
      if (launched) return true;
    }
    await shell.openExternal(u.href);
    return false;
  }
  return { assertExternal, external, openAuthUrl, chromePath };
}
