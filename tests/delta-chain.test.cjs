'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifyHistoricalDelta, planDeltaChain } = require('../electron/delta-chain.cjs');

const keys = crypto.generateKeyPairSync('ed25519');
const options = { publicKey: keys.publicKey, runtimeVersion: '40.2.1' };
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const archive = (name, size = 10000) => ({ size, sha256: hash(name) });
const base = archive('1.2.2'), middle = archive('1.2.3'), target = archive('1.2.4');

// Independent test serializer ensures production's signature check is exercised.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function sign(manifest, privateKey = keys.privateKey) {
  const unsigned = structuredClone(manifest);
  delete unsigned.signature;
  return { ...unsigned, signature: crypto.sign(null, Buffer.from(canonical(unsigned)), privateKey).toString('base64') };
}
function edge(fromVersion, from, version, to, bytes = 1000, commit = 'a'.repeat(40)) {
  return { commit, version, target: { ...to }, patch: {
    fromVersion, fromSize: from.size, fromSha256: from.sha256,
    path: `resources/deltas/${from.sha256}.qmxdelta`, size: bytes,
    sha256: hash(`${fromVersion}:${version}:${bytes}`), algorithm: 'qmx-cdc-brotli-v1'
  } };
}
const first = () => edge('1.2.2', base, '1.2.3', middle);
const last = () => edge('1.2.3', middle, '1.2.4', target, 1100, 'b'.repeat(40));
const planOptions = overrides => ({ currentVersion: '1.2.2', base, targetVersion: '1.2.4', target, ...overrides });
function manifest(edgeValue = first()) {
  return sign({ schema: 1, version: edgeValue.version, runtimeVersion: options.runtimeVersion,
    target: edgeValue.target, patches: [edgeValue.patch], publishedAt: '2026-11-13T12:00:00Z' });
}

test('historical signed sidecar authenticates its own intermediate target and copies verified edge fields', () => {
  const signed = manifest();
  const edges = verifyHistoricalDelta(signed, options);
  assert.deepEqual(edges, [{ version: '1.2.3', target: middle, patch: first().patch }]);
  signed.target.sha256 = hash('mutated');
  signed.patches[0].fromVersion = '0.0.0';
  assert.deepEqual(edges[0].target, middle);
  assert.equal(edges[0].patch.fromVersion, '1.2.2');
  assert.deepEqual(verifyHistoricalDelta(sign({ ...manifest(), patches: [] }), options), []);
});

test('historical sidecar rejects unsigned changes, wrong signing key and incompatible runtime', () => {
  const changed = manifest();
  changed.target.sha256 = hash('tampered intermediate');
  assert.throws(() => verifyHistoricalDelta(changed, options), /signature/);
  const other = crypto.generateKeyPairSync('ed25519');
  assert.throws(() => verifyHistoricalDelta(sign(manifest(), other.privateKey), options), /signature/);
  assert.throws(() => verifyHistoricalDelta(manifest(), { ...options, runtimeVersion: '41.0.0' }), /target differs/);
});

test('historical verification retains every existing signed delta shape and path restriction', () => {
  for (const change of [
    m => { m.patches[0].path = '../untrusted.qmxdelta'; },
    m => { m.patches[0].fromVersion = m.version; },
    m => { m.patches[0].size = m.target.size * 0.9; },
    m => { m.patches.push({ ...m.patches[0] }); },
    m => { m.patches[0].algorithm = 'unknown'; },
    m => { m.target.size = 256 * 1024 * 1024 + 1; },
    m => { m.extra = true; }
  ]) {
    const value = manifest(); change(value);
    assert.throws(() => verifyHistoricalDelta(sign(value), options));
  }
  for (const value of [null, undefined, {}, { version: '1.2.3' }]) assert.throws(() => verifyHistoricalDelta(value, options));
});

test('planner connects 1.2.2 through historical 1.2.3 to the exact signed 1.2.4 target', () => {
  const a = first(), b = last();
  const edges = [b, a];
  assert.deepEqual(planDeltaChain(edges, planOptions()), [a, b]);
  assert.equal(planDeltaChain(edges, planOptions())[0], a, 'preserve historical commit on original edge');
  assert.deepEqual(edges, [b, a], 'planner must not mutate caller order');
  const direct = edge('1.2.2', base, '1.2.4', target, 1000);
  assert.deepEqual(planDeltaChain([a, b, direct], planOptions()), [direct]);
});

test('planner minimizes aggregate bytes instead of greedily choosing an available direct edge', () => {
  const a = first(), b = last();
  const direct = edge('1.2.2', base, '1.2.4', target, 3000);
  assert.deepEqual(planDeltaChain([direct, b, a], planOptions()), [a, b]);
});

