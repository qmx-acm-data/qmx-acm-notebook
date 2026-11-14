'use strict';

import type { KeyObject } from 'node:crypto';
import type { DeltaPatch } from '../shared/models/delta.js';
import type { ManifestFile, ManifestOptions, SignedManifest } from '../main/update/updater-types.js';

const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');
const crypto = require('node:crypto') as typeof import('node:crypto');
// These runtime paths are relative to the generated tools/release-feed.cjs.
// The named structural boundary types the original updater without relocating it.
interface UpdaterModule {
  verifyManifest(manifest: unknown, options?: ManifestOptions): ManifestFile;
}
const updater = require('../electron/updater.cjs') as UpdaterModule;

// Emitted to tools/release-feed.cjs: __dirname is the original tools directory.
const repositoryRoot: string = path.resolve(__dirname, '..');

type PrivateKeyInput = Parameters<typeof crypto.createPrivateKey>[0];
type PublicKeyInput = Parameters<typeof crypto.createPublicKey>[0];
type UpdateKeyModule = string;

interface SigningOptions {
  readonly keyPem?: PrivateKeyInput | null;
  readonly privateKeyPem?: PrivateKeyInput | null;
  readonly signingKeyPem?: PrivateKeyInput | null;
  readonly keyPath?: string | null;
  readonly publicKey?: unknown;
}

interface VerifyFeedOptions extends SigningOptions {
  readonly rootDir?: string;
  readonly expectedVersion?: string;
  readonly runtimeVersion?: string;
  readonly currentVersion?: unknown;
  readonly verifyDelta?: boolean;
}

interface VerifiedDeltaFeed {
  readonly manifest: unknown;
  readonly patches: readonly DeltaPatch[];
}

interface DeltaFeedModule {
  verifyDeltaFeed(root: string, options: {
    readonly publicKey: KeyObject;
    readonly manifest: SignedManifest;
    readonly file: ManifestFile;
  }): VerifiedDeltaFeed | null;
}

interface VerifiedFeed {
  readonly manifest: SignedManifest;
  readonly file: ManifestFile;
  readonly archivePath: string;
  delta?: VerifiedDeltaFeed | null;
}

function safeError(message: string): Error { return new Error(message); }

function readJson(file: string, message: string): unknown {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown; }
  catch { throw safeError(message); }
}

function publicKeyFor(options: SigningOptions = {}): KeyObject {
  const configured: unknown = options.publicKey === undefined
    ? require('../electron/update-key.cjs') as UpdateKeyModule
    : options.publicKey;
  try {
    const key = (configured as { readonly type?: unknown } | null | undefined)?.type === 'public'
      ? configured as KeyObject : crypto.createPublicKey(configured as PublicKeyInput);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('type');
    return key;
  } catch {
    throw safeError('Invalid pinned update public key');
  }
}

function privateKeyFor(options: SigningOptions = {}): KeyObject {
  const pem = options.keyPem ?? options.privateKeyPem ?? options.signingKeyPem ?? process.env.QMX_UPDATE_SIGNING_KEY_PEM;
  try {
    let key: KeyObject;
    if (pem !== undefined && pem !== '') key = crypto.createPrivateKey(pem);
    else {
      const keyPath = options.keyPath ?? process.env.QMX_UPDATE_SIGNING_KEY;
      if (!keyPath) throw new Error('missing');
      key = crypto.createPrivateKey(fs.readFileSync(keyPath));
    }
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('type');
    return key;
  } catch {
    throw safeError('Invalid update signing key');
  }
}

function packageInfo(rootDir: string): { version: string; runtimeVersion: string } {
  const packageJson = readJson(path.join(rootDir, 'package.json'), 'Unable to read package metadata') as { readonly version?: unknown };
  const electronJson = readJson(path.join(rootDir, 'node_modules', 'electron', 'package.json'), 'Unable to read Electron runtime metadata') as { readonly version?: unknown };
  if (typeof packageJson.version !== 'string' || !packageJson.version) throw safeError('Package metadata has no version');
  if (typeof electronJson.version !== 'string' || !electronJson.version) throw safeError('Electron metadata has no version');
  return { version: packageJson.version, runtimeVersion: electronJson.version };
}

