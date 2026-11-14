'use strict';

const fs = require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');
const crypto = require('node:crypto') as typeof import('node:crypto');

// Structural contracts keep these literal runtime paths relative to emitted tools/.
// JSON views retain the original property reads; the existing verifiers authenticate them.
interface ManifestView {
  version: string;
  runtimeVersion: string;
}
interface ManifestFile {
  path: string;
  size: number;
  sha256: string;
}
interface DeltaPatch {
  fromVersion: string;
  fromSize: number;
  fromSha256: string;
  path: string;
  size: number;
  sha256: string;
  algorithm: 'qmx-cdc-brotli-v1';
}
interface DeltaManifest extends ManifestView {
  schema: 1;
  target: { size: number; sha256: string };
  patches: DeltaPatch[];
  publishedAt: string;
  signature?: string;
}
interface DeltaBase {
  archivePath?: string;
  manifestPath?: string;
}
interface FeedOptions {
  rootDir?: string;
  publicKey?: unknown;
  keyPem?: string | Buffer;
  privateKeyPem?: string | Buffer;
  signingKeyPem?: string | Buffer;
  keyPath?: string;
  bases?: DeltaBase[];
  expectedVersion?: string;
  runtimeVersion?: string;
  currentVersion?: string;
  verifyDelta?: boolean;
}
interface VerifiedFeed {
  manifest: ManifestView;
  file: ManifestFile;
}
interface VerifiedDelta {
  manifest: unknown;
  patches: readonly DeltaPatch[];
}
interface VerifyDeltaOptions {
  publicKey?: unknown;
  manifest?: ManifestView;
  file?: ManifestFile;
}
interface ManifestOptions {
  publicKey?: unknown;
  runtimeVersion?: string;
  currentVersion?: string;
}
interface UpdaterModule {
  verifyManifest(manifest: unknown, options: ManifestOptions): ManifestFile;
}
interface ReleaseFeedModule {
  verifySigning(options: FeedOptions): true;
  verifyFeed(root: string, options: FeedOptions): VerifiedFeed;
}
interface UpdateManifestModule {
  canonical(value: unknown): string | undefined;
}
interface DeltaManifestModule {
  verifyDeltaManifest(manifest: unknown, options: {
    publicKey?: unknown;
    runtimeVersion?: string;
    targetVersion?: string;
    targetFile?: ManifestFile;
  }): readonly DeltaPatch[];
}
interface DeltaCodecModule {
  createDelta(base: Buffer, target: Buffer): Buffer;
  applyDelta(base: Buffer, patch: Buffer, maxOutput: number): Buffer;
}
interface ErrorView {
  code?: unknown;
  message?: string;
}

const updater = require('../electron/updater.cjs') as UpdaterModule;
const { canonical } = require('./update-manifest.cjs') as UpdateManifestModule;
// release-feed also calls our optional verifier; load its API only on demand.
const verifyFeed = (...args: Parameters<ReleaseFeedModule['verifyFeed']>): VerifiedFeed =>
  (require('./release-feed.cjs') as ReleaseFeedModule).verifyFeed(...args);
const MAX_FILE = 256 * 1024 * 1024;
const repositoryRoot = path.resolve(__dirname, '..');
const hash = (bytes: Buffer): string => crypto.createHash('sha256').update(bytes).digest('hex');

function readJson(file: string): unknown {
  const bytes = readFile(file, 256 * 1024);
  try { return JSON.parse(bytes.toString('utf8')) as unknown; }
  catch { throw new Error('Invalid release metadata JSON'); }
}

function readFile(file: string, max = MAX_FILE): Buffer {
  let stat;
  try { stat = fs.lstatSync(file); } catch { throw new Error('Unable to read release artifact'); }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size > max) throw new Error('Invalid release artifact size or file type');
  return fs.readFileSync(file);
}

// Reject symlink parents as well as final symlinks before reading/writing owned paths.
function ownedPath(root: string, relative: string): string {
  root = path.resolve(root);
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(root + path.sep)) throw new Error('Unsafe release artifact path');
  let current = root;
  for (const part of [null, ...path.relative(root, resolved).split(path.sep)]) {
    if (part !== null) current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Unsafe release artifact symlink');
    } catch (error) {
      if ((error as ErrorView).code !== 'ENOENT') throw error;
    }
  }
  return resolved;
}

function publicKeyFor(options: FeedOptions): import('node:crypto').KeyObject {
  const configured: unknown = options.publicKey === undefined ? require('../electron/update-key.cjs') as unknown : options.publicKey;
  try {
    const key = (configured as { type?: unknown } | null | undefined)?.type === 'public'
      ? configured as import('node:crypto').KeyObject
      : crypto.createPublicKey(configured as Parameters<typeof crypto.createPublicKey>[0]);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error();
    return key;
  } catch { throw new Error('Invalid pinned update public key'); }
}

