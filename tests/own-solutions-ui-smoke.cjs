'use strict';
// Run after pnpm build:app. Exercises the built renderer with isolated fixtures;
// no account credentials, network access or production repository writes.
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');

async function expectRows(page, titles, total = titles.length) {
  const rows = page.locator('#record-list .record-card.problem-list-row');
  await page.waitForFunction(expected => document.querySelector('#result-count').textContent === String(expected), titles.length);
  assert.deepEqual((await rows.locator('.card-title').allTextContents()).sort(), [...titles].sort());
  assert.equal(await page.locator('#library-local-count').innerText(), String(total), 'scope count uses the same ownership rules before user filters');
  const keys = await rows.evaluateAll(nodes => nodes.map(node => node.dataset.key));
  assert.equal(new Set(keys).size, keys.length, 'a document included in own solutions appears only once');
  assert.equal(await page.locator('#library-panel.public-problem-list').count(), 1, 'own scope shares library row styling');
  assert.deepEqual(await page.locator('.problem-list-columns > span').allTextContents(), ['平台', '题号', '算法标签', '题目', '难度', '作者', '更新']);
  assert.equal(await rows.locator(':scope > *').count(), titles.length * 7, 'every own row has seven cells');
  assert.equal(await rows.locator('.problem-author .record-author-name').count(), titles.length, 'every own row retains its author name');
  assert.equal(await page.locator('#record-list .card-meta, #record-list .card-footer, #record-list .card-state').count(), 0, 'own rows omit old card-only metadata');
  assert.equal(await page.locator('#detail-panel').isVisible(), false, 'own list has no preview');
  assert.equal(await page.locator('#detail-panel').textContent(), '', 'own list does not render a hidden preview');
  assert.equal(await page.locator('.problem-list-row.selected, .problem-list-row[aria-pressed]').count(), 0, 'own rows have no automatic selection');
}

async function ownGeometry(page, width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const geometry = await page.evaluate(() => {
    const list = document.querySelector('#record-list'), headers = [...document.querySelector('.problem-list-columns').children];
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height }; };
    return {
      page: document.documentElement.scrollWidth, viewport: innerWidth, client: list.clientWidth, scroll: list.scrollWidth,
      overflow: getComputedStyle(list).overflowX, headers: headers.map(rect),
      rows: [...list.querySelectorAll('.problem-list-row')].map(row => ({
        rect: rect(row), radius: getComputedStyle(row).borderRadius, cells: [...row.children].map(rect),
        author: rect(row.querySelector('.problem-author .record-author-name')),
        authorDisplay: getComputedStyle(row.querySelector('.problem-author')).display,
        authorVisibility: getComputedStyle(row.querySelector('.problem-author')).visibility
      }))
    };
  });
  assert.ok(geometry.page <= geometry.viewport + 1, `${width}: own list never overflows the page`);
  assert.equal(geometry.rows.length, 5, `${width}: all owned and visible local rows remain present`);
  for (const row of geometry.rows) {
    assert.equal(row.radius, '0px');
    assert.equal(row.cells.length, 7);
    if (width === 1440) assert.ok(row.rect.height >= 38 && row.rect.height <= 46, 'own rows share compact desktop height');
    assert.ok(row.author.width > 0 && row.author.height > 0 && row.authorDisplay !== 'none' && row.authorVisibility === 'visible', 'own row author remains displayed');
    for (let index = 0; index < 7; index++) {
      assert.ok(Math.abs(row.cells[index].x - geometry.headers[index].x) <= 1, `${width}: own column ${index} aligns with header`);
      assert.ok(Math.abs(row.cells[index].width - geometry.headers[index].width) <= 1, `${width}: own column ${index} shares header width`);
    }
  }
  if (width < 1000) {
    assert.ok(geometry.scroll > geometry.client + 1, `${width}: own table has genuine horizontal scrolling`);
    assert.match(geometry.overflow, /auto|scroll/);
    const author = await page.evaluate(() => {
      const list = document.querySelector('#record-list'); list.scrollLeft = list.scrollWidth;
      const bounds = list.getBoundingClientRect(), name = list.querySelector('.problem-author .record-author-name').getBoundingClientRect();
      const result = { left: name.left, right: name.right, listLeft: bounds.left, listRight: bounds.right };
      list.scrollLeft = 0; return result;
    });
    assert.ok(author.left >= author.listLeft - 1 && author.right <= author.listRight + 1, `${width}: horizontal scrolling reaches the author name`);
  } else assert.ok(geometry.scroll <= geometry.client + 1, 'desktop own table fits its workspace');
}