/** Check that a CI-provided private PEM corresponds to the pinned public key. */
function verifySigning(options: SigningOptions = {}): true {
  const privateKey = privateKeyFor(options);
  const publicKey = publicKeyFor(options);
  let derived: KeyObject;
  try { derived = crypto.createPublicKey(privateKey); } catch { throw safeError('Invalid update signing key'); }
  try {
    const challenge = crypto.randomBytes(32);
    const signature = crypto.sign(null, challenge, privateKey);
    if (!crypto.verify(null, challenge, publicKey, signature)) throw new Error('mismatch');
    const left = derived.export({ type: 'spki', format: 'der' });
    const right = publicKey.export({ type: 'spki', format: 'der' });
    if (!left.equals(right)) throw new Error('mismatch');
  } catch (error) {
    if ((error as { readonly message?: unknown } | null | undefined)?.message === 'mismatch') throw safeError('Signing key does not match pinned application key');
    throw safeError('Signing key verification failed');
  }
  return true;
}

function verifyFeed(root: string = '.', options: VerifyFeedOptions = {}): VerifiedFeed {
  root = path.resolve(root);
  // `rootDir` lets tests and CI point metadata at a source checkout while
  // `root` remains the extracted release artifact being verified.
  const metadataRoot = path.resolve(options.rootDir || root);
  // This view preserves the original accesses; updater.verifyManifest below
  // authenticates the manifest before its fields or archive are returned.
  const manifest = readJson(path.join(root, 'feed', 'manifest.json'), 'Unable to read signed update manifest') as SignedManifest;
  const packageMetadata = options.expectedVersion !== undefined && options.runtimeVersion !== undefined
    ? { version: options.expectedVersion, runtimeVersion: options.runtimeVersion === 'manifest' ? manifest.runtimeVersion : options.runtimeVersion }
    : packageInfo(metadataRoot);
  const metadata = updater.verifyManifest(manifest, {
    publicKey: publicKeyFor(options),
    runtimeVersion: packageMetadata.runtimeVersion,
    ...(options.currentVersion === undefined ? {} : { currentVersion: options.currentVersion })
  });
  if (manifest.version !== packageMetadata.version) throw safeError('Update feed version differs from package version');
  const archive = path.join(root, 'resources', 'app.asar');
  let bytes: Buffer;
  try { bytes = fs.readFileSync(archive); } catch { throw safeError('Unable to read application archive'); }
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== metadata.size || hash !== metadata.sha256.toLowerCase()) {
    throw safeError('Signed application feed hash mismatch');
  }
  const result: VerifiedFeed = { manifest, file: metadata, archivePath: archive };
  if (options.verifyDelta !== false) {
    result.delta = (require('./delta-feed.cjs') as DeltaFeedModule).verifyDeltaFeed(root, {
      publicKey: publicKeyFor(options), manifest, file: metadata
    });
  }
  return result;
}

function main(argv: readonly string[] = process.argv.slice(2)): void {
  const command = argv[0];
  if (command === 'verify-signing') {
    verifySigning();
    console.log('Signing key verified');
    return;
  }
  if (command === 'verify') {
    let root = '.', rootDir: string | undefined, expectedVersion: string | undefined, runtimeVersion: string | undefined;
    for (let index = 1; index < argv.length; index++) {
      if (argv[index] === '--root-dir' && argv[index + 1]) rootDir = argv[++index];
      else if (argv[index] === '--version' && argv[index + 1]) expectedVersion = argv[++index];
      else if (argv[index] === '--runtime-version' && argv[index + 1]) runtimeVersion = argv[++index];
      else if (!argv[index].startsWith('--') && root === '.') root = argv[index];
      else throw safeError('Usage: node tools/release-feed.cjs verify [directory] [--root-dir metadata-directory] [--version x.y.z] [--runtime-version x.y.z|manifest]');
    }
    const result = verifyFeed(root, { rootDir, expectedVersion, runtimeVersion });
    console.log(`Verified update feed ${result.manifest.version}: ${result.file.size} bytes, SHA-256 ${result.file.sha256}`);
    return;
  }
  throw safeError('Usage: node tools/release-feed.cjs verify-signing | verify [directory] [--root-dir metadata-directory]');
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    // Deliberately print only controlled messages. Never expose PEM/OpenSSL text.
    console.error((error as { readonly message?: string }).message || 'Release feed verification failed');
    process.exitCode = 1;
  }
}

export = { verifySigning, verifyFeed, main };
