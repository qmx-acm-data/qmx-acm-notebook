const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/main/contests/libreoj-public.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded._compile(compiled.outputText, filename);
const { fetchLibreOjProblemPage, parseLibreOjProblemPage } = loaded.exports;

test('parses public problem links and normalizes visible titles', () => {
  const result = parseLibreOjProblemPage('<a href="/problem/1">A &amp; B</a><a href="/problem/1">duplicate</a><a href="/problem/2">\u4f60\u597d</a>');
  assert.deepEqual(result, {
    page: 1,
    problems: [
      { id: '1', title: 'A & B', url: 'https://loj.ac/problem/1' },
      { id: '2', title: '\u4f60\u597d', url: 'https://loj.ac/problem/2' },
    ],
  });
});

test('rejects non-listing HTML and unsafe page numbers', () => {
  assert.throws(() => parseLibreOjProblemPage('<h1>Welcome to nginx!</h1>'), /nginx default page/);
  assert.throws(() => parseLibreOjProblemPage('<main>login challenge</main>'), /no public problem links/);
  assert.throws(() => parseLibreOjProblemPage('<a href="/problem/1">x</a>', 0), /out of range/);
});

test('fetches the public listing page and rejects HTTP or non-HTML responses', async () => {
  const requested = [];
  const response = {
    ok: true,
    status: 200,
    headers: { get: () => 'text/html; charset=utf-8' },
    text: async () => '<a href="/problem/42">Forty two</a>',
  };
  const result = await fetchLibreOjProblemPage(2, async url => { requested.push(url); return response; });
  assert.equal(new URL(requested[0]).origin, 'https://loj.ac');
  assert.equal(new URL(requested[0]).pathname, '/p');
  assert.equal(new URL(requested[0]).searchParams.get('page'), '2');
  assert.equal(result.problems[0].id, '42');
  await assert.rejects(fetchLibreOjProblemPage(1, async () => ({ ...response, ok: false, status: 403 })), /HTTP 403/);
  await assert.rejects(fetchLibreOjProblemPage(1, async () => ({ ...response, headers: { get: () => 'application/json' } })), /unexpected content type/);
});
