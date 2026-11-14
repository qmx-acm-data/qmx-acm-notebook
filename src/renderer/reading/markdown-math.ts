declare var module: { exports: unknown };
declare var require: (id: string) => unknown;

(function (global: import('../../../types/markdown-math').MarkdownMathGlobal) {
  'use strict';
  type Formula = import('../../../types/markdown-math').MarkdownMathFormula;
  type Token = import('../../../types/markdown-math').MarkdownMathToken;
  type Marked = import('../../../types/markdown-math').MarkdownMathMarked;
  type Parser = import('../../../types/markdown-math').MarkdownMathParser;
  type Katex = import('../../../types/markdown-math').MarkdownMathKatex;
  type Macros = import('../../../types/markdown-math').MarkdownMathMacros;
  type Container = import('../../../types/markdown-math').MarkdownMathContainer;
  type Api = import('../../../types/markdown-math').MarkdownMathApi;
  type Table = import('../../../types/markdown').MarkdownTableApi;

  const parsers = new WeakMap<Marked, Parser>();
  let scanBudget = Infinity;
  function spend(): boolean { return --scanBudget >= 0; }
  const table = typeof module === 'object' && module.exports ? require('./markdown-table.js') as Readonly<Table> : global.NotebookMarkdownTable;
  const environments = new Set(['equation', 'equation*', 'align', 'align*', 'alignat', 'alignat*', 'gather', 'gather*', 'multline', 'multline*', 'displaymath', 'math', 'aligned', 'alignedat', 'gathered', 'split', 'cases', 'dcases', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'smallmatrix', 'array']);
  const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  function escaped(source: string, index: number): boolean {
    let count = 0; while (index > 0 && source[--index] === '\\') count++;
    return count % 2 === 1;
  }
  function verbEnd(source: string, index: number): number {
    const match = /^\\verb\*?([^\w\s])/.exec(source.slice(index));
    if (!match) return -1;
    const end = source.indexOf(match[1], index + match[0].length);
    return end === -1 ? -1 : end;
  }
  function closing(source: string, delimiter: string, from: number): number {
    let braces = 0;
    for (let index = from; index < source.length; index++) {
      if (!spend()) return -1;
      if (braces === 0 && source.startsWith(delimiter, index)) {
        if (delimiter !== '$' || (source[index + 1] !== '$' && !/\s/.test(source[index - 1]) && !/\d/.test(source[index + 1] || ''))) return index;
        // Do not pair a price or malformed opener with a later valid formula.
        if (delimiter === '$') return -1;
      }
      const ch = source[index];
      if (ch === '\\') { const verb = verbEnd(source, index); index = verb === -1 ? index + 1 : verb; }
      else if (ch === '%') { const newline = source.indexOf('\n', index); if (newline === -1) return -1; index = newline - 1; }
      else if (ch === '{') braces++;
      else if (ch === '}') braces = Math.max(0, braces - 1);
      else if (delimiter === '$' && ch === '\n') return -1;
    }
    return -1;
  }
  function formula(source: string): Formula | undefined {
    let left: string | undefined, right: string, display = false, environment: string | undefined;
    if (source.startsWith('$$')) { left = right = '$$'; display = true; }
    else if (source.startsWith('\\[')) { left = '\\['; right = '\\]'; display = true; }
    else if (source.startsWith('\\(')) { left = '\\('; right = '\\)'; }
    else if (source[0] === '$' && source.length > 1 && !/\s/.test(source[1])) left = right = '$';
    else {
      const match = /^\\begin\{([A-Za-z]+\*?)\}/.exec(source);
      if (!match || !environments.has(match[1])) return;
      environment = match[1]; left = match[0]; right = `\\end{${environment}}`; display = environment !== 'math';
    }
    if (!left || scanBudget <= 0) return;
    if (source.indexOf(right, left.length) === -1) return;
    let end: number | undefined;
    if (environment) {
      let depth = 1;
      for (let index = left.length; index < source.length; index++) {
        if (!spend()) return;
        if (source[index] === '%') { const newline = source.indexOf('\n', index); if (newline === -1) break; index = newline; continue; }
        if (source[index] !== '\\') continue;
        const verb = verbEnd(source, index); if (verb !== -1) { index = verb; continue; }
        const match = /^\\(begin|end)\{([A-Za-z]+\*?)\}/.exec(source.slice(index));
        if (match && match[2] === environment) {
          depth += match[1] === 'begin' ? 1 : -1;
          if (!depth) { end = index; break; }
          index += match[0].length - 1;
        } else index++;
      }
    } else end = closing(source, right, left.length);
    if (end === undefined || end < left.length) return;
    const raw = source.slice(0, end + right.length);
    let text = environment ? raw : source.slice(left.length, end);
    if (!text.trim()) return;
    // Preserve native AMS environments (including tags/numbering); unwrap only
    // standard math/displaymath aliases that KaTeX does not expose as environments.
    const aliases: Record<string, string> = { displaymath: '', math: '' };
    const wrapper = environment || /^\s*\\begin\{([A-Za-z]+\*?)\}([\s\S]*)\\end\{\1\}\s*$/.exec(text)?.[1];
    if (Object.prototype.hasOwnProperty.call(aliases, wrapper as string)) {
      const inner = environment ? source.slice(left.length, end) : text.replace(/^\s*\\begin\{[^}]+\}/, '').replace(/\\end\{[^}]+\}\s*$/, '');
      text = aliases[wrapper as string] ? `\\begin{${aliases[wrapper as string]}}${inner}\\end{${aliases[wrapper as string]}}` : inner;
    }
    return { raw, text, display };
  }
  function mathToken(source: string, block: boolean): Token | undefined {
    const indent = block ? /^ {0,3}/.exec(source)![0].length : 0;
    const token = formula(source.slice(indent));
    if (!token || (block && !token.display)) return;
    let raw = source.slice(0, indent + token.raw.length);
    if (block) {
      const tail = /^[ \t]*(?:\n|$)/.exec(source.slice(raw.length));
      if (!tail) return;
      raw += tail[0];
    }
    return { type: block ? 'notebookMathBlock' : 'notebookMathInline', raw, text: token.text, display: token.display };
  }
  function renderToken(token: Token): string {
    return `<${token.type === 'notebookMathBlock' ? 'div' : 'span'} class="notebook-math-source" data-math-display="${token.display}">${escapeHtml(token.text)}</${token.type === 'notebookMathBlock' ? 'div' : 'span'}>`;
  }
  function mathStart(source: string): number {
    for (let i = 0; i < source.length; i++) {
      if ((source[i] === '$' || source[i] === '\\') && !escaped(source, i) && formula(source.slice(i))) return i;
    }
    return -1;
  }
  function parse(source: string, marked: Marked): string {
    let parser = parsers.get(marked);
    if (!parser) {
      parser = new marked.Marked({ gfm: true, breaks: false,
        renderer: { checkbox(token) { return `<span class="markdown-task-marker" role="img" aria-label="${token.checked ? '已完成' : '未完成'}">${token.checked ? '☑' : '☐'}</span> `; } },
        tokenizer: {
        table(source) { return table?.tokenize(source, this, formula) || false; }
      }, extensions: [
        { name: 'notebookMathBlock', level: 'block', start(source) { const match = /(?:^|\n) {0,3}(?:\$\$|\\\[|\\begin\{)/.exec(source); return match?.index; }, tokenizer(source) { return mathToken(source, true); }, renderer: renderToken },
        { name: 'notebookMathInline', level: 'inline', start: mathStart, tokenizer(source) { return mathToken(source, false); }, renderer: renderToken }
      ] });
      parsers.set(marked, parser);
    }
    const previousBudget = scanBudget;
    scanBudget = 100000 + source.length * 30;
    try { return parser.parse(source); }
    finally { scanBudget = previousBudget; }
  }
  function render(container: Container, katex?: Katex | null): void {
    if (!katex?.render) return;
    // Each document has independent macros; cards and accounts cannot affect others.
    let macros: Macros = {};
    for (const node of container.querySelectorAll<HTMLElement>('.notebook-math-source')) {
      if (node.classList.contains('notebook-math-rendered') || node.classList.contains('notebook-math-error') || node.closest('pre,code,kbd,samp,script,style,textarea')) continue;
      const text = node.textContent;
      try {
        const nextMacros = structuredClone(macros);
        katex.render(text, node, { displayMode: node.dataset.mathDisplay === 'true', throwOnError: true, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20, macros: nextMacros, globalGroup: true, output: 'htmlAndMathml' });
        macros = nextMacros;
        node.classList.add('notebook-math-rendered');
      } catch (error) {
        node.replaceChildren(container.ownerDocument.createTextNode(text));
        node.classList.add('notebook-math-error'); node.setAttribute('role', 'note');
        node.title = `公式语法或命令不受支持：${String((error as { message?: unknown }).message || error).slice(0, 500)}`;
      }
    }
  }
  const api: Readonly<Api> = Object.freeze({ parse, render });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.NotebookMarkdownMath = api;
})((typeof window !== 'undefined' ? window : globalThis) as import('../../../types/markdown-math').MarkdownMathGlobal);
