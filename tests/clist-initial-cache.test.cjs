'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');
function loadSource(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = name => Object.hasOwn(dependencies, name) ? dependencies[name] : module.require(name);
  loaded._compile(compiled.outputText, filename);
  return loaded.exports;
}
const ratingService = loadSource('src/main/clist/service.cts');
const { createClistSharedCache } = loadSource('src/main/clist/shared-cache.cts', { './clist-service.cjs': ratingService });
const LG = 'https://www.luogu.com.cn/problem/P1001';
const CF = 'https://codeforces.com/problemset/problem/1900/D';
const OLD = '2025-01-01T00:00:00.000Z';
const NEW = '2026-01-01T00:00:00.000Z';
const NOW = Date.parse('2026-01-04T00:00:00.000Z');
const row = (rating = 1700, queriedAt = NEW, resource = 'luogu.com.cn') => ({ rating, queriedAt, resource });
const raw = ratings => ({ schema: 1, ratings });
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-initial-clist-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cacheFile = path.join(directory, 'clist-rating-cache.json');
  const stateFile = path.join(directory, 'clist-initial-cache-state.json');
  const initialCacheFile = path.join(directory, 'bundled.json');
  const write = (file, value) => fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const create = (options = {}) => createClistSharedCache({ directory, fs, path, initialCacheFile, now: () => NOW, ...options });
  return { directory, cacheFile, stateFile, initialCacheFile, write, read, create };
}

test('explicit initial source seeds an empty local cache and records content hash with public metadata', t => {
  const f = fixture(t);
  f.write(f.initialCacheFile, raw({ [LG]: row(), [CF]: row(2200, OLD, 'codeforces.com') }));
  const service = f.create();
  assert.equal(fs.existsSync(f.cacheFile), false, 'construction is side-effect free');
  const status = service.ensureInitial();
  assert.equal(status.total, 2);
  assert.equal(status.initialTotal, 2);
  assert.equal(status.initialAppliedAt, new Date(NOW).toISOString());
  assert.deepEqual(f.read(f.stateFile), { schema: 1, sha256: crypto.createHash('sha256').update(fs.readFileSync(f.initialCacheFile)).digest('hex'), appliedAt: new Date(NOW).toISOString() });
  assert.deepEqual(Object.keys(f.read(f.cacheFile)).sort(), ['ratings', 'schema']);
  assert.equal(ratingService.createClistRatingCacheReader(f.read(f.cacheFile))(LG).rating, 1700);
  const exported = path.join(f.directory, 'public.json');
  service.exportFile(exported);
  assert.deepEqual(Object.keys(f.read(exported)).sort(), ['exportedAt', 'kind', 'ratings', 'schema']);
  assert.equal(fs.readFileSync(exported, 'utf8').includes('sha256'), false);
  assert.throws(() => service.exportFile(f.stateFile), /不能覆盖/);
});

test('unset option and absent source leave an existing local document and filesystem unchanged', t => {
  const f = fixture(t);
  f.write(f.cacheFile, { ...raw({ [LG]: row() }), personal: { keep: true } });
  const before = fs.readFileSync(f.cacheFile, 'utf8');
  for (const options of [{ initialCacheFile: undefined }, {}]) {
    const status = f.create(options).ensureInitial();
    assert.equal(status.total, 1);
    assert.equal(status.initialTotal, undefined);
    assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
    assert.equal(fs.existsSync(f.stateFile), false);
  }
  f.write(f.initialCacheFile, raw({ [CF]: row(2000, NEW, 'codeforces.com') }));
  assert.equal(f.create({ initialCacheFile: undefined }).ensureInitial().total, 1);
  assert.equal(fs.existsSync(f.stateFile), false);
});

test('initial merge preserves newest and equal local scores, root fields and historical zero rows', t => {
  const f = fixture(t);
  f.write(f.cacheFile, { ...raw({ [LG]: row(2400, NEW), [CF]: row(0, OLD, 'codeforces.com') }), personal: { keep: true } });
  f.write(f.initialCacheFile, raw({ [LG]: row(1700, OLD), 'https://loj.ac/p/1000': row(2000, NEW, 'loj.ac') }));
  assert.equal(f.create().ensureInitial().total, 2);
  assert.equal(f.read(f.cacheFile).ratings[LG].rating, 2400);
  assert.equal(f.read(f.cacheFile).ratings[CF].rating, 0);
  assert.deepEqual(f.read(f.cacheFile).personal, { keep: true });
  f.write(f.initialCacheFile, raw({ [LG]: row(1800, NEW) }));
  f.create().ensureInitial();
  assert.equal(f.read(f.cacheFile).ratings[LG].rating, 2400);
});

test('matching hash and positive local cache skip writes across service instances', t => {
  const f = fixture(t);
  f.write(f.initialCacheFile, raw({ [LG]: row() }));
  f.create().ensureInitial();
  const state = fs.readFileSync(f.stateFile, 'utf8');
  const cache = fs.readFileSync(f.cacheFile, 'utf8');
  const injected = { ...fs, writeFileSync() { assert.fail('matching source must not stage writes'); } };
  const status = f.create({ fs: injected }).ensureInitial();
  assert.equal(status.initialTotal, 1);
  assert.equal(fs.readFileSync(f.stateFile, 'utf8'), state);
  assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), cache);
});

test('changed seed content reapplies despite identical size and restored mtime', t => {
  const f = fixture(t);
  f.write(f.initialCacheFile, raw({ [LG]: row(1700, OLD) }));
  const service = f.create();
  service.ensureInitial();
  const oldHash = f.read(f.stateFile).sha256;
  const stat = fs.statSync(f.initialCacheFile);
  f.write(f.initialCacheFile, raw({ [LG]: row(1900, NEW) }));
  assert.equal(fs.statSync(f.initialCacheFile).size, stat.size);
  fs.utimesSync(f.initialCacheFile, stat.atime, stat.mtime);
  service.ensureInitial();
  assert.notEqual(f.read(f.stateFile).sha256, oldHash);
  assert.equal(f.read(f.cacheFile).ratings[LG].rating, 1900);
});

