'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const curriculum = require('../data/algorithm-learning-path.json');
const directory = require('../data/algorithm-directory.json');

// This data module has only a type import; compile it in memory without building or loading the renderer.
const filename = path.resolve(__dirname, '../src/renderer/algorithms/roadmap-data.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  fileName: filename,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true },
  reportDiagnostics: true,
});
assert.deepEqual((compiled.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error), []);
const loaded = { exports: {} };
new Function('module', 'exports', compiled.outputText)(loaded, loaded.exports);
const { roadmapData } = loaded.exports;
const entries = [...roadmapData.nodes, ...roadmapData.indexEntries];
const gates = new Map(curriculum.stages.flatMap(stage => stage.gates).map(gate => [gate.id, gate]));
const topicIds = new Set();
(function visit(node) {
  topicIds.add(node.id);
  for (const id of node.legacyIds || []) topicIds.add(id);
  for (const child of node.children || []) visit(child);
})(directory.tree);

const expectedNodeIds = [
  'g', 'xh', 'sz', 'hs', 'wy', 'ds', 'ss', 'px', 'ef', 'tx', 'dl', 'zfc', 'hm',
  'ssr', 'jcdp', 'tl', 'srgt', 'zfsf', 'jcsz', 'jjsj', 'jjdp', 'jjgl', 'jjsz',
  'recursion', 'struct', 'pointer', 'simulation', 'construction', 'prefix', 'two',
  'basicdata', 'advancedstrings', 'geometry',
].sort();
const expectedEdges = [
  'g>xh', 'g>sz', 'g>hs', 'g>wy', 'xh>ds', 'sz>ds', 'hs>ds', 'wy>ss',
  'ds>px', 'ds>ef', 'ds>tx', 'ds>dl', 'ds>zfc', 'ds>hm', 'ds>ssr', 'tx>srgt', 'zfc>zfsf',
  'ss>jcsz', 'ssr>jcdp', 'ssr>tl', 'jcdp>srgt', 'jcdp>jjdp', 'tl>jjgl', 'jcsz>jjsz',
  'jjsj>jjdp', 'hs>recursion', 'recursion>ssr', 'g>struct', 'g>pointer', 'xh>simulation',
  'sz>simulation', 'ds>basicdata', 'basicdata>jjsj', 'zfsf>advancedstrings', 'jcsz>geometry',
  'sz>prefix', 'sz>two', 'ss>construction',
].sort();

test('roadmap retains the approved 33 graph nodes, 38 relationships and separate offline index', () => {
  assert.equal(roadmapData.nodes.length, 33);
  assert.equal(roadmapData.edges.length, 38);
  assert.deepEqual(roadmapData.nodes.map(node => node.id).sort(), expectedNodeIds);
  assert.deepEqual(roadmapData.edges.map(edge => `${edge.from}>${edge.to}`).sort(), expectedEdges);
  assert.deepEqual(roadmapData.indexEntries.map(entry => entry.id), ['offline']);
  assert.equal(new Set(entries.map(entry => entry.id)).size, entries.length, 'graph and index IDs are unique');
  assert.equal(roadmapData.rows.length, 4);
  const nodeIds = new Set(roadmapData.nodes.map(node => node.id));
  for (const edge of roadmapData.edges) {
    assert.ok(nodeIds.has(edge.from), `Unknown edge source ${edge.from}`);
    assert.ok(nodeIds.has(edge.to), `Unknown edge target ${edge.to}`);
  }
  for (const entry of entries) assert.ok(Number.isInteger(entry.row) && entry.row >= 0 && entry.row < 4, `Invalid stage for ${entry.id}`);
});

test('roadmap resources cover all 201 current gates without unknown gate or knowledge IDs', () => {
  assert.equal(gates.size, 201);
  const covered = new Set();
  for (const entry of entries) {
    assert.ok(entry.gateIds.length > 0, `${entry.id} has resource gates`);
    assert.ok(entry.topicIds.length > 0, `${entry.id} has knowledge links`);
    assert.equal(new Set(entry.gateIds).size, entry.gateIds.length, `Repeated gate in ${entry.id}`);
    assert.equal(new Set(entry.topicIds).size, entry.topicIds.length, `Repeated topic in ${entry.id}`);
    for (const id of entry.gateIds) {
      assert.ok(gates.has(id), `${entry.id} references unknown gate ${id}`);
      covered.add(id);
    }
    for (const id of entry.topicIds) assert.ok(topicIds.has(id), `${entry.id} references unknown topic ${id}`);
  }
  assert.deepEqual([...covered].sort(), [...gates.keys()].sort(), 'every current gate remains accessible from a graph node or the offline index');
});

test('dynamic trees, advanced algebra and special graph routes retain their full gate and topic mappings', () => {
  for (const [nodeId, prefix] of [
    ['jjsj', 'lp2-specialization-dynamic-tree-route-'],
    ['jjsz', 'lp2-specialization-algebra-route-'],
    ['jjgl', 'lp2-specialization-special-graph-route-'],
  ]) {
    const node = roadmapData.nodes.find(entry => entry.id === nodeId);
    const route = [...gates.values()].filter(gate => gate.id.startsWith(prefix));
    assert.ok(route.length > 1, `${prefix} includes learning and practice resources`);
    for (const gate of route) {
      assert.ok(node.gateIds.includes(gate.id), `${nodeId} retains ${gate.id}`);
      for (const id of gate.topicIds) assert.ok(node.topicIds.includes(id), `${nodeId} retains knowledge ${id}`);
    }
  }
});
