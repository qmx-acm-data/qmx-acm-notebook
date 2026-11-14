// Generated from src/renderer/home/contests.ts; run pnpm modules:build.
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

  // src/renderer/home/contests.ts
  var contests_exports = {};
  __export(contests_exports, {
    HomeContests: () => HomeContests
  });
  function create({ demo, getSettings, setSettings, getView, getLoading, canRefresh, call, writeDemo, toast, errorMessage, openExternal }) {
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== void 0) node.textContent = String(text);
      return node;
    }
    function append(parent, ...children) {
      children.forEach((child) => {
        if (child) parent.append(child);
      });
      return parent;
    }
    function button(label, className, action) {
      const node = element("button", className, label);
      node.type = "button";
      node.addEventListener("click", action);
      return node;
    }
    const contestPlatforms = [
      { id: "luogu", name: "洛谷", url: "https://www.luogu.com.cn/contest/list" },
      { id: "codeforces", name: "Codeforces", url: "https://codeforces.com/contests" },
      { id: "atcoder", name: "AtCoder", url: "https://atcoder.jp/contests/" },
      { id: "nowcoder", name: "牛客", url: "https://ac.nowcoder.com/acm/contest/vip-index" }
    ];
    let contestData = null, contestsPending = false, contestsFailed = false, contestSignature = "", contestPreferencePending = false;
    let contestRestoreEntries = [], contestRestoreSelection = /* @__PURE__ */ new Set();
    const contestRefreshPeriod = 10 * 60 * 1e3;
    let lastContestAttempt = null, contestRefreshTimer;
    const contestTimeFormat = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    let started = false;
    function acceptContests(payload) {
      if (!payload || !Array.isArray(payload.platforms)) return false;
      const incoming = payload;
      const previous = contestData;
      contestData = { ...incoming, platforms: contestPlatforms.map((platform) => {
        const source = incoming.platforms.find((item) => item?.id === platform.id);
        if (!source) return previous?.platforms.find((item) => item.id === platform.id) || { ...platform, contests: [], updatedAt: null, stale: false, error: null };
        const old = previous?.platforms.find((item) => item.id === platform.id);
        const contests = Array.isArray(source.contests) ? source.contests : [];
        return { ...platform, ...source, contests: source.error && !contests.length && old?.contests.length ? old.contests : contests, updatedAt: source.updatedAt || (source.error ? old?.updatedAt : null), stale: !!source.stale || !!source.error };
      }) };
      return true;
    }
    function contestTimestamp(value) {
      const time = typeof value === "string" ? Date.parse(value) : NaN;
      return Number.isFinite(time) ? time : null;
    }
    function contestTime(value) {
      const time = contestTimestamp(value);
      return time === null ? "暂无更新时间" : contestTimeFormat.format(time);
    }
    function contestDuration(milliseconds) {
      const seconds = Math.max(0, Math.ceil(milliseconds / 1e3));
      const days = Math.floor(seconds / 86400), hours = Math.floor(seconds / 3600) % 24, minutes = Math.floor(seconds / 60) % 60, rest = seconds % 60;
      return `${days ? `${days}天 ` : ""}${days || hours ? `${hours}小时 ` : ""}${days || hours || minutes ? `${minutes}分 ` : ""}${rest}秒`;
    }
    function atcoderContestType(platformId, contest) {
      if (platformId !== "atcoder") return null;
      const definitions = [
        ["ABC", "AtCoder Beginner Contest"],
        ["ARC", "AtCoder Regular Contest"],
        ["AGC", "AtCoder Grand Contest"],
        ["AHC", "AtCoder Heuristic Contest"]
      ];
      const idType = /^(abc|arc|agc|ahc)\d+$/i.exec(String(contest.id || ""))?.[1].toUpperCase();
      const definition = definitions.find(([type]) => type === idType) || definitions.find(([, name]) => String(contest.title || "").toLowerCase().includes(name.toLowerCase()));
      return definition ? { label: definition[0], name: definition[1] } : null;
    }
    function contestTypeBadge(platformId, contest) {
      const type = atcoderContestType(platformId, contest);
      if (!type) return null;
      const badge = element("span", "contest-type-badge", type.label);
      badge.title = type.name;
      badge.setAttribute("aria-label", `${type.label} · ${type.name}`);
      return badge;
    }
    function contestKey(platformId, contestId) {
      return `${platformId}:${String(contestId)}`;
    }
    function optedOutContests() {
      const settings = getSettings();
      return Array.isArray(settings?.contestOptOuts) ? settings.contestOptOuts.map(String) : [];
    }
    function isContestOptedOut(platformId, contestId) {
      return optedOutContests().includes(contestKey(platformId, contestId));
    }
    async function setContestOptOut(platformId, contestId, optedOut) {
      if (contestPreferencePending) return;
      contestPreferencePending = true;
      const key = contestKey(platformId, contestId), previous = optedOutContests();
      const next = optedOut ? [.../* @__PURE__ */ new Set([...previous, key])] : previous.filter((item) => item !== key);
      setSettings({ ...getSettings(), contestOptOuts: next });
      renderContestCards();
      try {
        if (demo) writeDemo();
        else await call("saveSettings", { ...getSettings() });
        toast(optedOut ? "已标记为不参加，比赛已隐藏" : "已恢复这场比赛");
      } catch (error) {
        setSettings({ ...getSettings(), contestOptOuts: previous });
        renderContestCards();
        toast(`比赛偏好未保存：${errorMessage(error)}`);
      } finally {
        contestPreferencePending = false;
        updateContestPreferenceControls();
      }
    }
    function visibleContests(platform, now) {
      return (platform?.contests || []).map((contest) => ({ ...contest, start: contestTimestamp(contest.startTime), end: contestTimestamp(contest.endTime) })).filter((contest) => contest.start !== null && contest.end !== null && contest.end > contest.start && contest.end > now && !isContestOptedOut(platform.id, contest.id)).sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id))).slice(0, 3);
    }
    function contestLink(label, url, className, focusKey) {
      const link = element("a", className, label);
      link.href = url;
      link.dataset.contestFocus = focusKey;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void openExternal(url);
      });
      return link;
    }
    function updateContestStatus() {
      const refresh = $("#contests-refresh"), status = $("#contests-status");
      if (!refresh || !status) return;
      const available = canRefresh();
      refresh.disabled = contestsPending || !available;
      refresh.textContent = contestsPending ? "刷新中…" : "刷新赛程";
      refresh.setAttribute("aria-busy", String(contestsPending));
      status.classList.toggle("contest-status-error", contestsFailed);
      status.textContent = !available ? contestData ? "当前客户端暂不支持刷新赛程，正在显示已保存的安排。请以官方赛程为准。" : "当前预览或客户端未提供赛程，暂无可用日程。可前往各平台查看官方安排。" : contestsPending ? contestData ? "正在更新赛程，先显示已保存的安排。" : "正在获取各平台赛程…" : contestsFailed ? contestData ? "赛程刷新失败，已保留上次安排。请稍后重试，或查看官方赛程。" : "赛程获取失败，暂无可用日程。请稍后重试，或查看官方赛程。" : contestData ? "已显示最近的进行中与即将开始比赛；赛程以官方安排为准。" : "暂无可用赛程，请刷新或查看官方安排。";
    }
    function updateContestPreferenceControls() {
      const restore = $("#contests-restore");
      if (restore) {
        const count = optedOutContests().length;
        restore.hidden = count === 0;
        restore.disabled = contestPreferencePending;
        restore.textContent = `已隐藏 ${count} 场 · 恢复`;
      }
      $$(".contest-decline").forEach((node) => {
        node.disabled = contestPreferencePending;
      });
    }
    function mergedContests(now) {
      return contestPlatforms.flatMap((platform) => visibleContests(contestData?.platforms.find((item) => item.id === platform.id), now).map((contest) => ({ ...contest, platform }))).sort((a, b) => Number(b.start <= now) - Number(a.start <= now) || a.start - b.start || a.platform.id.localeCompare(b.platform.id) || String(a.id).localeCompare(String(b.id)));
    }
    function renderContestCards(now = Date.now()) {
      const grid = $("#contest-platforms");
      if (!grid) return;
      const activeFocusNode = grid.contains(document.activeElement) ? document.activeElement : null;
      const focus = activeFocusNode?.dataset.contestFocus || null;
      grid.replaceChildren();
      const sources = element("div", "contest-sources");
      for (const platform of contestPlatforms) {
        const source = contestData?.platforms.find((item) => item.id === platform.id);
        const items2 = visibleContests(source, now);
        const chip = element("div", "contest-source");
        chip.dataset.platform = platform.id;
        const status = !source ? "尚未获取" : source.error ? items2.length ? "更新失败 · 保留赛程" : "获取失败" : source.stale ? "缓存待更新" : items2.length ? "已更新" : "暂无赛程";
        chip.title = `${platform.name} · ${status} · ${source?.updatedAt ? `更新于 ${contestTime(source.updatedAt)} · 北京时间` : "尚无成功更新时间"}`;
        append(chip, contestLink(`${platform.name} ↗`, platform.url, "contest-official-link", `${platform.id}:official`), element("span", `contest-source-status${source?.error ? " is-error" : source?.stale ? " is-stale" : ""}`, status));
        sources.append(chip);
      }
      const list = element("div", "contest-list");
      const items = mergedContests(now);
      for (const contest of items) {
        const { platform } = contest, active = contest.start <= now;
        const row = element("article", `contest-card${active ? " is-active" : ""}`);
        row.dataset.platform = platform.id;
        row.dataset.contestId = String(contest.id);
        const label = element("span", "contest-phase", active ? "正在进行" : "即将开始");
        const title = contestLink(contest.title || "未命名比赛", contest.url, "contest-title", `${platform.id}:${contest.id}`);
        title.title = contest.title;
        const start2 = element("time", "", contestTime(contest.startTime));
        start2.dateTime = contest.startTime;
        start2.title = `开始 ${contestTime(contest.startTime)} · 结束 ${contestTime(contest.endTime)} · 北京时间`;
        const schedule = element("span", "contest-schedule");
        schedule.append(start2);
        const countdown = element("span", "contest-countdown");
        countdown.dataset.target = String(active ? contest.end : contest.start);
        countdown.dataset.phase = active ? "active" : "upcoming";
        countdown.textContent = `${active ? "距结束" : "距开始"} ${contestDuration(Number(countdown.dataset.target) - now)}`;
        const duration = element("span", "contest-duration", `赛时 ${contestDuration(contest.end - contest.start).replace(/ 0秒$/, "").trim()}`);
        const decline = button("不参加", "contest-decline", () => {
          void setContestOptOut(platform.id, contest.id, true);
        });
        decline.dataset.contestFocus = `${platform.id}:${contest.id}:decline`;
        decline.setAttribute("aria-label", `不参加：${contest.title}`);
        const titleGroup = append(element("span", "contest-title-group"), contestTypeBadge(platform.id, contest), title);
        append(row, element("span", "contest-platform-label", platform.name), titleGroup, label, schedule, duration, countdown, decline);
        list.append(row);
      }
      if (!items.length) list.append(element("p", "contest-empty", contestsPending ? "正在载入比赛…" : "暂无可显示的比赛，可通过上方平台链接查看官方赛程。"));
      grid.append(sources, list);
      contestSignature = JSON.stringify(items.map((contest) => [contest.platform.id, contest.id, contest.start <= now ? "active" : "upcoming"]));
      updateContestPreferenceControls();
      if (focus) {
        const target = $$("[data-contest-focus]", grid).find((node) => node.dataset.contestFocus === focus) || $$("[data-contest-focus]", grid).find((node) => node.dataset.contestFocus === `${focus.split(":")[0]}:official`);
        target?.focus({ preventScroll: true });
      }
    }
    function tickContests() {
      if (getView() !== "home" || !$("#contest-platforms")) return;
      const now = Date.now();
      const signature = JSON.stringify(mergedContests(now).map((contest) => [contest.platform.id, contest.id, contest.start <= now ? "active" : "upcoming"]));
      if (signature !== contestSignature) {
        renderContestCards(now);
        return;
      }
      $$(".contest-countdown").forEach((node) => {
        node.textContent = `${node.dataset.phase === "active" ? "距结束" : "距开始"} ${contestDuration(Number(node.dataset.target) - now)}`;
      });
    }
    function refreshVisibleContests() {
      if (getLoading() || getView() !== "home" || document.hidden || !canRefresh()) return;
      if (lastContestAttempt === null || Date.now() - lastContestAttempt >= contestRefreshPeriod) void refreshContests(false);
    }
    async function refreshContests(force = false) {
      if (contestsPending || !canRefresh()) return;
      lastContestAttempt = Date.now();
      clearTimeout(contestRefreshTimer);
      contestsPending = true;
      contestsFailed = false;
      updateContestStatus();
      try {
        const payload = await call("getContests", force);
        if (!acceptContests(payload)) throw new Error("Invalid schedule");
      } catch (_) {
        contestsFailed = true;
      } finally {
        contestsPending = false;
        contestRefreshTimer = setTimeout(refreshVisibleContests, contestRefreshPeriod);
        if (getView() === "home") {
          updateContestStatus();
          renderContestCards();
        }
      }
    }
    function hiddenContestEntries() {
      return [...new Set(optedOutContests())].map((key) => {
        const separator = key.indexOf(":"), platformId = key.slice(0, separator), id = key.slice(separator + 1);
        const platform = contestPlatforms.find((item) => item.id === platformId) || { id: platformId, name: platformId };
        const contest = contestData?.platforms.find((source) => source.id === platformId)?.contests.find((item) => String(item.id) === id);
        return { ...contest, id, platform, key, start: contestTimestamp(contest?.startTime), end: contestTimestamp(contest?.endTime) };
      }).sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || a.platform.id.localeCompare(b.platform.id) || a.id.localeCompare(b.id));
    }
    function updateContestRestoreCount() {
      const count = $("#contest-restore-count");
      if (count) count.textContent = `已选择 ${contestRestoreSelection.size} 场`;
      const confirm = $("#contest-restore-confirm");
      if (confirm) confirm.disabled = contestPreferencePending || contestRestoreSelection.size === 0;
      ["contest-restore-all", "contest-restore-none", "contest-restore-close", "contest-restore-cancel"].forEach((id) => {
        const node = $("#" + id);
        if (node) node.disabled = contestPreferencePending;
      });
      $$("#contest-restore-options input").forEach((node) => {
        node.disabled = contestPreferencePending;
      });
    }
    function renderContestRestoreOptions() {
      const options = $("#contest-restore-options");
      if (!options) return;
      options.replaceChildren();
      for (const entry of contestRestoreEntries) {
        const label = element("label", "contest-restore-option");
        const checkbox = element("input");
        checkbox.type = "checkbox";
        checkbox.value = entry.key;
        checkbox.checked = contestRestoreSelection.has(entry.key);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) contestRestoreSelection.add(entry.key);
          else contestRestoreSelection.delete(entry.key);
          updateContestRestoreCount();
        });
        const text = element("span", "contest-restore-option-copy");
        const details = entry.start !== null && entry.end !== null && entry.end > entry.start ? `${contestTime(entry.startTime)} · 赛时 ${contestDuration(entry.end - entry.start).replace(/ 0秒$/, "").trim()}${entry.end <= Date.now() ? " · 已结束" : ""}` : "暂无赛程详情（可恢复隐藏偏好）";
        const heading = append(element("span", "contest-restore-option-heading"), contestTypeBadge(entry.platform.id, entry), element("strong", "", `${entry.platform.name} · ${entry.title || `比赛 ${entry.id}`}`));
        append(text, heading, element("small", "", details));
        label.title = `${entry.platform.name} · ${entry.title || `比赛 ${entry.id}`}`;
        append(label, checkbox, text);
        options.append(label);
      }
      if (!contestRestoreEntries.length) options.append(element("p", "contest-empty", "当前缓存中找不到已隐藏的比赛，刷新赛程后再试。"));
      updateContestRestoreCount();
    }
    function openContestRestore() {
      if (contestPreferencePending) return;
      contestRestoreEntries = hiddenContestEntries();
      contestRestoreSelection = new Set(contestRestoreEntries.map((entry) => entry.key));
      $("#contest-restore-error").hidden = true;
      renderContestRestoreOptions();
      $("#contest-restore-dialog").showModal();
    }
    async function restoreSelectedContests() {
      if (contestPreferencePending) return;
      const selected = new Set(contestRestoreSelection);
      if (!selected.size) return;
      contestPreferencePending = true;
      const previous = optedOutContests();
      const next = previous.filter((key) => !selected.has(key));
      setSettings({ ...getSettings(), contestOptOuts: next });
      renderContestCards();
      updateContestRestoreCount();
      try {
        if (demo) writeDemo();
        else await call("saveSettings", { ...getSettings() });
        $("#contest-restore-dialog").close();
        toast(`已恢复 ${selected.size} 场比赛`);
      } catch (error) {
        setSettings({ ...getSettings(), contestOptOuts: previous });
        renderContestCards();
        const errorNode = $("#contest-restore-error");
        errorNode.textContent = `比赛偏好未保存：${errorMessage(error)}`;
        errorNode.hidden = false;
      } finally {
        contestPreferencePending = false;
        updateContestPreferenceControls();
        updateContestRestoreCount();
      }
    }
    function renderHomeContests() {
      const panel = element("section", "home-contests");
      panel.setAttribute("aria-labelledby", "contests-title");
      const title = element("h2", "", "比赛提醒");
      title.id = "contests-title";
      const refresh = button("刷新赛程", "button secondary", () => {
        void refreshContests(true);
      });
      refresh.id = "contests-refresh";
      const restore = button("", "button subtle contest-restore", openContestRestore);
      restore.id = "contests-restore";
      const actions = append(element("div", "contest-actions"), restore, refresh);
      const status = element("p", "contests-status");
      status.id = "contests-status";
      status.setAttribute("role", "status");
      const grid = element("div", "contest-platforms");
      grid.id = "contest-platforms";
      append(panel, append(element("div", "contests-heading"), append(element("div"), element("div", "eyebrow", "CONTEST COUNTDOWN"), title, element("p", "contest-timezone", "所有时间均为北京时间（UTC+8）")), actions), status, grid);
      return panel;
    }
    function closeContestRestore() {
      $("#contest-restore-dialog").close();
    }
    function selectAllContestRestore() {
      contestRestoreSelection = new Set(contestRestoreEntries.map((entry) => entry.key));
      renderContestRestoreOptions();
    }
    function selectNoContestRestore() {
      contestRestoreSelection.clear();
      renderContestRestoreOptions();
    }
    function cancelContestRestore(event) {
      if (contestPreferencePending) event.preventDefault();
    }
    function start() {
      if (started) return;
      started = true;
      $("#contest-restore-close").addEventListener("click", closeContestRestore);
      $("#contest-restore-cancel").addEventListener("click", closeContestRestore);
      $("#contest-restore-all").addEventListener("click", selectAllContestRestore);
      $("#contest-restore-none").addEventListener("click", selectNoContestRestore);
      $("#contest-restore-confirm").addEventListener("click", () => {
        void restoreSelectedContests();
      });
      $("#contest-restore-dialog").addEventListener("cancel", cancelContestRestore);
      setInterval(tickContests, 1e3);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          tickContests();
          refreshVisibleContests();
        }
      });
      window.addEventListener("focus", () => {
        tickContests();
        refreshVisibleContests();
      });
    }
    return { acceptContests, renderHomeContests, updateContestStatus, updateContestPreferenceControls, renderContestCards, tickContests, refreshVisibleContests, refreshContests, openContestRestore, restoreSelectedContests, renderContestRestoreOptions, updateContestRestoreCount, closeContestRestore, selectAllContestRestore, selectNoContestRestore, cancelContestRestore, start };
  }
  var HomeContests = Object.freeze({ create });
  return __toCommonJS(contests_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookHomeContests"] = __QMXStandalone["HomeContests"];
})();
