'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
// Both services are compiled directly from current source. Never load stale build/app output.
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
const service = loadSource('src/main/clist/service.cts');
const { createClistSharedCache } = loadSource('src/main/clist/shared-cache.cts', { './clist-service.cjs': service });
const LG = 'https://www.luogu.com.cn/problem/P1001';
const CF = 'https://codeforces.com/problemset/problem/1900/D';
const NC = 'https://ac.nowcoder.com/acm/problem/12345';
const NOW = Date.parse('2026-01-04T00:00:00.000Z');
const OLD = '2025-01-01T00:00:00.000Z';
const NEW = '2026-01-01T00:00:00.000Z';
const row = (rating = 1700, queriedAt = NEW, resource = 'luogu.com.cn') => ({ rating, resource, queriedAt });
const raw = ratings => ({ schema: 1, ratings });
const shared = ratings => ({ schema: 1, kind: 'qmx-clist-rating-cache', exportedAt: NEW, ratings });
function fixture(t, opts = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-shared-clist-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cacheFile = path.join(directory, 'clist-rating-cache.json');
  const sourceFile = path.join(directory, 'clist-shared-source.json');
  const create = overrides => createClistSharedCache({ directory, fs, path, now: () => NOW, ...opts, ...overrides });
  const write = (file, value) => fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
  const input = value => { const file = path.join(directory, 'incoming.json'); write(file, value); return file; };
  return { directory, cacheFile, sourceFile, create, write, read, input };
}

test('exports isolated positive ratings and merges baseline across users without personal roots', t => {
  const a = fixture(t);
  const b = fixture(t);
  a.write(a.cacheFile, { ...raw({ [LG]: row(), [CF]: row(2200, OLD, 'codeforces.com'), [NC]: row(0, NEW, 'ac.nowcoder.com') }), username: 'private-a', key: 'private-key', ledger: ['private'], supplements: { note: 'private' }, metadata: { owner: 'private' } });
  const original = fs.readFileSync(a.cacheFile, 'utf8');
  const exported = path.join(a.directory, 'shared.json');
  assert.equal(a.create().exportFile(exported).total, 2);
  assert.equal(fs.readFileSync(a.cacheFile, 'utf8'), original);
  assert.deepEqual(Object.keys(a.read(exported)).sort(), ['exportedAt', 'kind', 'ratings', 'schema']);
  assert.equal(fs.readFileSync(exported, 'utf8').includes('private'), false);
  b.write(b.cacheFile, { ...raw({ [NC]: row(1800, NEW, 'ac.nowcoder.com') }), username: 'private-b', key: 'local-key', unknown: { unchanged: true } });
  const result = b.create().importFile(exported);
  assert.deepEqual({ ...result, status: undefined }, { canceled: false, imported: 2, updated: 0, kept: 0, ignored: 0, status: undefined });
  assert.equal(result.status.total, 3);
  const merged = b.read(b.cacheFile);
  assert.equal(merged.username, 'private-b');
  assert.equal(merged.key, 'local-key');
  assert.deepEqual(merged.unknown, { unchanged: true });
  assert.equal(merged.ledger, undefined);
  assert.equal(service.createClistRatingCacheReader(merged)('https://www.codeforces.com/contest/1900/problem/d/?locale=en').rating, 2200);
  assert.equal(service.createClistRatingCacheReader(merged)('https://luogu.com.cn/problem/P1001/').rating, 1700);
});

test('importDocument merges detached public documents with file import semantics and no input IO', t => {
  const f = fixture(t);
  f.write(f.cacheFile, { ...raw({ [LG]: row(1000, OLD), [NC]: row(0, OLD, 'ac.nowcoder.com') }), private: { keep: true } });
  const document = shared({ [LG]: row(1800), [CF]: row(2200, NEW, 'codeforces.com') });
  const result = f.create().importDocument(document);
  assert.equal(result.updated, 1);
  assert.equal(result.imported, 1);
  document.ratings[LG].rating = 9999;
  delete document.ratings[CF];
  const saved = f.read(f.cacheFile);
  assert.equal(saved.ratings[LG].rating, 1800);
  assert.equal(saved.ratings[CF].rating, 2200);
  assert.equal(saved.ratings[NC].rating, 0);
  assert.deepEqual(saved.private, { keep: true });
  assert.equal(fs.existsSync(path.join(f.directory, 'incoming.json')), false);
  assert.equal(fs.existsSync(path.join(f.directory, 'clist-initial-cache-state.json')), false);
  assert.equal(f.create().importDocument(raw({ [LG]: row(0) })).ignored, 1);
});

