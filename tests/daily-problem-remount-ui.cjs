'use strict';
const assert = require('node:assert/strict');
const { appPath } = require('./app-path.cjs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ path: appPath('ui/daily-problem.js') });
    await page.addStyleTag({ path: appPath('ui/daily-problem.css') });
    await page.evaluate(() => {
      window.calls = [];
      window.mountDaily = generation => {
        const section = window.DailyProblem.create({
          draw: filters => {
            window.calls.push({ generation, filters });
            return new Promise((resolve, reject) => { window.resolveDraw = resolve; window.rejectDraw = reject; });
          },
          openExternal: () => {},
          chooseTags: (selected, onApply) => { window.pickerSelected = [...selected]; window.applyTags = onApply; },
          autoDraw: true
        });
        document.body.replaceChildren(section);
      };
      window.mountDaily('before-timer');
      window.mountDaily('latest-timer');
    });
    await page.waitForFunction(() => window.calls.length === 1);
    assert.equal(await page.evaluate(() => window.calls[0].generation), 'latest-timer', 'automatic timer uses the latest mount API');
    assert.equal(await page.locator('.daily-draw').isDisabled(), true);
    await page.evaluate(() => window.mountDaily('pending-auto'));
    assert.equal(await page.locator('.daily-problem-loading').isVisible(), true, 'remount inherits the pending automatic draw');
    assert.equal(await page.locator('.daily-draw').isDisabled(), true);
    await page.evaluate(() => window.resolveDraw({ problem: { id: 'LG:P1800', title: 'Auto remount result', source: 'LG', url: 'https://www.luogu.com.cn/problem/P1800', rating: null, clistRating: 1800 } }));
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Auto remount result');
    assert.equal(await page.evaluate(() => window.calls.length), 1);
    assert.equal(await page.locator('.daily-rating').innerText(), 'CLIST 1800');
    assert.equal(await page.locator('.daily-draw').isEnabled(), true);

    await page.getByLabel('题目来源').selectOption('local');
    await page.getByLabel('最低 Codeforces Rating').fill('1000');
    await page.getByLabel('最高 Codeforces Rating').fill('2000');
    await page.getByLabel('最低洛谷难度', { exact: true }).selectOption('普及');
    await page.getByLabel('最高洛谷难度', { exact: true }).selectOption('提高');
    await page.locator('.daily-filter-tags').click();
    await page.evaluate(() => window.applyTags(new Set(['动态规划 DP'])));
    await page.evaluate(() => window.mountDaily('restored-filters'));
    assert.equal(await page.getByLabel('题目来源').inputValue(), 'local');
    assert.equal(await page.getByLabel('最低 Codeforces Rating').inputValue(), '1000');
    assert.equal(await page.getByLabel('最高 Codeforces Rating').inputValue(), '2000');
    assert.equal(await page.getByLabel('最低洛谷难度', { exact: true }).inputValue(), '普及');
    assert.equal(await page.getByLabel('最高洛谷难度', { exact: true }).inputValue(), '提高');
    assert.equal(await page.locator('.daily-current-difficulty').innerText(), '当前难度：洛谷 普及 ～ 提高');
    assert.equal(await page.locator('.daily-filter-tags').innerText(), '算法标签…（已选 1）');
    await page.locator('.daily-filter-tags').click();
    assert.deepEqual(await page.evaluate(() => window.pickerSelected), ['动态规划 DP']);
    await page.evaluate(() => window.mountDaily('picker-open-remount'));
    await page.evaluate(() => window.applyTags(new Set(['字符串', '用户历史'])));
    assert.equal(await page.locator('.daily-filter-tags').innerText(), '算法标签…（已选 2）', 'an open picker callback updates the newest mount');
    await page.locator('.daily-change').click();
    await page.waitForFunction(() => window.calls.length === 2);
    assert.deepEqual(await page.evaluate(() => window.calls[1]), { generation: 'picker-open-remount', filters: {
      source: 'local', platform: undefined, ratingMin: 1000, ratingMax: 2000,
      luoguDifficultyMin: '普及', luoguDifficultyMax: '提高', tags: ['字符串', '用户历史'],
      excludedIds: ['LG:P1800', 'https://www.luogu.com.cn/problem/P1800']
    } });
    await page.evaluate(() => window.mountDaily('pending-failure'));
    assert.equal(await page.locator('.daily-problem-loading').isVisible(), true);
    assert.equal(await page.locator('.daily-change').isDisabled(), true);
    assert.equal(await page.locator('.daily-problem-title').isVisible(), false);
    await page.evaluate(() => window.rejectDraw(new Error('remounted draw failure')));
    await page.waitForFunction(() => document.querySelector('.daily-problem-error')?.textContent === 'remounted draw failure');
    assert.equal(await page.locator('.daily-problem-title').innerText(), 'Auto remount result');
    assert.equal(await page.locator('.daily-problem-title').isVisible(), true);
    assert.equal(await page.locator('.daily-draw').isEnabled(), true);
    await page.evaluate(() => window.mountDaily('after-failure'));
    assert.equal(await page.locator('.daily-problem-error').innerText(), 'remounted draw failure');
    assert.equal(await page.locator('.daily-problem-error').isVisible(), true);
    await page.locator('.daily-draw').click();
    await page.waitForFunction(() => window.calls.length === 3);
    assert.equal(await page.evaluate(() => window.calls[2].generation), 'after-failure');
    assert.equal(await page.evaluate(() => window.calls[2].filters.excludedIds), undefined);
    await page.evaluate(() => window.mountDaily('pending-success'));
    await page.evaluate(() => window.resolveDraw({ problem: { id: 'CF:2A', title: 'Manual remount result', source: 'CF', url: 'https://codeforces.com/problemset/problem/2/A', rating: 1200 } }));
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Manual remount result');
    assert.equal(await page.locator('.daily-problem-error').isVisible(), false);
    assert.equal(await page.locator('.daily-problem-result').getAttribute('aria-busy'), 'false');
    assert.equal(await page.locator('.daily-problem-loading').isVisible(), false);
    assert.equal(await page.evaluate(() => window.calls.length), 3, 'remount never starts a duplicate draw');
    assert.deepEqual(errors, []);
    console.log('daily problem remount UI passed: automatic timer, pending success/failure, filters, picker callback and result retention');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
