'use strict';
const assert = require('node:assert/strict');
const { appPath } = require('./app-path.cjs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.evaluate(() => {
      window.calls = [];
      window.failNext = false;
      window.notebook = { dailyDraw: async filters => {
        window.calls.push(filters);
        if (window.failNext) { window.failNext = false; throw new Error('fixture draw failure'); }
        if (filters.excludedIds?.includes('CF:1A')) throw new Error('没有其他符合条件的题目，请调整筛选条件后重试');
        return { problem: { id: 'CF:1A', title: 'Fixture problem', url: 'https://example.com/problem/1', source: 'CF', rating: 1200, tags: ['dp'], statementText: 'must not render' } };
      } };
      window.copied = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copied.push(text); } } });
    });
    await page.addScriptTag({ path: appPath('ui/daily-problem.js') });
    await page.addStyleTag({ path: appPath('ui/daily-problem.css') });
    await page.evaluate(() => {
      window.opened = [];
      document.body.append(window.DailyProblem.create({ draw: filters => window.notebook.dailyDraw(filters), openExternal: url => window.opened.push(url), chooseTags: (selected, onApply) => onApply(new Set([...selected, '动态规划'])), updateLibrary: () => window.notebook.updateLibrary() }));
    });
    await page.locator('.daily-filter-tags').click();
    const source = page.getByLabel('题目来源');
    const draw = page.locator('.daily-draw');
    for (const [index, value] of ['local', 'public', 'all', 'CF'].entries()) {
      await source.selectOption(value);
      await draw.click();
      await page.waitForFunction(count => window.calls.length === count, index + 1);
    }
    const calls = await page.evaluate(() => window.calls);
    assert.deepEqual(calls.map(call => call.source), ['local', 'public', 'all', 'CF']);
    for (const call of calls.slice(0, 3)) assert.equal(call.platform, undefined);
    assert.equal(calls[3].platform, 'CF');
    for (const call of calls) assert.equal(call.excludedIds, undefined, 'ordinary draws do not exclude the current problem');
    assert.equal(await page.locator('.daily-problem-title').innerText(), 'Fixture problem');
    assert.deepEqual(await page.locator('.daily-rating').allTextContents(), ['CF 原生 1200'], 'native CF rating keeps its source label');
    assert.equal(await page.locator('.daily-source').innerText(), 'Codeforces');
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷难度：待评级');
    assert.equal(await page.locator('.daily-tags-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.daily-problem-tags').textContent(), '', 'collapsed tags do not create tag text nodes');
    await page.locator('.daily-tags-toggle').click();
    assert.equal(await page.locator('.daily-tags-toggle').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.daily-problem-tags').innerText(), 'dp');
    await page.locator('.daily-tags-toggle').click();
    assert.equal(await page.locator('.daily-problem-tags').textContent(), '');
    assert.equal(await page.locator('.daily-duration').isVisible(), true);
    assert.equal(await page.locator('.daily-problem-result > .daily-problem-tags').count(), 0);
    assert.equal(await page.locator('.daily-problem-result > .daily-problem-statement').count(), 0);
    assert.equal(await page.getByText('must not render').count(), 0);
    assert.deepEqual(calls[0].tags, ['动态规划']);
    assert.equal(await page.locator('.daily-problem-link').innerText(), 'https://example.com/problem/1');
    await page.locator('.daily-problem-link').click();
    assert.deepEqual(await page.evaluate(() => window.opened), ['https://example.com/problem/1']);

    await page.locator('.daily-change').click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-error').textContent.includes('没有其他符合条件的题目'));
    assert.deepEqual(await page.evaluate(() => window.calls.at(-1).excludedIds), ['CF:1A', 'https://example.com/problem/1']);
    assert.equal(await page.locator('.daily-problem-error').isVisible(), true);
    assert.equal(await page.locator('.daily-problem-title').innerText(), 'Fixture problem');
    assert.equal(await page.locator('.daily-change').isEnabled(), true);

    await page.evaluate(() => { window.failNext = true; });
    await page.locator('.daily-change').click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-error').textContent === 'fixture draw failure');
    assert.equal(await page.locator('.daily-problem-error').isVisible(), true);
    assert.equal(await page.locator('.daily-problem-title').innerText(), 'Fixture problem');

    await page.locator('.daily-copy').click();
    assert.deepEqual(await page.evaluate(() => window.copied), ['https://example.com/problem/1']);
    assert.equal(await page.locator('.daily-copy').innerText(), '已复制');

    const min = page.getByLabel('最低 Codeforces Rating');
    const max = page.getByLabel('最高 Codeforces Rating');
    await min.fill('3400');
    await max.fill('3400');
    await page.getByRole('button', { name: '＋ 难度' }).click();
    assert.equal(await min.inputValue(), '3400');
    assert.equal(await max.inputValue(), '3400');
    assert.equal(await page.getByLabel('最低洛谷难度', { exact: true }).inputValue(), '入门');
    assert.equal(await page.getByLabel('最高洛谷难度', { exact: true }).inputValue(), '入门');
    await page.getByRole('button', { name: '− 难度' }).click();
    assert.equal(await page.getByLabel('最低洛谷难度', { exact: true }).inputValue(), '入门', 'bounded adjustments clamp at the first level');
    assert.equal(await page.getByLabel('最高洛谷难度', { exact: true }).inputValue(), '入门');
    await page.getByLabel('最低洛谷难度', { exact: true }).selectOption('普及');
    await page.getByLabel('最高洛谷难度', { exact: true }).selectOption('普及');
    await page.getByRole('button', { name: '＋ 难度' }).click();
    assert.equal(await page.getByLabel('最低洛谷难度', { exact: true }).inputValue(), '普及+/提高-');
    assert.equal(await page.getByLabel('最高洛谷难度', { exact: true }).inputValue(), '普及+/提高-');
    assert.equal(await min.inputValue(), '3400');
    const fonts = await page.locator('.daily-problem-actions').evaluate(el => [...el.children].filter(child => !child.hidden).map(child => getComputedStyle(child).fontSize));
    assert.equal(new Set(fonts).size, 1, 'difficulty and action font sizes match');
    assert.equal(await page.evaluate(() => window.calls.length), 6, 'difficulty adjustment does not draw');
    await draw.click();
    await page.waitForFunction(() => window.calls.length === 7);
    const last = await page.evaluate(() => window.calls.at(-1));
    assert.equal(last.ratingMin, 3400);
    assert.equal(last.ratingMax, 3400);
    assert.equal(last.luoguDifficultyMin, '普及+/提高-');
    assert.equal(last.luoguDifficultyMax, '普及+/提高-');
    assert.equal(last.luoguDifficulty, undefined);
    assert.equal(last.difficulty, undefined);
    assert.equal(await page.locator('.daily-problem-error').isVisible(), false);
    await page.evaluate(() => {
      window.notebook.dailyDraw = async filters => {
        window.calls.push(filters);
        return { problem: { title: 'Alternative problem', url: 'https://example.com/problem/2', source: 'CF', rating: 3500 } };
      };
    });
    await page.locator('.daily-change').click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-title').textContent === 'Alternative problem');
    const redraw = await page.evaluate(() => window.calls.at(-1));
    assert.deepEqual(redraw.excludedIds, ['CF:1A', 'https://example.com/problem/1']);
    assert.equal(redraw.ratingMin, 3400);
    assert.equal(redraw.ratingMax, 3400);
    assert.equal(await page.locator('.daily-problem-error').isVisible(), false);
    await page.locator('.daily-change').click();
    await page.waitForFunction(() => window.calls.length === 9);
    assert.deepEqual(await page.evaluate(() => window.calls.at(-1).excludedIds), ['https://example.com/problem/2'], 'URL-only results remain excludable');

    await page.evaluate(() => {
      window.notebook.dailyDraw = filters => {
        window.calls.push(filters);
        return new Promise(resolve => {
          window.releaseDraw = () => resolve({ problem: { id: 'CF:9Z', title: 'Held problem', url: 'https://example.com/problem/9', source: 'CF', rating: 1200 } });
        });
      };
    });
    await draw.click();
    await page.waitForFunction(() => { const el = document.querySelector('.daily-problem-loading'); return el && !el.hidden; });
    assert.equal(await page.locator('.daily-problem-loading').isVisible(), true);
    assert.match(await page.locator('.daily-problem-loading').innerText(), /正在抽题/);
    assert.equal(await draw.isDisabled(), true);
    assert.equal(await page.locator('.daily-change').isDisabled(), true);
    assert.equal(await page.locator('.daily-problem-title').isVisible(), false, 'previous result is hidden while waiting');
    assert.equal(await page.locator('.daily-problem-result').getAttribute('aria-busy'), 'true');
    await page.evaluate(() => window.releaseDraw());
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Held problem');
    assert.equal(await page.locator('.daily-problem-loading').isVisible(), false);
    assert.equal(await draw.isDisabled(), false);
    assert.equal(await page.locator('.daily-problem-result').getAttribute('aria-busy'), 'false');
    await page.evaluate(() => {
      window.libraryUpdates = [];
      window.notebook.getProblemEnrichment = async url => ({ problem: { id: 'LG:P9234', title: '已缓存原生难度', url, source: 'LG', rating: null, estimatedCfRating: 1600, luoguDifficulty: '普及+/提高', estimatedLuoguDifficulty: null, tags: [] } });
      window.notebook.updateLibrary = async () => {
        window.libraryUpdates.push(1);
        return { total: 42, platforms: { LG: { status: 'updated', added: 7 }, CF: { status: 'skipped', added: 0 } } };
      };
    });
    await page.locator('.daily-refresh').click();
    await page.waitForFunction(() => document.querySelector('.daily-refresh')?.textContent.includes('已更新 7 题'));
    assert.equal(await page.evaluate(() => window.libraryUpdates.length), 1);
    assert.equal(await page.locator('.daily-refresh').isEnabled(), true);
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷难度：普及+/提高-');
    assert.equal(await page.locator('.daily-cf').innerText(), 'CF 参考 1600');
    assert.equal(await page.locator('.daily-problem-title').innerText(), '已缓存原生难度', 'refresh library also updates metadata on the displayed problem');
    await page.evaluate(() => { window.notebook.updateLibrary = async () => { throw new Error('题库更新失败样例'); }; });
    await page.locator('.daily-refresh').click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-error')?.textContent === '题库更新失败样例');
    assert.equal(await page.locator('.daily-problem-error').isVisible(), true);

    await page.evaluate(() => {
      window.notebook.dailyDraw = async filters => {
        window.calls.push(filters);
        if (window.failNext) { window.failNext = false; throw new Error('CLIST fixture draw failure'); }
        return { problem: { id: 'LG:P1800', title: 'CLIST rated problem', url: 'https://www.luogu.com.cn/problem/P1800', source: 'LG', origin: 'clist-luogu', rating: null, clistRating: 1800 } };
      };
    });
    await source.selectOption('LG');
    await draw.click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'CLIST rated problem');
    assert.deepEqual(await page.locator('.daily-rating').allTextContents(), ['CLIST 1800'], 'CLIST rating has its own label');
    assert.doesNotMatch(await page.locator('.daily-problem-result').innerText(), /CF\s*1800|估算/, 'CLIST rating is never presented as native or estimated CF');
    assert.equal(await page.locator('.daily-estimated').count(), 0);
    await page.evaluate(() => { window.failNext = true; });
    await page.locator('.daily-change').click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-error')?.textContent === 'CLIST fixture draw failure');
    const clistRetry = await page.evaluate(() => window.calls.at(-1));
    assert.equal(clistRetry.source, 'LG');
    assert.equal(clistRetry.platform, 'LG');
    assert.deepEqual(clistRetry.excludedIds, ['LG:P1800', 'https://www.luogu.com.cn/problem/P1800']);
    assert.deepEqual(clistRetry.tags, ['动态规划'], 'selected tag callbacks survive later draws');
    assert.equal(await page.locator('.daily-problem-title').innerText(), 'CLIST rated problem', 'failed change retains the CLIST result');
    assert.equal(await page.locator('.daily-problem-title').isVisible(), true);
    assert.deepEqual(await page.locator('.daily-rating').allTextContents(), ['CLIST 1800']);
    assert.equal(await draw.isEnabled(), true);
    assert.equal(await page.locator('.daily-change').isEnabled(), true);
    await page.locator('.daily-copy').click();
    assert.equal(await page.evaluate(() => window.copied.at(-1)), 'https://www.luogu.com.cn/problem/P1800');

    await page.evaluate(() => {
      window.notebook.dailyDraw = async filters => {
        window.calls.push(filters);
        return { problem: { id: 'AT:abc001_a', title: 'Native source rated problem', url: 'https://atcoder.jp/contests/abc001/tasks/abc001_1', source: 'AT', rating: 900, clistRating: 1800 } };
      };
    });
    await source.selectOption('AT');
    await draw.click();
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Native source rated problem');
    assert.deepEqual(await page.locator('.daily-rating').allTextContents(), ['CLIST 1800', '来源评分 900'], 'non-CF native rating stays distinct from CLIST');
    assert.doesNotMatch(await page.locator('.daily-problem-meta').innerText(), /CF\s*1800|CF\s*900|估算/);

    const autoPage = await browser.newPage();
    await autoPage.setContent('<!doctype html><html><body></body></html>');
    await autoPage.addScriptTag({ path: appPath('ui/daily-problem.js') });
    await autoPage.addStyleTag({ path: appPath('ui/daily-problem.css') });
    await autoPage.evaluate(() => {
      window.calls = 0;
      const draw = async () => { window.calls += 1; return { problem: { id: 'CF:9A', title: 'Auto problem', url: 'https://example.com/9', source: 'CF', rating: 1200 } }; };
      document.body.append(window.DailyProblem.create({ draw, openExternal: () => {}, chooseTags: (selected, onApply) => onApply(selected), autoDraw: true }));
    });
    await autoPage.waitForFunction(() => window.calls === 1);
    assert.equal(await autoPage.locator('.daily-problem-title').innerText(), 'Auto problem');
    await autoPage.evaluate(() => {
      const draw = async () => { window.calls += 1; return { problem: { id: 'CF:9B', title: 'Second mount', url: 'https://example.com/10', source: 'CF', rating: 1200 } }; };
      const holder = document.createElement('div');
      document.body.append(holder);
      holder.append(window.DailyProblem.create({ draw, openExternal: () => {}, chooseTags: (selected, onApply) => onApply(selected), autoDraw: true }));
    });
    await autoPage.waitForTimeout(500);
    assert.equal(await autoPage.evaluate(() => window.calls), 1, 'one automatic draw per session');
    assert.equal(await autoPage.locator('.daily-problem-title').last().innerText(), 'Auto problem');
    console.log('daily problem UI smoke passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