test('importDocument rejects nonpublic roots, malformed rows, cyclic objects and oversized inputs safely', t => {
  const f = fixture(t);
  f.write(f.cacheFile, raw({ [LG]: row() }));
  const before = fs.readFileSync(f.cacheFile, 'utf8');
  const cyclic = raw({});
  cyclic.ratings.self = cyclic;
  for (const value of [undefined, null, [], { ...raw({}), key: 'private-value' }, raw({ [LG]: row(-1) }), raw({ [LG]: { ...row(), secret: 'private-value' } }), raw({ [LG]: { ...row(), secret: undefined } }), cyclic]) {
    assert.throws(() => f.create().importDocument(value), error => /CLIST/.test(error.message) && !error.message.includes('private-value'));
    assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
  }
  assert.throws(() => f.create().importDocument({ ...raw({}), exportedAt: 'x'.repeat(20 * 1024 * 1024) }), /20 MB/);
  const ratings = {};
  for (let index = 1; index <= 150001; index += 1) ratings[`https://loj.ac/p/${index}`] = row(1, OLD, 'loj.ac');
  assert.throws(() => f.create().importDocument(raw(ratings)), /150000/);
  assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
});

test('timestamp merge updates newer, preserves older and equal conflicts, and ignores zero rows', t => {
  const f = fixture(t);
  f.write(f.cacheFile, raw({ [LG]: row(1500, OLD), [CF]: row(2400, NEW, 'codeforces.com'), [NC]: row(1900, NEW, 'ac.nowcoder.com') }));
  const file = f.input(shared({ [LG]: row(1700, NEW), [CF]: row(2000, OLD, 'codeforces.com'), [NC]: row(2001, NEW, 'ac.nowcoder.com'), 'https://loj.ac/p/1000': row(0, NEW, 'loj.ac') }));
  const result = f.create().importFile(file);
  assert.equal(result.updated, 1);
  assert.equal(result.kept, 2);
  assert.equal(result.ignored, 1);
  assert.equal(result.imported, 0);
  assert.equal(result.status.total, 3);
  assert.equal(f.read(f.cacheFile).ratings[NC].rating, 1900);
  assert.equal(f.read(f.cacheFile).ratings[CF].rating, 2400);
  assert.equal(f.read(f.cacheFile + '.bak').ratings[LG].rating, 1500);
  assert.deepEqual(Object.keys(result.status.platforms).sort(), ['ac.nowcoder.com', 'codeforces.com', 'luogu.com.cn']);
  assert.equal(result.status.oldestQuery, NEW);
  assert.equal(result.status.newestQuery, NEW);
});

test('empty and zero-only imports succeed without pretending zeros are scores', t => {
  const f = fixture(t);
  const empty = f.create().importFile(f.input(raw({})));
  assert.equal(empty.status.total, 0);
  const zero = f.create().importFile(f.input(raw({ [LG]: row(0) })));
  assert.equal(zero.ignored, 1);
  assert.equal(zero.status.total, 0);
  const exported = path.join(f.directory, 'empty.json');
  f.create().exportFile(exported);
  assert.deepEqual(f.read(exported).ratings, {});
});

