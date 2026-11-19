'use strict';

// Run after pnpm build:app: node tests/algorithm-interaction-ui-smoke.cjs
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');
const tree = require(appPath('ui/algorithm-tree.js'));
const entries = [];
(function walk(node, ancestors = []) {
  entries.push({ node, ancestors });
  (node.children || []).forEach(child => walk(child, [...ancestors, node]));
})(tree);
const byId = new Map(entries.map(entry => [entry.node.id, entry]));
const levels = { basic: '入门', beginner: '初级', intermediate: '中级', advanced: '高级', expert: '挑战' };
const topic = entries.find(({ node }) => levels[node.color] && !node.children?.length);
assert.ok(topic, 'built directory contains a graded algorithm for nested badge coverage');
const rowSelector = id => `.alg-tree-item[data-node-id="${id}"] > .alg-tree-row`;
const itemSelector = id => `.alg-tree-item[data-node-id="${id}"]`;
const rowText = id => {
  const { node, ancestors } = byId.get(id);
  return [...ancestors, node].map(node => node.label).join(' / ')
    + (node.fullLabel && node.fullLabel !== node.label ? `\n${node.fullLabel}` : '');
};

async function openAlgorithms(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  // Only the host bridge is a fixture: all markup, application code, styles and
  // curriculum data come from the actual build, with no network or remote writes.
  await page.addInitScript(() => {
    window.notebook = {
      bootstrap: async () => ({
        records: [], issues: [], algorithmNotes: [],
        account: { id: 42, login: 'interaction-fixture' },
        permissions: { repo: 'test/notebook', push: false, admin: false },
        settings: { repo: 'test/notebook', autoSync: false },
        local: { records: [], favorites: [], mastery: {}, draft: {} },
      }),
      updateLocal: async () => {},
      saveSettings: async settings => settings,
      openExternal: async () => {},
    };
  });
  await page.goto(pathToFileURL(appPath('ui/index.html')).href);
  await page.locator('.rail-nav-item[data-view="algorithms"]').click();
  await page.locator('.alg-browser').waitFor();
  await page.mouse.move(1400, 900);
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  for (const ancestor of topic.ancestors) {
    const item = page.locator(itemSelector(ancestor.id));
    if (await item.getAttribute('aria-expanded') === 'false') {
      await page.locator(rowSelector(ancestor.id)).locator('button.alg-disclosure').click();
    }
  }
  return page;
}

async function immediateTooltip(page, selector, expected, label) {
  const result = await page.locator(selector).evaluate(target => {
    target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    // Inspect in the dispatching task: Playwright auto-waiting would hide a
    // delayed tooltip regression and cannot establish immediate feedback.
    const tooltip = document.querySelector('[role="tooltip"]');
    const rect = tooltip?.getBoundingClientRect();
    return {
      visible: Boolean(tooltip && !tooltip.hidden && getComputedStyle(tooltip).visibility !== 'hidden' && rect.width && rect.height),
      text: tooltip?.textContent,
      described: Boolean(tooltip?.id && (target.closest('[aria-describedby]')?.getAttribute('aria-describedby') || '').split(/\s+/).includes(tooltip.id)),
    };
  });
  assert.ok(result.visible, `${label}: tooltip must be visible synchronously after pointerover`);
  if (expected instanceof RegExp) assert.match(result.text, expected, `${label}: tooltip text`);
  else assert.equal(result.text, expected, `${label}: tooltip text`);
  assert.ok(result.described, `${label}: tooltip is associated with its trigger`);
}

async function assertTooltipHidden(page, label) {
  assert.equal(await page.locator('[role="tooltip"]:visible').count(), 0, label);
}

async function assertTooltipClamped(page, label) {
  const bounds = await page.locator('[role="tooltip"]:visible').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  assert.ok(bounds.left >= -0.5 && bounds.right <= bounds.width + 0.5 && bounds.top >= -0.5 && bounds.bottom <= bounds.height + 0.5,
    `${label}: tooltip stays within the viewport: ${JSON.stringify(bounds)}`);
}

