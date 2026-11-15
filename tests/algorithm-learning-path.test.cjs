'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const data = require('../data/algorithm-learning-path.json');
const legacy = require('../data/algorithm-learning-path-legacy.json');
const framework = require('../chapter-framework-v2.json');
const directory = require('../data/algorithm-directory.json');
// Pure editable-data validation does not import application runtime modules.
const tree = directory.tree;
const { validate } = require(process.env.QMX_LEARNING_VALIDATOR || '../tools/build-algorithm-learning-path.cjs');
const gate = (value, suffix) => value.stages.flatMap(s => s.gates).find(g => g.id.endsWith('-' + suffix));
const changed = () => structuredClone(data);

test('approved B framework yields fourteen chapters and 58 naturally sized sections', () => {
  assert.equal(framework.chapters.reduce((n, c) => n + c.stages.length, 0), 58);
  assert.deepEqual(data.stages.map(s => s.index), Array.from({ length: 15 }, (_, i) => i));
  assert.equal(data.id, legacy.id);
  for (const chapter of framework.chapters) {
    const stage = data.stages[chapter.n];
    assert.equal(stage.id, `stage-${String(chapter.n).padStart(2, '0')}`);
    assert.equal(stage.title, chapter.title);
    assert.equal(stage.sections.length, chapter.stages.length);
    assert.deepEqual(stage.sections.map(s => s.title), chapter.stages.map(s => s.name));
    assert.deepEqual(stage.sections.map(s => s.scope), chapter.stages.map(s => s.scope));
  }
  assert.ok(new Set(data.stages.slice(1).map(s => s.gates.length)).size > 3);
  assert.deepEqual(validate(data, tree, directory), data.summary);
  assert.equal(data.summary.sections, 58);
  assert.equal(data.summary.gates, 201);
});

test('old identities remain readable history and are never awarded to new curriculum gates', () => {
  const old = legacy.stages.slice(1).flatMap(s => s.gates.map(g => g.id));
  assert.deepEqual(data.legacyGates.map(g => g.id), old);
  assert.equal(data.legacyGates.length, 168);
  const current = data.stages.slice(1).flatMap(s => s.gates);
  for (const g of current) { assert.match(g.id, /^lp2-/); assert.ok(!old.includes(g.id)); }
  assert.equal(data.stages[0].gates[0].id, legacy.stages[0].gates[0].id);
  assert.deepEqual(data.stages[0].gates[0].topicIds, ['directory-contest-experience']);
  assert.equal(data.stages[0].sections.length, 1);
});

test('every section has explicit scope, membership and a practice assessment', () => {
  for (const stage of data.stages.slice(1)) for (const section of stage.sections) {
    const assigned = stage.gates.filter(g => g.sectionId === section.id);
    assert.deepEqual(assigned.map(g => g.id), section.gateIds);
    assert.ok(assigned.some(g => g.kind === 'challenge' || g.kind === 'mixed'));
    assert.ok(assigned.every(g => g.sectionTitle === section.title && g.routeId === section.routeId));
    assert.ok(section.completionCriteria.length > 0);
  }
});

test('ratings are absent until actual selection evidence exists and topic difficulty stays in tree', () => {
  for (const stage of data.stages) {
    assert.equal(stage.cf, undefined); assert.deepEqual(stage.luoguDifficulty, []);
    for (const g of stage.gates) { assert.equal(g.cf, undefined); assert.deepEqual(g.luoguDifficulty, []); assert.equal(g.knowledgeDifficulty, undefined); assert.equal(g.problemIds, undefined); }
  }
  const bad = changed(); bad.stages[1].gates[0].knowledgeDifficulty = 'beginner';
  assert.throws(() => validate(bad, tree, directory), /Knowledge difficulty/);
});

test('first chapter closes common STL and third chapter provides early modular powers', () => {
  const topics = new Set(data.stages[1].gates.flatMap(g => g.topicIds));
  for (const id of ['xcpc-vector-1', 'algorithm-string', 'xcpc-map-1', 'xcpc-set-1', 'algorithm-stack-queue', 'xcpc-priority-queue-1', 'algorithm-deque', 'xcpc-unordered-map-1']) assert.ok(topics.has(id));
  assert.ok(data.stages[3].gates.some(g => g.topicIds.includes('xcpc-快速幂-1') && g.scope === 'core'));
  const back = gate(data, 'bounded'); assert.match(back.description, /不能直接泛化到有限件计数/);
  assert.equal(gate(data, 'lazy-add').scope, 'core');
  assert.equal(gate(data, 'lazy-compose').scope, 'recommended');
});

