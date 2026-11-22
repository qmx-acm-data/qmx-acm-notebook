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
      window.fixture = { id: 'LG:P1234', title: 'Range fixture', source: 'LG', url: 'https://www.luogu.com.cn/problem/P1234',
        rating: null, luoguDifficulty: '普及/提高−', estimatedLuoguDifficulty: '提高', tags: [] };
      window.mountDaily = (contextKey = 'range/A') => document.body.replaceChildren(window.DailyProblem.create({
        contextKey, openExternal: () => {}, chooseTags: (selected, apply) => apply(new Set([...selected, '动态规划'])),
        draw: async filters => {
          window.calls.push(filters);
          if (window.rejectRange) throw new Error('最低洛谷难度不能高于最高洛谷难度');
          return { problem: window.fixture };
        }
      }));
      window.mountDaily();
    });
    const min = page.getByLabel('最低洛谷难度', { exact: true });
    const max = page.getByLabel('最高洛谷难度', { exact: true });
    const draw = page.locator('.daily-draw');
    const current = page.locator('.daily-current-difficulty');
    const levels = ['入门', '普及-', '普及', '普及+/提高-', '提高', '提高+/省选-', '省选/NOI-', 'NOI/NOI+/CTS'];
    assert.deepEqual(await min.locator('option').allTextContents(), ['洛谷难度 ≥不限', ...levels]);
    assert.deepEqual(await max.locator('option').allTextContents(), ['洛谷难度 ≤不限', ...levels]);
    assert.equal(await page.locator('.daily-filter-luogu').count(), 1, 'legacy class identifies the lower endpoint');
    assert.equal(await page.locator('.daily-problem-filters > select,.daily-problem-filters > input,.daily-problem-filters > button').count(), 6);
    await page.getByLabel('题目来源').selectOption('LG');
    await page.getByLabel('最低 Codeforces Rating').fill('1000');
    await page.getByLabel('最高 Codeforces Rating').fill('2000');
    await page.locator('.daily-filter-tags').click();
    await min.selectOption('普及'); await max.selectOption('提高');
    assert.equal(await current.innerText(), '当前难度：洛谷 普及 ～ 提高');
    await draw.click();
    await page.waitForFunction(() => window.calls.length === 1 && !document.querySelector('.daily-draw').disabled);
    assert.deepEqual(await page.evaluate(() => window.calls[0]), {
      source: 'LG', platform: 'LG', ratingMin: 1000, ratingMax: 2000,
      luoguDifficultyMin: '普及', luoguDifficultyMax: '提高', tags: ['动态规划']
    });
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷难度：普及');
    assert.equal(await page.locator('.daily-luogu').evaluate(el => el.classList.contains('tone-yellow')), true);
    assert.equal(await page.evaluate(() => window.fixture.luoguDifficulty), '普及/提高−', 'display normalization preserves raw native metadata');
    await page.evaluate(() => window.mountDaily());
    assert.equal(await min.inputValue(), '普及'); assert.equal(await max.inputValue(), '提高');
    assert.equal(await current.innerText(), '当前难度：洛谷 普及 ～ 提高');
    assert.equal(await page.locator('.daily-filter-tags').innerText(), '算法标签…（已选 1）');

    await page.locator('.daily-harder').click();
    assert.equal(await min.inputValue(), '普及+/提高-'); assert.equal(await max.inputValue(), '提高+/省选-');
    await page.locator('.daily-easier').click();
    assert.equal(await min.inputValue(), '普及'); assert.equal(await max.inputValue(), '提高');
    await min.selectOption('提高+/省选-'); await max.selectOption('NOI/NOI+/CTS');
    await page.locator('.daily-harder').click();
    assert.equal(await min.inputValue(), '提高+/省选-'); assert.equal(await max.inputValue(), 'NOI/NOI+/CTS', 'upper clamp preserves interval width');
    await min.selectOption('入门'); await max.selectOption('普及');
    await page.locator('.daily-easier').click();
    assert.equal(await min.inputValue(), '入门'); assert.equal(await max.inputValue(), '普及', 'lower clamp preserves interval width');
    await min.selectOption('普及'); await max.selectOption('');
    assert.equal(await current.innerText(), '当前难度：洛谷 ≥ 普及');
    await page.locator('.daily-harder').click();
    assert.equal(await min.inputValue(), '普及+/提高-'); assert.equal(await max.inputValue(), '');
    await min.selectOption(''); await max.selectOption('提高');
    assert.equal(await current.innerText(), '当前难度：洛谷 ≤ 提高');
    await page.locator('.daily-easier').click();
    assert.equal(await min.inputValue(), ''); assert.equal(await max.inputValue(), '普及+/提高-');
    await min.selectOption(''); await max.selectOption('');
    for (const control of ['.daily-easier', '.daily-harder']) {
      await min.selectOption(''); await max.selectOption(''); await page.locator(control).click();
      assert.equal(await min.inputValue(), '入门'); assert.equal(await max.inputValue(), '入门');
    }
    assert.equal(await page.evaluate(() => window.calls.length), 1, 'adjustment waits for explicit drawing');
    assert.equal(await page.getByLabel('最低 Codeforces Rating').inputValue(), '1000');
    assert.equal(await page.getByLabel('最高 Codeforces Rating').inputValue(), '2000');

    await min.selectOption('普及'); await max.selectOption('普及'); await draw.click();
    await page.waitForFunction(() => window.calls.length === 2 && !document.querySelector('.daily-draw').disabled);
    assert.equal(await current.innerText(), '当前难度：洛谷 普及');
    assert.equal(await page.evaluate(() => window.calls[1].luoguDifficultyMin), '普及');
    assert.equal(await page.evaluate(() => window.calls[1].luoguDifficultyMax), '普及');
    assert.equal(await page.evaluate(() => window.calls[1].difficulty), undefined, 'equal endpoints retain the range schema');
    await page.evaluate(() => { window.fixture = { ...window.fixture, luoguDifficulty: '暂无评定', estimatedLuoguDifficulty: '普及/提高−' }; });
    await draw.click();
    await page.waitForFunction(() => window.calls.length === 3 && !document.querySelector('.daily-draw').disabled);
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷参考：普及');
    assert.equal(await page.locator('.daily-luogu').evaluate(el => el.classList.contains('daily-estimated') && el.classList.contains('tone-yellow')), true);
    assert.equal(await page.evaluate(() => window.fixture.estimatedLuoguDifficulty), '普及/提高−');
    await page.evaluate(() => { window.fixture = { ...window.fixture, estimatedLuoguDifficulty: null }; });
    await draw.click();
    await page.waitForFunction(() => window.calls.length === 4 && !document.querySelector('.daily-draw').disabled);
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷难度：待评级', 'unrated native difficulty retains its placeholder');

    await min.selectOption('提高'); await max.selectOption('普及');
    await page.evaluate(() => { window.rejectRange = true; });
    await draw.click();
    await page.waitForFunction(() => !document.querySelector('.daily-problem-error').hidden);
    assert.equal(await page.locator('.daily-problem-error').innerText(), '最低洛谷难度不能高于最高洛谷难度');
    assert.equal(await min.inputValue(), '提高'); assert.equal(await max.inputValue(), '普及');
    assert.equal(await page.locator('.daily-problem-title').innerText(), 'Range fixture', 'range validation error retains the current result');
    assert.equal(await draw.isEnabled(), true);
    await page.evaluate(() => { window.rejectRange = false; window.mountDaily('range/B'); });
    assert.equal(await min.inputValue(), ''); assert.equal(await max.inputValue(), '');
    assert.equal(await current.innerText(), '当前难度：洛谷 不限');
    assert.equal(await page.locator('.daily-problem-title').count(), 0);
    assert.equal(await page.locator('.daily-filter-tags').innerText(), '算法标签…');

    for (const width of [1280, 900, 700, 600, 390]) {
      await page.setViewportSize({ width, height: 820 });
      const layout = await page.locator('.daily-problem-filters').evaluate(el => {
        const bounds = el.getBoundingClientRect();
        return {
          columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
          fields: [...el.querySelectorAll(':scope > select,:scope > input,:scope > button')].map(field => {
            const box = field.getBoundingClientRect();
            return { left: box.left, right: box.right, width: box.width, top: box.top };
          }), left: bounds.left, right: bounds.right,
          overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      assert.equal(layout.columns, width > 1000 ? 6 : width > 600 ? 3 : 2, `${width}px filter columns`);
      assert.equal(layout.fields.length, 6);
      assert.equal(new Set(layout.fields.map(field => Math.round(field.top))).size, 6 / layout.columns, `${width}px six fields fill complete rows without legacy input spans`);
      for (const field of layout.fields) assert.ok(field.width > 0 && field.left >= layout.left - 1 && field.right <= layout.right + 1, `${width}px field remains in grid`);
      assert.equal(layout.overflow, false, `${width}px page has no horizontal overflow`);
    }
    assert.deepEqual(errors, []);
    console.log('daily Luogu range UI passed: short native/reference labels, range submission, exact/single/unlimited shifts, clamps, remount/context, error retention and 390px layout (mock draw only)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
