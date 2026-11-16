'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../src/shared/learning-curriculum.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true } }).outputText;
const helper = { exports: {} };
new Function('module', 'exports', compiled)(helper, helper.exports);
const { createCurriculumLayout, applyCurriculumLayout } = helper.exports;
const base = require('../data/algorithm-learning-path.json');

test('layout reorder and rename preserve gate identities and leave builtin curriculum untouched', () => {
  const snapshot = JSON.stringify(base), layout = createCurriculumLayout(base), chapter = layout.stages[1];
  const original = [...chapter.gates]; chapter.title = '管理员调整章名'; chapter.gates.reverse(); chapter.gates[0].title = '管理员调整关卡名';
  const applied = applyCurriculumLayout(base, layout), next = applied.stages[1];
  assert.equal(next.title, chapter.title); assert.deepEqual(next.gates.map(gate => gate.id), original.map(gate => gate.id).reverse());
  assert.equal(next.gates[0].title, chapter.gates[0].title);
  assert.deepEqual(next.gates[0].topicIds, base.stages[1].gates.at(-1).topicIds);
  assert.equal(JSON.stringify(base), snapshot);
});

test('insertions derive section metadata and deletions preserve history while removing dangling references', () => {
  const layout = createCurriculumLayout(base), chapter = layout.stages[1], removed = chapter.gates.shift();
  const id = 'custom-00000000-0000-4000-8000-000000000001', section = base.stages[1].sections[0];
  chapter.gates.unshift({ id, title: '新增混练', kind: 'mixed', sectionId: section.id, scope: 'core', description: '综合应用', goals: ['独立完成练习'], topicIds: ['directory-contest-experience'] });
  const applied = applyCurriculumLayout(base, layout), custom = applied.stages[1].gates[0];
  assert.equal(custom.id, id); assert.equal(custom.kind, 'mixed'); assert.equal(custom.sectionTitle, section.title); assert.equal(custom.learningDescription, '综合应用');
  assert.ok(applied.legacyGates.some(gate => gate.id === removed.id));
  for (const stage of applied.stages) {
    for (const gate of stage.gates) { assert.ok(!gate.prerequisites.gateIds.includes(removed.id)); assert.ok(!gate.threadGateIds.includes(removed.id)); }
    for (const group of stage.sections || []) assert.deepEqual(group.gateIds, stage.gates.filter(gate => gate.sectionId === group.id).map(gate => gate.id));
  }
  const roundtrip = createCurriculumLayout(applied).stages[1].gates[0];
  assert.deepEqual(roundtrip.goals, custom.goals); assert.deepEqual(roundtrip.topicIds, custom.topicIds);
  assert.equal(roundtrip.description, custom.description);
});
