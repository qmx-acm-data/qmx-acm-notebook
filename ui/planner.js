// Generated from src/renderer/planner/planner.ts; run pnpm modules:build.
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

  // src/renderer/planner/planner.ts
  var planner_exports = {};
  __export(planner_exports, {
    Planner: () => Planner
  });

  // src/renderer/planner/deadline.ts
  var enhanced = /* @__PURE__ */ new WeakMap();
  var active = null;
  var sequence = 0;
  var pad = (value) => String(value).padStart(2, "0");
  var dateKey = (date) => `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  function localDay(year, month, day) {
    const date = /* @__PURE__ */ new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(year, month, day);
    return date;
  }
  function parts(value) {
    return String(value).match(/^(\d{4,}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d{1,3})?)?$/);
  }
  function validLocal(value) {
    const match = value.match(/^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    if (!match) return false;
    const expected = [Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0), Number((match[7] || "").padEnd(3, "0"))];
    const date = new Date(value);
    const actual = [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()];
    return !Number.isNaN(date.getTime()) && actual.every((part, index) => part === expected[index]);
  }
  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== void 0) result.textContent = text;
    return result;
  }
  function action(text, className, callback, label) {
    const result = node("button", className, text);
    result.type = "button";
    if (label) result.setAttribute("aria-label", label);
    result.addEventListener("click", callback);
    return result;
  }
  function enhance(input) {
    if (enhanced.has(input)) return enhanced.get(input);
    if (!(input instanceof HTMLInputElement) || input.type !== "datetime-local") throw new TypeError("NotebookDeadline.enhance requires a datetime-local input.");
    const id = `planner-deadline-${++sequence}`;
    const button2 = action("", "planner-deadline-trigger", () => {
      if (input.disabled || input.matches(":disabled")) return;
      if (opened) close();
      else open();
    });
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 20 20");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add("planner-deadline-icon");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M5.5 2.5v3m9-3v3M3 8h14M4.5 4h11A1.5 1.5 0 0 1 17 5.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-10A1.5 1.5 0 0 1 4.5 4ZM6.5 11h2m3 0h2m-7 3h2");
    icon.append(path);
    const caption = node("span", "planner-deadline-caption");
    button2.append(icon, caption);
    button2.setAttribute("aria-haspopup", "dialog");
    button2.setAttribute("aria-expanded", "false");
    button2.setAttribute("aria-controls", id);
    input.hidden = true;
    input.insertAdjacentElement("afterend", button2);
    const popover = node("div", "planner-deadline-popover");
    popover.id = id;
    popover.setAttribute("popover", "auto");
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-labelledby", `${id}-title`);
    const heading = node("div", "planner-deadline-heading");
    const title = node("h3", "", "截止时间");
    title.id = `${id}-title`;
    heading.append(title, node("span", "planner-deadline-optional", "可选"));
    const navigation = node("div", "planner-deadline-navigation");
    const previous = action("‹", "planner-deadline-nav", () => changeMonth(-1), "上个月");
    const next = action("›", "planner-deadline-nav", () => changeMonth(1), "下个月");
    const month = node("span", "planner-deadline-month");
    month.id = `${id}-month`;
    month.setAttribute("aria-live", "polite");
    navigation.append(previous, month, next);
    const weekdays = node("div", "planner-deadline-weekdays");
    weekdays.setAttribute("aria-hidden", "true");
    for (const day of ["一", "二", "三", "四", "五", "六", "日"]) weekdays.append(node("span", "", day));
    const calendar = node("div", "planner-deadline-calendar");
    calendar.setAttribute("role", "group");
    calendar.setAttribute("aria-labelledby", month.id);
    const shortcuts = node("div", "planner-deadline-shortcuts");
    for (const [text, offset] of [["今天", 0], ["明天", 1], ["+7天", 7]]) {
      shortcuts.append(action(text, "planner-deadline-shortcut", () => {
        const date = /* @__PURE__ */ new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + offset);
        selectDate(date);
      }));
    }
    const timeRow = node("label", "planner-deadline-time-row");
    const time = node("input", "planner-deadline-time");
    time.type = "time";
    time.step = "60";
    time.setAttribute("aria-label", "截止时刻（本机时区）");
    timeRow.append(node("span", "", "时间"), time, node("span", "planner-deadline-zone", "本机时区"));
    const selection = node("p", "planner-deadline-selection");
    selection.setAttribute("aria-live", "polite");
    const error = node("p", "planner-deadline-error");
    error.id = `${id}-error`;
    error.setAttribute("role", "alert");
    error.hidden = true;
    time.setAttribute("aria-describedby", error.id);
    const footer = node("div", "planner-deadline-footer");
    const clear = action("清除", "planner-deadline-clear", () => {
      draftDate = "";
      time.value = "";
      clearError();
      renderCalendar();
    });
    const cancel = action("取消", "planner-deadline-cancel", close);
    const confirm = action("确定", "planner-deadline-confirm", apply);
    footer.append(clear, cancel, confirm);
    popover.append(heading, navigation, weekdays, calendar, shortcuts, timeRow, selection, error, footer);
    let opened = false;
    let original = "";
    let originalParts = null;
    let draftDate = "";
    let view = /* @__PURE__ */ new Date();
    let frame = 0;
    function clearError() {
      error.hidden = true;
      error.textContent = "";
      time.removeAttribute("aria-invalid");
    }
    function fail(message, target) {
      error.textContent = message;
      error.hidden = false;
      if (target === time) time.setAttribute("aria-invalid", "true");
      target.focus({ preventScroll: true });
      position();
    }
    function refresh() {
      const value = parts(input.value);
      caption.textContent = value ? `${Number(value[1].split("-")[1])}/${Number(value[1].split("-")[2])} ${value[2]}` : "截止时间";
      button2.classList.toggle("has-deadline", Boolean(value));
      button2.disabled = input.disabled || input.matches(":disabled");
      const label = input.getAttribute("aria-label") || "截止时间（可选，使用本机时区）";
      button2.setAttribute("aria-label", value ? `${label}：${value[1]} ${value[2]}` : label);
      button2.title = value ? `${value[1]} ${input.value.split("T")[1]}（本机时区）` : label;
      if (button2.disabled && opened) close();
      return api;
    }
    function renderCalendar(focusDate) {
      const year = view.getFullYear();
      const monthIndex = view.getMonth();
      month.textContent = `${year} 年 ${monthIndex + 1} 月`;
      previous.disabled = year <= 1 && monthIndex === 0;
      next.disabled = year >= 9999 && monthIndex === 11;
      calendar.replaceChildren();
      const first = localDay(year, monthIndex, 1);
      const offset = (first.getDay() + 6) % 7;
      const today = dateKey(/* @__PURE__ */ new Date());
      for (let index = 0; index < 42; index++) {
        const date = localDay(year, monthIndex, index - offset + 1);
        const key = dateKey(date);
        const day = action(String(date.getDate()), "planner-deadline-day", () => selectDate(date, true));
        day.dataset.date = key;
        day.classList.toggle("is-adjacent", date.getMonth() !== monthIndex);
        day.classList.toggle("is-today", key === today);
        day.setAttribute("aria-pressed", String(key === draftDate));
        day.setAttribute("aria-label", `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日，星期${["日", "一", "二", "三", "四", "五", "六"][date.getDay()]}`);
        if (key === today) day.setAttribute("aria-current", "date");
        day.disabled = date.getFullYear() < 1 || date.getFullYear() > 9999;
        day.addEventListener("keydown", (event) => moveDay(event, date));
        calendar.append(day);
      }
      selection.textContent = draftDate ? `已选 ${draftDate.replace(/-/g, "/")} · 确定后生效` : "未选日期 · 可留空";
      if (focusDate) calendar.querySelector(`[data-date="${focusDate}"]`)?.focus({ preventScroll: true });
      if (opened) position();
    }
    function selectDate(date, focus = false) {
      draftDate = dateKey(date);
      view = localDay(date.getFullYear(), date.getMonth(), 1);
      clearError();
      renderCalendar(focus ? draftDate : null);
    }
    function changeMonth(delta) {
      const date = localDay(view.getFullYear(), view.getMonth() + delta, 1);
      if (date.getFullYear() < 1 || date.getFullYear() > 9999) return;
      view = date;
      clearError();
      renderCalendar();
    }
    function moveDay(event, date) {
      const increments = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      const target = localDay(date.getFullYear(), date.getMonth(), date.getDate());
      if (Object.hasOwn(increments, event.key)) target.setDate(target.getDate() + increments[event.key]);
      else if (event.key === "Home") target.setDate(target.getDate() - (target.getDay() + 6) % 7);
      else if (event.key === "End") target.setDate(target.getDate() + 6 - (target.getDay() + 6) % 7);
      else if (event.key === "PageUp" || event.key === "PageDown") {
        const day = target.getDate();
        target.setDate(1);
        target.setMonth(target.getMonth() + (event.key === "PageUp" ? -1 : 1));
        const last = localDay(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        target.setDate(Math.min(day, last));
      } else return;
      event.preventDefault();
      if (target.getFullYear() < 1 || target.getFullYear() > 9999) return;
      view = localDay(target.getFullYear(), target.getMonth(), 1);
      renderCalendar(dateKey(target));
    }
    function position() {
      if (!opened) return;
      if (!button2.isConnected || button2.disabled) {
        close();
        return;
      }
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft || 0) + 8;
      const topEdge = (viewport?.offsetTop || 0) + 8;
      const rightEdge = leftEdge + (viewport?.width || window.innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height || window.innerHeight) - 16;
      popover.style.maxHeight = `${Math.max(0, bottomEdge - topEdge)}px`;
      const anchor = button2.getBoundingClientRect();
      const box = popover.getBoundingClientRect();
      const below = anchor.bottom + 7;
      const above = anchor.top - box.height - 7;
      const top = below + box.height <= bottomEdge ? below : above >= topEdge ? above : Math.max(topEdge, Math.min(below, bottomEdge - box.height));
      popover.style.left = `${Math.max(leftEdge, Math.min(anchor.left, rightEdge - box.width))}px`;
      popover.style.top = `${top}px`;
    }
    function schedulePosition(event) {
      if (event?.target instanceof Node && popover.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    }
    function finishClose() {
      if (!opened) return;
      opened = false;
      if (active === api) active = null;
      button2.setAttribute("aria-expanded", "false");
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePosition);
      document.removeEventListener("scroll", schedulePosition, true);
      window.visualViewport?.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
      queueMicrotask(() => {
        if (!active && button2.isConnected && !button2.disabled) button2.focus({ preventScroll: true });
      });
    }
    function close() {
      if (popover.matches(":popover-open")) popover.hidePopover();
      finishClose();
    }
    function open() {
      refresh();
      if (opened || button2.disabled || !button2.isConnected) return;
      if (active && active !== api) active.close();
      original = input.value;
      originalParts = parts(original);
      draftDate = originalParts?.[1] || "";
      time.value = originalParts?.[2] || "21:00";
      const selected = draftDate ? draftDate.split("-").map(Number) : null;
      const today = /* @__PURE__ */ new Date();
      view = selected ? localDay(selected[0], selected[1] - 1, 1) : localDay(today.getFullYear(), today.getMonth(), 1);
      clearError();
      renderCalendar();
      (input.closest("dialog") || document.body).append(popover);
      popover.showPopover();
      opened = true;
      active = api;
      button2.setAttribute("aria-expanded", "true");
      position();
      const focusDate = draftDate || dateKey(today);
      (calendar.querySelector(`[data-date="${focusDate}"]`) || calendar.querySelector("button:not(:disabled)")).focus({ preventScroll: true });
      window.addEventListener("resize", schedulePosition);
      document.addEventListener("scroll", schedulePosition, true);
      window.visualViewport?.addEventListener("resize", schedulePosition);
      window.visualViewport?.addEventListener("scroll", schedulePosition);
    }
    function apply() {
      if (input.disabled || input.matches(":disabled")) {
        close();
        return;
      }
      if (!draftDate && time.value) {
        fail("请选择日期，或清除截止时间。", calendar.querySelector("button:not(:disabled)"));
        return;
      }
      if (draftDate && !time.value) {
        fail("请填写时间，或清除截止时间。", time);
        return;
      }
      let value = draftDate ? `${draftDate}T${time.value}` : "";
      if (value && originalParts && draftDate === originalParts[1] && time.value === originalParts[2]) value = original;
      if (value && !validLocal(value)) {
        fail("该本地时间无效，请重新选择日期和时间。", time);
        return;
      }
      input.value = value;
      refresh();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      close();
    }
    popover.addEventListener("beforetoggle", (event) => {
      if ("newState" in event && event.newState === "closed") finishClose();
    });
    popover.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    });
    time.addEventListener("input", clearError);
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
    input.form?.addEventListener("reset", () => queueMicrotask(() => {
      close();
      refresh();
    }));
    const observer = new MutationObserver(refresh);
    observer.observe(input, { attributes: true, attributeFilter: ["disabled", "value", "aria-label"] });
    const api = { input, button: button2, popover, refresh, open, close };
    enhanced.set(input, api);
    refresh();
    return api;
  }
  var Deadline = Object.freeze({ enhance, attach: enhance });

  // src/renderer/planner/planner.ts
  var bridge;
  var onChange;
  var state = { problems: [], tasks: [], layout: "balanced" };
  var root;
  var dialog;
  var editor;
  var busy = false;
  var mounted = false;
  var cards = {};
  var collapsed = { problems: false, tasks: false };
  var completedOpen = { problems: false, tasks: false };
  var deleteTarget = "";
  var lastFocus;
  var el = (tag, className, text) => {
    const node2 = document.createElement(tag);
    if (className) node2.className = className;
    if (text !== void 0) node2.textContent = String(text);
    return node2;
  };
  function button(text, className, action2) {
    const node2 = el("button", className, text);
    node2.type = "button";
    node2.addEventListener("click", action2);
    return node2;
  }
  function field(label, name, type, placeholder, maxLength) {
    const wrap = el("label", "planner-field");
    wrap.append(el("span", "planner-sr-only", label));
    const input = el(type === "textarea" ? "textarea" : "input", "planner-input");
    input.name = name;
    if (type !== "textarea") input.type = type;
    if (placeholder) input.placeholder = placeholder;
    if (maxLength) input.maxLength = maxLength;
    input.setAttribute("aria-label", label);
    wrap.append(input);
    return { wrap, input };
  }
  function errorText(error) {
    return String(typeof error === "string" ? error : error?.message || "保存失败，请重试。").replace(/^Error:\s*/, "");
  }
  function showError(target, message) {
    target.textContent = message || "";
    target.hidden = !message;
  }
  function safeURL(value) {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("请填写 http 或 https 题目链接。");
    return url.href;
  }
  function problemTitle(url) {
    const parsed = new URL(url);
    const path = parsed.pathname;
    let match;
    if (/codeforces\.com$/i.test(parsed.hostname) && (match = path.match(/\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([a-z]\d*)/i))) return `CF ${match[1]}${match[2].toUpperCase()}`;
    if (/luogu\.(?:com\.cn|com)$/i.test(parsed.hostname) && (match = path.match(/\/problem\/([^/]+)/i))) return match[1].toUpperCase();
    if (/atcoder\.jp$/i.test(parsed.hostname) && (match = path.match(/\/tasks\/([^/]+)/i))) return match[1];
    if (/nowcoder\.com$/i.test(parsed.hostname) && (match = path.match(/\/acm\/contest\/(\d+)\/([^/]+)/i))) return `牛客 ${match[1]} ${match[2]}`;
    let last = path.split("/").filter(Boolean).pop() || parsed.hostname;
    try {
      last = decodeURIComponent(last);
    } catch (_) {
    }
    return last.slice(0, 180);
  }
  function parseProblem(value, optionalTitle) {
    const raw = value.trim();
    const match = raw.match(/https?:\/\/\S+/i);
    if (!match) throw new Error("粘贴题目链接后再添加。");
    const url = safeURL(match[0]);
    const pastedTitle = raw.replace(match[0], "").trim().replace(/^[|·—\-\s]+|[|·—\-\s]+$/g, "");
    const title = optionalTitle.trim() || pastedTitle || problemTitle(url);
    if (title.length > 180) throw new Error("题目名称请控制在 180 字以内。");
    return { url, title };
  }
  function localDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad2 = (part, length = 2) => String(part).padStart(length, "0");
    const base = `${pad2(date.getFullYear(), 4)}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    return date.getSeconds() || date.getMilliseconds() ? `${base}:${pad2(date.getSeconds())}${date.getMilliseconds() ? `.${pad2(date.getMilliseconds(), 3)}` : ""}` : base;
  }
  function toISO(value) {
    if (!value) return "";
    const date = new Date(value);
    const parts2 = value.match(/^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
    const expected = parts2 && [Number(parts2[1]), Number(parts2[2]) - 1, Number(parts2[3]), Number(parts2[4]), Number(parts2[5]), Number(parts2[6] || 0), Number((parts2[7] || "").padEnd(3, "0"))];
    const actual = [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()];
    if (!expected || Number.isNaN(date.getTime()) || actual.some((part, index) => part !== expected[index])) throw new Error("截止时间无效，请重新选择。");
    return date.toISOString();
  }
  function dueTime(item) {
    const time = item.dueAt ? new Date(item.dueAt).getTime() : NaN;
    return Number.isNaN(time) ? Infinity : time;
  }
  function deadline(item) {
    if (!item.dueAt || !Number.isFinite(dueTime(item))) return { text: "无截止时间", overdue: false };
    const date = new Date(item.dueAt);
    const delta = date.getTime() - Date.now();
    const minutes = Math.max(1, Math.ceil(Math.abs(delta) / 6e4));
    const span = minutes < 60 ? `${minutes} 分钟` : minutes < 1440 ? `${Math.ceil(minutes / 60)} 小时` : `${Math.ceil(minutes / 1440)} 天`;
    const overdue = !item.done && delta < 0;
    const now = /* @__PURE__ */ new Date();
    const absolute = date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const clock = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
    const calendar = sameDay ? `今天 ${clock}` : `${date.getFullYear() !== now.getFullYear() ? `${date.getFullYear()}/` : ""}${date.getMonth() + 1}/${date.getDate()} ${clock}`;
    return { text: item.done ? `截止 ${calendar}` : `${calendar} · ${overdue ? `已逾期 ${span}` : `${span}后截止`}`, title: absolute, overdue };
  }
  function updateBusy(value) {
    busy = value;
    for (const area of [root, dialog]) {
      if (!area) continue;
      area.setAttribute("aria-busy", String(value));
      area.querySelectorAll("button,input,textarea").forEach((node2) => {
        node2.disabled = value;
      });
    }
  }
  async function mutate(action2, payload, errorNode, success) {
    if (busy) return false;
    showError(errorNode, "");
    updateBusy(true);
    let next;
    try {
      if (typeof bridge?.plannerAction !== "function") throw new Error("计划暂不可用，请稍后重试。");
      next = await bridge.plannerAction(...[action2, payload]);
      if (!next || !Array.isArray(next.problems) || !Array.isArray(next.tasks)) throw new Error("保存结果无效，请重试。");
    } catch (error) {
      showError(errorNode, errorText(error));
      updateBusy(false);
      return false;
    }
    updateBusy(false);
    if (success) success();
    deleteTarget = "";
    render(next);
    try {
      if (typeof onChange === "function") onChange(state);
    } catch (error) {
      console.error("Planner onChange failed", error);
    }
    document.dispatchEvent(new CustomEvent("planner:change", { detail: state }));
    return true;
  }
  function createCard(kind, title, caption) {
    const card = el("section", `planner-card planner-${kind}`);
    const heading = el("div", "planner-heading");
    const titleGroup = el("div", "planner-title-group");
    const h2 = el("h2", "", title);
    h2.id = `planner-${kind}-title`;
    card.setAttribute("aria-labelledby", h2.id);
    const count = el("span", "planner-count");
    titleGroup.append(h2, count);
    heading.append(titleGroup, el("span", "planner-caption", caption));
    const form = el("form", `planner-add planner-add-${kind}`);
    form.noValidate = true;
    form.setAttribute("aria-label", kind === "problems" ? "添加待做题目" : "添加待办事项");
    const error = el("p", "planner-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    const list = el("div", "planner-list");
    list.id = `planner-${kind}-list`;
    list.tabIndex = 0;
    list.setAttribute("role", "region");
    list.setAttribute("aria-label", kind === "problems" ? "待做题单，可向下滚动" : "学习任务，可向下滚动");
    const more = button("收起 ▴", "planner-list-toggle", () => {
      collapsed[kind] = !collapsed[kind];
      drawCard(kind);
      more.focus();
    });
    more.setAttribute("aria-controls", list.id);
    heading.lastChild.remove();
    heading.append(more);
    const completed = el("details", "planner-completed");
    const summary = el("summary");
    const doneList = el("div", "planner-list planner-done-list");
    completed.append(summary, doneList);
    completed.addEventListener("toggle", () => {
      completedOpen[kind] = completed.open;
    });
    const hint = el("p", "planner-scroll-hint", "向下滚动查看全部");
    hint.hidden = true;
    card.append(heading, form, error, list, hint, completed);
    const refs = { card, count, form, error, list, more, hint, completed, summary, doneList };
    cards[kind] = refs;
    return refs;
  }
  function build() {
    root = el("div", "planner-root");
    const problems = createCard("problems", "待做题目", "随手存下，稍后再做");
    const url = field("题目链接，可附题目名称", "url", "text", "粘贴题目链接", 2400);
    url.input.autocomplete = "off";
    url.input.spellcheck = false;
    const title = field("题目名称（可选，留空使用题号）", "title", "text", "名称（可选）", 180);
    const addProblem = el("button", "planner-add-button", "添加");
    addProblem.type = "submit";
    problems.form.append(url.wrap, title.wrap, addProblem);
    problems.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      try {
        const payload = parseProblem(url.input.value, title.input.value);
        await mutate("addProblem", payload, problems.error, () => {
          url.input.value = "";
          title.input.value = "";
          url.input.focus();
        });
      } catch (error) {
        showError(problems.error, errorText(error));
        url.input.focus();
      }
    });
    const tasks = createCard("tasks", "学习任务", "把下一步写下来");
    const taskTitle = field("待办标题", "title", "text", "添加一项待办", 180);
    const due = field("截止时间（可选，使用本机时区）", "dueAt", "datetime-local", "");
    due.input.step = "any";
    due.input.title = "截止时间（可选，使用本机时区）";
    const deadlinePicker = Deadline?.enhance(due.input);
    due.wrap.classList.add("planner-deadline-field");
    const addTask = el("button", "planner-add-button", "添加");
    addTask.type = "submit";
    tasks.form.append(taskTitle.wrap, due.wrap, addTask);
    tasks.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      try {
        const titleValue = taskTitle.input.value.trim();
        if (!titleValue) throw new Error("先写下要做的事。");
        if (titleValue.length > 180) throw new Error("标题请控制在 180 字以内。");
        if (due.input.validity.badInput) throw new Error("请填写完整的截止时间，或留空。");
        const dueAt = toISO(due.input.value);
        await mutate("addTask", { title: titleValue, details: "", dueAt }, tasks.error, () => {
          taskTitle.input.value = "";
          due.input.value = "";
          deadlinePicker?.refresh();
          taskTitle.input.focus();
        });
      } catch (error) {
        showError(tasks.error, errorText(error));
        taskTitle.input.focus();
      }
    });
    root.append(problems.card, tasks.card);
    buildDialog();
  }
  function captureFocus() {
    const active2 = document.activeElement;
    if (!active2 || !root.contains(active2)) return null;
    return { kind: active2.closest("[data-kind]")?.dataset.kind, id: active2.closest("[data-id]")?.dataset.id, action: active2.dataset.action };
  }
  function restoreFocus(focus) {
    if (!focus?.action) return;
    const card = cards[focus.kind];
    if (!card) return;
    const row2 = Array.from(card.card.querySelectorAll("[data-id]")).find((node2) => node2.dataset.id === focus.id);
    const target = row2 && Array.from(row2.querySelectorAll("[data-action]")).find((node2) => node2.dataset.action === focus.action);
    if (target && !target.closest("details:not([open])")) target.focus();
    else card.form.querySelector("input").focus();
  }
  function row(kind, item) {
    const refs = cards[kind];
    const node2 = el("div", `planner-row${item.done ? " is-done" : ""}`);
    node2.dataset.id = String(item.id);
    node2.dataset.kind = kind;
    const checkbox = el("input", "planner-checkbox");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.done);
    checkbox.dataset.action = "done";
    checkbox.setAttribute("aria-label", `${item.done ? "标为未完成" : "标为完成"}：${item.title}`);
    checkbox.addEventListener("change", async () => {
      const done = checkbox.checked;
      checkbox.checked = Boolean(item.done);
      await mutate(kind === "problems" ? "updateProblem" : "updateTask", { id: item.id, done }, refs.error);
    });
    const copy = el("div", "planner-row-copy");
    if (kind === "problems") {
      let url;
      try {
        url = safeURL(item.url);
      } catch (_) {
      }
      const name = el(url ? "a" : "span", "planner-row-title", item.title || (url ? problemTitle(url) : "题目"));
      if (url) {
        name.href = url;
        name.title = url;
        name.dataset.action = "open";
        name.addEventListener("click", async (event) => {
          event.preventDefault();
          if (busy) return;
          try {
            if (typeof bridge?.openExternal !== "function") throw new Error("暂时无法打开链接。");
            await bridge.openExternal(url);
          } catch (error) {
            showError(refs.error, errorText(error));
          }
        });
      }
      copy.append(name);
      if (url) copy.append(el("span", "planner-row-meta", new URL(url).hostname.replace(/^www\./, "")));
    } else {
      const name = button(item.title, "planner-row-title planner-task-title", () => openTaskDetail(item));
      name.dataset.action = "view";
      copy.append(name);
      const due = deadline(item);
      const meta = el("span", `planner-row-meta${due.overdue ? " is-overdue" : ""}`, due.text);
      if (due.title) meta.title = due.title;
      copy.append(meta);
      if (item.details) copy.append(el("span", "planner-row-details", item.details));
    }
    const actions = el("div", "planner-row-actions");
    const edit = button("编辑", "planner-row-button", () => openEditor(kind, item));
    edit.dataset.action = "edit";
    edit.setAttribute("aria-label", `编辑：${item.title}`);
    const key = `${kind}:${item.id}`;
    const deleting = deleteTarget === key;
    const remove = button(deleting ? "确认删除" : "删除", `planner-row-button${deleting ? " planner-danger" : ""}`, async () => {
      if (deleteTarget !== key) {
        deleteTarget = key;
        drawCard(kind);
        const replacement = Array.from(refs.card.querySelectorAll("[data-id]")).find((value) => value.dataset.id === String(item.id));
        replacement?.querySelector('[data-action="delete"]')?.focus();
        return;
      }
      await mutate(kind === "problems" ? "deleteProblem" : "deleteTask", { id: item.id }, refs.error);
    });
    remove.dataset.action = "delete";
    remove.setAttribute("aria-label", `${deleting ? "确认删除" : "删除"}：${item.title}`);
    actions.append(edit, remove);
    if (deleting) {
      const cancel = button("取消", "planner-row-button", () => {
        deleteTarget = "";
        drawCard(kind);
      });
      cancel.dataset.action = "cancel-delete";
      actions.append(cancel);
    }
    node2.append(checkbox, copy, actions);
    return node2;
  }
  function drawCard(kind) {
    const refs = cards[kind];
    const items = state[kind];
    const pending = items.filter((item) => !item.done);
    if (kind === "tasks") pending.sort((a, b) => {
      const left = dueTime(a), right = dueTime(b);
      return left === right ? 0 : left < right ? -1 : 1;
    });
    const done = items.filter((item) => item.done);
    const overdue = kind === "tasks" ? pending.filter((item) => dueTime(item) < Date.now()).length : 0;
    refs.count.textContent = `${pending.length} 项待办${overdue ? ` · ${overdue} 项逾期` : ""}`;
    if (kind === "problems") refs.count.textContent = `${pending.length} 题待做`;
    const scrollTop = refs.list.scrollTop;
    refs.list.replaceChildren(...pending.map((item) => row(kind, item)));
    if (!pending.length) refs.list.append(el("p", "planner-empty", kind === "problems" ? "暂无待做题目，粘贴链接即可添加。" : "暂无待办，记下接下来要做的事。"));
    refs.list.hidden = collapsed[kind];
    refs.list.scrollTop = scrollTop;
    refs.more.textContent = collapsed[kind] ? `展开 ${pending.length} ${kind === "problems" ? "题" : "项"} ▾` : "收起 ▴";
    refs.more.setAttribute("aria-expanded", String(!collapsed[kind]));
    refs.hint.hidden = collapsed[kind] || pending.length <= 3;
    refs.completed.hidden = !done.length;
    refs.summary.textContent = `已完成 ${done.length} ${kind === "problems" ? "题" : "项"}`;
    refs.completed.open = completedOpen[kind];
    refs.doneList.replaceChildren(...done.map((item) => row(kind, item)));
    if (busy) refs.card.querySelectorAll("button,input,textarea").forEach((node2) => {
      node2.disabled = true;
    });
  }
  function buildDialog() {
    dialog = el("dialog", "planner-dialog");
    dialog.setAttribute("aria-labelledby", "planner-editor-title");
    const form = el("form", "planner-editor");
    form.noValidate = true;
    const heading = el("div", "planner-dialog-heading");
    const title = el("h2", "", "编辑待办");
    title.id = "planner-editor-title";
    const close = button("×", "planner-dialog-close", () => dialog.close());
    close.setAttribute("aria-label", "关闭编辑");
    heading.append(title, close);
    const titleField = field("标题", "title", "text", "", 180);
    const url = field("题目链接", "url", "url", "https://…", 2400);
    const details = field("补充说明（可选，最多 2000 字）", "details", "textarea", "补充步骤、备忘或资料…", 2e3);
    details.input.rows = 5;
    const due = field("截止时间（可选，本机时区）", "dueAt", "datetime-local", "");
    due.input.step = "any";
    const deadlinePicker = Deadline?.enhance(due.input);
    [titleField, url, details, due].forEach((value) => {
      value.wrap.firstChild.className = "planner-editor-label";
    });
    const error = el("p", "planner-error");
    error.hidden = true;
    error.setAttribute("role", "alert");
    const footer = el("div", "planner-dialog-footer");
    const cancel = button("取消", "planner-dialog-button", () => dialog.close());
    const save = el("button", "planner-add-button", "保存");
    save.type = "submit";
    footer.append(cancel, save);
    form.append(heading, titleField.wrap, url.wrap, details.wrap, due.wrap, error, footer);
    dialog.append(form);
    editor = { form, heading: title, title: titleField, url, details, due, deadlinePicker, error, item: null, kind: null, initialLocal: "" };
    dialog.addEventListener("cancel", (event) => {
      if (busy) event.preventDefault();
    });
    dialog.addEventListener("close", () => {
      if (lastFocus?.isConnected) lastFocus.focus();
      else if (editor.kind && cards[editor.kind]) cards[editor.kind].form.querySelector("input").focus();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !editor.item) return;
      try {
        const titleValue = editor.title.input.value.trim();
        if (!titleValue) throw new Error("标题不能为空。");
        if (titleValue.length > 180) throw new Error("标题请控制在 180 字以内。");
        let payload;
        if (editor.kind === "problems") payload = { id: editor.item.id, title: titleValue, url: safeURL(editor.url.input.value) };
        else {
          if (editor.details.input.value.length > 2e3) throw new Error("补充说明请控制在 2000 字以内。");
          if (editor.due.input.validity.badInput) throw new Error("请填写完整的截止时间，或留空。");
          const dueAt = editor.due.input.value === editor.initialLocal ? editor.item.dueAt || "" : toISO(editor.due.input.value);
          payload = { id: editor.item.id, title: titleValue, details: editor.details.input.value, dueAt };
        }
        await mutate(editor.kind === "problems" ? "updateProblem" : "updateTask", payload, editor.error, () => dialog.close());
      } catch (error2) {
        showError(editor.error, errorText(error2));
      }
    });
  }
  function openTaskDetail(item) {
    if (busy || dialog.open) return;
    const origin = document.activeElement;
    const detail = el("dialog", "planner-dialog planner-task-detail");
    detail.setAttribute("aria-labelledby", "planner-task-detail-title");
    const heading = el("div", "planner-dialog-heading");
    const title = el("h2", "", item.title || "学习任务");
    title.id = "planner-task-detail-title";
    const close = button("×", "planner-dialog-close", () => detail.close());
    close.setAttribute("aria-label", "关闭任务详情");
    heading.append(title, close);
    const due = deadline(item);
    const deadlineBlock = el("section", "planner-detail-deadline");
    deadlineBlock.append(el("h3", "", "截止时间"), el("p", "", item.dueAt ? new Date(item.dueAt).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "未设置截止时间"));
    if (item.dueAt) deadlineBlock.append(el("span", `planner-row-meta${due.overdue ? " is-overdue" : ""}`, due.text));
    const description = el("section", "planner-detail-description");
    description.append(el("h3", "", "任务说明"), el("p", "", item.details || "暂无说明"));
    const footer = el("div", "planner-dialog-footer");
    footer.append(button("关闭", "planner-dialog-button", () => detail.close()));
    detail.append(heading, deadlineBlock, description, footer);
    detail.addEventListener("close", () => {
      detail.remove();
      if (origin?.isConnected) origin.focus();
    }, { once: true });
    document.body.append(detail);
    detail.showModal();
    close.focus();
  }
  function openEditor(kind, item) {
    if (busy || dialog.open) return;
    lastFocus = document.activeElement;
    editor.kind = kind;
    editor.item = { ...item };
    editor.heading.textContent = kind === "problems" ? "编辑题目" : "编辑待办";
    editor.title.input.value = item.title || "";
    editor.url.input.value = item.url || "";
    editor.details.input.value = item.details || "";
    editor.due.input.value = localDate(item.dueAt);
    editor.initialLocal = editor.due.input.value;
    editor.deadlinePicker?.refresh();
    editor.url.wrap.hidden = kind !== "problems";
    editor.details.wrap.hidden = kind !== "tasks";
    editor.due.wrap.hidden = kind !== "tasks";
    showError(editor.error, "");
    dialog.showModal();
    editor.title.input.focus();
  }
  function attach() {
    const host = document.getElementById("home-planner");
    if (!host) return false;
    if (!root) build();
    if (root.parentNode !== host) host.append(root);
    if (!dialog.isConnected) document.body.append(dialog);
    if (!mounted) {
      mounted = true;
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && deleteTarget && !busy) {
          deleteTarget = "";
          render(state);
        }
      });
    }
    return true;
  }
  function render(next) {
    if (next && typeof next === "object") {
      const raw = next;
      state = { ...raw, problems: Array.isArray(raw.problems) ? raw.problems : [], tasks: Array.isArray(raw.tasks) ? raw.tasks : [], layout: raw.layout || "balanced" };
    }
    if (!attach()) return;
    const focus = captureFocus();
    drawCard("problems");
    drawCard("tasks");
    restoreFocus(focus);
  }
  var Planner = {
    init(options = {}) {
      bridge = options.bridge;
      onChange = options.onChange;
      attach();
      return Planner;
    },
    render
  };
  return __toCommonJS(planner_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookPlanner"] = __QMXStandalone["Planner"];
})();