test('rejects every malformed row before writing any good row, with safe errors', t => {
  const f = fixture(t);
  f.write(f.cacheFile, { ...raw({ [LG]: row(1400) }), personal: 'keep' });
  const before = fs.readFileSync(f.cacheFile, 'utf8');
  const invalidRows = [
    [CF, row(-2, NEW, 'codeforces.com')], [CF, row(null, NEW, 'codeforces.com')],
    [CF, row(2000, NEW, 'luogu.com.cn')], [CF, { ...row(2000, NEW, 'codeforces.com'), raw: { secret: 'do-not-leak' } }],
    [CF, { ...row(2000, NEW, 'codeforces.com'), apiKey: 'do-not-leak' }],
    [CF, row(2000, '2026-01-01', 'codeforces.com')], [CF, row(2000, '2026-01-04T00:05:00.001Z', 'codeforces.com')],
    ['https://codeforces.com/contest/1900/problem/D', row(2000, NEW, 'codeforces.com')],
    ['https://www.codeforces.com/problemset/problem/1900/D', row(2000, NEW, 'codeforces.com')],
    ['https://codeforces.com/problemset/problem/1900/D?api_key=do-not-leak', row(2000, NEW, 'codeforces.com')],
    ['https://evil.example/problem/P1', row()], ['https://www.luogu.com.cn/contest/1', row()],
    ['http://www.luogu.com.cn/problem/P1', row()], ['https://user:do-not-leak@www.luogu.com.cn/problem/P1', row()]
  ];
  for (const [url, value] of invalidRows) {
    assert.throws(() => f.create().importFile(f.input(shared({ [LG]: row(2500, '2026-01-02T00:00:00.000Z'), [url]: value }))), error => {
      assert.equal(error.message.includes('do-not-leak'), false);
      return /CLIST/.test(error.message);
    });
    assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
    assert.equal(fs.existsSync(f.cacheFile + '.bak'), false);
  }
  // JSON's finite-number boundary must reject the 1e400 representation too.
  assert.throws(() => f.create().importFile(f.input(JSON.stringify(raw({ [LG]: row() })).replace('1700', '1e400'))));
  assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
});

test('accepts the exact five-minute future boundary and canonical diverse platform identities', t => {
  const f = fixture(t);
  const future = new Date(NOW + 300_000).toISOString();
  const ratings = {
    [CF]: row(2100, future, 'codeforces.com'),
    'https://atcoder.jp/contests/DEGwer2023/tasks/1202Contest_a': row(1800, NEW, 'atcoder.jp'),
    'https://leetcode.com/problems/two-sum/': row(1200, OLD, 'leetcode.com'),
    'https://loj.ac/p/1000': row(1600, NEW, 'loj.ac'),
    'https://ac.nowcoder.com/acm/contest/12345/A': row(1900, NEW, 'ac.nowcoder.com'),
    [LG]: row()
  };
  const result = f.create().importFile(f.input(raw(ratings)));
  assert.equal(result.imported, 6);
  assert.equal(result.status.oldestQuery, OLD);
  assert.equal(result.status.newestQuery, future);
  assert.equal(service.createClistRatingCacheReader(f.read(f.cacheFile))('https://leetcode.cn/problems/two-sum/').rating, 1200);
});

test('rejects public difficulty JSON, NDJSON, malformed schema and future export dates clearly', t => {
  const f = fixture(t);
  for (const value of [[], [{ url: LG, difficulty: 4 }], { schema: 1, entries: [] }, { schema: 1, kind: 'public-difficulty', ratings: {} }, { schema: 2, ratings: {} }, '{broken', '{"url":"one"}\n{"url":"two"}', { ...shared({}), exportedAt: '2026-01-05T00:00:00.000Z' }]) {
    assert.throws(() => f.create().importFile(f.input(value)), /CLIST/);
    assert.equal(fs.existsSync(f.cacheFile), false);
  }
});

test('bad local cache remains byte-for-byte untouched during status, import and export', t => {
  const f = fixture(t);
  f.write(f.cacheFile, { ...raw({ [LG]: { ...row(), raw: 'private-value' } }), secret: 'private-root' });
  const before = fs.readFileSync(f.cacheFile, 'utf8');
  const service = f.create();
  assert.throws(() => service.status(), /CLIST/);
  assert.throws(() => service.importFile(f.input(raw({ [CF]: row(2400, NEW, 'codeforces.com') }))), /CLIST/);
  const output = path.join(f.directory, 'output.json');
  assert.throws(() => service.exportFile(output), /CLIST/);
  assert.equal(fs.existsSync(output), false);
  assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
});

test('rejects exports overwriting local cache, source config or a hard-link alias', t => {
  const f = fixture(t);
  f.write(f.cacheFile, raw({ [LG]: row() }));
  f.write(f.sourceFile, { url: 'https://example.test/cache.json', lastSyncedAt: NEW });
  assert.throws(() => f.create().exportFile(f.cacheFile), /覆盖/);
  assert.throws(() => f.create().exportFile(f.sourceFile), /覆盖/);
  const alias = path.join(f.directory, 'alias.json');
  fs.linkSync(f.cacheFile, alias);
  assert.throws(() => f.create().exportFile(alias), /覆盖/);
});

