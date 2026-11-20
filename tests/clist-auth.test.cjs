'use strict';
const { appPath } = require('./app-path.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createClistCredentials } = require(appPath('electron/auth.cjs'));

function fixture() {
  let saved;
  let available = true;
  const safeStorage = {
    isEncryptionAvailable: () => available,
    encryptString: text => Buffer.from(text.split('').reverse().join('')),
    decryptString: bytes => bytes.toString().split('').reverse().join('')
  };
  const make = overrides => createClistCredentials({ safeStorage, readAuth() {
    if (saved === undefined) throw Object.assign(new Error(), { code: 'ENOENT' });
    return saved;
  }, saveAuth(value) { saved = value; }, ...overrides });
  return { make, get saved() { return saved; }, set available(value) { available = value; } };
}
test('CLIST credentials are encrypted, restored and cleared independently', () => {
  const f = fixture(), store = f.make();
  assert.deepEqual(store.status(), { configured: false, username: null });
  assert.deepEqual(store.save({ username: ' demo ', apiKey: 'dummy-key' }), { configured: true, username: 'demo' });
  assert.ok(!JSON.stringify(f.saved).includes('dummy-key'));
  assert.deepEqual(f.make().status(), { configured: true, username: 'demo' });
  assert.deepEqual(f.make().load(), { username: 'demo', apiKey: 'dummy-key' });
  assert.deepEqual(store.clear(), { configured: false, username: null });
  assert.deepEqual(f.make().status(), { configured: false, username: null });
});
test('unavailable encryption and invalid inputs never overwrite saved credentials', () => {
  const f = fixture(), store = f.make();
  store.save({ username: 'demo', apiKey: 'dummy-key' });
  const saved = f.saved;
  f.available = false;
  assert.throws(() => store.save({ username: 'other', apiKey: 'new-key' }), /无法安全保存/);
  assert.equal(f.saved, saved);
  assert.throws(() => store.status(), /无法解密/);
  assert.throws(() => store.save({ username: '', apiKey: 'x' }), /格式/);
  assert.equal(f.saved, saved);
});
test('credential errors never expose underlying exceptions', () => {
  const f = fixture();
  const store = f.make({ saveAuth() { throw new Error('sensitive-details'); } });
  assert.throws(() => store.save({ username: 'demo', apiKey: 'dummy-key' }), error => !error.message.includes('sensitive-details'));
  assert.throws(() => store.clear(), error => !error.message.includes('sensitive-details'));
  assert.throws(() => f.make({ readAuth() { throw new Error('sensitive-details'); } }).status(), error => !error.message.includes('sensitive-details'));
});
