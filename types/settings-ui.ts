import type { AppAccount, AppAuthProgress, AppCall, AppLocal, AppPayload, AppRepository, AppSettings } from './app';

/** Only device-flow progress registration is used directly by this controller. */
export interface SettingsUIBridge {
  onAuthProgress?(listener: (progress: unknown) => void): unknown;
}

export interface SettingsUIOptions {
  demo: boolean;
  bridge?: SettingsUIBridge;
  themeStorage: string;
  getBusy(): boolean;
  setBusy(value: boolean): void;
  getSettings(): AppSettings;
  setSettings(settings: AppSettings): void;
  getAccount(): AppAccount | null;
  getAuthStatus(): NonNullable<AppPayload['authStatus']>;
  getPermissions(): NonNullable<AppPayload['permissions']>;
  setPermissionsRepo(repo: string): void;
  getError(): string;
  setError(error: string): void;
  getLocal(): AppLocal;
  repo(): string;
  repoSource(): string;
  quotaBlocked(): boolean;
  reauthNeeded(): boolean;
  call: AppCall;
  applyPayload(payload: unknown): void;
  /** Clear remote records, issues, algorithm notes/topics, lastSync and hydrate an empty tree. */
  resetRepositoryData(): void;
  /** Clear comments/selection, leave focused detail, and remove the reading-detail class. */
  resetSourceView(): void;
  clearComments(): void;
  refreshFilters(): void;
  render(): void;
  renderUpdate(): void;
  updateStatus(): void;
  sync(): Promise<void>;
  writeDemo(): void;
  toast(message: string | undefined): void;
  errorMessage(error: unknown): string;
}

export interface SettingsUIController {
  readonly settingsPreview: AppSettings | null;
  readonly editingRepos: AppRepository[];
  readonly editingActiveId: string;
  readonly authUrl: string;
  readTheme(): string;
  applyTheme(theme: string): void;
  applyCodeSettings(settings?: AppSettings): void;
  renderRepoSelector(): void;
  renderSettingsRepoList(): void;
  switchRepository(event: Event): Promise<void>;
  addRepository(): void;
  changeTheme(event: Event): Promise<void>;
  openSettings(): void;
  saveSettings(event: Event): Promise<void>;
  previewCodeFontSize(): void;
  previewCodeLineNumbers(): void;
  closeSettings(): void;
  renderAccount(): void;
  openAccount(): void;
  startLoginFromBanner(): Promise<void>;
  accountAction(action: string): Promise<boolean>;
  receiveAuthProgress(progress: AppAuthProgress | unknown): void;
  openAuthUrl(): Promise<void>;
  copyAuthUrl(): Promise<void>;
  cancelLogin(): Promise<void>;
  loginFromSettings(): Promise<void>;
  exportLocal(): Promise<void>;
}

export interface SettingsUIApi {
  create(options: SettingsUIOptions): SettingsUIController;
}
