'use strict';
// Run after pnpm build:app: node tests/public-problem-list-ui-smoke.cjs.
// Real built renderer, isolated storage, no network and no production repository writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdir } = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

const themes = ['light', 'dark'];
const palettes = ['porcelain', 'blue', 'violet', 'rose', 'amber', 'teal'];
const screenshotDir = path.resolve(__dirname, '../screenshots');

async function navigate(page, view, local = false) {
  await page.locator(`.rail-nav-item[data-view="${view}"]`).click();
  await page.mouse.move(350, 100);
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  if (view === 'public') await page.locator(local ? '#library-local-button' : '#library-public-button').click();
}

async function count(page, expected) {
  assert.equal(await page.locator('#record-list .record-card').count(), expected);
  assert.equal(await page.locator('#result-count').innerText(), String(expected));
}

async function listGeometry(page, label, width, expected = 20) {
  const geometry = await page.evaluate(() => {
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const list = document.querySelector('#record-list');
    const head = document.querySelector('.problem-list-columns');
    return {
      viewport: innerWidth, page: document.documentElement.scrollWidth,
      split: rect(document.querySelector('.split-view')), list: rect(list),
      listClient: list.clientWidth, listScroll: list.scrollWidth, overflowX: getComputedStyle(list).overflowX,
      heads: [...head.children].map(rect),
      rows: [...list.querySelectorAll('.problem-list-row')].map(row => ({
        rect: rect(row), client: row.clientWidth, scroll: row.scrollWidth,
        cells: [...row.children].map(rect), radius: getComputedStyle(row).borderRadius,
        author: row.querySelector('.problem-author .record-author-name').textContent,
        authorDisplay: getComputedStyle(row.querySelector('.problem-author')).display,
        authorVisibility: getComputedStyle(row.querySelector('.problem-author')).visibility,
        authorRect: rect(row.querySelector('.problem-author')),
        title: rect(row.querySelector('.card-title'))
      }))
    };
  });
  assert.ok(geometry.page <= geometry.viewport + 1, `${label}: page overflow ${JSON.stringify(geometry)}`);
  assert.equal(await page.locator('#detail-panel').isVisible(), false, `${label}: public list has no preview panel`);
  assert.equal(await page.locator('#detail-panel').textContent(), '', `${label}: no hidden preview is rendered`);
  assert.equal(await page.locator('.problem-list-row.selected, .problem-list-row[aria-pressed]').count(), 0, `${label}: public rows do not auto-select`);
  assert.ok(Math.abs(geometry.list.width - geometry.split.width) <= 2, `${label}: list spans workspace`);
  if (width < 1000) {
    assert.ok(geometry.listScroll > geometry.listClient + 1, `${label}: narrow table scrolls horizontally inside the list`);
    assert.match(geometry.overflowX, /auto|scroll/, `${label}: local scrolling is available`);
  } else {
    assert.ok(geometry.listScroll <= geometry.listClient + 1, `${label}: desktop table fits the workspace`);
  }
  assert.equal(geometry.heads.length, 7, `${label}: all seven headers remain present`);
  assert.equal(geometry.rows.length, expected, `${label}: full scope fixture remains present`);
  for (const [index, row] of geometry.rows.entries()) {
    assert.equal(row.radius, '0px', `${label} row ${index}: row presentation`);
    assert.ok(row.scroll <= row.client + 1, `${label} row ${index}: no row content spills beyond its table`);
    assert.ok(row.rect.width >= geometry.listClient - 1, `${label} row ${index}: full list width`);
    if (width === 1440) assert.ok(row.rect.height >= 38 && row.rect.height <= 46, `${label} row ${index}: desktop row is about 42px ${JSON.stringify(row.rect)}`);
    assert.ok(row.author.trim() && row.authorDisplay !== 'none' && row.authorVisibility === 'visible' && row.authorRect.width > 0 && row.authorRect.height > 0, `${label} row ${index}: author always displayed`);
    assert.ok(row.title.width > 0, `${label} row ${index}: title remains usable`);
    assert.equal(row.cells.length, 7, `${label} row ${index}: seven independent cells`);
    for (let column = 0; column < 7; column++) {
      assert.ok(Math.abs(row.cells[column].x - geometry.heads[column].x) <= 1, `${label} row ${index}: column ${column} aligns with header`);
      assert.ok(Math.abs(row.cells[column].width - geometry.heads[column].width) <= 1, `${label} row ${index}: column ${column} preserves width`);
    }
    assert.ok(row.authorRect.right <= row.rect.right + 1, `${label} row ${index}: author remains inside row`);
  }
  if (geometry.listScroll > geometry.listClient + 1) {
    const reachable = await page.evaluate(() => {
      const list = document.querySelector('#record-list'); list.scrollLeft = list.scrollWidth;
      const outer = list.getBoundingClientRect(), author = list.querySelector('.problem-author').getBoundingClientRect();
      const result = { left: author.left, right: author.right, listLeft: outer.left, listRight: outer.right, page: document.documentElement.scrollWidth, viewport: innerWidth };
      list.scrollLeft = 0; return result;
    });
    assert.ok(reachable.left >= reachable.listLeft - 1 && reachable.right <= reachable.listRight + 1, `${label}: author is reachable by horizontal list scrolling ${JSON.stringify(reachable)}`);
    assert.ok(reachable.page <= reachable.viewport + 1, `${label}: scrolling the table does not overflow the page`);
  }
}