async function clickBack(page, key, title, { narrow = false, readOnly = false } = {}) {
  const row = page.locator(`.problem-list-row[data-key="${key}"]`), target = row.locator('.card-title');
  await target.scrollIntoViewIfNeeded();
  const position = () => page.evaluate(() => ({ window: scrollY, list: document.querySelector('#record-list').scrollTop, horizontal: document.querySelector('#record-list').scrollLeft }));
  const before = await position();
  if (narrow) assert.ok(before.horizontal > 0, 'narrow own title interaction starts with real horizontal scrolling');
  await target.click();
  assert.equal(await page.locator('body').evaluate(node => node.classList.contains('reading-detail')), true, 'own title opens focused reading directly');
  assert.equal(await page.locator('#detail-panel .detail-title').innerText(), title);
  assert.equal(await page.locator('.record-list-panel').isVisible(), false, 'focused own reader hides the list');
  assert.equal(await page.locator('#open-detail-button').count(), 0, 'own reader needs no intermediate preview action');
  assert.equal(await page.locator('#detail-back-button').evaluate(node => node === document.activeElement), true, 'own back button receives focus');
  if (readOnly) assert.equal(await page.locator('#edit-record-button').isVisible(), false, 'read-only own documents are included without granting push/edit permission');
  await page.locator('#detail-back-button').click();
  const after = await position();
  for (const axis of ['window', 'list', 'horizontal']) assert.ok(Math.abs(after[axis] - before[axis]) <= 1, `own back restores ${axis} position`);
  assert.equal(await row.evaluate(node => node === document.activeElement), true, 'own back restores originating row focus');
  assert.equal(await page.locator('#detail-panel').isVisible(), false);
  assert.equal(await page.locator('#detail-panel').textContent(), '');
}

