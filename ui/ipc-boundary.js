// Generated from src/renderer/ipc/boundary.ts; run pnpm ipc:build.
"use strict";
(() => {
    /** Keep the caller's chosen bridge; callers can pass the live bridge for late formatters. */
    window.NotebookIPC = (bridge) => ({
        openExternal: (...args) => bridge.openExternal(...args),
        openAuthUrl: (...args) => bridge.openAuthUrl(...args),
        formatCode: (...args) => bridge.formatCode(...args),
        cancelLogin: (...args) => bridge.cancelLogin(...args),
        exportLocal: (...args) => bridge.exportLocal(...args)
    });
})();
