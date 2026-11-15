// Generated from src/tools/build-algorithm-learning-path.cts; run pnpm modules:build.
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const scopes = new Set(['core', 'recommended', 'elective', 'route']);
function acyclic(edges, label) {
    const visiting = new Set(), done = new Set();
    function visit(id) {
        if (done.has(id))
            return;
        assert.ok(!visiting.has(id), `Cyclic ${label} prerequisite ${id}`);
        visiting.add(id);
        for (const parent of edges.get(id) || []) {
            assert.ok(edges.has(parent), `Unresolved ${label} prerequisite ${id}: ${parent}`);
            visit(parent);
        }
        visiting.delete(id);
        done.add(id);
    }
    for (const id of edges.keys())
        visit(id);
}
function validate(data, tree, directory) {
    assert.equal(data.schema, 1);
    assert.equal(data.id, 'xcpc-breadth-first-v1', 'Preserve the progress namespace');
    assert.equal(data.curriculumVersion, 2);
    assert.ok(data.title);
    assert.equal(data.stages.length, 15, 'Orientation plus fourteen chapters required');
    const topics = new Map(), sourceTopics = new Map();
    function index(node, map) { assert.ok(!map.has(node.id), `Duplicate topic ${node.id}`); map.set(node.id, node); node.children.forEach(child => index(child, map)); }
    index(tree, topics);
    index(directory.tree, sourceTopics);
    const stages = new Map(), gates = new Map();
    const sectionIds = new Set(), routeIds = new Set();
    const gateOwners = new Map();
    for (const [i, stage] of data.stages.entries()) {
        assert.equal(stage.index, i);
        assert.equal(stage.id, `stage-${String(i).padStart(2, '0')}`);
        if (i === 0)
            assert.equal(stage.type, 'orientation');
        else
            assert.notEqual(stage.type, 'orientation');
        assert.ok(!stages.has(stage.id));
        stages.set(stage.id, stage);
        assert.ok(stage.title && stage.description && stage.goal && stage.rationale && stage.entryText);
        assert.ok(stage.completionMode === 'core' || stage.completionMode === 'routes');
        assert.ok(Array.isArray(stage.sections) && stage.sections.length > 0, `Missing sections ${stage.id}`);
        assert.ok(Array.isArray(stage.completionCriteria) && stage.completionCriteria.length > 0);
        if (i === 0)
            assert.equal(stage.gates.length, 1);
        else
            assert.ok(stage.gates.length > 0);
        for (const [j, gate] of stage.gates.entries()) {
            assert.equal(gate.index, j + 1);
            assert.ok(gate.id && !gates.has(gate.id), `Duplicate gate ${gate.id}`);
            if (i === 0)
                assert.equal(gate.id, 'stage-00-gate-01');
            else
                assert.match(gate.id, /^lp2-[a-z0-9]+(?:-[a-z0-9]+)+$/, `New semantic gate identity required ${gate.id}`);
            gates.set(gate.id, gate);
            gateOwners.set(gate.id, stage.id);
        }
    }
    const luogu = new Set(['入门', '普及−', '普及', '普及+/提高−', '提高', '提高+/省选−', '省选/NOI−', 'NOI/NOI+/CTS']);
    const colors = new Set(['basic', 'beginner', 'intermediate', 'advanced', 'expert']);
    const referenced = new Set(), stageEdges = new Map(), gateEdges = new Map();
    function range(cf, name) {
        if (cf === undefined)
            return;
        assert.ok(Number.isInteger(cf.min) && cf.min >= 0, `Invalid CF range ${name}`);
        assert.ok(cf.max === null || Number.isInteger(cf.max) && cf.max >= cf.min, `Invalid CF ceiling ${name}`);
    }
    function tags(value, name) { assert.ok(Array.isArray(value) && value.every(tag => luogu.has(tag)), `Invalid Luogu tags ${name}`); }
    for (const stage of data.stages) {
        assert.ok(Array.isArray(stage.sections) && stage.sections.length > 0, `Missing sections ${stage.id}`);
        const orientation = stage.type === 'orientation';
        range(stage.cf, stage.id);
        tags(stage.luoguDifficulty, stage.id);
        stageEdges.set(stage.id, stage.prerequisites?.stageIds || []);
        const membership = new Set();
        for (const section of stage.sections) {
            assert.ok(section.id && !sectionIds.has(section.id), `Duplicate section ${section.id}`);
            sectionIds.add(section.id);
            assert.ok(section.title && section.description && section.completionCriteria.length > 0, `Incomplete section ${section.id}`);
            assert.ok(scopes.has(section.scope), `Invalid section scope ${section.id}`);
            assert.ok(section.routeId === null || typeof section.routeId === 'string' && section.routeId.length > 0, `Invalid section route ${section.id}`);
            assert.equal(section.scope === 'route', section.routeId !== null, `Route section mismatch ${section.id}`);
            if (section.routeId) {
                assert.ok(!routeIds.has(section.routeId), `Duplicate route ${section.routeId}`);
                routeIds.add(section.routeId);
            }
            assert.ok(section.gateIds.length > 0, `Empty section ${section.id}`);
            for (const id of section.gateIds) {
                const gate = gates.get(id);
                assert.ok(gate && gateOwners.get(id) === stage.id, `Foreign section gate ${section.id}: ${id}`);
                assert.ok(!membership.has(id), `Repeated section membership ${id}`);
                membership.add(id);
                assert.equal(gate.sectionId, section.id, `Gate section mismatch ${id}`);
                assert.equal(gate.sectionTitle, section.title, `Gate section title mismatch ${id}`);
                assert.equal(gate.routeId, section.routeId, `Gate route mismatch ${id}`);
                if (gate.scope === 'core')
                    assert.equal(section.scope, 'core', `Core gate outside core section ${id}`);
                if (gate.scope === 'route')
                    assert.equal(section.scope, 'route', `Route gate outside route section ${id}`);
            }
            if (!orientation)
                assert.ok(section.gateIds.some(id => ['mixed', 'challenge'].includes(gates.get(id).kind)), `Section needs practice or assessment ${section.id}`);
            for (const id of section.prerequisites.gateIds)
                assert.ok(gates.has(id) && !section.gateIds.includes(id), `Invalid section prerequisite ${section.id}: ${id}`);
            for (const id of section.prerequisites.topicIds)
                assert.ok(topics.get(id)?.kind === 'algorithm', `Invalid section topic prerequisite ${id}`);
        }
        assert.equal(membership.size, stage.gates.length, `Unassigned section gate ${stage.id}`);
        for (const gate of stage.gates) {
            assert.ok(['learning', 'mixed', 'challenge'].includes(gate.kind));
            assert.ok(gate.title && gate.description && gate.goals?.length >= 3);
            assert.ok(typeof gate.learningTitle === 'string' && gate.learningTitle.length > 0 && gate.learningTitle.length <= 64, `Missing learning title ${gate.id}`);
            assert.ok(typeof gate.learningDescription === 'string' && gate.learningDescription.length >= 20, `Missing learning narrative ${gate.id}`);
            assert.ok(Array.isArray(gate.threadGateIds) && gate.threadGateIds.length >= 1 && gate.threadGateIds.length <= 3, `Invalid learning thread ${gate.id}`);
            assert.equal(new Set(gate.threadGateIds).size, gate.threadGateIds.length, `Repeated learning thread ${gate.id}`);
            for (const id of gate.threadGateIds)
                assert.ok(gates.has(id) && id !== gate.id, `Unresolved learning thread ${gate.id}: ${id}`);
            assert.ok(typeof gate.scope === 'string' && scopes.has(gate.scope), `Invalid gate scope ${gate.id}`);
            assert.equal(gate.optional, gate.scope !== 'core', `Scope optional mismatch ${gate.id}`);
            assert.ok(Array.isArray(gate.topicIds) && gate.topicIds.length >= 1 && gate.topicIds.length <= 6, `Missing topic links ${gate.id}`);
            assert.equal(new Set(gate.topicIds).size, gate.topicIds.length);
            range(gate.cf, gate.id);
            tags(gate.luoguDifficulty, gate.id);
            if (orientation) {
                assert.equal(gate.cf, undefined);
                assert.deepEqual(gate.luoguDifficulty, []);
                assert.equal(gate.kind, 'learning');
            }
            for (const id of gate.topicIds) {
                const topic = topics.get(id), source = sourceTopics.get(id);
                assert.ok(topic && source, `Unresolved topic ${id}`);
                if (orientation) {
                    assert.equal(topic.kind, 'directory');
                    assert.equal(topic.color, 'parent');
                }
                else {
                    assert.equal(topic.kind, 'algorithm', `Directory linked as algorithm ${gate.id}: ${id}`);
                    assert.ok(colors.has(topic.color), `Missing knowledge difficulty ${id}`);
                }
                assert.equal(topic.color, source.color);
                if (topic.color === 'expert')
                    assert.notEqual(gate.scope, 'core', `Expert topic in core gate ${gate.id}`);
                referenced.add(id);
            }
            const parents = gate.prerequisites?.gateIds || [];
            assert.equal(new Set(parents).size, parents.length, `Repeated gate prerequisite ${gate.id}`);
            gateEdges.set(gate.id, parents);
            for (const id of parents) {
                const before = gates.get(id);
                assert.ok(before && id !== gate.id, `Unresolved gate prerequisite ${gate.id}: ${id}`);
                if (gate.scope === 'core')
                    assert.equal(before.scope, 'core', `Optional topic blocks core gate ${gate.id}`);
            }
            for (const id of gate.prerequisites?.topicIds || [])
                assert.ok(topics.get(id)?.kind === 'algorithm', `Invalid topic prerequisite ${id}`);
            assert.equal(gate.problemIds, undefined, 'Real problem bindings must be verified separately');
            assert.equal(gate.knowledgeDifficulty, undefined, 'Knowledge difficulty must come from linked tree');
        }
    }
    acyclic(stageEdges, 'stage');
    acyclic(gateEdges, 'gate');
    const legacyIds = new Set();
    assert.equal(data.legacyFile, 'data/algorithm-learning-path-legacy.json');
    assert.ok(Array.isArray(data.legacyGates) && data.legacyGates.length > 0, 'Missing legacy gate labels');
    for (const legacy of data.legacyGates) {
        assert.ok(legacy.id && legacy.title && legacy.stageTitle);
        assert.ok(!legacyIds.has(legacy.id) && !gates.has(legacy.id), `Reused legacy gate ${legacy.id}`);
        legacyIds.add(legacy.id);
    }
    const values = [...gates.values()];
    const summary = { stages: data.stages.length, sections: data.stages.filter(stage => stage.type !== 'orientation').reduce((sum, stage) => sum + (stage.sections?.length || 0), 0), gates: gates.size, optionalGates: values.filter(gate => gate.optional).length, topicCount: referenced.size, coreGates: values.filter(gate => gate.scope === 'core').length, recommendedGates: values.filter(gate => gate.scope === 'recommended').length, electiveGates: values.filter(gate => gate.scope === 'elective').length, routeGates: values.filter(gate => gate.scope === 'route').length };
    assert.equal(summary.sections, 58, 'Approved framework has 58 sections/routes');
    assert.deepEqual(data.summary, summary);
    for (const stage of data.stages.slice(1, 12)) {
        assert.ok(Array.isArray(stage.sections), `Missing sections ${stage.id}`);
        const coreOutcomes = stage.sections.filter(section => section.scope === 'core').map(section => section.gateIds.at(-1));
        const last = gates.get(coreOutcomes.at(-1));
        assert.ok(last?.kind === 'challenge', `Missing chapter outcome ${stage.id}`);
        const reachable = new Set();
        function collect(id) { if (reachable.has(id))
            return; reachable.add(id); for (const parent of gateEdges.get(id) || [])
            collect(parent); }
        collect(last.id);
        for (const id of coreOutcomes)
            assert.ok(reachable.has(id), `Chapter outcome misses core section ${stage.id}: ${id}`);
    }
    const first = new Set(data.stages[1].gates.flatMap(gate => gate.topicIds));
    for (const id of ['xcpc-vector-1', 'algorithm-string', 'xcpc-pair-1', 'algorithm-常用算法函数与迭代器', 'xcpc-set-1', 'xcpc-map-1', 'algorithm-stack-queue', 'xcpc-priority-queue-1'])
        assert.ok(first.has(id), `STL missing from chapter one ${id}`);
    assert.ok(data.sources.every(source => /^https:\/\//.test(source.url)));
    return summary;
}
function build({ check = false } = {}) {
    const data = JSON.parse(fs.readFileSync(path.join(root, 'data/algorithm-learning-path.json'), 'utf8'));
    const tree = require('../ui/algorithm-tree.js');
    const directory = JSON.parse(fs.readFileSync(path.join(root, 'data/algorithm-directory.json'), 'utf8'));
    const summary = validate(data, tree, directory);
    const output = "'use strict';\n// Generated by tools/build-algorithm-learning-path.cjs from data/algorithm-learning-path.json.\n(function (root, factory) {\n  if (typeof module === 'object' && module.exports) module.exports = factory();\n  else root.QMX_ALGORITHM_LEARNING_PATH = factory();\n})(typeof globalThis !== 'undefined' ? globalThis : this, function () {\n  return " + JSON.stringify(data, null, 2) + ";\n});\n";
    const target = path.join(root, 'ui/algorithm-learning-path-data.js');
    if (check)
        assert.equal(fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n'), output, 'Runtime learning route differs; run node tools/build-algorithm-learning-path.cjs');
    else
        fs.writeFileSync(target, output);
    return summary;
}
if (require.main === module) {
    try {
        console.log(JSON.stringify(build({ check: process.argv.includes('--check') })));
    }
    catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
module.exports = { build, validate };
