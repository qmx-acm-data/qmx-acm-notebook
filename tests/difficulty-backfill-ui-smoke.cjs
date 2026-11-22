'use strict';
// Run after pnpm build:app: node tests/difficulty-backfill-ui-smoke.cjs
// Mock bridge only: no network, no real CLIST credentials, no Electron process.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

const PANEL_JS = appPath('ui/difficulty-backfill-panel.js');
const PANEL_CSS = appPath('ui/difficulty-backfill.css');
const BASE_VARS = ':root{--bg:#f6f7f5;--surface:#fff;--surface-soft:#f8faf8;--text:#26352f;--muted:#8a958e;--line:#e6ebe6;--accent:#3e735b;--accent-soft:#eaf2eb;--tone-gray:#808080;--tone-green:#00a550;--tone-cyan:#008b8b;--tone-blue:#2459cf;--tone-purple:#a020f0;--tone-red:#e13f46;--tone-yellow:#bc9400}';

function idleState() {
  return { status: 'idle', running: false, pauseRequested: false, batchSize: 100, processed: 0, found: 0, skipped: 0, failed: 0, startedAt: null, finishedAt: null, platforms: {} };
}

function panelApi(page) {
  return page.evaluate(() => {
    const api = window.NotebookDifficultyBackfillPanel;
    return Boolean(api && typeof api.mount === 'function');
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    // ---- standalone panel behavior -------------------------------------------------
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.route(/^https?:/, route => route.abort());
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body><section id="host"></section></body></html>');
    await page.addStyleTag({ content: BASE_VARS });
    await page.addStyleTag({ path: PANEL_CSS });
    await page.evaluate(initial => {
      window.calls = [];
      window.toasts = [];
      window.failures = [];
      window.state = initial;
      window.clist = { configured: true, username: 'tester' };
      window.holdStart = false;
      window.releaseStart = null;
      window.nextStartState = null;
      window.makeIdle = () => ({
        status: 'idle', running: false, pauseRequested: false, batchSize: 100, processed: 0, found: 0, skipped: 0, failed: 0,
        startedAt: null, finishedAt: null, platforms: {}
      });
      window.makeRunning = (processed, platforms) => ({
        status: 'running', running: true, pauseRequested: false, batchSize: 100, processed: processed || 0, found: 0, skipped: 0, failed: 0,
        startedAt: '2026-11-21T03:20:00.000Z', finishedAt: null, platforms: platforms || {}
      });
      window.notebook = {
        getDifficultyBackfillStatus: async () => { window.calls.push(['status']); return structuredClone(window.state); },
        getClistStatus: async () => { window.calls.push(['clist']); return structuredClone(window.clist); },
        startDifficultyBackfill: async () => {
          window.calls.push(['start']);
          if (window.holdStart) return new Promise(resolve => {
            window.releaseStart = () => { window.state = window.makeRunning(0, {}); resolve(structuredClone(window.state)); };
          });
          window.state = window.nextStartState || window.makeRunning(0, {});
          window.nextStartState = null;
          return structuredClone(window.state);
        },
        pauseDifficultyBackfill: async () => {
          window.calls.push(['pause']);
          window.state = { ...window.state, status: 'paused', running: false, pauseRequested: false };
          return structuredClone(window.state);
        }
      };
    }, idleState());
    await page.addScriptTag({ path: PANEL_JS });
    assert.equal(await panelApi(page), true, 'panel artifact exposes the standalone mount adapter');
    await page.evaluate(() => {
      window.panel = window.NotebookDifficultyBackfillPanel.mount(document.querySelector('#host'), {
        pollMs: 40,
        onToast: message => window.toasts.push(message),
        onError: error => window.failures.push(String(error))
      });
    });

    const summary = page.locator('#host .difficulty-backfill-summary');
    const history = page.locator('#host .difficulty-backfill-history');
    const legacy = page.locator('#host .difficulty-backfill-legacy');
    const startButton = page.locator('#host [data-action="start"]');
    const pauseButton = page.locator('#host [data-action="pause"]');
    const hint = page.locator('#host .difficulty-backfill-hint');
    const rows = page.locator('#host .difficulty-backfill-row');
    const cfRow = page.locator('#host .difficulty-backfill-row[data-platform="CF"]');

    // Configured idle state: enabled start, disabled pause, no hint, default batch cap.
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.startsWith('空闲'));
    assert.equal(await summary.textContent(), '空闲 · 本批已处理 0 / 100 · 查到 0 · 未收录 0 · 无评分 0 · 请求失败 0');
    assert.equal(await history.textContent(), '历史记录跳过 0 题（已有 CLIST 正分缓存或台账冷却中，不计入本批）');
    assert.equal(await legacy.isHidden(), true, 'empty counters do not need a legacy warning');
    assert.equal(await startButton.isEnabled(), true);
    assert.equal(await pauseButton.isDisabled(), true);
    assert.equal(await hint.isHidden(), true);
    assert.equal(await rows.count(), 0);
    assert.equal(await page.locator('#host h3').innerText(), 'CLIST 评分缓存');
    assert.equal(await startButton.innerText(), '开始缓存');
    assert.match(await page.locator('#host .difficulty-backfill-intro').innerText(), /所有题目按批查询；有效评分写入本机缓存；没有有效CLIST评分则沿用原生或社区难度/);
    assert.match(await page.locator('#host .difficulty-backfill-intro').innerText(), /每批默认 100 题/);
    assert.equal(await page.evaluate(() => window.calls.some(call => call[0] === 'start' || call[0] === 'pause')), false, 'mount never starts a backfill');

    // Start asks the bridge once and renders the running state.
    await page.evaluate(() => { window.calls = []; window.toasts = []; });
    await startButton.click();
    await page.waitForFunction(() => window.calls.filter(call => call[0] === 'start').length === 1);
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.includes('运行中'));
    assert.equal(await startButton.isDisabled(), true, 'start is disabled while the backfill runs');
    assert.equal(await pauseButton.isEnabled(), true, 'pause is available while the backfill runs');
    assert.equal(await page.evaluate(() => window.toasts.some(text => text.includes('CLIST 评分缓存'))), true);

    // Native CF ratings can cover every difficulty while the CLIST cache still has a queue.
    await page.evaluate(() => {
      window.state = {
        ...window.makeRunning(0, {
          CF: { total: 100, clistCached: 90, clistPending: 10, sourceMissing: 0, resolved: 0, missing: 0, attempted: 0, found: 0, notFound: 0, noRating: 0, failed: 0 }
        }),
        notFound: 0, noRating: 0, skipped: 90
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-cache')?.textContent === '待查 CLIST 10 · 已缓存 90 / 总题 100');
    assert.equal(await cfRow.locator('.difficulty-backfill-line .difficulty-backfill-cache').innerText(), '待查 CLIST 10 · 已缓存 90 / 总题 100');
    assert.equal(await cfRow.locator('.difficulty-backfill-gaps .difficulty-backfill-missing').innerText(), '仍无可用难度 0', 'native CF difficulty coverage does not hide the CLIST queue');
    assert.equal(await cfRow.locator('.difficulty-backfill-coverage').innerText(), '原生/社区缺失 0 · 已补 0');
    await page.evaluate(() => {
      Object.assign(window.state, { processed: 1, found: 1 });
      Object.assign(window.state.platforms.CF, { clistCached: 91, clistPending: 9, attempted: 1, found: 1 });
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-cache')?.textContent === '待查 CLIST 9 · 已缓存 91 / 总题 100');
    assert.equal(await cfRow.locator('.difficulty-backfill-missing').innerText(), '仍无可用难度 0', 'a CLIST hit is counted even when native difficulty was already present');
    assert.equal(await cfRow.locator('.difficulty-backfill-coverage').innerText(), '原生/社区缺失 0 · 已补 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-found').innerText(), '查到 1');
    assert.match(await summary.textContent(), /本批已处理 1 \/ 100 · 查到 1 · 未收录 0 · 无评分 0 · 请求失败 0/);
    await page.evaluate(() => {
      Object.assign(window.state, { processed: 2, noRating: 1 });
      Object.assign(window.state.platforms.CF, { attempted: 2, noRating: 1 });
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.includes('2 / 100'));
    assert.equal(await cfRow.locator('.difficulty-backfill-cache').innerText(), '待查 CLIST 9 · 已缓存 91 / 总题 100', 'an invalid CLIST rating does not populate the positive cache or shrink its pending total');
    assert.equal(await cfRow.locator('.difficulty-backfill-missing').innerText(), '仍无可用难度 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-no-rating').innerText(), '无评分 1');
    await page.evaluate(() => {
      Object.assign(window.state, { processed: 3, notFound: 1 });
      Object.assign(window.state.platforms.CF, { attempted: 3, notFound: 1 });
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.includes('3 / 100'));
    assert.equal(await cfRow.locator('.difficulty-backfill-cache').innerText(), '待查 CLIST 9 · 已缓存 91 / 总题 100', 'an unlisted problem remains uncached while ledger cooldown controls retrying');
    assert.equal(await cfRow.locator('.difficulty-backfill-not-found').innerText(), '未收录 1');
    assert.match(await summary.textContent(), /本批已处理 3 \/ 100 · 查到 1 · 未收录 1 · 无评分 1 · 请求失败 0/);
    assert.equal(await history.textContent(), '历史记录跳过 90 题（已有 CLIST 正分缓存或台账冷却中，不计入本批）');
    await page.evaluate(() => {
      Object.assign(window.state, { processed: 0, found: 0, notFound: 0, noRating: 0, skipped: 93 });
      Object.assign(window.state.platforms.CF, { attempted: 0, found: 0, notFound: 0, noRating: 0 });
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-history')?.textContent?.includes('跳过 93 题'));
    assert.equal(await cfRow.locator('.difficulty-backfill-cache').innerText(), '待查 CLIST 9 · 已缓存 91 / 总题 100', 'cooldown skips do not pretend invalid lookups have a cached positive rating');
    assert.equal(await history.textContent(), '历史记录跳过 93 题（已有 CLIST 正分缓存或台账冷却中，不计入本批）');
    assert.match(await summary.textContent(), /本批已处理 0 \/ 100 · 查到 0 · 未收录 0 · 无评分 0 · 请求失败 0/);
    assert.doesNotMatch(await summary.textContent(), /93/);
    assert.equal(await legacy.isHidden(), true);

    // Live remaining gaps decrease only after a usable reference is found.
    await page.evaluate(() => {
      window.state = {
        ...window.makeRunning(0, {
          CF: { sourceMissing: 10, resolved: 0, missing: 10, attempted: 0, found: 0, notFound: 0, noRating: 0, failed: 0 }
        }),
        notFound: 0, noRating: 0, skipped: 113
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-coverage')?.textContent === '原生/社区缺失 10 · 已补 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-missing').innerText(), '仍无可用难度 10');
    assert.match(await summary.textContent(), /本批已处理 0 \/ 100 · 查到 0 · 未收录 0 · 无评分 0 · 请求失败 0/);
    await page.evaluate(() => {
      Object.assign(window.state, { processed: 1, found: 1 });
      Object.assign(window.state.platforms.CF, { missing: 9, resolved: 1, attempted: 1, found: 1 });
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-missing')?.textContent === '仍无可用难度 9');
    assert.equal(await cfRow.locator('.difficulty-backfill-coverage').innerText(), '原生/社区缺失 10 · 已补 1');
    assert.equal(await cfRow.locator('.difficulty-backfill-attempted').innerText(), '本批查询 1：');
    assert.equal(await cfRow.locator('.difficulty-backfill-found').innerText(), '查到 1');
    assert.match(await summary.textContent(), /本批已处理 1 \/ 100 · 查到 1 · 未收录 0 · 无评分 0 · 请求失败 0/);
    assert.equal(await history.textContent(), '历史记录跳过 113 题（已有 CLIST 正分缓存或台账冷却中，不计入本批）');
    assert.equal(await legacy.isHidden(), true);
    await page.evaluate(() => {
      Object.assign(window.state, { processed: 2, noRating: 1 });
      Object.assign(window.state.platforms.CF, { attempted: 2, noRating: 1 });
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.includes('2 / 100'));
    assert.equal(await cfRow.locator('.difficulty-backfill-missing').innerText(), '仍无可用难度 9', 'an unrated lookup leaves the remaining reference gap unchanged');
    assert.equal(await cfRow.locator('.difficulty-backfill-coverage').innerText(), '原生/社区缺失 10 · 已补 1');
    assert.equal(await cfRow.locator('.difficulty-backfill-no-rating').innerText(), '无评分 1');
    assert.match(await summary.textContent(), /本批已处理 2 \/ 100 · 查到 1 · 未收录 0 · 无评分 1 · 请求失败 0/);
    assert.equal(await legacy.isHidden(), true);

    // Current batch outcomes exclude historical ledger skips.
    await page.evaluate(() => {
      window.state = {
        ...window.makeRunning(11, {
          CF: { missing: 12, attempted: 11, found: 2, notFound: 3, noRating: 6, failed: 0 },
          LG: { missing: 40, attempted: 0, found: 0, notFound: 0, noRating: 0, failed: 0 }
        }),
        found: 2, notFound: 3, noRating: 6, skipped: 113, failed: 0
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.includes('11 / 100'));
    assert.match(await summary.textContent(), /^运行中 · 本批已处理 11 \/ 100 · 查到 2 · 未收录 3 · 无评分 6 · 请求失败 0 · 开始于 \d{2}-\d{2} \d{2}:\d{2}$/);
    assert.doesNotMatch(await summary.textContent(), /113|未找到/);
    assert.equal(await history.textContent(), '历史记录跳过 113 题（已有 CLIST 正分缓存或台账冷却中，不计入本批）');
    assert.equal(await legacy.isHidden(), true);
    assert.equal(await rows.count(), 2);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#host .difficulty-backfill-row')].map(row => row.dataset.platform)), ['CF', 'LG']);
    assert.equal(await cfRow.locator('.difficulty-backfill-name').innerText(), 'Codeforces');
    assert.equal(await cfRow.locator('.difficulty-backfill-coverage').count(), 0, 'legacy rows do not invent source-gap or resolved totals');
    assert.equal(await cfRow.locator('.difficulty-backfill-cache').count(), 0, 'legacy rows do not mistake missing difficulty for a CLIST pending total');
    assert.equal(await cfRow.locator('.difficulty-backfill-missing').innerText(), '仍无可用难度 12');
    assert.equal(await cfRow.locator('.difficulty-backfill-attempted').innerText(), '本批查询 11：');
    assert.equal(await cfRow.locator('.difficulty-backfill-found').innerText(), '查到 2');
    assert.equal(await cfRow.locator('.difficulty-backfill-not-found').innerText(), '未收录 3');
    assert.equal(await cfRow.locator('.difficulty-backfill-no-rating').innerText(), '无评分 6');
    assert.equal(await cfRow.locator('.difficulty-backfill-failed').innerText(), '失败 0');
    assert.equal(await page.locator('#host .difficulty-backfill-row[data-platform="LG"] .difficulty-backfill-missing').innerText(), '仍无可用难度 40', 'history skips do not fill the missing-difficulty count');

    // Pause asks the bridge, then the paused state re-enables start.
    await page.evaluate(() => { window.calls = []; window.toasts = []; });
    await pauseButton.click();
    await page.waitForFunction(() => window.calls.filter(call => call[0] === 'pause').length === 1);
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.startsWith('已暂停'));
    assert.equal(await pauseButton.isDisabled(), true);
    assert.equal(await startButton.isEnabled(), true);
    assert.equal(await page.evaluate(() => window.toasts.some(text => text.includes('暂停'))), true);

    // Restarting a paused run displays the new batch returned by the bridge, across all rows.
    await page.evaluate(() => {
      window.calls = [];
      window.nextStartState = {
        ...window.makeRunning(3, {
          CF: { missing: 12, attempted: 0, found: 0, notFound: 0, noRating: 0, failed: 0 },
          LG: { missing: 40, attempted: 3, found: 1, notFound: 1, noRating: 0, failed: 1 }
        }),
        found: 1, notFound: 1, noRating: 0, failed: 1, skipped: 113
      };
    });
    await startButton.click();
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.includes('3 / 100'));
    assert.match(await summary.textContent(), /^运行中 · 本批已处理 3 \/ 100 · 查到 1 · 未收录 1 · 无评分 0 · 请求失败 1/);
    assert.equal(await cfRow.locator('.difficulty-backfill-attempted').innerText(), '本批查询 0：');
    assert.equal(await cfRow.locator('.difficulty-backfill-found').innerText(), '查到 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-not-found').innerText(), '未收录 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-no-rating').innerText(), '无评分 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-failed').innerText(), '失败 0');
    assert.equal(await page.locator('#host .difficulty-backfill-row[data-platform="LG"] .difficulty-backfill-attempted').innerText(), '本批查询 3：');
    assert.equal(await legacy.isHidden(), true);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'start').length), 1);

    // Older persisted totals remain visible with an explicit mismatch warning.
    await page.evaluate(() => {
      window.state = {
        ...window.makeRunning(11, { CF: { missing: 12, attempted: 19, found: 7 } }),
        found: 2, skipped: 113
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-legacy')?.hidden === false);
    assert.equal(await legacy.textContent(), '旧批次统计，重新开始后按本批计数；旧批次未分原因，后续查询开始分类');
    assert.match(await summary.textContent(), /本批已处理 11 \/ 100 · 查到 2 · 未收录 0 · 无评分 0 · 请求失败 0/);
    assert.equal(await cfRow.locator('.difficulty-backfill-attempted').innerText(), '本批查询 19：', 'renderer does not invent consistent historical totals');
    assert.doesNotMatch(await summary.textContent(), /113|未找到/);

    // An older state with consistent totals still discloses missing outcome classification.
    await page.evaluate(() => { window.state.platforms.CF.attempted = 11; });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-legacy')?.textContent === '旧批次未分原因，后续查询开始分类');
    assert.equal(await cfRow.locator('.difficulty-backfill-not-found').innerText(), '未收录 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-no-rating').innerText(), '无评分 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-failed').innerText(), '失败 0');
    await page.evaluate(() => { delete window.state.platforms.CF.missing; });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-missing')?.textContent === '仍无可用难度 0');
    assert.equal(await cfRow.locator('.difficulty-backfill-coverage').count(), 0);
    assert.equal(await cfRow.locator('.difficulty-backfill-cache').count(), 0, 'absent legacy missing never invents CLIST queue or cache progress');
    assert.doesNotMatch(await cfRow.innerText(), /缺难度/);

    // Absent status data is rendered with zero counters and no invented history.
    await page.evaluate(() => { window.state = null; });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent === '空闲 · 本批已处理 0 / 0 · 查到 0 · 未收录 0 · 无评分 0 · 请求失败 0');
    assert.equal(await history.textContent(), '历史记录跳过 0 题（已有 CLIST 正分缓存或台账冷却中，不计入本批）');
    assert.equal(await rows.count(), 0);
    assert.equal(await legacy.isHidden(), true);

    // A pending start blocks duplicate clicks, yet pause stays clickable while it is pending.
    await page.evaluate(() => {
      window.calls = [];
      window.toasts = [];
      window.holdStart = true;
      window.releaseStart = null;
      window.state = window.makeIdle();
    });
    await page.waitForFunction(() => document.querySelector('#host [data-action="start"]')?.disabled === false);
    await startButton.click();
    await page.waitForFunction(() => typeof window.releaseStart === 'function');
    await page.evaluate(() => document.querySelector('#host [data-action="start"]').click());
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'start').length), 1, 'duplicate clicks during a pending start call the bridge once');
    assert.equal(await pauseButton.isEnabled(), true, 'pause can interrupt a start request that is still pending');
    await pauseButton.click();
    await page.waitForFunction(() => window.calls.filter(call => call[0] === 'pause').length === 1);
    await page.evaluate(() => window.releaseStart());
    await page.waitForFunction(() => window.toasts.some(text => text.includes('已开始')));
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'start').length), 1);

    // Unconfigured CLIST: an explicit hint and a disabled start button.
    await page.evaluate(() => {
      window.calls = [];
      window.state = window.makeIdle();
      window.clist = { configured: false, username: null };
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-hint')?.hidden === false);
    assert.equal(await hint.innerText(), '需先在账户设置配置 CLIST 用户名与 API Key');
    assert.equal(await startButton.isDisabled(), true, 'start stays disabled without CLIST credentials');
    await page.evaluate(() => document.querySelector('#host [data-action="start"]').click());
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'start').length), 0, 'unconfigured CLIST never starts a backfill');

    // Configuring CLIST later re-enables the start button on the next poll.
    await page.evaluate(() => { window.clist = { configured: true, username: 'tester' }; });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-hint')?.hidden === true);
    assert.equal(await startButton.isEnabled(), true);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'clist').length > 1), true, 'visible panel polls the CLIST status');

    // Failed state and bridge text stay text-only, including an unknown platform key.
    await page.evaluate(() => {
      window.state = {
        status: 'failed', running: false, pauseRequested: false, batchSize: 100, processed: 100, found: 30, notFound: 40, noRating: 20, skipped: 60, failed: 10,
        startedAt: '2026-11-21T03:20:00.000Z', finishedAt: '2026-11-21T03:24:00.000Z',
        platforms: { '<img src=x onerror="window.__key=1">': { missing: 5, attempted: 100, found: 30, notFound: 40, noRating: 20, failed: 10 } },
        message: '<img onerror="window.__msg=1"> 网络错误'
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.includes('网络错误'));
    assert.match(await summary.textContent(), /^失败 · 本批已处理 100 \/ 100 · 查到 30 · 未收录 40 · 无评分 20 · 请求失败 10 · 开始于 \d{2}-\d{2} \d{2}:\d{2} · 结束于 \d{2}-\d{2} \d{2}:\d{2} · <img onerror="window\.__msg=1"> 网络错误$/);
    assert.equal(await page.locator('#host .difficulty-backfill-row').count(), 1);
    assert.match(await page.locator('#host .difficulty-backfill-row').first().innerText(), /<img src=x onerror="window\.__key=1">/);
    assert.equal(await page.locator('#host img').count(), 0, 'bridge text is rendered as text, never as markup');
    assert.equal(await page.evaluate(() => window.__key), undefined);
    assert.equal(await page.evaluate(() => window.__msg), undefined);

    // 390px keeps the panel inside the viewport with a single-column action list.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.evaluate(() => {
      window.state = {
        ...window.makeRunning(50, {
          CF: { total: 100, clistCached: 91, clistPending: 9, sourceMissing: 15, resolved: 3, missing: 12, attempted: 20, found: 3, notFound: 10, noRating: 5, failed: 2 },
          LG: { total: 10000, clistCached: 9500, clistPending: 500, sourceMissing: 46, resolved: 6, missing: 40, attempted: 30, found: 6, notFound: 10, noRating: 8, failed: 6 }
        }),
        found: 9, notFound: 20, noRating: 13, failed: 8, skipped: 113
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-summary')?.textContent?.includes('运行中'));
    await page.waitForFunction(() => document.querySelector('#host .difficulty-backfill-row[data-platform="LG"] .difficulty-backfill-cache')?.textContent === '待查 CLIST 500 · 已缓存 9,500 / 总题 10,000');
    const narrow = await page.evaluate(() => {
      const section = document.querySelector('#host');
      const buttons = [...section.querySelectorAll('.difficulty-backfill-actions .button')].map(button => {
        const box = button.getBoundingClientRect();
        return { width: box.width, top: box.top, overflow: button.scrollWidth > button.clientWidth + 1 };
      });
      return {
        sectionOverflow: section.scrollWidth - section.clientWidth,
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
        buttons,
        backdrop: getComputedStyle(section).backdropFilter
      };
    });
    assert.ok(narrow.sectionOverflow <= 1, `panel must not overflow horizontally: ${narrow.sectionOverflow}`);
    assert.ok(narrow.documentOverflow <= 1, `page must not overflow horizontally: ${narrow.documentOverflow}`);
    assert.equal(narrow.buttons.length, 2);
    assert.equal(narrow.buttons.every(button => button.width > 0 && button.overflow === false), true);
    assert.ok(narrow.buttons[1].top > narrow.buttons[0].top, 'actions stack into one column on narrow screens');
    assert.equal(narrow.backdrop, 'none');
    assert.deepEqual(pageErrors, []);

    // ---- polling only talks to the bridge while an open dialog shows the panel ----
    const dialogPage = await browser.newPage({ viewport: { width: 900, height: 800 } });
    dialogPage.setDefaultTimeout(8000);
    await dialogPage.setContent('<!doctype html><html><body><dialog id="host-dialog"><section id="host"></section></dialog></body></html>');
    await dialogPage.addStyleTag({ path: PANEL_CSS });
    await dialogPage.evaluate(initial => {
      window.dialogCalls = [];
      window.dialogState = initial;
      window.notebook = {
        getDifficultyBackfillStatus: async () => { window.dialogCalls.push('status'); return structuredClone(window.dialogState); },
        getClistStatus: async () => { window.dialogCalls.push('clist'); return { configured: true, username: 'tester' }; },
        startDifficultyBackfill: async () => structuredClone(window.dialogState),
        pauseDifficultyBackfill: async () => structuredClone(window.dialogState)
      };
    }, idleState());
    await dialogPage.addScriptTag({ path: PANEL_JS });
    await dialogPage.evaluate(() => {
      const dialog = document.querySelector('#host-dialog');
      dialog.showModal();
      window.panel = window.NotebookDifficultyBackfillPanel.mount(document.querySelector('#host'), { pollMs: 40 });
    });
    await dialogPage.waitForFunction(() => window.dialogCalls.length > 0);
    await dialogPage.evaluate(() => document.querySelector('#host-dialog').close());
    const closedPollCalls = await dialogPage.evaluate(() => window.dialogCalls.length);
    await dialogPage.waitForTimeout(400);
    assert.equal(await dialogPage.evaluate(() => window.dialogCalls.length), closedPollCalls, 'closed dialog stops bridge polling');
    await dialogPage.evaluate(() => document.querySelector('#host-dialog').showModal());
    await dialogPage.waitForFunction(count => window.dialogCalls.length > count, closedPollCalls);
    await dialogPage.evaluate(() => window.panel.stop());
    const stoppedCalls = await dialogPage.evaluate(() => window.dialogCalls.length);
    await dialogPage.waitForTimeout(250);
    assert.equal(await dialogPage.evaluate(() => window.dialogCalls.length), stoppedCalls, 'stop() cancels the poll interval');
    await dialogPage.evaluate(() => window.panel.start());
    await dialogPage.waitForFunction(count => window.dialogCalls.length > count, stoppedCalls);
    await dialogPage.evaluate(() => { window.panel.destroy(); document.querySelector('#host-dialog').close(); });
    assert.equal(await dialogPage.evaluate(() => document.querySelector('#host').children.length), 0, 'destroy() empties the mounted section');

    // ---- no bridge / incomplete bridge: the section hides itself -------------------
    const noBridgePage = await browser.newPage({ viewport: { width: 800, height: 700 } });
    noBridgePage.setDefaultTimeout(8000);
    await noBridgePage.setContent('<!doctype html><html><body><section id="host"></section><section id="partial"></section></body></html>');
    await noBridgePage.addStyleTag({ path: PANEL_CSS });
    await noBridgePage.addScriptTag({ path: PANEL_JS });
    const noBridge = await noBridgePage.evaluate(() => {
      const host = document.querySelector('#host');
      window.NotebookDifficultyBackfillPanel.mount(host);
      const partial = document.querySelector('#partial');
      window.notebook = { getDifficultyBackfillStatus: async () => ({}) };
      window.NotebookDifficultyBackfillPanel.mount(partial);
      return { hidden: host.hidden, partialHidden: partial.hidden, text: host.textContent, partialText: partial.textContent };
    });
    assert.equal(noBridge.hidden, true, 'no bridge hides the whole block');
    assert.equal(noBridge.partialHidden, true, 'a bridge missing the backfill methods hides the block too');
    assert.equal(noBridge.text, '');
    assert.equal(noBridge.partialText, '');

    // ---- app integration: placement, polling gate, hidden without a bridge --------
    const appPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    appPage.setDefaultTimeout(10000);
    const appErrors = [];
    appPage.on('pageerror', error => appErrors.push(error.message));
    await appPage.route(/^https?:/, route => route.abort());
    await appPage.addInitScript(initial => {
      window.backfillFixture = { state: initial, clist: { configured: true, username: 'tester' }, calls: [] };
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], account: null, authStatus: { status: 'anonymous' }, permissions: { push: false, admin: false }, settings: { autoSync: false }, local: { records: [], favorites: [], mastery: {}, draft: {} } }),
        getClistStatus: async () => { window.backfillFixture.calls.push('clist'); return structuredClone(window.backfillFixture.clist); },
        getDifficultyBackfillStatus: async () => { window.backfillFixture.calls.push('status'); return structuredClone(window.backfillFixture.state); },
        startDifficultyBackfill: async () => { window.backfillFixture.calls.push('start'); return structuredClone(window.backfillFixture.state); },
        pauseDifficultyBackfill: async () => { window.backfillFixture.calls.push('pause'); return structuredClone(window.backfillFixture.state); }
      };
    }, idleState());
    await appPage.goto(pathToFileURL(appPath('ui/index.html')).href);
    await appPage.locator('.sidebar').hover();
    await appPage.locator('#settings-button').click();
    await appPage.waitForSelector('#settings-dialog[open]');
    await appPage.waitForFunction(() => document.querySelector('#difficulty-backfill-panel .difficulty-backfill-summary')?.textContent?.includes('空闲'));
    const placement = await appPage.evaluate(() => {
      const dialog = document.querySelector('#settings-dialog');
      const panel = document.querySelector('#difficulty-backfill-panel');
      const library = document.querySelector('#library-sync-panel');
      const form = dialog.querySelector('#settings-form');
      return {
        parentIsDialog: panel.parentElement === dialog,
        afterLibrary: Boolean(library.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING),
        beforeForm: Boolean(panel.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING),
        visible: !panel.hidden
      };
    });
    assert.deepEqual(placement, { parentIsDialog: true, afterLibrary: true, beforeForm: true, visible: true });
    assert.equal(await appPage.locator('#difficulty-backfill-panel [data-action="start"]').isEnabled(), true);
    assert.equal(await appPage.locator('#difficulty-backfill-panel .difficulty-backfill-hint').isHidden(), true);

    // Polling pauses while the dialog is closed, then resumes when it is reopened.
    await appPage.evaluate(() => { document.querySelector('[data-close="settings-dialog"]').click(); });
    await appPage.waitForSelector('#settings-dialog', { state: 'hidden' });
    const closedCalls = await appPage.evaluate(() => window.backfillFixture.calls.length);
    await appPage.waitForTimeout(1100);
    assert.equal(await appPage.evaluate(() => window.backfillFixture.calls.length), closedCalls, 'closed settings dialog stops polling the bridge');
    await appPage.evaluate(() => {
      window.backfillFixture.state = {
        status: 'running', running: true, pauseRequested: false, batchSize: 100, processed: 42, found: 8, skipped: 30, failed: 4,
        startedAt: '2026-11-21T03:20:00.000Z', finishedAt: null,
        platforms: { CF: { missing: 12, attempted: 5, found: 3 } }
      };
    });
    await appPage.locator('.sidebar').hover();
    await appPage.locator('#settings-button').click();
    await appPage.waitForFunction(() => document.querySelector('#difficulty-backfill-panel .difficulty-backfill-summary')?.textContent?.includes('运行中'));
    assert.match(await appPage.locator('#difficulty-backfill-panel .difficulty-backfill-summary').textContent(), /本批已处理 42 \/ 100/);
    assert.equal(await appPage.locator('#difficulty-backfill-panel .difficulty-backfill-row[data-platform="CF"]').count(), 1);
    assert.equal(await appPage.evaluate(count => window.backfillFixture.calls.length > count, closedCalls), true, 'reopened panel resumes polling');
    assert.deepEqual(appErrors, []);

    // No bridge (browser preview): the panel exists but stays hidden and empty.
    const demoPage = await browser.newPage({ viewport: { width: 1440, height: 940 } });
    demoPage.setDefaultTimeout(10000);
    const demoErrors = [];
    demoPage.on('pageerror', error => demoErrors.push(error.message));
    await demoPage.route(/^https?:/, route => route.abort());
    await demoPage.goto(pathToFileURL(appPath('ui/index.html')).href);
    await demoPage.waitForSelector('#difficulty-backfill-panel', { state: 'attached' });
    assert.equal(await demoPage.locator('#difficulty-backfill-panel').isHidden(), true, 'browser preview keeps the whole block hidden');
    assert.equal(await demoPage.locator('#difficulty-backfill-panel').textContent(), '');
    assert.deepEqual(demoErrors, []);

    // Older preload without the backfill methods: the panel is hidden, not broken.
    const oldBridgePage = await browser.newPage({ viewport: { width: 1440, height: 940 } });
    oldBridgePage.setDefaultTimeout(10000);
    const oldBridgeErrors = [];
    oldBridgePage.on('pageerror', error => oldBridgeErrors.push(error.message));
    await oldBridgePage.route(/^https?:/, route => route.abort());
    await oldBridgePage.addInitScript(() => {
      window.notebook = { bootstrap: async () => ({ records: [], issues: [], account: null, authStatus: { status: 'anonymous' }, permissions: { push: false, admin: false }, settings: { autoSync: false }, local: { records: [], favorites: [], mastery: {}, draft: {} } }), getClistStatus: async () => ({ configured: true, username: 'tester' }) };
    });
    await oldBridgePage.goto(pathToFileURL(appPath('ui/index.html')).href);
    await oldBridgePage.waitForSelector('#settings-dialog', { state: 'attached' });
    await oldBridgePage.waitForSelector('#difficulty-backfill-panel', { state: 'attached' });
    assert.equal(await oldBridgePage.locator('#difficulty-backfill-panel').isHidden(), true, 'a preload without backfill methods keeps the block hidden');
    assert.equal(await oldBridgePage.locator('#difficulty-backfill-panel').textContent(), '');
    assert.deepEqual(oldBridgeErrors, []);

    console.log('difficulty backfill panel UI smoke passed (mock bridge only; no network)');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
