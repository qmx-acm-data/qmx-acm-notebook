'use strict';
const { appPath } = require('./app-path.cjs');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const createUpdater = require(appPath('electron/updater.cjs'));
const { createDelta } = require(appPath('electron/delta-codec.cjs'));

const trusted = crypto.generateKeyPairSync('ed25519');
const stranger = crypto.generateKeyPairSync('ed25519');
const runtimeVersion = '42.0.0';
const latestSha = 'a'.repeat(40);
const historicalSha = 'b'.repeat(40);
const commitUrl = 'https://api.github.com/repos/qmx-acm-data/qmx-acm-notebook/commits/main';
const historyUrl = `https://api.github.com/repos/qmx-acm-data/qmx-acm-notebook/commits?sha=${latestSha}&path=feed%2Fdelta.json&per_page=8`;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const base = crypto.randomBytes(256 * 1024);
const intermediate = Buffer.from(base);
intermediate[51234] ^= 1;
const target = Buffer.from(intermediate);
target[201234] ^= 1;
const firstPatch = createDelta(base, intermediate);
const lastPatch = createDelta(intermediate, target);
const totalPatchBytes = firstPatch.length + lastPatch.length;

// Independent signer: production canonicalization must agree with this fixture.
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function sign(value, key = trusted.privateKey) {
  const unsigned = structuredClone(value);
  delete unsigned.signature;
  return { ...unsigned, signature: crypto.sign(null, Buffer.from(canonical(unsigned)), key).toString('base64') };
}
function sources(sha, file) {
  const raw = `https://raw.githubusercontent.com/qmx-acm-data/qmx-acm-notebook/${sha}/${file}`;
  return [
    `https://api.github.com/repos/qmx-acm-data/qmx-acm-notebook/contents/${file}?ref=${sha}`,
    raw,
    `https://cdn.jsdelivr.net/gh/qmx-acm-data/qmx-acm-notebook@${sha}/${file}`,
    `https://gcore.jsdelivr.net/gh/qmx-acm-data/qmx-acm-notebook@${sha}/${file}`,
    `https://gh-proxy.com/${raw}`,
  ];
}
function patchMetadata(fromVersion, from, bytes) {
  const fromSha256 = hash(from);
  return { fromVersion, fromSize: from.length, fromSha256, path: `resources/deltas/${fromSha256}.qmxdelta`, size: bytes.length, sha256: hash(bytes), algorithm: 'qmx-cdc-brotli-v1' };
}
function release(version, bytes, fromVersion, from, patchBytes) {
  const file = { path: 'resources/app.asar', size: bytes.length, sha256: hash(bytes) };
  const patch = patchMetadata(fromVersion, from, patchBytes);
  return {
    manifest: sign({ schema: 1, version, runtimeVersion, base: '../', notes: `Signed release ${version}`, publishedAt: '2026-01-01T00:00:00Z', files: [file] }),
    delta: sign({ schema: 1, version, runtimeVersion, target: { size: file.size, sha256: file.sha256 }, patches: [patch], publishedAt: '2026-01-01T00:00:00Z' }),
    patches: new Map([[patch.path, patchBytes]]),
  };
}
function response(value, extra = {}) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  return { ok: true, status: 200, headers: new Headers(), body: Readable.from([bytes]), ...extra };
}
async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat();
}
function requests(context, sha, file) {
  return context.calls.filter(call => sources(sha, file).includes(call.url));
}
function patchRequests(context) {
  return context.calls.filter(call => call.url.includes('/resources/deltas/'));
}
async function fixture(t, options = {}) {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'qmx-delta-chain-')));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const installation = path.join(directory, 'installed');
  const downloadDir = path.join(directory, 'downloads');
  await fs.mkdir(installation);
  await fs.mkdir(downloadDir);
  const installedArchive = path.join(installation, 'app.asar');
  const installedBytes = options.installedBytes ?? base;
  await fs.writeFile(installedArchive, installedBytes);
  const latest = release('1.2.4', target, '1.2.3', intermediate, lastPatch);
  const historical = release('1.2.3', intermediate, '1.2.2', base, firstPatch);
  const context = {
    directory, installation, downloadDir, installedArchive, installedBytes,
    latest, historical, releases: new Map([[latestSha, latest], [historicalSha, historical]]),
    history: [{ sha: latestSha }, { sha: historicalSha }],
    calls: [], events: [], bodyBytes: { historical: 0, latest: 0, full: 0 },
    fullBytes: target,
  };
  await options.configure?.(context);
  function counted(bytes, kind) {
    return response(bytes, { body: (async function* () {
      // Even a highly compact random patch must expose an intermediate progress event.
      const chunkSize = Math.min(4096, Math.max(1, Math.ceil(bytes.length / 2)));
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(offset, offset + chunkSize);
        context.bodyBytes[kind] += chunk.length;
        yield chunk;
      }
    })() });
  }
  context.counted = counted;
  context.updater = createUpdater({
    currentVersion: options.currentVersion ?? '1.2.2', runtimeVersion, publicKey: trusted.publicKey,
    installedArchive: options.noBase ? undefined : installedArchive, downloadDir,
    timeoutMs: 10000, attemptMs: 5000,
    onProgress: event => context.events.push(event),
    fetcher: async (url, opts) => {
      context.calls.push({ url, opts });
      const override = await options.respond?.(url, context);
      if (override !== undefined) return override;
      if (url === commitUrl) return response({ sha: latestSha });
      if (url === historyUrl) return response(context.history);
      for (const [sha, value] of context.releases) {
        if (sources(sha, 'feed/manifest.json').includes(url)) return response(value.manifest);
        if (sources(sha, 'feed/delta.json').includes(url)) return response(value.delta);
        for (const [file, bytes] of value.patches) {
          if (sources(sha, file).includes(url)) return counted(bytes, sha === latestSha ? 'latest' : 'historical');
        }
      }
      if (sources(latestSha, 'resources/app.asar').includes(url)) return counted(context.fullBytes, 'full');
      assert.fail(`Unexpected update URL: ${url}`);
    },
  });
  return context;
}
async function assertReady(context, kind, reason = null, expectedBytes = target, steps = kind === 'delta' ? 2 : 0, expectedTransferred = totalPatchBytes) {
  const ready = await context.updater.download();
  const manifest = structuredClone(context.latest.manifest);
  assert.equal(ready.version, manifest.version);
  assert.equal(path.basename(ready.path), 'app.asar');
  assert.deepEqual(ready.manifest, manifest, 'only the original final release manifest can authorize ready');
  assert.deepEqual(await fs.readFile(ready.path), expectedBytes);
  assert.deepEqual(await fs.readFile(context.installedArchive), context.installedBytes);
  const state = context.updater.getState();
  assert.equal(state.phase, 'ready');
  assert.equal(state.downloadKind, kind);
  assert.equal(state.deltaReason, reason);
  assert.equal(state.deltaSteps, steps);
  assert.equal(state.fullSize, expectedBytes.length);
  assert.equal(state.total, kind === 'delta' ? expectedTransferred : expectedBytes.length);
  assert.equal(state.downloaded, state.total);
  assert.equal(state.percent, 100);
  assert.deepEqual((await filesIn(context.downloadDir)).map(file => path.basename(file)).sort(), ['.owner.json', 'app.asar']);
  assert.equal(context.events.filter(event => event.phase === 'ready').length, 1, 'no intermediate release is ever published ready');
  assert.deepEqual(await context.updater.verifyReady(), ready);
  // Returning an object to the caller must not let that caller retarget verifyReady.
  ready.manifest.version = '9.9.9';
  ready.manifest.files[0].sha256 = hash('forged caller copy');
  const verified = await context.updater.verifyReady();
  assert.deepEqual(verified.manifest, manifest);
  assert.equal(verified.version, manifest.version);
  return verified;
}
async function assertFullWithoutPatch(context, reason = 'no-patch-path') {
  const available = await context.updater.check();
  assert.equal(available.downloadKind, 'full');
  assert.equal(available.deltaSteps, 0);
  assert.equal(available.deltaReason, reason);
  await assertReady(context, 'full', reason);
  assert.equal(patchRequests(context).length, 0);
  assert.deepEqual(context.bodyBytes, { historical: 0, latest: 0, full: target.length });
}

