/** Contest UI cache values retain legacy fields and defer display coercion to the DOM. */
export interface HomeContest {
  [key: string]: unknown;
  id?: unknown;
  title?: unknown;
  url?: unknown;
  startTime?: unknown;
  endTime?: unknown;
}

export interface HomeContestPlatform {
  id: string;
  name: string;
  url: string;
}

/** Only the outer platform list was validated by the original renderer. */
export interface HomeContestPlatformInput {
  [key: string]: unknown;
  id?: unknown;
  contests?: unknown;
  updatedAt?: unknown;
  stale?: unknown;
  error?: unknown;
}

export interface HomeContestPayload {
  [key: string]: unknown;
  platforms: (HomeContestPlatformInput | null | undefined)[];
}

export interface HomeContestSource extends HomeContestPlatformInput {
  contests: HomeContest[];
}

export interface HomeContestData {
  [key: string]: unknown;
  platforms: HomeContestSource[];
}

export interface VisibleHomeContest extends HomeContest {
  start: number;
  end: number;
}

export interface MergedHomeContest extends VisibleHomeContest {
  platform: HomeContestPlatform;
}

export interface HiddenHomeContest extends HomeContest {
  id: string;
  key: string;
  platform: Pick<HomeContestPlatform, 'id' | 'name'>;
  start: number | null;
  end: number | null;
}

export interface HomeContestSettings {
  [key: string]: unknown;
  contestOptOuts?: unknown;
}

export interface HomeContestsOptions {
  demo: boolean;
  getSettings(): HomeContestSettings;
  setSettings(settings: HomeContestSettings): void;
  getView(): string;
  getLoading(): boolean;
  canRefresh(): boolean;
  call(name: 'getContests' | 'saveSettings', argument: boolean | HomeContestSettings): Promise<unknown>;
  writeDemo(): void;
  toast(message: string): void;
  errorMessage(error: unknown): string;
  openExternal(url: unknown): Promise<unknown> | void;
}

export interface HomeContestsController {
  acceptContests(payload: unknown): boolean;
  renderHomeContests(): HTMLElement;
  updateContestStatus(): void;
  updateContestPreferenceControls(): void;
  renderContestCards(now?: number): void;
  tickContests(): void;
  refreshVisibleContests(): void;
  refreshContests(force?: boolean): Promise<void>;
  openContestRestore(): void;
  restoreSelectedContests(): Promise<void>;
  renderContestRestoreOptions(): void;
  updateContestRestoreCount(): void;
  closeContestRestore(): void;
  selectAllContestRestore(): void;
  selectNoContestRestore(): void;
  cancelContestRestore(event: Event): void;
  /** Wire the static restore dialog, one-second tick, focus and visibility listeners once. */
  start(): void;
}

export interface HomeContestsApi {
  create(options: HomeContestsOptions): HomeContestsController;
}
