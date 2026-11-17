'use strict';
// Run after pnpm build:app: node tests/author-avatar-ui-smoke.cjs.
// Built renderer + isolated bridge fixtures; all HTTP requests are intercepted.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

const tinyPNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=';
const cacheData = `data:image/png;base64,${tinyPNG}`;
const githubAvatar = id => `https://avatars.githubusercontent.com/u/${id}?s=64`;
const row = (page, id) => page.locator(`#record-list .record-card[data-key="${id}"]`);

async function author(cell, name, source = null) {
  assert.equal(await cell.locator('.record-author-name').innerText(), name, 'author name is rendered literally');
  const avatar = cell.locator('.mini-avatar');
  assert.equal(await avatar.count(), 1);
  assert.equal(await avatar.getAttribute('aria-hidden'), 'true');
  assert.equal(await avatar.evaluate(node => node.firstChild.textContent), name.slice(0, 1), 'initial remains beneath an image and after load failure');
  const image = avatar.locator('img');
  if (source) {
    assert.equal(await image.count(), 1, `${name}: image exists`);
    assert.equal(await image.getAttribute('src'), source, `${name}: avatar derives from strict identity or account cache`);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate(node => node.decode());
    assert.ok(await image.evaluate(node => node.complete && node.naturalWidth === 1 && node.naturalHeight === 1), `${name}: deterministic tiny PNG loaded`);
    assert.equal(await image.getAttribute('alt'), '');
    assert.equal(await image.getAttribute('referrerpolicy'), 'no-referrer');
  } else {
    assert.equal(await image.count(), 0, `${name}: initial fallback has no image`);
  }
}

async function detail(page, id, name, source = null) {
  assert.equal(await row(page, id).evaluate(node => node.classList.contains('problem-list-row')), true);
  await row(page, id).click();
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('reading-detail')), true);
  assert.equal(await page.locator('#open-detail-button').count(), 0, 'public and local rows enter focused detail directly');
  await author(page.locator('#detail-panel .author-row'), name, source);
  await page.locator('#detail-back-button').click();
}

async function switchRepository(page, id, expected) {
  await page.locator('#repo-select').selectOption(id);
  await page.waitForFunction(({ id, expected }) => document.querySelector('#repo-select').value === id && !document.querySelector('#repo-select').disabled && document.querySelectorAll('#record-list .problem-list-row').length === expected, { id, expected });
}

