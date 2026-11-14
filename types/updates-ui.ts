/** Structural descriptions of the existing update payload; no runtime validation. */
export interface UpdatesUIUpdateAccess {
  [field: string]: unknown;
  phase?: string;
  message?: string;
  available?: boolean;
  latestVersion?: string;
  currentVersion?: string;
  version?: string;
  percent?: number;
  downloaded?: number;
  total?: number;
  fullSize?: number;
  downloadKind?: string;
  deltaSteps?: number;
  deltaReason?: string;
  installing?: boolean;
}

export interface UpdatesUICapability {
  supported?: boolean;
  reason?: string;
}

/** Only update event registration and startup feature detection are needed. */
export interface UpdatesUIBridge {
  onUpdateProgress?(listener: (update: unknown) => void): unknown;
  checkStartupUpdates?: unknown;
}

export type UpdatesUIOperation = 'checkForUpdates' | 'downloadUpdate' | 'installUpdate' | 'checkStartupUpdates';

export interface UpdatesUIOptions {
  demo: boolean;
  bridge?: UpdatesUIBridge;
  getAppVersion(): string;
  getUpdate(): unknown;
  setUpdate(update: UpdatesUIUpdateAccess): void;
  getUpdateCapability(): UpdatesUICapability | null | undefined;
  getBusy(): boolean;
  setBusy(value: boolean): void;
  call(operation: UpdatesUIOperation): Promise<unknown>;
  cancelDraftSave(): void;
  getLocalWrite(): Promise<unknown>;
  resetLocalWrite(): void;
  hasEditor(): boolean;
  saveDraft(required: boolean): Promise<unknown>;
  persistLocal(): Promise<unknown>;
  renderAccount(): void;
  toast(message: string | undefined): void;
  errorMessage(error: unknown): string;
}

export interface UpdatesUIController {
  readonly updateRunning: boolean;
  readonly updateReady: boolean;
  renderUpdate(): void;
  receiveUpdate(update: unknown): void;
  saveBeforeUpdate(): Promise<void>;
  checkForUpdates(): Promise<void>;
  showStartupUpdate(): void;
  checkStartupUpdates(): Promise<void>;
  dismissStartupUpdate(): void;
}

export interface UpdatesUIApi {
  create(options: UpdatesUIOptions): UpdatesUIController;
}
