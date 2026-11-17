'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

const OPTIONS = '#tag-picker-dialog-options';
const HISTORY = '旧标签（绘制回归夹具）';

async function backdrop(page, selector) {
  return page.locator(selector).evaluate(node => getComputedStyle(node, '::backdrop').backdropFilter);
}

async function assertClosed(page, submitBlur) {
  assert.equal(await page.locator('#tag-picker-dialog').evaluate(node => node.open), false);
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('tag-picker-open')), false, 'every closing path removes the shared opening class');
  assert.equal(await backdrop(page, '#submit-dialog'), submitBlur, 'closing the picker restores the editor backdrop');
}

async function openPicker(page, entry, submitBlur) {
  await page.click(entry === 'filter' ? '#tag-filter-trigger' : '#record-tag-open');
  assert.equal(await page.locator('#tag-picker-dialog').evaluate(node => node.open), true);
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('tag-picker-open')), true, `${entry} uses the shared opening class`);
  assert.equal(await backdrop(page, '#tag-picker-dialog'), 'none', 'the top picker backdrop does not blur');
  assert.equal(await backdrop(page, '#submit-dialog'), 'none', 'the underlying editor backdrop does not blur while either entry is open');
  assert.equal(await page.locator(`${OPTIONS} .tag-category-heading`).count(), 23, '22 real preset categories plus historical tags');
  assert.equal(await page.locator(`${OPTIONS} input`).count(), 263, 'all 262 real preset options plus the historical option are present');
  assert.equal(submitBlur, 'blur(3px)', 'the normal editor backdrop retains its original blur');
}

async function beginObservation(page) {
  await page.evaluate(() => {
    const host = document.querySelector('#tag-picker-dialog-options');
    const list = document.querySelector('#record-list');
    const state = { inputs: [...host.querySelectorAll('input')], labels: [...host.querySelectorAll('.facet-option')], cards: [...list.children], optionChanges: 0, listChanges: 0, scrollEvents: 0 };
    state.optionObserver = new MutationObserver(records => { state.optionChanges += records.length; });
    state.listObserver = new MutationObserver(records => { state.listChanges += records.length; });
    state.optionObserver.observe(host, { childList: true, subtree: true });
    state.listObserver.observe(list, { childList: true, subtree: true, attributes: true, characterData: true });
    state.onScroll = () => { state.scrollEvents++; };
    host.addEventListener('scroll', state.onScroll);
    state.headings = [...host.querySelectorAll('.tag-category-heading')].map(node => ({ node, top: node.getBoundingClientRect().top + host.scrollTop }));
    window.tagPaintObservation = state;
  });
}

async function endObservation(page, context) {
  const result = await page.evaluate(() => {
    const state = window.tagPaintObservation;
    const host = document.querySelector('#tag-picker-dialog-options');
    state.optionChanges += state.optionObserver.takeRecords().length;
    state.listChanges += state.listObserver.takeRecords().length;
    state.optionObserver.disconnect();
    state.listObserver.disconnect();
    host.removeEventListener('scroll', state.onScroll);
    return { optionChanges: state.optionChanges, listChanges: state.listChanges, scrollEvents: state.scrollEvents,
      inputsRetained: state.inputs.every((node, index) => node === host.querySelectorAll('input')[index]),
      labelsRetained: state.labels.every((node, index) => node === host.querySelectorAll('.facet-option')[index]),
      cardsRetained: state.cards.every((node, index) => node === document.querySelector('#record-list').children[index]) };
  });
  assert.equal(result.optionChanges, 0, `${context}: search/selection/scroll retain option DOM`);
  assert.equal(result.listChanges, 0, `${context}: staged activity never mutates the global list`);
  assert.equal(result.inputsRetained, true, `${context}: checkbox identity is stable`);
  assert.equal(result.labelsRetained, true, `${context}: label identity is stable`);
  assert.equal(result.cardsRetained, true, `${context}: global record identity is stable`);
  return result;
}

async function scrollMetrics(page) {
  return page.locator(OPTIONS).evaluate(host => ({ top: host.scrollTop, max: host.scrollHeight - host.clientHeight }));
}

