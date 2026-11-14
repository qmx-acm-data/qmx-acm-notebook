import type { InvokeArgs, InvokeName, InvokeResult, NotebookBridge, ProgressEvents } from '../src/shared/contracts/notebook';

/** Minimal Electron surface used by the sandbox preload; no Node globals reach the page. */
export interface ElectronPreload {
  contextBridge: { exposeInMainWorld(name: 'notebook', bridge: NotebookBridge): void };
  ipcRenderer: {
    invoke<K extends InvokeName>(name: K, ...args: InvokeArgs<K>): Promise<InvokeResult<K>>;
    on<K extends keyof ProgressEvents>(name: K, handler: (event: unknown, data: ProgressEvents[K]) => void): unknown;
    removeListener<K extends keyof ProgressEvents>(name: K, handler: (event: unknown, data: ProgressEvents[K]) => void): unknown;
  };
}
