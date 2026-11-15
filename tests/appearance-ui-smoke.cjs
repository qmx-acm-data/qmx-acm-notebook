'use strict';
// Run after pnpm build:app: node tests/appearance-ui-smoke.cjs.
// Uses the real bundled renderer, isolated browser storage and an in-memory desktop bridge.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

const themes = ['light', 'dark'];
const palettes = ['porcelain', 'blue', 'violet', 'rose', 'amber', 'teal'];
const contrastFailures = [];

async function navigate(page, view, local = false) {
  await page.locator(`.rail-nav-item[data-view="${view}"]`).click();
  await page.mouse.move(350, 100);
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  if (view === 'public') await page.locator(local ? '#library-local-button' : '#library-public-button').click();
}

async function appearance(page, theme, palette) {
  await page.locator('#theme-select').selectOption(theme);
  await page.locator('#palette-select').selectOption(palette);
  await page.waitForFunction(({ theme, palette }) => document.body.dataset.theme === theme && document.body.dataset.palette === palette, { theme, palette });
  await page.waitForFunction(() => !document.querySelector('#theme-select').disabled && !document.querySelector('#palette-select').disabled);
}

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(size.width <= size.viewport + 1, `${label}: horizontal page overflow ${JSON.stringify(size)}`);
}

// Composite actual alpha layers; canvas normalizes modern color(srgb)/color-mix values.
// Sample every computed gradient stop and intermediate mixes against the foreground.
async function contrast(page, selector, label) {
  const samples = await page.locator(selector).evaluateAll(nodes => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); const px = ctx.getImageData(0, 0, 1, 1).data; return [px[0], px[1], px[2], px[3] / 255]; };
    const over = (a, b) => { const alpha = a[3] + b[3] * (1 - a[3]); return [0, 1, 2].map(i => (a[i] * a[3] + b[i] * b[3] * (1 - a[3])) / alpha).concat(alpha); };
    const lum = color => color.slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    return nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility === 'visible' && !node.disabled && (node.textContent.trim() || node.value)).map(node => {
      const chain = []; for (let parent = node; parent; parent = parent.parentElement) chain.unshift(parent);
      let backgrounds = [[255, 255, 255, 1]];
      for (const parent of chain) {
        const style = getComputedStyle(parent), layer = rgba(style.backgroundColor);
        backgrounds = layer[3] === 1 ? [layer] : backgrounds.map(bg => over(layer, bg));
        if (style.backgroundImage !== 'none') {
          const stops = style.backgroundImage.match(/(?:rgba?|color)\([^)]*\)/g);
          if (!stops || !style.backgroundImage.startsWith('linear-gradient(')) throw new Error(`Unsupported contrast background on ${parent.className}`);
          const colors = stops.map(rgba), samples = [...colors];
          for (let i = 1; i < colors.length; i++) for (const t of [.25, .5, .75]) samples.push(colors[i - 1].map((value, channel) => value * (1 - t) + colors[i][channel] * t));
          backgrounds = backgrounds.flatMap(bg => samples.map(color => over(color, bg)));
        }
        if (Number(style.opacity) !== 1) throw new Error(`Unsupported group opacity on ${parent.className}`);
      }
      const style = getComputedStyle(node), foreground = rgba(style.color);
      const ratios = backgrounds.map(bg => { const fg = over(foreground, bg), a = lum(fg), b = lum(bg); return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), fg, bg }; });
      const worst = ratios.reduce((a, b) => a.ratio < b.ratio ? a : b);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      return { text: (node.textContent.trim() || node.value).slice(0, 50), selector: node.id || node.className, ...worst, minimum: large ? 3 : 4.5 };
    });
  });
  assert.ok(samples.length > 0, `${label}: contrast selector must match visible text`);
  for (const sample of samples) if (sample.ratio < sample.minimum) contrastFailures.push(`${label}: ${JSON.stringify(sample)}`);
  return samples.length;
}

