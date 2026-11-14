'use strict';

const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { appPath } = require('./app-path.cjs');

const builtAppRoot = appPath('');

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-planner-check-'));
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ autoSync: false }));
  const env = { ...process.env, QMX_USER_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = () => electron.launch({
    executablePath: process.env.QMX_PREVIEW_EXE || require('electron'),
    args: process.env.QMX_PREVIEW_EXE ? ['--disable-gpu'] : [builtAppRoot, '--disable-gpu'],
    env
  });
  const errors = [];
  const firstWindow = async app => {
    const page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    return page;
  };

  let app = await launch();
  try {
    let page = await firstWindow(app);
    await page.waitForSelector('.planner-problems');
    if (!process.env.QMX_PREVIEW_EXE) {
      assert.equal(
        path.resolve(await app.evaluate(({ app }) => app.getAppPath())),
        builtAppRoot,
        'native smoke launches the compiled application'
      );
    }
    assert.equal(
      (await page.evaluate(() => window.notebook.bootstrap())).appVersion,
      require('../package.json').version
    );

    // Quick add and duplicate validation must keep the unsaved draft.
    const problemURL = 'https://www.luogu.com.cn/problem/P3372';
    await page.fill('.planner-add-problems [name=url]', problemURL);
    await page.locator('.planner-add-problems').evaluate(form => form.requestSubmit());
    await page.waitForSelector('.planner-problems .planner-row');
    assert.match(await page.locator('.planner-problems .planner-row-title').textContent(), /P3372/);
    await page.fill('.planner-add-problems [name=url]', problemURL);
    await page.locator('.planner-add-problems').evaluate(form => form.requestSubmit());
    await page.waitForSelector('.planner-problems .planner-error:not([hidden])');
    assert.equal(await page.locator('.planner-add-problems [name=url]').inputValue(), problemURL);

    await page.fill('.planner-add-tasks [name=title]', '掌握树上差分');
    await page.click('.planner-add-tasks .planner-deadline-trigger');
    const deadline = await page.locator('.planner-deadline-popover:popover-open').evaluate(popover => {
      // Pick within the calendar already rendered by the browser. Its month remains
      // valid even if the local date rolls over between opening and selecting.
      const days = Array.from(popover.querySelectorAll('.planner-deadline-day:not(.is-adjacent):not(:disabled)'));
      const today = days.find(day => day.getAttribute('aria-current') === 'date');
      const index = today ? Math.min(days.indexOf(today) + 2, days.length - 1) : Math.floor(days.length / 2);
      const date = days[index].dataset.date;
      const local = `${date}T21:30`;
      const selected = new Date(local);
      return {
        date,
        local,
        iso: selected.toISOString(),
        display: selected.toLocaleString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        })
      };
    });
    await page.click(`.planner-deadline-popover:popover-open [data-date="${deadline.date}"]`);
    await page.fill('.planner-deadline-popover:popover-open .planner-deadline-time', '21:30');
    await page.click('.planner-deadline-popover:popover-open .planner-deadline-confirm');
    assert.equal(await page.locator('.planner-add-tasks [name=dueAt]').inputValue(), deadline.local);
    await page.locator('.planner-add-tasks').evaluate(form => form.requestSubmit());
    await page.waitForSelector('.planner-tasks .planner-row');
    let state = await page.evaluate(() => window.notebook.bootstrap());
    assert.equal(state.planner.tasks[0].dueAt, deadline.iso);

    // Task details are read-only; editing notes must preserve the deadline.
    await page.locator('.planner-tasks .planner-task-title').click();
    await page.waitForSelector('.planner-task-detail[open]');
    assert.equal(await page.locator('.planner-task-detail input,.planner-task-detail textarea').count(), 0);
    assert.match(await page.locator('.planner-task-detail').textContent(), /掌握树上差分/);
    assert.equal(await page.locator('.planner-detail-deadline > p').textContent(), deadline.display);
    await page.keyboard.press('Escape');
    await page.locator('.planner-tasks [data-action=edit]').click();
    const details = '学习点差分和边差分，然后完成一道模板题';
    await page.fill('.planner-dialog [name=details]', details);
    await page.locator('.planner-editor').evaluate(form => form.requestSubmit());
    await page.waitForFunction(() => !document.querySelector('.planner-dialog').open);

    await page.locator('.planner-problems .planner-checkbox').check();
    await page.waitForSelector('.planner-problems .planner-completed:not([hidden])');
    await page.locator('.planner-problems .planner-completed summary').click();
    await page.locator('.planner-problems .planner-done-list .planner-checkbox').click();
    await page.waitForSelector('.planner-problems .planner-list:not(.planner-done-list) .planner-row');

    // The fixed compact homepage uses data-view and a board, with no layout picker.
    await page.waitForSelector('body[data-view="home"] #home-panel:not([hidden]) > .home-board');
    assert.deepEqual(
      await page.locator('#home-panel > *').evaluateAll(nodes => nodes.map(node => node.className)),
      ['home-toolbar', 'home-board']
    );
    assert.equal(await page.locator('.home-board > #home-planner > .planner-root > .planner-card').count(), 2);
    assert.equal(await page.locator('.home-layout-picker').count(), 0);
    assert.equal(await page.locator('.home-board').evaluate(board => getComputedStyle(board).display), 'grid');
    await page.locator('.planner-tasks .planner-list-toggle').click();
    assert.equal(await page.locator('#planner-tasks-list').isVisible(), false);
    await page.locator('.planner-tasks .planner-list-toggle').click();
    assert.equal(await page.locator('#planner-tasks-list').isVisible(), true);

    await page.locator('#settings-button').click();
    await page.locator('[data-close=settings-dialog]').click();
    await page.locator('.sidebar').hover();
    await page.locator('.nav-item[data-view=algorithms]').click();
    await page.waitForSelector('#algorithm-panel:not([hidden])');
    await page.locator('.sidebar').hover();
    await page.locator('.nav-item[data-view=home]').click();
    await page.waitForSelector('.planner-problems');
    assert.equal(await page.locator('#platform-overview').count(), 1);
    assert.equal(await page.locator('.planner-tasks .planner-row').count(), 1);

    await app.close();
    app = await launch();
    page = await firstWindow(app);
    await page.waitForSelector('.planner-tasks .planner-row');
    state = await page.evaluate(() => window.notebook.bootstrap());
    assert.equal(state.planner.layout, 'compact');
    assert.equal(state.planner.tasks[0].details, details);
    assert.equal(state.planner.tasks[0].dueAt, deadline.iso);
    assert.equal(state.planner.problems[0].done, false);

    await page.locator('.planner-tasks [data-action=delete]').click();
    assert.equal((await page.evaluate(() => window.notebook.bootstrap())).planner.tasks.length, 1);
    await page.locator('.planner-tasks [data-action=delete]').click();
    await page.waitForFunction(async () => !(await window.notebook.bootstrap()).planner.tasks.length);
    for (const theme of ['light', 'dark', 'cards']) {
      await page.selectOption('#theme-select', theme);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.deepEqual(errors, []);
    console.log('NATIVE PLANNER PASS: compiled app, quick add, duplicate keeps draft, deadline timezone, details edit, complete/restore, compact board, navigation + algorithms, restart, delete confirmation, three themes 390px');
  } finally {
    await app.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
