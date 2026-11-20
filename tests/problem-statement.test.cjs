const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/main/contests/problem-statement.cts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled.outputText, filename);
const { parsePublicStatement, fetchPublicProblemStatement } = loaded.exports;

const cf = '<html><body><div class="problem-statement"><div class="header"><div class="title">A. &lt;Safe&gt;</div></div><div class="problem-specification"><p>Given a number, compute its value.</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a></div><div class="problem-output"><p>Output the result.</p></div></div><div class="editorial"><p>Solution and proof</p></div></body></html>';
const at = '<div id="task-statement"><span class="h2">A - &lt;Task&gt;</span><p>Given an integer, determine the answer.</p><script>bad()</script><a href="https://example.com">reference</a></div>';

test('extracts official CF/AtCoder statement containers and strips active content', () => {
  const c = parsePublicStatement('CF', 'https://codeforces.com/contest/1/problem/A', cf);
  assert.equal(c.title, 'A. <Safe>');
  assert.match(c.statementHtml, /Given a number/);
  assert.doesNotMatch(c.statementHtml, /script|editorial|javascript/i);
  const a = parsePublicStatement('AT', 'https://atcoder.jp/contests/abc001/tasks/abc001_a', at);
  assert.equal(a.title, 'A - <Task>');
  assert.match(a.statementHtml, /Given an integer/);
});

test('rejects unsupported hosts, paths and missing statement instead of using solutions', () => {
  assert.throws(() => parsePublicStatement('CF', 'https://example.com/contest/1/problem/A', cf), /主机或路径/);
  assert.throws(() => parsePublicStatement('CF', 'https://codeforces.com/contest/1/problem/A?x=1', cf), /公开题目链接/);
  assert.throws(() => parsePublicStatement('AT', 'https://atcoder.jp/contests/abc001/tasks/abc001_a', '<div class="editorial">solution text</div>'), /未提供可识别/);
});

test('reads public LeetCode GraphQL statement without credentials', async () => {
  const payload = JSON.stringify({ data: { question: { title: 'Two Sum', content: '<p>Given an array of integers, return indices that add up to target.</p><script>bad()</script>' } } });
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://leetcode.com/graphql/');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'omit');
    assert.match(options.body, /questionData/);
    return { ok: true, headers: new Headers({ 'content-type': 'application/json' }), body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(payload)); controller.close(); } }) };
  };
  const result = await fetchPublicProblemStatement('LC', 'https://leetcode.com/problems/two-sum/', { fetcher });
  assert.equal(result.title, 'Two Sum');
  assert.match(result.statementText, /Given an array/);
  assert.doesNotMatch(result.statementHtml, /script/i);
});

const luogu = (overrides = {}) => `<script id="lentille-context" type="application/json">${JSON.stringify({ template: 'problem.show', status: 200, data: { problem: { pid: 'P1001', contenu: { name: 'A+B Problem', background: '**Public** background.', description: 'Compute $a+b$.\n\n<script>active()</script>\n\n[Reference](javascript:evil) and ![diagram](https://example.com/image.png)\n\n```cpp\nif (a < b) return a;\n```', formatI: 'Two integers.', formatO: 'Their sum.', hint: 'Public hint.' }, samples: [['1 2\n3 4', '3\n7']], ...overrides } } }).replace(/</g, '\\u003c')}</script>`;

test('reads current Luogu public context as plain text without executing Markdown or HTML', async () => {
  const html = luogu();
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://www.luogu.com.cn/problem/P1001');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.cookie, undefined);
    return new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } });
  };
  const result = await fetchPublicProblemStatement('LG', 'https://www.luogu.com.cn/problem/P1001', { fetcher });
  assert.equal(result.title, 'A+B Problem');
  assert.match(result.statementText, /题目描述\nCompute \$a\+b\$/);
  assert.match(result.statementText, /样例输入 1\n1 2\n3 4\n\n样例输出 1\n3\n7/);
  assert.match(result.statementText, /if \(a < b\) return a;/);
  assert.match(result.statementHtml, /a &lt; b/);
  assert.doesNotMatch(result.statementText, /active\(\)|javascript:|https:\/\/example|<script|\*\*|```/);
  assert.doesNotMatch(result.statementHtml, /<script|<img|<a\b/i);
});

test('rejects Luogu login, captcha, malformed data, mismatched IDs and noncanonical URLs', async () => {
  for (const html of ['<html>Please login or complete captcha</html>', '<script id="lentille-context" type="application/json">invalid</script>', luogu({ pid: 'P1002' }), luogu({ contenu: {} }), luogu({ samples: [[42, 'answer']] })]) {
    assert.throws(() => parsePublicStatement('LG', 'https://www.luogu.com.cn/problem/P1001', html), /页面/);
  }
  for (const url of ['https://luogu.com.cn/problem/P1001', 'https://www.luogu.com.cn/problem/P1001?x=1', 'https://www.luogu.com.cn/problem/solution/P1001', 'https://evil.example/problem/P1001']) {
    assert.throws(() => parsePublicStatement('LG', url, luogu()), /链接/);
  }
  await assert.rejects(fetchPublicProblemStatement('LG', 'https://www.luogu.com.cn/problem/P1001', { fetcher: async () => new Response('captcha', { status: 403 }) }), /HTTP 403/);
});

test('enforces response type, size, timeout and explicit failure', async () => {
  const response = body => ({ ok: true, headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }), body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } }) });
  const fetcher = async (url, options) => { assert.equal(url, 'https://codeforces.com/contest/1/problem/A'); assert.equal(options.redirect, 'error'); return response(cf); };
  const result = await fetchPublicProblemStatement('CF', 'https://codeforces.com/contest/1/problem/A', { fetcher });
  assert.equal(result.platform, 'CF');
  await assert.rejects(fetchPublicProblemStatement('CF', 'https://codeforces.com/contest/1/problem/A', { fetcher: async () => ({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), body: new ReadableStream() }) }), /不是 HTML/);
  await assert.rejects(fetchPublicProblemStatement('CF', 'https://codeforces.com/contest/1/problem/A', { fetcher: async () => response(cf.repeat(50)), maxBytes: 1024 }), /超过大小限制/);
  await assert.rejects(fetchPublicProblemStatement('CF', 'https://codeforces.com/contest/1/problem/A', { fetcher, timeoutMs: 20001 }), /超时设置/);
  await assert.rejects(fetchPublicProblemStatement('CF', 'https://codeforces.com/contest/1/problem/A', { fetcher: async () => { throw new Error('offline'); } }), /公开题面获取失败：offline/);
});
