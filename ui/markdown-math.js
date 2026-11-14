// Generated from src/renderer/reading/markdown-math.ts; run pnpm modules:build.
(function () {
"use strict";
var __QMXStandalone = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/renderer/reading/markdown-math.ts
  var markdown_math_exports = {};
  __export(markdown_math_exports, {
    MarkdownMath: () => MarkdownMath
  });

  // src/renderer/reading/markdown-table.ts
  function isEscaped(source, index) {
    let count = 0;
    while (index > 0 && source[--index] === "\\") count++;
    return count % 2 === 1;
  }
  function codeEnd(source, index) {
    const opening = /^`+/.exec(source.slice(index))[0];
    const runs = /`+/g;
    runs.lastIndex = index + opening.length;
    let match;
    while (match = runs.exec(source)) if (match[0].length === opening.length) return match.index + opening.length;
    return -1;
  }
  function splitCells(row, count, formula2) {
    const cells = [];
    let cell = "", leadingDelimiter = false, lastDelimiter = -1;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (!isEscaped(row, i)) {
        const math = (ch === "$" || ch === "\\") && formula2(row.slice(i));
        if (math && math.raw) {
          cell += math.raw;
          i += math.raw.length - 1;
          continue;
        }
        if (ch === "`") {
          const end = codeEnd(row, i);
          if (end !== -1) {
            cell += row.slice(i, end);
            i = end - 1;
            continue;
          }
        }
      }
      if (ch === "|") {
        if (isEscaped(row, i)) cell = cell.slice(0, -1) + "|";
        else {
          if (!cells.length && !cell.trim()) leadingDelimiter = true;
          lastDelimiter = i;
          cells.push(cell.trim());
          cell = "";
        }
      } else cell += ch;
    }
    cells.push(cell.trim());
    if (leadingDelimiter) cells.shift();
    if (lastDelimiter >= 0 && !row.slice(lastDelimiter + 1).trim()) cells.pop();
    if (count !== void 0) {
      cells.length = Math.min(cells.length, count);
      while (cells.length < count) cells.push("");
    }
    return cells;
  }
  function tokenize(source, tokenizer, formula2) {
    const cap = tokenizer.rules.block.table.exec(source);
    if (!cap || !tokenizer.rules.other.tableDelimiter.test(cap[2])) return;
    const headers = splitCells(cap[1], void 0, formula2);
    const aligns = cap[2].replace(tokenizer.rules.other.tableAlignChars, "").split("|");
    if (headers.length !== aligns.length) return;
    const align = aligns.map((value) => tokenizer.rules.other.tableAlignRight.test(value) ? "right" : tokenizer.rules.other.tableAlignCenter.test(value) ? "center" : tokenizer.rules.other.tableAlignLeft.test(value) ? "left" : null);
    const cells = (values, header) => values.map((text, index) => ({ text, tokens: tokenizer.lexer.inline(text), header, align: align[index] }));
    const rows = cap[3]?.trim() ? cap[3].replace(tokenizer.rules.other.tableRowBlankLine, "").split("\n") : [];
    return { type: "table", raw: cap[0], header: cells(headers, true), align, rows: rows.map((row) => cells(splitCells(row, headers.length, formula2), false)) };
  }
  var MarkdownTable = Object.freeze({ tokenize });

  // src/renderer/reading/markdown-math.ts
  var parsers = /* @__PURE__ */ new WeakMap();
  var scanBudget = Infinity;
  function spend() {
    return --scanBudget >= 0;
  }
  var environments = /* @__PURE__ */ new Set(["equation", "equation*", "align", "align*", "alignat", "alignat*", "gather", "gather*", "multline", "multline*", "displaymath", "math", "aligned", "alignedat", "gathered", "split", "cases", "dcases", "matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "smallmatrix", "array"]);
  var escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  function escaped(source, index) {
    let count = 0;
    while (index > 0 && source[--index] === "\\") count++;
    return count % 2 === 1;
  }
  function verbEnd(source, index) {
    const match = /^\\verb\*?([^\w\s])/.exec(source.slice(index));
    if (!match) return -1;
    const end = source.indexOf(match[1], index + match[0].length);
    return end === -1 ? -1 : end;
  }
  function closing(source, delimiter, from) {
    let braces = 0;
    for (let index = from; index < source.length; index++) {
      if (!spend()) return -1;
      if (braces === 0 && source.startsWith(delimiter, index)) {
        if (delimiter !== "$" || source[index + 1] !== "$" && !/\s/.test(source[index - 1]) && !/\d/.test(source[index + 1] || "")) return index;
        if (delimiter === "$") return -1;
      }
      const ch = source[index];
      if (ch === "\\") {
        const verb = verbEnd(source, index);
        index = verb === -1 ? index + 1 : verb;
      } else if (ch === "%") {
        const newline = source.indexOf("\n", index);
        if (newline === -1) return -1;
        index = newline - 1;
      } else if (ch === "{") braces++;
      else if (ch === "}") braces = Math.max(0, braces - 1);
      else if (delimiter === "$" && ch === "\n") return -1;
    }
    return -1;
  }
  function formula(source) {
    let left, right, display = false, environment;
    if (source.startsWith("$$")) {
      left = right = "$$";
      display = true;
    } else if (source.startsWith("\\[")) {
      left = "\\[";
      right = "\\]";
      display = true;
    } else if (source.startsWith("\\(")) {
      left = "\\(";
      right = "\\)";
    } else if (source[0] === "$" && source.length > 1 && !/\s/.test(source[1])) left = right = "$";
    else {
      const match = /^\\begin\{([A-Za-z]+\*?)\}/.exec(source);
      if (!match || !environments.has(match[1])) return;
      environment = match[1];
      left = match[0];
      right = `\\end{${environment}}`;
      display = environment !== "math";
    }
    if (!left || scanBudget <= 0) return;
    if (source.indexOf(right, left.length) === -1) return;
    let end;
    if (environment) {
      let depth = 1;
      for (let index = left.length; index < source.length; index++) {
        if (!spend()) return;
        if (source[index] === "%") {
          const newline = source.indexOf("\n", index);
          if (newline === -1) break;
          index = newline;
          continue;
        }
        if (source[index] !== "\\") continue;
        const verb = verbEnd(source, index);
        if (verb !== -1) {
          index = verb;
          continue;
        }
        const match = /^\\(begin|end)\{([A-Za-z]+\*?)\}/.exec(source.slice(index));
        if (match && match[2] === environment) {
          depth += match[1] === "begin" ? 1 : -1;
          if (!depth) {
            end = index;
            break;
          }
          index += match[0].length - 1;
        } else index++;
      }
    } else end = closing(source, right, left.length);
    if (end === void 0 || end < left.length) return;
    const raw = source.slice(0, end + right.length);
    let text = environment ? raw : source.slice(left.length, end);
    if (!text.trim()) return;
    const aliases = { displaymath: "", math: "" };
    const wrapper = environment || /^\s*\\begin\{([A-Za-z]+\*?)\}([\s\S]*)\\end\{\1\}\s*$/.exec(text)?.[1];
    if (Object.prototype.hasOwnProperty.call(aliases, wrapper)) {
      const inner = environment ? source.slice(left.length, end) : text.replace(/^\s*\\begin\{[^}]+\}/, "").replace(/\\end\{[^}]+\}\s*$/, "");
      text = aliases[wrapper] ? `\\begin{${aliases[wrapper]}}${inner}\\end{${aliases[wrapper]}}` : inner;
    }
    return { raw, text, display };
  }
  function mathToken(source, block) {
    const indent = block ? /^ {0,3}/.exec(source)[0].length : 0;
    const token = formula(source.slice(indent));
    if (!token || block && !token.display) return;
    let raw = source.slice(0, indent + token.raw.length);
    if (block) {
      const tail = /^[ \t]*(?:\n|$)/.exec(source.slice(raw.length));
      if (!tail) return;
      raw += tail[0];
    }
    return { type: block ? "notebookMathBlock" : "notebookMathInline", raw, text: token.text, display: token.display };
  }
  function renderToken(token) {
    return `<${token.type === "notebookMathBlock" ? "div" : "span"} class="notebook-math-source" data-math-display="${token.display}">${escapeHtml(token.text)}</${token.type === "notebookMathBlock" ? "div" : "span"}>`;
  }
  function mathStart(source) {
    for (let i = 0; i < source.length; i++) {
      if ((source[i] === "$" || source[i] === "\\") && !escaped(source, i) && formula(source.slice(i))) return i;
    }
    return -1;
  }
  function parse(source, marked) {
    let parser = parsers.get(marked);
    if (!parser) {
      parser = new marked.Marked({
        gfm: true,
        breaks: false,
        renderer: { checkbox(token) {
          return `<span class="markdown-task-marker" role="img" aria-label="${token.checked ? "已完成" : "未完成"}">${token.checked ? "☑" : "☐"}</span> `;
        } },
        tokenizer: {
          table(source2) {
            return MarkdownTable?.tokenize(source2, this, formula) || false;
          }
        },
        extensions: [
          { name: "notebookMathBlock", level: "block", start(source2) {
            const match = /(?:^|\n) {0,3}(?:\$\$|\\\[|\\begin\{)/.exec(source2);
            return match?.index;
          }, tokenizer(source2) {
            return mathToken(source2, true);
          }, renderer: renderToken },
          { name: "notebookMathInline", level: "inline", start: mathStart, tokenizer(source2) {
            return mathToken(source2, false);
          }, renderer: renderToken }
        ]
      });
      parsers.set(marked, parser);
    }
    const previousBudget = scanBudget;
    scanBudget = 1e5 + source.length * 30;
    try {
      return parser.parse(source);
    } finally {
      scanBudget = previousBudget;
    }
  }
  function render(container, katex) {
    if (!katex?.render) return;
    let macros = {};
    for (const node of container.querySelectorAll(".notebook-math-source")) {
      if (node.classList.contains("notebook-math-rendered") || node.classList.contains("notebook-math-error") || node.closest("pre,code,kbd,samp,script,style,textarea")) continue;
      const text = node.textContent;
      try {
        const nextMacros = structuredClone(macros);
        katex.render(text, node, { displayMode: node.dataset.mathDisplay === "true", throwOnError: true, trust: false, strict: "ignore", maxExpand: 1e3, maxSize: 20, macros: nextMacros, globalGroup: true, output: "htmlAndMathml" });
        macros = nextMacros;
        node.classList.add("notebook-math-rendered");
      } catch (error) {
        node.replaceChildren(container.ownerDocument.createTextNode(text));
        node.classList.add("notebook-math-error");
        node.setAttribute("role", "note");
        node.title = `公式语法或命令不受支持：${String(error.message || error).slice(0, 500)}`;
      }
    }
  }
  var MarkdownMath = Object.freeze({ parse, render });
  return __toCommonJS(markdown_math_exports);
})();
if (typeof module === 'object' && module.exports) module.exports = __QMXStandalone["MarkdownMath"];
else (typeof window !== 'undefined' ? window : globalThis)["NotebookMarkdownMath"] = __QMXStandalone["MarkdownMath"];
})();
