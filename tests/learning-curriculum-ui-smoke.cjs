'use strict';
// Full application integration with local fixtures only; no GitHub/remote calls are made.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');
const base = require('../data/algorithm-learning-path.json');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1050 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ base }) => {
      const layout = () => ({ stages: base.stages.map(stage => ({ id: stage.id, title: stage.title, gates: stage.gates.map(gate => ({ id: gate.id, title: gate.title, kind: ['mixed', 'challenge'].includes(gate.kind) ? gate.kind : 'learning', sectionId: gate.sectionId || '', scope: gate.scope || (gate.optional ? 'elective' : 'core') })) })) });
      window.__curriculumCalls = []; window.__curriculumOtherWrites = 0; window.__curriculumFail = false; window.__curriculumHold = false;
      let stored = JSON.parse(localStorage.getItem('curriculum-smoke-document') || 'null');
      const fixture = sessionStorage.getItem('curriculum-smoke-limit');
      if (fixture) {
        const draft = layout();
        // Populate using UUIDs and real sections; test limits without hundreds of UI clicks.
        let remaining = fixture === 'total' ? 1000 : 0;
        draft.stages.forEach((stage, stageIndex) => {
          const target = fixture === 'chapter' ? (stageIndex === 1 ? 100 : stage.gates.length) : Math.min(100, remaining - (draft.stages.length - stageIndex - 1));
          while (stage.gates.length > target) stage.gates.pop();
          while (stage.gates.length < target) stage.gates.push({ id: `custom-${crypto.randomUUID()}`, title: `测试数量关卡 ${stage.gates.length + 1}`, kind: 'learning', sectionId: stage.gates[0]?.sectionId || '', scope: stage.gates[0]?.scope || 'core', description: '', goals: [], topicIds: [] });
          remaining -= stage.gates.length;
        });
        stored = { layout: draft, sha: 'c'.repeat(40), updatedAt: '2026-11-16T12:00:00Z', author: { id: 17, login: 'fixture-admin' } };
      }
      const progressKey = JSON.stringify(['fixture/curriculum-only', '17', base.id]);
      let local = { records: [], favorites: [], mastery: {}, draft: {}, opaqueCurriculumTest: { keep: true }, learningPaths: { [progressKey]: { stageId: base.stages[1].id, gateId: base.stages[1].gates[0].id, gates: { [base.stages[1].gates[1].id]: { status: 'completed', reflection: '测试历史完成记录', opaqueProgress: { keep: true } } } } } };
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], algorithmNotes: [], learningGateContents: [], learningCurriculum: structuredClone(stored), settings: { repo: 'fixture/curriculum-only', autoSync: false }, permissions: { repo: 'fixture/curriculum-only', push: sessionStorage.getItem('curriculum-smoke-admin') === 'true', admin: sessionStorage.getItem('curriculum-smoke-admin') === 'true' }, account: { id: 17, login: 'fixture-admin' }, local: structuredClone(local) }),
        saveLearningCurriculum: async input => {
          window.__curriculumCalls.push(structuredClone(input));
          if (sessionStorage.getItem('curriculum-smoke-admin') !== 'true') throw Error('管理员权限不足');
          if (window.__curriculumHold) await new Promise(resolve => { window.__curriculumRelease = resolve; });
          if (window.__curriculumFail) throw Error('测试发布失败，请保留草稿');
          stored = { ...input, sha: 'b'.repeat(40), updatedAt: '2026-11-16T13:00:00Z', author: { id: 17, login: 'fixture-admin' } };
          localStorage.setItem('curriculum-smoke-document', JSON.stringify(stored)); return structuredClone(stored);
        },
        updateLocal: async value => { local = structuredClone(value); },
        saveLearningGate: async () => { window.__curriculumOtherWrites++; throw Error('Unrelated write forbidden'); },
        saveRecord: async () => { window.__curriculumOtherWrites++; throw Error('Remote writes forbidden'); },
        saveAlgorithmNote: async () => { window.__curriculumOtherWrites++; throw Error('Remote writes forbidden'); }
      };
    }, { base });
    async function openPath(reload = false) {
      if (reload) await page.reload(); else await page.goto(pathToFileURL(appPath('ui/index.html')).href);
      await page.locator('.rail-nav-item[data-view="algorithms"]').click();
      await page.mouse.move(1300, 850);
      await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
      await page.locator('[data-mode="path"]').click(); await page.locator('.alp-gate-title').waitFor();
    }
    const dialog = page.locator('.alp-curriculum-dialog');
    const rows = () => dialog.locator('.alp-curriculum-row');
    const row = id => dialog.locator(`.alp-curriculum-row[data-gate-id="${id}"]`);
    const ids = () => rows().evaluateAll(nodes => nodes.map(node => node.dataset.gateId));
    const submit = () => dialog.locator('form.alp-curriculum-form button[type="submit"]');
    async function openEditor(stage = base.stages[1].id) { await page.locator('.alp-curriculum-edit-button').click(); await dialog.waitFor(); await dialog.locator('.alp-curriculum-stage-select').selectOption(stage); }
    async function cancel() { await dialog.getByRole('button', { name: '取消', exact: true }).click(); await dialog.waitFor({ state: 'hidden' }); }
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('curriculum-smoke-document') || 'null'));
    async function selectPathStage(id) { await page.locator('.alp-stage-picker').click(); await page.locator(`.alp-stage-card[data-stage-id="${id}"]`).click(); }

    await openPath();
    assert.equal(await page.locator('.alp-curriculum-edit-button').count(), 0, 'reader has no admin curriculum entry');
    await page.evaluate(() => sessionStorage.setItem('curriculum-smoke-admin', 'true')); await openPath(true);
    await openEditor();
    assert.equal(await dialog.locator('.alp-curriculum-stage-select').evaluate(node => node === document.activeElement), true);
    const original = await ids(); const first = original[0], second = original[1];
    assert.ok(original.length > 2);
    assert.equal(await row(first).locator('textarea[name="gateDescription"]').count(), 0, 'built-in descriptions use the existing public editor');
    await dialog.locator('.alp-curriculum-stage-title').fill('测试章节草稿');
    await row(first).locator('input[name="gateTitle"]').fill('取消不发布');
    await cancel();
    assert.equal(await page.evaluate(() => window.__curriculumCalls.length), 0);
    assert.equal(await page.locator('.alp-curriculum-edit-button').evaluate(node => node === document.activeElement), true, 'cancel restores focus');
    await openEditor();
    assert.equal(await row(first).locator('input[name="gateTitle"]').inputValue(), base.stages[1].gates[0].title);
    assert.equal(await dialog.locator('.alp-curriculum-stage-title').inputValue(), base.stages[1].title);

    // Inserts preserve neighbor metadata, use new stable UUIDs, and expose real knowledge choices.
    await row(first).locator('[data-action="insert"]').click();
    const inserted = (await ids())[1]; assert.match(inserted, /^custom-[0-9a-f-]{36}$/);
    await row(inserted).locator('input[name="gateTitle"]').fill('测试自定义关卡 <img src=x onerror=alert(1)>');
    assert.equal(await dialog.locator('img').count(), 0);
    await row(inserted).locator('select[name="gateKind"]').selectOption('mixed');
    assert.equal(await row(inserted).locator('select[name="gateSection"]').inputValue(), base.stages[1].gates[0].sectionId);
    await row(inserted).locator('summary').click();
    await row(inserted).locator('textarea[name="gateDescription"]').fill('本地测试：完成笔记与练习');
    await row(inserted).locator('textarea[name="gateGoals"]').fill('测试目标一\n测试目标二');
    const topics = row(inserted).locator('select[name="gateTopics"]');
    const topicId = await topics.locator('option').first().getAttribute('value'); assert.ok(topicId);
    await topics.selectOption([topicId]);
    await row(inserted).locator('[data-action="up"]').click(); assert.equal((await ids())[0], inserted);
    await row(inserted).locator('[data-action="down"]').click(); assert.equal((await ids())[1], inserted);
    await row(inserted).locator('.alp-curriculum-drag').dragTo(row(second)); assert.equal((await ids())[2], inserted, 'HTML DnD changes order within chapter');
    await row(second).locator('[data-action="delete"]').click(); assert.ok((await ids()).includes(second), 'first delete only asks for confirmation');
    await row(second).locator('[data-action="confirm-delete"]').click(); assert.equal((await ids()).includes(second), false);
    await dialog.locator(`[data-action="undo"][data-gate-id="${second}"]`).click(); assert.ok((await ids()).includes(second), 'undo preserves exact gate identity');
    await row(second).locator('[data-action="delete"]').click(); await row(second).locator('[data-action="confirm-delete"]').click();
    await dialog.locator('.alp-curriculum-stage-title').fill('测试发布章节');
    await row(first).locator('input[name="gateTitle"]').fill(''); await submit().click();
    assert.match(await dialog.locator('.alp-curriculum-error').innerText(), /标题/);
    assert.equal(await page.evaluate(() => window.__curriculumCalls.length), 0, 'invalid draft never reaches persistence');
    await row(first).locator('input[name="gateTitle"]').fill('测试保留内置身份');
    await row(inserted).locator('summary').click();
    const description = row(inserted).locator('textarea[name="gateDescription"]'), goals = row(inserted).locator('textarea[name="gateGoals"]');
    assert.equal(await description.getAttribute('maxlength'), '6000'); assert.equal(await goals.getAttribute('maxlength'), '6000');
    assert.equal(await row(inserted).locator('select[name="gateScope"] option[value="route"]').count(), 0, 'non-route sections cannot choose route scope');
    await description.fill(''); await submit().click(); assert.match(await dialog.locator('.alp-curriculum-error').innerText(), /简介/);
    await row(inserted).locator('summary').click(); await description.fill('本地测试：完成笔记与练习');
    for (const value of ['', 'x'.repeat(501), Array.from({ length: 21 }, (_, i) => `目标${i}`).join('\n'), Array.from({ length: 13 }, () => 'x'.repeat(500)).join('\n')]) {
      await goals.evaluate((node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
      await submit().click(); assert.match(await dialog.locator('.alp-curriculum-error').innerText(), /学习目标/);
      await row(inserted).locator('summary').click();
    }
    await goals.fill('测试目标一\n测试目标二');
    const tooManyTopics = await row(inserted).locator('select[name="gateTopics"] option').evaluateAll(nodes => nodes.slice(0, 21).map(node => node.value));
    assert.equal(tooManyTopics.length, 21); await row(inserted).locator('select[name="gateTopics"]').selectOption(tooManyTopics); await submit().click();
    assert.match(await dialog.locator('.alp-curriculum-error').innerText(), /20 个/);
    await row(inserted).locator('summary').click(); await row(inserted).locator('select[name="gateTopics"]').selectOption([topicId]);
    assert.equal(await page.evaluate(() => window.__curriculumCalls.length), 0, 'custom bounds fail before persistence');
    await page.evaluate(() => { window.__curriculumFail = true; }); await submit().click();
    await dialog.locator('.alp-curriculum-error').waitFor();
    assert.match(await dialog.locator('.alp-curriculum-error').innerText(), /测试发布失败/);
    assert.equal(await row(first).locator('input[name="gateTitle"]').inputValue(), '测试保留内置身份');
    assert.equal(await saved(), null, 'failed publication retains the previous document');
    await page.evaluate(() => { window.__curriculumFail = false; window.__curriculumHold = true; }); await submit().click();
    await page.waitForFunction(() => document.querySelector('.alp-curriculum-dialog')?.dataset.saving === 'true');
    assert.equal(await dialog.getByRole('button', { name: '取消', exact: true }).isDisabled(), true);
    assert.equal(await row(first).locator('input[name="gateTitle"]').isDisabled(), true);
    await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true, 'Escape cannot dismiss a running publication');
    await page.evaluate(() => { window.__curriculumRelease(); }); await dialog.waitFor({ state: 'hidden' });
    const document = await saved(), stage = document.layout.stages.find(stage => stage.id === base.stages[1].id);
    assert.equal(document.sha, 'b'.repeat(40)); assert.equal(stage.title, '测试发布章节');
    assert.equal(stage.gates.find(gate => gate.id === first).title, '测试保留内置身份');
    assert.equal(stage.gates.some(gate => gate.id === second), false);
    const custom = stage.gates.find(gate => gate.id === inserted);
    assert.equal(custom.kind, 'mixed'); assert.deepEqual(custom.goals, ['测试目标一', '测试目标二']); assert.deepEqual(custom.topicIds, [topicId]);
    assert.equal(await page.evaluate(() => window.__curriculumCalls.at(-1).sha), null, 'initial publication carries a null optimistic concurrency SHA');
    await selectPathStage(base.stages[1].id);
    assert.deepEqual(await page.locator('.alp-checkpoint').evaluateAll(nodes => nodes.map(node => node.dataset.gateId)), stage.gates.map(gate => gate.id), 'saved order and count apply to the actual learning path');
    assert.match(await page.locator('.alp-stage-title').innerText(), /^第1章\s+测试发布章节$/);
    assert.match(await page.locator(`.alp-checkpoint[data-gate-id="${first}"]`).innerText(), /测试保留内置身份/);
    assert.equal(await page.locator(`.alp-checkpoint[data-gate-id="${inserted}"]`).getAttribute('data-kind'), 'mixed');
    assert.equal(await page.locator(`.alp-checkpoint[data-gate-id="${second}"]`).count(), 0);
    await page.locator('.alp-history summary').click(); assert.match(await page.locator('.alp-history').innerText(), /测试历史完成记录/);
    await page.locator(`.alp-checkpoint[data-gate-id="${inserted}"]`).click(); await page.locator('.alp-learning-button').click();
    assert.equal(await page.locator('.alp-task-card').count(), 1, 'new mixed gate offers the practice task');
    assert.equal(await page.locator('.alp-task-card[data-task="notes"]').count(), 0);
    await openPath(true); await openEditor();
    assert.equal(await row(first).locator('input[name="gateTitle"]').inputValue(), '测试保留内置身份');
    assert.ok((await ids()).includes(inserted));
    await submit().click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.__curriculumCalls.at(-1).sha), 'b'.repeat(40), 'subsequent publication carries the loaded SHA');

    // Last-row protection and count caps are enforced without truncating data.
    await openEditor(base.stages[0].id);
    while (await rows().count() > 1) { const id = (await ids()).at(-1); await row(id).locator('[data-action="delete"]').click(); await row(id).locator('[data-action="confirm-delete"]').click(); }
    assert.equal(await rows().first().locator('[data-action="delete"]').isDisabled(), true); await cancel();
    await page.evaluate(() => sessionStorage.setItem('curriculum-smoke-limit', 'chapter')); await openPath(true); await openEditor();
    assert.equal(await rows().count(), 100); assert.equal(await rows().first().locator('[data-action="insert"]').isDisabled(), true);
    assert.equal(await dialog.locator('[data-action="add"]').isDisabled(), true); await cancel();
    await page.evaluate(() => sessionStorage.setItem('curriculum-smoke-limit', 'total')); await openPath(true); await openEditor(base.stages.at(-1).id);
    assert.match(await dialog.locator('.alp-curriculum-count').innerText(), /1000 \/ 1000/);
    assert.equal(await dialog.locator('[data-action="add"]').isDisabled(), true); await cancel();
    await page.evaluate(() => sessionStorage.removeItem('curriculum-smoke-limit')); await openPath(true); await openEditor();
    // Keep earlier injection assertions, but use readable sample content in review screenshots.
    await row(inserted).locator('input[name="gateTitle"]').fill('综合练习：程序基础与数据组织');
    fs.mkdirSync(path.resolve(__dirname, '../release'), { recursive: true });
    await dialog.locator('.alp-curriculum-controls').evaluate(node => { node.scrollTop = 0; });
    assert.equal(await dialog.locator('.alp-curriculum-stage-select').evaluate(node => { const bounds = node.getBoundingClientRect(), footer = document.querySelector('.alp-curriculum-footer').getBoundingClientRect(); return bounds.top >= 0 && bounds.bottom < footer.top; }), true, 'desktop chapter selector is visible above the fixed footer');
    for (const theme of ['light', 'dark', 'cards']) {
      await page.evaluate(theme => { document.body.dataset.theme = theme; }, theme);
      assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, `${theme} dialog fits viewport`);
      await page.screenshot({ path: path.resolve(__dirname, `../release/learning-curriculum-${theme}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.body.dataset.theme = 'light'; });
    await dialog.locator('.alp-curriculum-controls').evaluate(node => { node.scrollTop = 0; });
    assert.equal(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, '390px editor does not overflow');
    await page.screenshot({ path: path.resolve(__dirname, '../release/learning-curriculum-mobile.png') }); await cancel();
    await page.evaluate(() => sessionStorage.setItem('curriculum-smoke-admin', 'false')); await openPath(true);
    assert.equal(await page.locator('.alp-curriculum-edit-button').count(), 0);
    assert.equal(await page.evaluate(() => window.__curriculumOtherWrites), 0); assert.deepEqual(errors, []);
    console.log('PASS curriculum UI: admin visibility, isolated cancel/focus, stable UUID insertion and metadata, safe preview, keyboard/DnD order, two-step delete and identity undo, validation, failed save/retry, busy Escape lock, full layout + SHA, reload, last gate and 100/1000 limits, themes/mobile; local fixtures only');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
