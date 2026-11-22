'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { appPath } = require('./app-path.cjs');
const { parseLuoguProblemList, dailyDraw } = require(appPath('electron/daily-problems.cjs'));
const { createNormalizer, normalizeAlgorithmTag, normalizeSourceAlgorithmTags } = require(appPath('electron/library-normalize.cjs'));
const snapshot = require('../ui/luogu-tags.json');
const { toLibraryProblem } = require(appPath('electron/library-index.cjs'));

test('Luogu JSON and embedded HTML retain only official Algorithm tags', () => {
  const ids = [3, 139, 19, 82, 38, 108, 119, 999999, 3];
  const payload = { data: { problems: { count: 1, result: [{ pid: 'P1002', name: '过河卒', difficulty: 2, tags: ids }] } } };
  for (const input of [JSON.stringify(payload), `\uFEFF${JSON.stringify(payload)}`, `<script id="lentille-context" type="application/json">${JSON.stringify(payload)}</script>`]) {
    const result = parseLuoguProblemList(input);
    assert.equal(result.count, 1);
    const official = new Map(snapshot.tags.filter(t => t.type === 2).map(t => [t.id, t.name]));
    assert.deepEqual(result.problems[0].tags, [official.get(3), official.get(139)]);
    assert.equal(result.problems[0].luoguDifficulty, '普及−');
    assert.equal(result.problems[0].rating, null);
  }
  assert.throws(() => parseLuoguProblemList('<html>captcha</html>'), /公开数据/);
  assert.throws(() => parseLuoguProblemList('{broken'), /JSON/);
});

test('existing Luogu index shards exclude historical metadata without changing stored values', () => {
  const row = { id: 'LG:P1002', platform: 'LG', title: 't', url: 'https://www.luogu.com.cn/problem/P1002', tags: ['1997', 'NOIP 普及组', 'O2优化', '洛谷标签#14', 'dp', '背包 DP'] };
  const before = structuredClone(row);
  assert.deepEqual(toLibraryProblem(row).tags, ['动态规划 DP', '背包 DP']);
  assert.deepEqual(row, before);
});

test('algorithm normalization preserves specific topics and maps selectable aliases', () => {
  const normalizer = createNormalizer(() => null);
  const record = normalizer.record({ id: 'CF:1A', source: 'CF', title: 't', url: 'https://codeforces.com/problemset/problem/1/A', tags: ['dp', 'shortest paths', 'number theory', 'trees', 'bitmasks'] });
  assert.deepEqual(record.tags, ['动态规划 DP', '最短路', '数论', '树论', '位运算']);
  assert.equal(normalizeAlgorithmTag('双指针'), normalizeAlgorithmTag('two pointers'));
  assert.equal(normalizeAlgorithmTag('哈希'), normalizeAlgorithmTag('hashing'));
  assert.equal(normalizeAlgorithmTag('2016'), null);
});

test('source normalization retains safe real topics and excludes metadata without inventing tags', () => {
  const normalizer = createNormalizer(() => null);
  const raw = ['Array', 'Hash Table', 'Sliding Window', 'Custom Algorithm', 'Treap', '*special', 'interactive', '交互题', '2016', '2024年', '二零二四年', 'NOIP 普及组', '洛谷标签#999'];
  const record = normalizer.record({ id: 'LC:1', source: 'LC', title: 't', url: 'https://leetcode.cn/problems/two-sum/', tags: raw });
  assert.deepEqual(record.tags, ['数组', '哈希表', '滑动窗口', 'Custom Algorithm', 'Treap']);
  assert.deepEqual(record.rawTags, raw);
  assert.equal(record.tagsMapped, true);
  assert.deepEqual(normalizeSourceAlgorithmTags(['数组', 'array', 'ARRAY', 'Custom Algorithm', 'custom algorithm'], 'LC'), ['数组', 'Custom Algorithm']);
  assert.equal(normalizeAlgorithmTag('Custom Algorithm'), null);
  assert.equal(normalizeAlgorithmTag('Array'), '数组');
  assert.equal(normalizeAlgorithmTag('Hash Table'), '哈希表');
  assert.deepEqual(normalizeSourceAlgorithmTags([null, {}, 3, '*special', '<script>', 'https://x', 'unknown'], 'CF'), []);
  assert.deepEqual(normalizeSourceAlgorithmTags(null, 'CF'), []);
  const atcoder = normalizer.record({ id: 'AT:ABC1_A', source: 'AT', title: 't', url: 'https://atcoder.jp/contests/abc1/tasks/abc1_a', tags: [] });
  assert.deepEqual(atcoder.tags, []);
  assert.equal(atcoder.tagsKnown, false);
});

