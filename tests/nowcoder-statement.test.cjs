'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { appPath } = require('./app-path.cjs');
const { parseNowcoderStatement, fetchNowcoderStatement } = require(appPath('electron/nowcoder-statement.cjs'));
const uuid = '75e878df47f24fdc9dc3e400ec6058ca';
const url = `https://www.nowcoder.com/practice/${uuid}`;
function fixture() {
  return { msg: 'OK', code: 0, data: { question: {
    uuid, title: '反转链表', paidQuestion: false, visibility: 100, status: 2, shield: false, delete: false,
    content: '<div>给定单链表</div><div>要求 <img src="https://www.nowcoder.com/equation?tex=O(1)"></div>',
    inputDesc: '', outputDesc: '', samples: [{ input: '1  2\n<node>&lt;', output: '3\n7', note: '' }]
  } } };
}
function response(body, status = 200, type = 'application/json;charset=UTF-8') {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } });
}

test('parses actual endpoint shape, formula and samples without collapsing whitespace', () => {
  const result = parseNowcoderStatement(`${url}?tpId=295&tqId=23286`, fixture());
  assert.equal(result.platform, 'NC');
  assert.equal(result.url, url);
  assert.match(result.statementText, /O\(1\)/);
  assert.equal(result.samples[0].input, '1  2\n<node>&lt;');
  assert.match(result.statementText, /1  2\n<node>&lt;/);
  assert.match(result.statementHtml, /&lt;node&gt;&amp;lt;/);
});

test('does not expose active HTML, remote images or attributes', () => {
  const data = fixture();
  data.data.question.content = '<script>alert(1)</script><style>x</style><div onclick="alert(2)">safe</div><img src="javascript:alert(3)"><img src="https://example.com/a.png">';
  const result = parseNowcoderStatement(url, data);
  assert.doesNotMatch(result.statementHtml, /<script|onclick|javascript:|example.com/);
  assert.match(result.statementText, /safe/);
  assert.match(result.statementText, /图片/);
});

test('rejects paid, hidden, shielded, deleted, malformed and mismatched questions', () => {
  for (const [key, value] of [['paidQuestion', true], ['paidQuestion', undefined], ['visibility', 0], ['status', 0], ['shield', true], ['delete', true], ['uuid', 'a'.repeat(32)], ['samples', [{}]]]) {
    const data = fixture();
    data.data.question[key] = value;
    assert.throws(() => parseNowcoderStatement(url, data));
  }
  assert.throws(() => parseNowcoderStatement(url, { code: 401, msg: 'login' }));
});

test('restricts requests to the verified HTTPS endpoint and never sends navigation or credentials', async () => {
  let calls = 0;
  const fetcher = async (endpoint, init) => {
    calls++;
    assert.equal(endpoint, `https://www.nowcoder.com/practice/terminal/${uuid}`);
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert.deepEqual(init.headers, { accept: 'application/json' });
    return response(fixture());
  };
  await fetchNowcoderStatement(`${url}?tpId=295#x`, { fetcher });
  assert.equal(calls, 1);
  for (const invalid of ['http://www.nowcoder.com/practice/' + uuid, 'https://www.nowcoder.com.evil/practice/' + uuid, 'https://user@www.nowcoder.com/practice/' + uuid, 'https://www.nowcoder.com/acm/problem/1']) {
    await assert.rejects(fetchNowcoderStatement(invalid, { fetcher }));
  }
  assert.equal(calls, 1);
});

test('stops on verification HTML, HTTP failures, nonzero codes, oversized and invalid JSON', async () => {
  for (const make of [() => response('captcha', 200, 'text/html'), () => response({}, 403), () => response({}, 429), () => response({ code: 1 }), () => response('{bad'), () => response('x'.repeat(1025))]) {
    let calls = 0;
    await assert.rejects(fetchNowcoderStatement(url, { maxBytes: 1024, fetcher: async () => { calls++; return make(); } }));
    assert.equal(calls, 1);
  }
  await assert.rejects(fetchNowcoderStatement(url, { timeoutMs: 0 }));
});