async function cardsPreserved(page, label, expected, desktop) {
  await count(page, expected);
  assert.equal(await page.locator('.public-problem-list, .problem-list-columns, .problem-list-row').count(), 0, `${label}: no public row presentation`);
  assert.equal(await page.locator('#record-list .card-meta').count(), expected, `${label}: card metadata retained`);
  assert.equal(await page.locator('#record-list .card-footer .card-state').count(), expected, `${label}: card review states retained`);
  const layout = await page.evaluate(() => {
    const list = document.querySelector('#record-list'), detail = document.querySelector('#detail-panel'), card = list.querySelector('.record-card');
    const r = node => { const box = node.getBoundingClientRect(); return { x: box.x, right: box.right, width: box.width, height: box.height }; };
    return { page: document.documentElement.scrollWidth, viewport: innerWidth, list: r(list), detail: r(detail), card: r(card), radius: parseFloat(getComputedStyle(card).borderRadius), border: parseFloat(getComputedStyle(card).borderTopWidth), gap: parseFloat(getComputedStyle(list).gap) };
  });
  assert.ok(layout.page <= layout.viewport + 1, `${label}: cards have no page overflow`);
  assert.ok(layout.radius >= 6 && layout.border >= 1 && layout.gap >= 8 && layout.card.height >= 110, `${label}: separated bounded cards ${JSON.stringify(layout)}`);
  if (desktop) assert.ok(layout.list.right <= layout.detail.x + 2, `${label}: cards remain left of preview`);
}

async function positions(page) {
  return page.evaluate(() => ({ window: scrollY, list: document.querySelector('#record-list').scrollTop, horizontal: document.querySelector('#record-list').scrollLeft }));
}