test('LOJ source metadata is excluded while unfamiliar algorithms and raw evidence survive', () => {
  const metadata = ['系统测试', '文件 IO', '文件 I/O', '子任务', '模板', '原创', 'LibreOJ NOI Round', 'LibreOJ β Round', 'LibreOJ Round #13', 'LOJ Contest 2026', 'NOIP 2016', 'IOI2024', '2024年度'];
  const algorithms = ['三维偏序', '瓶颈路', '斯坦纳树', '埃氏筛及欧拉筛', '集合幂级数', 'Tournament Sort', 'Custom Algorithm'];
  assert.deepEqual(normalizeSourceAlgorithmTags([...metadata, ...algorithms], 'LOJ'), algorithms);
  const record = createNormalizer(() => null).record({ id: 'LOJ:1', source: 'LOJ', title: 't', url: 'https://loj.ac/p/1', tags: [...metadata, ...algorithms] });
  assert.deepEqual(record.tags, algorithms);
  assert.deepEqual(record.rawTags, [...metadata, ...algorithms]);
  assert.deepEqual(normalizeSourceAlgorithmTags(['Custom Round Algorithm', 'Round Robin Scheduling', '子集卷积', '模板匹配'], 'LOJ'), ['Custom Round Algorithm', 'Round Robin Scheduling', '子集卷积', '模板匹配']);
});

test('observed Chinese and abbreviated source aliases share official canonical names', () => {
  const values = ['BFS', '广度优先搜索(BFS)', '广度优先搜索（ BFS ）', '广度优先搜索 BFS', 'dfs', '深度优先搜索(DFS)', '基础数学', '数学', '整数二分', '实数二分', '二分', 'Hash', 'hashing', 'hash 表', 'Hash Table', 'KMP', 'KMP 算法', 'LCA', '最近公共祖先 LCA', '后缀数组', '后缀数组 SA', '后缀自动机', '后缀自动机 SAM', '中国剩余定理', '中国剩余定理 CRT', '乘法逆元', '逆元'];
  assert.deepEqual(normalizeSourceAlgorithmTags(values, 'LOJ'), ['广度优先搜索 BFS', '深度优先搜索 DFS', '数学', '二分', '哈希 hashing', '哈希表', 'KMP 算法', '最近公共祖先 LCA', '后缀数组 SA', '后缀自动机 SAM', '中国剩余定理 CRT', '逆元']);
});

test('Luogu normalization strictly follows official algorithm type even for technical metadata names', () => {
  assert.deepEqual(normalizeSourceAlgorithmTags(['Array', 'dp', '快速排序', 'Treap', '数据结构', 'Custom Algorithm', '哈希表', '1997', 'NOIP 普及组', '交互题', '14', '洛谷标签#14'], 'LG'), ['数组', '动态规划 DP', '哈希表']);
  const official = snapshot.tags.filter(tag => tag.type === 2).map(tag => tag.name.replace(/^\uFEFF/, '').trim());
  assert.deepEqual(normalizeSourceAlgorithmTags(official, 'LG'), official);
});

test('daily filtering matches official labels with source English and legacy Chinese aliases', async () => {
  const record = { kind: 'local', platform: 'CF', pid: '1A', title: 't', problemUrl: 'https://codeforces.com/problemset/problem/1/A', tags: ['shortest paths', 'trees', 'hashing'] };
  const result = await dailyDraw({ source: 'local', tags: ['最短路', '树论', '哈希 hashing'] }, [record], async () => { throw Error('no network'); }, () => 0);
  assert.equal(result.problem.id, 'CF:1A');
});
