'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { appPath } = require('./app-path.cjs');

const source = fs.readFileSync(appPath('ui/local-records.js'), 'utf8');

// Frozen copy of ui/app.js lines 67–68 before extraction. Keep this independent
// of the implementation so refactors continue to check the original behavior.
const legacySource = `
  const migratedClientIds = new Map();
  function normalizeLocal(local) { return { records: (Array.isArray(local?.records) ? local.records : []).filter(record => record?.kind === 'local').map(record => { const legacyKey = record.id == null ? null : String(record.id); const clientId = record.clientId || (legacyKey && migratedClientIds.get(legacyKey)) || uuid(); if (legacyKey) migratedClientIds.set(legacyKey, clientId); return { ...record, clientId, id: record.id ?? \`local:\${clientId}\`, ownerId: record.ownerId == null ? null : String(record.ownerId) }; }), favorites: Array.isArray(local?.favorites) ? local.favorites : [], mastery: local?.mastery && typeof local.mastery === 'object' ? local.mastery : {}, draft: local?.draft && typeof local.draft === 'object' ? local.draft : {}, learningPaths: local?.learningPaths && typeof local.learningPaths === 'object' && !Array.isArray(local.learningPaths) ? local.learningPaths : {} }; }
`;

function load() {
  const context = vm.createContext({ window: {}, Map, assert });
  vm.runInContext(source, context, { filename: appPath('ui/local-records.js') });
  vm.runInContext(`
    let actualCalls = 0;
    let oracleCalls = 0;
    const actual = window.NotebookLocal.createNormalizer(() => 'uuid-' + ++actualCalls);
    const oracle = (() => {
      const uuid = () => 'uuid-' + ++oracleCalls;
      ${legacySource}
      return normalizeLocal;
    })();
    function compare(local) {
      const actualResult = actual(local);
      assert.deepStrictEqual(actualResult, oracle(local));
      assert.strictEqual(actualCalls, oracleCalls);
      return actualResult;
    }
  `, context);
  return context;
}

function run(script) {
  vm.runInContext(script, load(), { filename: 'local-normalization-fixtures.js' });
}

