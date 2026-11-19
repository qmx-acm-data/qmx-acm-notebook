'use strict';

// Real Electron preload/local IPC; isolated profile and no account or remote writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron } = require('playwright');
const { appPath } = require('./app-path.cjs');
const curriculum = require(appPath('ui/algorithm-learning-path-data.js'));
const repo = 'test/roadmap-desktop';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-roadmap-desktop-'));
const legacyKey = JSON.stringify([repo, 'anonymous', curriculum.id]);
const key = JSON.stringify([`https://api.github.com|${repo}`, 'anonymous', curriculum.id]);
const gates = {
  'stage-01-gate-01': { status: 'completed', reflection: '桌面旧关卡成果', tasks: { notes: true, practice: true }, practiceUrl: 'https://example.invalid/legacy', opaque: { keep: [null, 0, false] } },
  [curriculum.stages[0].gates[0].id]: { status: 'completed', reflection: '当前课程记录仍保留', unknown: 0 },
};
const initialProgress = { gates, stageId: 'stage-01', gateId: 'stage-01-gate-01', unknownRoot: { keep: true } };
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ repo, autoSync: false, checkUpdates: false }));
fs.writeFileSync(path.join(profile, 'local.json'), JSON.stringify({ records: [], favorites: ['retained'], mastery: { preserve: 0 }, draft: {}, learningPaths: { [legacyKey]: initialProgress, 'other-account-source': { gates: {}, opaque: true } } }));
const env = { ...process.env, QMX_USER_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
const errors = [];
async function launch() {
  const app = await electron.launch({ executablePath: require('electron'), args: [appPath(''), '--disable-gpu'], env });
  const page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#home-panel .home-intro h2').waitFor();
  await page.waitForFunction(() => window.notebook && !['正在准备学习空间', '正在载入…'].includes(document.querySelector('#sync-status')?.textContent));
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.locator('.rail-nav-item[data-view="algorithms"]').click();
  await page.mouse.move(1300, 900);
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  assert.equal(await page.locator('[data-mode="path"]').innerText(), '学习路线');
  await page.locator('[data-mode="path"]').click();
  await page.locator('.arm').waitFor();
  return { app, page };
}
async function focus(page, id) {
  await page.locator(`.arm-node[data-node="${id}"]`).click();
  await page.locator('.arm-focus-button').click();
  await page.waitForFunction(id => document.querySelector(`.arm-node[data-node="${id}"]`)?.dataset.focused === 'true' && !document.querySelector('.arm-focus-button')?.disabled, id);
  await page.keyboard.press('Escape');
}
async function assertLocal(page, focusId) {
  const state = await page.evaluate(async () => window.notebook.bootstrap());
  assert.equal(state.account, null, 'real preload remains anonymous');
  assert.equal(state.local.learningPaths[key].roadmapFocus, focusId);
  assert.deepEqual(state.local.learningPaths[key].gates, gates, 'focus preserves all old completed gate/task/list metadata');
  assert.deepEqual(state.local.learningPaths[legacyKey], initialProgress, 'legacy progress key remains intact');
  assert.deepEqual(state.local.learningPaths[key].unknownRoot, initialProgress.unknownRoot);
  assert.deepEqual(state.local.learningPaths['other-account-source'], { gates: {}, opaque: true });
  assert.deepEqual(state.local.favorites, ['retained']);
  assert.deepEqual(state.local.mastery, { preserve: 0 });
  return state.local;
}
(async () => {
  let running;
  try {
    running = await launch();
    assert.equal(await running.page.locator('.arm-node').count(), 33);
    assert.equal(await running.page.locator('.arm-edge').count(), 38);
    assert.equal(await running.page.locator('.alp-complete-button, .alp-checkpoint, .alp-task-card').count(), 0);
    await focus(running.page, 'g');
    await assertLocal(running.page, 'g');
    const disk = JSON.parse(fs.readFileSync(path.join(profile, 'local.json'), 'utf8'));
    assert.equal(disk.learningPaths[key].roadmapFocus, 'g', 'real updateLocal writes attention to disk');
    assert.deepEqual(disk.learningPaths[key].gates, gates);
    await running.app.close(); running = undefined;
    running = await launch();
    assert.equal(await running.page.locator('.arm-node[data-node="g"]').getAttribute('data-focused'), 'true', 'actual process restart restores focus');
    await assertLocal(running.page, 'g');
    // Exercise the real bridge again, keeping the UI callback as the writer.
    await focus(running.page, 'hs');
    await assertLocal(running.page, 'hs');
    await running.app.close(); running = undefined;
    // Switching source config while the app is closed avoids any network/login fixture.
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ repo, serverUrl: 'https://git.example.invalid', autoSync: false, checkUpdates: false }));
    running = await launch();
    assert.equal(await running.page.locator('.arm-position').count(), 0, 'other source does not inherit focus');
    await focus(running.page, 'sz');
    const other = await running.page.evaluate(async () => (await window.notebook.bootstrap()).local);
    const otherKey = JSON.stringify([`https://git.example.invalid|${repo}`, 'anonymous', curriculum.id]);
    assert.equal(other.learningPaths[otherKey].roadmapFocus, 'sz');
    assert.equal(other.learningPaths[key].roadmapFocus, 'hs');
    assert.deepEqual(other.learningPaths[key].gates, gates);
    await running.app.close(); running = undefined;
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ repo, autoSync: false, checkUpdates: false }));
    running = await launch();
    assert.equal(await running.page.locator('.arm-node[data-node="hs"]').getAttribute('data-focused'), 'true');
    await assertLocal(running.page, 'hs');
    assert.deepEqual(errors, [], 'no real renderer errors');
    console.log('PASS learning roadmap desktop: real anonymous preload, focus UI callback -> updateLocal -> disk, process restarts, source isolation/recovery, preserved completed gates/task/practice/opaque metadata, no auth or remote writes; temporary profile');
  } finally { if (running) await running.app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
