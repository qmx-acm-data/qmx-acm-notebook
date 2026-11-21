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
        { id: 'ordinary', path: 'notes/ordinary.md', nodeId, noteScope: 'public', kind: 'algorithm-note', title: '普通笔记', author: 'writer', updatedAt: '2026-11-13', body: '普通笔记正文' },
        { id: 'featured', path: 'notes/featured.md', nodeId, noteScope: 'public', kind: 'algorithm-note', featured: true, title: '初识算法竞赛及未来规划', author: 'time-lo', updatedAt: '2026-11-12', body },
        { id: 'second-featured', path: 'notes/second-featured.md', nodeId, noteScope: 'public', kind: 'algorithm-note', title: '第二篇精选经验', author: 'writer', updatedAt: '2026-11-11', body: '另一份学习经验。' },
        { id: 'synthetic-old', path: 'notes/synthetic.md', nodeId: 'reading-mixed', noteScope: 'public', kind: 'algorithm-note', title: '旧父节点笔记', author: 'writer', updatedAt: '2026-11-11', body: '合并后仍应读到。' },
        { id: 'roadmap-featured', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'public', kind: 'algorithm-note', featured: true, title: '路线资源里的 C++ 笔记', author: 'reader-fixture', updatedAt: '2026-11-13', body },
        { id: 'builtin-parent-old', path: 'notes/builtin-parent-old.md', nodeId: 'algorithm-二分查找', noteScope: 'public', kind: 'algorithm-note', title: '内置父算法旧笔记', author: 'writer', updatedAt: '2026-11-11', body: '原算法添加子项后仍能编辑旧简介。' },
      ];
      window.__saved = null; window.__saveFail = false; window.__contentSaves = []; window.__contentFail = false;
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], algorithmNotes: notes, algorithmNodeContents: [{ nodeId, introduction: '使用 **训练计划** 整理每次复盘。', featuredNotePaths: ['notes/featured.md', 'notes/second-featured.md', 'notes/unavailable.md'], sha: 'fixture-content', updatedAt: '2026-11-13', author: { id: 42, login: 'learner' } }, { nodeId: 'algorithm-二分查找', introduction: '内置父算法的 **原始简介**。', featuredNotePaths: ['notes/builtin-parent-old.md'], sha: 'builtin-parent-content', updatedAt: '2026-11-13', author: { id: 42, login: 'learner' } }], algorithmTopics: [{ id: 'reading-mixed', parentId: 'root', label: '混合算法夹具', color: 'intermediate', kind: 'algorithm' }, { id: 'reading-mixed-dir', parentId: 'reading-mixed', label: '真实目录夹具', kind: 'directory', color: 'parent' }, { id: 'reading-builtin-child', parentId: 'algorithm-二分查找', label: '二分查找自定义子项', kind: 'algorithm', color: 'intermediate' }], account: { id: 42, login: 'learner' }, permissions: { repo: 'test/notebook', push: true, admin: true }, settings: { repo: 'test/notebook', autoSync: false }, local: { records: [], favorites: [], mastery: {}, draft: {} } }),
        saveAlgorithmNodeContent: async input => { window.__contentSaves.push(input); if (window.__contentFail) throw Error('metadata save failed'); return { ...input, sha: 'saved-content', updatedAt: '2026-11-14', author: { id: 42, login: 'learner' } }; },
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
    assert.deepEqual(await page.locator('.alg-leaf-reading h3').allTextContents(), ['简介', '精选笔记', '全部笔记']);
    assert.equal(await page.locator('.alg-leaf-reading .markdown-body strong').innerText(), '训练计划');
    assert.deepEqual(await page.locator('.alg-featured-section .alg-note-title').allTextContents(), ['初识算法竞赛及未来规划', '第二篇精选经验']);
    assert.equal(await page.locator('.alg-leaf-reading .alg-note-title').count(), 3, 'curated notes never repeat in all notes');
    assert.equal(await page.locator('.alg-detail-stats, .alg-node-information').count(), 0, 'leaf omits redundant stats and rationale');
    assert.ok(await page.locator('.alg-note-list').first().evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.alg-detail-utilities')) & Node.DOCUMENT_POSITION_FOLLOWING)));
    await page.locator('.alg-edit-leaf-content').click();
    await page.locator('.alg-leaf-markdown-input').fill('更新 **训练计划**，保留公式 $n+1$。');
    assert.equal(await page.locator('.alg-leaf-preview strong').innerText(), '训练计划');
    await page.evaluate(() => { window.__contentFail = true; });
    await page.locator('.alg-leaf-content-form button[type="submit"]').click();
    assert.match(await page.locator('.alg-leaf-editor .alg-inline-error').innerText(), /metadata save failed/);
    assert.equal(await page.locator('.alg-leaf-editor').evaluate(node => node.open), true, 'failed save keeps draft open');
    await page.evaluate(() => { window.__contentFail = false; });
    await page.locator('.alg-leaf-content-form button[type="submit"]').click();
    await page.waitForSelector('.alg-leaf-editor', { state: 'detached' });
    assert.match(await page.locator('.alg-introduction-markdown').innerText(), /更新/);
    const contentSave = await page.evaluate(() => window.__contentSaves.at(-1));
    assert.equal(contentSave.nodeId, 'directory-contest-experience');
    assert.equal(contentSave.sha, 'fixture-content');
    assert.deepEqual(contentSave.featuredNotePaths, ['notes/featured.md', 'notes/second-featured.md', 'notes/unavailable.md'], 'unseen curated references survive ordinary edits');
    await page.locator('.alg-tree-item[data-node-id="root"] > .alg-tree-row .alg-tree-label').click();
    await page.locator('.alg-tree-item[data-node-id="directory-contest-experience"] > .alg-tree-row').click();
    assert.match(await page.locator('.alg-introduction-markdown').innerText(), /更新/, 'switching nodes retains saved introduction');
    await page.locator('.alg-edit-leaf-content').click();
    assert.equal(await page.locator('.alg-leaf-markdown-input').inputValue(), '更新 **训练计划**，保留公式 $n+1$。');
    const unavailable = page.locator('.alg-featured-unavailable input[value="notes/unavailable.md"]');
    assert.equal(await unavailable.isChecked(), true, 'unavailable curated reference can be explicitly removed');
    await unavailable.uncheck();
    await page.locator('.alg-leaf-content-form button[type="submit"]').click();
    await page.waitForSelector('.alg-leaf-editor', { state: 'detached' });
    const subsequentSave = await page.evaluate(() => window.__contentSaves.at(-1));
    assert.equal(subsequentSave.sha, 'saved-content', 'second save after switching nodes uses latest SHA');
    assert.deepEqual(subsequentSave.featuredNotePaths, ['notes/featured.md', 'notes/second-featured.md'], 'explicit removal drops unavailable curated reference');
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
    const resources = page.locator('.arm-resource-dialog');
    assert.equal(await resources.locator('.alg-leaf-reading, .alg-note-card').count(), 0, 'route directory only lists its knowledge leaves');
    await resources.locator('.arm-leaf-link[data-topic-id="algorithm-万能头文件与标准库使用"]').click();
    assert.deepEqual(await resources.locator('.alg-leaf-reading h3').allTextContents(), ['简介', '精选笔记', '全部笔记']);
    assert.equal(await resources.locator('.alg-note-card[data-note-key="roadmap-featured"] .alg-note-title').innerText(), '路线资源里的 C++ 笔记');
    assert.equal(await resources.locator('.alg-note-featured').count(), 1);
    await resources.locator('.alg-note-card[data-note-key="roadmap-featured"]').click();
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
    await page.locator('.arm-resource-dialog .arm-leaf-link[data-topic-id="algorithm-万能头文件与标准库使用"]').click();
    await page.locator('.alg-note-card[data-note-key="roadmap-featured"]').click();
    await page.locator('[data-mode="tree"]').click();
    assert.equal(await page.locator('.reading-detail-view').count(), 0);
    assert.ok(await page.locator('.alg-toolbar').isVisible());
    await page.locator('.alg-search').fill('旧父节点笔记');
    await page.locator('.alg-search-submit').click();
    assert.equal(await page.locator('.alg-tree-item[data-node-id="algorithm-content-reading-mixed"]').count(), 1, 'old parent note search reveals the canonical content leaf');
    assert.equal(await page.locator('.alg-pane .alg-result-summary, .alg-pane .alg-result-topic, .alg-pane .alg-search-note-list').count(), 0, 'active note search adds no duplicate result sections to the reading pane');
    await page.locator('.alg-tree-item[data-node-id="reading-mixed"] > .alg-tree-row .alg-tree-label').click();
    assert.equal(await page.locator('.alg-leaf-reading').count(), 0, 'synthetic parent is directory only');
    assert.equal(await page.locator('#algorithm-upload-button').isVisible(), false);
    await page.locator('.alg-tree-item[data-node-id="algorithm-content-reading-mixed"] > .alg-tree-row .alg-tree-label').click();
    assert.equal(await page.locator('.alg-leaf-reading .alg-note-title').innerText(), '旧父节点笔记', 'legacy parent attachment maps to synthetic content leaf');
    assert.deepEqual(await page.locator('.alg-pane .alg-leaf-reading > section > .alg-section-heading > h3').allTextContents(), ['简介', '精选笔记', '全部笔记'], 'filtered synthetic leaf still has exactly three reading sections');
    assert.equal(await page.locator('.alg-pane .alg-result-summary, .alg-pane .alg-result-topic, .alg-pane .alg-search-note-list').count(), 0);
    await page.locator('.alg-search').fill('内置父算法旧笔记');
    await page.locator('.alg-search-submit').click();
    const builtinContentId = 'algorithm-content-algorithm-二分查找';
    const builtinLeaf = page.locator(`.alg-tree-item[data-node-id="${builtinContentId}"] > .alg-tree-row .alg-tree-label`);
    await builtinLeaf.click();
    assert.equal(await page.locator('.alg-introduction-markdown strong').innerText(), '原始简介', 'legacy builtin parent metadata resolves to its synthetic content leaf');
    assert.deepEqual(await page.locator('.alg-featured-section .alg-note-title').allTextContents(), ['内置父算法旧笔记']);
    await page.locator('.alg-edit-leaf-content').click();
    assert.equal(await page.locator('.alg-leaf-markdown-input').inputValue(), '内置父算法的 **原始简介**。', 'synthetic editor starts from the original parent metadata');
    await page.locator('.alg-leaf-markdown-input').fill('内置父算法的 **已保存简介**。');
    await page.locator('.alg-leaf-content-form button[type="submit"]').click();
    await page.waitForSelector('.alg-leaf-editor', { state: 'detached' });
    const builtinSave = await page.evaluate(() => window.__contentSaves.at(-1));
    assert.equal(builtinSave.nodeId, builtinContentId, 'save uses canonical synthetic leaf identity');
    assert.equal(builtinSave.storageNodeId, 'algorithm-二分查找', 'save retains the original builtin metadata storage identity');
    assert.equal(builtinSave.sha, 'builtin-parent-content', 'save uses the original parent metadata SHA');
    assert.deepEqual(builtinSave.featuredNotePaths, ['notes/builtin-parent-old.md']);
    await page.locator('.alg-tree-item[data-node-id="algorithm-二分查找"] > .alg-tree-row .alg-tree-label').click();
    await builtinLeaf.click();
    assert.equal(await page.locator('.alg-introduction-markdown strong').innerText(), '已保存简介', 'same-session navigation retains the saved synthetic leaf metadata');
    await page.locator('.alg-edit-leaf-content').click();
    assert.equal(await page.locator('.alg-leaf-markdown-input').inputValue(), '内置父算法的 **已保存简介**。');
    await page.locator('.alg-leaf-markdown-input').fill('内置父算法的 **再次保存简介**。');
    await page.locator('.alg-leaf-content-form button[type="submit"]').click();
    await page.waitForSelector('.alg-leaf-editor', { state: 'detached' });
    const builtinResave = await page.evaluate(() => window.__contentSaves.at(-1));
    assert.equal(builtinResave.nodeId, builtinContentId);
    assert.equal(builtinResave.storageNodeId, 'algorithm-二分查找');
    assert.equal(builtinResave.sha, 'saved-content', 'same-session synthetic edit uses the latest saved SHA');
    assert.equal(await page.locator('.alg-introduction-markdown strong').innerText(), '再次保存简介');
    assert.deepEqual(errors, []);
    console.log('PASS inline readers and clickable paths: featured ordering, footer utilities, modal admin action, exact note from roadmap resources, return/Escape/focus/scroll, breadcrumb root navigation, math, themes and 390px, mode-switch disposal, builtin synthetic-parent metadata identity/SHA and same-session saves');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
