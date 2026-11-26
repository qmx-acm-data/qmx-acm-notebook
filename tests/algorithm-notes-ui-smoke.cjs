'use strict';
const { appPath } = require('./app-path.cjs');
// Run with: node tests/algorithm-notes-ui-smoke.cjs (Playwright + Microsoft Edge).
const assert = require('node:assert/strict');
const directory = require('../data/algorithm-directory.json');
const legacy = require('../docs/algorithm-research/legacy-node-map.json');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const tree = require(appPath('ui/algorithm-directory.js')).hydrate(require(appPath('ui/algorithm-tree.js')));

const nodes = []; (function walk(node) { nodes.push(node); (node.children || []).forEach(walk); })(tree);
const byId = new Map(nodes.flatMap(node => [node.id, ...(node.legacyIds || [])].map(id => [id, node])));
const canonical = id => {
  const node = byId.get(id);
  assert.ok(node, `legacy node ${id} resolves to a current directory`);
  return node.id;
};
const OLD_DP = 'xcpc-动态规划-1';
const DP = canonical(OLD_DP);
const PACK = canonical('xcpc-01背包-1');
const FUNCTION = canonical('xcpc-函数-1');
const leaf = node => node.kind === 'algorithm' && !node.children?.length;
const DP_LEAF = nodes.find(node => leaf(node) && node.label === '线性 DP').id;
const hasAttribute = (node, attribute) => (node.attributes || []).includes(attribute);
const nodeForNote = note => byId.get(note.nodeId);
const containsNode = (node, id) => node.id === id || (node.children || []).some(child => containsNode(child, id));
const MALICIOUS_TITLE = '<img src=x onerror="window.__algorithmXss=1">恶意标题';
const MALICIOUS_TAG = '<svg onload="window.__algorithmXss=2">标签';
const MALICIOUS_AUTHOR = '<img src=x onerror="window.__algorithmXss=3">';
const NOTES = [
  { id: 'n1', noteScope: 'public', nodeId: DP_LEAF, title: '背包状态设计', author: 'admin', authorId: 1, tags: ['动态规划', '背包'], featured: true, updatedAt: '2026-11-08', body: '# 状态转移\n\n复杂度为 $O(nW)$。\n\n```cpp\nint answer = 42;\n```\n\n<img src="missing" onerror="window.__algorithmXss=4"><script>window.__algorithmXss=5</script>\n\n[危险链接](javascript:window.__algorithmXss=6)\n\n<iframe src="https://example.invalid"></iframe><style>body{display:none}</style>' },
  { id: 'n2', noteScope: 'public', nodeId: DP_LEAF, title: '线性 DP 入门', author: 'alice', authorId: 2, tags: ['动态规划'], updatedAt: '2026-11-07', body: '线性状态。' },
  { id: 'n3', noteScope: 'personal', nodeId: DP_LEAF, title: '我的状态机笔记', author: 'alice', authorId: 2, tags: ['状态机', 'private-only-token'], updatedAt: '2026-11-06', body: '个人内容。' },
  { id: 'n4', noteScope: 'public', nodeId: FUNCTION, title: '青档函数笔记', author: 'bob', authorId: 3, tags: ['语法', 'tag-only-token'], updatedAt: '2026-11-05', body: '入门内容。' },
  { id: 'n5', noteScope: 'public', nodeId: PACK, title: '01背包子节点笔记', author: 'carol', authorId: 4, tags: ['背包'], updatedAt: '2026-11-04', body: '子节点内容。' },
  { id: 'other-private', noteScope: 'personal', nodeId: DP_LEAF, title: '他人的私密状态机', author: 'bob', authorId: 3, tags: ['状态机'], updatedAt: '2026-11-09', body: '绝不能泄露。' },
  { id: 'unsafe', noteScope: 'public', nodeId: DP_LEAF, title: MALICIOUS_TITLE, author: MALICIOUS_AUTHOR, authorId: 99, tags: [MALICIOUS_TAG], updatedAt: '2026-11-03', body: '安全显示字符串。' },
  ...['basic', 'beginner', 'intermediate', 'advanced', 'expert', 'board', 'useful', 'useless'].map((color, index) => {
    const nodes = []; (function walk(node) { nodes.push(node); (node.children || []).forEach(walk); })(tree);
    return { id: `category-${color}`, noteScope: 'public', nodeId: nodes.find(node => leaf(node) && (node.color === color || hasAttribute(node, color))).id, title: `分类样本 ${color}`, author: `level-author-${index}`, authorId: 10 + index, tags: [`level-${color}`], updatedAt: '2026-11-01', body: `${color} 样本内容。` };
  }),
].map(note => ({ kind: 'algorithm-note', featured: false, ...note }));

function checkTreeContract() {
  assert.equal(nodes.length, directory.summary.nodes);
  assert.equal(new Set(nodes.map(node => node.id)).size, nodes.length);
  assert.equal(nodes.filter(node => node.sourceHeading).length, 126);
  for (const [oldId, targetId] of Object.entries(legacy.map)) assert.equal(canonical(oldId), targetId);
  assert.equal(Object.keys(legacy.map).length, 367);
}

const REPO = 'team/notebook';
const SOURCE_KEY = `https://api.github.com|${REPO}`;
const ROADMAP_LEAF = 'algorithm-万能头文件与标准库使用';
const BUILTIN_CONTENT = 'algorithm-content-feishu-part-1-1';
const UNRATED_BUILTIN = 'directory-contest-experience';
function builtinFields(id) {
  const { kind, label, fullLabel, color, scope } = byId.get(id);
  const parentId = nodes.find(node => node.children.some(child => child.id === id)).id;
  return { parentId, kind, label, fullLabel, color, scope: scope ?? '' };
}
const BUILTIN_FIELDS = Object.fromEntries([BUILTIN_CONTENT, UNRATED_BUILTIN].map(id => [id, builtinFields(id)]));
const REMOTE_NOTES = [
  { id: 'remote-personal', noteScope: 'personal', authorId: 2, nodeId: PACK, title: '可维护个人笔记', path: 'algorithms/notes/personal/2/managed.md' },
  { id: 'remote-public', noteScope: 'public', authorId: 3, nodeId: ROADMAP_LEAF, title: '可维护公共笔记', path: 'algorithms/notes/public/managed.md' },
  { id: 'remote-other', noteScope: 'personal', authorId: 3, nodeId: PACK, title: '其他账号远程笔记', path: 'algorithms/notes/personal/3/managed.md' },
  { id: 'remote-stale-source', noteScope: 'public', authorId: 3, nodeId: PACK, title: '其他来源公共笔记', path: 'algorithms/notes/public/stale-source.md', sourceKey: 'https://elsewhere.invalid|team/notebook' },
].map(note => ({ kind: 'algorithm-note', repo: REPO, sourceKey: SOURCE_KEY, sha: `${note.id}-sha`, createdAt: '2026-11-01', updatedAt: '2026-11-10', author: 'fixture-author', tags: ['样本', '维护'], body: '原始正文。', ...note }));

