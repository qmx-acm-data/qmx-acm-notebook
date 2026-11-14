import type { BoundaryMethods, NotebookBridge } from '../src/shared/contracts/notebook';

declare global {
  interface Window {
    /** Absent in browser previews and desktop preview mode. */
    notebook?: NotebookBridge;
    NotebookIPC: (bridge: BoundaryMethods) => BoundaryMethods;
  }
}

export {};
