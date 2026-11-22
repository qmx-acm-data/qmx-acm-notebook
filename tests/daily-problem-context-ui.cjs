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
      window.requests = [];
      window.mountDaily = (contextKey, autoDraw = false) => {
        document.body.replaceChildren(window.DailyProblem.create({
          contextKey, autoDraw,
          draw: filters => new Promise((resolve, reject) => window.requests.push({ contextKey, filters, resolve, reject })),
          openExternal: () => {},
          chooseTags: (selected, onApply) => { window.applyTags = onApply; }
        }));
      };
      window.problem = title => ({ problem: { id: `local:${title}`, title, source: 'LG', url: 'https://www.luogu.com.cn/problem/P1000', rating: null, clistRating: 1800 } });
      window.mountDaily('repo/A');
    });
    await page.locator('.daily-draw').click();
    await page.waitForFunction(() => window.requests.length === 1);
    await page.evaluate(() => window.requests[0].resolve(window.problem('Private account A result')));
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Private account A result');
    await page.getByLabel('题目来源').selectOption('local');
    await page.getByLabel('最低 Codeforces Rating').fill('1000');
    await page.getByLabel('最低洛谷难度', { exact: true }).selectOption('普及');
    await page.getByLabel('最高洛谷难度', { exact: true }).selectOption('提高');
    await page.locator('.daily-filter-tags').click();
    await page.evaluate(() => { window.applyTags(new Set(['A private tag'])); window.oldApplyTags = window.applyTags; });
    await page.locator('.daily-change').click();
    await page.waitForFunction(() => window.requests.length === 2);
    await page.evaluate(() => window.mountDaily('repo/B', true));
    assert.equal(await page.locator('.daily-problem-title').count(), 0, 'context switch removes the previous local result');
    assert.equal(await page.getByLabel('题目来源').inputValue(), 'all');
    assert.equal(await page.getByLabel('最低 Codeforces Rating').inputValue(), '');
    assert.equal(await page.getByLabel('最低洛谷难度', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('最高洛谷难度', { exact: true }).inputValue(), '');
    assert.equal(await page.locator('.daily-current-difficulty').innerText(), '当前难度：洛谷 不限');
    assert.equal(await page.locator('.daily-filter-tags').innerText(), '算法标签…');
    await page.evaluate(() => window.oldApplyTags(new Set(['late private tag'])));
    assert.equal(await page.locator('.daily-filter-tags').innerText(), '算法标签…', 'old context tag callbacks cannot update the new account');
    await page.waitForFunction(() => window.requests.length === 3);
    assert.equal(await page.evaluate(() => window.requests[2].contextKey), 'repo/B', 'new context receives its automatic draw');
    await page.evaluate(async () => { window.requests[1].resolve(window.problem('Late private account A result')); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(await page.locator('.daily-problem-title').count(), 0, 'old request success cannot expose the previous account result');
    assert.equal(await page.locator('.daily-draw').isDisabled(), true, 'old request completion cannot release a new context pending draw');
    await page.evaluate(() => window.requests[2].resolve(window.problem('Account B result')));
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Account B result');
    await page.locator('.daily-draw').click();
    await page.waitForFunction(() => window.requests.length === 4);
    await page.evaluate(() => window.mountDaily('repo/A'));
    assert.equal(await page.locator('.daily-problem-title').count(), 0, 'returning to an earlier context does not resurrect cached local data');
    await page.locator('.daily-draw').click();
    await page.waitForFunction(() => window.requests.length === 5);
    await page.evaluate(async () => { window.requests[3].reject(new Error('Private account B failure')); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(await page.locator('.daily-problem-error').isVisible(), false, 'old context errors do not cross account boundaries');
    assert.equal(await page.locator('.daily-draw').isDisabled(), true);
    await page.evaluate(() => window.requests[4].resolve(window.problem('Fresh account A result')));
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Fresh account A result');
    assert.equal(await page.locator('.daily-draw').isEnabled(), true);
    await page.evaluate(() => {
      window.mountDaily('repo/A-before-timer', true);
      window.mountDaily('repo/B-before-timer', true);
    });
    await page.waitForFunction(() => window.requests.length === 6);
    assert.equal(await page.evaluate(() => window.requests[5].contextKey), 'repo/B-before-timer');
    await page.evaluate(() => window.requests[5].resolve(window.problem('Newest timer context')));
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Newest timer context');
    assert.equal(await page.evaluate(() => window.requests.length), 6, 'stale automatic timers cannot start duplicate draws');
    assert.deepEqual(errors, []);
    console.log('daily problem context UI passed: account/library cache reset, stale success/error/tag callback and automatic timer isolation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
