import type { NotebookBridge } from '../src/shared/contracts/notebook';

declare global {
  interface Window {
    /** Absent in browser previews and desktop preview mode. */
    notebook?: NotebookBridge;
  }
}

export {};
