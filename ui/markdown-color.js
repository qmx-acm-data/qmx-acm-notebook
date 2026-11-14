// Generated from src/renderer/reading/markdown-color.ts; run pnpm modules:build.
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

  // src/renderer/reading/markdown-color.ts
  var markdown_color_exports = {};
  __export(markdown_color_exports, {
    MarkdownColor: () => MarkdownColor
  });
  function color(value, document) {
    const text = String(value || "").trim();
    if (!/^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+\-/degturnrad]+\))$/i.test(text)) return "";
    if (/^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/i.test(text)) return "";
    const style = document.createElement("span").style;
    style.color = text;
    return style.color;
  }
  function foreground(node, document) {
    let result = "";
    for (const declaration of (node.getAttribute("style") || "").split(";")) {
      const match = /^\s*color\s*:\s*(.*?)\s*$/i.exec(declaration);
      if (match) result = color(match[1], document) || result;
    }
    return result || (node.nodeName === "FONT" ? color(node.getAttribute("color"), document) : "");
  }
  function sanitize(html, purifier, document) {
    const colors = /* @__PURE__ */ new WeakMap();
    const capture = (node) => {
      if (node.nodeName !== "SPAN" && node.nodeName !== "FONT") return;
      const value = foreground(node, document);
      if (value) colors.set(node, value);
    };
    purifier.addHook("uponSanitizeElement", capture);
    let fragment;
    try {
      fragment = purifier.sanitize(html, {
        FORBID_TAGS: ["style", "iframe", "form", "input", "button"],
        FORBID_ATTR: ["style", "color"],
        RETURN_DOM_FRAGMENT: true
      });
    } finally {
      purifier.removeHook("uponSanitizeElement", capture);
    }
    for (const node of fragment.querySelectorAll("span,font")) {
      const value = colors.get(node);
      if (value) {
        node.style.color = value;
        node.classList.add("notebook-foreground");
      }
    }
    return fragment;
  }
  var MarkdownColor = Object.freeze({ sanitize });
  return __toCommonJS(markdown_color_exports);
})();
if (typeof module === 'object' && module.exports) module.exports = __QMXStandalone["MarkdownColor"];
else (typeof window !== 'undefined' ? window : globalThis)["NotebookMarkdownColor"] = __QMXStandalone["MarkdownColor"];
})();
