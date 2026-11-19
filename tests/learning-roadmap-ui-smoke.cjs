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
    await page.addInitScript(({ initial, storage }) => {
      let local = JSON.parse(localStorage.getItem(storage) || JSON.stringify(initial));
      const account = Number(sessionStorage.getItem('roadmap-account') || 42);
      const serverUrl = sessionStorage.getItem('roadmap-source') || '';
      const admin = sessionStorage.getItem('roadmap-admin') === 'true';
      window.__roadmapSaveFail = false; window.__roadmapPublicFail = false; window.__roadmapPublicSaves = []; window.__roadmapWrites = 0; window.__roadmapExternal = [];
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], algorithmNotes: [
          { id: 'public-resource', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'public', kind: 'algorithm-note', title: '公开语法笔记', authorId: 7, body: '公开资源' },
          { id: 'own-private-resource', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'personal', kind: 'algorithm-note', title: '我的私密语法笔记', authorId: account, body: '仅知识树个人范围' },
          { id: 'foreign-private-resource', nodeId: 'algorithm-万能头文件与标准库使用', noteScope: 'personal', kind: 'algorithm-note', title: '他人的私密语法笔记', authorId: 9001, body: '绝不能出现在公开资源' },
        ], learningGateContents: [{
          gateId: 'lp2-cpp-toolkit-program-flow-types-io', description: '管理员已保存的输入输出资料', goals: ['核验整数范围'],
          practiceList: { title: '已保存的官方题单', url: 'https://example.invalid/official-saved-list' }, sha: 'a'.repeat(40),
          updatedAt: '2026-11-19T00:00:00Z', author: { id: 7, login: 'fixture-admin' }, repo: 'test/notebook',
        }],
          account: { id: account, login: 'roadmap-fixture' }, permissions: { repo: 'test/notebook', push: false, admin },
          settings: { repo: 'test/notebook', serverUrl, autoSync: false }, local: structuredClone(local) }),
        updateLocal: async value => { if (window.__roadmapSaveFail) throw Error('模拟本地保存失败'); local = structuredClone(value); localStorage.setItem(storage, JSON.stringify(local)); },
        saveSettings: async settings => settings,
        openExternal: async url => window.__roadmapExternal.push(url),
        saveAlgorithmNote: async () => { window.__roadmapWrites++; throw Error('No remote writes in roadmap smoke'); },
        saveLearningGate: async input => { if (!admin) { window.__roadmapWrites++; throw Error('Non-admin write'); } if (window.__roadmapPublicFail) throw Error('模拟公共保存失败'); window.__roadmapPublicSaves.push(structuredClone(input)); return { ...input, sha: 'b'.repeat(40), updatedAt: '2026-11-19T00:00:00Z', author: { id: account, login: 'fixture-admin' } }; },
      };
    }, { storage: STORAGE, initial: { records: [], favorites: ['retained-favorite'], mastery: { keep: 0 }, draft: {}, learningPaths: { [legacyKey]: progress, 'unrelated-source-account': { gates: { other: { status: 'completed' } }, custom: false } } } });
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
    assert.ok(await page.locator('.arm-relation-button[data-node="hs"]').count());
    await page.locator('.arm-relation-button[data-node="hs"]').click();
    assert.equal(await page.locator('.arm-detail-title').innerText(), '函数');
    assert.equal(await page.locator('.arm-detail-dialog:visible').count(), 1, 'relation navigation reuses one popup');
    await page.keyboard.press('Escape');
    await page.locator('.arm-index-button[data-node="offline"]').click();
    assert.equal(await page.locator('.arm-detail-title').innerText(), '离线与杂项');
    assert.match(await page.locator('.arm-detail-dialog').innerText(), /CDQ|莫队/);
    await page.keyboard.press('Escape');
    await node(page, 'g').click();
    await page.locator('.arm-resources-button').click();
    const resourceDialog = page.locator('.arm-resource-dialog');
    const resourceCards = resourceDialog.locator('.arm-resource-card');
    assert.ok(await resourceCards.count() >= 8, 'C++ resources exercise a real multi-card dialog');
    const beforeWheel = await resourceDialog.evaluate(dialog => {
      const last = dialog.querySelector('.arm-resource-card:last-of-type').getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      return { scrollTop: dialog.scrollTop, overflows: dialog.scrollHeight > dialog.clientHeight, lastBelow: last.bottom > Math.min(bounds.bottom, innerHeight) };
    });
    assert.equal(beforeWheel.scrollTop, 0, 'resource dialog starts at its first card');
    assert.ok(beforeWheel.overflows && beforeWheel.lastBelow, 'last resource card initially requires scrolling at 900px viewport height');
    const dialogBounds = await resourceDialog.boundingBox();
    await page.mouse.move(dialogBounds.x + dialogBounds.width / 2, dialogBounds.y + Math.min(dialogBounds.height / 2, 300));
    await page.mouse.wheel(0, 10000);
    await page.waitForFunction(() => {
      const dialog = document.querySelector('.arm-resource-dialog');
      const card = dialog?.querySelector('.arm-resource-card:last-of-type');
      if (!dialog || !card || dialog.scrollTop <= 0) return false;
      const bounds = dialog.getBoundingClientRect(), last = card.getBoundingClientRect();
      return last.top >= Math.max(bounds.top, 0) && last.bottom <= Math.min(bounds.bottom, innerHeight) + 1;
    });
    assert.ok(await resourceDialog.evaluate(dialog => dialog.scrollTop > 0), 'trusted mouse wheel scrolls resource dialog');
    assert.ok(await resourceCards.last().evaluate(card => {
      const bounds = card.closest('dialog').getBoundingClientRect(), last = card.getBoundingClientRect();
      return last.top >= Math.max(bounds.top, 0) && last.bottom <= Math.min(bounds.bottom, innerHeight) + 1;
    }), 'trusted wheel brings the complete last resource card into view');
    await page.mouse.wheel(0, -10000);
    await page.waitForFunction(() => document.querySelector('.arm-resource-dialog')?.scrollTop === 0);
    const resource = page.locator('.arm-resource-card[data-gate-id="lp2-cpp-toolkit-program-flow-types-io"]');
    assert.match(await resource.innerText(), /管理员已保存的输入输出资料/);
    assert.match(await resource.innerText(), /核验整数范围/);
    assert.equal(await resource.locator('.arm-note[data-note-id="public-resource"]').count(), 1);
    assert.equal(await page.locator('.arm-note[data-note-id="own-private-resource"], .arm-note[data-note-id="foreign-private-resource"]').count(), 0, 'route resources include public notes only, excluding own and foreign personal notes');
    const official = resource.locator('.arm-official-list');
    assert.equal(await official.innerText(), '官方精选题单 · 已保存的官方题单 ↗');
    await official.click();
    assert.deepEqual(await page.evaluate(() => window.__roadmapExternal), ['https://example.invalid/official-saved-list'], 'official title/URL come from saved public content');
    assert.equal(await page.locator('.arm-resource-edit').count(), 0, 'non-admin has no public editing control');
    const topic = resource.locator('.arm-topic-link[data-topic-id="algorithm-万能头文件与标准库使用"]');
    await topic.click();
    assert.equal(await page.locator('.alg-tree-item[aria-selected="true"]').getAttribute('data-node-id'), 'algorithm-万能头文件与标准库使用', 'resource opens the exact mapped knowledge topic');
    await page.getByRole('button', { name: /在学习路线中查看/ }).click();
    assert.equal(await page.locator('.arm-detail-title').innerText(), 'C++ 基础语法', 'mapped topic returns to the real graph node');
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
    await node(page, 'g').click(); await page.locator('.arm-resources-button').click();
    const adminResource = page.locator('.arm-resource-card[data-gate-id="lp2-cpp-toolkit-program-flow-types-io"]');
    await adminResource.locator('.arm-resource-edit').click();
    const form = page.locator('.arm-resource-form');
    assert.equal(await form.locator('[name="practiceTitle"]').inputValue(), '已保存的官方题单');
    await form.locator('[name="description"]').fill('修改后的公共介绍');
    await form.locator('[name="goals"]').fill('目标甲\n目标乙');
    await form.locator('[name="practiceTitle"]').fill('新版官方题单');
    await form.locator('[name="practiceUrl"]').fill('javascript:alert(1)');
    await form.locator('button[type="submit"]').click();
    await form.locator('.arm-focus-error').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => window.__roadmapPublicSaves.length), 0, 'unsafe URL is rejected before public bridge call');
    await form.locator('[name="practiceUrl"]').fill('https://example.invalid/new-official');
    await page.evaluate(() => { window.__roadmapPublicFail = true; });
    await form.locator('button[type="submit"]').click();
    await form.locator('.arm-focus-error').filter({ hasText: '模拟公共保存失败' }).waitFor({ state: 'visible' });
    assert.equal(await form.locator('[name="description"]').inputValue(), '修改后的公共介绍', 'failed save retains draft');
    await page.evaluate(() => { window.__roadmapPublicFail = false; });
    await form.locator('button[type="submit"]').click();
    await form.waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => window.__roadmapPublicSaves), [{ repo: 'test/notebook', gateId: 'lp2-cpp-toolkit-program-flow-types-io', description: '修改后的公共介绍', goals: ['目标甲', '目标乙'], practiceList: { title: '新版官方题单', url: 'https://example.invalid/new-official' }, sha: 'a'.repeat(40) }], 'admin form passes existing public-content contract to mocked bridge');
    assert.equal(await adminResource.locator('.arm-official-list').innerText(), '官方精选题单 · 新版官方题单 ↗');
    await adminResource.locator('.arm-personal-button').click();
    const personal = page.locator('.arm-personal-form');
    await personal.locator('[name="practiceUrl"]').fill('https://example.invalid/personal-practice');
    await page.evaluate(() => { window.__roadmapSaveFail = true; });
    await personal.locator('button[type="submit"]').click();
    await personal.locator('.arm-focus-error').waitFor({ state: 'visible' });
    await page.evaluate(() => { window.__roadmapSaveFail = false; });
    await personal.locator('button[type="submit"]').click();
    await personal.waitFor({ state: 'hidden' });
    assert.equal(await adminResource.locator('.arm-personal-link').count(), 1);
    const withPersonal = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE);
    const scopedKey = JSON.stringify(['https://api.github.com|test/notebook', '42', curriculum.id]);
    assert.deepEqual(withPersonal.learningPaths[scopedKey].gates['lp2-cpp-toolkit-program-flow-types-io'], { ...originalGates['lp2-cpp-toolkit-program-flow-types-io'], practiceUrl: 'https://example.invalid/personal-practice' }, 'personal practice URL keeps completion/tasks/opaque fields');
    assert.deepEqual(withPersonal.learningPaths[legacyKey].gates, originalGates, 'personal editor does not modify legacy data');
    assert.equal(await page.evaluate(() => window.__roadmapPublicSaves.length), 1, 'personal editor never invokes public saving');
    await page.keyboard.press('Escape');
    await page.reload(); await openRoute(page);
    await node(page, 'g').click(); await page.locator('.arm-resources-button').click();
    await page.locator('.arm-resource-card[data-gate-id="lp2-cpp-toolkit-program-flow-types-io"] .arm-personal-button').click();
    assert.equal(await page.locator('.arm-personal-form [name="practiceUrl"]').inputValue(), 'https://example.invalid/personal-practice', 'personal list restores after reload');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.__roadmapWrites), 0);
    assert.deepEqual(errors, [], 'no renderer errors');
    console.log('PASS learning roadmap UI: approved 33 nodes/38 edges, stages above graph, fit/100%/zoom/resize, graph/list/search, popup relationships/offline index, trusted resource wheel/last-card access, save failure/retry, preserved legacy data, account/source isolation, reload, light/dark 390px, no remote writes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
