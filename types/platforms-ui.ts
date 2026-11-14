/** Browser-local platform contracts deliberately do not import Node service types. */
export interface PlatformsUIBridge {
  openExternal?(url: string): Promise<unknown>;
  bindPlatform?(code: string, ...url: string[]): Promise<unknown>;
  refreshPlatform?(code: string, ...url: string[]): Promise<unknown>;
  unbindPlatform?(code: string, ...url: string[]): Promise<unknown>;
}

export interface PlatformsUIOptions {
  bridge?: PlatformsUIBridge;
  onSettings?: () => void;
}

export interface PlatformsUIApi {
  init(options?: PlatformsUIOptions): PlatformsUIApi;
  render(mapping?: unknown): void;
  refreshAll(): Promise<void>;
  refreshPlatform(code: string): Promise<void>;
  openDialog(code: string): void;
}

export type PlatformMutation = 'bindPlatform' | 'refreshPlatform' | 'unbindPlatform';
export type PlatformRawMapping = Record<string, unknown>;

/** Structural access descriptions are assertions at existing use sites, not validation. */
export interface PlatformBindingAccess {
  username?: unknown;
  id?: unknown;
  url?: unknown;
}
export interface PlatformEntryAccess {
  binding?: PlatformBindingAccess;
  data?: PlatformDataAccess;
  updatedAt?: unknown;
  attemptedAt?: unknown;
  error?: unknown;
}
export interface PlatformDataAccess {
  [field: string]: unknown;
  username?: unknown;
  profileUrl?: unknown;
  solvedCount?: unknown;
  submissionCount?: unknown;
  contests?: unknown;
  ratingHistory?: unknown;
  activity?: unknown;
  sourceNote?: unknown;
}
export interface PlatformContestAccess {
  name?: unknown;
  url?: unknown;
  date?: unknown;
  rank?: unknown;
  rating?: unknown;
  delta?: unknown;
  solvedCount?: unknown;
  problemCount?: unknown;
}
export interface PlatformScopedContest extends PlatformContestAccess {
  code: string;
}
export interface PlatformActivityAccess {
  days: Record<string, unknown>;
  complete?: unknown;
  rangeComplete?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  note?: unknown;
}
export interface PlatformErrorAccess { message?: unknown }
export interface PlatformMetadata {
  code: string;
  name: string;
  example: string;
  hosts: string[];
  profile: RegExp;
}
export interface PlatformTooltipLine {
  text: string;
  bold?: boolean;
}
export type PlatformTooltipTarget = HTMLElement | SVGElement;
export interface PlatformsWindowAccess {
  notebook?: PlatformsUIBridge;
}