async function openAlgorithms(browser, errors, { signedIn = true, push = true, admin = false, width = 1440, managed = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height: 940 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ notes, signedIn, push, admin, repo, sourceKey, builtins }) => {
    window.__algorithmXss = 0;
    window.__algorithmSaved = [];
    window.__algorithmMutations = [];
    window.__algorithmFailures = {};
    window.confirm = () => { throw new Error('The renderer must use a native dialog'); };
    const payload = { records: [], issues: [], algorithmNotes: JSON.parse(sessionStorage.getItem('algorithm-notes-fixture') || 'null') || notes,
      algorithmTopics: JSON.parse(sessionStorage.getItem('algorithm-topics-fixture') || '[]'),
      algorithmOverrides: JSON.parse(sessionStorage.getItem('algorithm-overrides-fixture') || '[]'),
      account: signedIn ? { id: 2, login: 'alice', name: 'Alice' } : null,
      permissions: { repo, push, admin },
      settings: { repo, autoSync: false },
      local: { records: [], favorites: [], mastery: {}, draft: {} } };
    const persistNotes = () => sessionStorage.setItem('algorithm-notes-fixture', JSON.stringify(payload.algorithmNotes));
    const persistTopics = () => sessionStorage.setItem('algorithm-topics-fixture', JSON.stringify(payload.algorithmTopics));
    function saveBuiltinOverride(id, fields) {
      const override = { id, ...fields };
      payload.algorithmOverrides = [...payload.algorithmOverrides.filter(item => item.id !== id), override];
      sessionStorage.setItem('algorithm-overrides-fixture', JSON.stringify(payload.algorithmOverrides));
    }
    const directoryResult = () => structuredClone({ topics: payload.algorithmTopics, overrides: payload.algorithmOverrides });
    function mutate(operation, record) {
      if (record.repo !== repo || record.sourceKey !== sourceKey) throw new Error('资料库来源不匹配');
      window.__algorithmMutations.push({ operation, record });
      const failure = window.__algorithmFailures[operation];
      if (failure) { delete window.__algorithmFailures[operation]; throw new Error(failure); }
    }
    function existingNote(record) {
      const existing = payload.algorithmNotes.find(note => note.path === record.path && note.sourceKey === sourceKey);
      if (!existing || existing.sha !== record.sha) throw new Error('笔记 SHA 冲突');
      if (!(existing.noteScope === 'public' ? admin : push && existing.authorId === 2)) throw new Error('笔记权限不足');
      return existing;
    }
    function existingTopic(record) {
      if (!admin) throw new Error('管理员权限');
      const topic = payload.algorithmTopics.find(item => item.id === record.id);
      const builtin = builtins[record.id];
      const override = payload.algorithmOverrides.find(item => item.id === record.id);
      const current = topic || (builtin && { ...builtin, ...override });
      if (!current || current.hidden || !['parentId', 'kind', 'label', 'fullLabel', 'color', 'scope'].every(key => record.expected[key] === current[key])) throw new Error('算法目录冲突');
      return { current, builtin: Boolean(builtin) };
    }
    window.notebook = {
      bootstrap: async () => structuredClone(payload), sync: async () => structuredClone(payload),
      saveAlgorithmNote: async record => {
        window.__algorithmSaved.push(record); mutate('saveAlgorithmNote', record);
        let saved;
        if (record.path) {
          const previous = existingNote(record);
          if (record.noteScope !== previous.noteScope) throw new Error('不能修改笔记范围');
          const { title, body, tags, nodeId, featured = previous.featured } = record;
          saved = { ...previous, title, body, tags, nodeId, featured, sha: `${previous.sha}-updated`, updatedAt: '2026-11-11' };
        } else {
          const ownerPath = record.noteScope === 'personal' ? 'personal/2' : 'public';
          saved = { ...record, id: record.clientId, path: `algorithms/notes/${ownerPath}/${record.clientId}.md`, sha: 'new-note-sha', kind: 'algorithm-note', author: 'alice', authorId: 2, updatedAt: '2026-11-10' };
        }
        payload.algorithmNotes = [...payload.algorithmNotes.filter(note => note.path !== saved.path), saved]; persistNotes(); return saved;
      },
      deleteAlgorithmNote: async record => {
        mutate('deleteAlgorithmNote', record);
        const previous = existingNote(record);
        payload.algorithmNotes = payload.algorithmNotes.filter(note => note !== previous); persistNotes();
        return { id: previous.id, path: previous.path, deleted: true, repo, sourceKey };
      },
      saveAlgorithmTopic: async record => {
        mutate('saveAlgorithmTopic', record);
        if (!admin) throw new Error('管理员权限');
        const topic = { ...record, id: `custom-${crypto.randomUUID()}` };
        payload.algorithmTopics.push(topic); persistTopics(); return topic;
      },
      updateAlgorithmTopic: async record => {
        mutate('updateAlgorithmTopic', record);
        const { current, builtin } = existingTopic(record), { label, fullLabel, color, scope } = record;
        const changes = { label, fullLabel, color, scope };
        if (builtin) { saveBuiltinOverride(record.id, changes); return directoryResult(); }
        const topic = { ...current, ...changes };
        payload.algorithmTopics = payload.algorithmTopics.map(item => item === current ? topic : item); persistTopics(); return { topic, ...directoryResult() };
      },
      deleteAlgorithmTopic: async record => {
        mutate('deleteAlgorithmTopic', record);
        const { current, builtin } = existingTopic(record);
        if (payload.algorithmTopics.some(item => item.parentId === record.id)) throw new Error('存在子节点，不能删除');
        if (builtin) {
          const { label, fullLabel, color, scope } = current;
          saveBuiltinOverride(record.id, { label, fullLabel, color, scope, hidden: true });
        } else {
          payload.algorithmTopics = payload.algorithmTopics.filter(item => item !== current); persistTopics();
        }
        return directoryResult();
      },
      updateLocal: async () => {}, saveSettings: async settings => settings, openExternal: async () => {},
    };
  }, { notes: managed ? [...NOTES, ...REMOTE_NOTES] : NOTES, signedIn, push, admin, repo: REPO, sourceKey: SOURCE_KEY, builtins: BUILTIN_FIELDS });
  await page.goto(pathToFileURL(appPath('ui/index.html')).href);
  await page.locator('.rail-nav-item[data-view="algorithms"]').click();
  await page.waitForSelector('#algorithm-panel .alg-browser');
  await page.mouse.move(Math.max(300, width - 80), 800);
  // Wait for the actual sidebar geometry, not a fixed animation delay.
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().width <= 73);
  return page;
}

