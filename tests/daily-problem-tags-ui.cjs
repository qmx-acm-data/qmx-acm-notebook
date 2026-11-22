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
      window.pickerSelections = [];
      window.failNext = false;
      document.body.append(window.DailyProblem.create({
        draw: async filters => {
          window.calls.push(filters);
          if (window.failNext) { window.failNext = false; throw new Error('tag-filter draw failure'); }
          return { problem: { id: 'local:tagged', title: 'Tagged local problem', source: 'LG', url: 'https://www.luogu.com.cn/problem/P1000', rating: null, clistRating: 1800 } };
        },
        openExternal: () => {},
        chooseTags: (selected, onApply) => {
          window.pickerSelections.push([...selected]);
          window.applyDailyTags = onApply;
        }
      }));
    });
    const tags = page.locator('.daily-filter-tags');
    const draw = page.locator('.daily-draw');
    await page.getByLabel('题目来源').selectOption('local');
    await page.getByLabel('最低 Codeforces Rating').fill('1000');
    await page.getByLabel('最高 Codeforces Rating').fill('2000');
    await page.getByLabel('最低洛谷难度', { exact: true }).selectOption('普及');
    await page.getByLabel('最高洛谷难度', { exact: true }).selectOption('普及');

    await tags.click();
    assert.deepEqual(await page.evaluate(() => window.pickerSelections), [[]]);
    assert.equal(await tags.innerText(), '算法标签…', 'opening or cancelling the picker does not apply tags');
    await draw.click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Tagged local problem');
    assert.deepEqual(await page.evaluate(() => window.calls[0].tags), [], 'cancelled picker leaves draw filters empty');

    await tags.click();
    await page.evaluate(() => {
      const chosen = new Set(['动态规划 DP', '用户历史']);
      window.applyDailyTags(chosen);
      chosen.add('未确认的后续修改');
    });
    assert.equal(await tags.innerText(), '算法标签…（已选 2）');
    assert.equal(await page.evaluate(() => window.calls.length), 1, 'confirming tags waits for an explicit draw');
    await tags.click();
    assert.deepEqual(await page.evaluate(() => window.pickerSelections.at(-1)), ['动态规划 DP', '用户历史'], 'reopening passes the confirmed selection and copies the callback input');
    await page.evaluate(() => { window.failNext = true; });
    await page.locator('.daily-change').click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-error')?.textContent === 'tag-filter draw failure');
    assert.deepEqual(await page.evaluate(() => window.calls.at(-1)), {
      source: 'local', platform: undefined, ratingMin: 1000, ratingMax: 2000,
      luoguDifficultyMin: '普及', luoguDifficultyMax: '普及', tags: ['动态规划 DP', '用户历史'],
      excludedIds: ['local:tagged', 'https://www.luogu.com.cn/problem/P1000']
    }, 'local change preserves rating, difficulty, confirmed tags and exclusions');
    assert.equal(await page.locator('.daily-problem-title').innerText(), 'Tagged local problem');
    assert.equal(await page.locator('.daily-problem-title').isVisible(), true);
    assert.equal(await tags.innerText(), '算法标签…（已选 2）', 'failed draw retains confirmed tags');
    assert.equal(await draw.isEnabled(), true);

    await tags.click();
    await page.evaluate(() => window.applyDailyTags(new Set()));
    assert.equal(await tags.innerText(), '算法标签…');
    assert.equal(await page.evaluate(() => window.calls.length), 2, 'clearing tags does not draw automatically');
    await draw.click();
    await page.waitForFunction(() => window.calls.length === 3 && document.querySelector('.daily-problem-error').hidden);
    assert.deepEqual(await page.evaluate(() => window.calls.at(-1).tags), []);
    assert.equal(await page.evaluate(() => window.calls.at(-1).excludedIds), undefined, 'ordinary draw keeps its existing exclusion semantics');
    assert.deepEqual(errors, []);
    console.log('daily problem tags UI passed: staged callback, cancel, local filters, exclusions, failure retention and clear');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
