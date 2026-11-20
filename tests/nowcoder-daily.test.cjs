const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/main/contests/nowcoder-daily.cts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded._compile(compiled.outputText, filename);
const { parseNowcoderTopicPage, fetchNowcoderTopic, fetchNowcoderProblems, estimateNowcoderCfRating } = loaded.exports;
module.exports.nowcoderExports = loaded.exports;

function page(topicId, page, totalPage, questions) {
  return { msg: 'OK', code: 0, data: { showExt: false, difficultyArray: [], totalPage, judgeStatus: [], questions: questions.map(question => ({ tpId: topicId, ...question })), totalCount: 101, hiddenTag: false, passCount: 0 } };
}
function question(id, title, uuid, difficulty = 2) {
  return { questionId: id, questionTitle: title, questionNo: `BM${id}`, tqId: id + 1000, questionUUid: uuid, difficulty, acceptRate: 40.4064, tags: [{ name: '链表', id: 580 }, { name: '链表', id: 580 }] };
}
const uuid1 = '75e878df47f24fdc9dc3e400ec6058ca';
const uuid2 = 'b58434e200a648c589ca2063f1faf58c';

test('validates and normalizes the observed Nowcoder schema', () => {
  const parsed = parseNowcoderTopicPage(page(295, 1, 1, [question(23286, ' 反转链表 ', uuid1)]), 295, 1);
  assert.equal(parsed.totalPage, 1);
  assert.equal(parsed.problems.length, 1);
  assert.equal(parsed.problems[0].id, 'NC:295:23286');
  assert.equal(parsed.problems[0].title, '反转链表');
  assert.equal(parsed.problems[0].difficulty, 2);
  assert.equal(parsed.problems[0].difficultyEstimated, false);
  assert.deepEqual(parsed.problems[0].tags, ['链表']);
  assert.match(parsed.problems[0].url, /practice\/75e878df47f24fdc9dc3e400ec6058ca\?tpId=295&tqId=23286/);
});

test('rejects malformed schema and unsafe fields', () => {
  assert.throws(() => parseNowcoderTopicPage({ code: 1, msg: 'bad' }, 295, 1), /格式错误/);
  const mismatched = parseNowcoderTopicPage(page(383, 1, 1, [question(1, 'bad', uuid1)]), 295, 1);
  assert.equal(mismatched.problems.length, 0);
  const parsed = parseNowcoderTopicPage(page(295, 1, 1, [question(1, 'bad', '../bad', 9)]), 295, 1);
  assert.equal(parsed.problems.length, 0);
});

test('maps native difficulty to an explicit estimated CF rating and preserves unknowns', () => {
  assert.deepEqual([1, 2, 3, 4, 5, null, 0, 6].map(estimateNowcoderCfRating), [800, 1200, 1600, 2000, 2400, null, null, null]);
});

test('follows totalPage pagination for supported topic 295', async () => {
  const requests = [];
  const result = await fetchNowcoderTopic(295, async url => {
    requests.push(url);
    const pageNumber = Number(new URL(url).searchParams.get('page'));
    return { ok: true, json: async () => page(295, pageNumber, 2, pageNumber === 1 ? [question(23286, 'A', uuid1)] : [question(654, 'B', uuid2)]) };
  });
  assert.deepEqual(requests.map(url => Number(new URL(url).searchParams.get('page'))), [1, 2]);
  assert.equal(new URL(requests[0]).searchParams.get('topicId'), '295');
  assert.equal(result.length, 2);
});

test('supports topic 383 and reports per-topic failures without fabricating problems', async () => {
  const requestedTopics = [];
  const result = await fetchNowcoderProblems(async url => {
    const topic = Number(new URL(url).searchParams.get('topicId'));
    requestedTopics.push(topic);
    if (topic === 295) throw new Error('offline');
    return { ok: true, json: async () => page(383, 1, 1, [question(1, '算法', uuid1, 4)]) };
  });
  assert.deepEqual(requestedTopics, [295, 383]);
  assert.equal(result.problems[0].topicId, 383);
  assert.deepEqual(result.errors, [{ topicId: 295, message: 'offline' }]);
});

test('propagates HTTP errors and enforces page size boundary', async () => {
  await assert.rejects(fetchNowcoderTopic(295, async () => ({ ok: false, status: 429 })), /HTTP 429/);
  await assert.rejects(fetchNowcoderTopic(295, async () => ({ ok: true, json: async () => page(295, 1, 1001, []) })), /总页数异常/);
  await assert.rejects(fetchNowcoderTopic(295, async () => ({ ok: true, json: async () => page(295, 1, 1, []) }), 15000, 101), /分页大小无效/);
});