// Measure actual composited backgrounds, including translucent ancestors. WCAG
// small-text threshold applies to all node labels and category badges.
async function assertTextContrast(page, selector, theme) {
  const results = await page.locator(selector).evaluateAll(elements => {
    const rgba = value => {
      const match = value.match(/[\d.]+/g);
      if (!match) throw new Error(`Cannot parse computed color: ${value}`);
      const scale = value.startsWith('color(srgb ') ? 255 : 1;
      if (!value.startsWith('rgb') && scale !== 255) throw new Error(`Unsupported computed color space: ${value}`);
      return [Number(match[0]) * scale, Number(match[1]) * scale, Number(match[2]) * scale, match[3] === undefined ? 1 : Number(match[3])];
    };
    const over = (fg, bg) => {
      const alpha = fg[3] + bg[3] * (1 - fg[3]);
      return [0, 1, 2].map(i => (fg[i] * fg[3] + bg[i] * bg[3] * (1 - fg[3])) / alpha).concat(alpha);
    };
    const luminance = color => color.slice(0, 3).map(c => c / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((v, c, i) => v + c * [0.2126, 0.7152, 0.0722][i], 0);
    return elements.filter(el => el.getClientRects().length && el.textContent.trim()).map(el => {
      const lineage = []; for (let node = el; node; node = node.parentElement) lineage.unshift(node);
      let background = [255, 255, 255, 1];
      for (const node of lineage) {
        const style = getComputedStyle(node);
        const layer = rgba(style.backgroundColor);
        // An opaque descendant fully masks any ancestor gradient.
        if (layer[3] === 1) background = layer;
        else background = over(layer, background);
        if (style.backgroundImage !== 'none') throw new Error(`Contrast target has a background image: ${node.className}`);
        if (Number(style.opacity) !== 1) throw new Error(`Contrast target has group opacity: ${node.className}`);
      }
      const foreground = over(rgba(getComputedStyle(el).color), background);
      const a = luminance(foreground), b = luminance(background);
      return { text: el.textContent.trim().slice(0, 65), className: el.className, foreground, background, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });
  assert.ok(results.length > 0, `${theme}: contrast selectors must find visible text`);
  for (const result of results) assert.ok(result.ratio >= 4.5, `${theme}: ${result.className} ${JSON.stringify(result.text)} contrast ${result.ratio.toFixed(2)} < 4.5; foreground=${result.foreground} background=${result.background}`);
  return results.length;
}

const item = (page, id) => page.locator(`.alg-tree-item[data-node-id="${id}"]`);
const row = (page, id) => page.locator(`.alg-tree-item[data-node-id="${id}"] > .alg-tree-row`);
const directCards = page => page.locator('.alg-pane .alg-leaf-reading .alg-note-card');
const directTitles = page => directCards(page).locator('.alg-note-title').allTextContents();
const visibleLeafIds = page => page.locator('.alg-tree-item[data-kind="topic"]').evaluateAll(items => items.map(item => item.dataset.nodeId).sort());
async function assertReadingPane(page) {
  assert.equal(await page.locator('.alg-pane .alg-result-summary, .alg-pane .alg-result-topic, .alg-pane .alg-search-note-list').count(), 0, 'filters never append duplicate global results to the reading pane');
  if (await page.locator('.alg-pane .alg-leaf-reading').count()) {
    assert.deepEqual(await page.locator('.alg-pane .alg-leaf-reading > section > .alg-section-heading > h3').allTextContents(), ['简介', '精选笔记', '全部笔记'], 'selected leaf has exactly three reading sections under active criteria');
  }
}
async function applyFilters(page) {
  await page.locator('.alg-search-submit').click();
  await assertReadingPane(page);
}
async function assertScopedLeaf(page, nodeId, scope = 'public') {
  assert.equal(await item(page, nodeId).count(), 1, `${nodeId} remains reachable in the filtered tree`);
  await row(page, nodeId).locator('.alg-tree-label').click();
  await assertReadingPane(page);
  assert.deepEqual((await directTitles(page)).sort(), NOTES.filter(note => note.nodeId === nodeId && note.noteScope === scope && (scope === 'public' || note.authorId === 2)).map(note => note.title).sort(), 'selected leaf shows all directly attached notes in the current scope');
}
async function expandAll(page) {
  await page.evaluate(() => { for (let i = 0; i < 1000; i++) { const control = document.querySelector('.alg-tree-item[aria-expanded="false"] > .alg-tree-row > button.alg-disclosure'); if (!control) return; control.click(); } throw Error('Tree did not fully expand'); });
}
const scopeButton = (page, scope) => page.locator('.alg-scope-button').filter({ hasText: scope === 'personal' ? '我的笔记' : '公开笔记' });
async function clearFilters(page) {
  await page.locator('.alg-search').fill('');
  await page.locator('.alg-attribute').selectOption('');
  await page.locator('.alg-legend-button[data-level=""]').click();
  await applyFilters(page);
}
const noteCard = (page, title) => page.locator('.alg-note-card').filter({ has: page.locator('.alg-note-title', { hasText: title }) });
const noteField = (page, name) => page.locator(`#algorithm-note-form [name="${name}"]`);
const topicField = (page, name) => page.locator(`#algorithm-topic-form [name="${name}"]`);
const topicSubmit = page => page.locator('#algorithm-topic-submit');
const noteSubmit = page => page.locator('#algorithm-note-form button[type="submit"]');
const deleteSubmit = page => page.locator('#algorithm-delete-submit');
const cancelDelete = page => page.getByRole('button', { name: '取消', exact: true }).and(page.locator('#algorithm-delete-dialog button'));
const mutationCalls = (page, operation) => page.evaluate(operation => window.__algorithmMutations.filter(entry => entry.operation === operation).map(entry => entry.record), operation);
const failNextMutation = (page, operation, error) => page.evaluate(({ operation, error }) => { window.__algorithmFailures[operation] = error; }, { operation, error });

async function checkBuiltinTopicManagement(browser, errors) {
  const page = await openAlgorithms(browser, errors, { admin: true, push: false });
  const content = BUILTIN_FIELDS[BUILTIN_CONTENT], unrated = BUILTIN_FIELDS[UNRATED_BUILTIN];
  assert.equal(await page.locator('.alg-topic-edit, .alg-topic-delete').count(), 0, 'the built-in root has no edit or delete controls');
  await expandAll(page);
  await row(page, content.parentId).locator('.alg-tree-label').click();
  assert.equal(await page.locator('.alg-topic-edit, .alg-topic-delete').count(), 0, 'the built-in directory has no edit or delete controls');

  await row(page, UNRATED_BUILTIN).locator('.alg-tree-label').click();
  await page.locator('.alg-topic-edit').click();
  assert.equal(await topicField(page, 'color').inputValue(), 'unrated');
  await topicField(page, 'label').fill('竞赛经验与复盘');
  await topicField(page, 'fullLabel').fill('算法竞赛经验与复盘');
  await topicSubmit(page).click();
  await page.locator('#algorithm-topic-dialog').waitFor({ state: 'hidden' });
  const unratedEdit = { label: '竞赛经验与复盘', fullLabel: '算法竞赛经验与复盘', color: 'unrated', scope: unrated.scope };
  assert.equal(await page.locator('.alg-detail-title').innerText(), unratedEdit.fullLabel);

  await expandAll(page);
  await row(page, BUILTIN_CONTENT).locator('.alg-tree-label').click();
  await page.locator('.alg-topic-edit').click();
  assert.equal(await topicField(page, 'parentId').inputValue(), content.parentId);
  assert.equal(await topicField(page, 'kind').inputValue(), 'algorithm');
  assert.equal(await topicField(page, 'kind').isDisabled(), true);
  assert.equal(await topicField(page, 'fullLabel').inputValue(), content.fullLabel);
  const contentEdit = { label: '枚举模拟基础', fullLabel: '枚举与模拟基础方法', color: 'beginner', scope: '只覆盖基础枚举与模拟' };
  await topicField(page, 'label').fill(contentEdit.label);
  await topicField(page, 'fullLabel').fill(contentEdit.fullLabel);
  await topicField(page, 'color').selectOption(contentEdit.color);
  await topicField(page, 'scope').fill(contentEdit.scope);
  await topicSubmit(page).click();
  await page.locator('#algorithm-topic-dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(await mutationCalls(page, 'updateAlgorithmTopic'), [
    { repo: REPO, sourceKey: SOURCE_KEY, id: UNRATED_BUILTIN, expected: unrated, ...unratedEdit },
    { repo: REPO, sourceKey: SOURCE_KEY, id: BUILTIN_CONTENT, expected: content, ...contentEdit },
  ]);
  assert.equal(await item(page, BUILTIN_CONTENT).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.alg-detail-title').innerText(), contentEdit.fullLabel);
  assert.equal(await row(page, BUILTIN_CONTENT).locator('.alg-badge').innerText(), '初级');

  await row(page, content.parentId).locator('.alg-add-topic').click();
  assert.equal(await topicField(page, 'color').locator('option[value="unrated"]').count(), 0, 'new custom topics retain the existing difficulty options');
  await topicField(page, 'label').fill('测试附加算法');
  await topicSubmit(page).click();
  await page.locator('#algorithm-topic-dialog').waitFor({ state: 'hidden' });
  assert.equal(await row(page, BUILTIN_CONTENT).locator('.alg-tree-label').innerText(), contentEdit.label, 'custom topic creation preserves built-in overrides');
  await page.locator('.alg-topic-edit').click();
  await topicField(page, 'fullLabel').fill('编辑后的附加算法');
  await topicSubmit(page).click();
  await page.locator('#algorithm-topic-dialog').waitFor({ state: 'hidden' });
  assert.equal(await row(page, BUILTIN_CONTENT).locator('.alg-tree-label').innerText(), contentEdit.label, 'custom topic editing preserves built-in overrides');

  await row(page, BUILTIN_CONTENT).locator('.alg-tree-label').click();
  await page.locator('.alg-topic-delete').click();
  assert.equal(await page.locator('#algorithm-delete-target').textContent(), contentEdit.fullLabel);
  await deleteSubmit(page).click();
  await page.locator('#algorithm-delete-dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(await mutationCalls(page, 'deleteAlgorithmTopic'), [
    { repo: REPO, sourceKey: SOURCE_KEY, id: BUILTIN_CONTENT, expected: { ...content, ...contentEdit } },
  ]);
  assert.equal(await item(page, content.parentId).getAttribute('aria-selected'), 'true');
  await expandAll(page);
  assert.equal(await item(page, BUILTIN_CONTENT).count(), 0, 'deleting the bundled content leaf removes only that leaf');
  assert.equal(await page.locator('.alg-topic-edit, .alg-topic-delete').count(), 0);
  await page.locator('.alg-tree-label').filter({ hasText: '测试附加算法' }).click();
  await page.locator('.alg-topic-delete').click();
  await deleteSubmit(page).click();
  await page.locator('#algorithm-delete-dialog').waitFor({ state: 'hidden' });
  await expandAll(page);
  assert.equal(await item(page, BUILTIN_CONTENT).count(), 0, 'custom topic deletion keeps the built-in leaf hidden');
  await page.reload();
  await page.locator('.rail-nav-item[data-view="algorithms"]').click();
  await expandAll(page);
  assert.equal(await item(page, BUILTIN_CONTENT).count(), 0, 'built-in deletion survives reload');
  assert.equal(await row(page, UNRATED_BUILTIN).locator('.alg-tree-label').innerText(), unratedEdit.label, 'built-in edits survive reload');
  await page.close();
}

async function checkNoteManagement(browser, errors) {
  const page = await openAlgorithms(browser, errors, { managed: true });
  await expandAll(page);
  await row(page, ROADMAP_LEAF).locator('.alg-tree-label').click();
  await noteCard(page, '可维护公共笔记').click();
  assert.equal(await page.locator('.alg-note-edit, .alg-note-delete').count(), 0, 'repository push without admin does not grant public management');
  await scopeButton(page, 'personal').click();
  await expandAll(page);
  await row(page, PACK).locator('.alg-tree-label').click();
  assert.ok(!(await directTitles(page)).includes('其他账号远程笔记'));
  await noteCard(page, '可维护个人笔记').click();
  assert.equal(await page.locator('.alg-note-edit').isVisible(), true, 'owner with push may manage a personal note');
  await page.locator('.alg-open-detail').click();
  await page.locator('.reading-detail-view .alg-note-edit').click();
  assert.equal(await page.locator('#algorithm-note-title').innerText(), '编辑算法笔记');
  assert.equal(await noteField(page, 'noteTitle').inputValue(), '可维护个人笔记');
  assert.equal(await noteField(page, 'noteTags').inputValue(), '样本, 维护');
  assert.equal(await noteField(page, 'body').inputValue(), '原始正文。');
  assert.equal(await noteField(page, 'noteScope').inputValue(), 'personal');
  assert.equal(await noteField(page, 'noteScope').isDisabled(), true);
  assert.equal(await noteField(page, 'nodeId').inputValue(), PACK);
  assert.deepEqual((await noteField(page, 'nodeId').locator('option').evaluateAll(options => options.map(option => option.value))).sort(), nodes.filter(leaf).map(node => node.id).sort());
  await noteField(page, 'nodeId').selectOption(DP_LEAF);
  await noteField(page, 'noteTitle').fill('移动后的个人笔记');
  await noteField(page, 'noteTags').fill('编辑、迁移');
  await noteField(page, 'body').fill('编辑后的正文。');
  await failNextMutation(page, 'saveAlgorithmNote', '临时写入失败');
  await noteSubmit(page).click();
  assert.equal(await page.locator('#algorithm-note-dialog').isVisible(), true);
  assert.match(await page.locator('#algorithm-note-error').innerText(), /临时写入失败/);
  assert.equal(await noteField(page, 'body').inputValue(), '编辑后的正文。');
  await noteSubmit(page).click();
  await page.locator('#algorithm-note-dialog').waitFor({ state: 'hidden' });
  const edits = await mutationCalls(page, 'saveAlgorithmNote');
  assert.equal(edits.length, 2);
  assert.deepEqual(edits[1], edits[0]);
  assert.deepEqual(edits[0], { repo: REPO, sourceKey: SOURCE_KEY, path: REMOTE_NOTES[0].path, sha: REMOTE_NOTES[0].sha, title: '移动后的个人笔记', noteScope: 'personal', nodeId: DP_LEAF, tags: ['编辑', '迁移'], body: '编辑后的正文。' });
  const fullReader = page.locator('.reading-detail-view');
  assert.equal(await fullReader.locator('.alg-reading-title').innerText(), '移动后的个人笔记');
  assert.equal(await fullReader.locator('.alg-note-author').innerText(), REMOTE_NOTES[0].author);
  assert.equal(await fullReader.locator('.alg-markdown').innerText(), '编辑后的正文。');
  await fullReader.locator('.alg-note-delete').click();
  assert.equal(await page.locator('#algorithm-delete-dialog').evaluate(dialog => dialog.matches(':modal')), true);
  assert.equal(await page.locator('#algorithm-delete-target').textContent(), '移动后的个人笔记');
  await cancelDelete(page).click();
  assert.deepEqual(await mutationCalls(page, 'deleteAlgorithmNote'), []);
  await fullReader.locator('.alg-note-delete').click();
  await failNextMutation(page, 'deleteAlgorithmNote', '临时删除失败');
  await deleteSubmit(page).click();
  assert.equal(await page.locator('#algorithm-delete-dialog').isVisible(), true);
  assert.match(await page.locator('#algorithm-delete-error').innerText(), /临时删除失败/);
  await deleteSubmit(page).click();
  await page.locator('#algorithm-delete-dialog').waitFor({ state: 'hidden' });
  const deletion = { repo: REPO, sourceKey: SOURCE_KEY, path: REMOTE_NOTES[0].path, sha: `${REMOTE_NOTES[0].sha}-updated` };
  assert.deepEqual(await mutationCalls(page, 'deleteAlgorithmNote'), [deletion, deletion]);
  assert.equal(await fullReader.count(), 0);
  assert.equal(await item(page, DP_LEAF).getAttribute('aria-selected'), 'true');
  assert.ok(!(await directTitles(page)).includes('移动后的个人笔记'));
  await page.locator('#sync-button').click();
  await page.waitForFunction(() => !document.querySelector('#sync-button').disabled);
  await page.locator('.alg-search').fill('移动后的个人笔记');
  await applyFilters(page);
  assert.deepEqual(await visibleLeafIds(page), [], 'deleted note stays absent after resync');
  await page.close();

  for (const permissions of [{ push: false }, { push: false, admin: true }]) {
    const restricted = await openAlgorithms(browser, errors, { managed: true, ...permissions });
    await scopeButton(restricted, 'personal').click();
    await expandAll(restricted);
    await row(restricted, PACK).locator('.alg-tree-label').click();
    await noteCard(restricted, '可维护个人笔记').click();
    assert.equal(await restricted.locator('.alg-note-edit, .alg-note-delete').count(), 0, 'personal management requires owner and push, even for admins');
    assert.equal(await restricted.getByText('其他账号远程笔记').count(), 0);
    await restricted.close();
  }
}

async function checkRoadmapAndFavoriteManagement(browser, errors) {
  const page = await openAlgorithms(browser, errors, { managed: true, admin: true, push: false });
  await expandAll(page);
  await row(page, PACK).locator('.alg-tree-label').click();
  await noteCard(page, '其他来源公共笔记').click();
  assert.equal(await page.locator('.alg-note-edit, .alg-note-delete').count(), 0, 'admin cannot manage a remote note from a different source');

  async function openRoadmapNote(title) {
    await page.locator('.arm-node[data-node="g"]').click();
    await page.locator(`.arm-detail-dialog .arm-leaf-link[data-topic-id="${ROADMAP_LEAF}"]`).click();
    await page.locator('.arm-resource-dialog .alg-note-card').filter({ hasText: title }).click();
    assert.equal(await page.locator('.reading-detail-view .alg-reading-title').innerText(), title);
  }
  await page.locator('[data-mode="path"]').click();
  await openRoadmapNote('可维护公共笔记');
  await page.locator('.reading-detail-view .alg-note-edit').click();
  assert.equal(await noteField(page, 'noteScope').isDisabled(), true);
  assert.equal(await noteField(page, 'noteScope').inputValue(), 'public');
  await noteField(page, 'noteTitle').fill('路线编辑后的公共笔记');
  await noteSubmit(page).click();
  await page.locator('#algorithm-note-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.reading-detail-view .alg-reading-title').innerText(), '路线编辑后的公共笔记');
  const [edit] = await mutationCalls(page, 'saveAlgorithmNote');
  assert.equal(edit.path, REMOTE_NOTES[1].path);
  assert.equal(edit.sha, REMOTE_NOTES[1].sha);
  assert.equal(edit.noteScope, 'public');
  await page.locator('.reading-detail-view .alg-note-favorite').click();
  await page.waitForFunction(() => document.querySelector('#count-favorites').textContent === '1');
  await page.locator('.rail-nav-item[data-view="favorites"]').click();
  await page.mouse.move(1300, 850);
  await page.locator('.favorite-open').click();
  assert.equal(await page.locator('#favorites-panel .alg-note-edit').isVisible(), true);
  await page.locator('#favorites-panel .alg-note-delete').click();
  await deleteSubmit(page).click();
  await page.locator('#algorithm-delete-dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(await mutationCalls(page, 'deleteAlgorithmNote'), [{ repo: REPO, sourceKey: SOURCE_KEY, path: REMOTE_NOTES[1].path, sha: `${REMOTE_NOTES[1].sha}-updated` }]);
  assert.equal(await page.locator('.favorite-open').count(), 0, 'deleted algorithm note is immediately removed from favorites');
  assert.equal(await page.locator('#count-favorites').textContent(), '0');
  await page.close();
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    panel: document.querySelector('#algorithm-panel').getBoundingClientRect().toJSON(),
    tree: document.querySelector('.alg-tree-scroll').getBoundingClientRect().toJSON(),
    pane: document.querySelector('.alg-pane').getBoundingClientRect().toJSON(),
    treeScroll: document.querySelector('.alg-tree-scroll').scrollWidth,
    treeClient: document.querySelector('.alg-tree-scroll').clientWidth,
    paneScroll: document.querySelector('.alg-pane').scrollWidth,
    paneClient: document.querySelector('.alg-pane').clientWidth,
  }));
  assert.ok(dimensions.document <= dimensions.viewport + 1, `${label}: document overflows: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.body <= dimensions.viewport + 1, `${label}: body overflows`);
  for (const name of ['panel', 'tree', 'pane']) {
    assert.ok(dimensions[name].left >= -1 && dimensions[name].right <= dimensions.viewport + 1, `${label}: ${name} escapes the viewport`);
  }
  assert.ok(dimensions.treeScroll <= dimensions.treeClient + 1, `${label}: directory has horizontal overflow`);
  assert.ok(dimensions.paneScroll <= dimensions.paneClient + 1, `${label}: note pane has horizontal overflow`);
}

(async () => {
  checkTreeContract();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  try {
    const page = await openAlgorithms(browser, errors);
    const difficultyIds = ['basic', 'beginner', 'intermediate', 'advanced', 'expert'];
    assert.deepEqual(await page.locator('.alg-legend-button[data-level]').evaluateAll(nodes => nodes.map(node => node.dataset.level)), ['', ...difficultyIds, ...(nodes.some(node => leaf(node) && !difficultyIds.includes(node.color)) ? ['unrated'] : [])]);
    assert.deepEqual(await page.locator('.alg-attribute option').evaluateAll(nodes => nodes.map(node => node.value)), ['', 'board', 'useful', 'useless']);
    assert.match(await page.locator('.alg-tier-hint:not(.alg-search-hint)').innerText(), /模板、常用、低频是独立属性/);
    assert.ok((await page.locator('.alg-tree-status').innerText()).includes(String(nodes.length)));
    assert.equal(await item(page, 'root').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('.alg-tree-item[data-depth="2"]').count(), 0, 'fresh render collapses nested directories');
    assert.equal(await page.locator('#algorithm-upload-button').isVisible(), false, 'directory has no upload entry');
    assert.equal(await page.locator('.alg-pane .alg-note-card, .alg-pane .alg-empty').count(), 0, 'directory has no note section');
    assert.equal(await row(page, DP).locator('.alg-badge').count(), 0, 'directory has no difficulty badge');
    assert.equal(await page.locator('.alg-detail-heading .alg-badge').count(), 0, 'directory detail has no difficulty badge');
    assert.equal(await row(page, DP).locator('.alg-node-kind').textContent(), '目录');
    assert.equal(await page.locator('.alg-detail-heading').innerText().then(text => /难度依据|覆盖 D/.test(text)), false);
    assert.equal(await item(page, DP).getAttribute('aria-expanded'), 'false');

    // Expanding a directory and selecting its title are separate operations.
    await row(page, DP).locator('button.alg-disclosure').click();
    assert.equal(await item(page, DP).getAttribute('aria-expanded'), 'true');
    assert.equal(await item(page, 'root').getAttribute('aria-selected'), 'true', 'disclosure does not change selection');
    assert.equal(await page.locator('.alg-detail-title').innerText(), 'XCPC算法');
    await row(page, DP).locator('.alg-tree-label').click();
    assert.equal(await item(page, DP).getAttribute('aria-selected'), 'true');
    assert.equal(await item(page, DP).getAttribute('aria-expanded'), 'true', 'title click does not collapse the directory');
    assert.equal(await page.locator('.alg-pane .alg-note-card, .alg-pane .alg-empty').count(), 0, 'selected directory contains child cards only');
    assert.equal(await page.locator('#algorithm-upload-button').isVisible(), false);
    await expandAll(page);
    await row(page, DP_LEAF).locator('.alg-tree-label').click();
    assert.ok((await directTitles(page)).includes('背包状态设计'));
    assert.equal(await page.locator('.alg-topic-edit, .alg-topic-delete').count(), 0, 'repository push without admin does not grant built-in topic management');
    assert.equal(await page.locator('.alg-note-card').first().locator('.alg-note-title').innerText(), '背包状态设计', 'featured notes sort first');
    assert.equal(await page.locator('.alg-featured').first().innerText(), '精选');
    assert.ok(!(await directTitles(page)).includes('我的状态机笔记'));
    assert.ok(!(await directTitles(page)).includes('他人的私密状态机'));
    assert.ok((await directTitles(page)).includes(MALICIOUS_TITLE));
    const unsafe = page.locator('.alg-note-card').filter({ has: page.locator('.alg-note-title', { hasText: MALICIOUS_TITLE }) });
    assert.equal(await unsafe.locator('.alg-note-author').innerText(), MALICIOUS_AUTHOR);
    assert.equal(await unsafe.locator('.alg-tag').innerText(), MALICIOUS_TAG);
    assert.equal(await unsafe.locator('img, svg, script').count(), 0, 'untrusted metadata renders as text');
    assert.equal(await page.evaluate(() => window.__algorithmXss), 0);

    // All nodes can be reached without losing or changing their persisted IDs.
    await page.evaluate(() => {
      for (let pass = 0; pass < 1000; pass++) {
        const collapsed = Array.from(document.querySelectorAll('.alg-tree-item[aria-expanded="false"] > .alg-tree-row > button.alg-disclosure'));
        if (!collapsed.length) return;
        collapsed[0].click();
      }
      throw new Error('Directory expansion did not converge');
    });
    const ids = await page.locator('.alg-tree-item').evaluateAll(nodes => nodes.map(node => node.dataset.nodeId).sort());
    assert.deepEqual(ids, nodes.map(node => node.id).sort());
    await row(page, PACK).locator('.alg-tree-label').click();
    assert.ok((await directTitles(page)).includes('01背包子节点笔记'));

    // Draft changes must leave both the current tree and results unchanged until submitted.
    const beforeDraft = await page.locator('.alg-workspace').innerHTML();
    await page.locator('.alg-search').fill('不存在的算法');
    await page.locator('.alg-legend-button[data-level="expert"]').click();
    assert.equal(await page.locator('.alg-workspace').innerHTML(), beforeDraft);
    await applyFilters(page);
    assert.equal(await page.locator('.alg-tree-item').count(), 0, 'unmatched query and difficulty leave no tree results');
    assert.equal(await page.locator('.alg-tree-empty').count(), 1);
    await clearFilters(page);
    for (const [query, fullLabel] of [['迭代加深启发式搜索', '迭代加深启发式搜索（IDA*）'], ['kmp', '字符串匹配（KMP）'], ['字符串匹配', '字符串匹配（KMP）']]) {
      const target = nodes.find(node => leaf(node) && node.fullLabel === fullLabel);
      assert.ok(target, `${query} fixture has a concrete leaf`);
      await page.locator('.alg-search').fill(query);
      await page.locator('.alg-search').press('Enter');
      await assertReadingPane(page);
      assert.equal(await item(page, target.id).count(), 1, `${query} matches aliases and case-insensitive algorithm names in the tree`);
      await row(page, target.id).locator('.alg-tree-label').click();
      assert.equal(await page.locator('.alg-detail-title').innerText(), fullLabel);
      await assertReadingPane(page);
      await clearFilters(page);
    }
    assert.equal(await page.locator('.alg-add-topic').count(), 0, 'non-admin has no add-topic controls');

    // Search independently covers a node label, note title, tag and author.
    const searches = [
      ['01背包', '01背包子节点笔记', PACK],
      ['背包状态设计', '背包状态设计', DP_LEAF],
      ['tag-only-token', '青档函数笔记', FUNCTION],
      ['carol', '01背包子节点笔记', PACK],
    ];
    for (const [query, title, nodeId] of searches) {
      await page.locator('.alg-search').fill(query);

      await applyFilters(page);
      assert.deepEqual(await visibleLeafIds(page), [nodeId], `search for ${query} reveals the matching algorithm leaf`);
      assert.equal(await item(page, 'root').count(), 1, `${query} preserves the ancestor chain`);
      await row(page, 'root').locator('.alg-tree-label').click();
      assert.deepEqual(await page.locator('.alg-pane .alg-topic-name strong').allTextContents(), tree.children.filter(child => containsNode(child, nodeId)).map(child => child.label), `${query} limits directory cards to matching child branches`);
      await assertReadingPane(page);
      await assertScopedLeaf(page, nodeId);
      assert.ok((await directTitles(page)).includes(title), `${query} leads to its note`);
    }
    await page.locator('.alg-search').fill('背包 carol');
    await applyFilters(page);
    assert.deepEqual(await visibleLeafIds(page), [PACK], 'all search terms can match across node and note author fields');
    await assertScopedLeaf(page, PACK);
    await page.locator('.alg-search').fill('背包 nonexistent-term');
    await applyFilters(page);
    assert.equal(await page.locator('.alg-tree-item').count(), 0, 'every search term is required');
    await page.locator('.alg-search').fill('private-only-token');

    await applyFilters(page);
    assert.deepEqual(await visibleLeafIds(page), [], 'public search excludes personal notes');
    await scopeButton(page, 'personal').click();
    assert.deepEqual(await visibleLeafIds(page), [DP_LEAF]);
    await assertScopedLeaf(page, DP_LEAF, 'personal');
    await page.locator('.alg-search').fill('状态机');

    await applyFilters(page);
    assert.deepEqual(await visibleLeafIds(page), [DP_LEAF], 'personal search matches own note leaf');
    await assertScopedLeaf(page, DP_LEAF, 'personal');
    assert.deepEqual(await directTitles(page), ['我的状态机笔记'], 'personal scope excludes other authors');
    await page.locator('.alg-search').fill('背包状态设计');

    await applyFilters(page);
    assert.deepEqual(await visibleLeafIds(page), [], 'personal search excludes public notes');
    await scopeButton(page, 'public').click();
    assert.deepEqual(await visibleLeafIds(page), [DP_LEAF]);
    await assertScopedLeaf(page, DP_LEAF);
    await clearFilters(page);

    // Notes-only applies immediately in the current scope and composes with committed facets.
    await page.locator('.alg-has-notes').click();
    assert.equal(await page.locator('.alg-has-notes').getAttribute('aria-pressed'), 'true');
    const publicLeafIds = new Set(NOTES.filter(note => note.noteScope === 'public').map(note => nodeForNote(note).id));
    assert.deepEqual(await visibleLeafIds(page), [...publicLeafIds].sort(), 'notes-only tree contains exactly the public note leaves');
    await assertReadingPane(page);
    await scopeButton(page, 'personal').click();
    assert.deepEqual(await visibleLeafIds(page), [DP_LEAF], 'personal notes-only filter includes only own note leaves');
    await assertScopedLeaf(page, DP_LEAF, 'personal');
    await scopeButton(page, 'public').click();
    await page.locator('.alg-legend-button[data-level="beginner"]').click();
    await page.locator('.alg-search').fill('背包');
    await applyFilters(page);
    assert.deepEqual(await visibleLeafIds(page), [DP_LEAF, PACK].sort(), 'notes-only composes with query and difficulty, including a matching note tag');
    await assertScopedLeaf(page, PACK);
    assert.equal(await item(page, 'root').getAttribute('aria-expanded'), 'true', 'conditions automatically expand matching ancestors');
    await row(page, DP).locator('.alg-disclosure').click();
    assert.equal(await item(page, DP).getAttribute('aria-expanded'), 'false', 'filtered ancestors can still be collapsed');
    await page.locator('#sync-button').click();
    await page.waitForFunction(() => !document.querySelector('#sync-button').disabled);
    assert.equal(await item(page, DP).getAttribute('aria-expanded'), 'false', 'active criteria rerender preserves filtered collapse');
    await page.locator('.alg-clear').click();
    assert.equal(await page.locator('.alg-has-notes').getAttribute('aria-pressed'), 'false');
    assert.equal(await item(page, 'root').getAttribute('aria-selected'), 'true');
    assert.equal(await item(page, DP).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.alg-tree-item[data-depth="2"]').count(), 0, 'clear restores initial nested collapse');
    await row(page, DP).locator('.alg-disclosure').click();
    await applyFilters(page);
    assert.equal(await item(page, DP).getAttribute('aria-expanded'), 'false', 'no-condition search refresh resets expansion');

    // Every difficulty returns only notes assigned that level; retained parent
    // directories give context without receiving a child difficulty themselves.
    for (const level of difficultyIds) {
      await page.locator(`.alg-legend-button[data-level="${level}"]`).click();

      await applyFilters(page);
      const expectedNoteLeaves = [...new Set(NOTES.filter(note => note.noteScope === 'public' && nodeForNote(note).color === level).map(note => note.nodeId))];
      assert.ok(expectedNoteLeaves.length > 0, `${level} fixture has notes to read`);
      for (const nodeId of expectedNoteLeaves) await assertScopedLeaf(page, nodeId);
      assert.equal(await item(page, 'root').count(), 1);
      assert.equal(await row(page, 'root').locator('.alg-badge').count(), 0, 'retained ancestor is a directory, never rated');
      const renderedIds = await page.locator('.alg-tree-item').evaluateAll(nodes => nodes.map(node => node.dataset.nodeId));
      const expectedIds = new Set();
      (function collect(node, ancestors = []) {
        if (leaf(node) && node.color === level) [...ancestors, node.id].forEach(id => expectedIds.add(id));
        (node.children || []).forEach(child => collect(child, [...ancestors, node.id]));
      })(tree);
      assert.deepEqual(renderedIds.sort(), [...expectedIds].sort(), `${level} shows matching nodes and their ancestors`);
    }
    await page.locator('.alg-legend-button[data-level=""]').click();
    for (const attribute of ['board', 'useful', 'useless']) {
      await page.locator('.alg-attribute').selectOption(attribute);
      await applyFilters(page);
      assert.deepEqual(await visibleLeafIds(page), nodes.filter(node => leaf(node) && hasAttribute(node, attribute)).map(node => node.id).sort(), `${attribute} matches only leaves with the independent attribute`);
      const expectedNoteLeaves = [...new Set(NOTES.filter(note => note.noteScope === 'public' && hasAttribute(nodeForNote(note), attribute)).map(note => note.nodeId))];
      assert.ok(expectedNoteLeaves.length > 0, `${attribute} fixture has notes to read`);
      for (const nodeId of expectedNoteLeaves) await assertScopedLeaf(page, nodeId);
      assert.equal(await page.locator('.alg-legend-button[data-level=""]').getAttribute('aria-pressed'), 'true', 'usage attributes do not select a difficulty');
      assert.ok((await page.locator('.alg-pane .alg-attribute-badge').allTextContents()).length > 0);
      assert.ok(!(await page.locator('.alg-pane .alg-badge').allTextContents()).includes('未分级'), 'attributes retain independent algorithm difficulties');
    }
    await clearFilters(page);

    // The reader occupies only the right pane and back restores selection,
    // expanded directory, query and difficulty, including the result set.
    await expandAll(page);
    await row(page, PACK).locator('.alg-tree-label').click();
    await page.locator('.alg-legend-button[data-level="beginner"]').click();
    await page.locator('.alg-search').fill('背包');

    await applyFilters(page);
    const beforeReader = await page.locator('.alg-tree').evaluate(node => ({ html: node.innerHTML, scroll: node.parentElement.scrollTop }));
    const beforeTitles = await directTitles(page);
    assert.equal(await page.locator('.alg-leaf-reading .alg-note-title').innerText(), '01背包子节点笔记', 'selected topic notes remain available with active query and difficulty');
    await directCards(page).filter({ hasText: '01背包子节点笔记' }).click();
    assert.equal(await page.locator('.alg-reading-title').innerText(), '01背包子节点笔记');
    assert.equal(await page.locator('.alg-sidebar').isVisible(), true);
    assert.deepEqual(await page.locator('.alg-tree').evaluate(node => ({ html: node.innerHTML, scroll: node.parentElement.scrollTop })), beforeReader, 'reader preserves the exact directory and scroll');
    await page.locator('.alg-reader-back').click();
    assert.equal(await item(page, PACK).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('.alg-search').inputValue(), '背包');
    assert.equal(await page.locator('.alg-legend-button[data-level="beginner"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await directTitles(page), beforeTitles);
    await assertReadingPane(page);
    await clearFilters(page);
    await expandAll(page);
    await row(page, DP_LEAF).locator('.alg-tree-label').click();
    await page.locator('.alg-note-card').filter({ hasText: '背包状态设计' }).click();
    await page.waitForSelector('.alg-markdown .katex');
    assert.equal(await page.locator('.alg-note-edit, .alg-note-delete').count(), 0, 'legacy fixtures without a SHA stay read-only');
    assert.equal(await page.locator('.alg-markdown h1').innerText(), '状态转移');
    assert.match(await page.locator('.alg-markdown pre code.language-cpp').innerText(), /int answer = 42;/);
    assert.ok(await page.locator('.alg-markdown pre code .token').count() > 0, 'Prism highlights sanitized code');
    assert.equal(await page.locator('.alg-markdown script, .alg-markdown iframe, .alg-markdown style, .alg-markdown [onerror], .alg-markdown [onload], .alg-markdown a[href^="javascript:"]').count(), 0, 'parent Markdown renderer sanitizes active content');
    assert.equal(await page.evaluate(() => window.__algorithmXss), 0);
    await page.locator('.alg-reader-back').click();

    // Upload targets the selected node and retains the parent form's permission
    // rules. A save crosses the real form -> mocked notebook bridge boundary.
    await row(page, PACK).locator('.alg-tree-label').click();
    await page.locator('#algorithm-upload-button').click();
    assert.equal(await page.locator('#algorithm-note-dialog').evaluate(node => node.open), true);
    assert.equal(await page.locator('#algorithm-note-node').inputValue(), PACK);
    assert.equal(await page.locator('#algorithm-note-node option').count(), nodes.filter(leaf).length, 'upload selector lists algorithm leaves only');
    assert.equal(await page.locator('#algorithm-note-form [name="noteScope"]').inputValue(), 'personal');
    assert.equal(await page.locator('#algorithm-note-form [name="noteScope"]').isDisabled(), true);
    await page.locator('#algorithm-note-form [name="noteTitle"]').fill('新上传的背包笔记');
    await page.locator('#algorithm-note-form [name="noteTags"]').fill('背包,测试');
    await page.locator('#algorithm-note-form [name="body"]').fill('保存 $O(n)$ 状态。');
    await failNextMutation(page, 'saveAlgorithmNote', '新建笔记可以重试');
    await noteSubmit(page).click();
    assert.match(await page.locator('#algorithm-note-error').innerText(), /新建笔记可以重试/);
    await noteSubmit(page).click();
    await page.waitForFunction(() => !document.querySelector('#algorithm-note-dialog').open);
    const saved = await page.evaluate(() => window.__algorithmSaved);
    assert.equal(saved.length, 2);
    assert.deepEqual(saved[1], saved[0], 'new note retries keep the same payload and UUID');
    assert.match(saved[0].clientId, /^[0-9a-f-]{36}$/i);
    assert.equal(saved[0].nodeId, PACK);
    assert.equal(saved[0].noteScope, 'personal');
    assert.deepEqual(saved[0].tags, ['背包', '测试']);
    await scopeButton(page, 'personal').click();
    await expandAll(page);
    await row(page, PACK).locator('.alg-tree-label').click();
    assert.ok((await directTitles(page)).includes('新上传的背包笔记'));
    await scopeButton(page, 'public').click();

    // Arrow keys move focus through actual visible rows, expand/collapse, move
    // to a parent, and Enter selects the focused algorithm rather than a no-op.
    await row(page, 'root').locator('.alg-tree-label').click();
    await item(page, 'root').focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await item(page, 'root').getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('ArrowRight');
    assert.equal(await item(page, 'root').getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('ArrowRight');
    const firstId = tree.children[0].id;
    assert.equal(await page.evaluate(() => document.activeElement.dataset.nodeId), firstId);
    await page.keyboard.press('ArrowDown');
    assert.notEqual(await page.evaluate(() => document.activeElement.dataset.nodeId), firstId);
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.nodeId), firstId);
    await page.keyboard.press('Enter');
    assert.equal(await item(page, firstId).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('.alg-detail-title').innerText(), tree.children[0].fullLabel);
    assert.equal(await item(page, firstId).getAttribute('aria-expanded'), 'false', 'selecting a collapsed directory preserves its state');
    await page.keyboard.press('ArrowRight');
    assert.equal(await item(page, firstId).getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await item(page, firstId).getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('ArrowRight');
    assert.equal(await item(page, firstId).getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.nodeId), tree.children[0].children[0].id);
    await page.keyboard.press('ArrowLeft'); // child directory collapses first, if expanded
    if (await page.evaluate(() => document.activeElement.dataset.nodeId) !== firstId) await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.nodeId), firstId);
    assert.equal(await page.locator('.alg-tree-item[tabindex="0"]').count(), 1, 'the tree has one keyboard tab stop');

    let measured = 0;
    for (const theme of ['light', 'dark']) {
      await page.locator('#theme-select').selectOption(theme);
      await page.waitForFunction(theme => document.body.dataset.theme === theme, theme);
      // All categories and all badges appear in unfiltered, fully expanded tree.
      await page.evaluate(() => { for (let i = 0; i < 1000; i++) { const button = document.querySelector('.alg-tree-item[aria-expanded="false"] > .alg-tree-row > button.alg-disclosure'); if (!button) break; button.click(); } });
      measured += await assertTextContrast(page, '.alg-tree-label, .alg-badge, .alg-attribute-badge, .alg-legend-button, .alg-legend-button > span:not(.alg-legend-dot)', theme);
      await page.locator('.alg-search').fill('背包状态设计');

      await applyFilters(page);
      await assertScopedLeaf(page, DP_LEAF);
      measured += await assertTextContrast(page, '.alg-note-title, .alg-featured, .alg-tag', theme);
      await assertNoOverflow(page, `${theme} desktop`);
      await page.setViewportSize({ width: 390, height: 844 });
      await assertNoOverflow(page, `${theme} 390px results`);
      await directCards(page).filter({ hasText: '背包状态设计' }).click();
      await page.waitForSelector('.alg-markdown .katex');
      await assertNoOverflow(page, `${theme} 390px reader`);
      await page.locator('.alg-reader-back').click();
      await clearFilters(page);
      await assertNoOverflow(page, `${theme} 390px directory`);
      await page.setViewportSize({ width: 1440, height: 940 });
    }
    console.log(`Algorithm text contrast: ${measured} computed-style samples >= 4.5 across light/dark`);

    for (const permission of [{ signedIn: false, push: false }, { signedIn: true, push: false }]) {
      const restricted = await openAlgorithms(browser, errors, permission);
      await expandAll(restricted);
      await row(restricted, PACK).locator('.alg-tree-label').click();
      assert.equal(await restricted.locator('#algorithm-upload-button').isDisabled(), true);
      assert.match(await restricted.locator('.alg-upload-hint').innerText(), permission.signedIn ? /写入权限/ : /登录/);
      await restricted.locator('#algorithm-upload-button').evaluate(button => button.click());
      assert.equal(await restricted.locator('#algorithm-note-dialog').evaluate(node => node.open), false);
      if (!permission.signedIn) {
        await scopeButton(restricted, 'personal').click();
        assert.equal(await scopeButton(restricted, 'public').getAttribute('aria-pressed'), 'true');
        assert.match(await restricted.locator('#toast').innerText(), /登录/);
      }
      await restricted.close();
    }
    const adminPage = await openAlgorithms(browser, errors, { admin: true });
    await expandAll(adminPage);
    await row(adminPage, DP_LEAF).locator('.alg-tree-label').click();
    assert.equal(await adminPage.locator('.alg-topic-edit, .alg-topic-delete').count(), 2, 'administrators can edit and delete a built-in leaf');
    await noteCard(adminPage, '背包状态设计').click();
    assert.equal(await adminPage.locator('.alg-note-edit, .alg-note-delete').count(), 0, 'legacy public notes without paths/SHA stay read-only for admins');
    await adminPage.locator('.alg-reader-back').click();
    await adminPage.locator('#algorithm-upload-button').click();
    assert.equal(await adminPage.locator('#algorithm-note-node').inputValue(), DP_LEAF);
    assert.equal(await adminPage.locator('#algorithm-note-form [name="noteScope"]').isDisabled(), false);
    assert.equal(await adminPage.locator('#algorithm-note-form [name="noteScope"]').inputValue(), 'public');
    await adminPage.locator('[data-close="algorithm-note-dialog"]').first().click();
    await row(adminPage, DP).locator('.alg-add-topic').click();
    assert.equal(await adminPage.locator('#algorithm-topic-form [name="parentId"]').inputValue(), DP);
    await adminPage.locator('#algorithm-topic-form [name="label"]').fill('测试算法');
    await adminPage.locator('#algorithm-topic-form [name="fullLabel"]').fill('测试算法完整名称');
    await adminPage.locator('#algorithm-topic-form [name="scope"]').fill('测试学习范围');
    await adminPage.locator('#algorithm-topic-form button[type="submit"]').click();
    await adminPage.waitForFunction(() => !document.querySelector('#algorithm-topic-dialog').open);
    assert.equal(await adminPage.locator('.alg-detail-title').innerText(), '测试算法完整名称');
    const added = await adminPage.locator('.alg-tree-item[aria-selected="true"]').getAttribute('data-node-id');
    await row(adminPage, added).locator('.alg-add-topic').click();
    assert.equal(await adminPage.locator('#algorithm-topic-form [name="parentId"]').inputValue(), added);
    await adminPage.locator('#algorithm-topic-form [name="kind"]').selectOption('directory');
    assert.equal(await adminPage.locator('#algorithm-topic-difficulty').isVisible(), false);
    assert.equal(await adminPage.locator('#algorithm-topic-form [name="color"]').isDisabled(), true);
    await adminPage.locator('#algorithm-topic-form [name="label"]').fill('测试子目录');
    await adminPage.locator('#algorithm-topic-form button[type="submit"]').click();
    await adminPage.waitForFunction(() => !document.querySelector('#algorithm-topic-dialog').open);
    assert.equal(await adminPage.locator('.alg-detail-title').innerText(), '测试子目录');
    assert.equal(await adminPage.locator('.alg-detail-heading .alg-badge').count(), 0);
    assert.equal(await row(adminPage, added).locator('.alg-badge').count(), 0, 'algorithm parent becomes ungraded directory');
    await row(adminPage, added).locator('.alg-tree-label').click();
    const content = `algorithm-content-${added}`;
    assert.equal(await row(adminPage, content).locator('.alg-badge').innerText(), '中级', 'original algorithm remains a rated child');
    await row(adminPage, content).locator('.alg-tree-label').click();
    assert.equal(await adminPage.locator('.alg-detail-title').innerText(), '测试算法完整名称');
    await adminPage.locator('.rail-nav-item[data-view="home"]').click();
    await adminPage.locator('.rail-nav-item[data-view="algorithms"]').click();
    await expandAll(adminPage);
    assert.equal(await item(adminPage, added).count(), 1, 'new topic survives view changes');
    await adminPage.reload();
    await adminPage.locator('.rail-nav-item[data-view="algorithms"]').click();
    await adminPage.locator('.alg-search').fill('测试算法');
    await adminPage.locator('.alg-search-submit').click();
    assert.equal(await row(adminPage, content).locator('.alg-tree-label').innerText(), '测试算法', 'bootstrap reload restores stored custom topic in matching tree');
    await assertReadingPane(adminPage);
    await row(adminPage, content).locator('.alg-tree-label').click();
    assert.equal(await adminPage.locator('.alg-topic-edit, .alg-topic-delete').count(), 0, 'synthetic content is not a stored custom topic');
    await row(adminPage, added).locator('.alg-tree-label').click();
    await adminPage.locator('.alg-open-detail').click();
    await adminPage.locator('.reading-detail-view .alg-topic-edit').click();
    assert.equal(await topicField(adminPage, 'parentId').inputValue(), DP);
    assert.equal(await topicField(adminPage, 'kind').inputValue(), 'algorithm', 'edit uses the stored kind for a split algorithm');
    assert.equal(await topicField(adminPage, 'kind').isDisabled(), true);
    assert.equal(await topicField(adminPage, 'label').inputValue(), '测试算法');
    assert.equal(await topicField(adminPage, 'fullLabel').inputValue(), '测试算法完整名称');
    assert.equal(await topicField(adminPage, 'color').inputValue(), 'intermediate');
    assert.equal(await topicField(adminPage, 'scope').inputValue(), '测试学习范围');
    await topicField(adminPage, 'label').fill('重命名测试算法');
    await topicField(adminPage, 'fullLabel').fill('重命名测试算法完整名称');
    await topicField(adminPage, 'color').selectOption('advanced');
    await topicField(adminPage, 'scope').fill('新的学习范围');
    await failNextMutation(adminPage, 'updateAlgorithmTopic', '目录写入可重试');
    await topicSubmit(adminPage).click();
    assert.equal(await adminPage.locator('#algorithm-topic-dialog').isVisible(), true);
    assert.match(await adminPage.locator('#algorithm-topic-error').innerText(), /目录写入可重试/);
    await topicSubmit(adminPage).click();
    await adminPage.locator('#algorithm-topic-dialog').waitFor({ state: 'hidden' });
    const expected = { parentId: DP, kind: 'algorithm', label: '测试算法', fullLabel: '测试算法完整名称', color: 'intermediate', scope: '测试学习范围' };
    const edits = await mutationCalls(adminPage, 'updateAlgorithmTopic');
    assert.equal(edits.length, 2);
    assert.deepEqual(edits[1], edits[0]);
    assert.deepEqual(edits[0], { repo: REPO, sourceKey: SOURCE_KEY, id: added, expected, label: '重命名测试算法', fullLabel: '重命名测试算法完整名称', color: 'advanced', scope: '新的学习范围' });
    assert.equal(await item(adminPage, added).getAttribute('aria-selected'), 'true');
    assert.equal(await adminPage.locator('.alg-detail-title').innerText(), '重命名测试算法完整名称');
    await adminPage.locator('.alg-topic-delete').click();
    await cancelDelete(adminPage).click();
    assert.deepEqual(await mutationCalls(adminPage, 'deleteAlgorithmTopic'), []);
    await adminPage.locator('.alg-topic-delete').click();
    await deleteSubmit(adminPage).click();
    assert.equal(await adminPage.locator('#algorithm-delete-dialog').isVisible(), true);
    assert.match(await adminPage.locator('#algorithm-delete-error').innerText(), /存在子节点/);
    await cancelDelete(adminPage).click();
    if (await item(adminPage, added).getAttribute('aria-expanded') === 'false') await row(adminPage, added).locator('.alg-disclosure').click();
    const child = adminPage.locator('.alg-tree-row').filter({ has: adminPage.locator('.alg-tree-label', { hasText: '测试子目录' }) });
    await child.locator('.alg-tree-label').click();
    const childId = await adminPage.locator('.alg-tree-item[aria-selected="true"]').getAttribute('data-node-id');
    await adminPage.locator('.alg-topic-edit').click();
    assert.equal(await topicField(adminPage, 'kind').inputValue(), 'directory');
    assert.equal(await topicField(adminPage, 'kind').isDisabled(), true);
    assert.equal(await adminPage.locator('#algorithm-topic-difficulty').isVisible(), false);
    await adminPage.keyboard.press('Escape');
    await adminPage.locator('.alg-topic-delete').click();
    await deleteSubmit(adminPage).click();
    await adminPage.locator('#algorithm-delete-dialog').waitFor({ state: 'hidden' });
    assert.equal(await item(adminPage, childId).count(), 0);
    assert.equal(await item(adminPage, added).getAttribute('aria-selected'), 'true');
    assert.equal(await row(adminPage, added).locator('.alg-badge').innerText(), '高级', 'removing the only child restores the edited leaf at its original ID');
    await adminPage.locator('.alg-topic-delete').click();
    await deleteSubmit(adminPage).click();
    await adminPage.locator('#algorithm-delete-dialog').waitFor({ state: 'hidden' });
    assert.equal(await item(adminPage, added).count(), 0);
    assert.equal(await item(adminPage, DP).getAttribute('aria-selected'), 'true');
    const deletes = await mutationCalls(adminPage, 'deleteAlgorithmTopic');
    const updatedExpected = { ...expected, label: edits[1].label, fullLabel: edits[1].fullLabel, color: edits[1].color, scope: edits[1].scope };
    assert.deepEqual(deletes, [
      { repo: REPO, sourceKey: SOURCE_KEY, id: added, expected: updatedExpected },
      { repo: REPO, sourceKey: SOURCE_KEY, id: childId, expected: { parentId: added, kind: 'directory', label: '测试子目录', fullLabel: '测试子目录', color: 'parent', scope: '' } },
      { repo: REPO, sourceKey: SOURCE_KEY, id: added, expected: updatedExpected },
    ]);
    await adminPage.reload();
    await adminPage.locator('.rail-nav-item[data-view="algorithms"]').click();
    await adminPage.locator('.alg-search').fill('重命名测试算法');
    await applyFilters(adminPage);
    assert.equal(await item(adminPage, added).count(), 0, 'topic deletion survives reload');
    await adminPage.close();

    await checkBuiltinTopicManagement(browser, errors);
    await checkNoteManagement(browser, errors);
    await checkRoadmapAndFavoriteManagement(browser, errors);

    // Node labels follow the same text-only boundary as note metadata. Mutate
    // only this page's in-memory fixture, retaining every node ID and app code.
    const hostileNode = await openAlgorithms(browser, errors);
    await hostileNode.evaluate(() => { window.QMX_ALGORITHM_TREE.children[0].label = '<img src=x onerror="window.__algorithmXss=7">目录'; });
    await hostileNode.locator('#sync-button').click();
    await hostileNode.waitForFunction(() => !document.querySelector('#sync-button').disabled);
    await hostileNode.waitForSelector('.alg-browser');
    assert.equal(await row(hostileNode, tree.children[0].id).locator('.alg-tree-label').innerText(), '<img src=x onerror="window.__algorithmXss=7">目录');
    assert.equal(await row(hostileNode, tree.children[0].id).locator('img, script').count(), 0);
    assert.equal(await hostileNode.evaluate(() => window.__algorithmXss), 0);
    await hostileNode.close();
    assert.deepEqual(errors, [], 'no renderer errors');
    console.log('ALGORITHM NOTES UI PASS (all legacy IDs mapped, directory/keyboard, search/scopes/filters, reader/sanitization, uploads, themes, 390px)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
