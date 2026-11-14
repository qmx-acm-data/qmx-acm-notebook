import type { UpdateProgress } from '../../shared/contracts/notebook.js';

/** Node fetch and the updater's minimal injected transports share this shape. */
export interface UpdateResponse {
  readonly url?: string;
  readonly redirected?: boolean;
  readonly ok: boolean;
  readonly status: number;
  readonly body?: AsyncIterable<Uint8Array> | null;
  readonly headers?: { get?(name: string): string | null };
}

export interface UpdateRequest {
  readonly headers: { readonly Accept: string; readonly 'User-Agent': string };
  readonly signal: AbortSignal;
  readonly redirect: 'error';
  readonly credentials: 'omit';
}

export interface UpdaterOptions {
  readonly currentVersion?: string;
  readonly downloadDir?: string;
  readonly fetcher?: (url: string, options: UpdateRequest) => PromiseLike<UpdateResponse> | UpdateResponse;
  readonly onProgress?: (progress: UpdateProgress) => void;
  readonly timeoutMs?: number;
  readonly attemptMs?: number;
  readonly runtimeVersion?: string;
  readonly publicKey?: unknown;
  readonly installedArchive?: string;
}

export interface ManifestFile {
  path: 'resources/app.asar';
  size: number;
  sha256: string;
}

/** Shape returned only after the original signed manifest checks succeed. */
export interface SignedManifest {
  schema: 1;
  version: string;
  runtimeVersion: string;
  base: '../';
  notes: string;
  publishedAt: string;
  files: [ManifestFile];
  signature: string;
}

export interface ManifestOptions {
  readonly publicKey?: unknown;
  readonly runtimeVersion?: string;
  readonly currentVersion?: unknown;
}

export interface ReadyUpdate {
  version: string;
  path: string;
  manifest: SignedManifest;
}

export interface Updater {
  check(): Promise<UpdateProgress>;
  download(): Promise<ReadyUpdate>;
  verifyReady(): Promise<ReadyUpdate>;
  getState(): UpdateProgress;
}