async function filterAuthor(page, name, titles, total) {
  await page.locator('#author-filter summary').click();
  await page.locator('#author-filter input[type="checkbox"]:visible').evaluateAll((nodes, author) => {
    const choice = nodes.find(node => node.value === author);
    if (!choice) throw Error(`Missing author option: ${author}`);
    choice.click();
  }, name);
  await expectRows(page, titles, total);
  assert.deepEqual(await page.locator('#record-list .record-card .record-author-name').allTextContents(), titles.map(() => name), 'row author agrees with the active author facet');
  await page.locator('#clear-filters').click();
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, route => route.abort());
    await page.addInitScript(() => {
      const repo = 'fixture/own-solutions';
      const otherRepo = 'fixture/other-solutions';
      const customServer = 'https://gitea.fixture.invalid';
      const repositories = [
        { id: 'github', name: 'GitHub', repo, serverUrl: '' },
        { id: 'other', name: '另一仓库', repo: otherRepo, serverUrl: '' },
        { id: 'custom', name: '自建源', repo, serverUrl: customServer }
      ];
      let settings = { repositories, activeRepoId: 'github', repo, serverUrl: '', autoSync: false };
      let account = { id: 101, login: 'renamed-user', name: '当前姓名' };
      const base = { kind: 'document', repo, sourceKey: `https://api.github.com|${repo}`, platform: 'CF', pid: '100A', tags: ['基础'], body: '# 思路\n\n边界验证。', updatedAt: '2026-11-15T08:00:00Z', sha: 'fixture-sha' };
      const doc = (id, title, extra = {}) => ({ ...base, id, title, path: `${id}.md`, ...extra });
      const records = [
        doc('mine-number', '数字 ID 本人题解', { authorId: 101, author: { login: 'before-rename', name: '历史昵称' } }),
        doc('mine-string', '字符串 ID 本人题解', { authorId: '101', author: '保留作者' }),
        doc('other-user', '同登录名他人题解', { authorId: 202, author: { login: 'renamed-user', name: '另一位作者' } }),
        doc('missing-id', '仅登录名不得冒认', { author: 'renamed-user' }),
        doc('padded-id', '不同数字字符串不得冒认', { authorId: '0101', author: 'renamed-user' }),
        doc('foreign-repo', '另一仓库本人题解', { repo: otherRepo, sourceKey: `https://api.github.com|${otherRepo}`, authorId: 101, author: '跨仓库作者' }),
        doc('custom-source', '自建源数字碰撞', { authorId: 101, author: '自建作者', serverUrl: customServer, sourceKey: `${customServer}|${repo}` }),
        doc('custom-legacy', '自建源旧记录碰撞', { authorId: '101', author: '自建作者', serverUrl: customServer, sourceKey: undefined })
      ];
      const local = {
        records: [
          { ...base, id: 'unbound', kind: 'local', ownerId: null, title: '未绑定本机题解' },
          { ...base, id: 'local-a', kind: 'local', ownerId: 101, title: '本人本地显式作者', author: { login: 'before-rename', name: '小林' } },
          { ...base, id: 'local-a-fallback', kind: 'local', ownerId: '101', title: '本人本地缺失作者' },
          { ...base, id: 'local-b', kind: 'local', ownerId: '202', title: '另一账号本地题解', author: '另一账号' }
        ], favorites: [], mastery: {}, draft: {}
      };
      const payload = () => structuredClone({ records, issues: [{ ...base, kind: 'issue', id: 'issue-mine', title: '讨论不能作为题解', authorId: 101 }], settings, account, local, authStatus: { status: account ? 'verified' : 'anonymous' }, permissions: { repo: settings.repo, push: false, admin: false } });
      const fixture = window.ownSolutionsFixture = { nextAccount: null, writes: 0, syncs: 0, logins: 0, logouts: 0 };
      window.notebook = {
        bootstrap: async () => payload(),
        sync: async () => { fixture.syncs++; return payload(); },
        refreshAccount: async () => { account = structuredClone(fixture.nextAccount); return payload(); },
        logout: async () => { fixture.logouts++; account = null; },
        login: async () => { fixture.logins++; account = structuredClone(fixture.nextAccount); },
        saveSettings: async input => {
          settings = { ...settings, ...input };
          const active = repositories.find(item => item.id === settings.activeRepoId);
          settings.repo = active.repo; settings.serverUrl = active.serverUrl;
          return payload();
        },
        updateLocal: async () => { fixture.writes++; },
        saveDocument: async () => { fixture.writes++; throw Error('Unexpected document write'); },
        openExternal: async () => {}, onAuthProgress: () => () => {}, onUpdateProgress: () => () => {}
      };
    });
    await page.goto(pathToFileURL(appPath('ui/index.html')).href);
    await page.locator('.rail-nav-item[data-view="public"]').click();
    await page.locator('#library-local-button').click();
    const ownA = ['数字 ID 本人题解', '字符串 ID 本人题解', '未绑定本机题解', '本人本地显式作者', '本人本地缺失作者'];
    await expectRows(page, ownA);
    await filterAuthor(page, '小林', ['本人本地显式作者'], 5);
    await filterAuthor(page, '历史昵称', ['数字 ID 本人题解'], 5);
    await filterAuthor(page, 'renamed-user', ['本人本地缺失作者'], 5);
    await filterAuthor(page, '本地学习者', ['未绑定本机题解'], 5);
    await ownGeometry(page, 1440);
    await page.locator('#search-input').fill('数字 ID');
    await expectRows(page, ['数字 ID 本人题解'], 5);
    await clickBack(page, 'https://api.github.com|fixture/own-solutions:mine-number', '数字 ID 本人题解', { readOnly: true });
    assert.equal(await page.locator('#search-input').inputValue(), '数字 ID', 'own search survives focused reading and back');
    await expectRows(page, ['数字 ID 本人题解'], 5);
    await page.locator('#clear-filters').click();
    for (const width of [768, 390]) await ownGeometry(page, width);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#search-input').fill('本人本地显式');
    await page.locator('#author-filter summary').click();
    await page.locator('#author-filter input[value="小林"]').check();
    await page.locator('#author-filter summary').click();
    await expectRows(page, ['本人本地显式作者'], 5);
    await page.setViewportSize({ width: 390, height: 844 });
    await clickBack(page, 'local-a', '本人本地显式作者', { narrow: true });
    assert.equal(await page.locator('#search-input').inputValue(), '本人本地显式', 'local search survives focused reading and back');
    assert.match(await page.locator('#active-filters').innerText(), /小林/, 'local author filter survives focused reading and back');
    assert.equal(await page.locator('#library-local-button').getAttribute('aria-pressed'), 'true', 'back preserves own scope');
    await expectRows(page, ['本人本地显式作者'], 5);
    await page.locator('#clear-filters').click();
    await page.setViewportSize({ width: 1440, height: 1000 });

    // Use the real account-switch UI. Numeric identity survives login/name changes.
    await page.evaluate(() => { window.ownSolutionsFixture.nextAccount = { id: '101', login: 'renamed-again', name: '新的姓名' }; });
    await page.locator('.sidebar-rail .sidebar-bottom').click();
    await page.locator('#account-switch').click();
    await page.waitForFunction(() => document.querySelector('#account-details').textContent.includes('renamed-again') && !document.querySelector('#auth-dialog').open);
    await page.locator('[data-close="account-dialog"]').click();
    await expectRows(page, ownA);
    await filterAuthor(page, 'renamed-again', ['本人本地缺失作者'], 5);
    await filterAuthor(page, '历史昵称', ['数字 ID 本人题解'], 5);
    await page.evaluate(() => { window.ownSolutionsFixture.nextAccount = { id: 202, login: 'renamed-user', name: '另一账号' }; });
    await page.locator('.sidebar-rail .sidebar-bottom').click();
    await page.locator('#account-switch').click();
    await page.waitForFunction(() => document.querySelector('#account-details').textContent.includes('202') && !document.querySelector('#auth-dialog').open);
    await page.locator('[data-close="account-dialog"]').click();
    await expectRows(page, ['同登录名他人题解', '未绑定本机题解', '另一账号本地题解']);

    // Logout leaves only unbound device-local records visible.
    await page.locator('.sidebar-rail .sidebar-bottom').click();
    await page.locator('#account-logout').click();
    await page.waitForFunction(() => document.querySelector('#account-details').textContent.includes('未登录'));
    await page.locator('[data-close="account-dialog"]').click();
    await expectRows(page, ['未绑定本机题解']);
    await filterAuthor(page, '本地学习者', ['未绑定本机题解'], 1);

    await page.evaluate(() => { window.ownSolutionsFixture.nextAccount = { id: 101, login: 'renamed-user', name: '当前姓名' }; });
    await page.locator('.sidebar-rail .sidebar-bottom').click();
    await page.locator('#account-login').click();
    await page.waitForFunction(() => document.querySelector('#account-details').textContent.includes('101') && !document.querySelector('#auth-dialog').open);
    await page.locator('[data-close="account-dialog"]').click();
    await expectRows(page, ownA);
    await page.locator('#repo-select').selectOption('other');
    await expectRows(page, ['另一仓库本人题解', '未绑定本机题解', '本人本地显式作者', '本人本地缺失作者']);
    await page.locator('#repo-select').selectOption('custom');
    await expectRows(page, ['未绑定本机题解', '本人本地显式作者', '本人本地缺失作者']);
    await page.locator('#library-public-button').click();
    assert.deepEqual((await page.locator('#record-list .card-title').allTextContents()).sort(), ['自建源数字碰撞', '自建源旧记录碰撞'].sort(), 'custom source records still exist in their public scope');
    await page.locator('#library-local-button').click();
    await expectRows(page, ['未绑定本机题解', '本人本地显式作者', '本人本地缺失作者']);
    await page.locator('#repo-select').selectOption('github');
    await expectRows(page, ownA);
    assert.equal(await page.evaluate(() => window.ownSolutionsFixture.writes), 0, 'view, account and source switches never save or upload records');
    assert.equal(await page.evaluate(() => window.ownSolutionsFixture.logins), 3);
    assert.equal(await page.evaluate(() => window.ownSolutionsFixture.logouts), 3);
    assert.deepEqual(errors, []);
    console.log('OWN SOLUTIONS UI PASS: visible local + own read-only documents, count parity, numeric/string identity and rename, account switch/logout, no login impersonation, current-repo/source isolation including Gitea ID collisions, no duplicate rows, seven aligned compact columns with author names, direct document/local reading and filter/focus/scroll restoration, 390/768 horizontal table scrolling, shared author facets and no writes');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
