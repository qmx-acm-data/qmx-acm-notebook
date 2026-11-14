import type { BoundaryMethods } from '../../shared/contracts/notebook';

/** Keep the caller's chosen bridge; callers can pass the live bridge for late formatters. */
export function createNotebookIPC(bridge: BoundaryMethods): BoundaryMethods {
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