async function libraryLayout(page, label) {
  const layout = await page.evaluate(() => {
    const split = document.querySelector('.split-view'), list = document.querySelector('#record-list'), detail = document.querySelector('#detail-panel'), card = list.querySelector('.record-card');
    const rect = node => { const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height }; };
    const style = getComputedStyle(card), listStyle = getComputedStyle(list);
    return { display: getComputedStyle(split).display, list: rect(list), detail: rect(detail), card: rect(card), radius: parseFloat(style.borderRadius), gap: parseFloat(listStyle.gap), border: parseFloat(style.borderTopWidth), padding: parseFloat(style.paddingTop), columns: listStyle.gridTemplateColumns.split(' ').length };
  });
  assert.equal(layout.display, 'grid', `${label}: split library remains a grid`);
  assert.ok(layout.list.x + layout.list.width <= layout.detail.x + 2, `${label}: cards stay left of the reader ${JSON.stringify(layout)}`);
  assert.ok(layout.list.width >= 280 && layout.list.width <= layout.detail.width * 1.9, `${label}: moderate list width ${JSON.stringify(layout)}`);
  assert.ok(layout.card.height >= 110 && layout.card.height <= 260, `${label}: card is neither a dense row nor an oversized tile ${JSON.stringify(layout)}`);
  assert.ok(layout.gap >= 8 && layout.gap <= 20 && layout.radius >= 6 && layout.border >= 1 && layout.padding >= 10, `${label}: separated bounded cards ${JSON.stringify(layout)}`);
  assert.ok(layout.columns >= 1 && layout.columns <= 2, `${label}: moderate desktop columns`);
  return layout;
}

