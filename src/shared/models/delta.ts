/** Archive identity authenticated by a signed application or delta manifest. */
export interface DeltaArchive {
  readonly size: number;
  readonly sha256: string;
}

/** Patch metadata returned by the signed delta manifest verifier. */
export interface DeltaPatch {
  readonly fromVersion: string;
  readonly fromSize: number;
  readonly fromSha256: string;
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
  readonly algorithm: 'qmx-cdc-brotli-v1';
}

export interface HistoricalDeltaEdge {
  readonly patch: DeltaPatch;
  readonly version: string;
  readonly target: DeltaArchive;
}

export interface HistoricalDeltaOptions {
  /** The existing Node verifier owns key parsing and its original errors. */
  readonly publicKey?: unknown;
  readonly runtimeVersion?: string;
}

export interface DeltaChainOptions {
  readonly currentVersion?: string;
  readonly base?: DeltaArchive;
  readonly targetVersion?: string;
  readonly target?: DeltaArchive;
  readonly maxSteps?: number;
  readonly maxBytes?: number;
}
