(() => {
  type Methods = import('../../shared/contracts/notebook').BoundaryMethods;
  /** Keep the caller's chosen bridge; callers can pass the live bridge for late formatters. */
  window.NotebookIPC = (bridge: Methods): Methods => ({
    openExternal: (...args) => bridge.openExternal(...args),
    openAuthUrl: (...args) => bridge.openAuthUrl(...args),
    formatCode: (...args) => bridge.formatCode(...args),
    cancelLogin: (...args) => bridge.cancelLogin(...args),
    exportLocal: (...args) => bridge.exportLocal(...args),
    bootstrap: (...args) => bridge.bootstrap(...args),
    updateLocal: (...args) => bridge.updateLocal(...args),
    plannerAction: (...args) => bridge.plannerAction(...args)
  });
})();
