'use strict';
// Browser integration against build/app. Every note, account and practice list is a local test fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

const storageKey = 'learning-tasks-test-local';
const listUrl = 'https://example.com/list/learning-tasks-personal';
const fixtureUrl = 'https://example.com/list/learning-tasks-configured';
const legacyUrl = 'https://example.com/list/learning-tasks-evidence';
const noteTitle = '测试笔记：竞赛学习任务与复盘';
const orientationId = require('../data/algorithm-learning-path.json').stages[0].gates[0].id;

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ storageKey, noteTitle, fixtureUrl, orientationId }) => {
      let local = JSON.parse(localStorage.getItem(storageKey) || '{"records":[],"favorites":[],"mastery":{},"draft":{}}');
      window.__tasksFailSave = false;
      window.__tasksSaveCalls = 0;
      window.__tasksRemoteWrites = 0;
      window.__tasksExternalCalls = [];
      window.__tasksPublicFail = false; window.__tasksPublicCalls = [];
      const initialContent = { gateId: orientationId, description: '测试公共简介：认识竞赛并规划学习任务。', goals: ['测试公共目标：完成导览并安排练习'], practiceList: { title: '测试官方题单：配置示例', url: fixtureUrl }, sha: 'a'.repeat(40), updatedAt: '2026-11-15T05:00:00Z', author: { id: 7, login: 'test-admin' } };
      let contents = JSON.parse(localStorage.getItem('learning-tasks-public-contents') || JSON.stringify([initialContent]));
      window.__tasksAccount = { id: Number(sessionStorage.getItem('learning-tasks-account') || 42), login: 'tasks-test-learner' };
      const notes = [{ id: 'learning-tasks-public-note', nodeId: 'directory-contest-experience', noteScope: 'public', kind: 'algorithm-note', featured: true, title: noteTitle, author: 'test-author', updatedAt: '2026-11-15', body: '# 仅用于测试的学习笔记\n\n阅读笔记，再完成测试题单，最后自行记录任务。' }];
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], algorithmNotes: notes, learningGateContents: structuredClone(contents), settings: { repo: 'test/learning-tasks', autoSync: false }, permissions: { repo: 'test/learning-tasks', push: sessionStorage.getItem('learning-tasks-admin') === 'true', admin: sessionStorage.getItem('learning-tasks-admin') === 'true' }, account: window.__tasksAccount, local: structuredClone(local) }),
        saveLearningGate: async input => {
          window.__tasksPublicCalls.push(structuredClone(input));
          if (window.__tasksPublicFail) throw Error('test public save failed');
          if (sessionStorage.getItem('learning-tasks-admin') !== 'true') throw Error('admin required');
          const saved = { ...input, sha: 'b'.repeat(40), updatedAt: '2026-11-15T06:00:00Z', author: { id: 42, login: 'test-admin' } };
          contents = [...contents.filter(content => content.gateId !== input.gateId), saved]; localStorage.setItem('learning-tasks-public-contents', JSON.stringify(contents)); return structuredClone(saved);
        },
        updateLocal: async value => {
          window.__tasksSaveCalls++;
          if (window.__tasksFailSave) throw Error('test task persistence failed');
          local = structuredClone(value);
          localStorage.setItem(storageKey, JSON.stringify(local));
        },
        openExternal: async url => { window.__tasksExternalCalls.push(url); },
        saveAlgorithmNote: async () => { window.__tasksRemoteWrites++; throw Error('Remote writes are forbidden in this test'); },
        saveRecord: async () => { window.__tasksRemoteWrites++; throw Error('Remote writes are forbidden in this test'); }
      };
    }, { storageKey, noteTitle, fixtureUrl, orientationId });

    async function openPath({ reload = false } = {}) {
      if (reload) await page.reload();
      else await page.goto(pathToFileURL(appPath('ui/index.html')).href);
      await page.locator('.rail-nav-item[data-view="algorithms"]').click();
      await page.mouse.move(1300, 800);
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
      // Fixture-only configured list, plus an invalid list that must never render/open.
      // One existing gate is marked mixed to cover that branch alongside a real challenge gate.
      await page.evaluate(({ fixtureUrl }) => {
        const data = window.QMX_ALGORITHM_LEARNING_PATH;
        data.stages[0].gates[0].practiceLists = [{ title: '不应显示的第二官方链接', url: 'https://example.com/list/ignored-second' }, { title: '不应显示的无效测试链接', url: 'javascript:alert(1)' }];
        data.stages[1].gates[1].kind = 'mixed';
      }, { fixtureUrl });
      await page.locator('[data-mode="path"]').click();
      await page.locator('.alp-gate-title').waitFor();
    }
    async function selectStage(id) {
      await page.locator('.alp-stage-picker').click();
      await page.locator(`.alp-stage-card[data-stage-id="${id}"]`).click();
    }
    async function selectGate(id) {
      await page.locator(`.alp-checkpoint[data-gate-id="${id}"]`).click();
    }
    async function savedProgress(account = 42) {
      return page.evaluate(({ storageKey, account }) => {
        const local = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const entry = Object.entries(local.learningPaths || {}).find(([key]) => String(JSON.parse(key)[1]) === String(account));
        return entry ? { key: entry[0], value: entry[1], local } : null;
      }, { storageKey, account });
    }
    async function savedGate(id, account = 42) {
      return (await savedProgress(account))?.value.gates[id];
    }
    async function waitSaved() {
      await page.waitForFunction(() => document.querySelector('.alp')?.dataset.saving === 'false');
    }
    const task = name => page.locator(`.alp-task-card[data-task="${name}"] input[type="checkbox"]`);
    const practiceInput = () => page.getByRole('textbox', { name: '对应题单链接', exact: true });
    const practiceSubmit = () => page.locator('.alp-task-practice-form button[type="submit"]');
    async function editPersonal() { await page.locator('.alp-personal-list-button').click(); await page.locator('.alp-personal-dialog').waitFor(); }
    async function savePersonal(url) { await editPersonal(); await practiceInput().fill(url); await practiceSubmit().click(); await page.locator('.alp-personal-dialog').waitFor({ state: 'hidden' }); }
    async function closePersonal() { await page.locator('.alp-personal-dialog .alp-dialog-close').click(); await page.locator('.alp-personal-dialog').waitFor({ state: 'hidden' }); }

    await openPath();
    const gates = await page.evaluate(() => ({ orientation: window.QMX_ALGORITHM_LEARNING_PATH.stages[0].gates[0], learning: window.QMX_ALGORITHM_LEARNING_PATH.stages[1].gates[0], mixed: window.QMX_ALGORITHM_LEARNING_PATH.stages[1].gates[1], challenge: window.QMX_ALGORITHM_LEARNING_PATH.stages[1].gates.find(gate => gate.kind === 'challenge') }));
    assert.equal(await page.locator('.alp-task-list').count(), 0, 'tasks appear after beginning a gate');
    assert.equal(await page.locator('.alp-official-list').isVisible(), true, 'official recommendation is visible before starting');
    fs.mkdirSync(path.resolve(__dirname, '../release'), { recursive: true });
    await page.screenshot({ path: path.resolve(__dirname, '../release/learning-official-default.png') });
    await page.locator('.alp-official-list').click();
    assert.equal(await page.evaluate(() => window.__tasksExternalCalls.at(-1)), fixtureUrl);
    assert.equal(await page.locator('.alp-official-add-button').count(), 0, 'reader cannot edit official recommendation');
    await page.evaluate(() => sessionStorage.setItem('learning-tasks-admin', 'true'));
    await openPath({ reload: true }); await selectStage('stage-01');
    assert.equal(await page.locator('.alp-task-list').count(), 0);
    assert.match(await page.locator('.alp-official-empty').innerText(), /尚未发布/);
    await page.screenshot({ path: path.resolve(__dirname, '../release/learning-official-admin-default.png') });
    await page.locator('.alp-official-add-button').click();
    await page.locator('.alp-public-dialog').waitFor();
    assert.equal(await page.locator('.alp-public-form [name="practiceTitle"]').evaluate(element => element === document.activeElement), true);
    await page.locator('.alp-public-dialog .alp-dialog-close').click();
    await page.evaluate(() => sessionStorage.setItem('learning-tasks-admin', 'false'));
    await openPath({ reload: true }); await selectStage('stage-00');
    assert.equal(await page.locator('.alp-note strong').innerText(), noteTitle, 'unstarted learning still offers the real note');
    await page.locator('.alp-learning-button').click();
    await page.locator('.alp-task-list').waitFor();
    assert.equal(await page.locator('.alp-task-card').count(), 2);
    assert.equal(await task('notes').isChecked(), false);
    assert.equal(await task('practice').isChecked(), false);
    assert.match(await page.locator('.alp-task-heading').innerText(), /0 \/ 2/);
    assert.equal((await savedGate(gates.orientation.id)).status, 'learning');

    // Actual host note callback opens the reader and its gate breadcrumb returns to the same tasks.
    await page.locator('.alp-task-card[data-task="notes"] .alp-note').click();
    assert.equal(await page.locator('.alg-reading-title').innerText(), noteTitle);
    await page.locator('.reading-detail-path:visible button').filter({ hasText: gates.orientation.title }).click();
    await page.locator('.alp-task-list').waitFor();
    assert.equal(await page.locator('.alp-gate-title').innerText(), gates.orientation.title);
    assert.equal(await page.locator('.alp-task-card[data-task="notes"] .alp-note').count(), 1);

    // Seed historical unknown metadata only in mocked local storage, then reload the app boundary.
    await page.evaluate(({ storageKey, id, legacyUrl }) => {
      const local = JSON.parse(localStorage.getItem(storageKey));
      const key = Object.keys(local.learningPaths)[0];
      local.learningPaths[key].opaqueProgress = { keep: 'progress' };
      local.learningPaths[key].gates[id] = { ...local.learningPaths[key].gates[id], problemUrl: legacyUrl, reflection: '原有完成记录', opaqueGate: { keep: ['gate', false] }, tasks: { opaqueTask: { keep: 'task' } } };
      localStorage.setItem(storageKey, JSON.stringify(local));
    }, { storageKey, id: gates.orientation.id, legacyUrl });
    await openPath({ reload: true });
    assert.equal(await page.locator('.alp-personal-dialog').isVisible(), false);
    await editPersonal(); assert.equal(await practiceInput().inputValue(), '', 'practiceUrl remains independent of legacy problemUrl'); await closePersonal();
    await page.locator('.alp-practice-link').filter({ hasText: '我的练习题单' }).click();
    assert.deepEqual(await page.evaluate(() => window.__tasksExternalCalls), [legacyUrl]);

    // Checkbox rejection restores both visual and persisted state, and retry retains unknown fields.
    const beforeFailure = await savedGate(gates.orientation.id);
    await page.evaluate(() => { window.__tasksFailSave = true; });
    await task('notes').click();
    await page.locator('.alp-learning-panel .alp-inline-error').waitFor();
    assert.equal(await task('notes').isChecked(), false, 'rejected checkbox returns to saved state');
    assert.deepEqual(await savedGate(gates.orientation.id), beforeFailure);
    await page.evaluate(() => { window.__tasksFailSave = false; });
    await task('notes').check(); await waitSaved();
    assert.equal(await task('notes').isChecked(), true);
    assert.equal((await savedGate(gates.orientation.id)).tasks.notes, true);
    await task('practice').check(); await waitSaved();
    assert.match(await page.locator('.alp-task-heading').innerText(), /2 \/ 2/);
    assert.equal((await savedGate(gates.orientation.id)).status, 'learning', 'tasks do not silently claim automatic judging/completion');

    // Reject non-HTTP(S) and credential-bearing links before persistence or external opening.
    await editPersonal();
    const callsBeforeInvalid = await page.evaluate(() => window.__tasksSaveCalls);
    for (const url of ['ftp://example.com/list/invalid', 'javascript:alert(1)', 'https://user:pass@example.com/list/invalid']) {
      await practiceInput().fill(url); await practiceSubmit().click();
      await page.locator('.alp-task-practice-form .alp-inline-error').waitFor();
      assert.match(await page.locator('.alp-task-practice-form .alp-inline-error').innerText(), /HTTP|HTTPS/);
    }
    assert.equal(await page.evaluate(() => window.__tasksSaveCalls), callsBeforeInvalid);
    assert.equal(await page.getByText('不应显示的无效测试链接', { exact: true }).count(), 0);

    await practiceInput().fill(listUrl);
    await page.evaluate(() => { window.__tasksFailSave = true; });
    await practiceSubmit().click();
    await page.locator('.alp-task-practice-form .alp-inline-error').waitFor();
    assert.equal((await savedGate(gates.orientation.id)).practiceUrl, undefined, 'failed URL save does not leak into stored progress');
    await page.evaluate(() => { window.__tasksFailSave = false; });
    await practiceSubmit().click(); await page.locator('.alp-personal-dialog').waitFor({ state: 'hidden' }); await waitSaved();
    assert.equal((await savedGate(gates.orientation.id)).practiceUrl, listUrl);
    assert.equal((await savedGate(gates.orientation.id)).problemUrl, legacyUrl);
    await page.locator('.alp-practice-link').filter({ hasText: '我的练习题单' }).click();
    await page.locator('.alp-practice-link').filter({ hasText: '测试官方题单：配置示例' }).click();
    assert.deepEqual(await page.evaluate(() => window.__tasksExternalCalls), [legacyUrl, listUrl, fixtureUrl], 'configured and personal links use the real app host callback');
    // HTTP is supported too, without touching the independent evidence URL.
    const httpUrl = 'http://example.com/list/learning-tasks-http';
    await savePersonal(httpUrl); await waitSaved();
    assert.equal((await savedGate(gates.orientation.id)).practiceUrl, httpUrl);
    await savePersonal(listUrl); await waitSaved();

    // Existing completion editing must preserve task bits, list URL and unknown metadata.
    await page.locator('.alp-complete-button').click();
    await page.locator('.alp-evidence-form [name="reflection"]').fill('测试完成记录：笔记与题单分别记录');
    await page.locator('.alp-evidence-form button[type="submit"]').click();
    await page.locator('.alp-evidence-dialog').waitFor({ state: 'hidden' });
    await page.locator('.alp-complete-button').click();
    await page.locator('.alp-evidence-form [name="reflection"]').fill('测试完成记录：再次编辑后任务仍保留');
    await page.locator('.alp-evidence-form button[type="submit"]').click();
    await page.locator('.alp-evidence-dialog').waitFor({ state: 'hidden' });
    const completed = await savedGate(gates.orientation.id);
    assert.equal(completed.status, 'completed');
    assert.deepEqual(completed.tasks, { opaqueTask: { keep: 'task' }, notes: true, practice: true });
    assert.deepEqual(completed.opaqueGate, { keep: ['gate', false] });
    assert.equal(completed.practiceUrl, listUrl);
    assert.equal(completed.problemUrl, legacyUrl);
    const saved = await savedProgress();
    assert.deepEqual(saved.value.opaqueProgress, { keep: 'progress' });

    await openPath({ reload: true });
    assert.equal(await task('notes').isChecked(), true);
    assert.equal(await task('practice').isChecked(), true);
    await editPersonal(); assert.equal(await practiceInput().inputValue(), listUrl); await closePersonal();
    assert.match(await page.locator('.alp-saved-reflection').innerText(), /再次编辑后任务仍保留/);

    // Real chapter gate without public notes offers knowledge navigation; practice remains independent.
    await selectStage('stage-01'); await selectGate(gates.learning.id);
    await page.locator('.alp-learning-button').click();
    await page.locator('.alp-task-list').waitFor();
    assert.equal(await page.locator('.alp-task-card').count(), 2);
    const knowledgeId = gates.learning.topicIds[0];
    await page.locator('.alp-task-topic-links .alp-topic-link').first().click();
    assert.equal(await page.locator('.alg-tree-item[aria-selected="true"]').getAttribute('data-node-id'), knowledgeId);
    await page.getByRole('button', { name: '在学习路径中查看 →', exact: true }).click();
    await page.locator('.alp-task-list').waitFor();
    for (const gate of [gates.mixed, gates.challenge]) {
      await selectGate(gate.id);
      assert.equal(await page.locator('.alp-task-list').count(), 0);
      await page.locator('.alp-learning-button').click();
      await page.locator('.alp-task-list').waitFor();
      assert.equal(await page.locator('.alp-task-card').count(), 1, `${gate.kind} only has a practice task`);
      assert.equal(await page.locator('.alp-task-card[data-task="notes"]').count(), 0);
      await task('practice').check(); await waitSaved();
      assert.equal((await savedGate(gate.id)).tasks.practice, true);
      assert.equal((await savedGate(gate.id)).tasks.notes, undefined);
    }

    // Another account starts fresh; returning to the original account restores its own task state.
    await page.evaluate(() => sessionStorage.setItem('learning-tasks-account', '99'));
    await openPath({ reload: true }); await selectStage('stage-00');
    assert.equal(await page.locator('.alp-task-list').count(), 0);
    await page.locator('.alp-learning-button').click();
    await page.locator('.alp-task-list').waitFor();
    assert.equal(await task('notes').isChecked(), false);
    await editPersonal(); assert.equal(await practiceInput().inputValue(), ''); await closePersonal();
    await task('notes').check(); await waitSaved();
    assert.equal((await savedGate(gates.orientation.id, 99)).tasks.notes, true);
    assert.equal((await savedGate(gates.orientation.id, 99)).tasks.practice, undefined);
    assert.equal((await savedGate(gates.orientation.id, 42)).tasks.practice, true);
    await page.evaluate(() => sessionStorage.setItem('learning-tasks-account', '42'));
    await openPath({ reload: true }); await selectStage('stage-00');
    assert.equal(await task('practice').isChecked(), true);
    await editPersonal(); assert.equal(await practiceInput().inputValue(), listUrl); await closePersonal();

    assert.equal(await page.locator('.alp-public-edit-button,.alp-official-add-button').count(), 0, 'readers never receive public editing controls');
    assert.equal(await page.locator('.alp-share-button,.alp-share-dialog').count(), 0);
    assert.equal(await page.getByText('暂无关联笔记，可先打开对应知识点学习。', { exact: true }).count(), 0);
    assert.equal(await page.locator('.alp-official-list').count(), 1);
    assert.match(await page.locator('.alp-learning-story').innerText(), /测试公共简介/);
    assert.match(await page.locator('.alp-core-goals').innerText(), /测试公共目标/);
    await page.evaluate(() => sessionStorage.setItem('learning-tasks-admin', 'true'));
    await openPath({ reload: true }); await selectStage('stage-00');
    await page.locator('.alp-detail-open-button').click();
    await page.locator('.alp-public-edit-button').click();
    const publicForm = page.locator('.alp-public-form');
    await publicForm.locator('[name="description"]').fill('测试发布简介 <img src=x onerror=alert(1)>');
    await publicForm.locator('[name="goals"]').fill('测试发布目标一\n测试发布目标二');
    await publicForm.locator('[name="practiceTitle"]').fill('测试官方题单：新公共版');
    await publicForm.locator('[name="practiceUrl"]').fill('https://example.com/list/published-public');
    assert.match(await page.locator('.alp-public-preview').innerText(), /测试发布目标二/);
    assert.equal(await page.locator('.alp-public-preview img').count(), 0);
    await page.evaluate(() => { window.__tasksPublicFail = true; });
    await publicForm.locator('button[type="submit"]').click();
    await page.locator('.alp-public-form .alp-inline-error').waitFor();
    assert.equal(await publicForm.locator('[name="practiceTitle"]').inputValue(), '测试官方题单：新公共版');
    assert.match(await page.locator('.reading-expanded .alp-learning-story').innerText(), /测试公共简介/);
    await page.evaluate(() => { window.__tasksPublicFail = false; });
    await publicForm.locator('[name="description"]').fill('测试发布简介：认识竞赛流程，安排笔记学习与题单练习。');
    await publicForm.locator('button[type="submit"]').click();
    await page.locator('.alp-public-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.reading-detail-view:visible').count(), 1);
    assert.match(await page.locator('.reading-expanded .alp-learning-story').innerText(), /测试发布简介/);
    assert.equal(await page.locator('.reading-expanded .alp-official-list').count(), 1);
    assert.match(await page.locator('.reading-expanded .alp-official-list').innerText(), /新公共版/);
    assert.equal(await page.locator('.alp-public-edit-button').evaluate(element => element === document.activeElement), true);
    assert.equal(await page.evaluate(() => window.__tasksPublicCalls.at(-1).sha), 'a'.repeat(40));
    await page.locator('.alp-public-edit-button').click();
    fs.mkdirSync(path.resolve(__dirname, '../release'), { recursive: true });
    await page.setViewportSize({ width: 1500, height: 1400 });
    await page.locator('.alp-public-dialog').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: path.resolve(__dirname, '../release/learning-public-editor.png') });
    await page.locator('.alp-public-dialog .alp-dialog-close').click();
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.keyboard.press('Escape');
    await page.evaluate(() => sessionStorage.setItem('learning-tasks-admin', 'false'));
    await openPath({ reload: true }); await selectStage('stage-00');
    assert.equal(await page.locator('.alp-public-edit-button,.alp-official-add-button').count(), 0);
    assert.match(await page.locator('.alp-learning-story').innerText(), /测试发布简介/);
    assert.match(await page.locator('.alp-official-list').innerText(), /新公共版/);
    fs.mkdirSync(path.resolve(__dirname, '../release'), { recursive: true });
    await page.locator('.alp-detail-open-button').click();
    for (const theme of ['light', 'dark', 'cards']) {
      await page.evaluate(theme => { document.body.dataset.theme = theme; }, theme);
      await page.locator('.reading-expanded .alp-task-list').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('.reading-expanded .alp-task-list').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${theme} tasks overflow`);
      await page.screenshot({ path: path.resolve(__dirname, `../release/learning-tasks-${theme}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.reading-expanded .alp-task-card[data-task="practice"]').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390px page overflow');
    assert.ok(await page.locator('.reading-expanded .alp-task-list').evaluate(element => element.scrollWidth <= element.clientWidth + 1), '390px task overflow');
    assert.equal(await page.locator('.alp-personal-dialog').isVisible(), false);
    await page.locator('.alp-personal-list-button').click(); assert.ok(await practiceInput().isVisible());
    assert.ok(await page.locator('.alp-personal-dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1)); await closePersonal();
    await page.screenshot({ path: path.resolve(__dirname, '../release/learning-tasks-mobile.png') });
    assert.equal(await page.evaluate(() => window.__tasksRemoteWrites), 0);
    assert.deepEqual(errors, []);
    console.log('PASS learning tasks: start, notes callback/knowledge return, learning vs mixed/challenge, independent checkbox/list persistence, HTTP(S) validation, host links, failure rollback/retry, completion edits, unknown metadata, reload/account isolation, 3 themes/390px; only mocked test lists and no remote writes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
