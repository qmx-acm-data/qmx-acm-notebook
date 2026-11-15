'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const curriculum = require('../data/algorithm-learning-path.json');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-learning-v2-'));
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ autoSync: false }));
const env = { ...process.env, QMX_USER_DATA_DIR: profile }; delete env.ELECTRON_RUN_AS_NODE;
async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(root, 'build/app'), '--disable-gpu'], env });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  await page.locator('#home-panel .home-intro h2').waitFor();
  await page.waitForFunction(() => window.notebook && !['正在准备学习空间', '正在载入…'].includes(document.querySelector('#sync-status')?.textContent));
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.locator('.rail-nav-item[data-view="algorithms"]').click();
  await page.mouse.move(1300, 900);
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  await page.locator('[data-mode="path"]').click();
  return { app, page };
}
async function selectStage(page, id) {
  await page.locator('.alp-stage-picker').click();
  await page.locator(`.alp-stage-card[data-stage-id="${id}"]`).click();
}
(async () => {
  let running = await launch();
  try {
    const { page } = running;
    await selectStage(page, 'stage-01');
    assert.equal(await page.locator('.alp-checkpoint').count(), 16);
    assert.equal(await page.locator('.alp-section-chip').count(), 4);
    await page.locator('.alp-learning-button').click();
    assert.equal(await page.locator('.alp-task-card').count(), 2);
    await page.locator('[data-task="notes"] input').check();
    await page.locator('[data-task="practice"] input[type="checkbox"]').check();
    await page.locator('.alp-personal-list-button').click();
    await page.locator('.alp-task-practice-form input').fill('https://example.com/list/desktop-acceptance');
    await page.locator('.alp-task-practice-form button[type="submit"]').click();
    await page.locator('.alp-practice-link').waitFor();
    await page.locator('.alp-complete-button').click();
    await page.locator('.alp-evidence-form [name="reflection"]').fill('桌面实际学习记录：完成输入输出与边界练习。');
    await page.locator('.alp-evidence-form button[type="submit"]').click();
    await page.locator('.alp-evidence-dialog').waitFor({ state: 'hidden' });
    const saved = await page.evaluate(async () => (await window.notebook.bootstrap()).local);
    const key = Object.keys(saved.learningPaths).find(id => JSON.parse(id)[2] === 'xcpc-breadth-first-v1');
    assert.ok(key);
    assert.equal(saved.learningPaths[key].gates[curriculum.stages[1].gates[0].id].status, 'completed');
    const stage = curriculum.stages[12];
    const route = stage.sections.find(section => section.scope === 'route');
    const routeIds = stage.gates.filter(gate => gate.routeId === route.routeId && gate.scope === 'route').map(gate => gate.id);
    await page.evaluate(async ({ key, coreIds, routeIds }) => {
      const local = (await window.notebook.bootstrap()).local;
      const gates = local.learningPaths[key].gates;
      gates['stage-01-gate-02'] = { status: 'completed', reflection: '旧关卡历史不能错配', opaque: { keep: true } };
      for (const id of [...coreIds, ...routeIds]) gates[id] = { ...gates[id], status: 'completed', reflection: '独立验收成果' };
      await window.notebook.updateLocal(local);
    }, { key, coreIds: [...curriculum.stages[1].gates, ...curriculum.stages[14].gates].filter(gate => gate.scope === 'core').map(gate => gate.id), routeIds });
    await running.app.close(); running = await launch();
    const restored = running.page;
    await selectStage(restored, 'stage-01');
    assert.equal(await restored.locator('.alp-history').count(), 1);
    const firstGate = curriculum.stages[1].gates[0].id;
    await restored.locator(`.alp-checkpoint[data-gate-id="${firstGate}"]`).click();
    const persisted = await restored.evaluate(async () => (await window.notebook.bootstrap()).local);
    assert.equal(persisted.learningPaths[key].gates[firstGate].tasks.notes, true);
    assert.equal(persisted.learningPaths[key].gates[firstGate].tasks.practice, true);
    assert.equal(persisted.learningPaths[key].gates[firstGate].practiceUrl, 'https://example.com/list/desktop-acceptance');
    assert.match(await restored.locator('.alp-selected-stage-copy').innerText(), /核心 16 \/ 16/);
    await restored.screenshot({ path: path.join(root, 'release/learning-path-v2-desktop.png') });
    await selectStage(restored, 'stage-12');
    assert.match(await restored.locator('.alp-selected-stage-copy').innerText(), /1 \/ 4 条路线基础完成/);
    assert.equal(await restored.locator('.alp-section-chip').count(), 4);
    await restored.screenshot({ path: path.join(root, 'release/learning-path-v2-routes.png') });
    await selectStage(restored, 'stage-14');
    const coreCount = curriculum.stages[14].gates.filter(gate => gate.scope === 'core').length;
    assert.match(await restored.locator('.alp-selected-stage-copy').innerText(), new RegExp(`核心 ${coreCount} / ${coreCount}`), 'chapter fourteen finishes through its selected direction outcome, without forcing every advanced route');
    const local = await restored.evaluate(async () => (await window.notebook.bootstrap()).local);
    assert.deepEqual(local.learningPaths[key].gates['stage-01-gate-02'].opaque, { keep: true });
    console.log('PASS real Electron learning route: real preload/local IPC, disk persistence and restart, core completion, route-by-route progress, preserved legacy metadata; isolated temporary profile');
  } finally { await running.app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