async function wheelTo(page, where) {
  const rect = await page.locator(OPTIONS).boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const before = await scrollMetrics(page);
  const target = where === 'bottom' ? before.max : where === 'middle' ? before.max / 2 : 0;
  // Use the native wheel path; do not set scrollTop or synthesize DOM wheel events.
  await page.mouse.wheel(0, target - before.top);
  await page.waitForFunction(({ selector, target }) => Math.abs(document.querySelector(selector).scrollTop - target) <= 2, { selector: OPTIONS, target });
  return scrollMetrics(page);
}

async function hitAndHover(page, context) {
  const geometry = await page.locator(OPTIONS).evaluate(host => {
    const bounds = host.getBoundingClientRect();
    const visible = [...host.querySelectorAll('.facet-option')].filter(label => {
      const rect = label.getBoundingClientRect();
      return !label.hidden && rect.top >= bounds.top + 2 && rect.bottom <= bounds.bottom - 2;
    });
    const candidates = [...new Set([visible[0], visible[Math.floor(visible.length / 2)], visible.at(-1)])].filter(Boolean);
    const headings = window.tagPaintObservation.headings;
    return { rows: candidates.map(label => {
      const input = label.querySelector('input'), text = label.querySelector('span');
      const checkbox = input.getBoundingClientRect(), caption = text.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      return { index: [...host.querySelectorAll('.facet-option')].indexOf(label), value: input.value,
        checkbox: { x: checkbox.x + checkbox.width / 2, y: checkbox.y + checkbox.height / 2 },
        text: { x: caption.x + Math.min(caption.width / 2, 30), y: Math.min(caption.y + caption.height / 2, labelRect.bottom - 2) } };
    }),
    headingsStatic: headings.every(({ node }) => getComputedStyle(node).position === 'static' && getComputedStyle(node).zIndex === 'auto'),
    headingDrift: Math.max(...headings.map(({ node, top }) => Math.abs(node.getBoundingClientRect().top + host.scrollTop - top))),
    pastHeadings: headings.filter(({ top }) => top < bounds.top + host.scrollTop - 50).length,
    pinnedPastHeadings: headings.filter(({ node, top }) => top < bounds.top + host.scrollTop - 50 && node.getBoundingClientRect().bottom > bounds.top).length,
    contain: getComputedStyle(host).contain, isolation: getComputedStyle(host).isolation };
  });
  assert.ok(geometry.rows.length >= 2, `${context}: visible row candidates exist`);
  assert.equal(geometry.headingsStatic, true, `${context}: all headings, including history, are static`);
  assert.ok(geometry.headingDrift <= 1, `${context}: previous headings scroll away without accumulating (${geometry.headingDrift}px drift)`);
  assert.equal(geometry.pinnedPastHeadings, 0, `${context}: old headings do not overlay live rows`);
  assert.match(geometry.contain, /\blayout\b/);
  assert.match(geometry.contain, /\bpaint\b/);
  assert.equal(geometry.isolation, 'isolate');
  for (const row of geometry.rows) {
    for (const part of ['checkbox', 'text']) {
      await page.mouse.move(row[part].x, row[part].y);
      // This must be the very next evaluation: no hover retry, timeout, or frame wait.
      const actual = await page.evaluate(({ index, point, part }) => {
        const label = document.querySelectorAll('#tag-picker-dialog-options .facet-option')[index];
        const hit = document.elementFromPoint(point.x, point.y);
        const style = getComputedStyle(label);
        const probe = document.createElement('i');
        probe.style.backgroundColor = 'var(--accent-soft)';
        probe.style.color = 'var(--accent)';
        document.querySelector('#tag-picker-dialog').append(probe);
        const expected = { background: getComputedStyle(probe).backgroundColor, accent: getComputedStyle(probe).color };
        probe.remove();
        return { hover: label.matches(':hover'), hitRow: hit?.closest('.facet-option') === label,
          hitPart: part === 'checkbox' ? hit === label.querySelector('input') : hit === label.querySelector('span'),
          background: style.backgroundColor, expected, shadow: style.boxShadow,
          transitions: style.transitionDuration, animation: style.animationName };
      }, { index: row.index, point: row[part], part });
      assert.equal(actual.hitRow, true, `${context}/${row.value}/${part}: hit testing reaches this row`);
      assert.equal(actual.hitPart, true, `${context}/${row.value}/${part}: no heading intercepts the pointer`);
      assert.equal(actual.hover, true);
      assert.equal(actual.background, actual.expected.background, `${context}/${part}: hover background is immediate`);
      assert.ok(actual.shadow.includes(actual.expected.accent), `${context}/${part}: inset marker uses accent color`);
      assert.match(actual.shadow, /inset/);
      assert.match(actual.shadow, /3px 0px 0px 0px/);
      assert.ok(actual.transitions.split(',').every(value => Number.parseFloat(value) === 0), 'hover has no transition');
      assert.equal(actual.animation, 'none');
    }
  }
  return { rows: geometry.rows.length, pastHeadings: geometry.pastHeadings, historyHit: geometry.rows.some(row => row.value === HISTORY) };
}

