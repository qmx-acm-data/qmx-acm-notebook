// Generated from src/renderer/records/local.ts; run pnpm ipc:build.
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

  // src/renderer/records/local.ts
  var local_exports = {};
  __export(local_exports, {
    LocalRecords: () => LocalRecords,
    createNormalizer: () => createNormalizer
  });
  var LocalRecords = { createNormalizer };
  function createNormalizer(uuid) {
    const migratedClientIds = /* @__PURE__ */ new Map();
    return function normalizeLocal(local) {
      const raw = local;
      return {
        records: (Array.isArray(raw?.records) ? raw.records : []).filter((record) => record?.kind === "local").map((record) => {
          const legacyKey = record.id == null ? null : String(record.id);
          const clientId = record.clientId || legacyKey && migratedClientIds.get(legacyKey) || uuid();
          if (legacyKey) migratedClientIds.set(legacyKey, clientId);
          return {
            ...record,
            clientId,
            id: record.id ?? `local:${clientId}`,
            ownerId: record.ownerId == null ? null : String(record.ownerId)
          };
        }),
        favorites: Array.isArray(raw?.favorites) ? raw.favorites : [],
        mastery: raw?.mastery && typeof raw.mastery === "object" ? raw.mastery : {},
        draft: raw?.draft && typeof raw.draft === "object" ? raw.draft : {},
        learningPaths: raw?.learningPaths && typeof raw.learningPaths === "object" && !Array.isArray(raw.learningPaths) ? raw.learningPaths : {}
      };
    };
  }
  return __toCommonJS(local_exports);
})();
(typeof window !== 'undefined' ? window : globalThis)["NotebookLocal"] = __QMXStandalone["LocalRecords"];
})();
