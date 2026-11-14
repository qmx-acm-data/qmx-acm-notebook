import { Buffer } from 'node:buffer';
import * as nodePath from 'node:path';
import type { AuthAccount, AuthStatus, AuthStatusCode, AuthStatusValue, AuthTicket } from '../../shared/models/auth.js';

export interface AuthSafeStorage {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface EncryptedAuth {
  encrypted: string;
}

export interface AuthDependencies {
  safeStorage: AuthSafeStorage;
  readAuth(): unknown;
  saveAuth(value: EncryptedAuth | Record<string, never>): void;
  now?: () => string;
}

export interface Auth {
  restore(): boolean;
  capture(): AuthTicket;
  current(ticket: AuthTicket): boolean;
  commit(nextToken: unknown, nextAccount: unknown, ticket?: AuthTicket): void;
  failure(error: unknown, ticket: AuthTicket): boolean;
  logout(): void;
  readonly token: string;
  readonly account: AuthAccount | null;
  readonly status: AuthStatus;
}

interface CredentialData {
  token: string;
  account: AuthAccount | null;
  invalidated?: true;
}

/** Assertions preserve the original property reads, including boxed primitives. */
interface UnknownCredentialData {
  token: unknown;
  account: unknown;
  invalidated: unknown;
}

// Dependency injection keeps tests away from Electron's real keychain and userData.
export function createAuth({ safeStorage, readAuth, saveAuth, now = () => new Date().toISOString() }: AuthDependencies): Auth {
  let token = '', account: AuthAccount | null = null, revision = 0;
  let status: AuthStatus = { status: 'anonymous', code: null, transport: 'electron-net' };
  const report = (value: AuthStatusValue, code: AuthStatusCode | null = null): void => {
    status = { status: value, code, transport: 'electron-net', checkedAt: now() };
  };
  const validAccount = (value: unknown): value is AuthAccount => {
    const candidate = value as AuthAccount;
    return Boolean(value && Number.isSafeInteger(candidate.id) && candidate.id > 0 && typeof candidate.login === 'string' && Boolean(candidate.login.trim()));
  };
  const validToken = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim()) && !/[\r\n]/.test(value);
  function encode(data: CredentialData): EncryptedAuth {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('系统凭据加密不可用，无法安全保存登录');
    return { encrypted: safeStorage.encryptString(JSON.stringify(data)).toString('base64') };
  }
  function restore(): boolean {
    let saved: unknown;
    try { saved = readAuth(); }
    catch (error: unknown) {
      if ((error as { code?: unknown }).code === 'ENOENT') { report('anonymous'); return false; }
      report('recovery-required', 'credential-read-failed'); return false;
    }
    if (saved && typeof saved === 'object' && !Array.isArray(saved) && Object.keys(saved).length === 0) { report('anonymous'); return false; }
    const stored = saved as { encrypted?: unknown };
    if (!saved || typeof stored.encrypted !== 'string' || !stored.encrypted || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(stored.encrypted)) {
      report('recovery-required', 'credential-format-invalid'); return false;
    }
    try {
      if (!safeStorage.isEncryptionAvailable()) { report('recovery-required', 'keychain-unavailable'); return false; }
      const parsed: unknown = JSON.parse(safeStorage.decryptString(Buffer.from(stored.encrypted, 'base64')));
      const data = parsed as UnknownCredentialData;
      if (!validAccount(data.account) || (data.invalidated !== true && !validToken(data.token))) {
        report('recovery-required', 'credential-format-invalid'); return false;
      }
      token = data.invalidated === true ? '' : data.token as string; account = data.account; revision++;
      report(data.invalidated === true ? 'expired' : 'restored', data.invalidated === true ? 'http-401' : null);
      return Boolean(token);
    } catch { report('recovery-required', 'credential-decrypt-failed'); return false; }
  }
  function capture(): AuthTicket { return { revision, token }; }
  function current(ticket: AuthTicket): boolean { return ticket.revision === revision && ticket.token === token; }
  function commit(nextToken: unknown, nextAccount: unknown, ticket: AuthTicket = capture()): void {
    if (!current(ticket)) throw new Error('账号已改变，请重试');
    if (!validToken(nextToken) || !validAccount(nextAccount)) throw new Error('登录资料格式不正确');
    try { saveAuth(encode({ token: nextToken, account: nextAccount })); }
    catch { report('recovery-required', 'credential-save-failed'); throw new Error('无法安全保存 GitHub 登录，原凭据未主动清除；请检查系统加密和数据目录权限后重试'); }
    token = nextToken; account = nextAccount; revision++; report('verified');
  }
  function failure(error: unknown, ticket: AuthTicket): boolean {
    if (!current(ticket) || !ticket.token) return false;
    // Deliberately access the supplied value directly: null/undefined still throw.
    const failure = error as { status?: unknown };
    if (failure.status === 401) {
      // Preserve identity/ownership locally, but never send a confirmed expired token again.
      token = ''; revision++; report('expired', 'http-401');
      try { saveAuth(encode({ token: '', account, invalidated: true })); }
      catch { report('expired', 'credential-invalidation-save-failed'); }
    } else if (failure.status === 403 || failure.status === 429) report('unverified', `http-${failure.status}` as AuthStatusCode);
    else report('unverified', failure.status ? 'http-other' : 'network-unavailable');
    return true;
  }
  function logout(): void {
    // Persist first: failure must not claim credentials were durably removed.
    saveAuth({}); token = ''; account = null; revision++; report('anonymous');
  }
  return { restore, capture, current, commit, failure, logout,
    get token() { return token; }, get account() { return account; }, get status() { return { ...status }; } };
}

export interface AuthApp {
  commandLine?: { getSwitchValue(name: string): string };
  setPath(name: 'userData', path: string): void;
}

export interface UserDataOptions {
  env?: NodeJS.ProcessEnv;
  argv?: string[];
  path?: Pick<typeof nodePath, 'isAbsolute' | 'resolve'>;
}

export function configureUserData(app: AuthApp, { env = process.env, argv = process.argv, path = nodePath }: UserDataOptions = {}): void {
  const argument = argv.find(value => value.startsWith('--qmx-user-data-dir='));
  const explicit = argument ? argument.slice('--qmx-user-data-dir='.length) : env.QMX_USER_DATA_DIR;
  const chromium = app.commandLine?.getSwitchValue('user-data-dir');
  const directory = explicit !== undefined ? explicit : (chromium || undefined);
  if (directory !== undefined) {
    if (!directory || !path.isAbsolute(directory)) throw new Error('隔离数据目录必须是明确的绝对路径');
    app.setPath('userData', path.resolve(directory));
  }
  // Do not rename the application or move the established installed profile.
}
