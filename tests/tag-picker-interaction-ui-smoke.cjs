'use strict';
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

const baseline = process.env.QMX_TAG_PICKER_BASELINE === '1';
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.addInitScript(() => {
      const repo = 'fixture/tag-interaction';
      const categories = Array.from({ length: 10 }, (_, group) => ({ id: `g${group}`, name: `分类${group}`, tags: Array.from({ length: group < 2 ? 27 : 26 }, (_, index) => ({ id: `t${group}-${index}`, name: `标签${group}-${index}` })) }));
      // A duplicate catalog label must stay synchronized across categories.
      categories[9].tags[25].name = '标签0-0';
      const documents = Array.from({ length: 80 }, (_, index) => ({ id: `d${index}`, kind: 'document', repo, path: `d${index}.md`, sha: 'fixture-sha', authorId: 1, author: 'tester', title: `题解${index}`, platform: 'CF', pid: `${index}A`, tags: index === 0 ? ['标签0-0', '旧标签'] : [`标签${index % 10}-1`], problemUrl: `https://example.com/problem/${index}`, body: '# 题解\n\n完整正文', updatedAt: `2026-11-${String(15 - index % 10).padStart(2, '0')}` }));
      window.tagFixture = { writes: [], uploads: [] };
      window.notebook = {
        bootstrap: async () => ({ records: documents, local: { records: [], favorites: [], mastery: {}, draft: {} }, settings: { autoSync: false }, account: { id: 1, login: 'tester' }, permissions: { repo, push: true }, tagCatalog: { categories } }),
        updateLocal: async data => { window.tagFixture.writes.push(structuredClone(data)); },
        saveDocument: async data => { window.tagFixture.uploads.push(structuredClone(data)); return { document: { ...data, id: `saved-${window.tagFixture.uploads.length}`, kind: 'document', repo, path: data.path || `saved-${window.tagFixture.uploads.length}.md`, sha: 'saved-sha', authorId: 1, author: 'tester' } }; }
      };
    });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await page.waitForFunction(() => document.querySelector('#count-public').textContent === '80');
    await page.keyboard.press('/');
    await page.waitForSelector('.record-card');
    await page.click('#tag-filter-trigger');
    const metrics = await page.evaluate(async () => {
      const options = document.querySelector('#tag-picker-dialog-options');
      const list = document.querySelector('#record-list');
      const first = options.querySelector('input');
      const search = document.querySelector('#tag-picker-search');
      let optionNodesAdded = 0, listChanges = 0;
      const optionObserver = new MutationObserver(records => { for (const record of records) optionNodesAdded += record.addedNodes.length; });
      const listObserver = new MutationObserver(records => { listChanges += records.length; });
      optionObserver.observe(options, { childList: true, subtree: true });
      listObserver.observe(list, { childList: true, subtree: true });
      const searches = [];
      for (const query of ['标', '标签0', '标签0-2', '不存在', '', '分类9', '标签', '']) {
        const started = performance.now();
        search.value = query;
        search.dispatchEvent(new Event('input', { bubbles: true }));
        searches.push(performance.now() - started);
      }
      const choices = options.querySelectorAll('input[value="标签0-0"]');
      const choiceStarted = performance.now();
      choices[0].click();
      const choiceMs = performance.now() - choiceStarted;
      const duplicateChecked = [...choices].every(input => input.checked);
      await new Promise(resolve => requestAnimationFrame(resolve));
      optionObserver.disconnect(); listObserver.disconnect();
      return { optionNodesAdded, listChanges, inputRetained: first === options.querySelector('input'), duplicateChecked, searchTotalMs: searches.reduce((sum, value) => sum + value, 0), searchMaxMs: Math.max(...searches), choiceMs, optionCount: options.querySelectorAll('input').length };
    });
    console.log(`${baseline ? 'BASELINE' : 'OPTIMIZED'} TAG PICKER METRICS ${JSON.stringify(metrics)}`);
    if (!baseline) {
      assert.equal(metrics.optionNodesAdded, 0, 'search and selection reuse option DOM');
      assert.equal(metrics.inputRetained, true, 'search retains checkbox identity');
      assert.equal(metrics.listChanges, 0, 'staged selection/search never rebuild the library');
      assert.equal(metrics.duplicateChecked, true, 'duplicate labels remain synchronized');
    }
    await page.click('#tag-picker-cancel');
    await page.click('#submit-button');
    await page.fill('#record-url', 'https://example.com/new');
    await page.fill('#record-body', '# 新题解');
    await page.locator('#editor-difficulty-picker input[aria-label="Codeforces Rating"]').fill('1600');
    await page.click('#record-tag-open');
    await page.locator('#tag-picker-dialog-options input[value="标签0-0"]').first().check();
    await page.click('#tag-picker-confirm');
    assert.equal(await page.locator('[name="tags"]').inputValue(), '标签0-0');
    await page.click('#publish-button');
    await page.waitForFunction(() => !document.querySelector('#submit-dialog').open);
    assert.equal(await page.evaluate(() => window.tagFixture.uploads.length), 1, 'fixture received one upload');
    assert.deepEqual(await page.evaluate(() => window.tagFixture.uploads[0].tags), ['标签0-0']);
    await page.click('#submit-button');
    const nextTags = await page.locator('[name="tags"]').inputValue();
    console.log(`${baseline ? 'BASELINE' : 'OPTIMIZED'} NEXT NEW RECORD TAGS ${JSON.stringify(nextTags)}`);
    if (baseline) return;
    assert.equal(nextTags, '', 'a new record after upload starts without tags');
    assert.equal(await page.locator('[name="rating"]').inputValue(), '', 'hidden difficulty also resets for the new source');
    assert.equal(await page.locator('#record-tag-selected').innerText(), '');
    await page.click('#record-tag-open');
    assert.equal(await page.locator('#tag-picker-dialog-options input:checked').count(), 0);
    await page.fill('#tag-picker-search', '分类9');
    assert.equal(await page.locator('#tag-picker-dialog-options input:visible').count(), 26, 'category search works without removing other inputs');
    await page.fill('#tag-picker-search', '不存在');
    assert.equal(await page.locator('#tag-picker-dialog-options input:visible').count(), 0);
    assert.match(await page.locator('#tag-picker-dialog-options').innerText(), /没有匹配的标签/);
    await page.fill('#tag-picker-search', '标签0-1');
    await page.locator('#tag-picker-dialog-options input[value="标签0-1"]').check();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[name="tags"]').inputValue(), '', 'Escape cancels staged choices');
    await page.click('#record-tag-open');
    await page.locator('#tag-picker-dialog-options input[value="标签0-1"]').check();
    await page.click('#tag-picker-confirm');
    await page.click('[data-close="submit-dialog"]');
    await page.waitForFunction(() => !document.querySelector('#submit-dialog').open);
    await page.click('#submit-button');
    assert.equal(await page.locator('[name="tags"]').inputValue(), '标签0-1', 'matching account/source draft restores tags');
    assert.match(await page.locator('#draft-hint').innerText(), /已恢复/);
    await page.fill('#record-url', 'https://example.com/local');
    await page.fill('#record-body', '# 本地题解');
    await page.click('#save-local-button');
    await page.waitForFunction(() => !document.querySelector('#submit-dialog').open);
    await page.click('#edit-record-button');
    assert.equal(await page.locator('[name="tags"]').inputValue(), '标签0-1', 'editing a saved record preserves its own tags');
    await page.click('[data-close="submit-dialog"]');
    await page.waitForFunction(() => !document.querySelector('#submit-dialog').open);
    await page.click('#submit-button');
    assert.equal(await page.locator('[name="tags"]').inputValue(), '', 'a new record after local save also starts without tags');
    await page.click('[data-close="submit-dialog"]');
    await page.waitForFunction(() => !document.querySelector('#submit-dialog').open);
    await page.click('#detail-back-button');
    await page.click('#library-public-button');
    await page.locator('.record-card[data-key="d0"]').click();
    await page.click('#edit-record-button');
    assert.equal(await page.locator('[name="tags"]').inputValue(), '标签0-0, 旧标签', 'editing a document uses its own tags and historical labels');
    await page.click('#record-tag-open');
    await page.locator('#tag-picker-dialog-options input[value="标签0-2"]').check();
    await page.click('#tag-picker-confirm');
    await page.click('[data-close="submit-dialog"]');
    await page.waitForFunction(() => !document.querySelector('#submit-dialog').open);
    await page.click('#edit-record-button');
    assert.equal(await page.locator('[name="tags"]').inputValue(), '标签0-0, 旧标签, 标签0-2', 'document edit draft restores its changed tags');
    await page.click('[data-close="submit-dialog"]');
    await page.waitForFunction(() => !document.querySelector('#submit-dialog').open);
    await page.click('#local-solution-button');
    assert.equal(await page.locator('[name="tags"]').inputValue(), '标签0-0, 旧标签', 'problem seed keeps source tags without borrowing document edit draft');
    assert.deepEqual(errors, []);
    console.log('TAG INTERACTION PASS: 262 catalog options, stable DOM, duplicate sync, search/cancel, no global render, upload/new reset, draft restore and local edit');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
