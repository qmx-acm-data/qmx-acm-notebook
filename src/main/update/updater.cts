'use strict';

import type { UpdateProgress } from '../../shared/contracts/notebook.js';
import type { DeltaArchive, DeltaPatch } from '../../shared/models/delta.js';
import type { ManifestFile, ManifestOptions, ReadyUpdate, SignedManifest, UpdateResponse, Updater, UpdaterOptions } from './updater-types.js';

// Electron's patched fs treats .asar files as virtual directories; updates need raw bytes.
const fs = (process.versions.electron ? require('original-fs').promises : require('node:fs/promises')) as typeof import('node:fs/promises');
const path = require('node:path') as typeof import('node:path');
const crypto = require('node:crypto') as typeof import('node:crypto');
const { verifyDeltaManifest } = require('./delta-manifest.cjs') as typeof import('./delta-manifest.cjs');
const { applyDelta } = require('./delta-codec.cjs') as typeof import('./delta-codec.cjs');
const { planDeltaChain } = require('./delta-chain.cjs') as typeof import('./delta-chain.cjs');
const HISTORY_LIMIT = 8;

interface FailureView {
  readonly cause?: FailureView | null;
  readonly code?: string;
  readonly message?: string;
  transient?: boolean;
  transportFailure?: boolean;
}
interface ChainEdge {
  patch: DeltaPatch;
  version: string;
  target: DeltaArchive;
  commit: string;
}
interface Selection {
  manifest: SignedManifest;
  file: ManifestFile;
  commit: string;
  urls: string[];
  patch: DeltaPatch | null;
  chain: readonly ChainEdge[] | null;
}
interface TransferProgress {
  offset?: number;
  total?: number;
  message?: string;
  deadline?: number;
}