test('generated local normalizer loads as a standalone classic browser script', () => {
  assert.doesNotMatch(source, /\brequire\s*\(|\bexports\b|^export\s/m);
  const context = load();
  assert.equal(typeof context.window.NotebookLocal.createNormalizer, 'function');
  vm.runInContext(`
    const unused = window.NotebookLocal.createNormalizer(() => { throw new Error('unexpected uuid'); });
    assert.deepStrictEqual(unused(null), { records: [], favorites: [], mastery: {}, draft: {}, learningPaths: {} });
    unused({ records: [{ kind: 'local', id: 17, clientId: 'existing' }] });
  `, context);
});

test('matches legacy defaults for absent fields, primitive roots, and malformed containers', () => {
  run(`
    for (const input of [undefined, null, false, true, 0, 13, '', 'legacy', 1n, Symbol('legacy'), () => {}, {}, [],
      { records: null, favorites: {}, mastery: null, draft: '', learningPaths: [] },
      { records: 'bad', favorites: false, mastery: 4, draft: true, learningPaths: 'bad' },
      { records: {}, favorites: 1, mastery: () => {}, draft: () => {}, learningPaths: () => {} }]) {
      compare(input);
    }
    assert.strictEqual(actualCalls, 0);
    const input = { records: [null, undefined, false, 0, 12, '', 'local', {}, { kind: 'issue' }, { kind: 'document' }] };
    assert.strictEqual(compare(input).records.length, 0);
    assert.strictEqual(actualCalls, 0);
  `);
});

test('preserves record metadata, unknown truthy client IDs, numeric IDs, and foreign owners', () => {
  run(`
    const symbolKey = Symbol('metadata');
    const client = Object.freeze({ migrated: 'opaque-client' });
    const meta = Object.freeze({ repo: 'other/repository', extra: ['foreign'] });
    const record = Object.freeze({
      kind: 'local', id: 42, clientId: client, ownerId: 918,
      title: 'foreign local note', sourceKey: 'https://foreign.example|other/repository',
      metadata: meta, [symbolKey]: 'symbol-metadata'
    });
    const owner = { toString: () => 'foreign-owner' };
    const input = Object.freeze({ records: Object.freeze([
      record,
      Object.freeze({ kind: 'local', id: 0, clientId: 27, ownerId: owner }),
      Object.freeze({ kind: 'local', id: false, clientId: true, ownerId: false }),
      Object.freeze({ kind: 'local', id: '', clientId: 'has-id', ownerId: '' }),
      Object.freeze({ kind: 'local', id: null, clientId: client, ownerId: null }),
      Object.freeze({ kind: 'local', clientId: 'no-owner' })
    ]) });
    const result = compare(input);
    assert.notStrictEqual(result.records[0], record);
    assert.strictEqual(result.records[0].clientId, client);
    assert.strictEqual(result.records[0].metadata, meta);
    assert.strictEqual(result.records[0][symbolKey], 'symbol-metadata');
    assert.deepStrictEqual(result.records.map(record => record.id), [42, 0, false, '', 'local:[object Object]', 'local:no-owner']);
    assert.deepStrictEqual(result.records.map(record => record.ownerId), ['918', 'foreign-owner', 'false', '', null, null]);
    assert.strictEqual(actualCalls, 0);
    assert.strictEqual(record.id, 42);
    assert.strictEqual(record.ownerId, 918);
  `);
});

test('retains legacy cache collisions, truthiness, repeated calls, and lazy UUID allocation', () => {
  run(`
    assert.strictEqual(actualCalls, 0);
    const input = { records: [
      { kind: 'local', id: 5 }, { kind: 'local', id: '5' },
      { kind: 'local', id: 0, clientId: '' }, { kind: 'local', id: false, clientId: false }
    ] };
    const initial = compare(input);
    assert.deepStrictEqual(initial.records.map(record => record.clientId), ['uuid-1', 'uuid-1', 'uuid-2', 'uuid-3']);
    assert.deepStrictEqual(compare(input), initial);
    const explicitClient = { token: 'opaque' };
    const replacement = compare({ records: [{ kind: 'local', id: '5', clientId: explicitClient }, { kind: 'local', id: 5 }] });
    assert.strictEqual(replacement.records[0].clientId, explicitClient);
    assert.strictEqual(replacement.records[1].clientId, explicitClient);
    assert.strictEqual(compare({ records: [{ kind: 'local', id: 5, clientId: 0 }] }).records[0].clientId, explicitClient);
    assert.strictEqual(actualCalls, 3);
    const unkeyed = { records: [{ kind: 'local', id: '' }, { kind: 'local', id: '' }, { kind: 'local' }, { kind: 'local', id: null }] };
    const first = compare(unkeyed);
    const second = compare(unkeyed);
    assert.deepStrictEqual(first.records.map(record => record.clientId), ['uuid-4', 'uuid-5', 'uuid-6', 'uuid-7']);
    assert.deepStrictEqual(second.records.map(record => record.clientId), ['uuid-8', 'uuid-9', 'uuid-10', 'uuid-11']);
    assert.strictEqual(first.records[0].id, '');
    assert.strictEqual(first.records[2].id, 'local:uuid-6');
    assert.deepStrictEqual(compare(first), first);
    assert.strictEqual(actualCalls, 11);
    const separate = window.NotebookLocal.createNormalizer(() => 'separate');
    assert.strictEqual(separate({ records: [{ kind: 'local', id: 5 }] }).records[0].clientId, 'separate');
  `);
});

test('keeps accepted arrays and objects by reference without mutating the input', () => {
  run(`
    const favorites = Object.freeze([42, null, { foreign: true }]);
    const mastery = Object.freeze(['mastered']);
    const draft = Object.freeze(['draft']);
    const learningPaths = Object.freeze({ custom: { completed: true } });
    const input = Object.freeze({ records: Object.freeze([]), favorites, mastery, draft, learningPaths });
    const result = compare(input);
    assert.strictEqual(result.favorites, favorites);
    assert.strictEqual(result.mastery, mastery);
    assert.strictEqual(result.draft, draft);
    assert.strictEqual(result.learningPaths, learningPaths);
    assert.notStrictEqual(result.records, input.records);
    const rejected = compare({ mastery: new Date(0), draft: new Map([['draft', 1]]), learningPaths: [] });
    assert.deepStrictEqual(rejected.learningPaths, {});
    const defaults = compare(null);
    defaults.mastery.changed = true;
    defaults.favorites.push('changed');
    const fresh = compare(null);
    assert.deepStrictEqual(fresh.mastery, {});
    assert.deepStrictEqual(fresh.favorites, []);
  `);
});

test('accepts inherited local kinds and primitive properties exactly as the legacy function does', () => {
  run(`
    const inherited = Object.create({ kind: 'local', clientId: 'inherited-client', ownerId: 8 });
    inherited.id = 21;
    const result = compare({ records: [inherited] });
    assert.strictEqual(Object.hasOwn(result.records[0], 'kind'), false);
    assert.strictEqual(result.records[0].clientId, 'inherited-client');
    assert.strictEqual(result.records[0].ownerId, '8');
    try {
      Number.prototype.kind = 'local';
      Number.prototype.clientId = 'number-client';
      String.prototype.kind = 'local';
      String.prototype.clientId = 'string-client';
      const primitives = compare({ records: [7, 'xy'] });
      assert.deepStrictEqual(primitives.records[0], { clientId: 'number-client', id: 'local:number-client', ownerId: null });
      assert.deepStrictEqual(primitives.records[1], { 0: 'x', 1: 'y', clientId: 'string-client', id: 'local:string-client', ownerId: null });
      Number.prototype.records = [{ kind: 'local', clientId: 'primitive-root' }];
      assert.strictEqual(compare(17).records[0].clientId, 'primitive-root');
    } finally {
      delete Number.prototype.kind;
      delete Number.prototype.clientId;
      delete Number.prototype.records;
      delete String.prototype.kind;
      delete String.prototype.clientId;
    }
    assert.strictEqual(actualCalls, 0);
  `);
});
