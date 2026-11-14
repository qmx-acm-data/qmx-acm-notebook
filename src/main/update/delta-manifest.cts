'use strict';

import type { DeltaPatch } from '../../shared/models/delta.js';

const crypto = require('node:crypto') as typeof import('node:crypto');

interface DeltaManifestOptions {
  readonly publicKey?: unknown;
  readonly runtimeVersion?: string;
  readonly targetVersion?: unknown;
  readonly targetFile?: unknown;
}

interface TargetFileView {
  readonly size?: unknown;
  readonly sha256?: string | null;
}

// These views retain the original property accesses and coercions. They do not
// authenticate caller data; the checks below run before patches are returned.
interface ManifestView {
  readonly schema: unknown;
  readonly version: string;
  readonly runtimeVersion: string;
  readonly target: { readonly size: number; readonly sha256: string };
  readonly patches: readonly DeltaPatch[];
  readonly publishedAt: unknown;
  readonly signature: unknown;
}

// update-key.cjs exports the configured PEM string. Keep the runtime require at
// the point where the original loads it, including its native loading errors.
type UpdateKeyModule = string;

const LIMIT = 256 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function canonical(v: unknown): string | undefined {
  if (Array.isArray(v)) return '[' + (v as readonly unknown[]).map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    const record = v as Readonly<Record<string, unknown>>;
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(record[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

function exact(v: unknown, keys: readonly string[]): boolean {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === keys.slice().sort().join(','));
}

function size(v: number): boolean {
  return Number.isSafeInteger(v) && v > 0 && v <= LIMIT;
}

function verifyDeltaManifest(value: unknown, { publicKey, runtimeVersion, targetVersion, targetFile }: DeltaManifestOptions = {}): readonly DeltaPatch[] {
  const manifest = value as ManifestView;
  if (!exact(manifest, ['schema', 'version', 'runtimeVersion', 'target', 'patches', 'publishedAt', 'signature']) || manifest.schema !== 1 || !VERSION.test(manifest.version) || !VERSION.test(manifest.runtimeVersion) || typeof manifest.publishedAt !== 'string' || !Number.isFinite(Date.parse(manifest.publishedAt))) throw new Error('Invalid delta manifest');
  if (!exact(manifest.target, ['size', 'sha256']) || !size(manifest.target.size) || !HASH.test(manifest.target.sha256)) throw new Error('Invalid delta target');
  if (manifest.runtimeVersion !== runtimeVersion || manifest.version !== targetVersion || manifest.target.size !== (targetFile as TargetFileView | null | undefined)?.size || manifest.target.sha256 !== (targetFile as TargetFileView | null | undefined)?.sha256?.toLowerCase()) throw new Error('Delta target differs from signed application manifest');
  if (!Array.isArray(manifest.patches) || manifest.patches.length > 2) throw new Error('Invalid delta patch list');
  const bases = new Set<string>();
  for (const p of manifest.patches as readonly DeltaPatch[]) {
    if (!exact(p, ['fromVersion', 'fromSize', 'fromSha256', 'path', 'size', 'sha256', 'algorithm']) || typeof p.fromVersion !== 'string' || !VERSION.test(p.fromVersion) || !size(p.fromSize) || typeof p.fromSha256 !== 'string' || !HASH.test(p.fromSha256) || typeof p.sha256 !== 'string' || !HASH.test(p.sha256) || !size(p.size) || p.size >= manifest.target.size * 0.9 || p.algorithm !== 'qmx-cdc-brotli-v1' || p.path !== `resources/deltas/${p.fromSha256}.qmxdelta` || bases.has(p.fromSha256)) throw new Error('Invalid delta patch metadata');
    const a = p.fromVersion.split('.').map(BigInt), b = manifest.version.split('.').map(BigInt);
    const order = a.reduce((r, n, i) => r || (n < b[i] ? -1 : n > b[i] ? 1 : 0), 0);
    if (order >= 0) throw new Error('Delta base must precede target');
    bases.add(p.fromSha256);
  }
  if (typeof manifest.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(manifest.signature)) throw new Error('Invalid delta signature');
  const sig = Buffer.from(manifest.signature, 'base64');
  const configured: unknown = publicKey === undefined ? require('./update-key.cjs') as UpdateKeyModule : publicKey;
  const key = (configured as { readonly type?: unknown } | null | undefined)?.type === 'public'
    ? configured as import('node:crypto').KeyObject
    : crypto.createPublicKey(configured as Parameters<typeof crypto.createPublicKey>[0]);
  const unsigned = Object.fromEntries(Object.entries(manifest).filter(([k]) => k !== 'signature'));
  if (sig.toString('base64') !== manifest.signature || key.asymmetricKeyType !== 'ed25519' || !crypto.verify(null, Buffer.from(canonical(unsigned)!), key, sig)) throw new Error('Delta manifest signature verification failed');
  return manifest.patches;
}

export = { verifyDeltaManifest, canonical };
