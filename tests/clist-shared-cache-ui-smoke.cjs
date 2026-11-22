'use strict';
// Run after the parent builds the app. Mock bridge only; no keys or network.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');
const PANEL_JS = appPath('ui/clist-shared-cache-panel.js');
const PANEL_CSS = appPath('ui/clist-shared-cache.css');
const PLATFORMS = ['CF', 'AT', 'LG', 'NC', 'LC', 'LOJ'];
const BASE_CSS = ':root{--surface:#fff;--surface-soft:#f8faf8;--text:#26352f;--muted:#8a958e;--line:#e6ebe6;--accent:#3e735b;--tone-red:#e13f46}*{box-sizing:border-box}dialog{width:min(850px,calc(100% - 32px));max-height:90vh;overflow:auto}';
function initialStatus() {
  return { total: 600, platforms: Object.fromEntries(PLATFORMS.map(key => [key, 100])),
    oldestQuery: '2026-11-20T01:00:00.000Z', newestQuery: '2026-11-21T12:20:00+08:00',
    sourceUrl: 'https://cache.example.test/ratings.json', lastSyncedAt: '2026-11-21T03:20:00.000Z' };
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    const network = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
    await page.setContent('<!doctype html><html><body><dialog id="settings"><section id="host"></section><button id="close" type="button">关闭</button></dialog></body></html>');
    await page.addStyleTag({ content: BASE_CSS });
    await page.addStyleTag({ path: PANEL_CSS });
    await page.evaluate(initial => {
      window.state = initial; window.calls = []; window.toasts = []; window.failures = []; window.confirmations = [];
      window.cancel = true; window.failRead = false; window.failAction = false; window.hold = false;
      window.confirm = message => { window.confirmations.push(message); return false; };
      const finish = kind => {
        const result = { canceled: window.cancel, status: structuredClone(window.state) };
        return kind === 'export' ? result : { ...result, imported: window.badResult ? -1 : 2, updated: 3, kept: 595, ignored: 4 };
      };
      const action = async (kind, args) => {
        window.calls.push([kind, args]);
        if (window.failAction) throw new Error('合并失败，个人缓存保留');
        if (kind === 'sync' && !window.cancel) window.state.sourceUrl = new URL(args[0]).href;
        if (window.hold) return new Promise(resolve => { window.release = () => resolve(finish(kind)); });
        return finish(kind);
      };
      window.notebook = {
        getClistStatus: async () => { throw new Error('sharing must not request a key'); },
        getClistSharedCacheStatus: async () => {
          window.calls.push(['status']); if (window.failRead) throw new Error('状态连接失败'); return structuredClone(window.state);
        },
        exportClistSharedCache: async (...args) => action('export', args),
        importClistSharedCache: async (...args) => action('import', args),
        syncClistSharedCache: async (...args) => action('sync', args)
      };
      document.querySelector('#close').onclick = () => document.querySelector('#settings').close();
    }, initialStatus());
    await page.addScriptTag({ path: PANEL_JS });
    await page.evaluate(() => {
      if (typeof window.NotebookClistSharedCachePanel?.mount !== 'function') throw new Error('missing standalone mount adapter');
      window.panel = window.NotebookClistSharedCachePanel.mount(document.querySelector('#host'), {
        pollMs: 40, onToast: text => window.toasts.push(text), onError: error => window.failures.push(String(error))
      });
    });
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.calls.length), 0, 'closed settings does not poll');
    await page.evaluate(() => document.querySelector('#settings').showModal());
    const summary = page.locator('#host .clist-shared-cache-summary');
    const error = page.locator('#host .clist-shared-cache-error');
    const url = page.locator('#host .clist-shared-cache-url');
    const exportButton = page.locator('#host [data-action="export"]');
    const importButton = page.locator('#host [data-action="import"]');
    const syncButton = page.locator('#host [data-action="sync"]');
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-summary')?.textContent === '有效 CLIST 评分 600 条');
    assert.equal(await page.locator('#host h3').innerText(), 'CLIST 缓存共享');
    assert.equal(await exportButton.innerText(), '导出 CLIST 缓存');
    assert.equal(await importButton.innerText(), '导入并合并缓存');
    assert.equal(await syncButton.innerText(), '同步共享缓存');
    assert.equal(await url.getAttribute('type'), 'text');
    assert.equal(await page.locator('#host label').innerText(), '共享缓存文件地址（可选）');
    assert.equal(await url.inputValue(), initialStatus().sourceUrl);
    assert.equal(await page.locator('#host .clist-shared-cache-row').count(), 6);
    assert.equal(await page.locator('#host [data-platform="CF"] .clist-shared-cache-counts').innerText(), '100 题');
    assert.deepEqual(await page.locator('#host .clist-shared-cache-row').evaluateAll(rows => rows.map(row => row.dataset.platform)), PLATFORMS);
    assert.match(await page.locator('#host .clist-shared-cache-history').innerText(), /2026-11-21T03:20:00.000Z.*2026-11-21T12:20:00\+08:00/);
    assert.match(await page.locator('#host .clist-shared-cache-intro').innerText(), /仅共享 CLIST 真实正分.*无需 Key.*按查询时间合并.*保留个人缓存和单题刷新/);
    assert.match(await page.locator('#host').innerText(), /每个人都无需 Key 即可获取共享基线/);
    assert.match(await page.locator('#host').innerText(), /导出后可放到你选定的公共下载位置，本客户端不会自动上传/);
    assert.match(await page.locator('#host').innerText(), /刷新评分仍使用个人 CLIST 配置/);
    assert.equal(await page.locator('#host input[type="password"]').count(), 0);
    for (const button of [exportButton, importButton, syncButton]) assert.equal(await button.isEnabled(), true, 'sharing does not depend on a personal key');

    // Initial baseline counts describe the cache, never local-library coverage.
    await page.evaluate(() => { window.state.initialTotal = 37200; window.state.initialAppliedAt = '2026-11-22T01:00:00.000Z'; });
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-history')?.textContent?.includes('内置基线 37,200 条'));
    assert.match(await page.locator('#host .clist-shared-cache-history').innerText(), /不等于本地题库匹配 37,200 条.*基线合并：2026-11-22T01:00:00.000Z/);
    assert.equal(await summary.innerText(), '有效 CLIST 评分 600 条');

    // Local coverage comes directly from the optional library counters, independently of cache totals.
    assert.doesNotMatch(await page.locator('#host .clist-shared-cache-history').innerText(), /本地题库已匹配/);
    await page.evaluate(() => { window.state.libraryTotal = 1250; window.state.libraryMatched = 430; });
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-history')?.textContent?.includes('本地题库已匹配 430 / 1,250 题'));
    assert.equal(await summary.innerText(), '有效 CLIST 评分 600 条', 'coverage never replaces the cache total');
    for (const field of ['libraryTotal', 'libraryMatched']) {
      await page.evaluate(field => { window.state[field] = -1; }, field);
      await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-error')?.textContent?.includes('状态无效'));
      assert.match(await page.locator('#host .clist-shared-cache-history').innerText(), /本地题库已匹配 430 \/ 1,250 题/);
      await page.evaluate(field => { window.state[field] = field === 'libraryTotal' ? 1250 : 430; }, field);
      await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-error').hidden);
    }
    await page.evaluate(() => { delete window.state.libraryMatched; });
    await page.waitForFunction(() => !document.querySelector('#host .clist-shared-cache-history')?.textContent?.includes('本地题库已匹配'));
    await page.evaluate(() => { delete window.state.libraryTotal; });

    // Native picker cancellation is quiet; renderer passes no path or credentials.
    await exportButton.click(); await importButton.click();
    await page.waitForFunction(() => window.calls.some(row => row[0] === 'import'));
    assert.deepEqual(await page.evaluate(() => window.calls.filter(row => ['export', 'import'].includes(row[0])).map(row => row[1])), [[], []]);
    assert.deepEqual(await page.evaluate(() => window.toasts), []);
    assert.deepEqual(await page.evaluate(() => window.confirmations), [], 'non-destructive merge never asks for confirmation');
    assert.equal(await summary.innerText(), '有效 CLIST 评分 600 条');

    // Empty, insecure and credential-bearing addresses never cross the bridge.
    for (const invalid of ['', 'http://cache.example.test/file.json', 'not a url', 'https://user:password@cache.example.test/file.json']) {
      await url.fill(invalid); await syncButton.click();
      assert.equal(await error.isVisible(), true); assert.match(await error.innerText(), /HTTPS/);
    }
    assert.equal(await page.evaluate(() => window.calls.filter(row => row[0] === 'sync').length), 0);

    await page.evaluate(() => { window.cancel = false; });
    await importButton.click();
    await page.waitForFunction(() => window.toasts.includes('新增2 更新3 保留595 忽略零值4'));
    assert.equal(await page.locator('#host .clist-shared-cache-result').innerText(), '新增2 更新3 保留595 忽略零值4');
    await exportButton.click();
    await page.waitForFunction(() => window.toasts.includes('CLIST 缓存已导出'));

    // Every pending action excludes duplicates, including programmatic clicks.
    for (const kind of ['export', 'import', 'sync']) {
      await url.fill('https://cache.example.test/next.json');
      await page.evaluate(() => { window.hold = true; window.calls = []; window.release = undefined; });
      await page.locator(`#host [data-action="${kind}"]`).click();
      await page.waitForFunction(() => typeof window.release === 'function');
      for (const button of [exportButton, importButton, syncButton]) assert.equal(await button.isDisabled(), true);
      await page.evaluate(() => document.querySelectorAll('#host [data-action]').forEach(button => button.dispatchEvent(new Event('click'))));
      assert.equal(await page.evaluate(() => window.calls.filter(row => row[0] !== 'status').length), 1);
      await page.evaluate(() => { window.release(); window.hold = false; });
      await page.waitForFunction(() => !document.querySelector('#host [data-action="sync"]').disabled);
    }
    assert.equal(await url.inputValue(), 'https://cache.example.test/next.json');
    assert.deepEqual(await page.evaluate(() => window.calls.find(row => row[0] === 'sync')[1]), ['https://cache.example.test/next.json']);

    // Polling respects both active editing and a saved draft after blur.
    await url.focus();
    await page.evaluate(() => { window.state.sourceUrl = 'https://cache.example.test/remote.json'; });
    await page.waitForTimeout(100);
    assert.equal(await url.inputValue(), 'https://cache.example.test/next.json', 'focused editor is never overwritten');
    await url.fill('https://cache.example.test/draft.json');
    await exportButton.focus();
    await page.waitForTimeout(100);
    assert.equal(await url.inputValue(), 'https://cache.example.test/draft.json', 'typed draft survives blur and polling');
    await syncButton.click();
    await page.waitForFunction(() => !document.querySelector('#host [data-action="sync"]').disabled);
    assert.equal(await url.inputValue(), 'https://cache.example.test/draft.json');
    // Main may normalize the successful saved URL; fill it from status, not the request.
    await url.fill('https://CACHE.example.test'); await syncButton.click();
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-url').value === 'https://cache.example.test/');

    // A newer edit during a sync RPC survives the completion response.
    await page.evaluate(() => { window.hold = true; window.release = undefined; });
    await url.fill('https://cache.example.test/submitted.json'); await syncButton.click();
    await page.waitForFunction(() => typeof window.release === 'function');
    await url.fill('https://cache.example.test/new-draft.json');
    await page.evaluate(() => { window.release(); window.hold = false; });
    await page.waitForFunction(() => !document.querySelector('#host [data-action="sync"]').disabled);
    await exportButton.focus(); await page.waitForTimeout(100);
    assert.equal(await url.inputValue(), 'https://cache.example.test/new-draft.json');

    // Failures and invalid status keep the last good total and platform counts.
    await page.evaluate(() => { window.failRead = true; });
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-error')?.textContent === '状态连接失败');
    assert.equal(await summary.innerText(), '有效 CLIST 评分 600 条');
    await page.evaluate(() => { window.failRead = false; window.good = structuredClone(window.state); window.state.total = -1; });
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-error')?.textContent?.includes('状态无效'));
    assert.equal(await summary.innerText(), '有效 CLIST 评分 600 条');
    await page.evaluate(() => { window.state = structuredClone(window.good); window.state.platforms.CF = -1; });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#host [data-platform="CF"] .clist-shared-cache-counts').innerText(), '100 题');
    await page.evaluate(() => { window.state = structuredClone(window.good); window.state.newestQuery = '2026-11-21T12:20:00'; });
    await page.waitForTimeout(100);
    assert.equal(await summary.innerText(), '有效 CLIST 评分 600 条', 'timezone-free timestamps are rejected');
    await page.evaluate(() => { window.state = structuredClone(window.good); window.failAction = true; });
    await importButton.click();
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-error')?.textContent === '合并失败，个人缓存保留');
    assert.equal(await summary.innerText(), '有效 CLIST 评分 600 条');
    assert.equal(await importButton.isEnabled(), true);
    assert.equal(await page.evaluate(() => window.failures.length), 1);
    await page.waitForTimeout(100);
    assert.equal(await error.innerText(), '合并失败，个人缓存保留', 'status polling does not erase an action error');

    await page.evaluate(() => { window.failAction = false; window.badResult = true; });
    await importButton.click();
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-error')?.textContent?.includes('状态无效'));
    assert.equal(await summary.innerText(), '有效 CLIST 评分 600 条', 'negative result counters cannot replace known status');
    assert.equal(await page.locator('#host .clist-shared-cache-result').innerText(), '新增2 更新3 保留595 忽略零值4');
    await page.evaluate(() => { window.badResult = false; });

    // Remote platform text stays inert and unexpected secret fields are not rendered.
    await page.evaluate(() => {
      window.failAction = false; window.state.platforms['<img src=x onerror="window.injected=1">'] = 1;
      window.state.apiKey = 'synthetic-secret-must-never-render';
      window.panel.destroy(); window.panel = window.NotebookClistSharedCachePanel.mount(document.querySelector('#host'), { pollMs: 40 });
    });
    await page.waitForFunction(() => document.querySelectorAll('#host .clist-shared-cache-row').length === 7);
    assert.equal(await page.locator('#host img, #host svg, #host script').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.equal((await page.locator('#host').innerText()).includes('synthetic-secret-must-never-render'), false);
    await page.setViewportSize({ width: 390, height: 850 });
    const narrow = await page.evaluate(() => {
      const host = document.querySelector('#host');
      return { host: host.scrollWidth - host.clientWidth, doc: document.documentElement.scrollWidth - innerWidth,
        children: [...host.querySelectorAll('button,li')].map(node => node.scrollWidth - node.clientWidth),
        inputWidth: host.querySelector('input').getBoundingClientRect().width, hostWidth: host.clientWidth,
        backdrop: getComputedStyle(host).backdropFilter };
    });
    assert.ok(narrow.host <= 1 && narrow.doc <= 1, JSON.stringify(narrow));
    assert.ok(narrow.children.every(value => value <= 1), JSON.stringify(narrow));
    assert.ok(narrow.inputWidth > 0 && narrow.inputWidth <= narrow.hostWidth, JSON.stringify(narrow));
    assert.equal(narrow.backdrop, 'none');
    await page.locator('#close').click();
    const closed = await page.evaluate(() => window.calls.length);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.calls.length), closed);
    await page.evaluate(() => { window.state.total = 601; document.querySelector('#settings').showModal(); });
    await page.waitForFunction(() => document.querySelector('#host .clist-shared-cache-summary')?.textContent === '有效 CLIST 评分 601 条');
    await page.evaluate(() => window.panel.stop());
    const stopped = await page.evaluate(() => window.calls.length);
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.calls.length), stopped);
    await page.evaluate(() => window.panel.start());
    await page.waitForFunction(count => window.calls.length > count, stopped);
    await page.evaluate(() => window.panel.destroy());
    assert.equal(await page.locator('#host > *').count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(network, [], 'renderer never fetches a shared URL');

    const missing = await browser.newPage();
    await missing.setContent('<section id="none"></section><section id="partial"></section>');
    await missing.addScriptTag({ path: PANEL_JS });
    const absent = await missing.evaluate(() => {
      window.NotebookClistSharedCachePanel.mount(document.querySelector('#none'));
      window.notebook = { getClistSharedCacheStatus: async () => ({}) };
      window.NotebookClistSharedCachePanel.mount(document.querySelector('#partial'));
      return [...document.querySelectorAll('section')].map(section => ({ hidden: section.hidden, text: section.textContent }));
    });
    assert.deepEqual(absent, [{ hidden: true, text: '' }, { hidden: true, text: '' }]);

    // Full app imports the new panel exactly between library sync and CLIST backfill.
    const app = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    app.setDefaultTimeout(10000);
    const appErrors = [];
    app.on('pageerror', error => appErrors.push(error.message));
    await app.route(/^https?:/, route => route.abort());
    await app.addInitScript(initial => {
      window.sharedFixture = { state: initial, calls: [] };
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], account: null, authStatus: { status: 'anonymous' }, permissions: { push: false, admin: false }, settings: { autoSync: false }, local: { records: [], favorites: [], mastery: {}, draft: {} } }),
        getClistStatus: async () => ({ configured: false, username: null }),
        getLibrarySyncStatus: async () => ({ running: false, platforms: {}, totalCount: 0 }), updateLibrary: async () => ({}),
        getDifficultyBackfillStatus: async () => ({ running: false, status: 'idle', platforms: {} }),
        startDifficultyBackfill: async () => ({}), pauseDifficultyBackfill: async () => ({}),
        getClistSharedCacheStatus: async () => { window.sharedFixture.calls.push('status'); return structuredClone(window.sharedFixture.state); },
        exportClistSharedCache: async () => { window.sharedFixture.calls.push('export'); return { canceled: false, status: structuredClone(window.sharedFixture.state) }; },
        importClistSharedCache: async () => { window.sharedFixture.calls.push('import'); return { canceled: false, imported: 0, updated: 0, kept: 600, ignored: 0, status: structuredClone(window.sharedFixture.state) }; },
        syncClistSharedCache: async url => { window.sharedFixture.calls.push(['sync', url]); return { canceled: false, imported: 0, updated: 0, kept: 600, ignored: 0, status: structuredClone(window.sharedFixture.state) }; }
      };
    }, initialStatus());
    await app.goto(pathToFileURL(appPath('ui/index.html')).href);
    await app.waitForSelector('#clist-shared-cache-panel', { state: 'attached' });
    assert.equal(await app.locator('#public-difficulty-panel').count(), 0, 'the former public difficulty panel is gone');
    assert.equal(await app.evaluate(() => window.sharedFixture.calls.length), 0);
    await app.locator('.sidebar').hover(); await app.locator('#settings-button').click();
    await app.waitForFunction(() => document.querySelector('#clist-shared-cache-panel .clist-shared-cache-summary')?.textContent?.includes('600'));
    const placement = await app.evaluate(() => {
      const panel = document.querySelector('#clist-shared-cache-panel');
      return { inDialog: panel.parentElement === document.querySelector('#settings-dialog'),
        afterLibrary: document.querySelector('#library-sync-panel').nextElementSibling === panel,
        beforeBackfill: panel.nextElementSibling === document.querySelector('#difficulty-backfill-panel'),
        beforeForm: Boolean(panel.compareDocumentPosition(document.querySelector('#settings-form')) & Node.DOCUMENT_POSITION_FOLLOWING), visible: !panel.hidden };
    });
    assert.deepEqual(placement, { inDialog: true, afterLibrary: true, beforeBackfill: true, beforeForm: true, visible: true });
    assert.equal(await app.locator('#difficulty-backfill-panel [data-action="start"]').isDisabled(), true);
    assert.equal(await app.locator('#clist-shared-cache-panel [data-action="import"]').isEnabled(), true);
    const dialogs = [];
    app.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    await app.locator('#clist-shared-cache-panel [data-action="import"]').click();
    await app.waitForFunction(() => window.sharedFixture.calls.includes('import'));
    assert.deepEqual(dialogs, []);
    await app.evaluate(() => document.querySelector('[data-close="settings-dialog"]').click());
    const appClosed = await app.evaluate(() => window.sharedFixture.calls.length);
    await app.waitForTimeout(1000);
    assert.equal(await app.evaluate(() => window.sharedFixture.calls.length), appClosed);
    await app.evaluate(() => { window.sharedFixture.state.total = 700; });
    await app.locator('.sidebar').hover(); await app.locator('#settings-button').click();
    await app.waitForFunction(() => document.querySelector('#clist-shared-cache-panel .clist-shared-cache-summary')?.textContent === '有效 CLIST 评分 700 条');
    assert.deepEqual(appErrors, []);

    const demo = await browser.newPage();
    await demo.route(/^https?:/, route => route.abort());
    await demo.goto(pathToFileURL(appPath('ui/index.html')).href);
    await demo.waitForSelector('#clist-shared-cache-panel', { state: 'attached' });
    assert.equal(await demo.locator('#clist-shared-cache-panel').isHidden(), true);
    assert.equal(await demo.locator('#clist-shared-cache-panel').textContent(), '');
    assert.equal(await demo.locator('#public-difficulty-panel').count(), 0);
    console.log('CLIST shared cache panel UI smoke passed (mock bridge only; no keys or network)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
