'use strict';
const { appPath } = require('./app-path.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const repo = 'fixture/tags';
      const docs = [{ id:'d1',title:'one',tags:['甲', '旧字符串别名', '用户历史', '1997', '洛谷标签#14'],body:'# one' },{ id:'d2',title:'two',tags:['乙'],body:'# two' }].map(r => ({kind:'document',repo,path:r.id+'.md',sha:'sha',authorId:1,author:'user',problemUrl:'https://example.com',...r}));
      // A stale catalog omits most built-ins and renames a known Luogu ID.
      // New choices keep the bundled name; existing record aliases remain history.
      window.tagFixtureDocuments = docs;
      window.notebook = { bootstrap: async()=>({records:docs,local:{records:[],favorites:[],mastery:{},draft:{}},settings:{autoSync:false},account:{id:1,login:'user'},permissions:{repo,push:true},tagCatalog:{categories:[{id:'2',name:'旧字符串分类',tags:[{id:'2',name:'旧字符串别名'},{id:'a',name:'甲'},{id:'b',name:'乙'},{id:'other',name:'非算法目录测试',type:6},{id:'14',name:'1997',type:2}]}]}}), updateLocal:async()=>{} };
    });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await page.waitForFunction(() => document.querySelector('#count-public').textContent === '2');
    await page.locator('.daily-filter-tags').click();
    assert.equal(await page.locator('#tag-picker-title').innerText(), '选择每日一题算法标签');
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="1997"]').count(), 0, 'daily choices exclude historical official year labels');
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="洛谷标签#14"]').count(), 0, 'daily choices exclude old unresolved Luogu IDs');
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="用户历史"]').count(), 1, 'unclassified custom history stays available');
    await page.locator('#tag-picker-dialog-options input[value="字符串"]').check();
    assert.match(await page.locator('#tag-picker-selected').innerText(), /已选 1 个标签/);
    await page.locator('#tag-picker-search').fill('动态规划');
    assert.equal(await page.getByRole('button', { name: '移除标签 字符串', exact: true }).isVisible(), true, 'selection stays accessible outside filtered options');
    await page.getByRole('button', { name: '移除标签 字符串', exact: true }).click();
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="字符串"]').isChecked(), false);
    assert.equal(await page.locator('#tag-picker-search').inputValue(), '动态规划', 'removal keeps current search');
    await page.locator('#tag-picker-search').fill('');
    await page.locator('#tag-picker-dialog-options input[value="字符串"]').check();
    await page.locator('#tag-picker-dialog-options input[value="动态规划 DP"]').check();
    await page.locator('.tag-picker-clear').click();
    assert.equal(await page.locator('#tag-picker-dialog-options input:checked').count(), 0);
    assert.match(await page.locator('#tag-picker-selected').innerText(), /已选 0 个标签/);
    await page.click('#tag-picker-cancel');
    assert.equal(await page.locator('.daily-filter-tags').innerText(), '算法标签…', 'daily cancel retains the original selection');
    assert.deepEqual(await page.evaluate(() => window.tagFixtureDocuments[0].tags), ['甲', '旧字符串别名', '用户历史', '1997', '洛谷标签#14'], 'daily picker never rewrites source records');
    await page.keyboard.press('/');
    await page.waitForSelector('.record-card');
    assert.match((await page.locator('#tag-filter-trigger').innerText()).trim(), /^标签\s*⌄$/);
    assert.equal(await page.locator('#tag-filter-trigger').evaluate(el => {
      const tag = getComputedStyle(el), platform = getComputedStyle(document.querySelector('#platform-filter summary'));
      return ['padding', 'border-radius', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'background-color'].every(key => tag[key] === platform[key]);
    }), true, 'tag trigger matches platform control styling');
    await page.click('#tag-filter-trigger'); assert.equal(await page.locator('#tag-picker-dialog').evaluate(d=>d.open),true);
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="字符串"]').count(), 1, 'bundled presets survive an incomplete cached catalog');
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="动态规划 DP"]').count(), 1, 'omitted preset categories remain available offline');
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="非算法目录测试"]').count(), 0, 'explicit non-algorithm entries never become new choices');
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="1997"]').count(), 1, 'filter retains a recorded historical year even though it is excluded from the catalog');
    assert.match(await page.locator('#tag-picker-dialog-options label').filter({ has: page.locator('input[value="1997"]') }).innerText(), /历史/, 'official Time ID cannot be reclassified as a new algorithm choice');
    assert.match(await page.locator('#tag-picker-dialog-options label').filter({ has: page.locator('input[value="旧字符串别名"]') }).innerText(), /历史/, 'saved aliases remain historical labels without becoming duplicate algorithm choices');
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="用户历史"]').count(), 1, 'unknown record labels remain available');
    await page.locator('#tag-picker-dialog-options input[value="甲"]').check();
    assert.equal(await page.locator('.record-card').count(),2,'selection is staged until confirm');
    await page.click('#tag-picker-cancel'); assert.equal(await page.locator('.record-card').count(),2);
    await page.click('#tag-filter-trigger'); await page.locator('#tag-picker-dialog-options input[value="乙"]').check(); await page.click('#tag-picker-confirm');
    assert.equal(await page.locator('.record-card').count(),1); assert.equal(await page.locator('.record-card').first().getAttribute('data-key'),'d2');
    await page.click('#tag-filter-trigger');
    assert.equal(await page.getByRole('button', { name: '移除标签 乙', exact: true }).isVisible(), true);
    await page.locator('.tag-picker-clear').click();
    await page.click('#tag-picker-cancel');
    assert.equal(await page.locator('.record-card').count(), 1, 'canceling chip removal preserves applied filter');
    await page.click('#tag-filter-trigger');
    assert.equal(await page.locator('#tag-picker-dialog-options input[value="乙"]').isChecked(), true);
    await page.click('#tag-picker-cancel');
    await page.click('#clear-filters'); await page.click('#submit-button');
    await page.click('#record-tag-open'); await page.locator('#tag-picker-dialog-options input[value="甲"]').check(); await page.click('#tag-picker-close');
    assert.equal(await page.locator('[name="tags"]').inputValue(),'','close cancels editor selections');
    await page.click('#record-tag-open'); await page.locator('#tag-picker-search').fill('乙'); assert.equal(await page.locator('#tag-picker-dialog-options input:visible').count(),1); await page.locator('#tag-picker-dialog-options input[value="乙"]').check(); await page.click('#tag-picker-confirm');
    assert.equal(await page.locator('[name="tags"]').inputValue(),'乙'); assert.deepEqual(errors,[]);
    console.log('TAG PICKER PASS: dialog, category search, multi-select, cancel/close rollback, confirm applies to filter/editor');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
