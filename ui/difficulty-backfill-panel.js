// Generated from src/renderer/account/difficulty-backfill-panel.ts; run pnpm modules:build.
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

  // src/renderer/account/difficulty-backfill-panel.ts
  var difficulty_backfill_panel_exports = {};
  __export(difficulty_backfill_panel_exports, {
    DifficultyBackfillPanel: () => DifficultyBackfillPanel,
    mountDifficultyBackfillPanel: () => mountDifficultyBackfillPanel,
    resolveDifficultyBackfillBridge: () => resolveDifficultyBackfillBridge
  });
  var DEFAULT_POLL_MS = 800;
  var CLIST_HINT = "需先在账户设置配置 CLIST 用户名与 API Key";
  var PLATFORM_NAMES = { CF: "Codeforces", AT: "AtCoder", LG: "洛谷", NC: "牛客", LC: "LeetCode", LOJ: "LibreOJ" };
  var PLATFORM_ORDER = ["CF", "AT", "LG", "NC", "LC", "LOJ"];
  var STATUS_LABELS = {
    idle: "空闲",
    running: "运行中",
    pausing: "正在暂停",
    paused: "已暂停",
    done: "已完成",
    failed: "失败"
  };
  var NUMBER_FORMAT = new Intl.NumberFormat("zh-CN");
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function toCount(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  function toStatus(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(STATUS_LABELS, value) ? value : "idle";
  }
  function toText(value) {
    return typeof value === "string" && value.trim() !== "" ? value : void 0;
  }
  function toTime(value) {
    return typeof value === "string" && value.trim() !== "" ? value : null;
  }
  function normalizePlatform(value) {
    const source = isRecord(value) ? value : {};
    return {
      missing: toCount(source.missing),
      ...source.total === void 0 ? {} : { total: toCount(source.total) },
      ...source.clistCached === void 0 ? {} : { clistCached: toCount(source.clistCached) },
      ...source.clistPending === void 0 ? {} : { clistPending: toCount(source.clistPending) },
      ...source.sourceMissing === void 0 ? {} : { sourceMissing: toCount(source.sourceMissing) },
      ...source.resolved === void 0 ? {} : { resolved: toCount(source.resolved) },
      attempted: toCount(source.attempted),
      found: toCount(source.found),
      notFound: toCount(source.notFound),
      noRating: toCount(source.noRating),
      failed: toCount(source.failed)
    };
  }
  function normalizeState(value) {
    const source = isRecord(value) ? value : {};
    const platforms = {};
    if (isRecord(source.platforms)) {
      for (const [key, item] of Object.entries(source.platforms)) platforms[key] = normalizePlatform(item);
    }
    const state = {
      status: toStatus(source.status),
      running: source.running === true,
      pauseRequested: source.pauseRequested === true,
      batchSize: toCount(source.batchSize),
      processed: toCount(source.processed),
      found: toCount(source.found),
      ...source.notFound === void 0 ? {} : { notFound: toCount(source.notFound) },
      ...source.noRating === void 0 ? {} : { noRating: toCount(source.noRating) },
      skipped: toCount(source.skipped),
      failed: toCount(source.failed),
      startedAt: toTime(source.startedAt),
      finishedAt: toTime(source.finishedAt),
      platforms
    };
    const message = toText(source.message);
    if (message !== void 0) state.message = message;
    return state;
  }
  function normalizeClistStatus(value) {
    const source = isRecord(value) ? value : {};
    return {
      configured: source.configured === true,
      username: typeof source.username === "string" && source.username.trim() !== "" ? source.username.trim() : null
    };
  }
  function panelStatus(state) {
    if (!state) return "idle";
    if (state.running) return state.pauseRequested ? "pausing" : "running";
    return state.status;
  }
  function isRunningState(state) {
    if (!state) return false;
    const status = panelStatus(state);
    return status === "running" || status === "pausing";
  }
  function pad(value) {
    return String(value).padStart(2, "0");
  }
  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function formatNumber(value) {
    return NUMBER_FORMAT.format(value);
  }
  function platformRank(key) {
    const index = PLATFORM_ORDER.indexOf(key);
    return index === -1 ? PLATFORM_ORDER.length : index;
  }
  function resolveDifficultyBackfillBridge(candidate) {
    if (!isRecord(candidate)) return null;
    const getStatus = candidate.getDifficultyBackfillStatus;
    const start = candidate.startDifficultyBackfill;
    const pause = candidate.pauseDifficultyBackfill;
    if (typeof getStatus !== "function" || typeof start !== "function" || typeof pause !== "function") return null;
    const getClist = candidate.getClistStatus;
    return {
      getDifficultyBackfillStatus: () => getStatus.call(candidate),
      startDifficultyBackfill: () => start.call(candidate),
      pauseDifficultyBackfill: () => pause.call(candidate),
      ...typeof getClist === "function" ? { getClistStatus: () => getClist.call(candidate) } : {}
    };
  }
  function mountDifficultyBackfillPanel(section, options = {}) {
    const doc = section.ownerDocument;
    const view = doc.defaultView;
    section.classList.add("difficulty-backfill");
    const candidate = options.bridge === void 0 ? resolveDifficultyBackfillBridge(view?.notebook) : options.bridge;
    if (!candidate) {
      section.hidden = true;
      section.replaceChildren();
      return { section, refresh: async () => {
      }, start: () => {
      }, stop: () => {
      }, destroy: () => {
      } };
    }
    const bridge = candidate;
    const pollMs = typeof options.pollMs === "number" && Number.isFinite(options.pollMs) && options.pollMs >= 20 ? Math.floor(options.pollMs) : DEFAULT_POLL_MS;
    const onToast = options.onToast ?? (() => {
    });
    const onError = options.onError ?? (() => {
    });
    let current = null;
    let clist = null;
    let clistFailure = false;
    let actionFailure = null;
    let actionPending = null;
    let refreshing = false;
    let destroyed = false;
    let timer = null;
    function element(tag, className = "", text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== void 0) node.textContent = text;
      return node;
    }
    const heading = element("div", "difficulty-backfill-heading");
    const title = element("h3", "", "CLIST 评分缓存");
    title.id = "difficulty-backfill-heading";
    const summary = element("p", "difficulty-backfill-summary");
    summary.setAttribute("role", "status");
    summary.setAttribute("aria-live", "polite");
    heading.append(title, summary);
    const history = element("p", "difficulty-backfill-history");
    const legacy = element("p", "difficulty-backfill-legacy");
    legacy.hidden = true;
    const intro = element("p", "difficulty-backfill-intro", "所有题目按批查询；有效评分写入本机缓存；没有有效CLIST评分则沿用原生或社区难度。每批默认 100 题，遵守 CLIST 限流。");
    const hint = element("p", "difficulty-backfill-hint", CLIST_HINT);
    hint.setAttribute("role", "status");
    hint.hidden = true;
    const platforms = element("ul", "difficulty-backfill-platforms");
    platforms.setAttribute("aria-label", "各平台 CLIST 评分缓存进度");
    const actions = element("div", "difficulty-backfill-actions");
    const startButton = element("button", "button secondary", "开始缓存");
    startButton.type = "button";
    startButton.dataset.action = "start";
    const pauseButton = element("button", "button secondary", "暂停");
    pauseButton.type = "button";
    pauseButton.dataset.action = "pause";
    actions.append(startButton, pauseButton);
    const error = element("p", "difficulty-backfill-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    section.setAttribute("aria-labelledby", "difficulty-backfill-heading");
    section.replaceChildren(heading, history, legacy, intro, hint, platforms, actions, error);
    section.hidden = false;
    function reportError(failure) {
      actionFailure = failure instanceof Error && failure.message.trim() ? failure.message : "CLIST 评分缓存操作失败，请稍后重试。";
      error.textContent = actionFailure;
      error.hidden = false;
      onError(failure);
    }
    function renderError() {
      if (actionFailure !== null) {
        error.textContent = actionFailure;
        error.hidden = false;
        return;
      }
      if (clistFailure) {
        error.textContent = "CLIST 配置状态读取失败，请稍后在账户设置中检查。";
        error.hidden = false;
        return;
      }
      error.hidden = true;
      error.textContent = "";
    }
    function syncControls() {
      const running = isRunningState(current);
      const pending = actionPending !== null;
      const configured = clist?.configured === true;
      startButton.disabled = pending || running || !configured;
      pauseButton.disabled = actionPending === "pause" || current?.pauseRequested === true || !(running || actionPending === "start");
      startButton.setAttribute("aria-busy", String(actionPending === "start"));
      pauseButton.setAttribute("aria-busy", String(actionPending === "pause"));
      section.setAttribute("aria-busy", String(pending || running));
    }
    function renderRow(key, row) {
      const item = element("li", "difficulty-backfill-row");
      item.dataset.platform = key;
      const line = element("div", "difficulty-backfill-line");
      const name = PLATFORM_NAMES[key] || key;
      line.append(element("span", "difficulty-backfill-name", name));
      if (row.total !== void 0 && row.clistCached !== void 0 && row.clistPending !== void 0) {
        line.append(element("span", "difficulty-backfill-cache", `待查 CLIST ${formatNumber(row.clistPending)} · 已缓存 ${formatNumber(row.clistCached)} / 总题 ${formatNumber(row.total)}`));
      }
      const gaps = element("div", "difficulty-backfill-gaps");
      gaps.append(element("span", "difficulty-backfill-missing", `仍无可用难度 ${formatNumber(row.missing)}`));
      if (row.sourceMissing !== void 0 && row.resolved !== void 0) {
        gaps.append(element("span", "difficulty-backfill-coverage", `原生/社区缺失 ${formatNumber(row.sourceMissing)} · 已补 ${formatNumber(row.resolved)}`));
      }
      const counts = element("div", "difficulty-backfill-counts");
      counts.append(element("span", "difficulty-backfill-attempted", `本批查询 ${formatNumber(row.attempted)}：`));
      counts.append(element("span", "difficulty-backfill-found", `查到 ${formatNumber(row.found)}`));
      counts.append(element("span", "difficulty-backfill-not-found", `未收录 ${formatNumber(row.notFound ?? 0)}`));
      counts.append(element("span", "difficulty-backfill-no-rating", `无评分 ${formatNumber(row.noRating ?? 0)}`));
      counts.append(element("span", "difficulty-backfill-failed", `失败 ${formatNumber(row.failed ?? 0)}`));
      item.append(line, gaps, counts);
      return item;
    }
    function render(state) {
      current = state;
      section.hidden = false;
      const phase = panelStatus(state);
      section.dataset.status = phase;
      const parts = [
        STATUS_LABELS[phase],
        `本批已处理 ${formatNumber(state.processed)} / ${formatNumber(state.batchSize)}`,
        `查到 ${formatNumber(state.found)}`,
        `未收录 ${formatNumber(state.notFound ?? 0)}`,
        `无评分 ${formatNumber(state.noRating ?? 0)}`,
        `请求失败 ${formatNumber(state.failed)}`
      ];
      if (state.startedAt) parts.push(`开始于 ${formatTime(state.startedAt)}`);
      if (state.finishedAt) parts.push(`结束于 ${formatTime(state.finishedAt)}`);
      if (state.message) parts.push(state.message);
      summary.textContent = parts.join(" · ");
      history.textContent = `历史记录跳过 ${formatNumber(state.skipped)} 题（已有 CLIST 正分缓存或台账冷却中，不计入本批）`;
      const entries = Object.entries(state.platforms).sort(([left], [right]) => platformRank(left) - platformRank(right) || left.localeCompare(right));
      const attempted = entries.reduce((total, [, row]) => total + row.attempted, 0);
      const legacyParts = [];
      if (state.processed !== attempted) legacyParts.push("旧批次统计，重新开始后按本批计数");
      if (state.processed > 0 && (state.notFound === void 0 || state.noRating === void 0)) {
        legacyParts.push("旧批次未分原因，后续查询开始分类");
      }
      legacy.textContent = legacyParts.join("；");
      legacy.hidden = legacyParts.length === 0;
      platforms.replaceChildren(...entries.map(([key, row]) => renderRow(key, row)));
      hint.hidden = clist?.configured === true;
      renderError();
      syncControls();
    }
    async function loadClistStatus() {
      const getClist = bridge.getClistStatus;
      if (typeof getClist !== "function") {
        clist = { configured: false, username: null };
        clistFailure = false;
        return;
      }
      try {
        clist = normalizeClistStatus(await getClist());
        clistFailure = false;
      } catch {
        clistFailure = true;
      }
    }
    async function refresh() {
      if (destroyed || refreshing) return;
      refreshing = true;
      try {
        const [state] = await Promise.all([bridge.getDifficultyBackfillStatus(), loadClistStatus()]);
        if (!destroyed) render(normalizeState(state));
      } catch (failure) {
        if (!destroyed) {
          error.textContent = failure instanceof Error && failure.message.trim() ? failure.message : "CLIST 评分缓存进度读取失败，请稍后重试。";
          error.hidden = false;
        }
      } finally {
        refreshing = false;
      }
    }
    function visible() {
      if (!section.isConnected || section.hidden) return false;
      const dialog = section.closest("dialog");
      if (dialog && !dialog.open) return false;
      return section.getClientRects().length > 0;
    }
    function start() {
      if (destroyed || timer !== null || !view) return;
      timer = view.setInterval(() => {
        if (visible()) void refresh();
      }, pollMs);
      if (visible()) void refresh();
    }
    function stop() {
      if (timer === null || !view) {
        timer = null;
        return;
      }
      view.clearInterval(timer);
      timer = null;
    }
    async function runAction(kind, action) {
      if (destroyed) return;
      if (kind === "start") {
        if (actionPending !== null || isRunningState(current) || clist?.configured !== true) return;
      } else if (actionPending === "pause" || current?.pauseRequested === true || !(isRunningState(current) || actionPending === "start")) {
        return;
      }
      actionPending = kind;
      actionFailure = null;
      error.hidden = true;
      syncControls();
      try {
        await action();
      } catch (failure) {
        reportError(failure);
      } finally {
        actionPending = null;
        if (!destroyed) {
          await refresh();
          syncControls();
        }
      }
    }
    startButton.addEventListener("click", () => {
      if (actionPending !== null || isRunningState(current) || clist?.configured !== true) return;
      void runAction("start", async () => {
        render(normalizeState(await bridge.startDifficultyBackfill()));
        onToast("已开始 CLIST 评分缓存，进度会在后台继续");
      });
    });
    pauseButton.addEventListener("click", () => {
      if (actionPending === "pause" || current?.pauseRequested === true || !(isRunningState(current) || actionPending === "start")) return;
      void runAction("pause", async () => {
        render(normalizeState(await bridge.pauseDifficultyBackfill()));
        onToast("已请求暂停，CLIST 评分缓存将在当前题目完成后停止");
      });
    });
    start();
    syncControls();
    return {
      section,
      refresh,
      start,
      stop,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        stop();
        section.replaceChildren();
      }
    };
  }
  var DifficultyBackfillPanel = Object.freeze({ mount: mountDifficultyBackfillPanel });
  return __toCommonJS(difficulty_backfill_panel_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookDifficultyBackfillPanel"] = __QMXStandalone["DifficultyBackfillPanel"];
})();
