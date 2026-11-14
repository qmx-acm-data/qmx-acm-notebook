'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { appPath } = require('./app-path.cjs');
const { compile } = require('../tools/build-preload.cjs');

// Keep this explicit so adding, removing, or reordering a public IPC method is reviewed.
const methods = [
  'plannerAction', 'bindPlatform', 'refreshPlatform', 'unbindPlatform', 'getContests',
  'bootstrap', 'sync', 'submit', 'comment', 'openExternal', 'openAuthUrl', 'formatCode',
  'saveSettings', 'login', 'logout', 'cancelLogin', 'getComments', 'propose',
  'updateLocal', 'exportLocal', 'saveDocument', 'saveAlgorithmTopic', 'saveAlgorithmNote',
  'deleteDocument', 'deleteIssue', 'refreshAccount', 'checkStartupUpdates', 'checkForUpdates',
  'downloadUpdate', 'installUpdate', 'getTagCatalog', 'requestTag', 'getTagReview', 'reviewTag'
];

function loadPreload(code, invoke = () => Promise.resolve()) {
  const ipcRenderer = new EventEmitter();
  ipcRenderer.invoke = invoke;
  const removals = [];
  const removeListener = ipcRenderer.removeListener;
  ipcRenderer.removeListener = function(channel, handler) {
    removals.push({ channel, handler });
    return removeListener.call(this, channel, handler);
  };
  let bridge;
  const loads = [];
  vm.runInNewContext(code, {
    require(name) {
      loads.push(name);
      assert.equal(name, 'electron', 'sandbox preload may only require Electron');
      return {
        contextBridge: {
          exposeInMainWorld(name, value) {
            assert.equal(name, 'notebook');
            assert.equal(bridge, undefined, 'expose one bridge');
            bridge = value;
          }
        },
        ipcRenderer
      };
    }
  }, { filename: 'preload.cjs' });
  assert.deepEqual(loads, ['electron']);
  assert.ok(bridge);
  return { bridge, ipcRenderer, removals };
}

const implementations = [
  ['compiled TypeScript', () => compile()],
  ['application artifact', () => fs.readFileSync(appPath('electron/preload.cjs'), 'utf8')]
];

for (const [label, readCode] of implementations) {
  test(`${label}: preload exposes the exact 34 methods in order and forwards every argument`, async () => {
    const calls = [], result = { saved: true };
    const pending = Promise.resolve(result);
    const { bridge } = loadPreload(readCode(), (...args) => { calls.push(args); return pending; });
    assert.equal(methods.length, 34);
    assert.deepEqual(Object.keys(bridge), [...methods, 'onAuthProgress', 'onUpdateProgress']);
    for (const name of methods) {
      const payload = { method: name }, sequence = [name, undefined];
      const args = [undefined, payload, sequence, null, false, 0, '', undefined];
      assert.equal(typeof bridge[name], 'function');
      const returned = bridge[name](...args);
      assert.equal(returned, pending, `${name} preserves the invoke Promise`);
      assert.equal(await returned, result);
      assert.deepEqual(calls.at(-1), [name, ...args], `${name} preserves values and argument count`);
      assert.equal(calls.at(-1)[2], payload);
      assert.equal(calls.at(-1)[3], sequence);
      bridge[name]();
      assert.deepEqual(calls.at(-1), [name], `${name} preserves zero arguments`);
    }
    assert.equal(calls.length, methods.length * 2);
  });

  test(`${label}: every method preserves the original rejected Promise and rejection value`, async () => {
    const rejection = new Error('IPC rejected');
    const rejected = Promise.reject(rejection);
    // Attach a handler immediately; each bridge call must return this same Promise.
    const observed = assert.rejects(rejected, error => error === rejection);
    const { bridge } = loadPreload(readCode(), () => rejected);
    for (const name of methods) {
      const returned = bridge[name](undefined);
      assert.equal(returned, rejected, `${name} must not wrap the invoke Promise`);
      await assert.rejects(returned, error => error === rejection);
    }
    await observed;
  });

  test(`${label}: auth and update subscribers receive only data and unsubscribe independently`, () => {
    const { bridge, ipcRenderer, removals } = loadPreload(readCode());
    const channels = [
      ['onAuthProgress', 'auth-progress'],
      ['onUpdateProgress', 'update-progress']
    ];
    const subscribers = channels.map(([method, channel]) => {
      const deliveries = [[], []];
      const stops = deliveries.map(received => bridge[method]((...args) => received.push(args)));
      const handlers = ipcRenderer.listeners(channel);
      assert.equal(handlers.length, 2);
      assert.notEqual(handlers[0], handlers[1]);
      assert(stops.every(stop => typeof stop === 'function'));
      return { channel, deliveries, stops, handlers };
    });
    const event = { sender: { privileged: true } };
    const initial = { stage: 'initial' };
    for (const { channel, deliveries } of subscribers) {
      ipcRenderer.emit(channel, event, initial, 'extra IPC argument');
      for (const received of deliveries) {
        assert.deepEqual(received, [[initial]]);
        assert.equal(received[0][0], initial);
      }
    }
    for (const { channel, stops, handlers } of subscribers) {
      stops[0]();
      assert.deepEqual(ipcRenderer.listeners(channel), [handlers[1]]);
      assert.deepEqual(removals.at(-1), { channel, handler: handlers[0] });
    }
    const next = { stage: 'next' };
    for (const { channel, deliveries } of subscribers) {
      ipcRenderer.emit(channel, event, next);
      assert.deepEqual(deliveries[0], [[initial]]);
      assert.deepEqual(deliveries[1], [[initial], [next]]);
    }
    for (const { channel, stops, handlers, deliveries } of subscribers) {
      stops[1]();
      assert.deepEqual(removals.at(-1), { channel, handler: handlers[1] });
      assert.equal(ipcRenderer.listenerCount(channel), 0);
      ipcRenderer.emit(channel, event, { stage: 'after unsubscribe' });
      assert.deepEqual(deliveries[1], [[initial], [next]]);
    }
    assert.equal(removals.length, 4);
  });
}

