'use strict';

// Run after pnpm build:app. Only notebook is mocked; the real built UI/data run offline.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');
const curriculum = require(appPath('ui/algorithm-learning-path-data.js'));
const STORAGE = 'qmx-roadmap-test-local';
const expectedNodes = {
  g: ['C++ 基础语法', 0], xh: ['循环', 0], sz: ['数组', 0], hs: ['函数', 0], wy: ['位运算', 0],
  ds: ['基础数据结构（上）', 1], ss: ['认识数学', 1], px: ['排序', 1], ef: ['二分', 1], tx: ['初识贪心', 1],
  dl: ['队列', 1], zfc: ['字符串', 1], hm: ['哈希', 1], ssr: ['搜索', 2], jcdp: ['基础 dp', 2],
  tl: ['基础图论', 2], srgt: ['贪心分类', 2], zfsf: ['字符串算法', 2], jcsz: ['基础数学', 2],
  jjsj: ['进阶数据结构', 3], jjdp: ['进阶 dp', 3], jjgl: ['进阶图论', 3], jjsz: ['进阶数学', 3],
  recursion: ['递归/分治', 1], struct: ['结构体', 0], pointer: ['指针', 0], simulation: ['模拟与枚举', 1],
  construction: ['构造', 1], prefix: ['前缀和与差分', 1], two: ['双指针', 1], basicdata: ['基础数据结构（下）', 2],
  advancedstrings: ['进阶字符串', 3], geometry: ['计算几何', 3],
};
const expectedEdges = [
  'g>xh', 'g>sz', 'g>hs', 'g>wy', 'xh>ds', 'sz>ds', 'hs>ds', 'wy>ss',
  'ds>px', 'ds>ef', 'ds>tx', 'ds>dl', 'ds>zfc', 'ds>hm', 'ds>ssr', 'tx>srgt', 'zfc>zfsf',
  'ss>jcsz', 'ssr>jcdp', 'ssr>tl', 'jcdp>srgt', 'jcdp>jjdp', 'tl>jjgl', 'jcsz>jjsz',
  'jjsj>jjdp', 'hs>recursion', 'recursion>ssr', 'g>struct', 'g>pointer', 'xh>simulation',
  'sz>simulation', 'ds>basicdata', 'basicdata>jjsj', 'zfsf>advancedstrings', 'jcsz>geometry',
  'sz>prefix', 'sz>two', 'ss>construction',
].sort();
const originalGates = {
  'stage-01-gate-01': { status: 'completed', reflection: '保留旧版成果', tasks: { notes: true, practice: true }, practiceUrl: 'https://example.invalid/legacy', opaque: { untouched: true } },
  [curriculum.stages[0].gates[0].id]: { status: 'completed', reflection: '仍然保留的已完成记录', unknown: 0 },
  'lp2-cpp-toolkit-program-flow-types-io': { status: 'completed', reflection: '路线资源保留的成果', tasks: { notes: true }, opaque: { keep: true } },
};
const progress = { stageId: 'stage-01', gateId: 'stage-01-gate-01', gates: originalGates, opaqueRoot: { preserve: ['all', 0, null] } };
const legacyKey = JSON.stringify(['test/notebook', '42', curriculum.id]);
const node = (page, id) => page.locator(`.arm-node[data-node="${id}"]`);
async function openRoute(page) {
  await page.locator('.rail-nav-item[data-view="algorithms"]').click();
  await page.mouse.move(Math.max(300, (await page.viewportSize()).width - 40), 800);
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  assert.equal(await page.locator('[data-mode="path"]').innerText(), '学习路线');
  await page.locator('[data-mode="path"]').click();
  await page.locator('.arm').waitFor();
}
async function tick(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function scale(page) { return page.locator('.arm-canvas').evaluate(canvas => new DOMMatrix(getComputedStyle(canvas).transform).a); }
async function assertFit(page, label) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.arm-canvas'), scroll = document.querySelector('.arm-graph-scroll');
    const width = canvas.getBoundingClientRect().width;
    return width > 0 && width <= scroll.clientWidth + 1;
  });
  assert.equal(await page.locator('.arm').getAttribute('data-zoom-mode'), 'fit', label);
  const bounds = await page.locator('.arm-graph-scroll').evaluate(scroll => ({ width: scroll.clientWidth, content: scroll.scrollWidth }));
  assert.ok(bounds.content <= bounds.width + 2, `${label}: fit does not overflow horizontally`);
}
async function assertPreserved(page) {
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE);
  assert.deepEqual(saved.learningPaths[legacyKey].gates, originalGates, 'focus never rewrites legacy gate evidence, task/practice data or opaque fields');
  assert.deepEqual(saved.learningPaths[legacyKey].opaqueRoot, progress.opaqueRoot);
  const scoped = saved.learningPaths[JSON.stringify(['https://api.github.com|test/notebook', '42', curriculum.id])];
  assert.deepEqual(scoped.gates, originalGates, 'new source key carries every legacy gate unchanged');
  assert.deepEqual(scoped.opaqueRoot, progress.opaqueRoot);
  assert.deepEqual(saved.learningPaths['unrelated-source-account'], { gates: { other: { status: 'completed' } }, custom: false });
  return saved;
}
async function focus(page, id) {
  await node(page, id).click();
  await page.locator('.arm-focus-button').click();
  await page.waitForFunction(id => document.querySelector(`.arm-node[data-node="${id}"]`)?.dataset.focused === 'true' && !document.querySelector('.arm-focus-button')?.disabled, id);
  await page.keyboard.press('Escape');
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ initial, storage, base }) => {
      let local = JSON.parse(localStorage.getItem(storage) || JSON.stringify(initial));
      const layout = { stages: base.stages.map(stage => ({ id: stage.id, title: stage.title, gates: stage.gates.map(gate => ({ id: gate.id, title: gate.title, kind: ['mixed', 'challenge'].includes(gate.kind) ? gate.kind : 'learning', sectionId: gate.sectionId || '', scope: gate.scope || (gate.optional ? 'elective' : 'core') })) })) };
      layout.stages[0].gates.push({ id: 'custom-12345678-1234-4234-8234-123456789abc', title: '已知语法与自定义知识点', kind: 'learning', sectionId: layout.stages[0].gates[0].sectionId, scope: 'core', description: '自定义关卡同时连接已有和新建叶子。', goals: [], topicIds: ['algorithm-万能头文件与标准库使用', 'roadmap-custom-leaf'] });
      const learningCurriculum = { layout, sha: 'f'.repeat(40), updatedAt: '2026-11-19T00:00:00Z', author: { id: 7, login: 'fixture-admin' } };
      const account = Number(sessionStorage.getItem('roadmap-account') || 42);
      const serverUrl = sessionStorage.getItem('roadmap-source') || '';
      const admin = sessionStorage.getItem('roadmap-admin') === 'true';
      window.__roadmapSaveFail = false; window.__roadmapPublicFail = false; window.__roadmapPublicSaves = []; window.__roadmapWrites = 0; window.__roadmapExternal = []; window.__roadmapNodeSaves = []; window.__roadmapHoldSave = false; window.__roadmapReleaseSave = null; window.__roadmapSaveSettled = 0;
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], algorithmNotes: [
          { path: 'algorithm-notes/public-resource.md', featured: true, id: 'public-resource', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'public', kind: 'algorithm-note', title: '公开语法笔记', authorId: 7, body: '公开资源' },
          { path: 'algorithm-notes/own-private-resource.md', id: 'own-private-resource', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'personal', kind: 'algorithm-note', title: '我的私密语法笔记', authorId: account, body: '仅知识树个人范围' },
          { path: 'algorithm-notes/foreign-private-resource.md', id: 'foreign-private-resource', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'personal', kind: 'algorithm-note', title: '他人的私密语法笔记', authorId: 9001, body: '绝不能出现在公开资源' },
          { path: 'algorithm-notes/public-second.md', id: 'public-second', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'public', kind: 'algorithm-note', title: '第二篇精选笔记', authorId: 8 },
          { path: 'algorithm-notes/public-ordinary.md', id: 'public-ordinary', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'public', kind: 'algorithm-note', title: '普通语法笔记', authorId: 8 },
          { path: 'algorithm-notes/directory-note.md', id: 'directory-note', nodeId: 'root', noteScope: 'public', kind: 'algorithm-note', title: '目录不得聚合的笔记', authorId: 8 },
          { path: 'algorithm-notes/custom-leaf-resource.md', id: 'custom-leaf-resource', nodeId: 'roadmap-custom-leaf', noteScope: 'public', kind: 'algorithm-note', title: '自定义关卡叶子笔记', authorId: 8, body: '自定义知识点通过共享阅读器打开。' },
        ], learningCurriculum, algorithmTopics: [{ id: 'roadmap-custom-leaf', parentId: 'root', label: '自定义关卡知识点', kind: 'algorithm', color: 'beginner' }], algorithmNodeContents: [{ nodeId: 'roadmap:g', introduction: '## 语法目录简介' + '\n\n介绍中的更多说明。'.repeat(45), featuredNotePaths: [], sha: 'e'.repeat(40), updatedAt: '2026-11-19T00:00:00Z', author: { id: 7, login: 'fixture-admin' } }, { nodeId: 'algorithm-万能头文件与标准库使用', introduction: '## 叶子简介\n\n**管理员内容**', featuredNotePaths: ['algorithm-notes/public-resource.md', 'algorithm-notes/public-second.md'], sha: 'c'.repeat(40), updatedAt: '2026-11-19T00:00:00Z', author: { id: 7, login: 'fixture-admin' } }], learningGateContents: [{
          gateId: 'stage-00-gate-01', description: '管理员已保存的输入输出资料' + '\n\n介绍中的更多说明。'.repeat(45), goals: ['核验整数范围'],
          practiceList: { title: '已保存的官方题单', url: 'https://example.invalid/official-saved-list' }, sha: 'a'.repeat(40),
          updatedAt: '2026-11-19T00:00:00Z', author: { id: 7, login: 'fixture-admin' }, repo: 'test/notebook',
        }],
          account: { id: account, login: 'roadmap-fixture' }, permissions: { repo: 'test/notebook', push: false, admin },
          settings: { repo: 'test/notebook', serverUrl, autoSync: false }, local: structuredClone(local) }),
        updateLocal: async value => { if (window.__roadmapSaveFail) throw Error('模拟本地保存失败'); local = structuredClone(value); localStorage.setItem(storage, JSON.stringify(local)); },
        saveSettings: async settings => settings,
        openExternal: async url => window.__roadmapExternal.push(url),
        saveAlgorithmNodeContent: async input => { if (!admin) throw Error('Non-admin write'); if (window.__roadmapHoldSave) { window.__roadmapHoldSave = false; await new Promise(resolve => { window.__roadmapReleaseSave = resolve; }); } try { if (window.__roadmapPublicFail) throw Error('模拟公共保存失败'); window.__roadmapNodeSaves.push(structuredClone(input)); return { ...input, sha: 'd'.repeat(40), updatedAt: '2026-11-19T00:00:00Z', author: { id: account, login: 'fixture-admin' } }; } finally { window.__roadmapSaveSettled++; } },
        saveAlgorithmNote: async () => { window.__roadmapWrites++; throw Error('No remote writes in roadmap smoke'); },
        saveLearningGate: async input => { if (!admin) { window.__roadmapWrites++; throw Error('Non-admin write'); } if (window.__roadmapPublicFail) throw Error('模拟公共保存失败'); window.__roadmapPublicSaves.push(structuredClone(input)); return { ...input, sha: 'b'.repeat(40), updatedAt: '2026-11-19T00:00:00Z', author: { id: account, login: 'fixture-admin' } }; },
      };
    }, { storage: STORAGE, base: curriculum, initial: { records: [], favorites: ['retained-favorite'], mastery: { keep: 0 }, draft: {}, learningPaths: { [legacyKey]: progress, 'unrelated-source-account': { gates: { other: { status: 'completed' } }, custom: false } } } });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await openRoute(page);
    assert.equal(await page.locator('.arm').getAttribute('data-view'), 'graph');
    const rendered = await page.locator('.arm-node').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.dataset.node, [node.querySelector('strong').textContent, Number(node.dataset.stage)]])));
    assert.deepEqual(rendered, expectedNodes, 'approved 33-node identities, labels and four stages');
    assert.deepEqual(await page.locator('.arm-edge').evaluateAll(edges => edges.map(edge => `${edge.dataset.from}>${edge.dataset.to}`).sort()), expectedEdges, 'all 38 approved relationships');
    const routing = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.arm-node')].map(card => ({ id: card.dataset.node, x: card.offsetLeft, y: card.offsetTop, w: card.offsetWidth, h: card.offsetHeight }));
      const failures = [];
      for (const edge of document.querySelectorAll('.arm-edge')) {
        const points = JSON.parse(edge.dataset.points);
        for (let i = 1; i < points.length; i++) {
          const [a, b] = [points[i - 1], points[i]];
          if (a[0] !== b[0] && a[1] !== b[1]) failures.push(`${edge.dataset.from}>${edge.dataset.to}: diagonal`);
          for (const node of nodes) {
            if (node.id === edge.dataset.from || node.id === edge.dataset.to) continue;
            const crosses = a[0] === b[0]
              ? a[0] > node.x && a[0] < node.x + node.w && Math.max(a[1], b[1]) > node.y && Math.min(a[1], b[1]) < node.y + node.h
              : a[1] > node.y && a[1] < node.y + node.h && Math.max(a[0], b[0]) > node.x && Math.min(a[0], b[0]) < node.x + node.w;
            if (crosses) failures.push(`${edge.dataset.from}>${edge.dataset.to}: crosses ${node.id}`);
          }
        }
      }
      return failures;
    });
    assert.deepEqual(routing, [], 'rendered relationship lines are orthogonal and avoid unrelated cards');
    assert.equal(await page.locator('.arm-edge.arm-foundation').count(), 3, 'three approved foundation links keep their meaning');
    assert.equal(await page.locator('.arm-edge.arm-compare[data-from="jcdp"][data-to="srgt"]').count(), 1, 'DP and greedy remain a comparison');
    assert.equal(await page.locator('.arm-node[data-node="offline"]').count(), 0, 'offline index is separate from the graph');
    await node(page, 'g').hover();
    assert.ok(await node(page, 'hs').evaluate(card => card.classList.contains('arm-related')), 'hover highlights an approved neighbor');
    assert.equal(await node(page, 'jjdp').evaluate(card => card.classList.contains('arm-related')), false, 'hover does not highlight an unrelated advanced node');
    assert.equal(await page.locator('.arm-stage-button').count(), 4);
    const layout = await page.evaluate(() => ({ stages: [...document.querySelectorAll('.arm-stage-button')].map(button => button.getBoundingClientRect().toJSON()), graph: document.querySelector('.arm-graph-scroll').getBoundingClientRect().toJSON() }));
    assert.ok(layout.stages.every(stage => stage.bottom <= layout.graph.top), 'four stage controls sit above graph');
    assert.equal(new Set(layout.stages.map(stage => Math.round(stage.top))).size, 1, 'stage controls share a top row');
    assert.equal(await page.locator('.alp-summary, .alp-checkpoint, .alp-complete-button, .alp-task-card, .alp-achievement').count(), 0);
    assert.doesNotMatch(await page.locator('.arm').innerText(), /闯关|经验值|通关|已掌握|完成任务/);
    await assertFit(page, 'desktop initial fit');
    await page.locator('.arm-actual-button').click();
    assert.equal(await scale(page), 1);
    assert.equal(await page.locator('.arm-actual-button').getAttribute('aria-pressed'), 'true');
    await page.locator('.arm-zoom-in').click(); assert.ok((await scale(page)) > 1);
    await page.locator('.arm-zoom-out').click(); assert.ok(Math.abs((await scale(page)) - 1) < 0.001);
    await page.locator('.arm-fit-button').click(); await assertFit(page, 'explicit desktop fit');
    const wideScale = await scale(page);
    await page.setViewportSize({ width: 1000, height: 900 }); await assertFit(page, 'window resize');
    assert.ok((await scale(page)) < wideScale, 'fit recomputes on window width change');
    for (const stage of ['0', '1', '2', '3']) {
      await page.locator(`.arm-stage-button[data-stage="${stage}"]`).click();
      assert.equal(await page.locator(`.arm-stage-button[data-stage="${stage}"]`).getAttribute('aria-pressed'), 'true');
    }
    await page.locator('.arm-search').fill('线性基');
    assert.ok(await page.locator('.arm-node.arm-match').count() >= 1, 'search finds knowledge in node detail');
    await page.locator('.arm-search').fill('roadmap-no-such-topic-2193');
    assert.equal(await page.locator('.arm-empty').isVisible(), true);
    await page.locator('.arm-search').fill('');
    await page.locator('.arm-list-button').click();
    assert.equal(await page.locator('.arm').getAttribute('data-view'), 'list');
    assert.equal(await page.locator('.arm-list-button').getAttribute('aria-pressed'), 'true');
    await page.locator('.arm-list-button').click(); await assertFit(page, 'return from list');
    await node(page, 'g').click();
    assert.equal(await page.locator('.arm-detail-title').innerText(), 'C++ 基础语法');
    assert.equal(await page.locator('.arm-detail-dialog').isVisible(), true);
    assert.equal(await page.locator('.arm-directory-introduction').count(), 1);
    assert.equal(await page.locator('.arm-detail-dialog .alg-note-card, .arm-detail-section, .arm-practice-box, .arm-relation-button').count(), 0, 'directory contains one intro and leaf links without aggregate note/task/goal panels');
    assert.ok(await page.locator('.arm-leaf-link').count() > 0);
    assert.equal(await page.locator('.arm-detail-dialog .arm-leaf-link[data-topic-id="roadmap-custom-leaf"]').innerText(), '自定义关卡知识点', 'custom gate sharing a known topic adds all its topic identities to the mapped route directory');
    await page.locator('.arm-detail-dialog .arm-leaf-link[data-topic-id="roadmap-custom-leaf"]').click();
    const customReading = page.locator('.arm-resource-dialog .alg-leaf-reading');
    assert.equal(await customReading.getAttribute('data-node-id'), 'roadmap-custom-leaf', 'new custom leaf opens the shared reader directly from the route selector');
    assert.deepEqual(await customReading.locator('h3').allTextContents(), ['简介', '精选笔记', '全部笔记']);
    assert.equal(await customReading.locator('.alg-note-title').innerText(), '自定义关卡叶子笔记');
    await customReading.locator('.alg-note-card[data-note-key="algorithm-notes/custom-leaf-resource.md"]').click();
    assert.equal(await page.locator('.arm-resource-dialog:visible').count(), 0);
    assert.equal(await page.locator('.reading-detail-view:visible .alg-reading-title').innerText(), '自定义关卡叶子笔记');
    assert.match(await page.locator('.reading-detail-path').innerText(), /学习路线/);
    await page.keyboard.press('Escape');
    await page.locator('.arm-index-button[data-node="offline"]').click();
    assert.equal(await page.locator('.arm-detail-title').innerText(), '离线与杂项');
    assert.match(await page.locator('.arm-detail-dialog').innerText(), /CDQ|莫队/);
    await page.keyboard.press('Escape');
    await node(page, 'g').click();
    await page.locator('.arm-resources-button').click();
    const resourceDialog = page.locator('.arm-resource-dialog');
    assert.match(await resourceDialog.locator('.arm-detail-title').innerText(), /目录/);
    assert.equal(await resourceDialog.locator('.arm-directory-introduction').count(), 1);
    assert.equal(await resourceDialog.locator('.arm-resource-card, .alg-note-card, .arm-official-list, .arm-personal-button').count(), 0, 'directory selector never aggregates notes or practice lists');
    assert.equal(await resourceDialog.evaluate(dialog => dialog.scrollTop), 0);
    const dialogBounds = await resourceDialog.boundingBox();
    await page.mouse.move(dialogBounds.x + dialogBounds.width / 2, dialogBounds.y + Math.min(dialogBounds.height / 2, 300));
    await page.mouse.wheel(0, 10000);
    await page.waitForFunction(() => { const dialog = document.querySelector('.arm-resource-dialog'); return dialog && dialog.scrollTop > 0; });
    assert.ok(await resourceDialog.locator('.arm-leaf-link').last().evaluate(link => { const bounds = link.closest('dialog').getBoundingClientRect(), box = link.getBoundingClientRect(); return box.top >= bounds.top && box.bottom <= bounds.bottom + 1; }), 'trusted wheel reaches final leaf choice below the long Markdown introduction');
    await resourceDialog.locator('.arm-leaf-link[data-topic-id="algorithm-万能头文件与标准库使用"]').click();
    const reading = resourceDialog.locator('.alg-leaf-reading');
    assert.deepEqual(await reading.locator('h3').allTextContents(), ['简介', '精选笔记', '全部笔记'], 'route leaf uses the same three shared reading sections');
    assert.equal(await reading.locator('.alg-introduction-markdown h2').innerText(), '叶子简介');
    assert.equal(await reading.locator('.alg-introduction-markdown strong').innerText(), '管理员内容', 'leaf introduction renders Markdown');
    assert.deepEqual(await reading.locator('.alg-featured-section .alg-note-title').allTextContents(), ['公开语法笔记', '第二篇精选笔记']);
    assert.deepEqual(await reading.locator('.alg-all-notes-section .alg-note-title').allTextContents(), ['普通语法笔记'], 'all notes excludes every curated note');
    assert.equal(await reading.locator('.alg-edit-leaf-content').count(), 0, 'non-admin cannot curate');
    await resourceDialog.locator('.arm-scope-button[data-scope="personal"]').click();
    assert.deepEqual(await reading.locator('.alg-note-title').allTextContents(), ['我的私密语法笔记'], 'personal range excludes other accounts and all public notes');
    await resourceDialog.locator('.arm-scope-button[data-scope="public"]').click();
    assert.equal(await reading.getByText('他人的私密语法笔记').count(), 0);
    await page.keyboard.press('Escape');
    await node(page, 'g').click();
    await page.locator('.arm-detail-dialog .arm-leaf-link[data-topic-id="algorithm-万能头文件与标准库使用"]').click();
    assert.equal(await page.locator('.arm-resource-dialog .alg-leaf-reading').getAttribute('data-node-id'), 'algorithm-万能头文件与标准库使用', 'directory leaf link opens shared reader directly');
    await page.keyboard.press('Escape');
    await node(page, 'g').click();
    await page.evaluate(() => { window.__roadmapSaveFail = true; });
    await page.locator('.arm-focus-button').click();
    await page.locator('.arm-focus-error').waitFor({ state: 'visible' });
    assert.equal(await node(page, 'g').getAttribute('data-focused'), 'false', 'failed save restores focus state');
    await page.evaluate(() => { window.__roadmapSaveFail = false; });
    await page.locator('.arm-focus-button').click();
    await page.waitForFunction(() => document.querySelector('.arm-node[data-node="g"]')?.dataset.focused === 'true' && !document.querySelector('.arm-focus-button')?.disabled);
    await page.keyboard.press('Escape');
    const saved = await assertPreserved(page);
    assert.ok(Object.values(saved.learningPaths).some(value => value.roadmapFocus), 'attention lives in learningPaths progress metadata');
    await page.reload(); await openRoute(page);
    assert.equal(await node(page, 'g').getAttribute('data-focused'), 'true', 'focus survives full reload');
    await page.evaluate(() => sessionStorage.setItem('roadmap-account', '99'));
    await page.reload(); await openRoute(page);
    assert.equal(await page.locator('.arm-position').count(), 0, 'another account does not inherit attention');
    await focus(page, 'hs');
    await page.evaluate(() => sessionStorage.setItem('roadmap-account', '42'));
    await page.reload(); await openRoute(page);
    assert.equal(await node(page, 'g').getAttribute('data-focused'), 'true', 'original account restores its attention');
    await page.evaluate(() => sessionStorage.setItem('roadmap-source', 'https://git.example.invalid/api/v1'));
    await page.reload(); await openRoute(page);
    assert.equal(await page.locator('.arm-position').count(), 0, 'same repository name on another server does not inherit attention');
    await focus(page, 'sz');
    await page.evaluate(() => sessionStorage.removeItem('roadmap-source'));
    await page.reload(); await openRoute(page);
    assert.equal(await node(page, 'g').getAttribute('data-focused'), 'true', 'switching back restores original source attention');
    await assertPreserved(page);
    await node(page, 'g').click();
    assert.equal(await page.locator('.arm-focus-button').getAttribute('aria-pressed'), 'true');
    await page.locator('.arm-focus-button').click();
    await page.waitForFunction(() => !document.querySelector('.arm-focus-button')?.disabled && document.querySelector('.arm-node[data-node="g"]')?.dataset.focused === 'false');
    await page.keyboard.press('Escape');
    await page.reload(); await openRoute(page);
    assert.equal(await page.locator('.arm-position').count(), 0, 'cancelling attention persists after reload');
    await assertPreserved(page);
    for (const theme of ['light', 'dark']) {
      await page.locator('#theme-select').selectOption(theme);
      await page.setViewportSize({ width: 390, height: 844 }); await tick(page);
      assert.equal(await page.locator('.arm').getAttribute('data-view'), 'graph', `${theme}: 390px keeps graph as default`);
      await page.locator('.arm-fit-button').click(); await assertFit(page, `${theme} mobile fit`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}: no mobile document overflow`);
      await page.locator('.arm-actual-button').click();
      assert.equal(await scale(page), 1);
      assert.ok(await page.locator('.arm-graph-scroll').evaluate(element => element.scrollWidth > element.clientWidth), '100% graph can pan inside mobile scroller');
      await page.locator('.arm-fit-button').click();
      await node(page, 'g').click();
      assert.ok(await page.locator('.arm-detail-dialog').evaluate(dialog => { const rect = dialog.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1 && dialog.scrollWidth <= dialog.clientWidth + 1; }), 'mobile detail stays inside viewport');
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 1500, height: 1100 });
    await page.evaluate(() => sessionStorage.setItem('roadmap-admin', 'true'));
    await page.reload(); await openRoute(page);
    for (const fail of [false, true]) {
      await node(page, 'g').click();
      await page.locator('.arm-detail-dialog:not(.arm-resource-dialog) .arm-edit-introduction').click();
      const pendingForm = page.locator('.arm-detail-dialog:not(.arm-resource-dialog) .arm-introduction-form');
      await pendingForm.locator('[name="introduction"]').fill(`## 延迟保存 ${fail}`);
      const settled = await page.evaluate(() => window.__roadmapSaveSettled);
      await page.evaluate(fail => { window.__roadmapPublicFail = fail; window.__roadmapHoldSave = true; window.__roadmapReleaseSave = null; }, fail);
      await pendingForm.locator('button[type="submit"]').click();
      await page.waitForFunction(() => typeof window.__roadmapReleaseSave === 'function');
      await page.keyboard.press('Escape');
      await node(page, 'hs').click();
      assert.equal(await page.locator('.arm-detail-dialog:not(.arm-resource-dialog) .arm-detail-title').innerText(), '函数');
      await page.evaluate(() => { window.__roadmapReleaseSave(); });
      await page.waitForFunction(before => window.__roadmapSaveSettled > before, settled);
      await tick(page);
      assert.equal(await page.locator('.arm-detail-dialog:not(.arm-resource-dialog) .arm-detail-title').innerText(), '函数', 'settled introduction save cannot overwrite a different open directory');
      assert.equal(await page.locator('.arm-detail-dialog:not(.arm-resource-dialog) .arm-focus-error:visible').count(), 0, 'stale failure cannot appear in the newly opened directory');
      await page.keyboard.press('Escape');
    }
    await page.evaluate(() => { window.__roadmapPublicFail = false; window.__roadmapNodeSaves = []; });
    await node(page, 'g').click(); await page.locator('.arm-resources-button').click();
    const adminDirectory = page.locator('.arm-resource-dialog');
    await adminDirectory.locator('.arm-edit-introduction').click();
    const introForm = adminDirectory.locator('.arm-introduction-form');
    await introForm.locator('[name="introduction"]').fill('## 修改后的目录介绍\n\n[资料](https://example.invalid/reference)');
    await page.evaluate(() => { window.__roadmapPublicFail = true; });
    await introForm.locator('button[type="submit"]').click();
    await introForm.locator('.arm-focus-error').filter({ hasText: '模拟公共保存失败' }).waitFor({ state: 'visible' });
    assert.match(await introForm.locator('[name="introduction"]').inputValue(), /修改后的目录介绍/, 'failed directory save retains draft');
    await page.evaluate(() => { window.__roadmapPublicFail = false; });
    await introForm.locator('button[type="submit"]').click();
    await introForm.waitFor({ state: 'hidden' });
    const directorySave = await page.evaluate(() => window.__roadmapNodeSaves.find(input => input.nodeId === 'roadmap:g'));
    assert.equal(directorySave.nodeId, 'roadmap:g', 'each route directory saves its own metadata identity');
    assert.deepEqual(directorySave.featuredNotePaths, [], 'directories never store curated note choices');
    assert.equal(await page.evaluate(() => window.__roadmapPublicSaves.length), 0, 'directory editing leaves every legacy gate description/goals/practice entry intact');
    assert.equal(await adminDirectory.locator('.arm-directory-markdown h2').innerText(), '修改后的目录介绍');
    assert.equal(await adminDirectory.locator('.alg-edit-leaf-content').count(), 0, 'directories never have curated-note UI');
    await adminDirectory.locator('.arm-leaf-link[data-topic-id="algorithm-万能头文件与标准库使用"]').click();
    await adminDirectory.locator('.alg-edit-leaf-content').click();
    const leafForm = page.locator('.alg-leaf-content-form');
    assert.equal(await leafForm.locator('[name="featuredNotePaths"]:checked').count(), 2);
    await leafForm.locator('[name="introduction"]').fill('## 新版叶子简介');
    await leafForm.locator('[name="featuredNotePaths"][value="algorithm-notes/public-ordinary.md"]').check();
    await page.evaluate(() => { window.__roadmapPublicFail = true; });
    await leafForm.locator('button[type="submit"]').click();
    await leafForm.locator('.alg-inline-error').filter({ hasText: '模拟公共保存失败' }).waitFor({ state: 'visible' });
    assert.equal(await leafForm.locator('[name="introduction"]').inputValue(), '## 新版叶子简介');
    await page.evaluate(() => { window.__roadmapPublicFail = false; });
    await leafForm.locator('button[type="submit"]').click();
    await leafForm.waitFor({ state: 'hidden' });
    const leafSave = await page.evaluate(() => window.__roadmapNodeSaves.find(input => input.nodeId === 'algorithm-万能头文件与标准库使用'));
    assert.equal(leafSave.nodeId, 'algorithm-万能头文件与标准库使用');
    assert.deepEqual(leafSave.featuredNotePaths, ['algorithm-notes/public-resource.md', 'algorithm-notes/public-second.md', 'algorithm-notes/public-ordinary.md']);
    assert.equal(await adminDirectory.locator('.alg-featured-section .alg-note-card').count(), 3);
    assert.equal(await adminDirectory.locator('.alg-all-notes-section .alg-note-card').count(), 0);
    await page.keyboard.press('Escape');
    await assertPreserved(page);
    assert.equal(await page.evaluate(() => window.__roadmapWrites), 0);
    assert.deepEqual(errors, [], 'no renderer errors');
    console.log('PASS learning roadmap UI: approved 33 nodes/38 edges, stages above graph, fit/100%/zoom/resize, graph/list/search, directory Markdown/leaf links, custom gate known/custom topic mapping and shared reader, curated multi-note partition, personal-account scope, admin Markdown save failure/retry, preserved legacy data, account/source isolation, reload, light/dark 390px, no remote writes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
