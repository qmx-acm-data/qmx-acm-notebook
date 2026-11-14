'use strict';

const { verifyDeltaManifest } = require('./delta-manifest.cjs');
const MAX_SIZE = 256 * 1024 * 1024;
const MAX_STEPS = 8;
const MAX_EDGES = 128;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HASH = /^[a-f0-9]{64}$/;

function verifyHistoricalDelta(manifest, { publicKey, runtimeVersion } = {}) {
  // The historical target is authenticated by this sidecar's own signature.
  // Planning must still end at the separately authenticated latest full manifest.
  const patches = verifyDeltaManifest(manifest, {
    publicKey, runtimeVersion, targetVersion: manifest?.version, targetFile: manifest?.target
  });
  return patches.map(patch => ({
    patch: { ...patch }, version: manifest.version, target: { ...manifest.target }
  }));
}

function version(value) {
  return typeof value === 'string' && value.length <= 256 && VERSION.test(value)
    ? value.split('.').map(BigInt) : null;
}
function compare(a, b) {
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  return 0;
}
function size(value) { return Number.isSafeInteger(value) && value > 0 && value <= MAX_SIZE; }
function node(ver, file) {
  if (!version(ver) || !file || !size(file.size) || typeof file.sha256 !== 'string' || !HASH.test(file.sha256.toLowerCase())) return null;
  return `${ver}:${file.size}:${file.sha256.toLowerCase()}`;
}

// Edges must come from verifyHistoricalDelta/verifyDeltaManifest. This function
// chooses a route; it does not promote caller-provided metadata to signed data.
function planDeltaChain(edges, { currentVersion, base, targetVersion, target, maxSteps = MAX_STEPS, maxBytes } = {}) {
  const start = node(currentVersion, base), finish = node(targetVersion, target);
  const current = version(currentVersion), latest = version(targetVersion);
  if (!start || !finish || compare(current, latest) >= 0 || !Array.isArray(edges) || edges.length > MAX_EDGES ||
      !Number.isSafeInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_STEPS ||
      (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 0))) return null;
  const budget = Math.min(maxBytes ?? MAX_SIZE, Math.ceil(target.size * 0.9) - 1);
  const graph = new Map();
  for (const edge of edges) {
    const patch = edge?.patch;
    if (!patch || !size(patch.size)) continue;
    const from = node(patch.fromVersion, { size: patch.fromSize, sha256: patch.fromSha256 });
    const to = node(edge.version, edge.target);
    const sourceVersion = version(patch.fromVersion), destinationVersion = version(edge.version);
    if (!from || !to || compare(sourceVersion, destinationVersion) >= 0 ||
        compare(sourceVersion, current) < 0 || compare(destinationVersion, latest) > 0) continue;
    const outgoing = graph.get(from) || [];
    outgoing.push({ edge, to });
    graph.set(from, outgoing);
  }
  // Keep the cheapest route for each exact node at each hop count. Keeping only
  // one global route per node would discard a dearer route with fewer hops.
  let frontier = new Map([[start, { bytes: 0, chain: [] }]]), best = null;
  for (let step = 0; step < maxSteps && frontier.size; step++) {
    const next = new Map();
    for (const [from, route] of frontier) {
      for (const { edge, to } of graph.get(from) || []) {
        const bytes = route.bytes + edge.patch.size;
        if (bytes > budget || (best && bytes >= best.bytes)) continue;
        const candidate = { bytes, chain: [...route.chain, edge] };
        if (to === finish) best = candidate;
        else if (!next.has(to) || bytes < next.get(to).bytes) next.set(to, candidate);
      }
    }
    frontier = next;
  }
  return best?.chain || null;
}

module.exports = { verifyHistoricalDelta, planDeltaChain };
