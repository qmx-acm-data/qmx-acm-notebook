'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Exercise current source directly; generated application verification belongs to the parent build.
const filename = path.resolve(__dirname, '../src/main/records/parser.cts');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { identify, issueBody, issueRecord, documentContent, parseDocument } = loaded.exports;

test('CF 921 numeric indices retain full identity and leading zeros across aliases and record serializers', () => {
  for (const [url, pid] of [
    ['https://codeforces.com/problemset/problem/921/01', 'CF92101'],
    ['https://codeforces.com/contest/921/problem/01/', 'CF92101'],
    ['https://contest.codeforces.com/contest/921/problem/14?locale=en#statement', 'CF92114'],
    ['https://codeforces.com/problemset/problem/921/14', 'CF92114'],
    ['https://codeforces.com/problemset/problem/921/1', 'CF9211'],
    ['https://codeforces.com/contest/2277/problem/c', 'CF2277C'],
    ['https://codeforces.com/problemset/problem/921/aB2', 'CF921AB2']
  ]) {
    assert.deepEqual(identify(url), { pid, platform: 'CF' }, url);
    const issue = issueRecord({ body: issueBody({ problemUrl: url }), labels: [] });
    assert.equal(issue.pid, pid);
    assert.equal(issue.platform, 'CF');
    const document = documentContent({ problemUrl: url }, 'test-author');
    assert.equal(document.pid, pid);
    assert.equal(document.platform, 'CF');
    assert.equal(parseDocument('problems/test.md', document.text).pid, pid);
  }
});

test('CF identity requires a complete problem route and preserves legacy Gym identity', () => {
  assert.deepEqual(identify('https://codeforces.com/gym/123/problem/A1'), { pid: 'CF123A1', platform: 'CF' });
  assert.deepEqual(identify('https://codeforces.com/gym/921/problem/01'), { pid: 'CF92101', platform: 'CF' });
  for (const url of [
    'https://codeforces.com/problemset/problem/921/01/extra',
    'https://codeforces.com/contest/921/problem/14.json',
    'https://codeforces.com/contest/921/problem/14_extra',
    'https://codeforces.com/prefix/contest/921/problem/14',
    'https://codeforces.com/contest/921/14',
    'https://codeforces.com/problemset/problem/921/problem/01',
    'https://codeforces.com/gym/921/problem/01/extra',
    'https://codeforces.com/gym/921/problem/14.json',
    'https://codeforces.com.evil.test/contest/921/problem/14',
    'https://evilcodeforces.com/contest/921/problem/14'
  ]) assert.deepEqual(identify(url), { pid: '', platform: 'Oth' }, url);
});
