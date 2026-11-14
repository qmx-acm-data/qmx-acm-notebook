import type { BootstrapPayload } from '../models/bootstrap';
import type { LocalDataSnapshot, LocalUpdate } from '../models/records';
import type { PlannerActionArgs, PlannerSnapshot } from '../models/planner';

/** IPC contracts are types only. Main-process validation remains authoritative. */
export interface FormatCodeResult { code: string; error?: string }

/** Migrated boundary and local-data methods; other services remain explicitly untyped. */
export interface BoundaryMethods {
  openExternal(url: string): Promise<void>;
  openAuthUrl(url: string): Promise<boolean>;
  formatCode(source: string, language: string): Promise<FormatCodeResult>;
  cancelLogin(): Promise<void>;
  exportLocal(): Promise<boolean>;
  bootstrap(): Promise<BootstrapPayload>;
  updateLocal(data: LocalUpdate): Promise<LocalDataSnapshot>;
  plannerAction(...args: PlannerActionArgs): Promise<PlannerSnapshot>;
}

export type LegacyMethodName =
  | 'bindPlatform' | 'refreshPlatform' | 'unbindPlatform' | 'getContests'
  | 'sync' | 'submit' | 'comment' | 'saveSettings' | 'login' | 'logout'
  | 'getComments' | 'propose' | 'saveDocument' | 'saveAlgorithmTopic'
  | 'saveAlgorithmNote' | 'deleteDocument' | 'deleteIssue' | 'refreshAccount'
  | 'checkStartupUpdates' | 'checkForUpdates' | 'downloadUpdate' | 'installUpdate'
  | 'getTagCatalog' | 'requestTag' | 'getTagReview' | 'reviewTag';
export type LegacyMethods = Record<LegacyMethodName, (...args: unknown[]) => Promise<unknown>>;
export type InvokeMethods = BoundaryMethods & LegacyMethods;
export type InvokeName = keyof InvokeMethods;
export type InvokeArgs<K extends InvokeName> = Parameters<InvokeMethods[K]>;
export type InvokeResult<K extends InvokeName> = Awaited<ReturnType<InvokeMethods[K]>>;

/** OAuth device responses have not been runtime-validated: do not promise valid scalar values. */
export interface AuthProgress { userCode: unknown; url: unknown; expiresIn: unknown }
export interface UpdateProgress {
  phase: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  currentVersion: string;
  latestVersion: string | null;
  version: string | null;
  available: boolean;
  downloaded: number;
  total: number;
  percent: number;
  message: string;
  releaseUrl?: string | null;
  downloadKind?: 'full' | 'delta';
  fullSize?: number;
  deltaSteps?: number;
  deltaReason?: string | null;
}
export interface ProgressEvents { 'auth-progress': AuthProgress; 'update-progress': UpdateProgress }
export interface NotebookBridge extends InvokeMethods {
  onAuthProgress(callback: (data: AuthProgress) => void): () => void;
  onUpdateProgress(callback: (data: UpdateProgress) => void): () => void;
}

/** Operations may be synchronous in main; IPC always exposes their awaited result. */
export type BoundaryName = keyof BoundaryMethods;
export type BoundaryHandlers = {
  [K in BoundaryName]: (...args: Parameters<BoundaryMethods[K]>) =>
    Awaited<ReturnType<BoundaryMethods[K]>> | PromiseLike<Awaited<ReturnType<BoundaryMethods[K]>>>;
};
export type BoundaryRegister = <K extends BoundaryName>(name: K, handler: BoundaryHandlers[K]) => void;
