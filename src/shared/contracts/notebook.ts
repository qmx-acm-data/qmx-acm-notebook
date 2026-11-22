import type { ProblemEnrichmentView, SaveProblemSupplementInput, ProblemAIConfigInput, ProblemAIStatus, SuggestProblemSupplementInput } from '../models/problem-enrichment';
import type { ClistBulkState } from '../models/clist-bulk';
import type { ClistSharedCacheStatus, ClistSharedCacheResult } from '../models/clist-shared-cache';
import type { LibrarySyncState } from '../models/library-sync';
import type { DifficultyBackfillState } from '../models/difficulty-backfill';
import type { DailyDrawFilters, DailyDrawResult, DailyTagCatalog, LibrarySyncResult } from '../models/daily-problem';
import type { Trick, SaveTrickInput, DeleteTrickInput, DeletedTrick } from '../models/trick';
import type { LearningCurriculumDocument, SaveLearningCurriculumInput } from '../models/learning-curriculum';
import type { LearningGateContent, SaveLearningGateInput } from '../models/learning-content';
import type { AlgorithmNodeContent, SaveAlgorithmNodeContentInput } from '../models/algorithm-node-content';
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
export interface ClistCredentialInput { username: string; apiKey: string }
export interface ClistStatus { configured: boolean; username: string | null }

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
  dailyDraw(filters: DailyDrawFilters): Promise<DailyDrawResult>;
  getDailyTagCatalog(): Promise<DailyTagCatalog>;
  getClistBulkStatus(): Promise<ClistBulkState>;
  startClistBulkSync(): Promise<ClistBulkState>;
  pauseClistBulkSync(): Promise<ClistBulkState>;
  getClistSharedCacheStatus(): Promise<ClistSharedCacheStatus>;
  exportClistSharedCache(): Promise<{ canceled: boolean; status: ClistSharedCacheStatus }>;
  importClistSharedCache(): Promise<ClistSharedCacheResult>;
  syncClistSharedCache(url: string): Promise<ClistSharedCacheResult>;
  getLibrarySyncStatus(): Promise<LibrarySyncState>;
  pauseLibrarySync(): Promise<LibrarySyncState>;
  getDifficultyBackfillStatus(): Promise<DifficultyBackfillState>;
  startDifficultyBackfill(): Promise<DifficultyBackfillState>;
  pauseDifficultyBackfill(): Promise<DifficultyBackfillState>;
  refreshProblemClistRating(url: string): Promise<{ problem: DailyDrawResult['problem']; message: string }>;
  getProblemEnrichment(url: string): Promise<ProblemEnrichmentView>;
  saveProblemEnrichment(input: SaveProblemSupplementInput): Promise<ProblemEnrichmentView>;
  removeProblemEnrichment(input: { url: string; expectedRevision: number }): Promise<ProblemEnrichmentView>;
  suggestProblemEnrichment(input: SuggestProblemSupplementInput): Promise<ProblemEnrichmentView>;
  saveProblemAIConfig(input: ProblemAIConfigInput): Promise<ProblemAIStatus>;
  clearProblemAIConfig(): Promise<ProblemAIStatus>;
  getProblemAIStatus(): Promise<ProblemAIStatus>;
  updateLibrary(full?: boolean): Promise<LibrarySyncResult>;
  sync(): Promise<BootstrapPayload>;
  submit(record: DocumentWriteInput): Promise<SavedDocument>;
  /** The POST response is returned directly, without validating its JSON shape. */
  comment(data: CommentInput): Promise<unknown>;
  saveSettings(data: SettingsUpdate): Promise<BootstrapPayload>;
  login(): Promise<LoginAccount>;
  logout(): Promise<BootstrapPayload>;
  saveClistCredentials(data: ClistCredentialInput): Promise<ClistStatus>;
  clearClistCredentials(): Promise<ClistStatus>;
  getClistStatus(): Promise<ClistStatus>;
  getComments(number: CommentNumber): Promise<CommentSnapshot[]>;
  propose(record: DocumentWriteInput): Promise<SavedDocument>;
  saveDocument(record: DocumentWriteInput): Promise<SavedDocument>;
  saveTrick(input: SaveTrickInput): Promise<Trick>;
  deleteTrick(input: DeleteTrickInput): Promise<DeletedTrick>;
  saveAlgorithmTopic(data: AlgorithmTopicInput): Promise<AlgorithmTopic>;
  saveLearningGate(data: SaveLearningGateInput): Promise<LearningGateContent>;
  saveLearningCurriculum(input: SaveLearningCurriculumInput): Promise<LearningCurriculumDocument>;
  saveAlgorithmNodeContent(input: SaveAlgorithmNodeContentInput): Promise<AlgorithmNodeContent>;
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