test('signed 1.2.2 -> 1.2.3 -> 1.2.4 chain downloads exact cumulative patch bytes and stages only the final archive', async t => {
  assert.equal(base.length, 256 * 1024);
  assert.ok(totalPatchBytes < target.length * 0.9);
  let sawIntermediate = false;
  const context = await fixture(t, { respond: async (url, value) => {
    const finalPatchPath = value.latest.delta.patches[0].path;
    if (!sources(latestSha, finalPatchPath).includes(url)) return;
    sawIntermediate = true;
    assert.deepEqual(await fs.readFile(value.installedArchive), base);
    const staged = (await filesIn(value.downloadDir)).map(file => path.basename(file));
    assert.equal(staged.includes('app.asar'), false);
    assert.equal(staged.includes('app.asar.part'), false, 'intermediate bytes must stay in memory');
    assert.equal(value.events.some(event => event.phase === 'ready'), false);
    const state = value.updater.getState();
    assert.equal(state.downloadKind, 'delta');
    assert.equal(state.deltaSteps, 2);
    assert.equal(state.downloaded, firstPatch.length);
    assert.equal(state.total, totalPatchBytes);
    await assert.rejects(value.updater.verifyReady(), /busy|no verified update/i);
  } });
  const available = await context.updater.check();
  assert.equal(available.downloadKind, 'delta');
  assert.equal(available.deltaSteps, 2);
  assert.equal(available.deltaReason, null);
  assert.equal(available.total, totalPatchBytes);
  assert.equal(available.fullSize, target.length);
  assert.deepEqual(context.bodyBytes, { historical: 0, latest: 0, full: 0 });
  assert.deepEqual(context.calls.map(call => call.url), [
    commitUrl, sources(latestSha, 'feed/manifest.json')[0], sources(latestSha, 'feed/delta.json')[0],
    historyUrl, sources(historicalSha, 'feed/manifest.json')[0], sources(historicalSha, 'feed/delta.json')[0],
  ]);
  await assertReady(context, 'delta');
  assert.equal(sawIntermediate, true);
  assert.deepEqual(context.bodyBytes, { historical: firstPatch.length, latest: lastPatch.length, full: 0 });
  assert.equal(requests(context, latestSha, 'resources/app.asar').length, 0);
  const progress = context.events.filter(event => event.phase === 'downloading' && event.downloadKind === 'delta');
  assert.ok(progress.some(event => event.downloaded > 0 && event.downloaded < firstPatch.length));
  assert.ok(progress.some(event => event.downloaded === firstPatch.length));
  assert.ok(progress.some(event => event.downloaded > firstPatch.length && event.downloaded < totalPatchBytes));
  assert.ok(progress.some(event => event.downloaded === totalPatchBytes));
  for (let index = 0; index < progress.length; index++) {
    assert.equal(progress[index].total, totalPatchBytes);
    assert.equal(progress[index].percent, Math.floor(progress[index].downloaded / totalPatchBytes * 100));
    if (index) assert.ok(progress[index].downloaded >= progress[index - 1].downloaded);
  }
  assert.ok(context.events.every(event => !('path' in event)));
});

