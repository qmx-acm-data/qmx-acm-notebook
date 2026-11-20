// Generated from src/renderer/home/daily-problem.ts; run pnpm modules:build.
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

  // src/renderer/home/daily-problem.ts
  var daily_problem_exports = {};
  __export(daily_problem_exports, {
    DailyProblem: () => DailyProblem
  });
  var cachedResult = null;
  var autoDrawStarted = false;
  var sources = [["all", "全部来源"], ["local", "本地题库"], ["public", "公共题库"], ["CF", "Codeforces"], ["LG", "洛谷"], ["AT", "AtCoder"], ["NC", "牛客"], ["LC", "LeetCode"], ["LOJ", "LibreOJ"]];
  var luoguLevels = ["入门", "普及-", "普及", "普及+/提高-", "提高", "提高+/省选-", "省选/NOI-", "NOI/NOI+/CTS"];
  function node(tag, className = "", text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== void 0) element.textContent = text;
    return element;
  }
  function button(label, className, onClick) {
    const element = node("button", className, label);
    element.type = "button";
    element.addEventListener("click", onClick);
    return element;
  }
  function option(value, label) {
    const element = node("option", "", label);
    element.value = value;
    return element;
  }
  function create({ draw: drawApi, openExternal, chooseTags, updateLibrary, autoDraw = false }) {
    const section = node("section", "daily-problem");
    section.setAttribute("aria-labelledby", "daily-problem-title");
    const heading = node("div", "daily-problem-heading"), titleGroup = node("div", "daily-problem-title-group");
    const title = node("h2", "", "每日一题");
    title.id = "daily-problem-title";
    titleGroup.append(node("span", "eyebrow", "DAILY PRACTICE"), title);
    const aside = node("div", "daily-problem-heading-aside");
    const refresh = button("刷新题库", "button subtle daily-refresh", () => refreshLibrary());
    refresh.title = "增量更新本地题库索引";
    aside.append(node("span", "daily-problem-caption", "按今天的状态，抽一道值得做的题"), refresh);
    heading.append(titleGroup, aside);
    const filters = node("div", "daily-problem-filters");
    const source = node("select", "daily-filter-source");
    source.setAttribute("aria-label", "题目来源");
    sources.forEach(([value, label]) => source.append(option(value, label)));
    const ratingMin = node("input", "daily-filter-rating");
    ratingMin.type = "number";
    ratingMin.min = "0";
    ratingMin.max = "3500";
    ratingMin.step = "100";
    ratingMin.placeholder = "Rating ≥";
    ratingMin.setAttribute("aria-label", "最低 Codeforces Rating");
    const ratingMax = node("input", "daily-filter-rating");
    ratingMax.type = "number";
    ratingMax.min = "0";
    ratingMax.max = "3500";
    ratingMax.step = "100";
    ratingMax.placeholder = "Rating ≤";
    ratingMax.setAttribute("aria-label", "最高 Codeforces Rating");
    const lg = node("select", "daily-filter-luogu");
    lg.setAttribute("aria-label", "洛谷难度");
    lg.append(option("", "洛谷难度不限"));
    luoguLevels.forEach((level) => lg.append(option(level, level)));
    let selectedTags = /* @__PURE__ */ new Set();
    const tags = button("算法标签…", "button secondary daily-filter-tags", () => chooseTags(selectedTags, (selected) => {
      selectedTags = new Set(selected);
      tags.textContent = selectedTags.size ? `算法标签…（已选 ${selectedTags.size}）` : "算法标签…";
    }));
    const presetNames = ["动态规划", "图论", "数据结构", "数学", "字符串", "贪心", "二分", "搜索", "树", "构造"];
    const presets = document.createElement("datalist");
    presets.id = `daily-tag-suggestions-${Math.random().toString(36).slice(2)}`;
    presetNames.forEach((tag) => presets.append(option(tag, tag)));
    tags.setAttribute("aria-label", "算法标签");
    tags.setAttribute("aria-haspopup", "dialog");
    filters.append(source, ratingMin, ratingMax, lg, tags, presets);
    const result = node("article", "daily-problem-result");
    const loading = node("div", "daily-problem-loading");
    loading.hidden = true;
    loading.setAttribute("role", "status");
    const loadingCopy = node("div", "daily-loading-copy");
    loadingCopy.append(node("strong", "", "正在抽题…"), node("span", "", "正在请求各平台题库，可能需要十几秒"));
    loading.append(node("span", "daily-loading-spinner"), loadingCopy);
    const error = node("p", "daily-problem-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    const empty = node("p", "daily-problem-empty", "调整筛选后，试试手气。");
    result.append(empty, loading, error);
    const actions = node("div", "daily-problem-actions");
    const draw = button("试试手气", "button primary daily-draw", () => drawProblem());
    const change = button("换一道", "button subtle daily-change", () => drawProblem(true));
    change.hidden = true;
    const easier = button("− 难度", "button subtle daily-easier", () => shiftDifficulty(-1));
    const harder = button("＋ 难度", "button subtle daily-harder", () => shiftDifficulty(1));
    const currentDifficulty = node("span", "daily-current-difficulty", "当前难度：洛谷不限");
    lg.addEventListener("change", updateDifficulty);
    const copy = button("复制链接", "button subtle daily-copy", () => copyLink());
    copy.hidden = true;
    actions.append(draw, copy, change, easier, currentDifficulty, harder);
    section.append(heading, filters, result, actions);
    let current = null, busy = false;
    function readFilters() {
      return {
        source: source.value || void 0,
        platform: ["CF", "LG", "AT", "NC", "LC", "LOJ"].includes(source.value) ? source.value : void 0,
        ratingMin: ratingMin.value ? Number(ratingMin.value) : void 0,
        ratingMax: ratingMax.value ? Number(ratingMax.value) : void 0,
        luoguDifficulty: lg.value || void 0,
        difficulty: lg.value || void 0,
        tags: [...selectedTags]
      };
    }
    function updateDifficulty() {
      currentDifficulty.textContent = `当前难度：洛谷${lg.value || "不限"}`;
    }
    function shiftDifficulty(delta) {
      lg.selectedIndex = Math.max(0, Math.min(luoguLevels.length, lg.selectedIndex + delta));
      updateDifficulty();
    }
    function render(value) {
      current = value.problem;
      cachedResult = value;
      result.replaceChildren();
      const meta = node("div", "daily-problem-meta");
      meta.append(node("span", "daily-source", current.source));
      if (current.rating != null) meta.append(node("span", "daily-rating", `CF ${current.rating}`));
      else if (current.estimatedCfRating != null) meta.append(node("span", "daily-rating daily-estimated", `CF 估算 ${current.estimatedCfRating}`));
      if (current.luoguDifficulty) meta.append(node("span", "daily-luogu", `洛谷 ${current.luoguDifficulty}`));
      if (current.estimatedLuoguDifficulty) meta.append(node("span", "daily-luogu daily-estimated", `洛谷估算 ${current.estimatedLuoguDifficulty}`));
      const footer = node("div", "daily-problem-footer");
      if (current.id) footer.append(node("span", "daily-problem-pid", current.id));
      const url = current.url;
      if (url) {
        const link = node("a", "daily-problem-link", url);
        link.href = url;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        link.addEventListener("click", (event) => {
          event.preventDefault();
          openExternal(url);
        });
        footer.append(link);
      }
      result.append(node("strong", "daily-result-label", "抽取结果："), meta, node("h3", "daily-problem-title", current.title), footer);
      if (current.ratingEstimateReason) result.append(node("p", "daily-problem-note", current.ratingEstimateReason));
      if (value.note) result.append(node("p", "daily-problem-note", value.note));
      result.append(loading, error);
      error.hidden = true;
      change.hidden = false;
      copy.hidden = !url;
    }
    function setBusy(value) {
      busy = value;
      draw.disabled = value;
      change.disabled = value;
      loading.hidden = !value;
      if (value) result.dataset.loading = "true";
      else delete result.dataset.loading;
      result.setAttribute("aria-busy", value ? "true" : "false");
    }
    let refreshing = false;
    async function refreshLibrary() {
      if (refreshing || !updateLibrary) return;
      refreshing = true;
      refresh.disabled = true;
      const label = refresh.textContent;
      refresh.textContent = "更新中…";
      error.hidden = true;
      try {
        const report = await updateLibrary();
        const entries = Object.entries(report?.platforms ?? {});
        const added = entries.reduce((sum, [, item]) => sum + (typeof item?.added === "number" ? item.added : 0), 0);
        const failed = entries.filter(([, item]) => item?.status === "failed").map(([name]) => name);
        refresh.textContent = failed.length ? `已更新 ${added} 题，${failed.join("、")} 失败` : `已更新 ${added} 题`;
        setTimeout(() => {
          if (!refreshing) refresh.textContent = label;
        }, 2600);
      } catch (cause) {
        refresh.textContent = label;
        error.textContent = cause instanceof Error ? cause.message : "题库更新失败";
        error.hidden = false;
      } finally {
        refreshing = false;
        refresh.disabled = false;
      }
    }
    async function drawProblem(excludeCurrent = false) {
      if (busy) return;
      setBusy(true);
      empty.hidden = true;
      error.hidden = true;
      const filters2 = readFilters();
      if (excludeCurrent && current) filters2.excludedIds = [...new Set([current.id, current.url].filter(Boolean))];
      try {
        render(await drawApi(filters2));
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : "抽题失败，请稍后重试。";
        error.hidden = false;
      } finally {
        setBusy(false);
      }
    }
    async function copyLink() {
      if (!current?.url) return;
      try {
        await navigator.clipboard.writeText(current.url);
        copy.textContent = "已复制";
        setTimeout(() => {
          copy.textContent = "复制链接";
        }, 1400);
      } catch (_) {
        error.textContent = "复制失败，请手动打开题目链接。";
        error.hidden = false;
      }
    }
    if (cachedResult) render(cachedResult);
    else if (autoDraw && !autoDrawStarted) {
      autoDrawStarted = true;
      setTimeout(() => {
        void drawProblem();
      }, 260);
    }
    return section;
  }
  var DailyProblem = { create };
  return __toCommonJS(daily_problem_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["DailyProblem"] = __QMXStandalone["DailyProblem"];
})();