async function semanticSnapshot(page) {
  return page.evaluate(() => {
    const style = selector => { const node = document.querySelector(selector); if (!node) throw Error(`Missing semantic fixture: ${selector}`); const s = getComputedStyle(node); return { color: s.color, background: s.backgroundColor }; };
    return {
      difficulty: style('.record-card .difficulty-badge'), platform: style('.record-card .platform-label'), tag: style('.record-card .tag'),
      mastery: style('.record-card .card-state'), keyword: style('.markdown-body .token.keyword'), number: style('.markdown-body .token.number'),
      explicitForeground: style('.markdown-body .notebook-foreground')
    };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, route => route.abort());
    await page.addInitScript(() => {
      const storage = 'appearance-ui-smoke.fixture';
      const repo = 'test/appearance';
      const body = '## 颜色回归\n\n正常正文、**重点**和[原题](https://example.com/problem)。\n\n<span style="color:#c7254e">保留作者指定颜色</span>\n\n```cpp\n// semantic syntax colors\nint answer = 42;\n```';
      const record = index => ({ id: `appearance-${index}`, kind: 'document', repo, path: `${index}.md`, sha: 'fixture', title: `Appearance fixture ${index}`, platform: 'CF', pid: `CF${index}A`, rating: 1900, tags: ['动态规划'], authorId: 1, author: 'Fixture', body, problemUrl: 'https://example.com/problem', updatedAt: '2026-11-01T00:00:00Z' });
      const seed = {
        settings: { repo, autoSync: false, theme: 'light', palette: 'porcelain', codeFontSize: 11, clientId: '', displayName: '' },
        local: { records: [{ ...record(9), id: 'appearance-local', kind: 'local', ownerId: null, title: 'Local appearance fixture' }], favorites: ['appearance-1', 'appearance-local'], mastery: { 'appearance-1': 'mastered', 'appearance-local': 'reviewing' }, draft: {} }
      };
      let state = JSON.parse(localStorage.getItem(storage) || 'null') || seed;
      const store = () => localStorage.setItem(storage, JSON.stringify(state));
      const payload = () => structuredClone({ ...state, records: [record(1), record(2), record(3), record(4)], issues: [], account: { id: 1, login: 'fixture' }, authStatus: { status: 'verified' }, permissions: { repo, push: true, admin: true }, planner: { problems: [], tasks: [], layout: 'compact' }, platforms: {} });
      window.appearanceFixture = { writes: [], exports: 0, localWrites: 0, failSave: false, saved: () => structuredClone(state) };
      window.notebook = {
        bootstrap: async () => payload(), sync: async () => payload(),
        saveSettings: async settings => { window.appearanceFixture.writes.push(structuredClone(settings)); if (window.appearanceFixture.failSave) return { error: 'Appearance settings write failed' }; state.settings = { ...state.settings, ...settings }; store(); return payload(); },
        updateLocal: async local => { window.appearanceFixture.localWrites++; state.local = structuredClone(local); store(); },
        exportLocal: async () => { window.appearanceFixture.exports++; return { canceled: true }; },
        openExternal: async () => {}, onAuthProgress: () => () => {}, onUpdateProgress: () => () => {}
      };
      store();
    });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await page.waitForSelector('#palette-select');
    assert.deepEqual(await page.locator('#theme-select option').evaluateAll(nodes => nodes.map(node => node.value)), themes, 'exactly two brightness modes');
    assert.deepEqual(await page.locator('#palette-select option').evaluateAll(nodes => nodes.map(node => node.value)), palettes, 'six independent palette IDs');
    await page.click('#settings-button');
    assert.deepEqual(await page.locator('#settings-form [name="theme"] option').evaluateAll(nodes => nodes.map(node => node.value)), themes);
    assert.deepEqual(await page.locator('#settings-form [name="palette"] option').evaluateAll(nodes => nodes.map(node => node.value)), palettes);
    await page.keyboard.press('Escape');

    let samples = 0, geometryBaseline;
    for (const theme of themes) {
      let semanticBaseline, layoutBaseline;
      const accents = new Set();
      for (const palette of palettes) {
        const label = `${theme}/${palette}`;
        await appearance(page, theme, palette);
        const saved = await page.evaluate(() => window.appearanceFixture.saved().settings);
        assert.equal(saved.theme, theme, `${label}: switching palette preserves brightness`);
        assert.equal(saved.palette, palette, `${label}: switching brightness preserves palette`);
        await navigate(page, 'public');
        await page.waitForSelector('.markdown-body .token.keyword');
        const layout = await libraryLayout(page, label);
        if (geometryBaseline) assert.ok(Math.abs(layout.card.height - geometryBaseline.card.height) <= 1 && Math.abs(layout.list.width - geometryBaseline.list.width) <= 1 && Math.abs(layout.radius - geometryBaseline.radius) <= 1, `${label}: light and dark share card geometry`);
        else geometryBaseline = layout;
        if (layoutBaseline) assert.ok(Math.abs(layout.card.height - layoutBaseline.card.height) <= 1 && Math.abs(layout.list.width - layoutBaseline.list.width) <= 1, `${label}: palette must not alter layout`);
        else layoutBaseline = layout;
        const semantics = await semanticSnapshot(page);
        if (semanticBaseline) assert.deepEqual(semantics, semanticBaseline, `${label}: palette preserves difficulty/platform/tag/mastery/syntax/author colors`);
        else semanticBaseline = semantics;
        assert.notEqual(semantics.keyword.color, semantics.number.color, `${label}: distinct syntax classes`);
        assert.equal(semantics.explicitForeground.color, 'rgb(199, 37, 78)', `${label}: sanitized author foreground retained`);
        accents.add(await page.locator('#submit-button').evaluate(node => getComputedStyle(node).backgroundColor));
        await page.locator('#detail-panel .code-block').hover();
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#detail-panel .code-actions')).opacity === '1');
        samples += await contrast(page, '#page-title, #page-description, .card-title, .detail-title, .list-heading, #library-public-button, #library-local-button, #submit-button, #open-detail-button, .code-action-button, #detail-panel .markdown-body p:not(:has(.notebook-foreground)), #detail-panel .markdown-body h2', label);
        await noOverflow(page, label);
        await navigate(page, 'public', true);
        assert.equal(await page.locator('.record-card').count(), 1, `${label}: local scope remains isolated`);
        await libraryLayout(page, `${label} local`);
        await navigate(page, 'favorites');
        assert.equal(await page.locator('.record-card').count(), 2, `${label}: favorites retain public and local entries`);
        await navigate(page, 'home');
        samples += await contrast(page, '.home-intro h2, .planner-heading h2, .planner-count, .planner-add-button, .planner-empty, .platform-dashboard-empty strong, .platform-dashboard-empty p, .platform-button, .contests-heading h2, .contest-empty', `${label} home`);
        await page.click('.planner-add-tasks .planner-deadline-trigger');
        samples += await contrast(page, '.planner-deadline-popover:popover-open h3, .planner-deadline-month, .planner-deadline-confirm, .planner-deadline-day:not(.is-adjacent)', `${label} calendar`);
        await page.keyboard.press('Escape');
        await navigate(page, 'algorithms');
        samples += await contrast(page, '.alg-title, .alg-tree-label, .alg-button-primary, .alg-scope-button, .alg-detail-title, .alg-intro', `${label} algorithms`);
        await page.locator('.algorithm-view-modes [data-mode="path"]').click();
        samples += await contrast(page, '.alp-stat strong, .alp-stage-title, .alp-detail .alp-gate-title, .alp-button-primary', `${label} learning path`);
        await page.locator('.algorithm-view-modes [data-mode="tree"]').click();
        await page.setViewportSize({ width: 390, height: 844 });
        for (const view of ['home', 'public', 'favorites', 'algorithms', 'tricks']) {
          await navigate(page, view);
          await noOverflow(page, `${label} 390px ${view}`);
        }
        await page.click('#settings-button');
        await noOverflow(page, `${label} 390px settings`);
        samples += await contrast(page, '#settings-dialog h2, #settings-form button[type="submit"], #export-local-button', `${label} settings`);
        await page.keyboard.press('Escape');
        await page.locator('.sidebar-rail .sidebar-bottom').click();
        await noOverflow(page, `${label} 390px account/update`);
        samples += await contrast(page, '#account-dialog h2, #account-details dt, #account-details dd, #account-switch, .update-heading h3, #check-update-button, #update-status', `${label} account/update`);
        await page.keyboard.press('Escape');
        await page.click('#submit-button');
        await noOverflow(page, `${label} 390px editor`);
        samples += await contrast(page, '#submit-dialog h2, #draft-hint, #save-local-button, #publish-button', `${label} editor`);
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      assert.equal(accents.size, palettes.length, `${theme}: each palette visibly changes primary actions`);
    }

    // A palette change cannot undo brightness; committed settings survive an actual reload.
    await appearance(page, 'dark', 'violet');
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.theme === 'dark' && document.body.dataset.palette === 'violet');
    assert.equal(await page.locator('#theme-select').inputValue(), 'dark');
    assert.equal(await page.locator('#palette-select').inputValue(), 'violet');

    // Dialog edits preview both controls without leaking into a separate local-data save.
    for (const close of ['button', 'escape']) {
      await page.click('#settings-button');
      await page.selectOption('#settings-form [name="theme"]', 'light');
      await page.selectOption('#settings-form [name="palette"]', 'rose');
      await page.waitForFunction(() => document.body.dataset.theme === 'light' && document.body.dataset.palette === 'rose');
      await navigateBehindDialog(page);
      const saved = await page.evaluate(() => window.appearanceFixture.saved().settings);
      assert.equal(saved.theme, 'dark', 'unrelated local save cannot commit brightness preview');
      assert.equal(saved.palette, 'violet', 'unrelated local save cannot commit palette preview');
      if (close === 'button') await page.click('[data-close="settings-dialog"]'); else await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#settings-dialog').open && document.body.dataset.theme === 'dark' && document.body.dataset.palette === 'violet');
      assert.equal(await page.locator('#theme-select').inputValue(), 'dark');
      assert.equal(await page.locator('#palette-select').inputValue(), 'violet');
    }
    await page.click('#settings-button');
    await page.selectOption('#settings-form [name="theme"]', 'light');
    await page.selectOption('#settings-form [name="palette"]', 'amber');
    await page.click('#settings-form button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('#settings-dialog').open);
    const committed = await page.evaluate(() => window.appearanceFixture.saved().settings);
    assert.equal(committed.theme, 'light'); assert.equal(committed.palette, 'amber');
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.theme === 'light' && document.body.dataset.palette === 'amber');

    // Failed settings writes retain the dialog and permit rollback to the saved pair.
    await page.click('#settings-button');
    await page.selectOption('#settings-form [name="theme"]', 'dark');
    await page.selectOption('#settings-form [name="palette"]', 'teal');
    await page.evaluate(() => { window.appearanceFixture.failSave = true; });
    await page.click('#settings-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Appearance settings write failed'));
    assert.equal(await page.locator('#settings-dialog').evaluate(node => node.open), true);
    assert.equal(await page.locator('#settings-form button[type="submit"]').isEnabled(), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.dataset.theme === 'light' && document.body.dataset.palette === 'amber');
    assert.deepEqual(errors, []);
    assert.deepEqual(contrastFailures, [], 'All feature text meets computed contrast requirements');
    console.log(`APPEARANCE UI PASS: independent 2x6 controls, committed/reload/save/failure/cancel state, bounded left cards, local/public/favorites, semantic colors, ${samples} contrast samples, 390px feature overflow`);
  } finally { await browser.close(); }
})().catch(error => { if (contrastFailures.length) console.error('APPEARANCE CONTRAST FAILURES\n' + JSON.stringify(contrastFailures, null, 2)); console.error(error); process.exitCode = 1; });

async function navigateBehindDialog(page) {
  // Exercise the existing local-save path while the modal remains open, as reading-prefs-smoke does.
  await page.evaluate(() => {
    document.querySelector('.rail-nav-item[data-view="public"]').click();
    document.querySelector('#library-public-button').click();
    document.querySelector('.mastery-buttons button').click();
  });
  await page.waitForFunction(() => !document.querySelector('#settings-form button[type="submit"]').disabled);
}