test('direct current-version patch bypasses history discovery even when the history response is invalid', async t => {
  const directPatch = createDelta(base, target);
  const context = await fixture(t, { configure: value => {
    const patch = patchMetadata('1.2.2', base, directPatch);
    value.latest.delta = sign({ ...value.latest.delta, patches: [patch] });
    value.latest.patches = new Map([[patch.path, directPatch]]);
    value.history = { invalid: true };
  } });
  const available = await context.updater.check();
  assert.equal(available.downloadKind, 'delta');
  assert.equal(available.deltaSteps, 1);
  await assertReady(context, 'delta', null, target, 1, directPatch.length);
  assert.equal(context.calls.some(call => call.url === historyUrl), false);
  assert.equal(requests(context, historicalSha, 'feed/manifest.json').length, 0);
  assert.deepEqual(context.bodyBytes, { historical: 0, latest: directPatch.length, full: 0 });
});

test('historical metadata and patch retries remain pinned to their discovered SHA and omit credentials', async t => {
  const context = await fixture(t, { respond: (url, value) => {
    const files = ['feed/manifest.json', 'feed/delta.json', value.historical.delta.patches[0].path];
    for (const file of files) {
      if (url === sources(historicalSha, file)[0]) throw Object.assign(new Error('mirror offline'), { code: 'ECONNRESET' });
    }
  } });
  await assertReady(context, 'delta');
  for (const file of ['feed/manifest.json', 'feed/delta.json', context.historical.delta.patches[0].path]) {
    assert.deepEqual(requests(context, historicalSha, file).map(call => call.url), sources(historicalSha, file).slice(0, 2));
  }
  assert.equal(context.calls.filter(call => call.url === commitUrl).length, 1);
  assert.equal(context.calls.filter(call => call.url === historyUrl).length, 1);
  for (const { url, opts } of context.calls) {
    assert.equal(opts.redirect, 'error');
    assert.equal(opts.credentials, 'omit');
    assert.equal(Object.keys(opts.headers).some(name => /authorization|cookie/i.test(name)), false);
    if (url !== commitUrl && url !== historyUrl) assert.ok([...context.releases].some(([sha]) => url.includes(sha)));
  }
  assert.deepEqual(context.bodyBytes, { historical: firstPatch.length, latest: lastPatch.length, full: 0 });
});

