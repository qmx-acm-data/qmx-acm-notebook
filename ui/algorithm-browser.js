// Generated from src/renderer/algorithms/browser.ts; run pnpm modules:build.
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

  // src/renderer/algorithms/browser.ts
  var browser_exports = {};
  __export(browser_exports, {
    AlgorithmBrowser: () => AlgorithmBrowser
  });

  // src/renderer/algorithms/directory.ts
  function normalize(value) {
    return String(value ?? "").normalize("NFKC").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[‐‑‒–—−]/gu, "-").replace(/\s+/gu, " ").trim();
  }
  function compact(value) {
    return normalize(value).replace(/[\s_\-()/（）、，,·.:：]/gu, "");
  }
  function score(query, fields) {
    const phrase = normalize(query);
    if (!phrase) return 1;
    const terms = phrase.split(/\s+/u).filter(Boolean);
    const prepared = fields.map((field) => ({ value: normalize(field.value), dense: compact(field.value), weight: field.weight || 1 }));
    let total = 0;
    for (const term of terms) {
      const dense = compact(term);
      let best = 0;
      for (const field of prepared) {
        if (!field.value) continue;
        const hit = field.value === term || dense && field.dense === dense ? 10 : field.value.startsWith(term) || dense && field.dense.startsWith(dense) ? 6 : field.value.includes(term) || dense && field.dense.includes(dense) ? 3 : 0;
        best = Math.max(best, hit * field.weight);
      }
      if (!best) return 0;
      total += best;
    }
    if (terms.length > 1) {
      const dense = compact(phrase);
      total += Math.max(0, ...prepared.map((field) => dense && field.dense.includes(dense) ? 5 * field.weight : 0));
    }
    return total;
  }
  function topicScore(node, path, query) {
    return score(query, [
      { value: node.label, weight: 12 },
      { value: node.fullLabel, weight: 11 },
      ...(node.aliases || []).map((value) => ({ value, weight: 10 })),
      { value: path.join(" / "), weight: 2 }
    ]);
  }
  function noteScore(note, node, path, query, author) {
    return score(query, [
      { value: note.title, weight: 12 },
      ...(note.tags || []).map((value) => ({ value, weight: 9 })),
      { value: node?.label, weight: 8 },
      { value: node?.fullLabel, weight: 8 },
      ...(node?.aliases || []).map((value) => ({ value, weight: 7 })),
      { value: author, weight: 5 },
      { value: path.join(" / "), weight: 2 },
      { value: note.body, weight: 1 }
    ]);
  }
  var COLORS = ["basic", "beginner", "intermediate", "advanced", "expert"];
  function splitMixed(tree) {
    function visit(node) {
      node.children = Array.isArray(node.children) ? node.children : [];
      if (!node.children.length && ["feishu-part-9-5-1", "directory-contest-experience"].includes(node.id) && node.origin !== "admin") {
        node.kind = "algorithm";
        node.color = "unrated";
        node.rating = { status: "unrated", type: "entry" };
      }
      if (node.kind === "algorithm" && node.children.length) {
        const content = { ...node, id: `algorithm-content-${node.id}`, children: [], kind: "algorithm", contentOf: node.id };
        for (const key of ["legacyIds", "sourceHeading", "part", "nestedPart", "metadata"]) delete content[key];
        node.children.unshift(content);
        node.kind = "directory";
        node.color = "parent";
        node.algorithmContentId = content.id;
        node.rating = { status: "not-applicable", type: "directory" };
        delete node.difficultySource;
      }
      if (node.kind === "directory" || node.kind === "category") {
        node.kind = "directory";
        node.color = "parent";
        node.rating = { status: "not-applicable", type: "directory" };
        delete node.difficultySource;
      }
      node.children.forEach(visit);
    }
    visit(tree);
    return tree;
  }
  function hydrate(base, topics = [], overrides = []) {
    const tree = JSON.parse(JSON.stringify(base)), byId = /* @__PURE__ */ new Map();
    function index(node, depth) {
      node.level = depth;
      node.children = Array.isArray(node.children) ? node.children : [];
      node.fullLabel = node.fullLabel || node.label;
      byId.set(node.id, node);
      for (const id of node.legacyIds || []) byId.set(id, node);
      node.children.forEach((child) => index(child, depth + 1));
    }
    splitMixed(tree);
    index(tree, 0);
    let pending = Array.isArray(topics) ? topics.slice() : [];
    for (let round = 0; pending.length && round <= topics.length; round++) {
      const next = [];
      let added = 0;
      for (const record of pending) {
        if (!record || typeof record.id !== "string" || byId.has(record.id)) continue;
        const parent = byId.get(record.parentId);
        if (!parent) {
          next.push(record);
          continue;
        }
        if (!(record.kind === "directory" ? record.color === "parent" : COLORS.includes(record.color)) || typeof record.label !== "string") continue;
        const node = {
          id: record.id,
          label: record.label,
          fullLabel: record.fullLabel || record.label,
          color: record.color,
          scope: record.scope || "",
          rationale: "由管理员按学习范围添加。",
          children: [],
          attributes: [],
          aliases: record.fullLabel && record.fullLabel !== record.label ? [record.fullLabel] : [],
          kind: record.kind === "directory" ? "directory" : "algorithm",
          origin: "admin",
          difficultySource: { kind: "admin" },
          level: parent.level + 1
        };
        parent.children.push(node);
        splitMixed(tree);
        index(tree, 0);
        added++;
      }
      if (!added) break;
      pending = next;
    }
    const byOverrideId = new Map(overrides.filter((item) => item && typeof item.id === "string" && typeof item.label === "string" && typeof item.fullLabel === "string" && typeof item.scope === "string" && (item.color === "unrated" || COLORS.includes(item.color))).map((item) => [item.id, item]));
    function applyOverrides(node) {
      node.children = node.children.filter(applyOverrides);
      if (node.algorithmContentId && !node.children.some((child) => child.id === node.algorithmContentId)) delete node.algorithmContentId;
      if (node.kind !== "algorithm" || node.children.length || node.origin === "admin") return true;
      let override = byOverrideId.get(node.id);
      for (let owner = node.contentOf; !override && owner; owner = byId.get(owner)?.contentOf) override = byOverrideId.get(owner);
      if (!override) return true;
      if (override.hidden) return false;
      const aliases = [.../* @__PURE__ */ new Set([...node.aliases ?? [], node.label, node.fullLabel ?? node.label])].filter((label) => label !== override.label && label !== override.fullLabel);
      Object.assign(node, { label: override.label, fullLabel: override.fullLabel, color: override.color, scope: override.scope, aliases, difficultySource: { kind: "admin" } });
      if (override.color === "unrated") node.rating = { status: "unrated", type: "entry" };
      else if (node.rating?.status === "unrated") delete node.rating;
      return true;
    }
    if (byOverrideId.size) applyOverrides(tree);
    function ranges(node) {
      const values = [COLORS.indexOf(node.color) + 1, ...node.children.flatMap((child) => {
        const r = ranges(child);
        return r ? [r.min, r.max] : [];
      })].filter((n) => n > 0);
      const range = values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
      if (node.kind === "directory") node.rating = { status: "not-applicable", type: "directory" };
      else node.rating = { ...node.rating || {}, ...range ? { range } : {} };
      return range;
    }
    ranges(tree);
    return tree;
  }
  var AlgorithmDirectory = Object.freeze({ normalize, compact, score, topicScore, noteScore, splitMixed, hydrate });

  // src/renderer/reading/reading-detail.ts
  var global = typeof window !== "undefined" ? window : globalThis;
  var stack = [];
  function open({ content, title = "阅读详情", mount, path = [], onClose } = {}) {
    if (!content?.parentNode) return;
    const doc = content.ownerDocument;
    mount ||= content.closest(".algorithm-view-content") || doc.querySelector("#algorithm-panel .algorithm-view-content");
    if (!mount) return;
    const mountElement = mount;
    const previousFocus = doc.activeElement;
    const scroll = content.scrollTop, pageScroll = global.scrollY;
    const modes = mount.parentElement?.querySelector(".algorithm-view-modes");
    if (modes) global.scrollTo(0, Math.max(0, global.scrollY + modes.getBoundingClientRect().top - 100));
    const context = content.closest(".alg-browser,.alp");
    const marker = doc.createComment("reading-detail-return");
    content.before(marker);
    const view = doc.createElement("section");
    view.className = "reading-detail-view";
    view.setAttribute("aria-label", title);
    function sizeView() {
      view.style.height = `${Math.max(360, global.innerHeight - Math.max(0, mountElement.getBoundingClientRect().top) - 24)}px`;
    }
    sizeView();
    global.addEventListener("resize", sizeView);
    const bar = doc.createElement("header");
    bar.className = "reading-detail-bar";
    const back = doc.createElement("button");
    back.type = "button";
    back.className = "button secondary reading-detail-back";
    back.textContent = "← 返回上一级";
    const nav = doc.createElement("nav");
    nav.className = "reading-detail-path";
    nav.setAttribute("aria-label", "详情路径");
    bar.append(back, nav);
    const wrapper = doc.createElement("div");
    wrapper.className = `${context?.className || ""} reading-expanded`;
    wrapper.append(content);
    view.append(bar, wrapper);
    const lifted = [];
    for (const dialog of mount.querySelectorAll("dialog")) {
      const anchor = doc.createComment("reading-form-return");
      dialog.before(anchor);
      mount.append(dialog);
      lifted.push({ dialog, anchor });
    }
    const hidden = Array.from(mount.children).filter((node) => node !== view && node.tagName !== "DIALOG" && !node.hidden);
    hidden.forEach((node) => {
      node.hidden = true;
    });
    mount.append(view);
    let closed = false;
    function setPath(items) {
      nav.replaceChildren();
      const crumbs = items.length ? items : [{ label: title }];
      crumbs.forEach((item, index) => {
        if (index) {
          const separator = doc.createElement("span");
          separator.textContent = "/";
          separator.setAttribute("aria-hidden", "true");
          nav.append(separator);
        }
        const crumb = doc.createElement(item.onClick ? "button" : "span");
        crumb.textContent = String(item.label || "详情");
        if (item.onClick) {
          crumb.type = "button";
          crumb.addEventListener("click", item.onClick);
        }
        if (index === crumbs.length - 1) crumb.setAttribute("aria-current", "page");
        nav.append(crumb);
      });
    }
    const controller = {
      setPath,
      close() {
        if (closed) return;
        while (stack.length && stack[stack.length - 1] !== controller) stack[stack.length - 1].close();
        closed = true;
        const currentScroll = content.scrollTop;
        if (marker.isConnected) marker.replaceWith(content);
        view.remove();
        hidden.forEach((node) => {
          node.hidden = false;
        });
        lifted.forEach(({ dialog, anchor }) => {
          if (anchor.isConnected) anchor.replaceWith(dialog);
        });
        stack.pop();
        content.scrollTop = currentScroll;
        doc.removeEventListener("keydown", onKey);
        global.removeEventListener("resize", sizeView);
        onClose?.();
        const focus = previousFocus?.isConnected && !previousFocus.closest("[hidden]") ? previousFocus : content.querySelector(".reading-detail-trigger");
        focus?.focus({ preventScroll: true });
        global.scrollTo(0, pageScroll);
      }
    };
    function onKey(event) {
      if (event.key !== "Escape" || event.defaultPrevented || stack[stack.length - 1] !== controller || doc.querySelector("dialog[open]")) return;
      event.preventDefault();
      controller.close();
    }
    back.addEventListener("click", () => controller.close());
    doc.addEventListener("keydown", onKey);
    stack.push(controller);
    setPath(path);
    content.scrollTop = scroll;
    back.focus({ preventScroll: true });
    return controller;
  }
  function closeAll() {
    while (stack.length) stack[stack.length - 1].close();
  }
  var ReadingDetail = Object.freeze({ open, closeAll });

  // src/shared/algorithm-leaf.ts
  function isAlgorithmLeaf(node) {
    return node.kind === "algorithm" && !(node.children || []).length;
  }
  function resolveAlgorithmLeaf(tree, id) {
    if (typeof id !== "string") return null;
    const index = /* @__PURE__ */ new Map();
    function walk(node) {
      index.set(node.id, node);
      for (const alias of node.legacyIds || []) index.set(alias, node);
      (node.children || []).forEach(walk);
    }
    walk(tree);
    let current = index.get(id);
    const seen = /* @__PURE__ */ new Set();
    while (current && !seen.has(current.id)) {
      if (isAlgorithmLeaf(current)) return current;
      seen.add(current.id);
      const parentId = current.id;
      current = (current.children || []).find((child) => child.contentOf === parentId || child.id === current?.algorithmContentId);
    }
    return null;
  }

  // src/renderer/algorithms/leaf-reading.ts
  function element(tag, cls = "", text) {
    const n = document.createElement(tag);
    n.className = cls;
    if (text !== void 0) n.textContent = text;
    return n;
  }
  function button(label, cls, run) {
    const n = element("button", cls, label);
    n.type = "button";
    n.addEventListener("click", run);
    return n;
  }
  function noteKey(note) {
    return String(note.path || note.id || note.clientId || `${String(note.nodeId)}:${String(note.title)}:${String(note.authorId)}`);
  }
  function renderLeafReading(options) {
    const root = element("section", "alg-leaf-reading");
    root.dataset.nodeId = options.node.id;
    let current = options.content || null;
    function markdown(host, text) {
      if (options.renderMarkdown) options.renderMarkdown(host, text);
      else host.textContent = text;
    }
    function render2() {
      root.replaceChildren();
      const intro = element("section", "alg-leaf-introduction"), heading = element("div", "alg-section-heading");
      heading.append(element("h3", "", "简介"));
      if (options.canManage && options.onSave) heading.append(button("编辑简介与精选", "alg-text-button alg-edit-leaf-content", edit));
      intro.append(heading);
      const body = element("div", "markdown-body alg-introduction-markdown");
      const introduction = current?.introduction ?? options.node.scope ?? "";
      if (introduction.trim()) markdown(body, introduction);
      else body.append(element("p", "alg-inline-empty", "暂无简介。"));
      intro.append(body);
      root.append(intro);
      const selectedPaths = new Set(current?.featuredNotePaths || []);
      const isFeatured = (note) => current ? typeof note.path === "string" && selectedPaths.has(note.path) : note.featured === true;
      const featured = options.notes.filter(isFeatured), ordinary = options.notes.filter((note) => !isFeatured(note));
      for (const [title, notes, cls] of [["精选笔记", featured, "alg-featured-section"], ["全部笔记", ordinary, "alg-all-notes-section"]]) {
        const section = element("section", cls), row = element("div", "alg-section-heading");
        row.append(element("h3", "", title), element("span", "alg-section-count", String(notes.length)));
        section.append(row);
        const list = element("div", "alg-note-list");
        for (const note of notes) {
          const card = button("", `alg-note-card${isFeatured(note) ? " alg-note-featured" : ""}`, () => options.onRead(note));
          card.dataset.noteKey = noteKey(note);
          const meta = element("div", "alg-note-meta");
          if (isFeatured(note)) meta.append(element("span", "alg-featured", "精选"));
          if (note.author) meta.append(element("span", "alg-note-author", String(options.authorName?.(note.author) || note.author)));
          if (note.updatedAt) meta.append(element("span", "", String(options.formatDate?.(note.updatedAt) || note.updatedAt)));
          card.append(element("h4", "alg-note-title", String(note.title || "未命名笔记")), meta);
          if (Array.isArray(note.tags) && note.tags.length) {
            const tags = element("div", "alg-note-tags");
            note.tags.forEach((tag) => tags.append(element("span", "alg-tag", String(tag))));
            card.append(tags);
          }
          list.append(card);
        }
        if (notes.length) section.append(list);
        else section.append(element("p", "alg-inline-empty", title === "精选笔记" ? "暂无精选笔记。" : "暂无其他笔记。"));
        if (title === "全部笔记" && options.onUpload) section.append(button("＋ 上传笔记", "alg-text-button alg-leaf-upload", options.onUpload));
        root.append(section);
      }
    }
    function edit() {
      if (!options.canManage || !options.onSave) return;
      const previous = document.activeElement, dialog = element("dialog", "alg-leaf-editor");
      dialog.setAttribute("aria-label", "编辑简介与精选笔记");
      const form = element("form", "alg-leaf-content-form");
      form.noValidate = true;
      const header = element("header", "alg-leaf-editor-header");
      header.append(element("h2", "", `${options.node.label} · 简介与精选`));
      const introduction = element("textarea", "alg-leaf-markdown-input");
      introduction.name = "introduction";
      introduction.rows = 11;
      introduction.value = current?.introduction ?? options.node.scope ?? "";
      introduction.setAttribute("aria-label", "Markdown简介");
      const label = element("label", "alg-leaf-field");
      label.append(element("strong", "", "简介（Markdown）"), introduction);
      const preview = element("section", "alg-leaf-preview");
      preview.append(element("h3", "", "预览"));
      const previewBody = element("div", "markdown-body");
      preview.append(previewBody);
      const renderPreview = () => markdown(previewBody, introduction.value);
      introduction.addEventListener("input", renderPreview);
      renderPreview();
      const choices = element("fieldset", "alg-featured-choices");
      choices.append(element("legend", "", "精选笔记（可多选）"));
      const visiblePaths = new Set(options.notes.flatMap((note) => typeof note.path === "string" ? [note.path] : []));
      const chosen = new Set(current?.featuredNotePaths || options.notes.filter((note) => note.featured === true).flatMap((note) => typeof note.path === "string" ? [note.path] : []));
      for (const note of options.notes) {
        if (typeof note.path !== "string") continue;
        const row = element("label", "alg-featured-choice"), check = element("input");
        check.type = "checkbox";
        check.value = note.path;
        check.checked = chosen.has(note.path);
        check.name = "featuredNotePaths";
        check.addEventListener("change", () => {
          if (check.checked) chosen.add(check.value);
          else chosen.delete(check.value);
        });
        row.append(check, element("span", "", String(note.title || "未命名笔记")));
        choices.append(row);
      }
      for (const path of [...chosen].filter((path2) => !visiblePaths.has(path2))) {
        const row = element("label", "alg-featured-choice alg-featured-unavailable"), check = element("input");
        check.type = "checkbox";
        check.checked = true;
        check.name = "featuredNotePaths";
        check.value = path;
        check.addEventListener("change", () => {
          if (check.checked) chosen.add(path);
          else chosen.delete(path);
        });
        row.append(check, element("span", "", "其他范围或已不可用的精选引用（取消勾选可移除）"));
        choices.append(row);
      }
      if (!visiblePaths.size) choices.append(element("p", "alg-inline-empty", "当前范围暂无可新增的精选。不可用的旧引用可在上方移除。"));
      const error = element("p", "alg-inline-error");
      error.hidden = true;
      error.setAttribute("role", "alert");
      let busy = false;
      function close() {
        if (busy) return;
        dialog.close();
        dialog.remove();
        if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
      }
      const actions = element("div", "alg-leaf-editor-actions"), cancel = button("取消", "alg-button", close), save = element("button", "alg-button alg-button-primary", "保存");
      save.type = "submit";
      actions.append(cancel, save);
      form.append(header, label, preview, choices, error, actions);
      dialog.append(form);
      root.append(dialog);
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        close();
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy) return;
        const text = introduction.value;
        if (new TextEncoder().encode(text).length > 1e5 || chosen.size > 100) {
          error.textContent = "简介最多100000字节，精选最多100篇。";
          error.hidden = false;
          return;
        }
        busy = true;
        error.hidden = true;
        form.querySelectorAll("input,textarea,button").forEach((n) => {
          n.disabled = true;
        });
        try {
          const saved = await options.onSave({ nodeId: options.node.id, introduction: text, featuredNotePaths: [...chosen], sha: current?.sha || null, ...current?.storageNodeId ? { storageNodeId: current.storageNodeId } : {} });
          current = saved;
          busy = false;
          close();
          render2();
        } catch (cause) {
          busy = false;
          error.textContent = cause instanceof Error ? cause.message : "保存失败，请重试";
          error.hidden = false;
          form.querySelectorAll("input,textarea,button").forEach((n) => {
            n.disabled = false;
          });
        }
      });
      dialog.showModal();
      introduction.focus();
    }
    render2();
    return root;
  }

  // src/renderer/algorithms/note-favorite.ts
  function noteFavoriteControl(options) {
    if (!options.isFavorite || !options.onToggleFavorite) return null;
    const control = document.createElement("span");
    control.className = "alg-note-favorite-control";
    const button3 = document.createElement("button");
    button3.type = "button";
    button3.className = "alg-button alg-note-favorite";
    const error = document.createElement("span");
    error.className = "alg-inline-error";
    error.hidden = true;
    error.setAttribute("role", "alert");
    function update() {
      const selected = options.isFavorite(options.note);
      button3.textContent = selected ? "★ 已收藏" : "☆ 收藏";
      button3.setAttribute("aria-pressed", String(selected));
    }
    button3.addEventListener("click", () => {
      void (async () => {
        if (button3.disabled) return;
        button3.disabled = true;
        error.hidden = true;
        try {
          await options.onToggleFavorite(options.note);
          update();
        } catch (cause) {
          error.textContent = cause instanceof Error ? cause.message : "收藏保存失败，请重试";
          error.hidden = false;
          options.onError?.(cause);
        } finally {
          button3.disabled = false;
        }
      })();
    });
    update();
    control.append(button3, error);
    return control;
  }

  // src/renderer/algorithms/browser.ts
  var LEVELS = [
    { id: "basic", label: "入门", tone: "cyan", number: "01" },
    { id: "beginner", label: "初级", tone: "green", number: "02" },
    { id: "intermediate", label: "中级", tone: "blue", number: "03" },
    { id: "advanced", label: "高级", tone: "orange", number: "04" },
    { id: "expert", label: "挑战", tone: "red", number: "05" }
  ];
  var ATTRIBUTES = { board: "模板", useful: "常用", useless: "低频" };
  var state = {
    search: "",
    level: "",
    attribute: "",
    draftSearch: "",
    draftLevel: "",
    draftAttribute: "",
    selectedNode: null,
    expanded: /* @__PURE__ */ new Set(),
    scope: "public",
    hasNotes: false,
    reading: null,
    listScroll: 0,
    paneScroll: 0,
    treeScroll: 0
  };
  var active = null;
  var instanceId = 0;
  function element2(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== void 0) el.textContent = String(text);
    return el;
  }
  function button2(text, className, action) {
    const el = element2("button", className, text);
    el.type = "button";
    el.addEventListener("click", action);
    return el;
  }
  function isDirectory(node) {
    return !isAlgorithmLeaf(node);
  }
  function levelOf(node) {
    return isDirectory(node) ? void 0 : LEVELS.find((level) => level.id === node.color);
  }
  function attributesOf(node) {
    return [.../* @__PURE__ */ new Set([...Array.isArray(node.attributes) ? node.attributes : [], ...ATTRIBUTES[node.color] ? [node.color] : []])].filter((key) => ATTRIBUTES[key]);
  }
  function tagsOf(note) {
    return Array.isArray(note.tags) ? note.tags.map(String) : [];
  }
  function noteKey2(note) {
    return String(note.path || note.id || note.clientId || `${note.nodeId}:${note.title}:${note.authorId}`);
  }
  function excerpt(body) {
    return String(body || "").replace(/```[\s\S]*?```/g, " [代码] ").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/<[^>]*>/g, "").replace(/[#*_`>~|]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
  }
  function snapshot() {
    return {
      search: state.search,
      level: state.level,
      attribute: state.attribute,
      draftSearch: state.draftSearch,
      draftLevel: state.draftLevel,
      selectedNode: state.selectedNode,
      expanded: Array.from(state.expanded),
      scope: state.scope,
      hasNotes: state.hasNotes
    };
  }
  function render(options) {
    if (!options || !options.host || !options.tree) throw new TypeError("NotebookAlgorithms.render requires host and tree.");
    if (active) active.destroy();
    const opts = options;
    const host = opts.host;
    const root = opts.tree;
    const byId = /* @__PURE__ */ new Map();
    const all = [];
    function index(node, parent, depth, path) {
      const entry = { node, parent, depth, path: path.concat(String(node.label || "未命名节点")), descendants: 0 };
      byId.set(node.id, entry);
      (node.legacyIds || []).forEach((id) => {
        if (!byId.has(id)) byId.set(id, entry);
      });
      all.push(entry);
      (node.children || []).forEach((child) => {
        index(child, node.id, depth + 1, entry.path);
        entry.descendants += 1 + byId.get(child.id).descendants;
      });
    }
    index(root, null, 0, []);
    if (!(state.search.trim() || state.level || state.attribute || state.hasNotes)) {
      state.expanded = /* @__PURE__ */ new Set([root.id]);
      state.selectedNode = root.id;
      state.reading = null;
      state.treeScroll = 0;
      state.paneScroll = 0;
    }
    state.selectedNode = byId.get(state.selectedNode)?.node.id || root.id;
    const nextScope = opts.scope === "personal" ? "personal" : opts.scope === "public" ? "public" : state.scope;
    if (nextScope !== state.scope) {
      state.reading = null;
      state.paneScroll = 0;
    }
    state.scope = nextScope;
    const accountId = opts.account && opts.account.id;
    const notes = (Array.isArray(opts.notes) ? opts.notes : []).filter((note) => state.scope === "personal" ? note.noteScope === "personal" && accountId != null && String(note.authorId) === String(accountId) : note.noteScope === "public").map((note) => {
      const original = byId.get(note.nodeId)?.node;
      const canonicalId = original ? resolveAlgorithmLeaf(root, original.id)?.id : void 0;
      return canonicalId && canonicalId !== note.nodeId ? { ...note, nodeId: canonicalId } : note;
    }).filter((note) => {
      const node = byId.get(note.nodeId)?.node;
      return Boolean(node && isAlgorithmLeaf(node));
    });
    const nameOf = (author) => {
      try {
        return String(opts.authorName ? opts.authorName(author) : author && (author.name || author.login) || author || "匿名作者");
      } catch (_) {
        return "未知作者";
      }
    };
    const dateOf = (value) => {
      try {
        return opts.formatDate ? opts.formatDate(value) : value ? new Date(value).toLocaleDateString("zh-CN") : "";
      } catch (_) {
        return "";
      }
    };
    const sortedNotes = notes.slice().sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
    const counts = new Map(all.map((entry) => [entry.node.id, 0]));
    notes.forEach((note) => {
      let entry = byId.get(note.nodeId);
      while (entry) {
        counts.set(entry.node.id, counts.get(entry.node.id) + 1);
        entry = byId.get(entry.parent);
      }
    });
    function expandAncestors(id) {
      let entry = byId.get(id);
      while (entry && entry.parent != null) {
        state.expanded.add(entry.parent);
        entry = byId.get(entry.parent);
      }
    }
    if (state.reading && !notes.some((note) => noteKey2(note) === state.reading)) state.reading = null;
    const shell = element2("section", "alg-browser");
    shell.setAttribute("aria-label", "算法知识与笔记浏览器");
    const uid = `alg-browser-${++instanceId}`;
    const top = element2("header", "alg-toolbar");
    const brand = element2("div", "alg-brand");
    brand.append(element2("span", "alg-eyebrow", "KNOWLEDGE EXPLORER"), element2("h2", "alg-title", "算法知识库"));
    const scopeSwitch = element2("div", "alg-scope");
    scopeSwitch.setAttribute("role", "group");
    scopeSwitch.setAttribute("aria-label", "笔记范围");
    ["public", "personal"].forEach((scope) => {
      const control = button2(scope === "public" ? "公开笔记" : "我的笔记", "alg-scope-button", () => {
        if (scope === state.scope) return;
        if (typeof opts.onScopeChange === "function") opts.onScopeChange(scope);
        else if (scope !== "personal" || opts.account) {
          state.scope = scope;
          state.reading = null;
          render({ ...opts, scope });
        }
      });
      control.setAttribute("aria-pressed", String(scope === state.scope));
      scopeSwitch.append(control);
    });
    const uploadWrap = element2("div", "alg-upload-wrap");
    const upload = button2("＋ 上传笔记", "alg-button alg-button-primary", () => {
      if (!opts.canUpload || !opts.account || typeof opts.onUpload !== "function" || !isAlgorithmLeaf(byId.get(state.selectedNode).node)) return;
      if (typeof opts.onSelect === "function") opts.onSelect(state.selectedNode);
      opts.onUpload(state.selectedNode);
    });
    upload.disabled = !opts.canUpload || !opts.account || typeof opts.onUpload !== "function";
    upload.id = "algorithm-upload-button";
    uploadWrap.append(upload);
    uploadWrap.hidden = !isAlgorithmLeaf(byId.get(state.selectedNode).node);
    if (upload.disabled) {
      const explanation = element2("span", "alg-upload-hint", opts.account ? "需要仓库写入权限才能上传" : "登录具有写入权限的账户后可上传");
      explanation.id = `${uid}-upload-hint`;
      upload.setAttribute("aria-describedby", explanation.id);
      uploadWrap.append(explanation);
    }
    top.append(brand, scopeSwitch, uploadWrap);
    const filters = element2("section", "alg-filters");
    filters.setAttribute("aria-label", "检索与筛选");
    const searchRow = element2("div", "alg-search-row");
    const searchWrap = element2("label", "alg-search-wrap");
    const searchIcon = element2("span", "alg-search-icon", "⌕");
    searchIcon.setAttribute("aria-hidden", "true");
    const search = element2("input", "alg-search");
    search.type = "search";
    search.value = state.draftSearch;
    search.placeholder = "搜索算法、路径、笔记标题、标签或作者";
    search.setAttribute("aria-label", "搜索算法、路径、笔记标题、标签或作者");
    searchWrap.append(searchIcon, search);
    const attributeLabel = element2("label", "alg-attribute-label", "属性");
    const attribute = element2("select", "alg-attribute");
    attribute.setAttribute("aria-label", "按类型或使用频率筛选");
    [["", "全部属性"], ...Object.entries(ATTRIBUTES)].forEach(([value, label]) => {
      const option = element2("option", "", label);
      option.value = value;
      attribute.append(option);
    });
    attribute.value = state.draftAttribute;
    attributeLabel.append(attribute);
    const submitSearch = button2("搜索", "alg-button alg-button-primary alg-search-submit", applySearch);
    const clear = button2("清除筛选", "alg-text-button alg-clear", () => {
      state.search = "";
      state.level = "";
      state.attribute = "";
      state.draftSearch = "";
      state.draftLevel = "";
      state.draftAttribute = "";
      state.hasNotes = false;
      state.reading = null;
      search.value = "";
      attribute.value = "";
      refresh({ reset: true, newQuery: true });
      search.focus();
    });
    const hasNotes = button2("仅看已有笔记", "alg-button alg-has-notes", () => {
      state.hasNotes = !state.hasNotes;
      state.reading = null;
      refresh({ reset: !state.hasNotes && !(state.search.trim() || state.level || state.attribute), newQuery: true });
    });
    hasNotes.setAttribute("aria-pressed", String(state.hasNotes));
    searchRow.append(searchWrap, submitSearch, attributeLabel, hasNotes, clear);
    const legend = element2("div", "alg-legend");
    legend.setAttribute("role", "group");
    legend.setAttribute("aria-label", "学习参考难度筛选");
    const legendButtons = [];
    const levelCounts = new Map([...LEVELS.map((level) => [level.id, 0]), ["unrated", 0]]);
    all.forEach((entry) => {
      if (isDirectory(entry.node)) return;
      const level = levelOf(entry.node);
      const key = level ? level.id : "unrated";
      levelCounts.set(key, levelCounts.get(key) + 1);
    });
    const allLevel = button2(`全部 ${all.length}`, "alg-legend-button alg-tone-neutral", () => {
      state.draftLevel = "";
      updateDraftControls();
    });
    allLevel.dataset.level = "";
    legendButtons.push(allLevel);
    legend.append(allLevel);
    [...LEVELS, ...levelCounts.get("unrated") ? [{ id: "unrated", label: "未分级", tone: "neutral", number: "—" }] : []].forEach((level) => {
      const control = button2("", `alg-legend-button alg-tone-${level.tone}`, () => {
        state.draftLevel = state.draftLevel === level.id ? "" : level.id;
        updateDraftControls();
      });
      control.dataset.level = level.id;
      control.append(element2("span", "alg-legend-dot"), element2("span", "", `${level.number} ${level.label}`), element2("span", "alg-legend-count", levelCounts.get(level.id)));
      control.title = `${level.label}：${levelCounts.get(level.id)} 个节点；点击筛选，再次点击取消`;
      legendButtons.push(control);
      legend.append(control);
    });
    const searchHint = element2("p", "alg-tier-hint alg-search-hint");
    searchHint.append(element2("strong", "", "点击搜索按钮才会进行跳转哦，也可以按回车确认。"));
    searchHint.id = `${uid}-search-hint`;
    search.setAttribute("aria-describedby", searchHint.id);
    filters.append(searchRow, searchHint, legend, element2("p", "alg-tier-hint", "目录用于组织知识，不设难度。难度筛选只匹配具体算法与知识点，并保留其上级目录。模板、常用、低频是独立属性。"));
    const workspace = element2("div", "alg-workspace");
    const sidebar = element2("aside", "alg-sidebar");
    const treeHeading = element2("div", "alg-tree-heading");
    const treeStatus = element2("span", "alg-tree-status");
    treeHeading.append(element2("strong", "", "知识目录"), treeStatus);
    const treeScroller = element2("div", "alg-tree-scroll");
    const tree = element2("div", "alg-tree");
    tree.setAttribute("role", "tree");
    tree.setAttribute("aria-label", "算法知识目录");
    tree.setAttribute("aria-describedby", `${uid}-tree-help`);
    treeScroller.append(tree);
    const treeHelp = element2("p", "alg-tree-help", "↑ ↓ 移动 · ← → 折叠 / 展开 · Enter 查看");
    treeHelp.id = `${uid}-tree-help`;
    sidebar.append(treeHeading, treeScroller, treeHelp);
    const pane = element2("section", "alg-pane");
    pane.setAttribute("aria-label", "算法与笔记详情");
    pane.tabIndex = -1;
    const live = element2("span", "alg-sr-only");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    workspace.append(sidebar, pane);
    shell.append(top, filters, workspace, live);
    host.replaceChildren(shell);
    let visible = [];
    let included = /* @__PURE__ */ new Set();
    let matched = /* @__PURE__ */ new Set();
    let matchingNotes = [];
    let focusedId = state.selectedNode;
    let disposed = false, expandedReader = null;
    const treeItems = /* @__PURE__ */ new Map();
    const tooltip = element2("div", "alg-tooltip");
    tooltip.id = `${uid}-tooltip`;
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.append(tooltip);
    const tooltipEvents = new AbortController();
    let tooltipTarget = null;
    function hideTooltip() {
      if (tooltipTarget) {
        const ids = (tooltipTarget.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== tooltip.id);
        if (ids.length) tooltipTarget.setAttribute("aria-describedby", ids.join(" "));
        else tooltipTarget.removeAttribute("aria-describedby");
      }
      tooltipTarget = null;
      tooltip.hidden = true;
    }
    function tooltipFor(target) {
      if (!(target instanceof Element)) return null;
      const item = target.closest("[data-alg-tooltip]") || target.closest(".alg-tree-item")?.querySelector(":scope > .alg-tree-row[data-alg-tooltip]");
      return item && (shell.contains(item) || pane.contains(item)) ? item : null;
    }
    function showTooltip(target) {
      if (target === tooltipTarget) return;
      hideTooltip();
      if (!target?.dataset.algTooltip) return;
      tooltipTarget = target;
      tooltip.textContent = target.dataset.algTooltip;
      target.setAttribute("aria-describedby", [target.getAttribute("aria-describedby"), tooltip.id].filter(Boolean).join(" "));
      tooltip.hidden = false;
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft || 0, top2 = viewport?.offsetTop || 0;
      const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
      tooltip.style.maxWidth = `${Math.min(420, Math.max(0, width - 16))}px`;
      tooltip.style.maxHeight = `${Math.max(0, height - 16)}px`;
      const anchor = target.getBoundingClientRect(), rect = tooltip.getBoundingClientRect();
      tooltip.style.left = `${Math.max(left + 8, Math.min(anchor.left, left + width - rect.width - 8))}px`;
      const below = anchor.bottom + 8;
      tooltip.style.top = `${Math.max(top2 + 8, Math.min(below + rect.height <= top2 + height - 8 ? below : anchor.top - rect.height - 8, top2 + height - rect.height - 8))}px`;
    }
    document.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "touch") showTooltip(tooltipFor(event.target));
    }, { signal: tooltipEvents.signal });
    document.addEventListener("pointerout", (event) => {
      if (tooltipTarget && !tooltipTarget.contains(event.relatedTarget)) showTooltip(tooltipFor(event.relatedTarget));
    }, { signal: tooltipEvents.signal });
    document.addEventListener("focusin", (event) => showTooltip(tooltipFor(event.target)), { signal: tooltipEvents.signal });
    document.addEventListener("focusout", (event) => {
      if (tooltipTarget && !tooltipTarget.contains(event.relatedTarget)) hideTooltip();
    }, { signal: tooltipEvents.signal });
    document.addEventListener("scroll", hideTooltip, { capture: true, passive: true, signal: tooltipEvents.signal });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideTooltip();
    }, { signal: tooltipEvents.signal });
    document.addEventListener("pointerdown", hideTooltip, { signal: tooltipEvents.signal });
    window.addEventListener("resize", hideTooltip, { passive: true, signal: tooltipEvents.signal });
    window.addEventListener("blur", hideTooltip, { signal: tooltipEvents.signal });
    function detailPath() {
      const reading = state.reading && notes.find((note) => noteKey2(note) === state.reading);
      const entries = [];
      let entry = byId.get(reading?.nodeId || state.selectedNode);
      while (entry) {
        entries.unshift(entry);
        entry = byId.get(entry.parent);
      }
      const result = [{ label: "知识树", onClick() {
        expandedReader?.close();
      } }, ...entries.map((item) => ({ label: item.node.label, onClick() {
        selectNode(item.node.id);
      } }))];
      if (reading) result.push({ label: reading.title || "未命名笔记" });
      return result;
    }
    function openDetail() {
      expandedReader = ReadingDetail?.open({ content: pane, mount: host, title: state.reading ? "算法笔记详情" : "知识节点详情", path: detailPath(), onClose() {
        expandedReader = null;
      } });
    }
    let filtering = false;
    function badge(node) {
      if (isDirectory(node)) {
        const directory = element2("span", "alg-node-kind", "目录");
        directory.dataset.algTooltip = "目录用于组织知识，请选择算法叶子阅读笔记";
        return directory;
      }
      const level = levelOf(node);
      const el = element2("span", `alg-badge alg-tone-${level ? level.tone : "neutral"}`, level ? level.label : node.color === "parent" ? "目录" : "未分级");
      const origin = node.difficultySource?.kind === "user-md" ? "用户颜色文档" : node.rating?.type === "category" ? "分类基础门槛" : node.rating?.type === "entry" ? "入口或任务形式" : "本项目逐项定稿";
      const range = node.rating?.range;
      const coverage = range && node.children?.length ? `；覆盖 D${range.min}–D${range.max}` : "";
      el.dataset.algTooltip = level ? `学习难度：${level.label}；依据：${origin}${coverage}${node.scope ? `。学习范围：${node.scope}` : ""}${node.rationale ? `。${node.rationale}` : ""}` : node.color === "parent" ? "目录" : "未指定难度";
      return el;
    }
    function attributeBadge(node) {
      const names = attributesOf(node).map((key) => ATTRIBUTES[key]);
      return names.length ? element2("span", "alg-attribute-badge", names.join(" · ")) : null;
    }
    function pathOf(id) {
      return byId.get(id)?.path.join(" / ") || "未关联目录";
    }
    function matchesFacets(node) {
      const level = levelOf(node);
      return (!state.level || !isDirectory(node) && (state.level === "unrated" ? !level : node.color === state.level)) && (!state.attribute || attributesOf(node).includes(state.attribute));
    }
    const relevance = AlgorithmDirectory;
    const topicScores = /* @__PURE__ */ new Map();
    function computeResults() {
      const q = state.search.trim();
      topicScores.clear();
      filtering = Boolean(q || state.level || state.attribute || state.hasNotes);
      matchingNotes = sortedNotes.filter((note) => {
        const entry = byId.get(note.nodeId);
        if ((state.level || state.attribute) && (!entry || !matchesFacets(entry.node))) return false;
        return relevance.noteScore(note, entry?.node, entry?.path || [], q, nameOf(note.author)) > 0;
      }).sort((a, b) => {
        if (!q) return 0;
        const ae = byId.get(a.nodeId), be = byId.get(b.nodeId);
        return relevance.noteScore(b, be?.node, be?.path || [], q, nameOf(b.author)) - relevance.noteScore(a, ae?.node, ae?.path || [], q, nameOf(a.author));
      });
      const noteNodes = new Set(matchingNotes.map((note) => note.nodeId));
      matched = /* @__PURE__ */ new Set();
      included = /* @__PURE__ */ new Set();
      all.forEach((entry) => {
        const score2 = relevance.topicScore(entry.node, entry.path, q);
        topicScores.set(entry.node.id, score2);
        if (!filtering || matchesFacets(entry.node) && (!state.hasNotes || isAlgorithmLeaf(entry.node) && (counts.get(entry.node.id) || 0) > 0) && (score2 > 0 || noteNodes.has(entry.node.id))) matched.add(entry.node.id);
      });
      matched.forEach((id) => {
        let entry = byId.get(id);
        while (entry) {
          included.add(entry.node.id);
          entry = byId.get(entry.parent);
        }
      });
    }
    function selectNode(id, focusPane) {
      const target = byId.get(id);
      if (!target) return;
      id = target.node.id;
      expandedReader?.close();
      hideTooltip();
      const previous = state.selectedNode;
      state.selectedNode = id;
      state.reading = null;
      state.listScroll = 0;
      state.paneScroll = 0;
      const previousFocus = focusedId;
      focusedId = id;
      expandAncestors(id);
      const oldScroll = treeScroller.scrollTop;
      if (treeItems.has(id)) {
        if (previous) treeItems.get(previous)?.setAttribute("aria-selected", "false");
        if (previousFocus) {
          const row2 = treeItems.get(previousFocus);
          if (row2) row2.tabIndex = -1;
        }
        const row = treeItems.get(id);
        row.setAttribute("aria-selected", "true");
        row.tabIndex = 0;
      } else renderTree();
      treeScroller.scrollTop = oldScroll;
      renderPane();
      pane.scrollTop = 0;
      if (typeof opts.onSelect === "function") opts.onSelect(id);
      if (focusPane) pane.focus({ preventScroll: true });
    }
    function focusRow(id) {
      focusedId = id;
      treeItems.forEach((row, nodeId) => {
        if (row.tabIndex === 0 && nodeId !== id) row.tabIndex = -1;
      });
      const target = treeItems.get(id);
      if (target) target.tabIndex = 0;
      if (target) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
    function isExpanded(id) {
      return filtering ? included.has(id) && !state.expanded.has(`collapsed-filter:${id}`) : state.expanded.has(id);
    }
    function toggle(id, expanded) {
      if (filtering) {
        const key = `collapsed-filter:${id}`;
        if (expanded) state.expanded.delete(key);
        else state.expanded.add(key);
      } else if (expanded) state.expanded.add(id);
      else state.expanded.delete(id);
      const oldScroll = treeScroller.scrollTop;
      renderTree();
      treeScroller.scrollTop = oldScroll;
      focusRow(id);
    }
    function renderTree() {
      hideTooltip();
      treeItems.clear();
      tree.replaceChildren();
      visible = [];
      const hasResults = included.size > 0;
      if (!hasResults) {
        tree.append(element2("p", "alg-tree-empty", "没有匹配的目录或笔记。试试更短的关键词，或清除筛选。"));
      } else {
        let walk2 = function(entry, group, position, size) {
          if (!included.has(entry.node.id)) return;
          const kids = (entry.node.children || []).filter((child) => included.has(child.id));
          const item = element2("div", "alg-tree-item");
          item.setAttribute("role", "treeitem");
          item.dataset.nodeId = entry.node.id;
          treeItems.set(entry.node.id, item);
          item.dataset.depth = String(entry.depth);
          item.dataset.kind = isDirectory(entry.node) ? "directory" : "topic";
          item.setAttribute("aria-level", String(entry.depth + 1));
          item.setAttribute("aria-posinset", String(position));
          item.setAttribute("aria-setsize", String(size));
          item.setAttribute("aria-selected", String(state.selectedNode === entry.node.id));
          item.setAttribute("aria-label", `${entry.node.label}，${levelOf(entry.node)?.label || (isDirectory(entry.node) ? "目录" : "未分级")}${attributesOf(entry.node).length ? `，${attributesOf(entry.node).map((key) => ATTRIBUTES[key]).join("、")}` : ""}，${counts.get(entry.node.id)} 篇笔记`);
          item.tabIndex = -1;
          if (kids.length) item.setAttribute("aria-expanded", String(isExpanded(entry.node.id)));
          const row = element2("div", "alg-tree-row");
          row.style.setProperty("--alg-depth", String(entry.depth));
          if (kids.length) {
            const disclosure = button2(isExpanded(entry.node.id) ? "▾" : "▸", "alg-disclosure", (event) => {
              event.stopPropagation();
              toggle(entry.node.id, !isExpanded(entry.node.id));
            });
            disclosure.tabIndex = -1;
            disclosure.setAttribute("aria-label", `${isExpanded(entry.node.id) ? "折叠" : "展开"} ${entry.node.label}`);
            row.append(disclosure);
          } else {
            const spacer = element2("span", "alg-disclosure alg-leaf", "·");
            spacer.setAttribute("aria-hidden", "true");
            row.append(spacer);
          }
          const copy = element2("span", "alg-tree-copy");
          copy.append(element2("span", "alg-tree-label", entry.node.label));
          const metadata = element2("span", "alg-tree-meta");
          metadata.append(badge(entry.node));
          const attr = attributeBadge(entry.node);
          if (attr) metadata.append(attr);
          copy.append(metadata);
          row.append(copy);
          const count = element2("span", "alg-node-count", counts.get(entry.node.id));
          count.title = "当前范围内含子目录的笔记总数";
          row.append(count);
          row.dataset.algTooltip = `${entry.path.join(" / ")}${entry.node.fullLabel && entry.node.fullLabel !== entry.node.label ? `
${entry.node.fullLabel}` : ""}`;
          if (opts.canManage && typeof opts.onAddTopic === "function") {
            const add = button2("＋", "alg-add-topic", (event) => {
              event.stopPropagation();
              opts.onAddTopic(entry.node.id);
            });
            add.title = `在“${entry.node.label}”下添加算法`;
            add.setAttribute("aria-label", add.title);
            row.append(add);
          }
          row.addEventListener("click", () => {
            selectNode(entry.node.id);
            focusRow(entry.node.id);
          });
          item.addEventListener("focus", (event) => {
            if (event.target === item) {
              focusedId = entry.node.id;
            }
          });
          item.append(row);
          group.append(item);
          visible.push(entry);
          if (kids.length && isExpanded(entry.node.id)) {
            const childGroup = element2("div", "alg-tree-group");
            childGroup.setAttribute("role", "group");
            item.append(childGroup);
            kids.forEach((child, i) => walk2(byId.get(child.id), childGroup, i + 1, kids.length));
          }
        };
        var walk = walk2;
        walk2(byId.get(root.id), tree, 1, 1);
      }
      if (!visible.some((entry) => entry.node.id === focusedId)) focusedId = visible.some((entry) => entry.node.id === state.selectedNode) ? state.selectedNode : visible[0]?.node.id;
      tree.querySelectorAll('[role="treeitem"]').forEach((row) => {
        row.tabIndex = row.dataset.nodeId === focusedId ? 0 : -1;
      });
      treeStatus.textContent = filtering ? `${matched.size} 个匹配` : `${all.length} 个节点`;
    }
    tree.addEventListener("keydown", (event) => {
      if (event.target.closest(".alg-add-topic")) return;
      const item = event.target.closest('[role="treeitem"]');
      if (!item) return;
      const id = item.dataset.nodeId;
      const entry = byId.get(id);
      const i = visible.findIndex((value) => value.node.id === id);
      let next = null;
      if (event.key === "ArrowDown") next = visible[Math.min(i + 1, visible.length - 1)]?.node.id;
      else if (event.key === "ArrowUp") next = visible[Math.max(i - 1, 0)]?.node.id;
      else if (event.key === "Home") next = visible[0]?.node.id;
      else if (event.key === "End") next = visible[visible.length - 1]?.node.id;
      else if (event.key === "ArrowRight") {
        if (item.hasAttribute("aria-expanded")) {
          if (!isExpanded(id)) toggle(id, true);
          else next = visible[i + 1]?.node.id;
        }
      } else if (event.key === "ArrowLeft") {
        if (item.getAttribute("aria-expanded") === "true") toggle(id, false);
        else next = entry.parent;
      } else if (event.key === "Enter" || event.key === " ") {
        selectNode(id);
        focusRow(id);
      } else return;
      event.preventDefault();
      event.stopPropagation();
      if (next != null) focusRow(next);
    });
    function breadcrumbs(id) {
      const nav = element2("nav", "alg-breadcrumbs");
      nav.setAttribute("aria-label", "当前算法路径");
      const ancestors = [];
      let entry = byId.get(id);
      while (entry) {
        ancestors.unshift(entry);
        entry = byId.get(entry.parent);
      }
      ancestors.forEach((ancestor, i) => {
        if (i) {
          const separator = element2("span", "alg-crumb-separator", "/");
          separator.setAttribute("aria-hidden", "true");
          nav.append(separator);
        }
        const crumb = button2(ancestor.node.label, "alg-crumb", () => selectNode(ancestor.node.id));
        if (i === ancestors.length - 1) crumb.setAttribute("aria-current", "page");
        nav.append(crumb);
      });
      return nav;
    }
    function noteMetadata(note) {
      const meta = element2("div", "alg-note-meta");
      if (note.featured) meta.append(element2("span", "alg-featured", "精选"));
      meta.append(element2("span", "alg-note-author", nameOf(note.author)));
      const date = dateOf(note.updatedAt || note.createdAt);
      if (date) meta.append(element2("span", "", date));
      return meta;
    }
    function noteTags(note) {
      const tags = element2("div", "alg-note-tags");
      tagsOf(note).forEach((tag) => tags.append(element2("span", "alg-tag", tag)));
      return tags;
    }
    function openNote(note) {
      state.listScroll = pane.scrollTop;
      state.reading = noteKey2(note);
      state.paneScroll = 0;
      renderPane();
      pane.scrollTop = 0;
      pane.querySelector(".alg-reading-title")?.focus({ preventScroll: true });
    }
    function noteCard(note, globalResult) {
      const card = button2("", `alg-note-card${note.featured ? " alg-note-featured" : ""}`, () => openNote(note));
      card.append(noteMetadata(note), element2("h4", "alg-note-title", note.title || "未命名笔记"));
      const preview = excerpt(note.body);
      if (preview) card.append(element2("p", "alg-note-excerpt", preview));
      card.append(noteTags(note));
      if (globalResult) card.append(element2("span", "alg-note-path", pathOf(note.nodeId)));
      return card;
    }
    function heading(title, count) {
      const row = element2("div", "alg-section-heading");
      row.append(element2("h3", "", title));
      if (count !== void 0) row.append(element2("span", "alg-section-count", count));
      return row;
    }
    function topicCard(entry) {
      const card = button2("", "alg-topic-card", () => selectNode(entry.node.id));
      const name = element2("div", "alg-topic-name");
      name.append(element2("strong", "", entry.node.label), element2("span", "alg-card-arrow", "↗"));
      const meta = element2("div", "alg-topic-meta");
      meta.append(badge(entry.node));
      const attr = attributeBadge(entry.node);
      if (attr) meta.append(attr);
      card.append(name, meta, element2("span", "alg-topic-count", `${entry.descendants} 个子节点 · ${counts.get(entry.node.id)} 篇笔记`));
      return card;
    }
    function renderPane() {
      hideTooltip();
      expandedReader?.setPath(detailPath());
      pane.replaceChildren();
      const selected = byId.get(state.selectedNode);
      const reading = state.reading && notes.find((note) => noteKey2(note) === state.reading);
      if (reading) {
        const back = button2("← 返回目录与笔记", "alg-text-button alg-reader-back", () => {
          state.reading = null;
          renderPane();
          pane.scrollTop = state.listScroll;
          pane.querySelector(".alg-detail-title")?.focus({ preventScroll: true });
        });
        const actions = element2("div", "reading-detail-actions");
        actions.append(back, button2("打开详情 ↗", "alg-button reading-detail-trigger alg-open-detail", openDetail));
        const favorite = noteFavoriteControl({ note: reading, isFavorite: opts.isFavorite, onToggleFavorite: opts.onToggleFavorite });
        if (favorite) actions.append(favorite);
        const management2 = opts.noteActions?.(reading, { isFullscreen: () => Boolean(expandedReader) });
        if (management2) actions.append(management2);
        pane.append(actions, breadcrumbs(reading.nodeId));
        const article = element2("article", "alg-reading");
        const title2 = element2("h2", "alg-reading-title", reading.title || "未命名笔记");
        title2.tabIndex = -1;
        article.append(title2, noteMetadata(reading), noteTags(reading));
        const body = element2("div", "alg-markdown markdown-body");
        if (typeof opts.renderMarkdown === "function") opts.renderMarkdown(body, String(reading.body || ""), true);
        else body.textContent = String(reading.body || "");
        article.append(body);
        if (byId.has(reading.nodeId)) article.append(button2(`在目录中查看：${byId.get(reading.nodeId).node.label}`, "alg-text-button alg-note-location", () => selectNode(reading.nodeId)));
        pane.append(article);
        return;
      }
      pane.append(breadcrumbs(selected.node.id));
      const detail = element2("header", "alg-detail-heading");
      const detailBar = element2("div", "alg-detail-toolbar");
      detailBar.append(element2("span", "alg-eyebrow", isDirectory(selected.node) ? "知识目录" : "算法知识点"), button2("打开详情 ↗", "alg-button reading-detail-trigger alg-open-detail", openDetail));
      detail.append(detailBar);
      const titleRow = element2("div", "alg-detail-title-row");
      const title = element2("h2", "alg-detail-title", selected.node.fullLabel || selected.node.label);
      title.tabIndex = -1;
      titleRow.append(title, badge(selected.node));
      const attr = attributeBadge(selected.node);
      if (attr) titleRow.append(attr);
      detail.append(titleRow);
      pane.append(detail);
      uploadWrap.hidden = !isAlgorithmLeaf(selected.node);
      const utilities = element2("footer", "alg-detail-utilities");
      if (opts.canManage && typeof opts.onAddTopic === "function") utilities.append(button2("＋ 添加算法", "alg-text-button alg-add-topic-detail", () => {
        expandedReader?.close();
        opts.onAddTopic(selected.node.id);
      }));
      const management = opts.topicActions?.(selected.node.id);
      if (management) detailBar.append(management);
      if (typeof opts.onLearningPath === "function") utilities.append(button2("在学习路线中查看 →", "alg-text-button alg-add-topic-detail", () => {
        expandedReader?.close();
        opts.onLearningPath(selected.node.id);
      }));
      if (isAlgorithmLeaf(selected.node)) {
        const storedContent = opts.nodeContents?.find((item) => resolveAlgorithmLeaf(root, item.nodeId)?.id === selected.node.id);
        const content = storedContent && storedContent.nodeId !== selected.node.id ? { ...storedContent, nodeId: selected.node.id, storageNodeId: storedContent.storageNodeId || storedContent.nodeId } : storedContent;
        pane.append(renderLeafReading({
          node: selected.node,
          content,
          notes: sortedNotes.filter((note) => note.nodeId === selected.node.id),
          canManage: Boolean(opts.canManage),
          onSave: opts.onSaveNodeContent ? async (input) => {
            const saved = await opts.onSaveNodeContent(input);
            opts.nodeContents = [...(opts.nodeContents || []).filter((item) => resolveAlgorithmLeaf(root, item.nodeId)?.id !== selected.node.id), saved];
            return saved;
          } : void 0,
          renderMarkdown: opts.renderMarkdown,
          onRead: openNote,
          onUpload: upload.disabled ? void 0 : () => upload.click(),
          authorName: nameOf,
          formatDate: dateOf
        }));
      } else {
        const children = (selected.node.children || []).filter((child) => !filtering || included.has(child.id));
        pane.append(heading(selected.node.id === root.id ? "选择知识主线" : "目录内容", children.length));
        const grid = element2("div", "alg-topic-grid");
        children.forEach((child) => grid.append(topicCard(byId.get(child.id))));
        pane.append(grid);
      }
      if (utilities.childNodes.length) pane.append(utilities);
    }
    function refresh({ reset = false, newQuery = false } = {}) {
      if (disposed) return;
      const oldScroll = treeScroller.scrollTop;
      if (reset) {
        state.expanded = /* @__PURE__ */ new Set([root.id]);
        state.selectedNode = root.id;
        focusedId = root.id;
        state.reading = null;
        state.treeScroll = 0;
      }
      if (newQuery) state.expanded.forEach((key) => {
        if (String(key).startsWith("collapsed-filter:")) state.expanded.delete(key);
      });
      computeResults();
      updateDraftControls();
      clear.hidden = !filtering;
      hasNotes.setAttribute("aria-pressed", String(state.hasNotes));
      renderTree();
      treeScroller.scrollTop = reset ? 0 : oldScroll;
      renderPane();
      pane.scrollTop = 0;
      live.textContent = filtering ? `找到 ${matched.size} 个知识节点、${matchingNotes.length} 篇笔记` : `${all.length} 个知识节点、${notes.length} 篇笔记`;
    }
    function updateDraftControls() {
      legendButtons.forEach((control) => control.setAttribute("aria-pressed", String(control.dataset.level === state.draftLevel)));
      const changed = state.draftSearch !== state.search || state.draftLevel !== state.level || state.draftAttribute !== state.attribute;
      submitSearch.title = changed ? "应用当前关键词、难度和属性" : "刷新搜索结果";
      submitSearch.dataset.pending = String(changed);
      clear.hidden = !(filtering || state.draftSearch || state.draftLevel || state.draftAttribute);
    }
    function applySearch() {
      state.search = state.draftSearch.trim();
      state.level = state.draftLevel;
      state.attribute = state.draftAttribute;
      state.reading = null;
      state.listScroll = 0;
      refresh({ reset: !(state.search.trim() || state.level || state.attribute || state.hasNotes), newQuery: true });
    }
    search.addEventListener("input", () => {
      state.draftSearch = search.value;
      updateDraftControls();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        applySearch();
      }
    });
    attribute.addEventListener("change", () => {
      state.draftAttribute = attribute.value;
      updateDraftControls();
    });
    treeScroller.addEventListener("scroll", () => {
      state.treeScroll = treeScroller.scrollTop;
    }, { passive: true });
    pane.addEventListener("scroll", () => {
      state.paneScroll = pane.scrollTop;
    }, { passive: true });
    refresh();
    treeScroller.scrollTop = state.treeScroll;
    pane.scrollTop = state.paneScroll;
    const controller = {
      selectNode(id) {
        if (!byId.has(id)) return;
        state.search = "";
        state.level = "";
        state.attribute = "";
        state.draftSearch = "";
        state.draftLevel = "";
        state.draftAttribute = "";
        state.hasNotes = false;
        search.value = "";
        attribute.value = "";
        selectNode(id);
        refresh({ newQuery: true });
      },
      getState: snapshot,
      openNote(note, { fullscreen = false } = {}) {
        const found = notes.find((item) => noteKey2(item) === noteKey2(note));
        if (!found) return;
        openNote(found);
        if (fullscreen) openDetail();
      },
      destroy() {
        if (disposed) return;
        expandedReader?.close();
        hideTooltip();
        tooltipEvents.abort();
        tooltip.remove();
        treeItems.clear();
        state.treeScroll = treeScroller.scrollTop;
        state.paneScroll = pane.scrollTop;
        disposed = true;
        if (active === controller) active = null;
      }
    };
    active = controller;
    return controller;
  }
  var AlgorithmBrowser = Object.freeze({ render });
  return __toCommonJS(browser_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookAlgorithms"] = __QMXStandalone["AlgorithmBrowser"];
})();
