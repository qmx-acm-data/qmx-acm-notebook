'use strict';
// Run after pnpm build:app: node tests/clist-settings-ui-smoke.cjs
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
    page.setDefaultTimeout(8000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route(/^https?:/, route => route.abort());
    await page.addInitScript(() => {
      const fixture = window.clistFixture = { calls: [], status: { configured: false, username: null }, failSave: false, failClear: false, failStatus: false };
      window.notebook = {
        bootstrap: async () => ({ records: [], issues: [], account: null, authStatus: { status: 'anonymous' }, permissions: { push: false, admin: false }, settings: { autoSync: false }, local: { records: [], favorites: [], mastery: {}, draft: {} } }),
        getClistStatus: async () => {
          if (fixture.failStatus) throw new Error('fixture status failure');
          return { ...fixture.status, apiKey: 'fictional-status-key' };
        },
        saveClistCredentials: async input => {
          fixture.calls.push({ method: 'save', ...input });
          if (fixture.failSave) throw new Error('fixture save failure');
          fixture.status = { configured: true, username: input.username };
        },
        clearClistCredentials: async () => {
          fixture.calls.push({ method: 'clear' });
          if (fixture.failClear) throw new Error('fixture clear failure');
          fixture.status = { configured: false, username: null };
        }
      };
    });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await page.locator('.sidebar').hover();
    await page.locator('#account-button').click();
    const status = page.locator('#clist-status');
    const username = page.locator('#clist-username');
    const key = page.locator('#clist-api-key');
    const error = page.locator('#clist-error');
    const save = page.locator('#clist-save-button');
    const clear = page.locator('#clist-clear-button');
    await page.waitForFunction(() => document.querySelector('#clist-status').textContent === '未配置');
    assert.equal(await key.getAttribute('type'), 'password');

    await username.fill('  fictional-user  ');
    await key.fill('fictional-save-key');
    await save.click();
    await page.waitForFunction(() => document.querySelector('#clist-status').textContent === '已配置 · fictional-user');
    assert.deepEqual(await page.evaluate(() => window.clistFixture.calls[0]), { method: 'save', username: 'fictional-user', apiKey: 'fictional-save-key' });
    assert.equal(await key.inputValue(), '');
    assert.equal(await username.inputValue(), 'fictional-user');
    assert.doesNotMatch(await status.innerText(), /fictional-(save|status)-key/);
    assert.equal(await error.isVisible(), false);

    await page.evaluate(() => { window.clistFixture.failSave = true; });
    await key.fill('fictional-failed-key');
    await save.click();
    await page.waitForFunction(() => document.querySelector('#clist-error').textContent === 'fixture save failure');
    assert.equal(await key.inputValue(), '');
    assert.equal(await save.isEnabled(), true);
    assert.equal(await status.innerText(), '已配置 · fictional-user');
    assert.equal(await error.isVisible(), true);

    await page.evaluate(() => { window.clistFixture.failClear = true; });
    await key.fill('fictional-clear-failure-key');
    await clear.click();
    await page.waitForFunction(() => document.querySelector('#clist-error').textContent === 'fixture clear failure');
    assert.equal(await key.inputValue(), '');
    assert.equal(await clear.isEnabled(), true);
    assert.equal(await status.innerText(), '已配置 · fictional-user');

    await page.evaluate(() => { window.clistFixture.failClear = false; });
    await key.fill('fictional-clear-key');
    await clear.click();
    await page.waitForFunction(() => document.querySelector('#clist-status').textContent === '未配置');
    assert.equal(await key.inputValue(), '');
    assert.equal(await username.inputValue(), '');
    assert.equal(await error.isVisible(), false);
    assert.equal(await page.evaluate(() => window.clistFixture.calls.filter(call => call.method === 'clear').length), 2);

    await key.fill('fictional-validation-key');
    await save.click();
    assert.equal(await key.inputValue(), '');
    assert.match(await error.innerText(), /请输入/);
    assert.equal(await page.evaluate(() => window.clistFixture.calls.filter(call => call.method === 'save').length), 2);

    await key.fill('fictional-close-key');
    await page.locator('[data-close="account-dialog"]').click();
    await page.waitForSelector('#account-dialog', { state: 'hidden' });
    assert.equal(await key.inputValue(), '');
    await page.evaluate(() => { window.clistFixture.failStatus = true; });
    await page.locator('.sidebar').hover();
    await page.locator('#account-button').click();
    await page.waitForFunction(() => document.querySelector('#clist-status').textContent === '状态不可用');
    assert.doesNotMatch(await status.innerText(), /fictional/);
    assert.deepEqual(pageErrors, []);
    console.log('CLIST settings UI smoke passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
