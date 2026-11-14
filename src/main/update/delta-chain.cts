import type {
  DeltaArchive, DeltaChainOptions, DeltaPatch, HistoricalDeltaEdge, HistoricalDeltaOptions
} from '../../shared/models/delta.js';

interface DeltaManifestModule {
  readonly verifyDeltaManifest: (manifest: unknown, options: {
    readonly publicKey: unknown;
    readonly runtimeVersion: string | undefined;
    readonly targetVersion: unknown;
    readonly targetFile: unknown;
  }) => readonly DeltaPatch[];
}

// The emitted module lives beside the original, not-yet-migrated verifier.
const { verifyDeltaManifest } = require('./delta-manifest.cjs') as DeltaManifestModule;
const MAX_SIZE = 256 * 1024 * 1024;
const MAX_STEPS = 8;
const MAX_EDGES = 128;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HASH = /^[a-f0-9]{64}$/;

export function verifyHistoricalDelta(manifest: unknown, { publicKey, runtimeVersion }: HistoricalDeltaOptions = {}): readonly HistoricalDeltaEdge[] {
  // These assertions describe property access only. The original verifier below
  // authenticates the historical target and retains its own validation errors.
  const candidate = manifest as { readonly version?: unknown; readonly target?: unknown } | null | undefined;
  const patches = verifyDeltaManifest(manifest, {
    publicKey, runtimeVersion, targetVersion: candidate?.version, targetFile: candidate?.target
  });
  const verified = manifest as { readonly version: string; readonly target: DeltaArchive };
  return patches.map(patch => ({
    patch: { ...patch }, version: verified.version, target: { ...verified.target }
  }));
}

function version(value: unknown): readonly bigint[] | null {
  return typeof value === 'string' && value.length <= 256 && VERSION.test(value)
    ? value.split('.').map(BigInt) : null;
}
function compare(a: readonly bigint[], b: readonly bigint[]): number {
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index]! < b[index]! ? -1 : 1;
  return 0;
}
function size(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_SIZE;
}
function node(ver: unknown, file: unknown): string | null {
  const candidate = file as { readonly size?: unknown; readonly sha256?: unknown } | null | undefined;
  if (!version(ver) || !candidate || !size(candidate.size) || typeof candidate.sha256 !== 'string' || !HASH.test(candidate.sha256.toLowerCase())) return null;
  return `${ver}:${candidate.size}:${candidate.sha256.toLowerCase()}`;
}

// This is a property-access view, not a claim that caller data was verified.
interface EdgeView {
  readonly patch?: {
    readonly size?: unknown;
    readonly fromVersion?: unknown;
    readonly fromSize?: unknown;
    readonly fromSha256?: unknown;
  } | null;
  readonly version?: unknown;
  readonly target?: unknown;
}
interface Route<Edge> {
  readonly bytes: number;
  readonly chain: readonly Edge[];
}
interface Outgoing<Edge> {
  readonly edge: Edge;
  readonly to: string;
}

// Edges must come from verifyHistoricalDelta/verifyDeltaManifest. This function
// chooses a route; it does not promote caller-provided metadata to signed data.
export function planDeltaChain<Edge>(edges: readonly Edge[], options?: DeltaChainOptions): readonly Edge[] | null;
export function planDeltaChain(edges: unknown, options?: DeltaChainOptions): readonly unknown[] | null;
export function planDeltaChain(edges: unknown, { currentVersion, base, targetVersion, target, maxSteps = MAX_STEPS, maxBytes }: DeltaChainOptions = {}): readonly unknown[] | null {
  const start = node(currentVersion, base), finish = node(targetVersion, target);
  const current = version(currentVersion), latest = version(targetVersion);
  if (!start || !finish || compare(current!, latest!) >= 0 || !Array.isArray(edges) || edges.length > MAX_EDGES ||
      !Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_STEPS ||
      (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 0))) return null;
  const budget = Math.min(maxBytes ?? MAX_SIZE, Math.ceil(target!.size * 0.9) - 1);
  const graph = new Map<string, Outgoing<unknown>[]>();
  for (const edge of edges as readonly unknown[]) {
    const candidate = edge as EdgeView | null | undefined;
    const patch = candidate?.patch;
    if (!patch || !size(patch.size)) continue;
    const from = node(patch.fromVersion, { size: patch.fromSize, sha256: patch.fromSha256 });
    const to = node(candidate!.version, candidate!.target);
    const sourceVersion = version(patch.fromVersion), destinationVersion = version(candidate!.version);
    if (!from || !to || compare(sourceVersion!, destinationVersion!) >= 0 ||
        compare(sourceVersion!, current!) < 0 || compare(destinationVersion!, latest!) > 0) continue;
    const outgoing = graph.get(from) || [];
    outgoing.push({ edge, to });
    graph.set(from, outgoing);
  }
  // Keep the cheapest route for each exact node at each hop count. Keeping only
  // one global route per node would discard a dearer route with fewer hops.
  let frontier = new Map<string, Route<unknown>>([[start, { bytes: 0, chain: [] }]]);
  let best: Route<unknown> | null = null;
  for (let step = 0; step < maxSteps && frontier.size; step++) {
    const next = new Map<string, Route<unknown>>();
    for (const [from, route] of frontier) {
      for (const { edge, to } of graph.get(from) || []) {
        // Preserve the original edge reads; planning does not replace the edge.
        const bytes = route.bytes + (edge as { readonly patch: { readonly size: number } }).patch.size;
        if (bytes > budget || (best && bytes >= best.bytes)) continue;
        const candidate: Route<unknown> = { bytes, chain: [...route.chain, edge] };
        if (to === finish) best = candidate;
        else if (!next.has(to) || bytes < next.get(to)!.bytes) next.set(to, candidate);
      }
    }
    frontier = next;
  }
  return best?.chain || null;
}
