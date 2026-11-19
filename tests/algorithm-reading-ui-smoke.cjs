'use strict';
const { appPath } = require('./app-path.cjs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const nodeId = 'directory-contest-experience';
      const body = '# 算法竞赛学习与训练建议\n\n先找出自己缺什么，再决定练什么。\n\n## 目标\n\n**重点内容**，公式 $a_i+b_j$。\n\n' + Array(80).fill('### 学习与复盘\n\n坚持练习，记录经验。').join('\n\n');
      const notes = [
        { id: 'ordinary', nodeId, noteScope: 'public', kind: 'algorithm-note', title: '普通笔记', author: 'writer', updatedAt: '2026-11-13', body: '普通笔记正文' },
        { id: 'featured', nodeId, noteScope: 'public', kind: 'algorithm-note', featured: true, title: '初识算法竞赛及未来规划', author: 'time-lo', updatedAt: '2026-11-12', body },
        { id: 'roadmap-featured', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'public', kind: 'algorithm-note', featured: true, title: '路线资源里的 C++ 笔记', author: 'reader-fixture', updatedAt: '2026-11-13', body },
      ];
      window.__saved = null; window.__saveFail = false;
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], algorithmNotes: notes, account: { id: 42, login: 'learner' }, permissions: { repo: 'test/notebook', push: true, admin: true }, settings: { repo: 'test/notebook', autoSync: false }, local: { records: [], favorites: [], mastery: {}, draft: {} } }),
        updateLocal: async data => { if (window.__saveFail) throw Error('save failed'); window.__saved = data; },
        openExternal: async () => {}, saveSettings: async settings => settings,
      };
    });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await page.locator('.rail-nav-item[data-view="algorithms"]').click();
    await page.mouse.move(1300, 800);
    await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
    await page.locator('.alg-tree-item[data-node-id="directory-contest-experience"] > .alg-tree-row').click();
    assert.equal(await page.locator('.alg-note-title').first().innerText(), '初识算法竞赛及未来规划');
    assert.ok(await page.locator('.alg-featured-section').evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.alg-node-information')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    assert.ok(await page.locator('.alg-note-list').first().evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.alg-detail-utilities')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    await page.locator('.alg-open-detail').click();
    assert.equal(await page.locator('.reading-detail-view:visible').count(), 1);
    await page.locator('.reading-expanded .alg-add-topic-detail').filter({ hasText: '添加算法' }).click();
    await page.locator('#algorithm-topic-dialog').waitFor();
    assert.equal(await page.locator('.reading-detail-view').count(), 0);
    await page.keyboard.press('Escape');
    await page.locator('.alg-note-card').first().click();
    assert.equal(await page.locator('.alg-reading-title').innerText(), '初识算法竞赛及未来规划');
    await page.locator('.alg-open-detail').click();
    const bounds = await page.locator('.reading-detail-view').boundingBox();
    assert.ok(bounds.width < 1440); assert.ok(bounds.y > 100);
    assert.ok(await page.locator('.algorithm-view-modes').isVisible());
    assert.ok(bounds.y >= (await page.locator('.algorithm-view-modes').boundingBox()).y);
    assert.match(await page.locator('.reading-detail-path').innerText(), /知识树[\s\S]*算法竞赛经验与游记/);
    assert.equal(await page.locator('.reading-expanded .katex').count(), 1);
    await page.locator('.reading-expanded .alg-pane').evaluate(element => { element.scrollTop = 400; });
    await page.locator('.reading-detail-back:visible').click();
    assert.ok(await page.locator('.alg-pane').evaluate(element => element.scrollTop) > 0);
    await page.locator('.alg-open-detail').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.reading-detail-view').count(), 0);
    assert.equal(await page.locator('.alg-open-detail').evaluate(element => element === document.activeElement), true);

    // Knowledge reader appearance and mobile behavior remain independently covered.
    await page.locator('.alg-open-detail').click();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { document.body.dataset.theme = value; }, theme);
      assert.ok(await page.locator('.reading-detail-view:visible').evaluate(element => element.scrollWidth <= innerWidth));
      await page.screenshot({ path: `release/algorithm-reader-${theme}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('.reading-detail-view:visible').evaluate(element => element.getBoundingClientRect().width < 390));
    assert.ok(await page.locator('.reading-detail-view:visible').evaluate(element => element.scrollWidth <= innerWidth));
    await page.screenshot({ path: 'release/algorithm-reader-mobile.png' });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.alg-reader-back').click();
    await page.screenshot({ path: 'release/algorithm-featured-layout.png' });
    await page.locator('.alg-open-detail').click();
    await page.locator('.reading-detail-path button').filter({ hasText: 'XCPC算法' }).click();
    assert.equal(await page.locator('.reading-detail-view').count(), 0);
    assert.equal(await page.locator('.alg-tree-item[aria-selected="true"]').getAttribute('data-node-id'), await page.evaluate(() => window.QMX_ALGORITHM_TREE.id));

    // The replacement graph uses the same real note-reading callback, with a mapped C++ topic.
    await page.locator('[data-mode="path"]').click();
    await page.locator('.arm-node[data-node="g"]').click();
    await page.locator('.arm-resources-button').click();
    const resource = page.locator('.arm-resource-card[data-gate-id="lp2-cpp-toolkit-program-flow-types-io"]');
    assert.equal(await resource.locator('.arm-note[data-note-id="roadmap-featured"]').innerText(), '路线资源里的 C++ 笔记');
    assert.equal(await resource.locator('.arm-note.arm-note-featured').count(), 1);
    await resource.locator('.arm-note[data-note-id="roadmap-featured"]').click();
    assert.equal(await page.locator('.arm-resource-dialog:visible').count(), 0, 'resource modal closes before opening the reader');
    assert.equal(await page.locator('.reading-detail-view:visible').count(), 1);
    assert.equal(await page.locator('.reading-expanded .alg-reading-title').innerText(), '路线资源里的 C++ 笔记');
    assert.equal(await page.locator('.reading-expanded .katex').count(), 1);
    assert.match(await page.locator('.reading-detail-path').innerText(), /学习路线/);
    assert.doesNotMatch(await page.locator('.reading-detail-path').innerText(), /闯关学习/);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('.reading-detail-view:visible').evaluate(element => element.scrollWidth <= innerWidth));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.reading-detail-view').count(), 0);
    assert.ok(await page.locator('.arm').isVisible());
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Disposal through mode switching also removes a live note reader.
    await page.locator('.arm-node[data-node="g"]').click();
    await page.locator('.arm-resources-button').click();
    await page.locator('.arm-note[data-note-id="roadmap-featured"]').first().click();
    await page.locator('[data-mode="tree"]').click();
    assert.equal(await page.locator('.reading-detail-view').count(), 0);
    assert.ok(await page.locator('.alg-toolbar').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS inline readers and clickable paths: featured ordering, footer utilities, modal admin action, exact note from roadmap resources, return/Escape/focus/scroll, breadcrumb root navigation, math, themes and 390px, mode-switch disposal');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