async function exercisePaint(page, context, firstTag) {
  await beginObservation(page);
  const positions = [];
  positions.push({ position: 'top', ...(await scrollMetrics(page)), ...(await hitAndHover(page, `${context}/top`)) });
  for (const position of ['middle', 'bottom', 'top']) {
    const metrics = await wheelTo(page, position);
    positions.push({ position, ...metrics, ...(await hitAndHover(page, `${context}/${position}`)) });
  }
  assert.equal(positions[0].top, 0, 'native scrolling starts at the top');
  assert.ok(positions[1].top > 0 && positions[1].top < positions[1].max, 'native scrolling reaches the middle');
  assert.ok(Math.abs(positions[2].top - positions[2].max) <= 2, 'native scrolling reaches the bottom');
  assert.ok(positions[2].pastHeadings >= 20, 'scrolling reaches the final catalog categories');
  assert.equal(positions[2].historyHit, true, 'the historical option at the bottom receives checkbox and text hits');
  assert.equal(positions[3].top, 0, 'native scrolling returns to the start');
  await page.fill('#tag-picker-search', firstTag);
  await page.fill('#tag-picker-search', '不存在的绘制回归标签');
  assert.equal(await page.locator(`${OPTIONS} input:visible`).count(), 0);
  await page.fill('#tag-picker-search', '');
  const choice = page.locator(`${OPTIONS} input`).first();
  const before = await choice.isChecked();
  await choice.setChecked(!before);
  assert.equal(await choice.isChecked(), !before, 'staged checkbox toggles normally after scrolling');
  const metrics = await endObservation(page, context);
  assert.ok(metrics.scrollEvents >= 3, 'real scroll events occur in both directions');
  console.log(`TAG PAINT ${JSON.stringify({ context, positions, ...metrics })}`);
}

async function selectedValues(page) {
  return page.locator(`${OPTIONS} input:checked`).evaluateAll(nodes => nodes.map(node => node.value));
}

