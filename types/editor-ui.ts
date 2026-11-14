/** Typed adapters for the existing record editor; persistence and permissions stay with the app. */
import type { AppAccount, AppComment, AppEditor, AppFormDraft, AppLocal, AppRecord, AppResponse, AppSeed } from './app';

export type EditorUIOperation = 'saveDocument' | 'deleteDocument' | 'deleteIssue';

export interface EditorUIOptions {
  demo: boolean;
  getEditor(): AppEditor | null;
  setEditor(editor: AppEditor | null): void;
  getLocal(): AppLocal;
  setLocal(local: AppLocal): void;
  getRecords(): AppRecord[];
  setRecords(records: AppRecord[]): void;
  getIssues(): AppRecord[];
  setIssues(issues: AppRecord[]): void;
  getComments(): Map<string, AppComment[]>;
  getSelected(): string | null;
  setSelected(selected: string | null): void;
  getBusy(): boolean;
  setBusy(value: boolean): void;
  getAccount(): AppAccount | null;
  getPermissions(): { push?: boolean; admin?: boolean };
  accountId(): string | null;
  repo(): string;
  key(record: AppRecord): string;
  uuid(): string;
  isLocal(record: AppRecord): boolean;
  visibleLocal(record: AppRecord): boolean;
  canEditRemote(record: AppRecord | null | undefined): boolean;
  sameRepo(record: AppRecord): boolean;
  records(): AppRecord[];
  platformCode(value: unknown): string;
  colorRatingInput(input: HTMLInputElement): void;
  renderEditorTags(): void;
  cancelDraftSave(): void;
  persistLocal(): Promise<unknown>;
  call(operation: EditorUIOperation, argument: AppRecord): Promise<AppResponse>;
  refreshFilters(): void;
  navigate(view: string): void;
  render(): void;
  openDetail(record: AppRecord): void;
  toast(message: string | undefined): void;
  errorMessage(error: unknown): string;
}

export interface EditorUIController {
  formDraft(): AppFormDraft;
  fillForm(draft: Record<string, unknown> | undefined): void;
  renderEditorDifficulty(): void;
  setEditorPlatform(value: unknown, clearDifficulty?: boolean): void;
  draftKey(source: string, ownerId: string | null): string;
  editorError(error: unknown): void;
  openLocalSolution(problem: AppRecord): void;
  openSubmit(record?: AppRecord | null, seed?: AppSeed | null): void;
  saveDraft(required?: boolean): Promise<void>;
  saveRecord(remote: boolean): Promise<void>;
  deleteDiscussion(record: AppRecord): Promise<void>;
  deleteRecord(record: AppRecord): Promise<void>;
}

export interface EditorUIApi {
  create(options: EditorUIOptions): EditorUIController;
}
