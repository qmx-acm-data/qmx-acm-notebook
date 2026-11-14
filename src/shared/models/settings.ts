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
}

export interface NormalizedRepositories {
  repositories: RepositorySettings[];
  activeRepoId: string;
  repo: string;
  serverUrl: string;
}

/** Only repository fields and clientId are normalized; other disk fields survive. */
export interface Settings extends Record<string, unknown>, NormalizedRepositories {
  clientId: string;
  theme: unknown;
}

/** Mutable defaults belong to one main-process store lifecycle. */
export interface SettingsDefaults extends Settings {
  theme: string;
}
