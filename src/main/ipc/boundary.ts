declare const module: {
  exports: {
    registerBoundary(
      register: import('../../shared/contracts/notebook').BoundaryRegister,
      operations: import('../../shared/contracts/notebook').BoundaryHandlers
    ): void;
  };
};

(() => {
  type Register = import('../../shared/contracts/notebook').BoundaryRegister;
  type Handlers = import('../../shared/contracts/notebook').BoundaryHandlers;

  /** Keep validation, locking and errors in the existing main-process operations. */
  function registerBoundary(register: Register, operations: Handlers): void {
    register('openExternal', operations.openExternal);
    register('openAuthUrl', operations.openAuthUrl);
    register('formatCode', operations.formatCode);
    register('cancelLogin', operations.cancelLogin);
    register('exportLocal', operations.exportLocal);
    register('bootstrap', operations.bootstrap);
    register('updateLocal', operations.updateLocal);
  }

  module.exports = { registerBoundary };
})();
