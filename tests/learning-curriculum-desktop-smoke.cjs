'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { _electron: electron } = require('playwright');
const { appPath } = require('./app-path.cjs');
const base = require(appPath('ui/algorithm-learning-path-data.js'));
const repo = 'test/curriculum-desktop', sourceKey = `https://api.github.com|${repo}`;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-curriculum-desktop-'));
const layout = { stages: base.stages.map(stage => ({ id: stage.id, title: stage.title, gates: stage.gates.map(gate => ({ id: gate.id, title: gate.title, kind: gate.kind, sectionId: gate.sectionId, scope: gate.scope })) })) };
const removedId = layout.stages[1].gates.shift().id;
const customId = 'custom-e94b5b30-8d17-40a9-8cad-e56ff39a63ec';
layout.stages[1].title = '桌面测试：已编排章节';
layout.stages[1].gates.reverse();
layout.stages[1].gates.unshift({ id: customId, title: '桌面测试：新增混练', kind: 'mixed', scope: 'core', sectionId: base.stages[1].sections[0].id, description: '离线恢复公共课程编排', goals: ['完成一次独立混练'], topicIds: ['root'] });
const document = { layout, sha: 'a'.repeat(40), updatedAt: '2026-11-16T10:00:00Z', author: { id: 42, login: 'test-admin' }, repo, serverUrl: '', sourceKey };
const cache = { repo, learningCurriculum: document, records: [], issues: [], algorithmNotes: [], algorithmTopics: [], learningGateContents: [] };
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ repo, autoSync: false }));
fs.writeFileSync(path.join(profile, 'cache.json'), JSON.stringify({ ...cache, repos: { [sourceKey]: cache } }));
const env = { ...process.env, QMX_USER_DATA_DIR: profile }; delete env.ELECTRON_RUN_AS_NODE;
async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [appPath(''), '--disable-gpu'], env });
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  await page.locator('#home-panel .home-intro h2').waitFor();
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.locator('.rail-nav-item[data-view="algorithms"]').click();
  await page.mouse.move(1300, 900);
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  await page.locator('[data-mode="path"]').click();
  await page.locator('.alp-stage-picker').click(); await page.locator('[data-stage-id="stage-01"]').click();
  return { app, page };
}
(async () => {
  let running = await launch();
  try {
    const { page } = running;
    assert.equal(await page.locator('.alp-curriculum-edit-button').count(), 0, 'real signed-out preload receives no admin entry');
    assert.match(await page.locator('.alp-selected-stage-copy').innerText(), /已编排章节/);
    assert.deepEqual(await page.locator('.alp-checkpoint').evaluateAll(nodes => nodes.map(node => node.dataset.gateId)), layout.stages[1].gates.map(gate => gate.id));
    await page.locator(`[data-gate-id="${customId}"]`).click(); await page.locator('.alp-learning-button').click();
    assert.equal(await page.locator('.alp-task-card').count(), 1);
    await page.evaluate(async ({ removedId, baseId }) => {
      const state = await window.notebook.bootstrap(), local = state.local;
      const progressKey = Object.keys(local.learningPaths).find(id => JSON.parse(id)[2] === baseId);
      local.learningPaths[progressKey].gates[removedId] = { status: 'completed', reflection: '移除后保留的桌面记录', opaque: { keep: true } };
      await window.notebook.updateLocal(local);
    }, { removedId, baseId: base.id });
    await running.app.close(); running = await launch();
    assert.match(await running.page.locator('.alp-history').innerText(), /历史学习记录/);
    const state = await running.page.evaluate(async () => window.notebook.bootstrap());
    assert.equal(state.learningCurriculum.layout.stages[1].gates[0].id, customId);
    const progress = Object.values(state.local.learningPaths).find(value => value.gates[removedId]);
    assert.deepEqual(progress.gates[removedId].opaque, { keep: true });
    console.log('PASS real Electron curriculum: public layout through real preload/cache, ordered custom mixed gate, admin entry hidden, deleted progress preserved, restart recovery; isolated test profile');
  } finally { await running.app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