async function openPage(browser, cached = false) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const errors = [], avatarRequests = [], otherRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:\/\//, async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://avatars.githubusercontent.com') {
      avatarRequests.push(url.href);
      if (url.pathname === '/u/404') return route.abort('failed');
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(tinyPNG, 'base64') });
    }
    otherRequests.push(url.href);
    return route.abort('blockedbyclient');
  });
  await page.addInitScript(({ cached, cacheData }) => {
    const repo = 'fixture/author-avatars', customServer = 'https://gitea.fixture.invalid';
    const repositories = [{ id: 'github', name: 'GitHub', repo, serverUrl: '' }, { id: 'custom', name: 'Custom', repo, serverUrl: customServer }];
    let settings = { repo, repositories, activeRepoId: 'github', serverUrl: '', autoSync: false };
    let account = { id: 101, login: 'current-login', name: '账号显示名', ...(cached ? { avatarData: cacheData } : {}) };
    const base = { kind: 'document', repo, serverUrl: '', platform: 'CF', pid: '1900A', tags: ['基础'], body: '# 头像测试\n\n验证作者显示。', problemUrl: 'https://codeforces.com/problemset/problem/1900/A', updatedAt: '2026-11-15T08:00:00Z', sha: 'fixture-sha' };
    const document = (id, extra) => ({ ...base, id, title: id, path: `${id}.md`, ...extra });
    const records = [
      document('public-number', { authorId: 201, author: { name: '林同学', login: 'lin-user', avatar_url: 'https://evil.fixture.invalid/ignored.png' }, avatarUrl: 'https://evil.fixture.invalid/ignored-top.png' }),
      document('public-string', { authorId: '202', author: { login: 'login-only' } }),
      document('public-login', { author: 'github-user' }),
      document('public-invalid-id-login', { authorId: '0203', author: { name: '严格登录名', login: 'valid-user' } }),
      document('public-failure', { authorId: 404, author: '失败作者' }),
      document('public-url', { authorId: 'https://evil.fixture.invalid/id.png', author: 'https://evil.fixture.invalid/author.png', avatarUrl: 'https://evil.fixture.invalid/avatar.png' }),
      document('public-malicious-login', { authorId: '../101', author: { name: '<img src=x onerror="window.avatarUnsafe=true">', login: 'https://evil.fixture.invalid/login.png', avatar_url: 'https://evil.fixture.invalid/object.png' } }),
      document('public-unsafe-integer', { authorId: 9007199254740992, author: '数字边界' }),
      document('public-reserved-login', { authorId: 0, author: 'anonymous' }),
      document('public-double-hyphen', { author: 'invalid--login' }),
      document('custom-source', { authorId: 101, author: { name: '自建源作者', login: 'current-login' }, serverUrl: customServer, sourceKey: `${customServer}|${repo}` }),
      document('custom-legacy', { authorId: '101', author: '自建源旧作者', serverUrl: customServer }),
      document('custom-missing', { authorId: 101, serverUrl: customServer, sourceKey: `${customServer}|${repo}` }),
      document('custom-blank', { authorId: '101', author: '', serverUrl: customServer })
    ];
    const localRecord = (id, extra) => ({ ...base, id, clientId: `client-${id}`, kind: 'local', title: id, pid: id, problemUrl: `https://codeforces.com/fixture/${id}`, ...extra });
    const fixture = window.authorAvatarFixture = {
      local: { records: [
        localRecord('local-unbound', { ownerId: null }),
        localRecord('local-explicit', { ownerId: '101', author: { name: '本地作者', login: 'former-login' } }),
        localRecord('local-missing', { ownerId: 101 }),
        localRecord('local-foreign', { ownerId: 999, author: '他人私有作者' })
      ], favorites: [], mastery: {}, draft: {} },
      writes: 0, remoteWrites: 0, logouts: 0
    };
    const payload = () => structuredClone({ records, issues: [], settings, account, local: fixture.local, authStatus: { status: account ? 'verified' : 'anonymous' }, permissions: { repo, push: false, admin: false } });
    window.notebook = {
      bootstrap: async () => payload(), sync: async () => payload(),
      saveSettings: async input => {
        settings = { ...settings, ...input };
        const active = repositories.find(item => item.id === settings.activeRepoId);
        settings.repo = active.repo; settings.serverUrl = active.serverUrl;
        return payload();
      },
      updateLocal: async data => { fixture.writes++; fixture.local = structuredClone(data); },
      saveDocument: async () => { fixture.remoteWrites++; throw Error('Avatar fixture must not publish'); },
      logout: async () => { fixture.logouts++; account = null; },
      openExternal: async () => {}, onAuthProgress: () => () => {}, onUpdateProgress: () => () => {}
    };
  }, { cached, cacheData });
  await page.goto(pathToFileURL(appPath('ui/index.html')).href);
  await page.locator('.rail-nav-item[data-view="public"]').click();
  await page.mouse.move(500, 100);
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  await page.locator('#library-public-button').click();
  await page.waitForFunction(() => document.querySelectorAll('#record-list .problem-list-row').length === 10);
  return { page, errors, avatarRequests, otherRequests };
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const main = await openPage(browser);
    const { page } = main;
    const publicCases = [
      ['public-number', '林同学', githubAvatar(201)],
      ['public-string', 'login-only', githubAvatar(202)],
      ['public-login', 'github-user', 'https://avatars.githubusercontent.com/github-user?s=64'],
      ['public-invalid-id-login', '严格登录名', 'https://avatars.githubusercontent.com/valid-user?s=64'],
      ['public-url', 'https://evil.fixture.invalid/author.png', null],
      ['public-malicious-login', '<img src=x onerror="window.avatarUnsafe=true">', null],
      ['public-unsafe-integer', '数字边界', null],
      ['public-reserved-login', 'anonymous', null],
      ['public-double-hyphen', 'invalid--login', null]
    ];
    for (const [id, name, source] of publicCases) {
      const cell = row(page, id).locator('.problem-author');
      await author(cell, name, source);
      assert.equal(await cell.getAttribute('title'), name);
      assert.equal(await cell.getAttribute('aria-label'), `作者 ${name}`);
      await detail(page, id, name, source);
    }
    // Failure is a real intercepted request error; allow the image error event to remove it.
    await row(page, 'public-failure').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector('[data-key="public-failure"] .mini-avatar img'));
    await author(row(page, 'public-failure').locator('.problem-author'), '失败作者');
    await row(page, 'public-failure').click();
    await page.waitForFunction(() => !document.querySelector('#detail-panel .author-row img'));
    await author(page.locator('#detail-panel .author-row'), '失败作者');
    assert.ok(main.avatarRequests.includes(githubAvatar(404)), 'load failure exercised the network error handler');
    assert.equal(await page.evaluate(() => window.avatarUnsafe), undefined, 'malicious author remains literal text');
    await page.locator('#detail-back-button').click();
    assert.equal(await page.locator('#record-list script, #record-list .record-author-name img').count(), 0);

    await switchRepository(page, 'custom', 4);
    assert.equal(await page.locator('#record-list .problem-list-row').count(), 4);
    for (const [id, name] of [['custom-source', '自建源作者'], ['custom-legacy', '自建源旧作者'], ['custom-missing', '匿名学习者'], ['custom-blank', '匿名学习者']]) {
      const target = page.locator('#record-list .record-card').filter({ has: page.locator('.card-title', { hasText: id }) });
      await author(target.locator('.problem-author'), name);
      await target.click();
      await author(page.locator('#detail-panel .author-row'), name);
      await page.locator('#detail-back-button').click();
    }
    assert.equal(main.avatarRequests.some(url => url === githubAvatar(101)), false, 'custom-source numeric collision never requests the GitHub account avatar');
    await switchRepository(page, 'github', 10);
    await page.locator('#library-local-button').click();
    assert.equal(await page.locator('#record-list .record-card').count(), 3);
    assert.equal(await row(page, 'local-foreign').count(), 0);
    assert.equal(await page.locator('#record-list .problem-list-row').count(), 3, 'local solutions use the same compact rows as public problems');
    await author(row(page, 'local-unbound').locator('.problem-author'), '本地学习者');
    await detail(page, 'local-unbound', '本地学习者');
    await author(row(page, 'local-explicit').locator('.problem-author'), '本地作者', githubAvatar(101));
    await detail(page, 'local-explicit', '本地作者', githubAvatar(101));
    await author(row(page, 'local-missing').locator('.problem-author'), 'current-login', githubAvatar(101));
    await detail(page, 'local-missing', 'current-login', githubAvatar(101));
    assert.equal(await page.evaluate(() => window.authorAvatarFixture.writes), 0, 'displaying fallback metadata never mutates a record');

    // Save through the real local editor: new records persist account login metadata.
    await page.locator('#library-public-button').click();
    await row(page, 'public-number').click();
    await page.locator('#local-solution-button').click();
    await page.locator('#record-body').fill('这是本账号新保存的本地题解。');
    await page.locator('#save-local-button').click();
    await page.waitForSelector('#submit-dialog', { state: 'hidden' });
    const created = await page.evaluate(() => window.authorAvatarFixture.local.records.find(record => record.sourceProblemId === 'public-number'));
    assert.ok(created, 'new local record was persisted');
    assert.equal(String(created.ownerId), '101');
    assert.equal(created.author, 'current-login', 'new save records account login rather than display name or source author');
    await author(page.locator('#detail-panel .author-row'), 'current-login', githubAvatar(101));
    await page.locator('#detail-back-button').click();
    await page.locator('#library-local-button').click();
    await author(row(page, created.id).locator('.problem-author'), 'current-login', githubAvatar(101));

    // Cached account avatars apply to an owned legacy record, never to unbound locals or custom sources.
    const cached = await openPage(browser, true);
    await switchRepository(cached.page, 'custom', 4);
    for (const target of await cached.page.locator('#record-list .record-card').all()) {
      assert.equal(await target.locator('.mini-avatar img').count(), 0, 'custom source collision cannot use the account cache');
      await target.click();
      assert.equal(await cached.page.locator('#detail-panel .author-row img').count(), 0);
      await cached.page.locator('#detail-back-button').click();
    }
    await switchRepository(cached.page, 'github', 10);
    await cached.page.locator('#library-local-button').click();
    await author(row(cached.page, 'local-unbound').locator('.problem-author'), '本地学习者');
    await detail(cached.page, 'local-unbound', '本地学习者');
    await author(row(cached.page, 'local-missing').locator('.problem-author'), 'current-login', cacheData);
    await detail(cached.page, 'local-missing', 'current-login', cacheData);
    await row(cached.page, 'local-missing').click();
    await cached.page.locator('#edit-record-button').click();
    await cached.page.locator('#record-body').fill('旧本地记录保存后补齐作者登录名。');
    await cached.page.locator('#save-local-button').click();
    await cached.page.waitForSelector('#submit-dialog', { state: 'hidden' });
    assert.equal(await cached.page.evaluate(() => window.authorAvatarFixture.local.records.find(record => record.id === 'local-missing').author), 'current-login');
    await author(cached.page.locator('#detail-panel .author-row'), 'current-login', cacheData);

    // Actual logout UI hides every bound local, including the record just saved.
    await page.locator('.sidebar-rail').hover();
    await page.locator('#account-button').click();
    await page.locator('#account-logout').click();
    await page.waitForFunction(() => document.querySelector('#account-details').textContent.includes('未登录'));
    await page.locator('[data-close="account-dialog"]').click();
    assert.deepEqual(await page.locator('#record-list .record-card').evaluateAll(nodes => nodes.map(node => node.dataset.key)), ['local-unbound']);
    await author(row(page, 'local-unbound').locator('.problem-author'), '本地学习者');
    await row(page, 'local-unbound').click();
    await author(page.locator('#detail-panel .author-row'), '本地学习者');
    assert.equal(await page.evaluate(() => window.authorAvatarFixture.logouts), 1);
    for (const result of [main, cached]) {
      assert.deepEqual(result.errors, []);
      assert.deepEqual(result.otherRequests, [], 'author metadata never causes arbitrary external requests');
      assert.equal(await result.page.evaluate(() => window.authorAvatarFixture.remoteWrites), 0, 'local saves never publish');
    }
    console.log('AUTHOR AVATAR UI PASS: public/local compact rows and direct focused detail, strict GitHub ID/login derivation, deterministic PNG loads and error-to-initial fallback, escaped malicious metadata/no external URLs, custom-source ID collisions/cache isolation, unbound local isolation, new-save and legacy-owned account login metadata, cached avatarData, logout hides bound local records, no remote writes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
