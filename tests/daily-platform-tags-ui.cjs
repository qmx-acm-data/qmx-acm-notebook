'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, route => route.abort());
    await page.addInitScript(() => {
      const repo = 'fixture/platform-tags';
      const record = { id: 'doc-one', kind: 'document', repo, path: 'one.md', title: 'fixture', author: 'reader', platform: 'CF', pid: '1A', tags: ['1997', '洛谷标签#14', '历史自定义'], body: '# fixture' };
      const fixture = window.platformTagFixture = { requests: [], reads: 0, writes: 0 };
      window.notebook = {
        bootstrap: async () => ({ records: [record], issues: [], local: { records: [], favorites: [], mastery: {}, draft: {} }, settings: { repo, autoSync: false }, permissions: { repo }, account: null }),
        getDailyTagCatalog: () => { fixture.reads++; return new Promise((resolve, reject) => fixture.requests.push({ resolve, reject })); },
        updateLocal: async () => { fixture.writes++; },
        dailyDraw: async () => ({ problem: { id: 'CF:1A', title: 'fixture', source: 'CF', url: 'https://codeforces.com/problemset/problem/1/A', rating: 800, tags: ['dp'] } })
      };
      fixture.catalog = { total: 40, builtAt: '2026-11-20T12:00:00Z', platforms: { CF: { count: 20, tagged: 20, tagCount: 3 }, LC: { count: 10, tagged: 10, tagCount: 2 }, AT: { count: 10, tagged: 0, tagCount: 0 } }, tags: [
        { name: '动态规划 DP', sources: ['CF', 'LC'] }, { name: '索引独有算法', sources: ['CF', 'LC'] }, { name: '二分', sources: ['CF'] },
        { name: '1997', sources: ['LG'] }, { name: '洛谷标签#14', sources: ['LG'] }
      ] };
    });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await page.waitForSelector('.daily-filter-tags');
    const input = value => page.locator(`input[value="${value}"]`);
    // Immediate offline directory works before the IPC resolves.
    await page.locator('.daily-filter-tags').click();
    await page.waitForFunction(() => platformTagFixture.reads === 1);
    assert.equal(await input('动态规划 DP').count(), 1);
    assert.equal(await input('索引独有算法').count(), 0);
    assert.equal(await input('1997').count(), 0);
    assert.equal(await input('洛谷标签#14').count(), 0);
    await input('动态规划 DP').check();
    await page.locator('#tag-picker-search').fill('规划');
    await page.locator('#tag-picker-dialog-options').evaluate(node => { node.scrollTop = 80; });
    const beforeScroll = await page.locator('#tag-picker-dialog-options').evaluate(node => node.scrollTop);
    await page.evaluate(() => platformTagFixture.requests[0].resolve(platformTagFixture.catalog));
    await page.waitForFunction(() => document.querySelector('#daily-tag-coverage')?.textContent.includes('AT：10 题，未提供标签'));
    assert.equal(await page.locator('#tag-picker-search').inputValue(), '规划');
    assert.equal(await input('动态规划 DP').isChecked(), true);
    assert.equal(await input('动态规划 DP').count(), 1, 'same-name source labels merge with the official preset');
    assert.equal(await page.locator('#tag-picker-dialog-options').evaluate(node => node.scrollTop), beforeScroll);
    const dp = page.locator('#tag-picker-dialog-options label').filter({ has: input('动态规划 DP') });
    assert.match(await dp.locator('.tag-option-sources').innerText(), /CF.*LC.*LG/);
    assert.match(await page.locator('#daily-tag-coverage').innerText(), /CF：20\/20 题有标签，3 标签/);
    assert.match(await page.locator('#daily-tag-coverage').innerText(), /2026-11-20T12:00:00Z/);
    await page.locator('#tag-picker-search').fill('索引独有');
    assert.equal(await input('索引独有算法').isVisible(), true);
    const novel = page.locator('#tag-picker-dialog-options label').filter({ has: input('索引独有算法') });
    assert.equal(await novel.locator('.tag-option-sources').innerText(), 'CF · LC');
    await input('索引独有算法').check();
    // Search and wheel keep the acquired option node, not another rebuild.
    await page.evaluate(() => { window.acquiredTagNode = [...document.querySelectorAll('#tag-picker-dialog-options input')].find(node => node.value === '索引独有算法'); });
    await page.locator('#tag-picker-search').fill('');
    await page.locator('#tag-picker-dialog-options').hover(); await page.mouse.wheel(0, 600);
    assert.equal(await page.evaluate(() => window.acquiredTagNode === [...document.querySelectorAll('#tag-picker-dialog-options input')].find(node => node.value === '索引独有算法')), true);
    await page.locator('#tag-picker-confirm').click();
    assert.match(await page.locator('.daily-filter-tags').innerText(), /已选 2/);
    // A closed request cannot rewrite/reopen the next picker session.
    await page.locator('.daily-filter-tags').click();
    await page.waitForFunction(() => platformTagFixture.reads === 2);
    await page.locator('#tag-picker-close').click();
    await page.keyboard.press('/');
    await page.locator('#tag-filter-trigger').click();
    await page.waitForFunction(() => platformTagFixture.reads === 3);
    await page.evaluate(() => platformTagFixture.requests[1].resolve({ ...platformTagFixture.catalog, tags: [{ name: '过期响应算法', sources: ['CF'] }] }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.equal(await input('过期响应算法').count(), 0);
    await page.evaluate(() => platformTagFixture.requests[2].resolve(platformTagFixture.catalog));
    await page.waitForFunction(() => !document.querySelector('#daily-tag-coverage')?.textContent.includes('正在读取'));
    assert.equal(await input('索引独有算法').count(), 1, 'acquired choices also appear in the problem filter');
    assert.equal(await input('1997').count(), 1, 'existing filter history remains intact');
    await page.locator('#tag-picker-cancel').click();
    await page.locator('#submit-button').click();
    await page.locator('#record-tag-open').click();
    await page.waitForFunction(() => platformTagFixture.reads === 4);
    await page.evaluate(() => platformTagFixture.requests[3].resolve(platformTagFixture.catalog));
    await page.waitForFunction(() => !document.querySelector('#daily-tag-coverage')?.textContent.includes('正在读取'));
    assert.equal(await input('索引独有算法').count(), 1, 'acquired choices also appear in the editor');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tag-picker-dialog').evaluate(node => node.open), false);
    assert.equal(await page.locator('#submit-dialog').evaluate(node => node.open), true);
    assert.equal(await page.evaluate(() => platformTagFixture.writes), 0);
    assert.deepEqual(errors, []);
    console.log('DAILY PLATFORM TAGS UI PASS: immediate presets, async real-index tags/source dedupe, platform coverage and missing AT labels, preserved search/selection/scroll/DOM, stale response isolation, filter/editor and read-only IPC');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