const boundaryMethods = ['openExternal', 'openAuthUrl', 'formatCode', 'cancelLogin', 'exportLocal'];

function loadBoundaryRegistration() {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(appPath('electron/ipc-boundary.cjs'), 'utf8'), { module }, {
    filename: 'ipc-boundary.cjs'
  });
  assert.deepEqual(Object.keys(module.exports), ['registerBoundary']);
  return module.exports.registerBoundary;
}

function loadRendererFactory(window = {}) {
  vm.runInNewContext(fs.readFileSync(appPath('ui/ipc-boundary.js'), 'utf8'), { window }, {
    filename: 'ipc-boundary.js'
  });
  assert.equal(typeof window.NotebookIPC, 'function');
  return window.NotebookIPC;
}

test('compiled main boundary registers the five original operations without transforming arguments or results', async () => {
  const registerBoundary = loadBoundaryRegistration();
  const registrations = [], calls = [], operations = {};
  let result;
  for (const name of boundaryMethods) {
    operations[name] = function(...args) { calls.push({ name, args }); return result; };
  }
  assert.equal(registerBoundary((...args) => registrations.push(args), operations), undefined);
  assert.deepEqual(registrations.map(([name]) => name), boundaryMethods);
  for (const [name, handler] of registrations) {
    assert.equal(handler, operations[name], `${name} registers the original function`);
    const payload = { name }, args = [undefined, false, payload, undefined];
    for (const value of [false, undefined]) {
      result = value;
      assert.equal(handler(...args), value);
      assert.deepEqual(calls.at(-1), { name, args });
      assert.equal(calls.at(-1).args[2], payload);
    }
    const resolved = Promise.resolve(false);
    result = resolved;
    assert.equal(handler(...args), resolved);
    assert.equal(await resolved, false);
    const rejection = new Error(`${name} rejected`);
    result = Promise.reject(rejection);
    const returned = handler(...args);
    assert.equal(returned, result);
    await assert.rejects(returned, error => error === rejection);
  }
});

test('compiled renderer facade accesses methods lazily and preserves bridge receivers, arguments and Promises', async () => {
  let globalReads = 0;
  const window = {};
  Object.defineProperty(window, 'notebook', {
    get() { globalReads++; throw new Error('The factory must use its supplied bridge'); }
  });
  const factory = loadRendererFactory(window);
  const bridge = {}, calls = [], reads = [];
  let result;
  for (const name of boundaryMethods) {
    Object.defineProperty(bridge, name, {
      get() {
        reads.push(name);
        return function(...args) {
          assert.equal(this, bridge, `${name} keeps the bridge receiver`);
          calls.push({ name, args });
          return result;
        };
      }
    });
  }
  const facade = factory(bridge);
  assert.deepEqual(Object.keys(facade), boundaryMethods);
  assert.deepEqual(reads, [], 'factory construction must not access bridge methods');
  assert.equal(globalReads, 0, 'loading and creating the facade must not read window.notebook');
  for (const name of boundaryMethods) {
    const payload = { method: name };
    const args = name === 'formatCode'
      ? ['future-unsupported-language', 'source code', undefined, payload, undefined]
      : [undefined, payload, false, '', undefined];
    for (const value of [false, undefined]) {
      result = Promise.resolve(value);
      const returned = facade[name](...args);
      assert.equal(returned, result, `${name} preserves the Promise`);
      assert.equal(await returned, value);
      assert.deepEqual(calls.at(-1), { name, args });
      assert.equal(calls.at(-1).args[name === 'formatCode' ? 3 : 1], payload);
      assert.equal(reads.at(-1), name);
    }
    const rejection = new Error(`${name} rejected`);
    result = Promise.reject(rejection);
    const returned = facade[name](...args);
    assert.equal(returned, result);
    await assert.rejects(returned, error => error === rejection);
    assert.deepEqual(calls.at(-1), { name, args });
  }
  assert.equal(reads.length, boundaryMethods.length * 3);
  assert.equal(globalReads, 0);
});

test('compiled renderer facade retains the supplied bridge while a new factory call can use the live bridge', () => {
  const calls = [];
  function makeBridge(label) {
    return Object.fromEntries(boundaryMethods.map(name => [name, function(...args) {
      assert.equal(this, bridgeByLabel.get(label));
      calls.push({ label, name, args });
      return label;
    }]));
  }
  const bridgeByLabel = new Map();
  for (const label of ['supplied', 'initial global', 'replacement global']) bridgeByLabel.set(label, makeBridge(label));
  const supplied = bridgeByLabel.get('supplied');
  const window = { notebook: bridgeByLabel.get('initial global') };
  const factory = loadRendererFactory(window);
  const retained = factory(supplied);
  window.notebook = bridgeByLabel.get('replacement global');
  const live = factory(window.notebook);
  for (const name of boundaryMethods) {
    const args = [undefined, { name }, undefined];
    assert.equal(retained[name](...args), 'supplied');
    assert.deepEqual(calls.at(-1), { label: 'supplied', name, args });
    assert.equal(live[name](...args), 'replacement global');
    assert.deepEqual(calls.at(-1), { label: 'replacement global', name, args });
  }
  assert.equal(calls.length, boundaryMethods.length * 2);
});
