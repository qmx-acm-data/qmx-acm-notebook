// Generated from src/main/ipc/boundary.ts; run pnpm ipc:build.
"use strict";
(() => {
    /** Keep validation, locking and errors in the existing main-process operations. */
    function registerBoundary(register, operations) {
        register('openExternal', operations.openExternal);
        register('openAuthUrl', operations.openAuthUrl);
        register('formatCode', operations.formatCode);
        register('cancelLogin', operations.cancelLogin);
        register('exportLocal', operations.exportLocal);
        register('bootstrap', operations.bootstrap);
        register('updateLocal', operations.updateLocal);
        register('plannerAction', operations.plannerAction);
    }
    module.exports = { registerBoundary };
})();