function signingKey(options: FeedOptions): import('node:crypto').KeyObject {
  (require('./release-feed.cjs') as ReleaseFeedModule).verifySigning(options);
  try {
    const pem = options.keyPem ?? options.privateKeyPem ?? options.signingKeyPem ?? process.env.QMX_UPDATE_SIGNING_KEY_PEM;
    return pem !== undefined && pem !== '' ? crypto.createPrivateKey(pem)
      : crypto.createPrivateKey(fs.readFileSync((options.keyPath ?? process.env.QMX_UPDATE_SIGNING_KEY)!));
  } catch { throw new Error('Invalid update signing key'); }
}

function verifyDeltaFeed(root: string, { publicKey, manifest, file }: VerifyDeltaOptions = {}): VerifiedDelta | null {
  const deltaPath = ownedPath(root, 'feed/delta.json');
  if (!fs.existsSync(deltaPath)) return null;
  const delta = readJson(deltaPath);
  const patches = (require('../electron/delta-manifest.cjs') as DeltaManifestModule).verifyDeltaManifest(delta, {
    publicKey, runtimeVersion: manifest!.runtimeVersion, targetVersion: manifest!.version, targetFile: file
  });
  for (const patch of patches) {
    const bytes = readFile(ownedPath(root, patch.path));
    if (bytes.length !== patch.size || hash(bytes) !== patch.sha256.toLowerCase()) throw new Error('Signed delta patch hash mismatch');
  }
  return { manifest: delta, patches };
}

function buildDeltaFeed(options: FeedOptions = {}): DeltaManifest {
  const root = path.resolve(options.rootDir || repositoryRoot);
  const bases = options.bases || [];
  if (!Array.isArray(bases) || bases.length > 2) throw new Error('At most two explicit delta bases are allowed');
  const key = signingKey(options);
  const publicKey = publicKeyFor(options);
  const target = verifyFeed(root, { ...options, verifyDelta: false });
  const targetBytes = readFile(ownedPath(root, 'resources/app.asar'));
  const { createDelta, applyDelta } = require('../electron/delta-codec.cjs') as DeltaCodecModule;
  const patches: DeltaPatch[] = [], outputs: { relative: string; bytes: Buffer }[] = [], seen = new Set<string>();
  for (const base of bases as DeltaBase[]) {
    if (!base || typeof base.archivePath !== 'string' || typeof base.manifestPath !== 'string') throw new Error('Each delta base requires explicit archive and signed manifest paths');
    const manifest = readJson(path.resolve(base.manifestPath)) as ManifestView;
    const file = updater.verifyManifest(manifest, { publicKey, runtimeVersion: manifest.runtimeVersion });
    updater.verifyManifest(target.manifest, { publicKey, runtimeVersion: target.manifest.runtimeVersion, currentVersion: manifest.version });
    const bytes = readFile(path.resolve(base.archivePath));
    if (bytes.length !== file.size || hash(bytes) !== file.sha256.toLowerCase()) throw new Error('Signed delta base hash mismatch');
    if (manifest.runtimeVersion !== target.manifest.runtimeVersion) continue;
    if (seen.has(file.sha256.toLowerCase())) throw new Error('Duplicate delta base');
    seen.add(file.sha256.toLowerCase());
    const patch = createDelta(bytes, targetBytes);
    if (!Buffer.isBuffer(patch) || patch.length <= 0 || patch.length > MAX_FILE) throw new Error('Invalid generated delta patch');
    if (patch.length >= targetBytes.length * 0.9) continue;
    if (!applyDelta(bytes, patch, targetBytes.length).equals(targetBytes)) throw new Error('Generated delta does not reconstruct target');
    const relative = `resources/deltas/${file.sha256.toLowerCase()}.qmxdelta`;
    patches.push({ fromVersion: manifest.version, fromSize: bytes.length, fromSha256: file.sha256.toLowerCase(), path: relative,
      size: patch.length, sha256: hash(patch), algorithm: 'qmx-cdc-brotli-v1' });
    outputs.push({ relative, bytes: patch });
  }
  const delta: DeltaManifest = { schema: 1, version: target.manifest.version, runtimeVersion: target.manifest.runtimeVersion,
    target: { size: targetBytes.length, sha256: hash(targetBytes) }, patches, publishedAt: new Date().toISOString() };
  delta.signature = crypto.sign(null, Buffer.from(canonical(delta)!), key).toString('base64');
  (require('../electron/delta-manifest.cjs') as DeltaManifestModule).verifyDeltaManifest(delta, {
    publicKey, runtimeVersion: target.manifest.runtimeVersion, targetVersion: target.manifest.version, targetFile: target.file
  });
  // Validate every input and output before replacing any existing metadata.
  const deltaPath = ownedPath(root, 'feed/delta.json');
  for (const output of outputs) ownedPath(root, output.relative);
  for (const output of outputs) {
    const destination = ownedPath(root, output.relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, output.bytes);
  }
  fs.mkdirSync(path.dirname(deltaPath), { recursive: true });
  fs.writeFileSync(deltaPath, JSON.stringify(delta, null, 2) + '\n');
  return delta;
}

