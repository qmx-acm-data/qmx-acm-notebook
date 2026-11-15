'use strict';
const { appPath } = require('./app-path.cjs');
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
function harness(options) { const source = fs.readFileSync(path.join(__dirname, 'main.test.cjs'), 'utf8').split('// END_MAIN_HARNESS')[0]; return new Function('require', '__dirname', 'Buffer', source + '\nreturn harness;')(require, __dirname, Buffer)(options); }
const gateId = require(appPath('ui/algorithm-learning-path-data.js')).stages[1].gates[0].id;
const content = (extra = {}) => ({ gateId, description: '公共课程说明', goals: ['独立完成学习任务'], practiceList: null, sha: 'valid-sha', updatedAt: '2026-11-15T05:00:00.000Z', author: { id: 42, login: 'alice' }, repo: 'team/notebook', serverUrl: '', sourceKey: 'https://api.github.com|team/notebook', ...extra });
test('failed sync leaves saved public contents and local cache bytes unchanged', async () => {
  const h = harness({ files: { 'cache.json': { repo: 'team/notebook', learningGateContents: [content()] } }, backend: { sync: async () => { throw new Error('bad remote gate'); } } });
  const before = h.stored('cache.json'); await assert.rejects(h.invoke('sync'), /bad remote gate/);
  assert.deepEqual(h.stored('cache.json'), before); assert.equal((await h.invoke('bootstrap')).learningGateContents[0].sha, 'valid-sha');
});
test('same repository path at different Git services never shares public contents or writes', async () => {
  const github = content(), custom = content({ description: '校园公开课程说明', serverUrl: 'https://git.example.com', sourceKey: 'https://git.example.com|team/notebook' });
  const cache = { repo: 'team/notebook', learningGateContents: [github], repos: { 'https://api.github.com|team/notebook': { repo: 'team/notebook', learningGateContents: [github] }, 'https://git.example.com|team/notebook': { repo: 'team/notebook', serverUrl: 'https://git.example.com', sourceKey: 'https://git.example.com|team/notebook', learningGateContents: [custom] } } };
  const h = harness({ files: { 'cache.json': cache } });
  assert.equal((await h.invoke('bootstrap')).learningGateContents[0].description, github.description);
  await h.invoke('saveSettings', { serverUrl: 'https://git.example.com', repo: 'team/notebook' });
  assert.equal((await h.invoke('bootstrap')).learningGateContents[0].description, custom.description);
  const calls = h.calls.length; await assert.rejects(h.invoke('saveLearningGate', { repo: 'team/notebook', gateId }), /匿名读取/); assert.equal(h.calls.length, calls);
});