test('every graph join requires matching version, size, and archive SHA', () => {
  for (const change of [
    e => { e.patch.fromVersion = '1.2.1'; },
    e => { e.patch.fromSize++; },
    e => { e.patch.fromSha256 = hash('different installed archive'); }
  ]) {
    const a = first(); change(a);
    assert.equal(planDeltaChain([a, last()], planOptions()), null);
  }
  for (const change of [
    e => { e.patch.fromVersion = '1.2.2'; },
    e => { e.patch.fromSize++; },
    e => { e.patch.fromSha256 = hash('different intermediate archive'); },
    e => { e.version = '1.2.5'; },
    e => { e.target.size++; },
    e => { e.target.sha256 = hash('different final archive'); }
  ]) {
    const b = last(); change(b);
    assert.equal(planDeltaChain([first(), b], planOptions()), null);
  }
});

test('planner rejects backward edges, cycles, version overshoot and disconnected history', () => {
  assert.equal(planDeltaChain([last()], planOptions()), null);
  assert.equal(planDeltaChain([edge('1.2.2', base, '1.2.2', target)], planOptions()), null);
  assert.equal(planDeltaChain([first(), edge('1.2.3', middle, '1.2.2', base)], planOptions()), null);
  const future = archive('future');
  assert.equal(planDeltaChain([edge('1.2.2', base, '1.3.0', future), edge('1.3.0', future, '1.2.4', target)], planOptions()), null);
});

test('planner bounds aggregate patch bytes strictly below ninety percent of latest full archive', () => {
  const a = first(), b = last();
  assert.deepEqual(planDeltaChain([a, b], planOptions({ maxBytes: 2100 })), [a, b]);
  assert.equal(planDeltaChain([a, b], planOptions({ maxBytes: 2099 })), null);
  assert.equal(planDeltaChain([a, b], planOptions({ maxBytes: 0 })), null);
  assert.equal(planDeltaChain([edge('1.2.2', base, '1.2.4', target, 9000)], planOptions()), null);
  a.patch.size = 4500; b.patch.size = 4500;
  assert.equal(planDeltaChain([a, b], planOptions()), null, 'two individually useful patches may cost too much together');
  b.patch.size--;
  assert.deepEqual(planDeltaChain([a, b], planOptions()), [a, b]);
});

test('planner preserves a more expensive shorter route when the cheapest route exhausts hop budget', () => {
  const midA = archive('A'), midB = archive('B');
  const cheapA = edge('1.0.0', base, '1.1.0', midA, 100);
  const cheapB = edge('1.1.0', midA, '1.2.0', midB, 100);
  const short = edge('1.0.0', base, '1.2.0', midB, 500);
  const finish = edge('1.2.0', midB, '1.3.0', target, 100);
  const opts = { currentVersion: '1.0.0', base, targetVersion: '1.3.0', target, maxSteps: 2 };
  assert.deepEqual(planDeltaChain([cheapA, cheapB, short, finish], opts), [short, finish]);
  assert.deepEqual(planDeltaChain([cheapA, cheapB, short, finish], { ...opts, maxSteps: 3 }), [cheapA, cheapB, finish]);
});

test('planner caps routes at eight hops and rejects unbounded or malformed inputs', () => {
  const edges = [];
  let before = base;
  for (let index = 1; index <= 9; index++) {
    const next = index === 9 ? target : archive(`step ${index}`);
    edges.push(edge(`1.0.${index - 1}`, before, `1.0.${index}`, next, 100));
    before = next;
  }
  const opts = { currentVersion: '1.0.0', base, targetVersion: '1.0.9', target };
  assert.equal(planDeltaChain(edges, opts), null);
  assert.equal(planDeltaChain(edges, { ...opts, maxSteps: 9 }), null);
  assert.equal(planDeltaChain([null, {}, { patch: {} }, first(), last()], planOptions())?.length, 2);
  assert.equal(planDeltaChain(Array(129).fill(first()), planOptions()), null);
  for (const overrides of [
    { currentVersion: '1.2.4' }, { targetVersion: '1.0.0' }, { currentVersion: '01.2.2' },
    { maxSteps: 0 }, { maxSteps: 1.5 }, { maxBytes: NaN }, { maxBytes: -1 },
    { base: { ...base, size: 0 } }, { target: { ...target, sha256: 'bad' } }
  ]) assert.equal(planDeltaChain([first(), last()], planOptions(overrides)), null);
});

test('numeric version order and case-normalized application digests preserve exact identity', () => {
  const direct = edge('1.9.0', base, '1.10.0', target);
  const opts = { currentVersion: '1.9.0', base: { ...base, sha256: base.sha256.toUpperCase() },
    targetVersion: '1.10.0', target: { ...target, sha256: target.sha256.toUpperCase() } };
  assert.deepEqual(planDeltaChain([direct], opts), [direct]);
});
