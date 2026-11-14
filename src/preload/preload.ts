declare function require(name: 'electron'): import('../../types/electron-preload').ElectronPreload;

(() => {
  type NotebookBridge = import('../shared/contracts/notebook').NotebookBridge;
  type ProgressEvents = import('../shared/contracts/notebook').ProgressEvents;
  const { contextBridge, ipcRenderer } = require('electron');
  function subscribe<K extends keyof ProgressEvents>(name: K, callback: (data: ProgressEvents[K]) => void): () => void {
    const handler = (_event: unknown, data: ProgressEvents[K]) => callback(data);
    ipcRenderer.on(name, handler);
    return () => ipcRenderer.removeListener(name, handler);
  }
  // Keep the existing channel names, order, argument forwarding and Promise identity.
  // Each migrated method is checked against the shared contract without a bridge-wide cast.
  const bridge: NotebookBridge = {
    plannerAction: (...args) => ipcRenderer.invoke('plannerAction', ...args),
    bindPlatform: (...args) => ipcRenderer.invoke('bindPlatform', ...args),
    refreshPlatform: (...args) => ipcRenderer.invoke('refreshPlatform', ...args),
    unbindPlatform: (...args) => ipcRenderer.invoke('unbindPlatform', ...args),
    getContests: (...args) => ipcRenderer.invoke('getContests', ...args),
    bootstrap: (...args) => ipcRenderer.invoke('bootstrap', ...args),
    sync: (...args) => ipcRenderer.invoke('sync', ...args),
    submit: (...args) => ipcRenderer.invoke('submit', ...args),
    comment: (...args) => ipcRenderer.invoke('comment', ...args),
    openExternal: (...args) => ipcRenderer.invoke('openExternal', ...args),
    openAuthUrl: (...args) => ipcRenderer.invoke('openAuthUrl', ...args),
    formatCode: (...args) => ipcRenderer.invoke('formatCode', ...args),
    saveSettings: (...args) => ipcRenderer.invoke('saveSettings', ...args),
    login: (...args) => ipcRenderer.invoke('login', ...args),
    logout: (...args) => ipcRenderer.invoke('logout', ...args),
    cancelLogin: (...args) => ipcRenderer.invoke('cancelLogin', ...args),
    getComments: (...args) => ipcRenderer.invoke('getComments', ...args),
    propose: (...args) => ipcRenderer.invoke('propose', ...args),
    updateLocal: (...args) => ipcRenderer.invoke('updateLocal', ...args),
    exportLocal: (...args) => ipcRenderer.invoke('exportLocal', ...args),
    saveDocument: (...args) => ipcRenderer.invoke('saveDocument', ...args),
    saveAlgorithmTopic: (...args) => ipcRenderer.invoke('saveAlgorithmTopic', ...args),
    saveAlgorithmNote: (...args) => ipcRenderer.invoke('saveAlgorithmNote', ...args),
    deleteDocument: (...args) => ipcRenderer.invoke('deleteDocument', ...args),
    deleteIssue: (...args) => ipcRenderer.invoke('deleteIssue', ...args),
    refreshAccount: (...args) => ipcRenderer.invoke('refreshAccount', ...args),
    checkStartupUpdates: (...args) => ipcRenderer.invoke('checkStartupUpdates', ...args),
    checkForUpdates: (...args) => ipcRenderer.invoke('checkForUpdates', ...args),
    downloadUpdate: (...args) => ipcRenderer.invoke('downloadUpdate', ...args),
    installUpdate: (...args) => ipcRenderer.invoke('installUpdate', ...args),
    getTagCatalog: (...args) => ipcRenderer.invoke('getTagCatalog', ...args),
    requestTag: (...args) => ipcRenderer.invoke('requestTag', ...args),
    getTagReview: (...args) => ipcRenderer.invoke('getTagReview', ...args),
    reviewTag: (...args) => ipcRenderer.invoke('reviewTag', ...args),
    onAuthProgress: callback => subscribe('auth-progress', callback),
    onUpdateProgress: callback => subscribe('update-progress', callback)
  };
  contextBridge.exposeInMainWorld('notebook', bridge);
})();