for (const which of ['historical', 'latest']) {
  test(`missing ${which} patch falls back to the signed full target with patch-failed`, async t => {
    const context = await fixture(t, { respond: (url, value) => {
      const sha = which === 'historical' ? historicalSha : latestSha;
      const file = value[which].delta.patches[0].path;
      if (sources(sha, file).includes(url)) return response({}, { ok: false, status: 404 });
    } });
    assert.equal((await context.updater.check()).deltaSteps, 2);
    await assertReady(context, 'full', 'patch-failed');
    assert.equal(context.bodyBytes.full, target.length);
    assert.equal(context.bodyBytes.latest, 0);
    assert.equal(context.bodyBytes.historical, which === 'latest' ? firstPatch.length : 0);
  });
}

for (const failure of ['corrupt patch body', 'signed incorrect intermediate reconstruction']) {
  test(`${failure} is rejected before the next chain edge and safely downloads the full target`, async t => {
    const context = await fixture(t, {
      configure: value => {
        if (failure !== 'signed incorrect intermediate reconstruction') return;
        const wrong = Buffer.from(intermediate);
        wrong[71111] ^= 1;
        const bytes = createDelta(base, wrong);
        const patch = patchMetadata('1.2.2', base, bytes);
        value.historical.delta = sign({ ...value.historical.delta, patches: [patch] });
        value.historical.patches.set(patch.path, bytes);
      },
      respond: (url, value) => {
        if (failure !== 'corrupt patch body' || !sources(historicalSha, value.historical.delta.patches[0].path).includes(url)) return;
        const bytes = Buffer.from(firstPatch);
        bytes[bytes.length - 1] ^= 1;
        return value.counted(bytes, 'historical');
      },
    });
    assert.equal((await context.updater.check()).deltaSteps, 2);
    await assertReady(context, 'full', 'patch-failed');
    assert.equal(requests(context, latestSha, context.latest.delta.patches[0].path).length, 0);
    assert.ok(context.bodyBytes.historical > 0);
    assert.equal(context.bodyBytes.latest, 0);
    assert.equal(context.bodyBytes.full, target.length);
  });
}

for (const document of ['manifest', 'delta']) {
  for (const invalid of ['wrong runtime', 'untrusted signature', 'tampered signature']) {
    test(`historical ${document} with ${invalid} contributes no usable edge or patch request`, async t => {
      const context = await fixture(t, { configure: value => {
        let metadata = value.historical[document];
        if (invalid === 'wrong runtime') metadata = sign({ ...metadata, runtimeVersion: '41.0.0' });
        if (invalid === 'untrusted signature') metadata = sign(metadata, stranger.privateKey);
        if (invalid === 'tampered signature') metadata.version = '1.2.99';
        value.historical[document] = metadata;
      } });
      await assertFullWithoutPatch(context);
      if (document === 'manifest') assert.equal(requests(context, historicalSha, 'feed/delta.json').length, 0);
    });
  }
}