test('export refuses credential and profile targets before any write, including aliases and other directories', t => {
  const f = fixture(t);
  f.write(f.cacheFile, raw({ [LG]: row() }));
  const service = f.create();
  for (const name of ['clist-auth.json', 'auth.json', 'ai-auth.json', 'local.json', 'settings.json', 'userprofiles.json', 'profiles.json', 'clist-rating-cache.json.bak']) {
    const file = path.join(f.directory, name);
    f.write(file, 'personal-data-must-survive');
    assert.throws(() => service.exportFile(file), /不能覆盖/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'personal-data-must-survive');
  }
  const alias = path.join(f.directory, 'harmless.json');
  fs.linkSync(path.join(f.directory, 'clist-auth.json'), alias);
  assert.throws(() => service.exportFile(alias), /不能覆盖/);
  assert.equal(fs.readFileSync(alias, 'utf8'), 'personal-data-must-survive');
  for (const folder of ['userprofiles', 'user-profiles', 'profiles', 'library', 'updates']) {
    const file = path.join(f.directory, folder, 'existing.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    f.write(file, 'personal-data-must-survive');
    assert.throws(() => service.exportFile(file), /不能覆盖/);
    assert.equal(fs.readFileSync(file, 'utf8'), 'personal-data-must-survive');
  }
  const other = fixture(t);
  const elsewhere = path.join(other.directory, 'clist-auth.json');
  assert.throws(() => service.exportFile(elsewhere), /不能覆盖/);
  assert.equal(fs.existsSync(elsewhere), false);
});

test('staging and final rename failures preserve original cache and clean temporary files', t => {
  for (const phase of ['write', 'rename']) {
    const f = fixture(t);
    f.write(f.cacheFile, raw({ [LG]: row(1000, OLD) }));
    const before = fs.readFileSync(f.cacheFile, 'utf8');
    const injected = { ...fs,
      writeFileSync(file, ...args) { if (phase === 'write' && String(file).endsWith('.tmp')) { fs.writeFileSync(file, 'partial'); throw new Error('disk failure body=private'); } return fs.writeFileSync(file, ...args); },
      renameSync(from, to) { if (phase === 'rename' && to === f.cacheFile) throw new Error('rename failure private'); return fs.renameSync(from, to); }
    };
    assert.throws(() => f.create({ fs: injected }).importFile(f.input(raw({ [LG]: row(2000, NEW) }))), /CLIST/);
    assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), before);
    assert.equal(fs.readdirSync(f.directory).some(file => file.endsWith('.tmp')), false);
  }
});

test('rechecks exact local version after staging to preserve concurrent writer data', t => {
  const f = fixture(t);
  f.write(f.cacheFile, raw({ [LG]: row(1000, OLD) }));
  const changed = { ...raw({ [LG]: row(3000, NEW) }), intervening: 'keep' };
  let written = false;
  const injected = { ...fs, writeFileSync(file, ...args) {
    const result = fs.writeFileSync(file, ...args);
    if (!written && String(file).includes('clist-rating-cache.json.qmx-')) { written = true; f.write(f.cacheFile, changed); }
    return result;
  } };
  assert.throws(() => f.create({ fs: injected }).importFile(f.input(raw({ [LG]: row(2000, NEW) }))), /已变化/);
  assert.deepEqual(f.read(f.cacheFile), changed);
});

test('keeps exactly one backup containing the immediately previous local version', t => {
  const f = fixture(t);
  f.write(f.cacheFile, raw({ [LG]: row(1000, OLD) }));
  const service = f.create();
  service.importFile(f.input(raw({ [LG]: row(1500, NEW) })));
  service.importFile(f.input(raw({ [LG]: row(2000, '2026-01-02T00:00:00.000Z') })));
  assert.equal(f.read(f.cacheFile + '.bak').ratings[LG].rating, 1500);
  assert.deepEqual(fs.readdirSync(f.directory).filter(file => file.includes('.bak')), ['clist-rating-cache.json.bak']);
});