async function checkTooltipsAndSelection(page, theme) {
  await page.locator('#theme-select').selectOption(theme);
  await page.waitForFunction(theme => document.body.dataset.theme === theme, theme);
  const target = page.locator(rowSelector(topic.node.id));
  await target.scrollIntoViewIfNeeded();
  // Let any real scroll event finish before dispatching a pointer event.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const selectedBefore = await page.locator('.alg-tree-item[aria-selected="true"]').getAttribute('data-node-id');
  await immediateTooltip(page, rowSelector(topic.node.id), rowText(topic.node.id), `${theme} row`);
  await immediateTooltip(page, `${rowSelector(topic.node.id)} .alg-tree-label`, rowText(topic.node.id), `${theme} nested row label`);
  await immediateTooltip(page, `${rowSelector(topic.node.id)} .alg-badge`, new RegExp(`^学习难度：${levels[topic.node.color]}；依据：`), `${theme} nested badge`);
  if (topic.node.scope) assert.ok((await page.locator('[role="tooltip"]:visible').textContent()).includes(topic.node.scope), 'badge describes the algorithm scope');
  const otherId = topic.ancestors.at(-1).id;
  await immediateTooltip(page, rowSelector(otherId), rowText(otherId), `${theme} switching rows replaces badge text`);
  assert.equal(await page.locator('.alg-tree-item[aria-selected="true"]').getAttribute('data-node-id'), selectedBefore, 'hover never changes selection');

  // Keep references to all visible items and rows across an ordinary selection.
  // This detects tree reconstruction directly, without fragile time thresholds.
  await page.evaluate(() => {
    window.__interactionRows = Array.from(document.querySelectorAll('.alg-tree-item')).map(item => ({ item, row: item.querySelector(':scope > .alg-tree-row') }));
    window.__interactionScroll = document.querySelector('.alg-tree-scroll').scrollTop;
  });
  await target.locator('.alg-tree-label').click();
  assert.equal(await page.locator(itemSelector(topic.node.id)).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.alg-tree-item[aria-selected="true"]').count(), 1);
  assert.equal(await page.locator('.alg-detail-title').textContent(), topic.node.fullLabel || topic.node.label);
  const retained = await page.evaluate(() => ({
    count: window.__interactionRows.length,
    identical: window.__interactionRows.every(({ item, row }) => item.isConnected && row.isConnected
      && item === document.querySelector(`.alg-tree-item[data-node-id="${item.dataset.nodeId}"]`)
      && row === item.querySelector(':scope > .alg-tree-row')),
    scrollDelta: document.querySelector('.alg-tree-scroll').scrollTop - window.__interactionScroll,
  }));
  assert.ok(retained.count > 2 && retained.identical, `${theme}: selecting a visible node retains existing tree DOM identity`);
  assert.ok(Math.abs(retained.scrollDelta) <= 1, `${theme}: selecting an already visible node preserves tree scroll`);

  // Real pointer hover must distinguish an unselected directory immediately,
  // while the selected algorithm retains its selected presentation.
  await page.locator(rowSelector(otherId)).scrollIntoViewIfNeeded();
  await page.mouse.move(1400, 900);
  const idle = await page.locator(rowSelector(otherId)).evaluate(row => ({ background: getComputedStyle(row).backgroundColor, border: getComputedStyle(row).borderTopColor }));
  await page.locator(rowSelector(otherId)).evaluate(row => {
    row.addEventListener('pointerover', () => {
      window.__interactionHover = { background: getComputedStyle(row).backgroundColor, border: getComputedStyle(row).borderTopColor };
    }, { once: true });
  });
  await page.locator(rowSelector(otherId)).hover();
  const hover = await page.evaluate(() => window.__interactionHover);
  assert.ok(hover && (hover.background !== idle.background || hover.border !== idle.border), `${theme}: row hover feedback appears in its pointerover task`);
  assert.equal(await page.locator(itemSelector(topic.node.id)).getAttribute('aria-selected'), 'true', 'hovering another row retains selected state');

  await page.mouse.move(1400, 900);
  await assertTooltipHidden(page, `${theme}: leaving the algorithm trigger hides the tooltip`);
  await page.locator(itemSelector(topic.node.id)).focus();
  await page.keyboard.press('ArrowUp');
  const focused = await page.evaluate(() => document.activeElement.dataset.nodeId);
  assert.ok(focused && focused !== topic.node.id, 'keyboard moves to a different visible row');
  assert.equal(await page.locator('[role="tooltip"]:visible').textContent(), rowText(focused), `${theme}: keyboard focus exposes its row description`);
  await page.keyboard.press('Escape');
  await assertTooltipHidden(page, `${theme}: Escape dismisses keyboard tooltip`);

  await immediateTooltip(page, rowSelector(topic.node.id), rowText(topic.node.id), `${theme} before pointerdown`);
  await target.dispatchEvent('pointerdown', { pointerType: 'mouse' });
  await assertTooltipHidden(page, `${theme}: pointerdown dismisses tooltip`);
  await immediateTooltip(page, rowSelector(topic.node.id), rowText(topic.node.id), `${theme} before native scroll`);
  const scroller = page.locator('.alg-tree-scroll');
  await scroller.evaluate(element => { element.scrollTop = element.scrollTop > 0 ? 0 : 100; });
  await page.waitForFunction(() => !document.querySelector('[role="tooltip"]') || document.querySelector('[role="tooltip"]').hidden);
  await assertTooltipHidden(page, `${theme}: real scroll dismisses tooltip`);
}

async function nativeWheelChaining(page, selector, label) {
  const scroller = page.locator(selector);
  const geometry = await scroller.evaluate(element => {
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
    element.scrollTop = 0;
    return { client: element.clientHeight, content: element.scrollHeight };
  });
  assert.ok(geometry.content > geometry.client + 100, `${label}: fixture genuinely overflows internally`);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  let box = await scroller.boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= 845, `${label}: wheel target is inside the 390px viewport`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const outerBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 180);
  await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 30, selector);
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - outerBefore) <= 1, `${label}: interior wheel scrolls the inner panel first`);

  await scroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const boundary = await page.evaluate(selector => ({
    outer: scrollY, remaining: document.documentElement.scrollHeight - innerHeight - scrollY,
    inner: document.querySelector(selector).scrollTop,
  }), selector);
  assert.ok(boundary.remaining > 100, `${label}: outer page has room beyond inner bottom boundary`);
  await page.mouse.wheel(0, 300);
  await page.waitForFunction(before => scrollY > before + 30, boundary.outer);
  assert.ok(Math.abs((await scroller.evaluate(element => element.scrollTop)) - boundary.inner) <= 1, `${label}: inner remains at bottom while wheel chains to outer page`);

  await scroller.evaluate(element => {
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
    element.scrollTop = 0;
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  box = await scroller.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const topOuter = await page.evaluate(() => scrollY);
  assert.ok(topOuter > 100, `${label}: outer page can scroll above inner top boundary`);
  await page.mouse.wheel(0, -300);
  await page.waitForFunction(before => scrollY < before - 30, topOuter);
  assert.equal(await scroller.evaluate(element => element.scrollTop), 0, `${label}: top boundary chains wheel upward`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    const page = await openAlgorithms(browser, errors);
    for (const theme of ['light', 'dark']) await checkTooltipsAndSelection(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of ['light', 'dark']) {
      await page.locator('#theme-select').selectOption(theme);
      await page.locator(rowSelector(topic.node.id)).scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await immediateTooltip(page, rowSelector(topic.node.id), rowText(topic.node.id), `${theme} 390px row`);
      await assertTooltipClamped(page, `${theme} 390px row`);
      await immediateTooltip(page, `${rowSelector(topic.node.id)} .alg-badge`, new RegExp(`^学习难度：${levels[topic.node.color]}；依据：`), `${theme} 390px badge`);
      await assertTooltipClamped(page, `${theme} 390px badge`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}: no 390px document overflow`);
    }
    await nativeWheelChaining(page, '.alg-tree-scroll', '390px knowledge tree');

    // Switch modes with a live tooltip: disposal removes it and its listeners.
    await immediateTooltip(page, rowSelector(topic.node.id), rowText(topic.node.id), 'before switching to learning roadmap');
    const oldTrigger = await page.locator(rowSelector(topic.node.id)).elementHandle();
    await page.locator('[data-mode="path"]').click();
    await page.locator('.arm').waitFor();
    assert.equal(await page.locator('.alg-tooltip').count(), 0, 'switching to learning roadmap destroys the tree tooltip');
    await oldTrigger.evaluate(target => target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })));
    assert.equal(await page.locator('.alg-tooltip').count(), 0, 'discarded tree cannot recreate a tooltip');
    await oldTrigger.dispose();
    await page.locator('.arm-actual-button').click();
    // The approved roadmap uses outer-page vertical scrolling and native inner
    // horizontal panning at 100%; retain real wheel coverage for this layout.
    const graph = page.locator('.arm-graph-scroll');
    await graph.evaluate(element => { element.scrollIntoView({ block: 'start', behavior: 'instant' }); element.scrollLeft = 0; });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const graphGeometry = await graph.evaluate(element => ({ client: element.clientWidth, content: element.scrollWidth, vertical: element.scrollHeight - element.clientHeight }));
    assert.ok(graphGeometry.content > graphGeometry.client + 100, `390px actual-size roadmap genuinely overflows horizontally: ${JSON.stringify(graphGeometry)}`);
    assert.ok(graphGeometry.vertical <= 1, 'approved roadmap leaves vertical scrolling to the page');
    const graphBox = await graph.boundingBox();
    await page.mouse.move(graphBox.x + graphBox.width / 2, Math.max(40, graphBox.y + 120));
    await page.mouse.wheel(220, 0);
    await page.waitForFunction(() => document.querySelector('.arm-graph-scroll').scrollLeft > 30);
    const graphOuter = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 240);
    await page.waitForFunction(before => scrollY > before + 30, graphOuter);
    assert.equal(await graph.evaluate(element => element.scrollTop), 0, 'vertical wheel scrolls the page while graph keeps native horizontal position');
    await page.locator('[data-mode="tree"]').click();
    await page.locator('.alg-browser').waitFor();
    assert.equal(await page.locator('.alg-tooltip').count(), 1, 'returning to the tree creates exactly one tooltip');
    assert.equal(await page.locator(itemSelector(topic.node.id)).getAttribute('aria-selected'), 'true', 'mode switch retains selected algorithm');
    assert.deepEqual(errors, [], 'no renderer exceptions');
    console.log('PASS algorithm interactions: synchronous row/nested badge tooltips, switching, hover/selection, retained tree DOM, focus/Escape/leave/pointerdown/scroll, disposal, light/dark, 390px clamp, native tree wheel chaining, roadmap horizontal pan and page scrolling');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