for (const mismatch of ['intermediate version', 'intermediate size', 'intermediate hash', 'installed base version', 'installed base size', 'installed base hash', 'historical signed target']) {
  test(`incorrect graph tuple (${mismatch}) cannot join a chain`, async t => {
    const context = await fixture(t, { configure: value => {
      if (mismatch === 'historical signed target') {
        value.historical.delta = sign({ ...value.historical.delta, target: { size: intermediate.length, sha256: hash('different signed intermediate') } });
        return;
      }
      const document = mismatch.startsWith('intermediate') ? value.latest : value.historical;
      const patch = { ...document.delta.patches[0] };
      if (mismatch.endsWith('version')) patch.fromVersion = '1.2.1';
      if (mismatch.endsWith('size')) patch.fromSize++;
      if (mismatch.endsWith('hash')) {
        patch.fromSha256 = hash('wrong graph node');
        patch.path = `resources/deltas/${patch.fromSha256}.qmxdelta`;
      }
      document.delta = sign({ ...document.delta, patches: [patch] });
    } });
    await assertFullWithoutPatch(context);
  });
}

for (const [name, history] of [
  ['more than eight commits', Array.from({ length: 9 }, (_, index) => ({ sha: index.toString(16).repeat(40) }))],
  ['non-array list', { sha: historicalSha }],
  ['null list', null],
  ['null item', [null]],
  ['missing SHA', [{}]],
  ['short SHA', [{ sha: 'b'.repeat(39) }]],
  ['nonhex SHA', [{ sha: 'g'.repeat(40) }]],
  ['untrusted URL in place of SHA', [{ sha: 'https://attacker.invalid/feed/delta.json' }]],
]) {
  test(`invalid discovery (${name}) falls back before fetching historical metadata or any patch`, async t => {
    const context = await fixture(t, { configure: value => { value.history = history; } });
    await assertFullWithoutPatch(context, 'metadata-unavailable');
    assert.equal(requests(context, historicalSha, 'feed/manifest.json').length, 0);
    assert.equal(requests(context, historicalSha, 'feed/delta.json').length, 0);
  });
}

test('aggregate chain cost at or above ninety percent of the full archive downloads no patch', async t => {
  const context = await fixture(t, { configure: value => {
    const size = Math.ceil(target.length * 0.45);
    assert.ok(size < target.length * 0.9, 'each individually valid patch remains below the single-edge cap');
    assert.ok(size * 2 >= target.length * 0.9);
    for (const document of [value.historical, value.latest]) {
      document.delta = sign({ ...document.delta, patches: [{ ...document.delta.patches[0], size }] });
    }
  } });
  await assertFullWithoutPatch(context);
});

test('the least aggregate patch cost wins when signed historical routes compete', async t => {
  const expensiveSha = 'c'.repeat(40);
  const expensiveTarget = Buffer.from(base);
  expensiveTarget[91234] ^= 1;
  const expensiveFirst = createDelta(base, expensiveTarget);
  const expensiveLast = createDelta(expensiveTarget, target);
  const cheapLatestSha = 'd'.repeat(40);
  const context = await fixture(t, { configure: value => {
    const expensive = release('1.2.3', expensiveTarget, '1.2.2', base, expensiveFirst);
    expensive.delta = sign({ ...expensive.delta, patches: [{ ...expensive.delta.patches[0], size: Math.ceil(target.length * 0.4) }] });
    value.releases.set(expensiveSha, expensive);
    // History can contain an earlier activation commit of the final version.
    // Its independently signed full manifest and delta still provide valid edges.
    const cheapLatest = { ...value.latest, patches: new Map(value.latest.patches) };
    value.releases.set(cheapLatestSha, cheapLatest);
    const expensiveEdge = patchMetadata('1.2.3', expensiveTarget, expensiveLast);
    value.latest.delta = sign({ ...value.latest.delta, patches: [expensiveEdge] });
    value.latest.patches = new Map([[expensiveEdge.path, expensiveLast]]);
    value.history = [{ sha: expensiveSha }, { sha: cheapLatestSha }, { sha: historicalSha }];
  } });
  assert.equal((await context.updater.check()).total, totalPatchBytes);
  await assertReady(context, 'delta');
  assert.equal(requests(context, expensiveSha, context.releases.get(expensiveSha).delta.patches[0].path).length, 0);
  assert.equal(requests(context, latestSha, context.latest.delta.patches[0].path).length, 0);
  assert.equal(requests(context, cheapLatestSha, context.releases.get(cheapLatestSha).delta.patches[0].path).length, 1);
  assert.equal(context.bodyBytes.full, 0);
});

