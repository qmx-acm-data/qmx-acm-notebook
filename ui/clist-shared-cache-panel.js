// Generated from src/renderer/account/clist-shared-cache-panel.ts; run pnpm modules:build.
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

  // src/renderer/account/clist-shared-cache-panel.ts
  var clist_shared_cache_panel_exports = {};
  __export(clist_shared_cache_panel_exports, {
    ClistSharedCachePanel: () => ClistSharedCachePanel,
    mountClistSharedCachePanel: () => mountClistSharedCachePanel,
    resolveClistSharedCacheBridge: () => resolveClistSharedCacheBridge
  });
  var PLATFORM_ORDER = ["CF", "AT", "LG", "NC", "LC", "LOJ"];
  var PLATFORM_NAMES = { CF: "Codeforces", AT: "AtCoder", LG: "洛谷", NC: "牛客", LC: "LeetCode", LOJ: "LibreOJ" };
  var NUMBER_FORMAT = new Intl.NumberFormat("zh-CN");
  var INVALID_STATUS = "CLIST 共享缓存状态无效，请稍后重试。";
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function count(value) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(INVALID_STATUS);
    return value;
  }
  function timestamp(value) {
    if (value === null) return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(INVALID_STATUS);
    return value;
  }
  function sharedUrl(value) {
    const text = value.trim();
    if (!text) throw new Error("请输入共享缓存文件的 HTTPS 地址。");
    let parsed;
    try {
      parsed = new URL(text);
    } catch {
      throw new Error("共享缓存文件地址必须是有效的 HTTPS 地址。");
    }
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error("共享缓存文件地址必须是有效且不含用户名或密码的 HTTPS 地址。");
    return text;
  }
  function normalizeStatus(value) {
    if (!isRecord(value) || !isRecord(value.platforms) || !(value.sourceUrl === null || typeof value.sourceUrl === "string")) throw new Error(INVALID_STATUS);
    return {
      total: count(value.total),
      ...value.initialTotal === void 0 ? {} : { initialTotal: count(value.initialTotal) },
      ...value.libraryTotal === void 0 ? {} : { libraryTotal: count(value.libraryTotal) },
      ...value.libraryMatched === void 0 ? {} : { libraryMatched: count(value.libraryMatched) },
      ...value.initialAppliedAt === void 0 ? {} : { initialAppliedAt: timestamp(value.initialAppliedAt) ?? void 0 },
      platforms: Object.fromEntries(Object.entries(value.platforms).map(([key, value2]) => [key, count(value2)])),
      oldestQuery: timestamp(value.oldestQuery),
      newestQuery: timestamp(value.newestQuery),
      sourceUrl: value.sourceUrl === null ? null : sharedUrl(value.sourceUrl),
      lastSyncedAt: timestamp(value.lastSyncedAt)
    };
  }
  function normalizeExport(value) {
    if (!isRecord(value) || typeof value.canceled !== "boolean") throw new Error("CLIST 缓存导出结果无效，请稍后重试。");
    return { canceled: value.canceled, status: normalizeStatus(value.status) };
  }
  function normalizeResult(value) {
    if (!isRecord(value) || typeof value.canceled !== "boolean") throw new Error("CLIST 缓存合并结果无效，请稍后重试。");
    return { canceled: value.canceled, imported: count(value.imported), updated: count(value.updated), kept: count(value.kept), ignored: count(value.ignored), status: normalizeStatus(value.status) };
  }
  function failureText(failure) {
    return failure instanceof Error && failure.message.trim() ? failure.message : "CLIST 共享缓存操作失败，请稍后重试。";
  }
  function resolveClistSharedCacheBridge(candidate) {
    if (!isRecord(candidate)) return null;
    const getStatus = candidate.getClistSharedCacheStatus;
    const exportCache = candidate.exportClistSharedCache;
    const importCache = candidate.importClistSharedCache;
    const syncCache = candidate.syncClistSharedCache;
    if (typeof getStatus !== "function" || typeof exportCache !== "function" || typeof importCache !== "function" || typeof syncCache !== "function") return null;
    return {
      getClistSharedCacheStatus: async () => normalizeStatus(await getStatus.call(candidate)),
      exportClistSharedCache: async () => normalizeExport(await exportCache.call(candidate)),
      importClistSharedCache: async () => normalizeResult(await importCache.call(candidate)),
      syncClistSharedCache: async (url) => normalizeResult(await syncCache.call(candidate, url))
    };
  }
  function mountClistSharedCachePanel(section, options = {}) {
    const doc = section.ownerDocument;
    const view = doc.defaultView;
    section.classList.add("clist-shared-cache");
    const candidate = resolveClistSharedCacheBridge(options.bridge === void 0 ? view?.notebook : options.bridge);
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
    const pollMs = typeof options.pollMs === "number" && Number.isFinite(options.pollMs) && options.pollMs >= 20 ? Math.floor(options.pollMs) : 800;
    let current = null;
    let pending = null;
    let actionFailure = null;
    let refreshing = false;
    let destroyed = false;
    let timer = null;
    let actionVersion = 0;
    let urlEdited = false;
    let urlRevision = 0;
    function element(tag, className = "", text) {
      const node = doc.createElement(tag);
      node.className = className;
      if (text !== void 0) node.textContent = text;
      return node;
    }
    const heading = element("div", "clist-shared-cache-heading");
    const title = element("h3", "", "CLIST 缓存共享");
    title.id = "clist-shared-cache-heading";
    const summary = element("p", "clist-shared-cache-summary", "正在读取 CLIST 缓存状态…");
    summary.setAttribute("role", "status");
    summary.setAttribute("aria-live", "polite");
    heading.append(title, summary);
    const intro = element("p", "clist-shared-cache-intro", "仅共享 CLIST 真实正分。无需 Key，共享文件导入后与本机缓存按查询时间合并，保留个人缓存和单题刷新。");
    const history = element("p", "clist-shared-cache-history");
    const platforms = element("ul", "clist-shared-cache-platforms");
    platforms.setAttribute("aria-label", "各平台 CLIST 正分缓存数量");
    const actions = element("div", "clist-shared-cache-actions");
    const exportButton = element("button", "button secondary", "导出 CLIST 缓存");
    const importButton = element("button", "button secondary", "导入并合并缓存");
    exportButton.type = "button";
    exportButton.dataset.action = "export";
    importButton.type = "button";
    importButton.dataset.action = "import";
    actions.append(exportButton, importButton);
    const uploadNote = element("p", "clist-shared-cache-note", "导出后可放到你选定的公共下载位置，本客户端不会自动上传");
    const urlLabel = element("label", "clist-shared-cache-url-label", "共享缓存文件地址（可选）");
    const urlInput = element("input", "clist-shared-cache-url");
    urlInput.id = "clist-shared-cache-url";
    urlInput.type = "text";
    urlInput.inputMode = "url";
    urlInput.placeholder = "https://…";
    urlInput.autocomplete = "off";
    urlInput.spellcheck = false;
    urlLabel.htmlFor = urlInput.id;
    const syncButton = element("button", "button secondary", "同步共享缓存");
    syncButton.type = "button";
    syncButton.dataset.action = "sync";
    const syncRow = element("div", "clist-shared-cache-sync");
    syncRow.append(urlInput, syncButton);
    const syncNote = element("p", "clist-shared-cache-note", "填写 HTTPS 共享缓存文件地址后，每个人都无需 Key 即可获取共享基线。刷新评分仍使用个人 CLIST 配置。");
    const resultSummary = element("p", "clist-shared-cache-result");
    resultSummary.hidden = true;
    resultSummary.setAttribute("role", "status");
    resultSummary.setAttribute("aria-live", "polite");
    const error = element("p", "clist-shared-cache-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    section.setAttribute("aria-labelledby", title.id);
    section.replaceChildren(heading, intro, history, platforms, actions, uploadNote, urlLabel, syncRow, syncNote, resultSummary, error);
    section.hidden = false;
    function syncControls() {
      for (const button of [exportButton, importButton, syncButton]) {
        button.disabled = pending !== null;
        button.setAttribute("aria-busy", String(button.dataset.action === pending));
      }
      section.setAttribute("aria-busy", String(pending !== null));
    }
    function showError(message) {
      error.textContent = message;
      error.hidden = false;
    }
    function fillSavedUrl() {
      if (!urlEdited && doc.activeElement !== urlInput && current) urlInput.value = current.sourceUrl ?? "";
    }
    function render(state) {
      if (destroyed) return;
      current = state;
      summary.textContent = `有效 CLIST 评分 ${NUMBER_FORMAT.format(state.total)} 条`;
      history.textContent = [state.libraryMatched !== void 0 && state.libraryTotal !== void 0 ? `本地题库已匹配 ${NUMBER_FORMAT.format(state.libraryMatched)} / ${NUMBER_FORMAT.format(state.libraryTotal)} 题` : "", state.initialTotal === void 0 ? "" : `内置基线 ${NUMBER_FORMAT.format(state.initialTotal)} 条（不等于本地题库匹配 ${NUMBER_FORMAT.format(state.initialTotal)} 条）`, state.initialAppliedAt ? `基线合并：${state.initialAppliedAt}` : "", `最近同步：${state.lastSyncedAt ?? "尚未同步"}`, state.newestQuery ? `最新查询：${state.newestQuery}` : ""].filter(Boolean).join(" · ");
      const keys = [...PLATFORM_ORDER, ...Object.keys(state.platforms).filter((key) => !PLATFORM_ORDER.includes(key))];
      platforms.replaceChildren(...keys.map((key) => {
        const row = element("li", "clist-shared-cache-row");
        row.dataset.platform = key;
        const name = element("span", "clist-shared-cache-name", Object.prototype.hasOwnProperty.call(PLATFORM_NAMES, key) ? PLATFORM_NAMES[key] : key);
        const counts = element("span", "clist-shared-cache-counts", `${NUMBER_FORMAT.format(Object.prototype.hasOwnProperty.call(state.platforms, key) ? state.platforms[key] : 0)} 题`);
        row.append(name, counts);
        return row;
      }));
      fillSavedUrl();
      if (actionFailure !== null) showError(actionFailure);
      else {
        error.hidden = true;
        error.textContent = "";
      }
      syncControls();
    }
    function visible() {
      return section.isConnected && !section.hidden && section.closest("dialog")?.open === true && section.getClientRects().length > 0;
    }
    async function refresh() {
      if (destroyed || refreshing || pending !== null || !visible()) return;
      refreshing = true;
      const version = actionVersion;
      try {
        const state = await bridge.getClistSharedCacheStatus();
        if (!destroyed && version === actionVersion) render(state);
      } catch (failure) {
        if (!destroyed && version === actionVersion) showError(actionFailure ?? failureText(failure));
      } finally {
        refreshing = false;
      }
    }
    function start() {
      if (destroyed || timer !== null || !view) return;
      timer = view.setInterval(() => {
        if (visible()) void refresh();
      }, pollMs);
      if (visible()) void refresh();
    }
    function stop() {
      if (timer !== null && view) view.clearInterval(timer);
      timer = null;
    }
    async function runAction(kind) {
      if (destroyed || pending !== null) return;
      let url = "";
      if (kind === "sync") {
        try {
          url = sharedUrl(urlInput.value);
        } catch (failure) {
          actionFailure = failureText(failure);
          showError(actionFailure);
          return;
        }
      }
      const submittedRevision = urlRevision;
      pending = kind;
      actionFailure = null;
      actionVersion += 1;
      error.hidden = true;
      syncControls();
      try {
        if (kind === "export") {
          const result = await bridge.exportClistSharedCache();
          if (!destroyed) {
            render(result.status);
            if (!result.canceled) options.onToast?.("CLIST 缓存已导出");
          }
        } else {
          const result = kind === "import" ? await bridge.importClistSharedCache() : await bridge.syncClistSharedCache(url);
          if (!destroyed) {
            if (!result.canceled && kind === "sync" && urlRevision === submittedRevision) urlEdited = false;
            render(result.status);
            if (!result.canceled) {
              const text = `新增${result.imported} 更新${result.updated} 保留${result.kept} 忽略零值${result.ignored}`;
              resultSummary.textContent = text;
              resultSummary.hidden = false;
              options.onToast?.(text);
            }
          }
        }
      } catch (failure) {
        if (!destroyed) {
          actionFailure = failureText(failure);
          showError(actionFailure);
          options.onError?.(failure);
        }
      } finally {
        pending = null;
        actionVersion += 1;
        if (!destroyed) syncControls();
      }
    }
    urlInput.addEventListener("input", () => {
      urlEdited = true;
      urlRevision += 1;
    });
    urlInput.addEventListener("blur", fillSavedUrl);
    exportButton.addEventListener("click", () => {
      void runAction("export");
    });
    importButton.addEventListener("click", () => {
      void runAction("import");
    });
    syncButton.addEventListener("click", () => {
      void runAction("sync");
    });
    syncControls();
    start();
    return { section, refresh, start, stop, destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      section.replaceChildren();
    } };
  }
  var ClistSharedCachePanel = Object.freeze({ mount: mountClistSharedCachePanel });
  return __toCommonJS(clist_shared_cache_panel_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookClistSharedCachePanel"] = __QMXStandalone["ClistSharedCachePanel"];
})();