const COMMIT_URL = 'https://api.github.com/repos/qmx-acm-data/qmx-acm-notebook/commits/main';
const RAW_ROOT = 'https://raw.githubusercontent.com/qmx-acm-data/qmx-acm-notebook/';
function sourceUrls(sha: string, file: string): string[] {
  const raw = `${RAW_ROOT}${sha}/${file}`;
  return [`https://api.github.com/repos/qmx-acm-data/qmx-acm-notebook/contents/${file}?ref=${sha}`, raw,
    `https://cdn.jsdelivr.net/gh/qmx-acm-data/qmx-acm-notebook@${sha}/${file}`,
    `https://gcore.jsdelivr.net/gh/qmx-acm-data/qmx-acm-notebook@${sha}/${file}`,
    `https://gh-proxy.com/${raw}`];
}
function networkError(url: string, cause: unknown, code?: string): Error & { transient: boolean; code: string } {
  const candidate = code || (cause as FailureView | null | undefined)?.cause?.code || (cause as FailureView | null | undefined)?.code;
  const safeCode = typeof candidate === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(candidate) ? candidate : 'NETWORK_ERROR';
  const error = new Error(`网络无法连接更新服务（${new URL(url).hostname}，${safeCode}）。请稍后重试，或下载完整安装包手动安装。`) as Error & { transient: boolean; code: string };
  error.transient = true;
  error.code = safeCode;
  return error;
}
function aborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason;
}
// Race only transport waits: a stalled injected fetch/iterator cannot continue writing
// into a staging file after its source has been abandoned.
async function transportWait<T>(promise: PromiseLike<T> | T, signal: AbortSignal): Promise<T> {
  aborted(signal);
  let listener!: () => void;
  const expiry = new Promise<never>((_, reject) => {
    listener = () => reject(signal.reason);
    signal.addEventListener('abort', listener, { once: true });
  });
  try { return await Promise.race([promise, expiry]); }
  finally { signal.removeEventListener('abort', listener); }
}
const MAX_MANIFEST = 256 * 1024;
const MAX_FILE = 256 * 1024 * 1024;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function versionParts(value: unknown): bigint[] | null {
  const match = typeof value === 'string' && SEMVER.exec(value);
  return match ? match.slice(1).map(BigInt) : null;
}
function compare(a: readonly bigint[], b: readonly bigint[]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
// The signing format is recursive, lexicographically sorted JSON, without whitespace.
function canonical(value: unknown): string | undefined {
  if (Array.isArray(value)) return `[${(value as unknown[]).map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function exactKeys(object: unknown, keys: readonly string[]): unknown {
  return object && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).sort().join(',') === keys.slice().sort().join(',');
}
function validateResponse(response: UpdateResponse, expectedUrl: string): void {
  // Native fetch reports the final URL. Minimal injected fetch responses may omit it.
  if (response.url && response.url !== expectedUrl) throw new Error('Unsafe update response URL');
  if (response.redirected) throw new Error('Update request failed: redirects are forbidden');
  if (!response.ok) {
    const error = networkError(expectedUrl, null, `HTTP_${response.status}`);
    error.transient = response.status === 408 || response.status === 429 || response.status >= 500 && response.status <= 599;
    throw error;
  }
}
async function streamResponse(response: UpdateResponse, limit: number, signal: AbortSignal, consume: (chunk: Buffer, size: number) => void | Promise<void>, expectedSize?: number): Promise<void> {
  if (!response.body?.[Symbol.asyncIterator]) throw new Error('Update response has no readable stream');
  const length = response.headers?.get?.('content-length');
  if (length != null && (!/^\d+$/.test(length) || Number(length) > limit || (expectedSize !== undefined && Number(length) !== expectedSize))) {
    throw new Error('Update Content-Length exceeds limit or does not match expected size');
  }
  let size = 0;
  const iterator = response.body[Symbol.asyncIterator]();
  try {
    while (true) {
      let part;
      try { part = await transportWait(iterator.next(), signal); }
      catch (error) { (error as FailureView).transportFailure = true; throw error; }
      aborted(signal);
      if (part.done) break;
      const chunk = Buffer.from(part.value);
      size += chunk.length;
      if (size > limit) throw new Error('Update response exceeds expected size limit');
      await consume(chunk, size);
    }
  } finally {
    // Do not await return(): a broken/stalled iterator may never settle.
    Promise.resolve(iterator.return?.()).catch(() => {});
  }
  aborted(signal);
  if (expectedSize !== undefined && size !== expectedSize) throw new Error('Update size verification failed');
}

function validateSignedManifest(value: unknown, publicKey: unknown, runtimeVersion: string | undefined): ManifestFile {
  // Property views do not replace or extend the original validation below.
  const manifest = value as SignedManifest;
  if (!exactKeys(manifest, ['schema', 'version', 'runtimeVersion', 'base', 'notes', 'publishedAt', 'files', 'signature']) || manifest.schema !== 1 || !versionParts(manifest.version) || !versionParts(manifest.runtimeVersion) || manifest.base !== '../' || typeof manifest.notes !== 'string' || typeof manifest.publishedAt !== 'string' || !Number.isFinite(Date.parse(manifest.publishedAt))) throw new Error('Invalid update manifest');
  if (!Array.isArray(manifest.files) || manifest.files.length !== 1) throw new Error('Manifest must contain only resources/app.asar');
  const file = manifest.files[0];
  if (!exactKeys(file, ['path', 'size', 'sha256']) || file.path !== 'resources/app.asar' || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_FILE || typeof file.sha256 !== 'string' || !/^[a-fA-F0-9]{64}$/.test(file.sha256)) throw new Error('Invalid manifest file path, size, or SHA-256');
  if (typeof manifest.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(manifest.signature)) throw new Error('Invalid manifest signature');
  const signature = Buffer.from(manifest.signature, 'base64');
  if (signature.toString('base64') !== manifest.signature) throw new Error('Invalid manifest signature');
  const configuredKey: unknown = publicKey === undefined ? require('./update-key.cjs') as string : publicKey;
  const key = (configuredKey as { readonly type?: unknown } | null | undefined)?.type === 'public' ? configuredKey as import('node:crypto').KeyObject : crypto.createPublicKey(configuredKey as Parameters<typeof crypto.createPublicKey>[0]);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Update public key must be Ed25519');
  const unsigned = Object.fromEntries(Object.entries(manifest).filter(([name]) => name !== 'signature'));
  if (!crypto.verify(null, Buffer.from(canonical(unsigned)!), key, signature)) throw new Error('Manifest signature verification failed');
  if (manifest.runtimeVersion !== runtimeVersion) throw new Error('Electron runtime version mismatch; manual installer required');
  return file;
}

function verifyManifest(manifest: unknown, { publicKey, runtimeVersion, currentVersion }: ManifestOptions = {}): ManifestFile {
  const file = validateSignedManifest(manifest, publicKey, runtimeVersion);
  if (currentVersion !== undefined && (!versionParts(currentVersion) || compare(versionParts((manifest as SignedManifest).version)!, versionParts(currentVersion)!) <= 0)) throw new Error('Update version verification failed: no newer update');
  return file;
}

function createUpdater(options?: UpdaterOptions): Updater;
function createUpdater(options?: unknown): Updater;
function createUpdater(options: unknown = {}): Updater {
  const { currentVersion, downloadDir: inputDownloadDir, fetcher = globalThis.fetch, onProgress = () => {}, timeoutMs = 120000, attemptMs = 10000, runtimeVersion = process.versions.electron, publicKey, installedArchive } = options as UpdaterOptions;
  let downloadDir = inputDownloadDir;
  const current = versionParts(currentVersion);
  if (!current) throw new Error('currentVersion must be a stable semantic version');
  if (!versionParts(runtimeVersion)) throw new Error('runtimeVersion must be the installed Electron semantic version');
  if (typeof downloadDir !== 'string' || !path.isAbsolute(downloadDir)) throw new Error('downloadDir must be an absolute directory');
  if (typeof fetcher !== 'function') throw new Error('fetcher must be a function');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be positive');
  if (!Number.isSafeInteger(attemptMs) || attemptMs <= 0) throw new Error('attemptMs must be positive');
  downloadDir = path.resolve(downloadDir);
  let state: UpdateProgress = { phase: 'idle', currentVersion: currentVersion!, latestVersion: null, version: null, available: false, downloaded: 0, total: 0, percent: 0, message: '' };
  let selected: Selection | null = null;
  let ready: ReadyUpdate | null = null;
  let checkPromise: Promise<UpdateProgress> | null = null;
  let downloadPromise: Promise<ReadyUpdate> | null = null;
  let verifyPromise: Promise<ReadyUpdate> | null = null;
  // Only this instance's mkdtemp directories are ours to prune. Startup cleanup
  // handles older instances; no cached selection is trusted across restarts.
  const ownedDirectories = new Map<string, { dev: number; ino: number }>();

  async function pruneDownloads(): Promise<void> {
    for (const [directory, identity] of ownedDirectories) {
      let info;
      try { info = await fs.lstat(directory); }
      catch (error) {
        if ((error as FailureView).code !== 'ENOENT') throw error;
        ownedDirectories.delete(directory);
        continue;
      }
      // A renamed/replaced directory (including a junction) is no longer ours.
      if (!info.isDirectory() || info.isSymbolicLink() || info.dev !== identity.dev || info.ino !== identity.ino) {
        ownedDirectories.delete(directory);
        continue;
      }
      await verifyDirectories(directory);
      for (const name of ['app.asar.part', 'app.asar', 'patch.qmxdelta', 'patch.qmxdelta.part', '.owner.json']) {
        const file = path.join(directory, name);
        try {
          const entry = await fs.lstat(file);
          // Never recurse into an unexpected directory or follow a link.
          if (entry.isFile() && !entry.isSymbolicLink()) await fs.unlink(file);
        } catch (error) { if ((error as FailureView).code !== 'ENOENT') throw error; }
      }
      try { await fs.rmdir(directory); }
      catch (error) {
        // Preserve any unrelated entries, even inside a directory we created.
        if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes((error as FailureView).code!)) throw error;
      }
      ownedDirectories.delete(directory);
    }
  }

  function emit(patch: Partial<UpdateProgress>): UpdateProgress {
    state = { ...state, ...patch };
    try { onProgress({ ...state }); } catch { /* UI listeners cannot interrupt verification. */ }
    return { ...state };
  }
  function failure(error: unknown): never {
    emit({ phase: 'error', available: false, message: (error as FailureView).message || String(error) });
    throw error;
  }
  async function candidates<T>(urls: readonly string[], deadline: number, action: (url: string, signal: AbortSignal) => Promise<T>): Promise<T> {
    let last: unknown;
    for (const url of urls) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw last || networkError(url, null, 'ETIMEDOUT');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(networkError(url, null, 'ETIMEDOUT')), Math.min(10000, attemptMs, remaining));
      try {
        const result = await action(url, controller.signal);
        aborted(controller.signal);
        return result;
      } catch (error) {
        const failure: unknown = controller.signal.aborted ? controller.signal.reason : (error as FailureView).transportFailure ? networkError(url, error) : error;
        if (!(failure as FailureView).transient) throw failure;
        last = failure;
      } finally { clearTimeout(timer); controller.abort(); }
    }
    throw last;
  }
  async function request(url: string, signal: AbortSignal): Promise<UpdateResponse> {
    let response;
    try {
      response = await transportWait(fetcher(url, { headers: { Accept: url.startsWith('https://api.github.com/repos/qmx-acm-data/qmx-acm-notebook/contents/') ? 'application/vnd.github.raw+json' : 'application/json', 'User-Agent': 'QMX-Notebook-Updater' }, signal, redirect: 'error', credentials: 'omit' }), signal);
    } catch (error) { throw networkError(url, error); }
    aborted(signal);
    validateResponse(response, url);
    return response;
  }
  async function json(url: string, signal: AbortSignal): Promise<unknown> {
    const response = await request(url, signal);
    const chunks: Buffer[] = [];
    await streamResponse(response, MAX_MANIFEST, signal, chunk => { chunks.push(chunk); });
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as unknown; }
    catch { throw new Error('Invalid update JSON'); }
  }
  function validateManifest(manifest: unknown): ManifestFile { return verifyManifest(manifest, { publicKey, runtimeVersion }); }
  async function checkInternal(): Promise<UpdateProgress> {
    emit({ phase: 'checking', available: false, latestVersion: null, version: null, releaseUrl: null, downloadKind: 'full', fullSize: 0, deltaSteps: 0, deltaReason: null, message: 'Checking for updates', downloaded: 0, total: 0, percent: 0 });
    selected = null;
    ready = null;
    try {
      // Discard the prior ready download before contacting the network, including
      // when discovery fails or reports that no newer update is available.
      await pruneDownloads();
      const deadline = Date.now() + timeoutMs;
      const commit = await candidates([COMMIT_URL, COMMIT_URL, COMMIT_URL], deadline, json) as { sha: string } | null;
      if (!commit || typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Invalid main commit SHA');
      const selection = await candidates<Selection>(sourceUrls(commit.sha, 'feed/manifest.json'), deadline, async (url, signal) => {
        const manifest = await json(url, signal);
        const file = validateManifest(manifest);
        return { manifest: manifest as SignedManifest, file, commit: commit.sha, urls: sourceUrls(commit.sha, 'resources/app.asar'), patch: null, chain: null };
      });
      const { manifest, file } = selection;
      if (compare(versionParts(manifest.version)!, current!) <= 0) return emit({ phase: 'idle', version: manifest.version, latestVersion: manifest.version, message: 'Already up to date' });
      // Separate metadata keeps legacy clients compatible with the original signed feed.
      // Missing/invalid optional metadata only disables the optimization.
      let deltaReason = 'base-unavailable';
      if (typeof installedArchive === 'string' && path.isAbsolute(installedArchive)) {
        try {
          const patches = await candidates(sourceUrls(commit.sha, 'feed/delta.json'), Math.min(deadline, Date.now() + 15000), async (url, signal) => {
            const delta = await json(url, signal);
            return verifyDeltaManifest(delta, { publicKey, runtimeVersion, targetVersion: manifest.version, targetFile: file });
          });
          deltaReason = 'no-patch-path';
          for (const patch of patches.filter(p => p.fromVersion === currentVersion).sort((a, b) => a.size - b.size)) {
            try {
              await verifyFile(installedArchive, { size: patch.fromSize, sha256: patch.fromSha256 });
              selection.patch = patch;
              selection.chain = [{ patch, version: manifest.version, target: { size: file.size, sha256: file.sha256.toLowerCase() }, commit: commit.sha }];
              break;
            } catch { deltaReason = 'base-mismatch'; }
          }
          if (!selection.chain && deltaReason === 'no-patch-path') {
            selection.chain = await discoverChain(selection, patches, deadline);
            if (selection.chain) selection.patch = selection.chain[0].patch;
          }
        } catch { deltaReason = 'metadata-unavailable'; }
      }
      selected = selection;
      const total = selection.chain ? selection.chain.reduce((n, edge) => n + edge.patch.size, 0) : file.size;
      return emit({ phase: 'available', available: true, version: manifest.version, latestVersion: manifest.version, total,
        fullSize: file.size, downloadKind: selection.chain ? 'delta' : 'full', deltaSteps: selection.chain?.length || 0, deltaReason: selection.chain ? null : deltaReason,
        message: `Version ${manifest.version} is available` });
    } catch (error) { return failure(error); }
  }
  async function discoverChain(selection: Selection, patches: readonly DeltaPatch[], deadline: number): Promise<readonly ChainEdge[] | null> {
    // History discovers locations only: every edge still requires both pinned signatures.
    const budget = Math.min(deadline, Date.now() + 20000);
    const historyUrl = 'https://api.github.com/repos/qmx-acm-data/qmx-acm-notebook/commits?sha=' + selection.commit + '&path=feed%2Fdelta.json&per_page=' + HISTORY_LIMIT;
    const history = await candidates([historyUrl], budget, json) as readonly { sha: string }[];
    if (!Array.isArray(history) || history.length > HISTORY_LIMIT || history.some(item => !item || typeof item.sha !== 'string' || !/^[a-f0-9]{40}$/.test(item.sha))) throw new Error('Invalid update history');
    const edges = patches.map(patch => ({ patch, version: selection.manifest.version, target: { size: selection.file.size, sha256: selection.file.sha256.toLowerCase() }, commit: selection.commit }));
    const seen = new Set([selection.commit]);
    for (const { sha } of history) {
      if (seen.has(sha) || Date.now() >= budget) continue;
      seen.add(sha);
      try {
        const old = await candidates(sourceUrls(sha, 'feed/manifest.json'), budget, async (url, signal) => {
          const manifest = await json(url, signal);
          const file = validateManifest(manifest);
          return { manifest: manifest as SignedManifest, file };
        });
        if (compare(versionParts(old.manifest.version)!, current!) <= 0 || compare(versionParts(old.manifest.version)!, versionParts(selection.manifest.version)!) > 0) continue;
        const oldPatches = await candidates(sourceUrls(sha, 'feed/delta.json'), budget, async (url, signal) => {
          const delta = await json(url, signal);
          return verifyDeltaManifest(delta, { publicKey, runtimeVersion, targetVersion: old.manifest.version, targetFile: old.file });
        });
        for (const patch of oldPatches) edges.push({ patch, version: old.manifest.version, target: { size: old.file.size, sha256: old.file.sha256.toLowerCase() }, commit: sha });
      } catch { /* A bad/missing historic release is never a trusted graph edge. */ }
    }
    const info = await fs.lstat(installedArchive!);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size <= 0 || info.size > MAX_FILE) throw new Error('Invalid installed base');
    await verifyDirectories(path.dirname(installedArchive!));
    // Read only the checked maximum, even if the file grows concurrently.
    const handle = await fs.open(installedArchive!, 'r');
    const hash = crypto.createHash('sha256'); let size = 0;
    try { for await (const chunk of handle.createReadStream({ autoClose: false })) { size += chunk.length; if (size > info.size) throw new Error('Installed base changed'); hash.update(chunk); } }
    finally { await handle.close(); }
    const base = { size, sha256: hash.digest('hex') };
    await verifyFile(installedArchive!, base);
    return planDeltaChain(edges, { currentVersion, base, targetVersion: selection.manifest.version, target: { size: selection.file.size, sha256: selection.file.sha256.toLowerCase() }, maxSteps: HISTORY_LIMIT });
  }
  function check(): Promise<UpdateProgress> {
    if (checkPromise) return checkPromise;
    if (downloadPromise || verifyPromise) return Promise.reject(new Error('Updater is busy'));
    checkPromise = checkInternal().finally(() => { checkPromise = null; });
    return checkPromise;
  }
  // Check every directory component, including junctions, before trusting a staged file.
  async function verifyDirectories(directory: string): Promise<void> {
    let cursor = path.resolve(directory);
    while (true) {
      const info = await fs.lstat(cursor);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Update staging directory must not contain links');
      const parent = path.dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
  async function verifyFile(file: string, metadata: DeltaArchive): Promise<void> {
    await verifyDirectories(path.dirname(file));
    const info = await fs.lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size !== metadata.size) throw new Error('Update size or file type verification failed (links are forbidden)');
    const handle = await fs.open(file, 'r');
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink !== 1 || opened.size !== info.size || opened.ino !== info.ino || opened.dev !== info.dev) throw new Error('Update file changed during verification');
      const hash = crypto.createHash('sha256');
      let size = 0;
      for await (const chunk of handle.createReadStream({ autoClose: false })) {
        size += chunk.length;
        if (size > metadata.size) throw new Error('Update size verification failed');
        hash.update(chunk);
      }
      const after = await fs.lstat(file);
      if (size !== metadata.size || hash.digest('hex') !== metadata.sha256.toLowerCase() || after.isSymbolicLink() || after.nlink !== 1 || after.ino !== opened.ino || after.dev !== opened.dev) throw new Error('Update SHA-256 or file type verification failed');
    } finally { await handle.close(); }
  }
  function verifyReady(): Promise<ReadyUpdate> {
    if (verifyPromise) return verifyPromise;
    if (downloadPromise || checkPromise) return Promise.reject(new Error('Updater is busy'));
    verifyPromise = (async () => {
      try {
        if (!ready || !selected) throw new Error('No verified update is ready');
        const metadata = validateManifest(ready.manifest);
        if (ready.version !== ready.manifest.version || compare(versionParts(ready.version)!, current!) <= 0) throw new Error('Update version verification failed');
        await verifyFile(ready.path, metadata);
        emit({ phase: 'ready', message: 'Update verified and ready' });
        return clone(ready);
      } catch (error) { ready = null; return failure(error); }
    })().finally(() => { verifyPromise = null; });
    return verifyPromise;
  }
  async function transfer(urls: readonly string[], destination: string, metadata: DeltaArchive, kind: 'full' | 'delta', progress: TransferProgress = {}): Promise<void> {
    const offsetBytes = progress.offset || 0, totalBytes = progress.total || metadata.size;
    const handle = await fs.open(destination, 'wx', 0o600);
    try {
      emit({ phase: 'downloading', downloadKind: kind, downloaded: offsetBytes, total: totalBytes, percent: Math.floor(offsetBytes / totalBytes * 100),
        message: progress.message || (kind === 'delta' ? '正在下载差分更新' : '正在下载完整应用更新') });
      await candidates(urls, progress.deadline || Date.now() + timeoutMs, async (url, signal) => {
        await handle.truncate(0);
        emit({ downloaded: offsetBytes, percent: Math.floor(offsetBytes / totalBytes * 100) });
        const response = await request(url, signal);
        const hash = crypto.createHash('sha256');
        await streamResponse(response, metadata.size, signal, async (chunk, downloaded) => {
          hash.update(chunk);
          let offset = 0;
          while (offset < chunk.length) {
            aborted(signal);
            const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset, downloaded - chunk.length + offset);
            if (!bytesWritten) throw new Error('Update staging write failed');
            offset += bytesWritten;
          }
          aborted(signal);
          emit({ downloaded: offsetBytes + downloaded, percent: Math.floor((offsetBytes + downloaded) / totalBytes * 100) });
        }, metadata.size);
        if (hash.digest('hex') !== metadata.sha256.toLowerCase()) throw new Error('Update SHA-256 verification failed');
      });
      await handle.sync();
    } finally { await handle.close(); }
    await verifyFile(destination, metadata);
  }
  async function reconstructDelta(selection: Selection, ownDir: string): Promise<string> {
    const chain = selection.chain!;
    const first = chain[0].patch;
    const initialBase = { size: first.fromSize, sha256: first.fromSha256 };
    await verifyFile(installedArchive!, initialBase);
    let base: Buffer = await fs.readFile(installedArchive!);
    const patchPath = path.join(ownDir, 'patch.qmxdelta');
    const total = chain.reduce((n, edge) => n + edge.patch.size, 0);
    const deadline = Date.now() + timeoutMs;
    let completed = 0;
    for (let index = 0; index < chain.length; index++) {
      const { patch, target, version, commit } = chain[index];
      if (base.length !== patch.fromSize || crypto.createHash('sha256').update(base).digest('hex') !== patch.fromSha256) throw new Error('Delta base changed');
      await transfer(sourceUrls(commit, patch.path), patchPath, patch, 'delta', { offset: completed, total, deadline, message: chain.length > 1 ? '正在下载连续差分（' + (index + 1) + '/' + chain.length + '，目标 ' + version + '）' : '正在下载差分更新' });
      emit({ message: '正在重建并校验 ' + version + (chain.length > 1 ? '（' + (index + 1) + '/' + chain.length + '）' : '') });
      await verifyFile(installedArchive!, initialBase);
      await verifyFile(patchPath, patch);
      const patchBytes = await fs.readFile(patchPath);
      if (patchBytes.length !== patch.size || crypto.createHash('sha256').update(patchBytes).digest('hex') !== patch.sha256) throw new Error('Delta patch changed');
      const rebuilt = applyDelta(base, patchBytes, target.size);
      if (rebuilt.length !== target.size || crypto.createHash('sha256').update(rebuilt).digest('hex') !== target.sha256) throw new Error('Reconstructed application SHA-256 verification failed');
      base = rebuilt;
      completed += patch.size;
      await fs.unlink(patchPath);
    }
    await verifyFile(installedArchive!, initialBase);
    const temporary = path.join(ownDir, 'app.asar.part');
    await fs.writeFile(temporary, base, { flag: 'wx', mode: 0o600 });
    await verifyFile(temporary, selection.file);
    return temporary;
  }
  function download(): Promise<ReadyUpdate> {
    if (downloadPromise) return downloadPromise;
    if (verifyPromise) return Promise.reject(new Error('Updater is busy'));
    if (ready) return verifyReady();
    downloadPromise = (async () => {
      let temporary: string | null | undefined;
      try {
        if (checkPromise) await checkPromise;
        else if (!selected) await checkInternal();
        if (!selected) throw new Error('No newer update is available');
        const selection = selected;
        const metadata = validateManifest(selection.manifest);
        // verifyReady failures retain their archive until a replacement download.
        await pruneDownloads();
        await fs.mkdir(downloadDir!, { recursive: true });
        await verifyDirectories(downloadDir!);
        const ownDir = await fs.mkdtemp(path.join(downloadDir!, 'qmx-update-'));
        const identity = await fs.lstat(ownDir);
        if (!identity.isDirectory() || identity.isSymbolicLink()) throw new Error('Update staging directory must not contain links');
        ownedDirectories.set(ownDir, { dev: identity.dev, ino: identity.ino });
        await verifyDirectories(ownDir);
        // Startup cleanup skips downloads while their creating process is alive.
        await fs.writeFile(path.join(ownDir, '.owner.json'), JSON.stringify({ schema: 1, pid: process.pid }), { flag: 'wx', mode: 0o600 });
        emit({ version: selection.manifest.version });
        if (selection.patch) {
          try { temporary = await reconstructDelta(selection, ownDir); }
          catch {
            // Failed optimization never bypasses the original signed full-file flow.
            // Clean only regular files at our fixed staging paths before retry.
            for (const name of ['patch.qmxdelta', 'app.asar.part']) {
              const file = path.join(ownDir, name);
              try {
                const info = await fs.lstat(file);
                if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('Unsafe delta staging file');
                await fs.unlink(file);
              } catch (error) { if ((error as FailureView).code !== 'ENOENT') throw error; }
            }
            selection.patch = null; selection.chain = null;
            emit({ message: '差分更新不可用，正在切换完整应用包', downloadKind: 'full', deltaReason: 'patch-failed', deltaSteps: 0 });
          }
        }
        if (!temporary) {
          temporary = path.join(ownDir, 'app.asar.part');
          await transfer(selection.urls, temporary, metadata, 'full');
        }
        const finalPath = path.join(path.dirname(temporary), 'app.asar');
        await fs.rename(temporary, finalPath);
        temporary = null;
        await verifyFile(finalPath, metadata);
        ready = { version: selection.manifest.version, path: finalPath, manifest: clone(selection.manifest) };
        const transferred = selection.chain ? selection.chain.reduce((n, edge) => n + edge.patch.size, 0) : metadata.size;
        emit({ phase: 'ready', downloaded: transferred, total: transferred, fullSize: metadata.size, percent: 100, message: 'Update verified and ready' });
        return clone(ready);
      } catch (error) {
        // Includes empty directories and the final archive if post-rename
        // verification failed. Keep ownership for a later retry if removal fails.
        await pruneDownloads().catch(() => {});
        ready = null;
        return failure(error);
      }
    })().finally(() => { downloadPromise = null; });
    return downloadPromise;
  }
  return { check, download, verifyReady, getState: () => ({ ...state }) };
}

const createUpdaterImplementation = createUpdater;
const verifyManifestImplementation = verifyManifest;
namespace createUpdater {
  export const createUpdater = createUpdaterImplementation;
  export const stableStringify = canonical;
  export const verifyManifest = verifyManifestImplementation;
}

export = createUpdater;
