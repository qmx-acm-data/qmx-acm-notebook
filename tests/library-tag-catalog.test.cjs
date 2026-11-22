'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { appPath } = require('./app-path.cjs');
const { buildDailyTagCatalog } = require(appPath('electron/library-index.cjs'));

const problem = (source, tags, id = `${source}:1`) => ({
  id, source, tags, title: 't', url: 'https://example.com/problem', origin: 'library',
  rating: null, estimatedCfRating: null, estimatedLuoguDifficulty: null, luoguDifficulty: ''
});

test('catalog deduplicates actual cross-platform topics and reports their exact sources and coverage', () => {
  const snapshot = {
    builtAt: '2026-11-20T07:00:00.000Z',
    records: [
      problem('CF', ['dp', 'hashing', '*special', 'interactive']),
      problem('CF', ['Custom Algorithm', 'CUSTOM ALGORITHM'], 'CF:2'),
      problem('LC', ['Dynamic Programming', 'Array', 'Hash Table', 'Sliding Window', 'Custom Algorithm']),
      problem('LOJ', ['动态规划', '数组', '滑动窗口']),
      problem('LG', ['动态规划 DP', '数组', '快速排序', '交互题', '洛谷标签#999']),
      problem('NC', ['Array', 'Hash Table']),
      problem('AT', []),
      problem('AT', [], 'AT:2')
    ]
  };
  const before = structuredClone(snapshot);
  const catalog = buildDailyTagCatalog(snapshot);
  const tags = Object.fromEntries(catalog.tags.map(tag => [tag.name, tag.sources]));
  assert.deepEqual(tags, {
    'Custom Algorithm': ['CF', 'LC'],
    '动态规划 DP': ['CF', 'LC', 'LG', 'LOJ'],
    '哈希 hashing': ['CF'],
    '哈希表': ['LC', 'NC'],
    '滑动窗口': ['LC', 'LOJ'],
    '数组': ['LC', 'LG', 'LOJ', 'NC']
  });
  assert.equal(catalog.total, 8);
  assert.equal(catalog.builtAt, snapshot.builtAt);
  assert.deepEqual(catalog.platforms, {
    AT: { count: 2, tagged: 0, tagCount: 0 },
    CF: { count: 2, tagged: 2, tagCount: 3 },
    LC: { count: 1, tagged: 1, tagCount: 5 },
    LG: { count: 1, tagged: 1, tagCount: 2 },
    LOJ: { count: 1, tagged: 1, tagCount: 3 },
    NC: { count: 1, tagged: 1, tagCount: 2 }
  });
  assert.deepEqual(Object.keys(catalog).sort(), ['builtAt', 'platforms', 'tags', 'total']);
  assert.deepEqual(snapshot, before);
});

test('catalog excludes observed LOJ metadata and merges canonical Chinese source aliases', () => {
  const catalog = buildDailyTagCatalog({ builtAt: null, records: [
    problem('LOJ', ['系统测试', '文件 IO', '子任务', '模板', '原创', 'LibreOJ NOI Round', 'LibreOJ β Round']),
    problem('LOJ', ['三维偏序', '瓶颈路', '斯坦纳树', 'Hash', 'KMP', '中国剩余定理'], 'LOJ:2'),
    problem('NC', ['广度优先搜索(BFS)', 'dfs', '基础数学', '整数二分']),
    problem('LG', ['广度优先搜索 BFS', '深度优先搜索 DFS', '数学', '二分', 'KMP 算法']),
    problem('CF', ['hashing', 'chinese remainder theorem'])
  ] });
  const tags = Object.fromEntries(catalog.tags.map(tag => [tag.name, tag.sources]));
  assert.deepEqual(tags['广度优先搜索 BFS'], ['LG', 'NC']);
  assert.deepEqual(tags['深度优先搜索 DFS'], ['LG', 'NC']);
  assert.deepEqual(tags['数学'], ['LG', 'NC']);
  assert.deepEqual(tags['二分'], ['LG', 'NC']);
  assert.deepEqual(tags['哈希 hashing'], ['CF', 'LOJ']);
  assert.deepEqual(tags['中国剩余定理 CRT'], ['CF', 'LOJ']);
  assert.deepEqual(tags['KMP 算法'], ['LG', 'LOJ']);
  for (const name of ['系统测试', '文件 IO', '子任务', '模板', '原创', 'LibreOJ NOI Round', 'LibreOJ β Round']) assert.equal(name in tags, false);
  for (const name of ['三维偏序', '瓶颈路', '斯坦纳树']) assert.deepEqual(tags[name], ['LOJ']);
  assert.deepEqual(catalog.platforms.LOJ, { count: 2, tagged: 1, tagCount: 6 });
});

test('approved supplemental tags join the catalog without changing strict official Luogu filtering', () => {
  const original = problem('LG', ['自定义算法结构', '1997']);
  const supplemented = { ...original, supplementInfo: { source: 'manual', revision: 1, tags: true, difficulty: false } };
  assert.deepEqual(buildDailyTagCatalog({ builtAt: null, records: [original] }).tags, []);
  assert.deepEqual(buildDailyTagCatalog({ builtAt: null, records: [supplemented] }).tags, [{ name: '自定义算法结构', sources: ['LG'] }]);
});

test('catalog is empty without actual records and does not fill from the preset vocabulary', () => {
  assert.deepEqual(buildDailyTagCatalog({ records: [], builtAt: null }), { tags: [], platforms: {}, builtAt: null, total: 0 });
  const catalog = buildDailyTagCatalog({ records: [problem('AT', [])], builtAt: null });
  assert.deepEqual(catalog.tags, []);
  assert.deepEqual(catalog.platforms, { AT: { count: 1, tagged: 0, tagCount: 0 } });
});

test('catalog payload is deterministically bounded while coverage describes all actual topics', () => {
  const records = Array.from({ length: 1100 }, (_, index) => problem('LOJ', [`Source Algorithm ${index}`], `LOJ:${index}`));
  const catalog = buildDailyTagCatalog({ records, builtAt: null });
  const reversed = buildDailyTagCatalog({ records: [...records].reverse(), builtAt: null });
  assert.equal(catalog.tags.length, 1000);
  assert.deepEqual(catalog, reversed);
  assert.deepEqual(catalog.platforms.LOJ, { count: 1100, tagged: 1100, tagCount: 1100 });
  assert.equal(catalog.total, 1100);
  assert.equal('records' in catalog, false);
});