for (const steps of [8, 9]) {
  test(`${steps}-edge signed history ${steps === 8 ? 'uses the full permitted chain' : 'exceeds the chain cap and downloads the full archive'}`, async t => {
    const snapshots = [base];
    let patchTotal = 0;
    const context = await fixture(t, { configure: value => {
      value.releases.clear();
      value.history = [];
      for (let index = 1; index <= steps; index++) {
        const bytes = Buffer.from(snapshots[index - 1]);
        bytes[10000 + index * 17000] ^= 1;
        snapshots.push(bytes);
        const patch = createDelta(snapshots[index - 1], bytes);
        patchTotal += patch.length;
        const sha = index === steps ? latestSha : index.toString(16).repeat(40);
        const metadata = release(`1.2.${2 + index}`, bytes, `1.2.${1 + index}`, snapshots[index - 1], patch);
        value.releases.set(sha, metadata);
        if (index === steps) {
          value.latest = metadata;
          value.fullBytes = bytes;
        } else value.history.unshift({ sha });
      }
      assert.equal(value.history.length, steps - 1);
    } });
    const available = await context.updater.check();
    if (steps === 8) {
      assert.equal(available.downloadKind, 'delta');
      assert.equal(available.deltaSteps, 8);
      assert.equal(available.total, patchTotal);
      await assertReady(context, 'delta', null, snapshots[steps], 8, patchTotal);
      assert.equal(patchRequests(context).length, 8);
      assert.equal(context.bodyBytes.historical + context.bodyBytes.latest, patchTotal);
      assert.equal(context.bodyBytes.full, 0);
    } else {
      assert.equal(available.downloadKind, 'full');
      assert.equal(available.deltaReason, 'no-patch-path');
      await assertReady(context, 'full', 'no-patch-path', snapshots[steps]);
      assert.equal(patchRequests(context).length, 0);
      assert.equal(context.bodyBytes.full, snapshots[steps].length);
    }
  });
}

test('no installed base reports base-unavailable and skips delta metadata and history', async t => {
  const context = await fixture(t, { noBase: true });
  await assertFullWithoutPatch(context, 'base-unavailable');
  assert.equal(requests(context, latestSha, 'feed/delta.json').length, 0);
  assert.equal(context.calls.some(call => call.url === historyUrl), false);
});

test('a direct patch whose base tuple mismatches reports base-mismatch without discovering history', async t => {
  const context = await fixture(t, { configure: value => {
    value.latest.delta = sign({ ...value.latest.delta, patches: [patchMetadata('1.2.2', intermediate, lastPatch)] });
  } });
  await assertFullWithoutPatch(context, 'base-mismatch');
  assert.equal(context.calls.some(call => call.url === historyUrl), false);
});

test('changing the installed base after chain selection falls back before fetching either patch', async t => {
  const context = await fixture(t);
  assert.equal((await context.updater.check()).deltaSteps, 2);
  const changed = Buffer.from(base);
  changed[99] ^= 1;
  await fs.writeFile(context.installedArchive, changed);
  context.installedBytes = changed;
  await assertReady(context, 'full', 'patch-failed');
  assert.equal(patchRequests(context).length, 0);
});