test('anonymous explicit HTTPS sync preserves public query parameters and persists successful source only', async t => {
  const f = fixture(t);
  const calls = [];
  const url = 'https://public.example/cache.json?version=2&download=1';
  const incoming = { ...shared({ [LG]: row() }), username: 'remote-private', key: 'remote-secret', ledger: ['not-imported'] };
  const service = f.create({ fetcher: async (input, init) => { calls.push({ input: String(input), init }); return new Response(JSON.stringify(incoming), { headers: { 'content-type': 'application/json' } }); } });
  assert.equal(calls.length, 0, 'construction and status do not sync automatically');
  assert.equal(service.status().sourceUrl, null);
  const result = await service.syncFromUrl(url);
  assert.equal(result.imported, 1);
  assert.equal(result.status.sourceUrl, url);
  assert.equal(result.status.lastSyncedAt, new Date(NOW).toISOString());
  assert.equal(calls.length, 1, 'problem row URLs must never be fetched');
  assert.equal(calls[0].input, url);
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.credentials, 'omit');
  assert.deepEqual(calls[0].init.headers, { accept: 'application/json' });
  assert.equal(calls[0].init.signal instanceof AbortSignal, true);
  assert.deepEqual(f.read(f.sourceFile), { url, lastSyncedAt: new Date(NOW).toISOString() });
  assert.deepEqual(Object.keys(f.read(f.cacheFile)).sort(), ['ratings', 'schema']);
  assert.equal(f.create().status().sourceUrl, url);
});

test('rejects unsafe or credential source URLs before any network operation', async t => {
  const f = fixture(t);
  let calls = 0;
  const service = f.create({ fetcher: async () => { calls += 1; throw new Error('must not fetch'); } });
  for (const url of ['http://example.test/cache.json', 'https://user:pass@example.test/cache.json', 'https://example.test:444/cache.json', 'https://example.test/cache.json#x', 'https://example.test/cache.json#', 'https://example.test/cache.json?api_key=x', 'https://example.test/cache.json?token=x', 'https://example.test/cache.json?appid=x', 'https://example.test/cache.json?X-Amz-Signature=x', 'https://example.test/cache.json?username=x', 'file:///cache.json', ' https://example.test/cache.json']) {
    await assert.rejects(service.syncFromUrl(url), /HTTPS|账号|密钥/);
  }
  assert.equal(calls, 0);
  assert.equal(fs.existsSync(f.sourceFile), false);
});

test('allows HTTPS default port 443 and records zero-only sync without creating scores', async t => {
  const f = fixture(t);
  let requested;
  const service = f.create({ fetcher: async input => { requested = String(input); return new Response(JSON.stringify(raw({ [LG]: row(0) }))); } });
  const result = await service.syncFromUrl('https://example.test:443/cache.json?raw=1');
  assert.equal(requested, 'https://example.test/cache.json?raw=1');
  assert.equal(result.ignored, 1);
  assert.equal(result.status.total, 0);
  assert.equal(result.status.sourceUrl, requested);
});

test('remote errors, redirects, invalid documents and future rows do not mutate cache or source', async t => {
  const f = fixture(t);
  f.write(f.cacheFile, raw({ [LG]: row(1000, OLD) }));
  f.write(f.sourceFile, { url: 'https://old.example/cache.json', lastSyncedAt: OLD });
  const beforeCache = fs.readFileSync(f.cacheFile, 'utf8');
  const beforeSource = fs.readFileSync(f.sourceFile, 'utf8');
  for (const fetcher of [
    async () => { throw new Error('sensitive-body api_key=secret'); },
    async () => new Response('sensitive-body', { status: 403 }),
    async () => new Response('sensitive-body', { status: 302, headers: { location: 'https://elsewhere.example/secret' } }),
    async () => { const response = new Response(JSON.stringify(shared({ [LG]: row() }))); Object.defineProperty(response, 'redirected', { value: true }); return response; },
    async () => { const response = new Response(JSON.stringify(shared({ [LG]: row() }))); Object.defineProperty(response, 'url', { value: 'https://elsewhere.example/cache.json' }); return response; },
    async () => new Response('sensitive-body'),
    async () => new Response(JSON.stringify(shared({ [LG]: row(2000, '2099-01-01T00:00:00.000Z') }))),
    async () => new Response(JSON.stringify(shared({ 'https://evil.example/cache.json': row(2000) })))
  ]) {
    await assert.rejects(f.create({ fetcher }).syncFromUrl('https://example.test/new.json'), error => !error.message.includes('sensitive-body') && !error.message.includes('secret'));
    assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), beforeCache);
    assert.equal(fs.readFileSync(f.sourceFile, 'utf8'), beforeSource);
  }
});

