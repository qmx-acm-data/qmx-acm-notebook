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
      window.mountDaily = (contextKey = 'result/A') => document.body.replaceChildren(window.DailyProblem.create({
        contextKey,
        draw: () => new Promise((resolve, reject) => window.requests.push({ resolve, reject, startedAt: performance.now() })),
        chooseTags: () => {}, openExternal: () => {}
      }));
      window.fixture = {
        problem: { id: 'LG:P42', title: 'Reference rated fixture', source: 'LG', url: 'https://www.luogu.com.cn/problem/P42',
          rating: null, estimatedCfRating: 1600, estimatedLuoguDifficulty: '提高', clistRating: 1717,
          ratingEstimateReason: 'AI 建议（已确认）：AI 建议，待审核（低置信度）：根据平台难度映射得到的参考评分', supplementInfo: { source: 'ai', revision: 1, tags: false, difficulty: true }, tags: ['secret algorithm', 'second hint'] },
        note: 'CLIST 未配置 API Key；本地题库索引 72 题',
        diagnostics: { durationMs: 7, candidateCount: 12, dataMode: 'index', platforms: { CF: { count: 30, tagged: 25 }, LG: { count: 42, tagged: 31 } } }
      };
      window.mountDaily();
    });
    const draw = page.locator('.daily-draw');
    await draw.click();
    await page.waitForFunction(() => window.requests.length === 1);
    assert.equal(await page.locator('.daily-duration').isVisible(), false);
    await page.waitForTimeout(140);
    await page.evaluate(() => {
      window.requests[0].resolve(window.fixture);
      window.expectedElapsed = performance.now() - window.requests[0].startedAt;
    });
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Reference rated fixture');
    assert.equal(await page.locator('.daily-source').innerText(), '洛谷');
    assert.equal(await page.locator('.daily-cf').innerText(), 'CF 参考 1600');
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷参考：提高');
    assert.equal(await page.locator('.daily-clist').innerText(), 'CLIST 1717');
    assert.equal(await page.locator('.daily-rating-explanation').getAttribute('open'), null);
    assert.equal(await page.locator('.daily-rating-explanation summary').innerText(), '题目信息');
    assert.equal(await page.locator('.daily-reference-note').isVisible(), false);
    assert.equal(await page.locator('.daily-problem-note').isVisible(), false);
    assert.equal(await page.locator('.daily-coverage').isVisible(), false);
    assert.equal(await page.locator('.daily-supplement-source').innerText(), 'AI 补充 · 已审核');
    await page.locator('.daily-rating-explanation summary').click();
    assert.match(await page.locator('.daily-rating-explanation').innerText(), /根据平台难度映射/);
    assert.doesNotMatch(await page.locator('.daily-reference-note').innerText(), /待审核/);
    assert.match(await page.locator('.daily-reference-note').innerText(), /低置信度/);
    assert.equal(await page.locator('.daily-problem-note').isVisible(), true);
    assert.equal(await page.locator('.daily-coverage').isVisible(), true);
    assert.match(await page.locator('.daily-coverage').innerText(), /本地索引.*Codeforces 30 题（有标签 25）.*洛谷 42 题（有标签 31）.*本次候选 12 题/);
    const durationTitle = await page.locator('.daily-duration').getAttribute('title');
    const measuredMs = Number(durationTitle.match(/客户端总耗时 ([\d.]+) 毫秒/)[1]);
    const expectedMs = await page.evaluate(() => window.expectedElapsed);
    assert.ok(measuredMs >= 140 && Math.abs(measuredMs - expectedMs) < 80, `client duration ${measuredMs} tracks held request ${expectedMs}`);
    assert.match(durationTitle, /服务端处理 7\.0 毫秒/);
    assert.match(await page.locator('.daily-duration').innerText(), /抽题耗时：/);

    const toggle = page.locator('.daily-tags-toggle');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.getByText('secret algorithm', { exact: true }).count(), 0, 'tags are absent from DOM before reveal');
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(await page.locator('.daily-problem-tags .tag').allTextContents(), ['secret algorithm', 'second hint']);
    assert.equal(await page.locator('.daily-problem-tags .tag[class*="tag-color-"]').count(), 2, 'revealed tags share the library color family');
    await page.evaluate(() => window.mountDaily());
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'same result remount retains deliberate reveal');
    assert.match(await page.locator('.daily-duration').getAttribute('title'), /服务端处理 7\.0/);
    await draw.click();
    await page.waitForFunction(() => window.requests.length === 2);
    await page.evaluate(() => window.requests[1].resolve(window.fixture));
    await page.waitForFunction(() => document.querySelector('.daily-problem-result').getAttribute('aria-busy') === 'false');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'new draw resets even if API reuses the same result object');
    assert.equal(await page.getByText('secret algorithm', { exact: true }).count(), 0);

    await draw.click();
    await page.waitForFunction(() => window.requests.length === 3);
    await page.evaluate(() => window.requests[2].resolve({ problem: { id: 'NC:1', title: 'Unrated fixture', source: 'NC', url: 'https://ac.nowcoder.com/acm/problem/1', rating: null, tags: [] } }));
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'Unrated fixture');
    assert.equal(await page.locator('.daily-source').innerText(), '牛客');
    assert.equal(await page.locator('.daily-cf').innerText(), 'CF 难度：待评级');
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷难度：待评级');
    assert.equal(await page.locator('.daily-tags-toggle').count(), 0);
    assert.equal(await page.locator('.daily-tags-unavailable').innerText(), '算法标签：未获取');
    assert.equal(await page.locator('.daily-coverage').isVisible(), false);
    assert.doesNotMatch(await page.locator('.daily-duration').getAttribute('title'), /服务端处理/, 'result without diagnostics still reports actual client elapsed');

    await page.evaluate(() => window.mountDaily('result/failure'));
    await draw.click();
    await page.waitForFunction(() => window.requests.length === 4);
    await page.waitForTimeout(90);
    await page.evaluate(() => window.requests[3].reject(new Error('first draw failure')));
    await page.waitForFunction(() => document.querySelector('.daily-problem-error')?.textContent === 'first draw failure');
    assert.equal(await page.locator('.daily-problem-title').count(), 0);
    assert.equal(await page.locator('.daily-duration').isVisible(), true, 'failure without a result still has actual elapsed');
    assert.match(await page.locator('.daily-duration').innerText(), /本次未完成/);
    assert.ok(Number((await page.locator('.daily-duration').getAttribute('title')).match(/客户端总耗时 ([\d.]+)/)[1]) >= 90);
    await page.evaluate(() => window.mountDaily('result/new-account'));
    assert.equal(await page.locator('.daily-duration').isVisible(), false, 'account context clears previous duration');
    assert.equal(await page.locator('.daily-coverage').isVisible(), false, 'account context clears coverage');
    await draw.click();
    await page.waitForFunction(() => window.requests.length === 5);
    await page.evaluate(() => window.mountDaily('result/another-account'));
    await page.evaluate(async () => { window.requests[4].resolve(window.fixture); await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.equal(await page.locator('.daily-duration').isVisible(), false, 'stale context completion does not restore elapsed or coverage');
    assert.equal(await page.locator('.daily-coverage').isVisible(), false);
    assert.equal(await page.locator('.daily-problem-title').count(), 0);
    await draw.click();
    await page.waitForFunction(() => window.requests.length === 6);
    await page.evaluate(() => window.requests[5].resolve({ problem: { id: 'NC:328351', title: 'qc的纸带', source: 'NC', url: 'https://ac.nowcoder.com/acm/problem/328351', rating: null, clistRating: 377, clistRatingStatus: 'available', estimatedCfRating: 400, estimatedLuoguDifficulty: '入门', luoguDifficulty: '', tags: [] } }));
    await page.waitForFunction(() => document.querySelector('.daily-problem-title')?.textContent === 'qc的纸带');
    assert.equal(await page.locator('.daily-cf').innerText(), 'CF 参考 400');
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷参考：入门');
    assert.equal(await page.locator('.daily-clist').innerText(), 'CLIST 377');
    await draw.click();
    await page.waitForFunction(() => window.requests.length === 7);
    await page.evaluate(() => window.requests[6].resolve({ problem: { id: 'NC:328351', title: '未取得CLIST', source: 'NC', url: 'https://ac.nowcoder.com/acm/problem/328351', rating: null, clistRating: null, clistRatingStatus: 'not-configured', luoguDifficulty: '', tags: [] } }));
    await page.waitForFunction(() => document.querySelector('.daily-clist-status')?.textContent === 'CLIST：未配置');
    assert.match(await page.locator('.daily-clist-status').getAttribute('title'), /不代表.*未评级/);
    assert.equal(await page.locator('.daily-clist-refresh').count(), 0, 'older bridge keeps the existing result layout');

    await page.evaluate(() => {
      window.clistRequests = [];
      window.notebook = {
        refreshProblemClistRating: url => new Promise((resolve, reject) => window.clistRequests.push({ url, resolve, reject })),
        getProblemEnrichment: async () => ({ problem: null })
      };
      window.mountDaily('result/clist-refresh');
    });
    async function drawFixture(problem, resultExtras = {}) {
      const count = await page.evaluate(() => window.requests.length);
      await draw.click();
      await page.waitForFunction(count => window.requests.length === count + 1, count);
      await page.evaluate(({ count, problem, resultExtras }) => window.requests[count].resolve({ ...resultExtras, problem }), { count, problem, resultExtras });
      await page.waitForFunction(() => document.querySelector('.daily-problem-result')?.getAttribute('aria-busy') === 'false');
    }
    const cachedProblem = {
      id: 'NC:328351', title: '缓存题目', source: 'NC', url: 'https://ac.nowcoder.com/acm/problem/328351',
      rating: null, clistRating: 377, clistRatingStatus: 'available', clistRatingCached: true,
      clistRatingStale: true, clistRatingQueriedAt: '2026-11-20T02:00:00.000Z',
      estimatedCfRating: 400, estimatedLuoguDifficulty: '入门', tags: ['secret algorithm']
    };
    await drawFixture(cachedProblem, { note: '保留抽题说明', diagnostics: { durationMs: 9, candidateCount: 2, dataMode: 'index', platforms: {} } });
    assert.equal(await page.locator('.daily-clist').innerText(), 'CLIST 377');
    assert.equal(await page.locator('.daily-clist-cache').innerText(), '缓存·待更新');
    assert.match(await page.locator('.daily-clist').getAttribute('title'), /缓存.*查询时间：2026-11-20T02:00:00.000Z/);
    assert.match(await page.locator('.daily-clist-cache').getAttribute('title'), /2026-11-20T02:00:00.000Z/);
    assert.equal(await page.getByText('2026-11-20T02:00:00.000Z', { exact: true }).count(), 0, 'query timestamp stays in tooltip');
    assert.equal(await page.locator('.daily-enrichment-open').innerText(), '补充缺失信息 / AI 建议');
    await toggle.click();
    const clistRefresh = page.locator('.daily-clist-refresh');
    await clistRefresh.click();
    await page.waitForFunction(() => window.clistRequests.length === 1);
    assert.equal(await clistRefresh.isDisabled(), true);
    assert.equal(await clistRefresh.innerText(), '查询中…');
    assert.equal(await draw.isEnabled(), true, 'refresh disables only its own button');
    assert.equal(await page.locator('.daily-change').isEnabled(), true);
    assert.equal(await page.locator('.daily-enrichment-open').isEnabled(), true);
    assert.equal(await page.locator('.daily-problem-result').getAttribute('aria-busy'), 'false');
    await page.evaluate(() => window.mountDaily('result/clist-refresh'));
    assert.equal(await clistRefresh.isDisabled(), true, 'pending refresh survives same-context remount');
    await page.evaluate(() => document.querySelector('.daily-clist-refresh').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    assert.equal(await page.evaluate(() => window.clistRequests.length), 1, 'programmatic duplicate is guarded');
    assert.equal(await page.evaluate(() => window.clistRequests[0].url), cachedProblem.url, 'refresh calls the force bridge for the exact current URL');
    const refreshedProblem = { ...cachedProblem, clistRating: 1555, estimatedCfRating: 1500, estimatedLuoguDifficulty: '普及+/提高-', clistRatingCached: false, clistRatingStale: false, clistRatingQueriedAt: '2026-11-21T02:00:00.000Z' };
    await page.evaluate(problem => window.clistRequests[0].resolve({ problem, message: '评分已更新' }), refreshedProblem);
    await page.waitForFunction(() => document.querySelector('.daily-clist')?.textContent === 'CLIST 1555');
    assert.equal(await page.locator('.daily-cf').innerText(), 'CF 参考 1500');
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷参考：普及+/提高-');
    assert.equal(await page.locator('.daily-clist-cache').count(), 0);
    assert.match(await page.locator('.daily-clist').getAttribute('title'), /2026-11-21T02:00:00.000Z/);
    assert.equal(await page.locator('.daily-clist-refresh-status').innerText(), '评分已更新');
    assert.equal(await clistRefresh.isEnabled(), true);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'rating refresh preserves deliberate tag reveal');
    await page.locator('.daily-rating-explanation summary').click();
    assert.equal(await page.locator('.daily-problem-note').innerText(), '保留抽题说明');
    assert.match(await page.locator('.daily-coverage').innerText(), /本次候选 2 题/, 'rating refresh preserves draw diagnostics');

    await clistRefresh.click();
    await page.waitForFunction(() => window.clistRequests.length === 2);
    await page.evaluate(() => window.clistRequests[1].reject(new Error('CLIST 请求超时')));
    await page.waitForFunction(() => document.querySelector('.daily-clist-refresh-status')?.textContent.includes('请求超时'));
    assert.equal(await page.locator('.daily-problem-title').innerText(), cachedProblem.title);
    assert.equal(await page.locator('.daily-clist').innerText(), 'CLIST 1555', 'exception retains the known current rating');
    assert.equal(await page.locator('.daily-problem-error').isVisible(), false, 'rating failure does not interrupt drawing');
    assert.equal(await clistRefresh.isEnabled(), true);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');

    await clistRefresh.click();
    await page.waitForFunction(() => window.clistRequests.length === 3);
    const unknownProblem = { ...cachedProblem, clistRating: null, clistRatingStatus: 'not-obtained', clistRatingCached: false, clistRatingStale: false, estimatedCfRating: null, estimatedLuoguDifficulty: null };
    await page.evaluate(problem => window.clistRequests[2].resolve({ problem, message: '暂未获取 CLIST 评分，请稍后重试' }), unknownProblem);
    await page.waitForFunction(() => document.querySelector('.daily-clist-status')?.textContent === 'CLIST：未获取');
    assert.equal(await page.locator('.daily-clist').count(), 0, 'unknown remains unknown instead of displaying a fake rating');
    assert.equal(await page.locator('.daily-cf').innerText(), 'CF 难度：待评级');
    assert.match(await page.locator('.daily-clist-refresh-status').innerText(), /暂未获取/);
    assert.equal(await clistRefresh.isEnabled(), true, 'warning results can be retried');

    await clistRefresh.click();
    await page.waitForFunction(() => window.clistRequests.length === 4);
    const sameUrlNewDraw = { ...cachedProblem, title: '同 URL 的新抽题', clistRating: 888 };
    await drawFixture(sameUrlNewDraw);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await page.evaluate(problem => window.clistRequests[3].resolve({ problem, message: '旧请求不得覆盖' }), refreshedProblem);
    await page.waitForFunction(() => document.querySelector('.daily-clist-refresh')?.disabled === false);
    assert.equal(await page.locator('.daily-problem-title').innerText(), sameUrlNewDraw.title, 'revision blocks stale completion even when URLs match');
    assert.equal(await page.locator('.daily-clist').innerText(), 'CLIST 888');
    assert.equal(await page.locator('.daily-clist-refresh-status').isVisible(), false);

    await clistRefresh.click();
    await page.waitForFunction(() => window.clistRequests.length === 5);
    const nextProblem = { ...cachedProblem, id: 'NC:2', url: 'https://ac.nowcoder.com/acm/problem/2', title: '另一道题', clistRating: 999 };
    await drawFixture(nextProblem);
    await clistRefresh.click();
    await page.waitForFunction(() => window.clistRequests.length === 6);
    await page.evaluate(problem => window.clistRequests[4].resolve({ problem, message: '另一题的旧请求' }), refreshedProblem);
    await page.waitForTimeout(0);
    assert.equal(await page.locator('.daily-problem-title').innerText(), nextProblem.title);
    assert.equal(await clistRefresh.isDisabled(), true, 'old completion cannot clear the new problem pending state');
    await page.evaluate(() => window.clistRequests[5].reject(new Error('当前题查询失败')));
    await page.waitForFunction(() => document.querySelector('.daily-clist-refresh-status')?.textContent.includes('当前题查询失败'));
    assert.equal(await page.locator('.daily-clist').innerText(), 'CLIST 999');

    await clistRefresh.click();
    await page.waitForFunction(() => window.clistRequests.length === 7);
    await page.evaluate(() => window.mountDaily('result/clist-new-account'));
    await drawFixture({ ...cachedProblem, title: '另一个账号的题目', clistRating: 222 });
    await page.evaluate(problem => window.clistRequests[6].resolve({ problem, message: '跨账号旧请求' }), refreshedProblem);
    await page.waitForTimeout(0);
    assert.equal(await page.locator('.daily-problem-title').innerText(), '另一个账号的题目', 'generation blocks completion across account contexts');
    assert.equal(await page.locator('.daily-clist').innerText(), 'CLIST 222');
    assert.equal(await page.locator('.daily-clist-refresh-status').isVisible(), false);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await clistRefresh.click();
    await page.waitForFunction(() => window.clistRequests.length === 8);
    await page.evaluate(problem => window.clistRequests[7].resolve({ problem, message: '' }), refreshedProblem);
    await page.waitForFunction(() => document.querySelector('.daily-clist')?.textContent === 'CLIST 1555');
    assert.equal(await page.locator('.daily-clist-refresh-status').isVisible(), false, 'empty success message needs no extra status copy');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'refresh also preserves hidden algorithm hints');
    assert.equal(await page.getByText('secret algorithm', { exact: true }).count(), 0);
    await drawFixture({ id: 'AT:ARC018_1', title: 'A. BMI', source: 'AT', url: 'https://atcoder.jp/contests/arc018/tasks/arc018_1', rating: null, clistRating: 0, estimatedCfRating: 0, estimatedLuoguDifficulty: '入门', luoguDifficulty: '', tags: [] });
    assert.equal(await page.locator('.daily-clist').count(), 0);
    assert.equal(await page.locator('.daily-clist-status').innerText(), 'CLIST：无数据');
    assert.equal(await page.locator('.daily-cf').innerText(), 'CF 参考：无数据');
    assert.equal(await page.locator('.daily-luogu').innerText(), '洛谷参考：无数据');
    assert.equal(await page.locator('.daily-cf.difficulty-badge,.daily-luogu.difficulty-badge').count(), 0);
    await drawFixture({ ...cachedProblem, clistRating: null, clistRatingCached: false, clistRatingStatus: 'not-found' });
    assert.equal(await page.locator('.daily-clist-status').innerText(), 'CLIST：未收录');
    assert.equal(await page.locator('.daily-difficulty-warning').isVisible(), true);
    assert.match(await page.locator('.daily-difficulty-warning').innerText(), /参考难度与实际难度可能存在很大偏差/);
    for (const source of ['CF', 'LG']) {
      await drawFixture({ ...cachedProblem, source, clistRating: null, clistRatingStatus: 'not-found' });
      assert.equal(await page.locator('.daily-difficulty-warning').count(), 0, `${source} does not show the unlisted difficulty warning`);
      assert.equal(await page.locator('.daily-clist-status').innerText(), 'CLIST：未收录');
    }
    await drawFixture({ ...cachedProblem, clistRating: null, clistRatingStatus: 'not-obtained' });
    assert.equal(await page.locator('.daily-difficulty-warning').count(), 0, 'unqueried is not a known missing CLIST record');
    assert.deepEqual(errors, []);
    console.log('daily result UI passed: hidden hints, redraw/remount, metadata/coverage/duration, CLIST cache and force bridge refresh, warnings/failures, pending deduplication and revision/account isolation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
