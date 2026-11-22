'use strict';
// Parent builds first. Mock IPC only; no real CLIST requests or credentials.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');
const PANEL_JS = appPath('ui/clist-bulk-panel.js');
const PANEL_CSS = appPath('ui/clist-bulk.css');
const HOSTS = ['codeforces.com', 'atcoder.jp', 'leetcode.com', 'luogu.com.cn', 'ac.nowcoder.com', 'loj.ac'];
function initialState() {
  return { schema: 1, status: 'idle', running: false, pauseRequested: false, startedAt: null, finishedAt: null,
    resources: Object.fromEntries(HOSTS.map(host => [host, { offset: 0, total: null, pages: 0, imported: 0, ignored: 0, status: 'idle' }])) };
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    page.setDefaultTimeout(8000);
    const errors = [], network = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
    await page.setContent('<!doctype html><html><body><dialog id="settings"><section id="host"></section><button id="close">关闭</button></dialog></body></html>');
    await page.addStyleTag({ content: ':root{--surface:#fff;--surface-soft:#f8faf8;--text:#26352f;--muted:#8a958e;--line:#e6ebe6;--accent:#3e735b;--tone-red:#e13f46}*{box-sizing:border-box}dialog{width:min(850px,calc(100% - 32px));max-height:90vh;overflow:auto}' });
    await page.addStyleTag({ path: PANEL_CSS });
    await page.evaluate(initial => {
      window.state = initial; window.calls = []; window.toasts = []; window.failures = [];
      window.configured = false; window.holdStart = false; window.failAction = false; window.failRead = false;
      window.notebook = {
        getClistBulkStatus: async (...args) => { window.calls.push(['status', args]); if (window.failRead) throw new Error('状态连接失败'); return structuredClone(window.state); },
        getClistStatus: async (...args) => { window.calls.push(['credentials', args]); return { configured: window.configured, username: null }; },
        getClistSharedCacheStatus: async () => { window.calls.push(['baseline']); return { initialTotal: window.initialTotal }; },
        startClistBulkSync: async (...args) => {
          window.calls.push(['start', args]);
          if (window.failAction) throw new Error('更新失败，个人缓存保留');
          window.state.status = 'running'; window.state.running = true; window.state.pauseRequested = false;
          if (window.holdStart) { const snapshot = structuredClone(window.state); return new Promise(resolve => { window.releaseStart = () => resolve(snapshot); }); }
          return structuredClone(window.state);
        },
        pauseClistBulkSync: async (...args) => { window.calls.push(['pause', args]); window.state.status = 'paused'; window.state.running = false; window.state.pauseRequested = false; return structuredClone(window.state); }
      };
      document.querySelector('#close').onclick = () => document.querySelector('#settings').close();
    }, initialState());
    await page.addScriptTag({ path: PANEL_JS });
    await page.evaluate(() => {
      if (typeof window.NotebookClistBulkPanel?.mount !== 'function') throw new Error('missing standalone mount');
      window.panel = window.NotebookClistBulkPanel.mount(document.querySelector('#host'), { pollMs: 40,
        onToast: text => window.toasts.push(text), onError: error => window.failures.push(String(error)) });
    });
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.calls.length), 0, 'closed dialog never reads status');
    await page.evaluate(() => document.querySelector('#settings').showModal());
    const summary = page.locator('#host .clist-bulk-summary');
    const start = page.locator('#host [data-action="start"]');
    const pause = page.locator('#host [data-action="pause"]');
    const error = page.locator('#host .clist-bulk-error');
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-summary')?.textContent?.includes('等待更新'));
    assert.equal(await page.locator('#host h3').innerText(), 'CLIST 批量缓存');
    assert.equal(await start.innerText(), '批量刷新评分');
    assert.match(await page.locator('#host .clist-bulk-intro').innerText(), /每次请求 1 页.*最多 1000 条.*10 次\/分钟/);
    assert.equal(await page.locator('#host .clist-bulk-baseline').innerText(), '先使用内置基线，再分页更新。');
    assert.match(await page.locator('#host .clist-bulk-hint').innerText(), /使用初始缓存不需要 Key.*更新评分.*个人 CLIST/);
    assert.equal(await start.isDisabled(), true);
    assert.equal(await pause.isDisabled(), true);
    assert.equal(await page.locator('#host input').count(), 0, 'no duplicate credentials fields');
    assert.deepEqual(await page.locator('#host .clist-bulk-row').evaluateAll(rows => rows.map(row => row.dataset.platform)), ['CF', 'AT', 'LC', 'LG', 'NC', 'LOJ']);
    await page.evaluate(() => document.querySelector('#host [data-action="start"]').dispatchEvent(new Event('click')));
    assert.equal(await page.evaluate(() => window.calls.filter(row => row[0] === 'start').length), 0);
    await page.evaluate(() => { window.initialTotal = 37200; window.configured = true; });
    await page.waitForFunction(() => !document.querySelector('#host [data-action="start"]').disabled);
    assert.match(await page.locator('#host .clist-bulk-baseline').innerText(), /内置基线 37,200 条（不等于本地题库匹配 37,200 条）/);
    assert.equal(await page.locator('#host .clist-bulk-hint').isHidden(), true);

    // A pending start accepts pause immediately, and its late response cannot undo pause.
    await page.evaluate(() => { window.calls = []; window.holdStart = true; });
    await start.click();
    await page.waitForFunction(() => typeof window.releaseStart === 'function');
    assert.equal(await pause.isEnabled(), true);
    await page.evaluate(() => document.querySelector('#host [data-action="start"]').dispatchEvent(new Event('click')));
    assert.equal(await page.evaluate(() => window.calls.filter(row => row[0] === 'start').length), 1);
    await pause.click();
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-summary')?.textContent?.startsWith('已暂停'));
    await page.evaluate(() => { window.releaseStart(); window.holdStart = false; });
    await page.waitForFunction(() => !document.querySelector('#host [data-action="start"]').disabled);
    assert.match(await summary.innerText(), /^已暂停/);
    assert.equal(await start.innerText(), '继续批量刷新评分');
    assert.equal(await pause.isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => window.calls.filter(row => ['start', 'pause'].includes(row[0])).map(row => row[1])), [[], []]);

    // Main reports two API pages covering 1,390 ratings even if the local library has 600 items.
    await start.click();
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-summary')?.textContent?.startsWith('运行中'));
    await page.evaluate(() => {
      for (const row of Object.values(window.state.resources)) Object.assign(row, { status: 'done', total: 0 });
      Object.assign(window.state.resources['codeforces.com'], { total: 1390, offset: 1000, pages: 1, imported: 980, ignored: 20, status: 'running' });
      window.apiPages = 1; window.localLibraryCount = 600;
    });
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-summary')?.textContent?.includes('记录 1,000 / 1,390'));
    assert.match(await summary.innerText(), /已请求 1 页 \/ 总页 2.*已合并 980.*忽略 20/);
    assert.match(await page.locator('#host [data-platform="CF"] .clist-bulk-counts').innerText(), /总记录 1,390 · 游标 1,000 · 页数 1 · 合并 980 · 忽略 20/);
    await page.evaluate(() => {
      Object.assign(window.state.resources['codeforces.com'], { offset: 1390, pages: 2, imported: 1360, ignored: 30, status: 'done' });
      Object.assign(window.state, { status: 'done', running: false }); window.apiPages = 2;
    });
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-summary')?.textContent?.startsWith('已完成'));
    assert.match(await summary.innerText(), /已请求 2 页 \/ 总页 2 · 记录 1,390 \/ 1,390 · 已合并 1,360 · 忽略 30/);
    assert.equal(await page.locator('#host .clist-bulk-result').innerText(), '评分已合并到本机缓存，单题刷新保留');
    assert.equal(await page.evaluate(() => window.toasts.includes('评分已合并到本机缓存，单题刷新保留')), true);
    assert.equal(await page.evaluate(() => window.apiPages), 2);
    assert.equal(await page.evaluate(() => window.calls.filter(row => row[0] === 'start').length), 2, 'UI calls start once per user action, never per local item');
    assert.equal(await page.locator('#host [data-platform="AT"] .clist-bulk-resource-status').innerText(), 'CLIST 暂无有效分');

    // Empty successful responses describe no effective ratings, rather than fake progress.
    await page.evaluate(() => { for (const row of Object.values(window.state.resources)) Object.assign(row, { total: 0, offset: 0, pages: 0, imported: 0, ignored: 0, status: 'done' }); });
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-summary')?.textContent?.includes('CLIST 暂无有效分'));
    assert.equal(await page.locator('#host .clist-bulk-result').innerText(), 'CLIST 暂无有效分');
    assert.doesNotMatch(await summary.innerText(), /本批已处理/);

    // Negative or broken status never replaces the last good counters.
    await page.evaluate(() => { window.good = structuredClone(window.state); window.state.resources['codeforces.com'].offset = -1; });
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-error')?.textContent?.includes('状态无效'));
    assert.match(await summary.innerText(), /CLIST 暂无有效分/);
    await page.evaluate(() => { window.state = structuredClone(window.good); window.state.status = 'failed'; window.failAction = true; });
    await page.waitForFunction(() => document.querySelector('#host [data-action="start"]').textContent === '继续批量刷新评分');
    await start.click();
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-error')?.textContent === '更新失败，个人缓存保留');
    await page.waitForTimeout(100);
    assert.equal(await error.innerText(), '更新失败，个人缓存保留', 'polling preserves action failure');
    assert.equal(await start.isEnabled(), true);
    assert.equal(await page.evaluate(() => window.failures.length), 1);
    await page.evaluate(() => { window.failAction = false; window.state.message = '<img src=x onerror="window.injected=1">'; window.state.apiKey = 'extra-secret-never-render'; window.panel.destroy(); window.panel = window.NotebookClistBulkPanel.mount(document.querySelector('#host'), { pollMs: 40 }); });
    await page.waitForFunction(() => document.querySelector('#host .clist-bulk-result')?.textContent?.includes('<img'));
    assert.equal(await page.locator('#host img, #host script').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.equal((await page.locator('#host').innerText()).includes('extra-secret-never-render'), false);
    await page.setViewportSize({ width: 390, height: 850 });
    const narrow = await page.evaluate(() => {
      const host = document.querySelector('#host'); const buttons = [...host.querySelectorAll('button')].map(button => button.getBoundingClientRect());
      return { host: host.scrollWidth - host.clientWidth, doc: document.documentElement.scrollWidth - innerWidth,
        children: [...host.querySelectorAll('li,button')].map(node => node.scrollWidth - node.clientWidth), stacked: buttons[1].top > buttons[0].top, backdrop: getComputedStyle(host).backdropFilter };
    });
    assert.ok(narrow.host <= 1 && narrow.doc <= 1 && narrow.children.every(value => value <= 1), JSON.stringify(narrow));
    assert.equal(narrow.stacked, true); assert.equal(narrow.backdrop, 'none');
    await page.locator('#close').click();
    const closed = await page.evaluate(() => window.calls.length); await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => window.calls.length), closed);
    await page.evaluate(() => document.querySelector('#settings').showModal());
    await page.waitForFunction(previous => window.calls.length > previous, closed);
    await page.evaluate(() => window.panel.stop());
    const stopped = await page.evaluate(() => window.calls.length); await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.calls.length), stopped);
    await page.evaluate(() => window.panel.start()); await page.waitForFunction(previous => window.calls.length > previous, stopped);
    await page.evaluate(() => window.panel.destroy()); assert.equal(await page.locator('#host > *').count(), 0);
    assert.deepEqual(network, [], 'renderer does not contact CLIST'); assert.deepEqual(errors, []);

    const missing = await browser.newPage(); await missing.setContent('<section id="none"></section><section id="partial"></section>');
    await missing.addScriptTag({ path: PANEL_JS });
    assert.deepEqual(await missing.evaluate(() => {
      window.NotebookClistBulkPanel.mount(document.querySelector('#none'));
      window.notebook = { getClistBulkStatus: async () => ({}) };
      window.NotebookClistBulkPanel.mount(document.querySelector('#partial'));
      return [...document.querySelectorAll('section')].map(node => ({ hidden: node.hidden, text: node.textContent }));
    }), [{ hidden: true, text: '' }, { hidden: true, text: '' }]);

    // Real settings entry: new and legacy methods coexist, but only bulk mounts.
    const app = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    app.setDefaultTimeout(10000); const appErrors = []; app.on('pageerror', error => appErrors.push(error.message));
    await app.route(/^https?:/, route => route.abort());
    await app.addInitScript(initial => {
      window.fixture = { state: initial, calls: [] };
      const shared = { total: 37200, initialTotal: 37200, initialAppliedAt: '2026-11-22T01:00:00.000Z', platforms: {}, oldestQuery: null, newestQuery: null, sourceUrl: null, lastSyncedAt: null };
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], account: null, authStatus: { status: 'anonymous' }, permissions: { push: false, admin: false }, settings: { autoSync: false }, local: { records: [], favorites: [], mastery: {}, draft: {} } }),
        getLibrarySyncStatus: async () => ({ running: false, platforms: {}, totalCount: 0 }), updateLibrary: async () => ({}),
        getClistStatus: async () => ({ configured: false, username: null }),
        getClistSharedCacheStatus: async () => structuredClone(shared),
        exportClistSharedCache: async () => ({ canceled: true, status: structuredClone(shared) }),
        importClistSharedCache: async () => ({ canceled: true, imported: 0, updated: 0, kept: 0, ignored: 0, status: structuredClone(shared) }),
        syncClistSharedCache: async () => ({ canceled: true, imported: 0, updated: 0, kept: 0, ignored: 0, status: structuredClone(shared) }),
        getClistBulkStatus: async () => { window.fixture.calls.push('bulk'); return structuredClone(window.fixture.state); },
        startClistBulkSync: async () => { window.fixture.calls.push('start'); return structuredClone(window.fixture.state); },
        pauseClistBulkSync: async () => { window.fixture.calls.push('pause'); return structuredClone(window.fixture.state); },
        getDifficultyBackfillStatus: async () => { throw new Error('legacy flow must not mount'); },
        startDifficultyBackfill: async () => { throw new Error('legacy start must not run'); },
        pauseDifficultyBackfill: async () => { throw new Error('legacy pause must not run'); }
      };
    }, initialState());
    await app.goto(pathToFileURL(appPath('ui/index.html')).href);
    await app.waitForSelector('#clist-bulk-panel', { state: 'attached' });
    assert.equal(await app.locator('#difficulty-backfill-panel').count(), 0);
    assert.equal(await app.evaluate(() => window.fixture.calls.length), 0);
    await app.locator('.sidebar').hover(); await app.locator('#settings-button').click();
    await app.waitForFunction(() => document.querySelector('#clist-bulk-panel .clist-bulk-summary')?.textContent?.includes('等待更新'));
    assert.deepEqual(await app.evaluate(() => {
      const dialog = document.querySelector('#settings-dialog'), bulk = document.querySelector('#clist-bulk-panel'), shared = document.querySelector('#clist-shared-cache-panel');
      return { parent: bulk.parentElement === dialog, libraryThenShared: document.querySelector('#library-sync-panel').nextElementSibling === shared,
        sharedThenBulk: shared.nextElementSibling === bulk, bulkThenForm: bulk.nextElementSibling === document.querySelector('#settings-form') };
    }), { parent: true, libraryThenShared: true, sharedThenBulk: true, bulkThenForm: true });
    assert.equal(await app.locator('#clist-bulk-panel [data-action="start"]').isDisabled(), true);
    assert.equal(await app.locator('#clist-shared-cache-panel [data-action="import"]').isEnabled(), true);
    assert.match(await app.locator('#clist-bulk-panel .clist-bulk-baseline').innerText(), /37,200.*不等于本地题库匹配/);
    await app.evaluate(() => document.querySelector('[data-close="settings-dialog"]').click());
    const appClosed = await app.evaluate(() => window.fixture.calls.length); await app.waitForTimeout(1000);
    assert.equal(await app.evaluate(() => window.fixture.calls.length), appClosed);
    await app.locator('.sidebar').hover(); await app.locator('#settings-button').click();
    await app.waitForFunction(previous => window.fixture.calls.length > previous, appClosed);
    assert.deepEqual(appErrors, []);
    console.log('CLIST bulk panel UI smoke passed (mock bridge; two rated pages, no CLIST network)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