test('failed source commit rolls back merged cache and preserves previous source metadata', async t => {
  const f = fixture(t);
  f.write(f.cacheFile, { ...raw({ [LG]: row(1000, OLD) }), personal: { keep: true } });
  f.write(f.sourceFile, { url: 'https://old.example/cache.json', lastSyncedAt: OLD });
  const beforeCache = fs.readFileSync(f.cacheFile, 'utf8');
  const beforeSource = fs.readFileSync(f.sourceFile, 'utf8');
  const injected = { ...fs, renameSync(from, to) { if (to === f.sourceFile) throw new Error('source config cannot save'); return fs.renameSync(from, to); } };
  const service = f.create({ fs: injected, fetcher: async () => new Response(JSON.stringify(shared({ [LG]: row(2000, NEW) }))) });
  await assert.rejects(service.syncFromUrl('https://new.example/cache.json'), /CLIST/);
  assert.equal(fs.readFileSync(f.cacheFile, 'utf8'), beforeCache);
  assert.equal(fs.readFileSync(f.sourceFile, 'utf8'), beforeSource);
  assert.equal(fs.readdirSync(f.directory).some(file => file.endsWith('.tmp')), false);
});

test('preserves local historical zero entries while importing positives and excludes them from status', t => {
  const f = fixture(t);
  f.write(f.cacheFile, { ...raw({ [LG]: row(0, OLD) }), personal: { keep: true } });
  const result = f.create().importFile(f.input(raw({ [CF]: row(2000, NEW, 'codeforces.com') })));
  assert.equal(result.status.total, 1);
  assert.deepEqual(f.read(f.cacheFile).ratings[LG], row(0, OLD));
  assert.equal(service.createClistRatingCacheReader(f.read(f.cacheFile))(LG).noData, true);
});

test('legacy cache snapshot remains reusable after long time without TTL score loss', t => {
  const f = fixture(t);
  f.write(f.cacheFile, raw({ [LG]: row(1000, OLD) }));
  const service = f.create({ now: () => Date.parse('2036-01-01T00:00:00.000Z') });
  assert.equal(service.status().total, 1);
  assert.equal(service.status().oldestQuery, OLD);
  assert.equal(service.importFile(f.input(raw({ [LG]: row(1100, NEW) }))).updated, 1);
});

test('enforces local 20 MB limit and entry cap before writes', t => {
  const f = fixture(t);
  const file = f.input(' '.repeat(20 * 1024 * 1024 + 1));
  assert.throws(() => f.create().importFile(file), /20 MB/);
  const ratings = {};
  for (let index = 1; index <= 150001; index += 1) ratings[`https://loj.ac/p/${index}`] = row(1, OLD, 'loj.ac');
  assert.throws(() => f.create().importFile(f.input(raw(ratings))), /150000/);
  assert.equal(fs.existsSync(f.cacheFile), false);
});

test('bounds streaming responses even without content-length and rejects oversized declared length', async t => {
  const f = fixture(t);
  let pulls = 0;
  let canceled = false;
  const stream = new ReadableStream({ pull(controller) { pulls += 1; controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { canceled = true; } });
  await assert.rejects(f.create({ fetcher: async () => new Response(stream) }).syncFromUrl('https://example.test/cache.json'), /20 MB/);
  assert.equal(canceled, true);
  assert.ok(pulls <= 23);
  await assert.rejects(f.create({ fetcher: async () => new Response('{}', { headers: { 'content-length': String(20 * 1024 * 1024 + 1) } }) }).syncFromUrl('https://example.test/cache.json'), /20 MB/);
  assert.equal(fs.existsSync(f.cacheFile), false);
  assert.equal(fs.existsSync(f.sourceFile), false);
});

test('thirty-second deadline covers streaming and safe rejection without persisted source', async t => {
  const f = fixture(t);
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let captured;
  let canceled = false;
  global.setTimeout = (callback, delay) => { assert.equal(delay, 30000); captured = callback; return { mock: true }; };
  global.clearTimeout = () => {};
  try {
    const service = f.create({ fetcher: async () => new Response(new ReadableStream({ start() {}, cancel() { canceled = true; } })) });
    const result = service.syncFromUrl('https://example.test/cache.json');
    await Promise.resolve();
    captured();
    await assert.rejects(result, /超时/);
    assert.equal(fs.existsSync(f.sourceFile), false);
  } finally { global.setTimeout = originalSetTimeout; global.clearTimeout = originalClearTimeout; }
  assert.equal(canceled, true);
});
