/** Appearance choices are independent: theme controls brightness, palette controls accents. */
export type ThemeMode = 'light' | 'dark';
export type Palette = 'porcelain' | 'blue' | 'violet' | 'rose' | 'amber' | 'teal';

/** Repository fields produced by main's repository normalization. */
export interface RepositorySettings {
  id: string;
  name: string;
  serverUrl: string;
  repo: string;
}

/** Disk input is deliberately unchecked; reading JSON does not validate fields. */
export interface RawSettings extends Record<string, unknown> {
  repositories?: unknown;
  activeRepoId?: unknown;
  repo?: unknown;
  serverUrl?: unknown;
  clientId?: unknown;
  theme?: unknown;
  palette?: unknown;
}

export interface NormalizedRepositories {
  repositories: RepositorySettings[];
  activeRepoId: string;
  repo: string;
  serverUrl: string;
}

/** Repositories, clientId and palette are normalized; legacy cards maps to light. */
export interface Settings extends Record<string, unknown>, NormalizedRepositories {
  clientId: string;
  theme: unknown;
  palette: Palette;
}

/** Mutable defaults belong to one main-process store lifecycle. */
export interface SettingsDefaults extends Settings {
  theme: ThemeMode;
}
