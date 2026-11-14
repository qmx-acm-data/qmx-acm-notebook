// Generated from src/renderer/ipc/boundary.ts; run pnpm ipc:build.
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

  // src/renderer/ipc/boundary.ts
  var boundary_exports = {};
  __export(boundary_exports, {
    createNotebookIPC: () => createNotebookIPC
  });
  function createNotebookIPC(bridge) {
    return {
      openExternal: (...args) => bridge.openExternal(...args),
      openAuthUrl: (...args) => bridge.openAuthUrl(...args),
      formatCode: (...args) => bridge.formatCode(...args),
      cancelLogin: (...args) => bridge.cancelLogin(...args),
      exportLocal: (...args) => bridge.exportLocal(...args),
      bootstrap: (...args) => bridge.bootstrap(...args),
      updateLocal: (...args) => bridge.updateLocal(...args),
      plannerAction: (...args) => bridge.plannerAction(...args)
    };
  }
  return __toCommonJS(boundary_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookIPC"] = __QMXStandalone["createNotebookIPC"];
})();
