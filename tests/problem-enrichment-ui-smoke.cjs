'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><html><body><button id="opener">Open fixture</button></body></html>');
    await page.addStyleTag({ content: ':root{--surface:#fff;--surface-soft:#f4f5f7;--text:#202838;--muted:#647084;--line:#cbd1db;--accent:#456ad2}' });
    await page.addStyleTag({ path: appPath('ui/problem-enrichment.css') });
    await page.evaluate(() => {
      window.calls = []; window.applied = 0;
      window.view = { url: 'https://codeforces.com/problemset/problem/1/A', title: '<img src=x onerror=alert(1)> Fixture', platform: 'CF', revision: 3, officialTags: ['math'], officialDifficulty: null, canSupplementTags: false, canSupplementDifficulty: true, supplement: null, suggestion: null };
      window.aiStatus = { configured: false, endpoint: null, model: null };
      window.notebook = {
        getProblemEnrichment: async url => { window.calls.push(['get', url]); return structuredClone(window.view); },
        getProblemAIStatus: async () => { window.calls.push(['status']); return structuredClone(window.aiStatus); },
        saveProblemAIConfig: async input => { window.calls.push(['config', input]); window.aiStatus = { configured: true, endpoint: input.endpoint, model: input.model }; return structuredClone(window.aiStatus); },
        clearProblemAIConfig: async () => { window.calls.push(['clear']); window.aiStatus = { configured: false, endpoint: null, model: null }; return structuredClone(window.aiStatus); },
        suggestProblemEnrichment: async input => {
          window.calls.push(['suggest', input]);
          window.view.suggestion = { id: 'suggestion-7', url: window.view.url, cfRating: 1701, luoguDifficulty: '普及/提高−', reason: '<svg onload=alert(1)> 低置信度，需要人工审核', source: 'ai', status: 'pending', model: 'fixture-model', createdAt: '2026-11-20T12:00:00Z' };
          return structuredClone(window.view);
        },
        saveProblemEnrichment: async input => {
          window.calls.push(['save', input]);
          if (window.failSave) throw new Error('补充信息已被更新，请刷新后重试');
          window.view.revision += 1;
          window.view.supplement = { ...input, source: input.suggestionId ? 'ai' : 'manual', status: 'approved', revision: window.view.revision, updatedAt: '2026-11-20T12:00:00Z' };
          if (input.suggestionId) window.view.suggestion = null;
          return structuredClone(window.view);
        },
        removeProblemEnrichment: async input => { window.calls.push(['remove', input]); window.view.revision += 1; window.view.supplement = null; return structuredClone(window.view); }
      };
    });
    await page.addScriptTag({ path: appPath('ui/problem-enrichment.js') });
    const open = async () => {
      await page.locator('#opener').focus();
      await page.evaluate(() => window.ProblemEnrichment.open(window.view.url, () => { window.applied += 1; }));
      await page.waitForFunction(() => document.querySelector('.enrichment-status')?.textContent.includes('已读取'));
    };
    await open();
    assert.equal(await page.getByRole('dialog').count(), 1);
    assert.equal(await page.locator('.enrichment-official img').count(), 0, 'official text uses safe DOM nodes');
    assert.equal(await page.locator('.enrichment-tags').isDisabled(), true);
    assert.equal(await page.locator('.enrichment-cf').isEnabled(), true);
    assert.equal(await page.locator('.enrichment-generate').isDisabled(), true);
    assert.equal(await page.locator('.enrichment-ai-config').getAttribute('open'), '');
    assert.equal(await page.evaluate(() => window.calls.some(([kind]) => kind === 'suggest' || kind === 'save')), false, 'opening never generates or saves');
    assert.deepEqual(await page.locator('.enrichment-luogu option').allTextContents(), ['不补充洛谷参考难度', '暂无评定', '入门', '普及-', '普及', '普及+/提高-', '提高+/省选-', '省选/NOI-', 'NOI/NOI+/CTS']);

    await page.locator('.enrichment-cf').fill('799');
    await page.locator('.enrichment-reason').fill('Manual reason');
    await page.locator('.enrichment-save').click();
    await page.getByRole('alert').filter({ hasText: '800–3500' }).waitFor();
    assert.equal(await page.evaluate(() => window.calls.filter(([kind]) => kind === 'save').length), 0);
    await page.locator('.enrichment-cf').fill('1601');
    await page.locator('.enrichment-luogu').selectOption('普及/提高−');
    await page.locator('.enrichment-save').click();
    await page.waitForFunction(() => window.applied === 1);
    assert.deepEqual(await page.evaluate(() => window.calls.find(([kind]) => kind === 'save')[1]), { url: 'https://codeforces.com/problemset/problem/1/A', expectedRevision: 3, reason: 'Manual reason', cfRating: 1601, luoguDifficulty: '普及/提高−' }, 'manual save omits official tags and suggestion id');
    assert.equal(await page.locator('.enrichment-current .enrichment-badge').innerText(), '手动补充');

    await page.locator('.enrichment-endpoint').fill('https://api.example.com/v1/chat/completions');
    await page.locator('.enrichment-model').fill('fixture-model');
    await page.locator('.enrichment-key').fill('fixture-secret-only-for-mock');
    await page.locator('.enrichment-config-save').click();
    await page.waitForFunction(() => document.querySelector('.enrichment-status').textContent === 'AI 配置已保存');
    assert.equal(await page.locator('.enrichment-key').inputValue(), '', 'key is cleared after submission');
    assert.doesNotMatch(await page.locator('body').innerText(), /fixture-secret-only-for-mock/);
    assert.equal(await page.locator('.enrichment-generate').isEnabled(), true);
    await page.locator('.enrichment-generate').click();
    await page.getByRole('alert').filter({ hasText: '至少 20' }).waitFor();
    assert.equal(await page.evaluate(() => window.calls.filter(([kind]) => kind === 'suggest').length), 0);
    const statement = 'Given a public array of n integers, find its longest increasing subsequence. n is at most 100000.';
    await page.locator('.enrichment-statement').fill(statement);
    await page.locator('.enrichment-generate').click();
    await page.locator('.enrichment-pending-badge').waitFor();
    assert.equal(await page.locator('.enrichment-pending-badge').innerText(), 'AI 待审核');
    assert.equal(await page.locator('.enrichment-pending svg').count(), 0, 'AI reason remains plain text');
    assert.equal(await page.evaluate(() => window.calls.filter(([kind]) => kind === 'save').length), 1, 'generation never auto applies');
    assert.equal(await page.evaluate(() => window.applied), 1);
    assert.deepEqual(await page.evaluate(() => window.calls.find(([kind]) => kind === 'suggest')[1]), { url: 'https://codeforces.com/problemset/problem/1/A', statementText: statement });
    await page.locator('.enrichment-approve').click();
    await page.waitForFunction(() => window.applied === 2);
    const approved = await page.evaluate(() => window.calls.filter(([kind]) => kind === 'save').at(-1)[1]);
    assert.deepEqual(approved, { url: 'https://codeforces.com/problemset/problem/1/A', expectedRevision: 4, suggestionId: 'suggestion-7', reason: '<svg onload=alert(1)> 低置信度，需要人工审核', cfRating: 1701, luoguDifficulty: '普及/提高−' });
    assert.equal(await page.locator('.enrichment-current .enrichment-badge').innerText(), 'AI 补充 · 已审核');
    assert.equal(await page.locator('.enrichment-pending').isVisible(), false);
    await page.locator('.enrichment-remove').click();
    await page.waitForFunction(() => window.applied === 3);
    assert.deepEqual(await page.evaluate(() => window.calls.find(([kind]) => kind === 'remove')[1]), { url: 'https://codeforces.com/problemset/problem/1/A', expectedRevision: 5 });
    assert.match(await page.locator('.enrichment-official').innerText(), /官方算法标签：math/);
    assert.equal(await page.evaluate(() => window.calls.filter(([kind]) => kind === 'clear').length), 0, 'saving/deleting supplements never clears credentials');
    await page.locator('.enrichment-ai-config summary').click();
    await page.locator('.enrichment-config-clear').click();
    await page.waitForFunction(() => document.querySelector('.enrichment-status').textContent === 'AI 配置和密钥已清除');
    assert.equal(await page.evaluate(() => window.calls.filter(([kind]) => kind === 'clear').length), 1);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('#opener').evaluate(element => document.activeElement === element), true);

    await page.evaluate(() => { Object.assign(window.view, { officialTags: [], officialDifficulty: '1200', canSupplementTags: true, canSupplementDifficulty: false, supplement: null, suggestion: null }); });
    await open();
    assert.equal(await page.locator('.enrichment-tags').isEnabled(), true);
    assert.equal(await page.locator('.enrichment-cf').isDisabled(), true);
    assert.equal(await page.locator('.enrichment-luogu').isDisabled(), true);
    await page.locator('.enrichment-tags').fill('动态规划, 二分，动态规划');
    await page.locator('.enrichment-reason').fill('根据公开题面的状态转移判断');
    await page.evaluate(() => { window.failSave = true; });
    await page.locator('.enrichment-save').click();
    await page.getByRole('alert').filter({ hasText: '已被更新' }).waitFor();
    assert.equal(await page.evaluate(() => window.applied), 3, 'failed version save does not refresh current problem');
    await page.evaluate(() => { window.failSave = false; });
    await page.locator('.enrichment-save').click();
    await page.waitForFunction(() => window.applied === 4);
    assert.deepEqual(await page.evaluate(() => window.calls.filter(([kind]) => kind === 'save').at(-1)[1]), { url: 'https://codeforces.com/problemset/problem/1/A', expectedRevision: 6, reason: '根据公开题面的状态转移判断', tags: ['动态规划', '二分'] }, 'official difficulty is omitted independently from editable tags');

    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate(dark => {
        const palette = dark ? { '--surface': '#202838', '--surface-soft': '#161d2b', '--text': '#f0f2f7', '--muted': '#aab4c6', '--line': '#3f4b61' } : { '--surface': '#ffffff', '--surface-soft': '#f4f5f7', '--text': '#202838', '--muted': '#647084', '--line': '#cbd1db' };
        for (const [name, value] of Object.entries(palette)) document.documentElement.style.setProperty(name, value);
      }, theme === 'dark');
      assert.equal(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backgroundColor), theme === 'dark' ? 'rgb(32, 40, 56)' : 'rgb(255, 255, 255)');
      await page.setViewportSize({ width: 390, height: 640 });
      assert.equal(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'narrow dialog has no horizontal scroll');
      assert.equal(await page.getByRole('dialog').evaluate(element => element.getBoundingClientRect().height <= window.innerHeight), true, 'dialog stays within viewport');
      assert.equal(await page.getByRole('dialog').evaluate(element => getComputedStyle(element).backdropFilter), 'none');
    }
    await page.keyboard.press('Escape');
    await page.evaluate(() => { Object.assign(window.view, { officialTags: ['math'], canSupplementTags: false }); });
    await open();
    assert.equal(await page.locator('.enrichment-save').isDisabled(), true, 'complete official metadata blocks manual writes');
    assert.equal(await page.locator('.enrichment-generate').isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log('problem enrichment UI smoke passed (mock bridge only; no API/network)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