test('missing marker, missing cache, empty cache and zero-only cache recover from valid initial source', t => {
  for (const recovery of ['marker', 'cache', 'empty', 'zero', 'malformed-marker']) {
    const f = fixture(t);
    f.write(f.initialCacheFile, raw({ [LG]: row() }));
    f.create().ensureInitial();
    if (recovery === 'marker') fs.unlinkSync(f.stateFile);
    else if (recovery === 'cache') fs.unlinkSync(f.cacheFile);
    else if (recovery === 'empty') f.write(f.cacheFile, raw({}));
    else if (recovery === 'zero') f.write(f.cacheFile, raw({ [LG]: row(0) }));
    else f.write(f.stateFile, '{broken');
    assert.equal(f.create().ensureInitial().total, 1, recovery);
    assert.equal(f.read(f.stateFile).schema, 1);
    assert.equal(f.read(f.cacheFile).ratings[LG].rating, 1700);
  }
});

test('matching marker cannot mask broken local data and must not overwrite it', t => {
  const f = fixture(t);
  f.write(f.initialCacheFile, raw({ [LG]: row() }));
  f.create().ensureInitial();
  const state = fs.readFileSync(f.stateFile, 'utf8');
  for (const value of ['{broken', raw({ [LG]: row(-1) }), raw({ [LG]: { ...row(), secret: 'private' } })]) {
    f.write(f.cacheFile, value);
    const before = fs.readFileSync(f.cacheFile, 'utf8');
    assert.throws(() => f.create().ensureInitial(), /CLIST/);
    assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
    assert.equal(fs.readFileSync(f.stateFile, 'utf8'), state);
  }
});

test('rejects malformed, zero-only, mixed-zero and private initial documents without changing local files', t => {
  const f = fixture(t);
  f.write(f.cacheFile, { ...raw({ [LG]: row(2500) }), local: 'preserve' });
  const before = fs.readFileSync(f.cacheFile, 'utf8');
  for (const value of ['{broken', raw({}), raw({ [LG]: row(0) }), raw({ [LG]: row(), [CF]: row(0, NEW, 'codeforces.com') }), raw({ [LG]: row(-1) }), { ...raw({ [LG]: row() }), key: 'private-credential' }, { schema: 2, ratings: {} }, { schema: 1, kind: 'public-difficulty', ratings: {} }]) {
    f.write(f.initialCacheFile, value);
    assert.throws(() => f.create().ensureInitial(), error => /CLIST/.test(error.message) && !error.message.includes('private-credential'));
    assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
    assert.equal(fs.existsSync(f.stateFile), false);
  }
});

test('source is read again and hashed even with a matching marker and same service instance', t => {
  const f = fixture(t);
  f.write(f.initialCacheFile, raw({ [LG]: row() }));
  const service = f.create();
  service.ensureInitial();
  const before = fs.readFileSync(f.cacheFile, 'utf8');
  f.write(f.initialCacheFile, '{broken');
  assert.throws(() => service.ensureInitial(), /CLIST/);
  assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
});

test('oversized initial snapshots and entry limits reject before local writes', t => {
  const f = fixture(t);
  f.write(f.initialCacheFile, ' '.repeat(20 * 1024 * 1024 + 1));
  assert.throws(() => f.create().ensureInitial(), /20 MB/);
  const ratings = {};
  for (let index = 1; index <= 150001; index += 1) ratings[`https://loj.ac/p/${index}`] = row(1, OLD, 'loj.ac');
  f.write(f.initialCacheFile, raw(ratings));
  assert.throws(() => f.create().ensureInitial(), /150000/);
  assert.equal(fs.existsSync(f.cacheFile), false);
  assert.equal(fs.existsSync(f.stateFile), false);
});

test('failed marker commit rolls back initial cache and preserves original local bytes', t => {
  const f = fixture(t);
  f.write(f.initialCacheFile, raw({ [LG]: row() }));
  f.write(f.cacheFile, { ...raw({ [LG]: row(1000, OLD) }), personal: 'keep' });
  const before = fs.readFileSync(f.cacheFile, 'utf8');
  const injected = { ...fs, renameSync(from, to) { if (to === f.stateFile) throw new Error('private failure'); return fs.renameSync(from, to); } };
  assert.throws(() => f.create({ fs: injected }).ensureInitial(), error => /CLIST/.test(error.message) && !error.message.includes('private failure'));
  assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
  assert.equal(fs.existsSync(f.stateFile), false);
  assert.equal(fs.readdirSync(f.directory).some(file => file.endsWith('.tmp')), false);
});

test('rechecks local snapshot before applying initial seed during a concurrent write', t => {
  const f = fixture(t);
  f.write(f.initialCacheFile, raw({ [LG]: row() }));
  f.write(f.cacheFile, raw({ [LG]: row(1000, OLD) }));
  const changed = { ...raw({ [LG]: row(3000, NEW) }), intervening: true };
  let written = false;
  const injected = { ...fs, writeFileSync(file, ...args) {
    const result = fs.writeFileSync(file, ...args);
    if (!written && String(file).includes('clist-rating-cache.json.qmx-')) { written = true; f.write(f.cacheFile, changed); }
    return result;
  } };
  assert.throws(() => f.create({ fs: injected }).ensureInitial(), /已变化/);
  assert.deepEqual(f.read(f.cacheFile), changed);
  assert.equal(fs.existsSync(f.stateFile), false);
});
