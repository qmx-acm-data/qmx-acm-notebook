import type { BootstrapPayload } from '../models/bootstrap';
import type { LocalDataSnapshot, LocalUpdate } from '../models/records';
import type { PlannerActionArgs, PlannerSnapshot } from '../models/planner';
import type {
  AlgorithmNoteInput, AlgorithmTopic, AlgorithmTopicInput, CommentInput, CommentNumber,
  CommentSnapshot, ContestSnapshot, DeletedDocument, DeletedIssue, DeleteDocumentInput,
  DocumentWriteInput, InstallUpdateResult, IssueInput, LoginAccount, PlatformCode,
  PlatformSnapshot, SavedDocument, SettingsUpdate, TagCatalog, TagRequest, TagRequestInput,
  TagReviewInput, TagReviewResult, TagReviewSnapshot
} from '../models/ipc-services';

/** IPC contracts are types only. Main-process validation remains authoritative. */
export interface FormatCodeResult { code: string; error?: string }

/** Only these eight methods currently use the runtime boundary registration wrapper. */
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

/** Exact renderer calls for the remaining handlers, independent of boundary migration. */
export interface ServiceMethods {
  bindPlatform(platform: PlatformCode, url: string): Promise<PlatformSnapshot>;
  refreshPlatform(platform: PlatformCode): Promise<PlatformSnapshot>;
  unbindPlatform(platform: PlatformCode): Promise<PlatformSnapshot>;
  getContests(force?: boolean): Promise<ContestSnapshot>;
  sync(): Promise<BootstrapPayload>;
  submit(record: DocumentWriteInput): Promise<SavedDocument>;
  /** The POST response is returned directly, without validating its JSON shape. */
  comment(data: CommentInput): Promise<unknown>;
  saveSettings(data: SettingsUpdate): Promise<BootstrapPayload>;
  login(): Promise<LoginAccount>;
  logout(): Promise<BootstrapPayload>;
  getComments(number: CommentNumber): Promise<CommentSnapshot[]>;
  propose(record: DocumentWriteInput): Promise<SavedDocument>;
  saveDocument(record: DocumentWriteInput): Promise<SavedDocument>;
  saveAlgorithmTopic(data: AlgorithmTopicInput): Promise<AlgorithmTopic>;
  saveAlgorithmNote(record: AlgorithmNoteInput): Promise<SavedDocument>;
  deleteDocument(record: DeleteDocumentInput): Promise<DeletedDocument>;
  deleteIssue(record: IssueInput): Promise<DeletedIssue>;
  refreshAccount(): Promise<BootstrapPayload>;
  checkStartupUpdates(): Promise<UpdateProgress | null>;
  checkForUpdates(): Promise<UpdateProgress>;
  downloadUpdate(): Promise<UpdateProgress>;
  installUpdate(): Promise<InstallUpdateResult>;
  getTagCatalog(): Promise<TagCatalog>;
  requestTag(data: TagRequestInput): Promise<TagRequest | null>;
  getTagReview(): Promise<TagReviewSnapshot>;
  reviewTag(data: TagReviewInput): Promise<TagReviewResult>;
}
/** Retained for channel-name compatibility; no unrestricted argument fallback remains. */
export type LegacyMethodName = keyof ServiceMethods;
export type InvokeMethods = BoundaryMethods & ServiceMethods;
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
