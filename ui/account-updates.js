// Generated from src/renderer/account/updates.ts; run pnpm modules:build.
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

  // src/renderer/account/updates.ts
  var updates_exports = {};
  __export(updates_exports, {
    Updates: () => Updates
  });
  function create(options) {
    const { demo, bridge, getAppVersion, getUpdate, setUpdate, getUpdateCapability, getBusy, setBusy, call, cancelDraftSave, getLocalWrite, resetLocalWrite, hasEditor, saveDraft, persistLocal, renderAccount, toast, errorMessage } = options;
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => Array.from(document.querySelectorAll(selector));
    let updateRunning = false;
    let updateReady = false;
    function renderUpdate() {
      $("#app-version").textContent = getAppVersion() || (demo ? "浏览器预览（非桌面客户端）" : "尚未获取");
      const update = getUpdate() || {};
      if (getUpdateCapability()?.supported === false) $("#update-notice").textContent = getUpdateCapability().reason;
      const latest = update.latestVersion ? ` ${update.latestVersion}` : "";
      const labels = { checking: "正在检查更新…", available: `发现新版本${latest}，可点击检查更新进行升级。`, downloading: `正在下载新版本${latest}…`, ready: `新版本${latest}的签名和文件已校验，正在准备更新。`, installing: "本地记录已备份，退出后将备份并替换程序文件，完成后自动重启。", error: "更新失败，请点击检查更新重试。" };
      let text = labels[update.phase] || (update.available === false && !!update.message ? `当前版本 ${getAppVersion() || update.currentVersion || "未知"}，暂无可用更新。` : "可随时检查更新，无需登录 GitHub。");
      if (update.phase === "checking" || update.phase === "available" || update.phase === "downloading" || update.phase === "ready" || update.phase === "installing" || update.phase === "error" || update.available === false) {
        if (update.message) text += ` ${update.message}`;
      }
      const progress = $("#update-progress");
      progress.hidden = update.phase !== "downloading";
      const percent = typeof update.percent === "number" && Number.isFinite(update.percent) ? update.percent : typeof update.total === "number" && update.total > 0 && Number.isFinite(update.downloaded) ? update.downloaded / update.total * 100 : null;
      if (percent === null) progress.removeAttribute("value");
      else {
        progress.value = Math.min(100, Math.max(0, percent));
        if (!progress.hidden) text += ` ${Math.round(progress.value)}%`;
      }
      if (!progress.hidden && Number.isFinite(update.downloaded) && Number.isFinite(update.total) && update.total > 0) text += `（${(update.downloaded / 1048576).toFixed(1)} / ${(update.total / 1048576).toFixed(1)} MB）`;
      if (update.downloadKind === "delta" && Number.isFinite(update.total) && Number.isFinite(update.fullSize) && update.fullSize > update.total) {
        text += ` 差分下载 ${(update.total / 1048576).toFixed(2)} MB，完整包 ${(update.fullSize / 1048576).toFixed(1)} MB。`;
      }
      if (update.downloadKind === "delta" && update.deltaSteps > 1) text += ` 连续应用 ${update.deltaSteps} 个补丁，完成后统一安装。`;
      if (update.downloadKind === "full" && ["available", "downloading", "ready"].includes(update.phase)) {
        const reasons = { "no-patch-path": "未找到从当前版本到新版的完整补丁链", "base-mismatch": "本机应用文件与补丁基础包不匹配", "metadata-unavailable": "差分清单或历史记录暂不可用", "patch-failed": "补丁下载、重建或校验失败" };
        if (reasons[update.deltaReason]) text += ` 使用完整包：${reasons[update.deltaReason]}。`;
      }
      $("#update-status").textContent = text;
      $("#update-status").classList.toggle("update-error", update.phase === "error");
      $("#check-update-button").textContent = updateReady && update.phase === "error" ? "重试安装" : "检查更新";
    }
    function receiveUpdate(update) {
      if (!update || typeof update !== "object") return;
      setUpdate(update.phase === "checking" ? { ...update } : { ...getUpdate(), ...update });
      renderUpdate();
    }
    async function saveBeforeUpdate() {
      cancelDraftSave();
      try {
        await getLocalWrite();
      } catch (error) {
        resetLocalWrite();
        throw new Error(`本地数据尚未保存，更新已停止：${errorMessage(error)}`);
      }
      try {
        if (hasEditor()) await saveDraft(true);
        else await persistLocal();
      } catch (error) {
        resetLocalWrite();
        throw error;
      }
    }
    async function checkForUpdates() {
      if (getBusy() || updateRunning) return;
      if (demo) {
        receiveUpdate({ phase: "error", message: "浏览器预览不连接更新服务，请在桌面客户端检查更新。" });
        return;
      }
      updateRunning = true;
      setBusy(true);
      let installing = false;
      try {
        if (!updateReady) {
          receiveUpdate({ phase: "checking" });
          const checked = await call("checkForUpdates");
          if (!checked || checked.phase === "error") throw new Error(checked?.message || "检查更新失败");
          receiveUpdate(checked);
          if (!checked.available) return;
          if (getUpdateCapability()?.supported === false) {
            receiveUpdate({ ...checked, message: getUpdateCapability().reason });
            toast(getUpdateCapability().reason);
            return;
          }
          await saveBeforeUpdate();
          receiveUpdate({ phase: "downloading", percent: 0, downloaded: 0, total: 0 });
          const downloaded = await call("downloadUpdate");
          if (downloaded?.phase !== "ready") throw new Error(downloaded?.message || "下载未完成或安装包未通过校验");
          updateReady = true;
          receiveUpdate(downloaded);
        }
        await saveBeforeUpdate();
        const result = await call("installUpdate");
        if (result?.installing !== true) throw new Error(result?.message || "安装程序未能启动");
        installing = true;
        receiveUpdate({ phase: "installing" });
      } catch (error) {
        receiveUpdate({ phase: "error", message: errorMessage(error) });
      } finally {
        if (!installing) {
          setBusy(false);
          updateRunning = false;
        }
      }
    }
    if (typeof bridge?.onUpdateProgress === "function") bridge.onUpdateProgress((update) => {
      if (update?.phase === "error") updateReady = false;
      receiveUpdate(update);
    });
    $("#check-update-button").addEventListener("click", checkForUpdates);
    let startupUpdatePending = null;
    function showStartupUpdate() {
      if (!startupUpdatePending || getBusy() || updateRunning || document.querySelector("dialog[open]")) return;
      $("#startup-update-version").textContent = startupUpdatePending.latestVersion || startupUpdatePending.version;
      startupUpdatePending = null;
      $("#startup-update-dialog").showModal();
    }
    async function checkStartupUpdates() {
      if (demo || typeof bridge?.checkStartupUpdates !== "function") return;
      try {
        const result = await call("checkStartupUpdates");
        if (!result?.available || result.phase !== "available") return;
        startupUpdatePending = result;
        showStartupUpdate();
      } catch {
      }
    }
    function dismissStartupUpdate() {
      startupUpdatePending = null;
      $("#startup-update-dialog").close();
    }
    $("#startup-update-close").addEventListener("click", dismissStartupUpdate);
    $("#startup-update-later").addEventListener("click", dismissStartupUpdate);
    $("#startup-update-dialog").addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismissStartupUpdate();
    });
    $("#startup-update-now").addEventListener("click", () => {
      dismissStartupUpdate();
      renderAccount();
      $("#account-dialog").showModal();
      void checkForUpdates();
    });
    $$("dialog").forEach((dialog) => dialog.addEventListener("close", showStartupUpdate));
    return { renderUpdate, receiveUpdate, saveBeforeUpdate, checkForUpdates, showStartupUpdate, checkStartupUpdates, dismissStartupUpdate, get updateRunning() {
      return updateRunning;
    }, get updateReady() {
      return updateReady;
    } };
  }
  var Updates = Object.freeze({ create });
  return __toCommonJS(updates_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookUpdates"] = __QMXStandalone["Updates"];
})();