(async () => {
  const presets = require(appPath('ui/tag-presets.js'));
  assert.equal(presets.categories.length, 22);
  assert.equal(presets.categories.reduce((count, category) => count + category.tags.length, 0), 262);
  const firstTag = presets.categories[0].tags[0].name;
  const secondTag = presets.categories[0].tags[1].name;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      for (const theme of ['light', 'dark']) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(({ presets, firstTag, secondTag, history, theme }) => {
          const repo = 'fixture/tag-paint';
          const records = Array.from({ length: 24 }, (_, index) => ({
            id: `paint-${index}`, kind: 'document', repo, path: `paint-${index}.md`, sha: 'fixture-sha',
            authorId: 1, author: 'tester', title: `绘制回归题解 ${index}`, platform: 'CF', pid: `${index}A`,
            tags: index === 0 ? [firstTag, history] : [index % 2 ? firstTag : secondTag],
            problemUrl: `https://example.com/paint/${index}`, body: '# 测试题解', updatedAt: '2026-11-15'
          }));
          window.notebook = {
            bootstrap: async () => ({ records, local: { records: [], favorites: [], mastery: {}, draft: {} },
              settings: { autoSync: false, theme }, account: { id: 1, login: 'tester' }, permissions: { repo, push: true }, tagCatalog: presets }),
            updateLocal: async () => {}
          };
        }, { presets, firstTag, secondTag, history: HISTORY, theme });
        await page.goto(pathToFileURL(appPath('ui/index.html')).href);
        await page.waitForFunction(() => document.querySelector('#count-public').textContent === '24');
        await page.keyboard.press('/');
        await page.waitForSelector('.record-card');
        await page.locator('body').evaluate((node, theme) => { node.dataset.theme = theme; }, theme);
        const context = `${theme}/${viewport.width}`;
        const submitBlur = await backdrop(page, '#submit-dialog');
        assert.equal(submitBlur, 'blur(3px)');

        await openPicker(page, 'filter', submitBlur);
        await exercisePaint(page, `${context}/filter`, firstTag);
        await page.click('#tag-picker-cancel');
        await assertClosed(page, submitBlur);
        assert.equal(await page.locator('.record-card').count(), 24, 'cancel preserves the global filter result');
        await openPicker(page, 'filter', submitBlur);
        assert.deepEqual(await selectedValues(page), [], 'cancel rolls filter selection back');
        await page.locator(`${OPTIONS} input`).first().check();
        await page.click('#tag-picker-confirm');
        await assertClosed(page, submitBlur);
        const filteredCards = await page.locator('.record-card').count();
        assert.equal(filteredCards, 13, 'confirmation applies the real preset filter');
        await openPicker(page, 'filter', submitBlur);
        assert.deepEqual(await selectedValues(page), [firstTag]);
        await beginObservation(page);
        await page.locator(`${OPTIONS} input`).first().uncheck();
        await page.locator(`${OPTIONS} input`).nth(1).check();
        await endObservation(page, `${context}/filter/escape`);
        await page.keyboard.press('Escape');
        await assertClosed(page, submitBlur);
        assert.equal(await page.locator('.record-card').count(), filteredCards, 'Escape retains the committed filter');
        await openPicker(page, 'filter', submitBlur);
        assert.deepEqual(await selectedValues(page), [firstTag], 'Escape rolls staged filter changes back');
        await page.click('#tag-picker-close');
        await assertClosed(page, submitBlur);
        await page.click('#clear-filters');

        await page.click('#submit-button');
        assert.equal(await page.locator('#submit-dialog').evaluate(node => node.open), true);
        assert.equal(await backdrop(page, '#submit-dialog'), submitBlur);
        await openPicker(page, 'editor', submitBlur);
        await exercisePaint(page, `${context}/editor`, firstTag);
        await page.click('#tag-picker-cancel');
        await assertClosed(page, submitBlur);
        assert.equal(await page.locator('[name="tags"]').inputValue(), '', 'editor cancel rolls staged tags back');
        assert.equal(await page.locator('#submit-dialog').evaluate(node => node.open), true, 'cancel keeps the editor open');
        await openPicker(page, 'editor', submitBlur);
        assert.deepEqual(await selectedValues(page), []);
        await page.locator(`${OPTIONS} input`).first().check();
        await page.click('#tag-picker-confirm');
        await assertClosed(page, submitBlur);
        assert.equal(await page.locator('[name="tags"]').inputValue(), firstTag);
        await openPicker(page, 'editor', submitBlur);
        assert.deepEqual(await selectedValues(page), [firstTag]);
        await beginObservation(page);
        await page.locator(`${OPTIONS} input`).first().uncheck();
        await page.locator(`${OPTIONS} input`).nth(1).check();
        await endObservation(page, `${context}/editor/escape`);
        await page.keyboard.press('Escape');
        await assertClosed(page, submitBlur);
        assert.equal(await page.locator('#submit-dialog').evaluate(node => node.open), true, 'Escape closes only the top picker');
        assert.equal(await page.locator('[name="tags"]').inputValue(), firstTag, 'Escape retains the committed editor selection');
        await openPicker(page, 'editor', submitBlur);
        assert.deepEqual(await selectedValues(page), [firstTag], 'editor Escape does not corrupt selected state');
        await page.click('#tag-picker-close');
        await assertClosed(page, submitBlur);
        assert.deepEqual(errors, []);
        console.log(`TAG PAINT CASE PASS ${context}: filter/editor, native wheel, immediate hover, history hit tests, stable DOM/list, cancel/Escape/confirm and scoped backdrop restore`);
        await page.close();
      }
    }
    console.log('TAG PAINT PASS: real 22-category/262-tag presets plus history; light/dark at desktop and 390px; no frame-time thresholds');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