test('advanced knowledge difficulty does not automatically make a route optional enrichment', () => {
  assert.equal(gate(data, 'bst-treap').scope, 'route');
  assert.equal(gate(data, 'fft-ntt').scope, 'route');
  assert.equal(gate(data, 'mincut').scope, 'core');
  assert.equal(gate(data, 'suffix-automaton').scope, 'elective');
  const route = data.stages[12].sections.find(s => s.routeId === 'lp2-route-ordered-route');
  assert.ok(route);
  assert.ok(route.gateIds.some(id => data.stages[12].gates.find(g => g.id === id).scope === 'route'));
});

test('route scopes and core completion never silently depend on elective work', () => {
  const all = new Map(data.stages.flatMap(s => s.gates).map(g => [g.id, g]));
  for (const g of all.values()) {
    assert.equal(g.optional, g.scope !== 'core');
    if (g.scope === 'core') for (const id of g.prerequisites.gateIds) assert.equal(all.get(id).scope, 'core');
  }
  const bad = changed(); gate(bad, 'lazy-add').prerequisites.gateIds.push(gate(bad, 'lazy-compose').id);
  assert.throws(() => validate(bad, tree, directory), /Optional topic blocks core/);
});

test('direct prerequisite graph catches forward cycles rather than assuming chapter order', () => {
  const bad = changed();
  const a = gate(bad, 'matrix'), b = gate(bad, 'gaussian');
  a.prerequisites.gateIds = [b.id]; b.prerequisites.gateIds = [a.id];
  assert.throws(() => validate(bad, tree, directory), /Cyclic gate prerequisite/);
  const stages = changed(); stages.stages[1].prerequisites.stageIds.push('stage-02');
  assert.throws(() => validate(stages, tree, directory), /Cyclic stage prerequisite/);
});

test('missing real topics, dangling prerequisite and thread references fail closed', () => {
  const missing = changed(); missing.stages[1].gates[0].topicIds = ['invented-cpp-topic'];
  assert.throws(() => validate(missing, tree, directory), /Unresolved topic/);
  const prereq = changed(); gate(prereq, 'matrix').prerequisites.gateIds.push('missing-gate');
  assert.throws(() => validate(prereq, tree, directory), /Unresolved gate prerequisite/);
  const thread = changed(); thread.stages[1].gates[0].threadGateIds = ['missing-thread'];
  assert.throws(() => validate(thread, tree, directory), /Unresolved learning thread/);
  const topic = changed(); topic.stages[1].gates[0].topicIds = ['directory-contest-experience'];
  assert.throws(() => validate(topic, tree, directory), /Directory linked as algorithm/);
});

test('section membership, route shape, semantic identity and summary are enforced', () => {
  const wrong = changed(); wrong.stages[1].gates[0].sectionId = wrong.stages[1].sections[1].id;
  assert.throws(() => validate(wrong, tree, directory), /Gate section mismatch/);
  const route = changed(); route.stages[12].sections[0].routeId = null;
  assert.throws(() => validate(route, tree, directory), /Route section mismatch/);
  const identity = changed(); identity.stages[1].gates[0].id = 'stage-01-gate-01';
  assert.throws(() => validate(identity, tree, directory), /New semantic gate identity/);
  const sum = changed(); sum.summary.gates++;
  assert.throws(() => validate(sum, tree, directory));
});

test('independent advanced branches have their real direct prerequisites rather than a forced template chain', () => {
  assert.ok(!gate(data, 'suffix-automaton').prerequisites.gateIds.includes(gate(data, 'suffix-array').id));
  assert.ok(!gate(data, 'burnside').prerequisites.gateIds.includes(gate(data, 'newton').id));
  assert.ok(!gate(data, 'dominators').prerequisites.gateIds.includes(gate(data, 'special-matching').id));
  assert.ok(!gate(data, 'xor-basis').prerequisites.gateIds.includes(gate(data, 'matrix').id));
});

test('practice references do not force AC into the core string chapter or every route into capstone', () => {
  const ac = gate(data, 'ac-build'), basic = gate(data, 'string-tool-choice');
  assert.equal(ac.scope, 'recommended'); assert.equal(basic.scope, 'core');
  assert.ok(ac.prerequisites.gateIds.includes(gate(data, 'trie').id));
  assert.ok(ac.prerequisites.gateIds.includes(gate(data, 'bfs-paths').id));
  const capstone = gate(data, 'project-review');
  assert.equal(capstone.scope, 'core');
  assert.ok(capstone.prerequisites.gateIds.every(id => !data.stages[14].gates.find(g => g.id === id)?.optional));
});
