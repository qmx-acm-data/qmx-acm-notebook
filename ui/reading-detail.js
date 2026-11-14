// Generated from src/renderer/reading/reading-detail.ts; run pnpm reader:build.
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

  // src/renderer/reading/reading-detail.ts
  var reading_detail_exports = {};
  __export(reading_detail_exports, {
    ReadingDetail: () => ReadingDetail
  });
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
  return __toCommonJS(reading_detail_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookReadingDetail"] = __QMXStandalone["ReadingDetail"];
})();
