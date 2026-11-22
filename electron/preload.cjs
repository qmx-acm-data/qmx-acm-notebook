// Generated from src/preload/preload.ts; run pnpm preload:build.
"use strict";
(() => {
    const { contextBridge, ipcRenderer } = require('electron');
    function subscribe(name, callback) {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on(name, handler);
        return () => ipcRenderer.removeListener(name, handler);
    }
    // Keep the existing channel names, order, argument forwarding and Promise identity.
    // Each migrated method is checked against the shared contract without a bridge-wide cast.
    const bridge = {
        plannerAction: (...args) => ipcRenderer.invoke('plannerAction', ...args),
        bindPlatform: (...args) => ipcRenderer.invoke('bindPlatform', ...args),
        refreshPlatform: (...args) => ipcRenderer.invoke('refreshPlatform', ...args),
        unbindPlatform: (...args) => ipcRenderer.invoke('unbindPlatform', ...args),
        getContests: (...args) => ipcRenderer.invoke('getContests', ...args),
        updateLibrary: (...args) => ipcRenderer.invoke('updateLibrary', ...args),
        dailyDraw: (...args) => ipcRenderer.invoke('dailyDraw', ...args),
        getDailyTagCatalog: (...args) => ipcRenderer.invoke('getDailyTagCatalog', ...args),
        getClistBulkStatus: (...args) => ipcRenderer.invoke('getClistBulkStatus', ...args),
        startClistBulkSync: (...args) => ipcRenderer.invoke('startClistBulkSync', ...args),
        pauseClistBulkSync: (...args) => ipcRenderer.invoke('pauseClistBulkSync', ...args),
        getClistSharedCacheStatus: (...args) => ipcRenderer.invoke('getClistSharedCacheStatus', ...args),
        exportClistSharedCache: (...args) => ipcRenderer.invoke('exportClistSharedCache', ...args),
        importClistSharedCache: (...args) => ipcRenderer.invoke('importClistSharedCache', ...args),
        syncClistSharedCache: (...args) => ipcRenderer.invoke('syncClistSharedCache', ...args),
        getLibrarySyncStatus: (...args) => ipcRenderer.invoke('getLibrarySyncStatus', ...args),
        pauseLibrarySync: (...args) => ipcRenderer.invoke('pauseLibrarySync', ...args),
        getDifficultyBackfillStatus: (...args) => ipcRenderer.invoke('getDifficultyBackfillStatus', ...args),
        startDifficultyBackfill: (...args) => ipcRenderer.invoke('startDifficultyBackfill', ...args),
        pauseDifficultyBackfill: (...args) => ipcRenderer.invoke('pauseDifficultyBackfill', ...args),
        refreshProblemClistRating: (...args) => ipcRenderer.invoke('refreshProblemClistRating', ...args),
        getProblemEnrichment: (...args) => ipcRenderer.invoke('getProblemEnrichment', ...args),
        saveProblemEnrichment: (...args) => ipcRenderer.invoke('saveProblemEnrichment', ...args),
        removeProblemEnrichment: (...args) => ipcRenderer.invoke('removeProblemEnrichment', ...args),
        suggestProblemEnrichment: (...args) => ipcRenderer.invoke('suggestProblemEnrichment', ...args),
        saveProblemAIConfig: (...args) => ipcRenderer.invoke('saveProblemAIConfig', ...args),
        clearProblemAIConfig: (...args) => ipcRenderer.invoke('clearProblemAIConfig', ...args),
        getProblemAIStatus: (...args) => ipcRenderer.invoke('getProblemAIStatus', ...args),
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
        saveClistCredentials: (...args) => ipcRenderer.invoke('saveClistCredentials', ...args),
        clearClistCredentials: (...args) => ipcRenderer.invoke('clearClistCredentials', ...args),
        getClistStatus: (...args) => ipcRenderer.invoke('getClistStatus', ...args),
        cancelLogin: (...args) => ipcRenderer.invoke('cancelLogin', ...args),
        getComments: (...args) => ipcRenderer.invoke('getComments', ...args),
        propose: (...args) => ipcRenderer.invoke('propose', ...args),
        updateLocal: (...args) => ipcRenderer.invoke('updateLocal', ...args),
        exportLocal: (...args) => ipcRenderer.invoke('exportLocal', ...args),
        saveDocument: (...args) => ipcRenderer.invoke('saveDocument', ...args),
        saveTrick: (...args) => ipcRenderer.invoke('saveTrick', ...args),
        deleteTrick: (...args) => ipcRenderer.invoke('deleteTrick', ...args),
        saveAlgorithmTopic: (...args) => ipcRenderer.invoke('saveAlgorithmTopic', ...args),
        saveLearningGate: (...args) => ipcRenderer.invoke('saveLearningGate', ...args),
        saveLearningCurriculum: (...args) => ipcRenderer.invoke('saveLearningCurriculum', ...args),
        saveAlgorithmNodeContent: (...args) => ipcRenderer.invoke('saveAlgorithmNodeContent', ...args),
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
