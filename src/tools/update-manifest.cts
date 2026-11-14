'use strict';

import type { KeyObject } from 'node:crypto';
import type { SignedManifest } from '../main/update/updater-types.js';

const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');
const crypto = require('node:crypto') as typeof import('node:crypto');

// Emitted to tools/update-manifest.cjs: __dirname is the original tools directory.
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

interface BuildManifestOptions extends SigningOptions {
  rootDir?: string;
  readonly archivePath?: string;
  notes?: string;
}

// The updater and the release tools sign the same recursive, sorted JSON form.
function canonical(value: unknown): string | undefined {
  if (Array.isArray(value)) return '[' + (value as readonly unknown[]).map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Readonly<Record<string, unknown>>;
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function safeKeyError(message: string): Error {
  // Do not attach OpenSSL errors: depending on the provider they can contain
  // portions of a malformed PEM (and a CI log must never contain key material).
  return new Error(message);
}

function publicKeyFor(options: SigningOptions): KeyObject {
  const configured: unknown = options.publicKey === undefined
    ? require('../electron/update-key.cjs') as UpdateKeyModule
    : options.publicKey;
  try {
    const key = (configured as { readonly type?: unknown } | null | undefined)?.type === 'public'
      ? configured as KeyObject : crypto.createPublicKey(configured as PublicKeyInput);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('type');
    return key;
  } catch {
    throw safeKeyError('Invalid pinned update public key');
  }
}

function privateKeyFor(options: SigningOptions): KeyObject {
  // PEM is deliberately accepted as a value. It is never written to disk.
  const pem = options.keyPem ?? options.privateKeyPem ?? options.signingKeyPem ?? process.env.QMX_UPDATE_SIGNING_KEY_PEM;
  let key: KeyObject;
  try {
    if (pem !== undefined && pem !== '') key = crypto.createPrivateKey(pem);
    else {
      const keyPath = options.keyPath ?? process.env.QMX_UPDATE_SIGNING_KEY;
      if (!keyPath) throw new Error('missing');
      let keyBytes: Buffer;
      try { keyBytes = fs.readFileSync(keyPath); } catch { throw new Error('read'); }
      key = crypto.createPrivateKey(keyBytes);
    }
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('type');
    return key;
  } catch {
    throw safeKeyError('Invalid update signing key');
  }
}

function samePublicKey(left: KeyObject, right: KeyObject): boolean {
  try {
    return left.export({ type: 'spki', format: 'der' }).equals(right.export({ type: 'spki', format: 'der' }));
  } catch {
    return false;
  }
}

function readJson(file: string, message: string): unknown {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown; }
  catch { throw new Error(message); }
}

function packageInfo(rootDir: string): { packageVersion: string; runtimeVersion: string } {
  const pkg = readJson(path.join(rootDir, 'package.json'), 'Unable to read package metadata') as { readonly version?: unknown };
  if (typeof pkg.version !== 'string' || !pkg.version) throw new Error('Package metadata has no version');
  const electronPackage = path.join(rootDir, 'node_modules', 'electron', 'package.json');
  const electron = readJson(electronPackage, 'Unable to read Electron runtime metadata') as { readonly version?: unknown };
  if (typeof electron.version !== 'string' || !electron.version) throw new Error('Electron metadata has no version');
  return { packageVersion: pkg.version, runtimeVersion: electron.version };
}

function buildManifest({
  rootDir = repositoryRoot,
  archivePath,
  keyPem,
  privateKeyPem,
  signingKeyPem,
  keyPath,
  publicKey,
  notes = process.env.QMX_UPDATE_NOTES || ''
}: BuildManifestOptions = {}): SignedManifest {
  rootDir = path.resolve(rootDir);
  const archive = path.resolve(rootDir, archivePath || path.join('release', 'QMX-Notebook-win32-x64', 'resources', 'app.asar'));
  const privateKey = privateKeyFor({ keyPem, privateKeyPem, signingKeyPem, keyPath });
  const pinned = publicKeyFor({ publicKey });
  if (!samePublicKey(crypto.createPublicKey(privateKey), pinned)) {
    throw new Error('Signing key does not match pinned application key');
  }
  const { packageVersion, runtimeVersion } = packageInfo(rootDir);
  let bytes: Buffer;
  try { bytes = fs.readFileSync(archive); } catch { throw new Error('Unable to read application archive'); }
  const manifest: Omit<SignedManifest, 'signature'> & { signature?: string } = {
    schema: 1,
    version: packageVersion,
    runtimeVersion,
    base: '../',
    notes,
    publishedAt: new Date().toISOString(),
    files: [{
      path: 'resources/app.asar',
      size: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    }]
  };
  manifest.signature = crypto.sign(null, Buffer.from(canonical(manifest)!), privateKey).toString('base64');
  const feed = path.join(rootDir, 'feed');
  fs.mkdirSync(feed, { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'resources'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'resources', 'app.asar'), bytes);
  fs.writeFileSync(path.join(feed, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Signed update feed ${manifest.version}: ${bytes.length} bytes, SHA-256 ${manifest.files[0].sha256}`);
  return manifest as SignedManifest;
}

function main(argv: readonly string[] = process.argv.slice(2)): SignedManifest {
  const options: BuildManifestOptions = {};
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--root-dir' && argv[index + 1]) options.rootDir = argv[++index];
    else if (argv[index] === '--notes' && argv[index + 1]) options.notes = argv[++index];
    else throw new Error('Usage: node tools/update-manifest.cjs [--root-dir directory] [--notes text]');
  }
  return buildManifest(options);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error((error as { readonly message?: string }).message || 'Unable to build update manifest'); process.exitCode = 1; }
}

export = { buildManifest, canonical };