function releaseOptions(options: FeedOptions): FeedOptions {
  if (!options.expectedVersion) throw new Error('Explicit release version required');
  return { ...options, runtimeVersion: options.runtimeVersion || 'manifest' };
}

function listAssets(root: string, options: FeedOptions = {}): string[] {
  const verified = verifyFeed(root, { ...releaseOptions(options), verifyDelta: false });
  const delta = verifyDeltaFeedMetadata(root, verified, options);
  return delta ? delta.patches.map(patch => `update-delta-${patch.fromSha256}.qmxdelta`) : [];
}

// Used before downloading patches: metadata is authenticated before it can name assets.
function verifyDeltaFeedMetadata(root: string, verified: VerifiedFeed, options: FeedOptions): VerifiedDelta | null {
  const file = ownedPath(root, 'feed/delta.json');
  if (!fs.existsSync(file)) return null;
  const manifest = readJson(file);
  const patches = (require('../electron/delta-manifest.cjs') as DeltaManifestModule).verifyDeltaManifest(manifest, {
    publicKey: publicKeyFor(options), runtimeVersion: verified.manifest.runtimeVersion,
    targetVersion: verified.manifest.version, targetFile: verified.file
  });
  return { manifest, patches };
}

function installFeed(incoming: string, options: FeedOptions = {}): { manifest: ManifestView; patches: readonly DeltaPatch[]; removed: string[] } {
  const root = path.resolve(options.rootDir || repositoryRoot);
  incoming = path.resolve(incoming);
  if (root === incoming) throw new Error('Incoming and installed feed directories must differ');
  const verified = verifyFeed(incoming, releaseOptions(options));
  const next = verifyDeltaFeedMetadata(incoming, verified, options);
  let old: VerifiedDelta | null = null;
  if (fs.existsSync(ownedPath(root, 'feed/delta.json'))) {
    const oldManifest = readJson(ownedPath(root, 'feed/manifest.json')) as ManifestView;
    const oldFile = updater.verifyManifest(oldManifest, { publicKey: publicKeyFor(options), runtimeVersion: oldManifest.runtimeVersion });
    old = verifyDeltaFeedMetadata(root, { manifest: oldManifest, file: oldFile }, options);
  }
  const copies = ['resources/app.asar', ...(next ? next.patches.map(patch => patch.path) : []), 'feed/manifest.json', ...(next ? ['feed/delta.json'] : [])];
  const keep = new Set(next ? next.patches.map(patch => patch.path) : []);
  const removals = old ? old.patches.map(patch => patch.path).filter(file => !keep.has(file)) : [];
  if (!next && old) removals.push('feed/delta.json');
  // Only paths authenticated by the old manifest may be pruned. Unknown files stay.
  for (const relative of [...copies, ...removals]) ownedPath(root, relative);
  for (const relative of copies) {
    const destination = ownedPath(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(ownedPath(incoming, relative), destination);
  }
  for (const relative of removals) fs.rmSync(ownedPath(root, relative), { force: true });
  return { manifest: verified.manifest, patches: next?.patches || [], removed: removals };
}

function main(argv = process.argv.slice(2)): void {
  const command = argv.shift(), options: FeedOptions = {}, bases: DeltaBase[] = [];
  let directory: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index], value = argv[index + 1];
    if (['--root-dir', '--version', '--base', '--base-manifest'].includes(flag) && value && !value.startsWith('--')) {
      index++;
      if (flag === '--root-dir') options.rootDir = value;
      else if (flag === '--version') options.expectedVersion = value;
      else if (flag === '--base') bases.push({ archivePath: value });
      else {
        if (!bases.length || bases.at(-1)!.manifestPath) throw new Error('--base-manifest must follow its --base');
        bases.at(-1)!.manifestPath = value;
      }
    } else if (!flag.startsWith('--') && directory === undefined) directory = flag;
    else throw new Error('Invalid delta-feed arguments');
  }
  if (command === 'build' && directory === undefined) {
    const result = buildDeltaFeed({ ...options, bases });
    console.log(`Signed delta feed ${result.version}: ${result.patches.length} patches`);
  } else if (command === 'list-assets' && directory && !bases.length) {
    for (const asset of listAssets(directory, options)) console.log(asset);
  } else if (command === 'install' && directory && !bases.length) {
    const result = installFeed(directory, options);
    console.log(`Installed verified update feed ${result.manifest.version}: ${result.patches.length} patches; removed ${result.removed.length} superseded files`);
  } else throw new Error('Usage: node tools/delta-feed.cjs build [--root-dir directory] [--base archive --base-manifest manifest] (max 2) | list-assets directory --version x.y.z | install directory --root-dir destination --version x.y.z');
}

// TypeScript emits export= after the CLI block; publish now for release-feed's callback.
const deltaFeed = { buildDeltaFeed, verifyDeltaFeed, listAssets, installFeed, main };
module.exports = deltaFeed;
export = deltaFeed;

if (require.main === module) {
  try { main(); }
  catch (error) { console.error((error as ErrorView).message || 'Delta release operation failed'); process.exitCode = 1; }
}