async function returnFromDetail(page, before, label, key) {
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('reading-detail')), true, `${label}: focused reader opens`);
  assert.equal(await page.locator('.record-list-panel').isVisible(), false, `${label}: focused reader hides list`);
  assert.equal(await page.locator('#detail-back-button').evaluate(node => node === document.activeElement), true, `${label}: back receives focus`);
  await page.locator('#detail-back-button').click();
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('reading-detail')), false);
  const after = await positions(page);
  for (const axis of ['window', 'list', 'horizontal']) assert.ok(Math.abs(after[axis] - before[axis]) <= 1, `${label}: ${axis} scroll restored ${JSON.stringify({ before, after })}`);
  assert.equal(await page.locator(`.problem-list-row[data-key="${key}"]`).evaluate(node => node === document.activeElement), true, `${label}: originating row receives focus`);
  assert.equal(await page.locator('.problem-list-row.selected, .problem-list-row[aria-pressed]').count(), 0, `${label}: returning does not add selection state`);
  assert.equal(await page.locator('#detail-panel').isVisible(), false, `${label}: back restores list without a preview`);
  assert.equal(await page.locator('#detail-panel').textContent(), '', `${label}: back clears the focused reader`);
  assert.equal(await page.locator('#search-input').inputValue(), '训练', `${label}: search retained`);
  assert.match(await page.locator('#active-filters').innerText(), /基础训练/, `${label}: tag filter retained`);
  await count(page, 20);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const imageRequests = [];
    await page.route(/^https?:\/\//, route => { if (route.request().resourceType() === 'image') imageRequests.push(route.request().url()); return route.abort(); });
    await page.addInitScript(() => {
      const repo = 'fixture/public-problem-list';
      const titles = ['区间动态规划训练', '最短路径训练', '树上倍增训练', '单调队列训练', '字符串匹配训练', '连通分量训练', '组合计数训练', '二分答案训练', '前缀和训练', '线段树训练', '最小生成树训练', '状态压缩训练', '拓扑排序训练', '数位动态规划训练', '网络流训练', '并查集训练', '贪心调度训练', '矩阵快速幂训练', '后缀数组训练', '几何与凸包训练'];
      const authors = ['林同学', { name: '陈老师', login: 'chen' }, { login: 'algorithm-fan' }, null, {}, '作者名字很长'.repeat(20), '<img src=x onerror="window.publicListUnsafe=true">'];
      const records = titles.map((title, index) => {
        const platform = ['CF', 'LG', 'AT', 'LC'][index % 4];
        return {
          id: `public-list-${index + 1}`, kind: 'document', repo, path: `problems/${index + 1}.md`, sha: 'fixture', title,
          platform, pid: platform === 'CF' ? `${1900 + index}A` : platform === 'LG' ? `P${1000 + index}` : platform === 'AT' ? `ABC${300 + index}_D` : String(100 + index),
          rating: platform === 'CF' ? 1200 + index * 100 : null,
          difficulty: platform === 'LG' ? '普及+/提高-' : platform === 'AT' ? '1200' : platform === 'LC' ? '中等' : '',
          luoguDifficulty: index === 0 ? '提高' : '',
          tags: ['基础训练', index % 2 ? '图论' : '动态规划', ...(index === 18 ? ['图论'] : []), ...(index === 6 ? ['<svg onload="window.publicListUnsafe=true">', '超长标签'.repeat(25)] : [])],
          author: authors[index % authors.length], authorId: index + 1,
          updatedAt: `2026-11-${String(20 - index).padStart(2, '0')}T10:30:00Z`,
          body: `## ${title}\n\n先明确状态和边界，再分析时间复杂度。\n\n` + '在纸上验证一个小样例，记录转移和不变量。\n\n'.repeat(index === 0 ? 2 : 35) + '```cpp\nint answer = 42;\n```',
          problemUrl: `https://example.invalid/problems/${index + 1}`,
          passRate: 99.9, acceptance: '99.9%', acceptedCount: 999, submittedCount: 1000
        };
      });
      // Missing author, unknown native difficulty, and a long title are explicit boundary fixtures.
      delete records[7].author;
      records[8].rating = null;
      records[8].difficulty = '';
      records[9].title += '：验证很长的标题在手机和宽屏保持可读且不产生横向滚动'.repeat(5);
      const local = { records: [{ ...records[0], id: 'public-list-local', kind: 'local', ownerId: null, title: '本地卡片训练', author: '本地学习者' }], favorites: ['public-list-1', 'public-list-local'], mastery: { 'public-list-1': 'mastered', 'public-list-local': 'reviewing' }, draft: {} };
      let settings = { repo, autoSync: false, theme: 'light', palette: 'porcelain', clientId: '', displayName: '' };
      const payload = () => structuredClone({ settings, records, issues: [], local, account: { id: 501, login: 'fixture-reader' }, authStatus: { status: 'verified' }, permissions: { repo, push: false, admin: false }, platforms: {}, planner: { problems: [], tasks: [], layout: 'compact' } });
      window.publicListFixture = { records, local, writes: 0 };
      window.notebook = {
        bootstrap: async () => payload(), sync: async () => payload(),
        saveSettings: async input => { settings = { ...settings, ...input }; return payload(); },
        updateLocal: async input => { window.publicListFixture.writes++; Object.assign(local, structuredClone(input)); },
        openExternal: async () => {}, onAuthProgress: () => () => {}, onUpdateProgress: () => () => {}
      };
    });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await navigate(page, 'public');
    await count(page, 20);
    assert.deepEqual(await page.locator('.problem-list-columns > span').allTextContents(), ['平台', '题号', '算法标签', '题目', '难度', '作者', '更新']);
    assert.equal(await page.locator('#detail-panel').isVisible(), false, 'initial public list has no preview');
    assert.equal(await page.locator('#detail-panel').textContent(), '', 'initial public list does not render an automatic detail');
    assert.equal(await page.locator('.problem-list-row.selected, .problem-list-row[aria-pressed]').count(), 0, 'public rows have no automatic selection');
    assert.equal(await page.locator('#record-list .record-card.problem-list-row').count(), 20, 'record-card compatibility retained');
    assert.equal(await page.locator('#record-list .card-state, #record-list .card-footer, #record-list .card-meta').count(), 0, 'public rows omit old card-only metadata');
    assert.doesNotMatch(await page.locator('#record-list').innerText(), /通过率|正确率|提交数|通过数|pass\s*rate|acceptance|99\.9%/i, 'no acceptance statistics even when fixture provides them');
    const actual = await page.locator('.problem-list-row').evaluateAll(nodes => nodes.map(row => ({ id: row.dataset.key, pid: row.querySelector('.problem-id').textContent, title: row.querySelector('.card-title').childNodes[0].textContent, tags: [...row.querySelectorAll('.tag')].map(node => node.textContent), author: row.querySelector('.problem-author .record-author-name').textContent, tooltip: row.querySelector('.problem-author').title, updated: row.querySelector('time').dateTime })));
    const expected = await page.evaluate(() => window.publicListFixture.records.map(record => ({ id: record.id, pid: record.pid, title: record.title, tags: record.tags, author: typeof record.author === 'string' ? record.author : record.author?.name || record.author?.login || '匿名学习者', tooltip: typeof record.author === 'string' ? record.author : record.author?.name || record.author?.login || '匿名学习者', updated: new Date(record.updatedAt).toISOString() })));
    assert.deepEqual(actual, expected, 'all row fields preserve data and newest-first ordering');
    assert.equal(await page.locator('.problem-list-row[data-key="public-list-9"] .problem-difficulty-empty').innerText(), '未标注');
    assert.equal(await page.locator('.problem-list-row[data-key="public-list-1"] .difficulty-badge').count(), 2, 'native and supplementary difficulty retained');
    assert.equal(await page.locator('#record-list svg, #record-list script, #record-list img[onerror], #record-list img[src="x"]').count(), 0, 'unsafe authors and tags remain literal text');
    const avatarSources = await page.locator('#record-list img').evaluateAll(nodes => nodes.map(node => ({ src: node.src, safeParent: !!node.closest('.problem-author .mini-avatar'), referrer: node.referrerPolicy, alt: node.alt })));
    for (const avatar of avatarSources) {
      assert.match(avatar.src, /^https:\/\/avatars\.githubusercontent\.com\/u\/[1-9]\d*\?s=64$/, 'author IDs produce official GitHub avatar URLs');
      assert.equal(avatar.safeParent, true, 'only renderer-created author avatars are allowed');
      assert.equal(avatar.referrer, 'no-referrer');
      assert.equal(avatar.alt, '', 'decorative avatars do not duplicate the author name');
    }
    assert.ok(imageRequests.length > 0, 'the real renderer requests official author avatars');
    assert.ok(imageRequests.every(url => /^https:\/\/avatars\.githubusercontent\.com\/u\/[1-9]\d*\?s=64$/.test(url)), 'unsafe author markup never creates an image request');
    assert.equal(await page.evaluate(() => window.publicListUnsafe), undefined, 'unsafe fixture never executes');
    assert.equal(await page.locator('.problem-favorite[aria-label="已收藏"]').count(), 1, 'favorite remains visible on its public row');

    // Search, platform, author, difficulty and OR-tag hit sorting use the unchanged filter pipeline.
    await page.locator('#search-input').fill('最短路径'); await count(page, 1);
    assert.equal(await page.locator('.problem-list-row').getAttribute('data-key'), 'public-list-2');
    await page.locator('#clear-filters').click();
    await page.locator('#platform-filter summary').click();
    await page.locator('#platform-filter input[value="CF"]').check(); await count(page, 5);
    await page.locator('#clear-filters').click();
    await page.locator('#author-filter summary').click();
    await page.locator('#author-filter input[value="algorithm-fan"]').check(); await count(page, 3);
    await page.locator('#clear-filters').click();
    await page.locator('#difficulty-filter summary').click();
    await page.locator('#rating-min').fill('1600'); await count(page, 3);
    await page.locator('#clear-filters').click();
    await page.locator('#tag-filter-trigger').click();
    await page.locator('#tag-picker-dialog-options input[value="图论"]').check();
    await page.locator('#tag-picker-dialog-options input[value="动态规划"]').check();
    await page.locator('#tag-picker-confirm').click(); await count(page, 20);
    assert.equal(await page.locator('.problem-list-row').first().getAttribute('data-key'), 'public-list-19', 'an older record with two tag hits precedes newer one-hit records');
    assert.match(await page.locator('.list-heading').innerText(), /标签命中数/);
    await page.locator('#clear-filters').click();
    // This compatibility control is intentionally hidden by the current toolbar;
    // exercise its existing change contract without claiming it is a visible UI.
    await page.locator('#state-filter').selectOption('mastered', { force: true }); await count(page, 1);
    assert.equal(await page.locator('.problem-list-row').getAttribute('data-key'), 'public-list-1');
    await page.locator('#clear-filters').click();

    await page.locator('#search-input').fill('训练');
    await page.locator('#tag-filter-trigger').click();
    await page.locator('#tag-picker-dialog-options input[value="基础训练"]').check();
    await page.locator('#tag-picker-confirm').click();
    // Shorten only this interaction viewport so both the page and table really
    // scroll; the density matrix and screenshots still use the normal desktop.
    await page.setViewportSize({ width: 1440, height: 600 });
    const target = page.locator('.problem-list-row[data-key="public-list-15"]');
    await target.scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 160));
    const beforeClick = await positions(page);
    assert.ok(beforeClick.list > 0 && beforeClick.window > 0, `return test starts with genuine list and window scrolling ${JSON.stringify(beforeClick)}`);
    await target.locator('.card-title').click();
    assert.equal(await page.locator('#detail-panel .detail-title').innerText(), '网络流训练');
    assert.equal(await page.locator('#open-detail-button').count(), 0, 'title click goes directly to focused reading');
    await returnFromDetail(page, beforeClick, 'title click/back', 'public-list-15');
    // Native keyboard activation on another row also opens focused reading.
    const keyboardTarget = page.locator('.problem-list-row[data-key="public-list-16"]');
    await keyboardTarget.focus();
    const beforeEnter = await positions(page);
    await keyboardTarget.press('Enter');
    assert.equal(await page.locator('#detail-panel .detail-title').innerText(), '并查集训练');
    await returnFromDetail(page, beforeEnter, 'Enter/back', 'public-list-16');
    await page.locator('#clear-filters').click();

    let checks = 0;
    for (const theme of themes) for (const palette of palettes) {
      await page.locator('#theme-select').selectOption(theme);
      await page.locator('#palette-select').selectOption(palette);
      await page.waitForFunction(({ theme, palette }) => document.body.dataset.theme === theme && document.body.dataset.palette === palette && !document.querySelector('#palette-select').disabled, { theme, palette });
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await navigate(page, 'public');
        await listGeometry(page, `${theme}/${palette}/${width} public`, width);
        await navigate(page, 'public', true);
        await count(page, 1);
        await listGeometry(page, `${theme}/${palette}/${width} local`, width, 1);
        assert.equal(await page.locator('#record-list .problem-author .record-author-name').innerText(), '本地学习者', 'local row retains author name');
        assert.equal(await page.locator('#record-list .card-state, #record-list .card-footer, #record-list .card-meta').count(), 0, 'local rows omit card-only metadata');
        await navigate(page, 'favorites');
        await cardsPreserved(page, `${theme}/${palette}/${width} favorites`, 2, width > 700);
        checks++;
      }
    }
    await mkdir(screenshotDir, { recursive: true });
    // Capture the normal desktop first screen: compact rows must show at least
    // fifteen fixtures without changing application styles or table scrolling.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#palette-select').selectOption('porcelain');
    for (const theme of themes) {
      await page.locator('#theme-select').selectOption(theme);
      await navigate(page, 'public');
      await page.evaluate(() => { const list = document.querySelector('#record-list'); list.scrollTop = list.scrollLeft = 0; scrollTo(0, 0); });
      await count(page, 20);
      const density = await page.locator('.problem-list-row').evaluateAll(rows => {
        const list = document.querySelector('#record-list').getBoundingClientRect();
        const first = rows[0].getBoundingClientRect();
        return {
          visible: rows.filter(row => { const r = row.getBoundingClientRect(); return r.top >= Math.max(0, list.top) && r.bottom <= Math.min(innerHeight, list.bottom) + 1; }).length,
          listTop: list.top, listBottom: list.bottom, firstRowTop: first.top, rowHeight: first.height, viewport: innerHeight
        };
      });
      await page.screenshot({ path: path.join(screenshotDir, `public-problem-list-${theme}.png`), fullPage: false });
      assert.ok(density.visible >= 15, `${theme}: 1440x1000 first screen contains at least 15 complete rows ${JSON.stringify(density)}`);
    }
    await page.locator('#theme-select').selectOption('light');
    await navigate(page, 'public', true);
    await page.screenshot({ path: path.join(screenshotDir, 'public-problem-list-local-light.png'), fullPage: false });
    assert.equal(await page.evaluate(() => window.publicListFixture.writes), 0, 'filtering and focused reading never mutate local records');
    assert.equal(await page.evaluate(() => window.publicListUnsafe), undefined);
    assert.deepEqual(errors, []);
    console.log(`PUBLIC PROBLEM LIST UI PASS: 20 fixtures, seven aligned columns and ~42px desktop rows without preview/selection, author variants/escaped unsafe tags, no pass rate, search/facets/tag-hit sorting, title click/Enter/back with focus and scroll, shared local rows and preserved favorites cards, ${checks} theme/palette/viewport cases (390/768/1440) with local table scrolling and reachable authors, 1440x1000 light/dark screenshots with at least 15 rows`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
