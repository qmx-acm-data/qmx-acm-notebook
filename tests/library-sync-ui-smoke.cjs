'use strict';
// Run after pnpm build:app: node tests/library-sync-ui-smoke.cjs
// Mock bridge only: no network, no real library files, no Electron process.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

const PANEL_JS = appPath('ui/library-sync-panel.js');
const PANEL_CSS = appPath('ui/library-sync.css');
const BASE_VARS = ':root{--bg:#f6f7f5;--surface:#fff;--surface-soft:#f8faf8;--text:#26352f;--muted:#8a958e;--line:#e6ebe6;--accent:#3e735b;--accent-soft:#eaf2eb;--tone-gray:#808080;--tone-green:#00a550;--tone-cyan:#008b8b;--tone-blue:#2459cf;--tone-purple:#a020f0;--tone-red:#e13f46;--tone-yellow:#bc9400}';

function idleState() {
  return { running: false, pauseRequested: false, mode: null, startedAt: null, finishedAt: null, platforms: {}, totalCount: 0 };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    // ---- standalone panel behavior -------------------------------------------------
    const page = await browser.newPage({ viewport: { width: 1000, height: 820 } });
    page.setDefaultTimeout(8000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body><section id="host"></section></body></html>');
    await page.addStyleTag({ content: BASE_VARS });
    await page.addStyleTag({ path: PANEL_CSS });
    await page.evaluate(initial => {
      window.calls = [];
      window.toasts = [];
      window.failures = [];
      window.confirmMessages = [];
      window.confirmAnswer = false;
      window.holdUpdate = false;
      window.releaseUpdate = null;
      window.state = initial;
      window.notebook = {
        getLibrarySyncStatus: async () => { window.calls.push(['status']); return structuredClone(window.state); },
        pauseLibrarySync: async () => {
          window.calls.push(['pause']);
          window.state = { ...window.state, pauseRequested: true };
          return structuredClone(window.state);
        },
        updateLibrary: async full => {
          window.calls.push(['update', full]);
          const report = { full: full === true, total: 10, durationMs: 1, platforms: { CF: { status: 'updated', before: 0, after: 5, added: 5 } } };
          if (window.holdUpdate) return new Promise(resolve => { window.releaseUpdate = () => resolve(report); });
          return report;
        }
      };
    }, idleState());
    await page.addScriptTag({ path: PANEL_JS });
    const apiReady = await page.evaluate(() => {
      const api = window.NotebookLibrarySyncPanel || window.LibrarySyncPanel;
      return Boolean(api && typeof api.mount === 'function');
    });
    assert.equal(apiReady, true, 'panel artifact exposes the mount adapter');
    await page.evaluate(() => {
      const api = window.NotebookLibrarySyncPanel || window.LibrarySyncPanel;
      window.panel = api.mount(document.querySelector('#host'), {
        pollMs: 40,
        confirm: message => { window.confirmMessages.push(message); return window.confirmAnswer; },
        onToast: message => window.toasts.push(message),
        onError: error => window.failures.push(String(error))
      });
    });

    const summary = page.locator('#host .library-sync-summary');
    const incremental = page.locator('#host [data-action="incremental"]');
    const full = page.locator('#host [data-action="full"]');
    const pause = page.locator('#host [data-action="pause"]');
    const feedback = page.locator('#host .library-sync-feedback');

    // Idle state.
    await page.waitForFunction(() => document.querySelector('#host .library-sync-summary')?.textContent === '空闲 · 已知 0 题');
    assert.equal(await page.locator('#host [role="progressbar"]').count(), 0);
    assert.equal(await incremental.isEnabled(), true);
    assert.equal(await full.isEnabled(), true);
    assert.equal(await pause.isDisabled(), true);
    assert.match(await page.locator('#host .library-sync-empty').innerText(), /尚未开始更新/);
    assert.equal(await page.evaluate(() => window.calls.some(call => call[0] === 'update' || call[0] === 'pause')), false, 'mount never starts a sync');

    // Running: per-platform progress, tones, failed message, disabled starts, polling refresh.
    await page.evaluate(() => {
      window.state = {
        running: true, pauseRequested: false, mode: 'full', startedAt: '2026-11-21T03:20:00.000Z', finishedAt: null, totalCount: 12345,
        platforms: {
          CF: { status: 'fetching', known: 100, total: 500, fetched: 120, added: 20, cursor: null, updatedAt: '2026-11-21T03:21:00.000Z' },
          LOJ: { status: 'failed', known: 0, total: null, fetched: 0, added: 0, cursor: null, updatedAt: null, message: '<img src=x onerror="window.__injected=1"> 网络错误' },
          NC: { status: 'skipped', known: 50, total: 50, fetched: 0, added: 0, cursor: null, updatedAt: null }
        }
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .library-sync-summary')?.textContent.includes('运行中'));
    assert.match(await summary.innerText(), /^运行中 · 完整重建 · 开始于 \d{2}-\d{2} \d{2}:\d{2} · 已知 12,345 题$/);
    assert.equal(await incremental.isDisabled(), true, 'incremental start is disabled while running');
    assert.equal(await full.isDisabled(), true, 'full rebuild is disabled while running');
    assert.equal(await pause.isEnabled(), true, 'pause is available while running');
    const bar = page.locator('#host .library-sync-row[data-platform="CF"] [role="progressbar"]');
    assert.equal(await bar.getAttribute('aria-valuemin'), '0');
    assert.equal(await bar.getAttribute('aria-valuemax'), '500');
    assert.equal(await bar.getAttribute('aria-valuenow'), '120');
    const cfText = await page.locator('#host .library-sync-row[data-platform="CF"]').innerText();
    assert.match(cfText, /Codeforces/);
    assert.match(cfText, /抓取中/);
    assert.match(cfText, /本次抓取 120 \/ 上游 500/);
    assert.match(cfText, /新增 20/);
    assert.match(cfText, /更新于 \d{2}-\d{2} \d{2}:\d{2}/);
    const lojRow = page.locator('#host .library-sync-row[data-platform="LOJ"]');
    assert.match(await lojRow.innerText(), /失败/);
    assert.match(await lojRow.innerText(), /<img src=x onerror="window\.__injected=1"> 网络错误/);
    assert.equal(await page.locator('#host img').count(), 0, 'bridge text is rendered as text, never as markup');
    assert.equal(await page.evaluate(() => window.__injected), undefined);
    const statusCalls = await page.evaluate(() => window.calls.filter(call => call[0] === 'status').length);
    await page.evaluate(() => {
      window.state = { ...window.state, platforms: { ...window.state.platforms, CF: { ...window.state.platforms.CF, fetched: 180 } } };
    });
    await page.waitForFunction(() => document.querySelector('#host .library-sync-row[data-platform="CF"] [role="progressbar"]')?.getAttribute('aria-valuenow') === '180');
    assert.ok(await page.evaluate(() => window.calls.filter(call => call[0] === 'status').length) > statusCalls, 'visible panel polls the bridge');

    // Pause asks the bridge, then the paused state offers the resume hint.
    await pause.click();
    await page.waitForFunction(() => window.calls.some(call => call[0] === 'pause'));
    await page.waitForFunction(() => window.toasts.some(text => text.includes('暂停')));
    await page.evaluate(() => {
      window.state = {
        running: false, pauseRequested: false, mode: 'full', startedAt: '2026-11-21T03:20:00.000Z', finishedAt: null, totalCount: 12345,
        platforms: { CF: { status: 'paused', known: 100, total: 500, fetched: 180, added: 20, cursor: 180, updatedAt: null } }
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .library-sync-feedback')?.textContent.includes('再次点击'));
    assert.equal(await feedback.innerText(), '已暂停。再次点击「增量更新」可续传。');
    assert.match(await summary.innerText(), /^已暂停 · 完整重建/);
    assert.equal(await incremental.isEnabled(), true);
    assert.equal(await pause.isDisabled(), true);

    // Incremental update always passes false; pending state blocks duplicate clicks.
    await page.evaluate(() => {
      window.calls = [];
      window.holdUpdate = true;
      window.state = { running: true, pauseRequested: false, mode: 'incremental', startedAt: '2026-11-21T03:30:00.000Z', finishedAt: null, totalCount: 12345, platforms: {} };
    });
    await page.waitForFunction(() => document.querySelector('#host [data-action="incremental"]')?.disabled === true);
    await page.evaluate(() => {
      window.state = { ...window.state, running: false, finishedAt: '2026-11-21T03:31:00.000Z' };
    });
    await page.waitForFunction(() => document.querySelector('#host [data-action="incremental"]')?.disabled === false);
    await incremental.click();
    await page.waitForFunction(() => document.querySelector('#host [data-action="incremental"]')?.disabled === true);
    await page.evaluate(() => document.querySelector('#host [data-action="incremental"]').click());
    const updateCalls = await page.evaluate(() => window.calls.filter(call => call[0] === 'update'));
    assert.deepEqual(updateCalls, [['update', false]], 'incremental passes false and ignores duplicate clicks while pending');
    await page.evaluate(() => { window.releaseUpdate(); window.holdUpdate = false; });
    await page.waitForFunction(() => window.toasts.some(text => text.includes('增量更新完成')));
    await page.waitForFunction(() => document.querySelector('#host [data-action="incremental"]')?.disabled === false);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'update').length), 1);

    // Full rebuild requires confirmation and only then passes true.
    await page.evaluate(() => { window.calls = []; window.confirmMessages = []; window.confirmAnswer = false; });
    await full.click();
    await page.waitForFunction(() => window.confirmMessages.length === 1);
    assert.match(await page.evaluate(() => window.confirmMessages[0]), /完整重建/);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'update').length), 0, 'cancelled confirmation never starts the rebuild');
    await page.evaluate(() => { window.confirmAnswer = true; });
    await full.click();
    await page.waitForFunction(() => window.calls.some(call => call[0] === 'update' && call[1] === true));
    assert.deepEqual(await page.evaluate(() => window.calls.filter(call => call[0] === 'update')), [['update', true]]);
    await page.waitForFunction(() => document.querySelector('#host [data-action="full"]')?.disabled === false);

    // Finished state: failed platforms get a dedicated retry hint, skipped shows the reason.
    await page.evaluate(() => {
      window.state = {
        running: false, pauseRequested: false, mode: 'incremental', startedAt: '2026-11-21T03:32:00.000Z', finishedAt: '2026-11-21T03:40:00.000Z', totalCount: 200,
        platforms: {
          CF: { status: 'failed', known: 120, total: 130, fetched: 0, added: 0, cursor: null, updatedAt: null, message: 'HTTP 500' },
          LG: { status: 'done', known: 80, total: 80, fetched: 80, added: 8, cursor: null, updatedAt: '2026-11-21T03:40:00.000Z' },
          NC: { status: 'skipped', known: 50, total: 50, fetched: 0, added: 0, cursor: null, updatedAt: null }
        }
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .library-sync-failed')?.hidden === false);
    assert.equal(await page.locator('#host .library-sync-failed').innerText(), 'Codeforces 更新失败，可点击「增量更新」重试；已有题库数据不会丢失。');
    assert.match(await page.locator('#host .library-sync-row[data-platform="CF"]').innerText(), /HTTP 500/);
    assert.match(await page.locator('#host .library-sync-row[data-platform="NC"]').innerText(), /题量未变，已跳过/);
    assert.equal(await page.locator('#host .library-sync-row[data-platform="NC"] .library-sync-count').innerText(), '已缓存 50 题 · 本次抓取 0');
    assert.equal(await page.locator('#host .library-sync-row[data-platform="NC"] [role="progressbar"]').isVisible(), false, 'skipped is not an empty cache or an unfinished crawl');
    assert.equal(await page.locator('#host .library-sync-row[data-platform="LG"] [role="progressbar"]').isVisible(), false, 'finished crawl no longer needs a progress bar');
    assert.equal(await page.locator('#host .library-sync-row[data-platform="LG"] .library-sync-status').innerText(), '已完成');
    assert.match(await summary.innerText(), /^已完成 · 增量更新/);

    // Unknown platform keys and titles stay text-only.
    await page.evaluate(() => {
      window.state = {
        running: false, pauseRequested: false, mode: null, startedAt: null, finishedAt: null, totalCount: 1,
        platforms: { '<img src=x onerror="window.__key=1">': { status: 'failed', known: 1, total: 1, fetched: 0, added: 0, cursor: null, updatedAt: null, message: '<img onerror="window.__msg=1">' } }
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .library-sync-platforms')?.textContent.includes('<img src=x onerror="window.__key=1">'));
    assert.equal(await page.locator('#host img').count(), 0);
    assert.equal(await page.evaluate(() => window.__key), undefined);
    assert.equal(await page.evaluate(() => window.__msg), undefined);

    // 390px keeps the panel inside the viewport with a single-column action list.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.evaluate(() => {
      window.state = {
        running: true, pauseRequested: false, mode: 'full', startedAt: '2026-11-21T03:41:00.000Z', finishedAt: null, totalCount: 12345,
        platforms: { CF: { status: 'fetching', known: 100, total: 500, fetched: 120, added: 20, cursor: null, updatedAt: null } }
      };
    });
    await page.waitForFunction(() => document.querySelector('#host .library-sync-summary')?.textContent.includes('运行中'));
    const narrow = await page.evaluate(() => {
      const section = document.querySelector('#host');
      const buttons = [...section.querySelectorAll('.library-sync-actions .button')].map(button => {
        const box = button.getBoundingClientRect();
        return { width: box.width, top: box.top, overflow: button.scrollWidth > button.clientWidth + 1 };
      });
      return {
        sectionOverflow: section.scrollWidth - section.clientWidth,
        documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
        buttons
      };
    });
    assert.ok(narrow.sectionOverflow <= 1, `panel must not overflow horizontally: ${narrow.sectionOverflow}`);
    assert.ok(narrow.documentOverflow <= 1, `page must not overflow horizontally: ${narrow.documentOverflow}`);
    assert.equal(narrow.buttons.length, 3);
    assert.equal(narrow.buttons.every(button => button.overflow === false), true);
    assert.ok(narrow.buttons[1].top >= narrow.buttons[0].top, 'actions stack into one column on narrow screens');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#host')).backdropFilter), 'none');
    assert.deepEqual(pageErrors, []);

    // ---- no bridge: the section hides itself --------------------------------------
    const noBridgePage = await browser.newPage({ viewport: { width: 800, height: 700 } });
    noBridgePage.setDefaultTimeout(8000);
    await noBridgePage.setContent('<!doctype html><html><body><section id="host"></section></body></html>');
    await noBridgePage.addStyleTag({ path: PANEL_CSS });
    await noBridgePage.addScriptTag({ path: PANEL_JS });
    const noBridge = await noBridgePage.evaluate(() => {
      const api = window.NotebookLibrarySyncPanel || window.LibrarySyncPanel;
      const host = document.querySelector('#host');
      api.mount(host);
      const partial = document.createElement('section');
      document.body.append(partial);
      window.notebook = { getLibrarySyncStatus: async () => ({}) };
      api.mount(partial);
      return { hidden: host.hidden, partialHidden: partial.hidden, text: host.textContent };
    });
    assert.equal(noBridge.hidden, true, 'no bridge hides the whole block');
    assert.equal(noBridge.partialHidden, true, 'incomplete bridge hides the whole block too');
    assert.equal(noBridge.text, '');

    // ---- app integration: placement and visibility --------------------------------
    const appPage = await browser.newPage({ viewport: { width: 1440, height: 940 } });
    appPage.setDefaultTimeout(10000);
    const appErrors = [];
    appPage.on('pageerror', error => appErrors.push(error.message));
    await appPage.route(/^https?:/, route => route.abort());
    await appPage.addInitScript(initial => {
      window.syncFixture = { state: initial, calls: [] };
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], account: null, authStatus: { status: 'anonymous' }, permissions: { push: false, admin: false }, settings: { autoSync: false }, local: { records: [], favorites: [], mastery: {}, draft: {} } }),
        getClistStatus: async () => ({ configured: false, username: null }),
        getLibrarySyncStatus: async () => { window.syncFixture.calls.push('status'); return structuredClone(window.syncFixture.state); },
        pauseLibrarySync: async () => { window.syncFixture.calls.push('pause'); return structuredClone(window.syncFixture.state); },
        updateLibrary: async full => { window.syncFixture.calls.push(`update:${String(full)}`); return { full: full === true, total: 0, durationMs: 1, platforms: {} }; }
      };
    }, idleState());
    await appPage.goto(pathToFileURL(appPath('ui/index.html')).href);
    await appPage.locator('.sidebar').hover();
    await appPage.locator('#settings-button').click();
    await appPage.waitForSelector('#settings-dialog[open]');
    await appPage.waitForFunction(() => document.querySelector('#library-sync-panel .library-sync-summary')?.textContent.includes('空闲'));
    const placement = await appPage.evaluate(() => {
      const dialog = document.querySelector('#settings-dialog');
      const panel = document.querySelector('#library-sync-panel');
      const bindings = dialog.querySelector('#platform-bindings');
      const form = dialog.querySelector('#settings-form');
      return {
        parentIsDialog: panel.parentElement === dialog,
        afterBindings: Boolean(bindings.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING),
        beforeForm: Boolean(panel.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING),
        visible: !panel.hidden
      };
    });
    assert.deepEqual(placement, { parentIsDialog: true, afterBindings: true, beforeForm: true, visible: true });

    // Polling pauses while the dialog is closed, then resumes when it is reopened.
    await appPage.evaluate(() => { document.querySelector('[data-close="settings-dialog"]').click(); });
    await appPage.waitForSelector('#settings-dialog', { state: 'hidden' });
    const closedCalls = await appPage.evaluate(() => window.syncFixture.calls.length);
    await appPage.waitForTimeout(1000);
    assert.equal(await appPage.evaluate(() => window.syncFixture.calls.length), closedCalls, 'closed panel stops polling the bridge');
    await appPage.evaluate(() => {
      window.syncFixture.state = {
        running: true, pauseRequested: false, mode: 'incremental', startedAt: '2026-11-21T03:42:00.000Z', finishedAt: null, totalCount: 500,
        platforms: { CF: { status: 'fetching', known: 100, total: 500, fetched: 120, added: 20, cursor: null, updatedAt: null } }
      };
    });
    await appPage.locator('.sidebar').hover();
    await appPage.locator('#settings-button').click();
    await appPage.waitForFunction(() => document.querySelector('#library-sync-panel .library-sync-summary')?.textContent.includes('运行中'));
    assert.equal(await appPage.locator('#library-sync-panel [role="progressbar"]').getAttribute('aria-valuenow'), '120');
    assert.deepEqual(appErrors, []);

    const demoPage = await browser.newPage({ viewport: { width: 1440, height: 940 } });
    demoPage.setDefaultTimeout(10000);
    const demoErrors = [];
    demoPage.on('pageerror', error => demoErrors.push(error.message));
    await demoPage.route(/^https?:/, route => route.abort());
    await demoPage.goto(pathToFileURL(appPath('ui/index.html')).href);
    await demoPage.waitForSelector('#library-sync-panel', { state: 'attached' });
    assert.equal(await demoPage.locator('#library-sync-panel').isHidden(), true, 'browser preview keeps the whole block hidden');
    assert.deepEqual(demoErrors, []);

    console.log('library sync panel UI smoke passed (mock bridge only; no network)');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
