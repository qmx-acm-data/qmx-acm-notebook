import type { AuthAccount } from '../../shared/models/auth.js';
import type { PlannerActionArgs } from '../../shared/models/planner.js';

/** Property-access views only: persisted JSON and IPC fields are not validated by these types. */
export interface RecordView {
  id?: unknown;
  kind?: unknown;
  repo?: unknown;
  serverUrl?: unknown;
  sourceKey?: unknown;
  path?: unknown;
  clientId?: unknown;
  authorId?: unknown;
  ownerId?: unknown;
  proposalUrl?: unknown;
  number?: unknown;
}
export interface CacheView extends Record<string, unknown> {
  repos?: Record<string, CacheView>;
  repo?: unknown;
  sourceKey?: unknown;
  serverUrl?: unknown;
  records?: RecordView[];
  issues?: RecordView[];
  algorithmNotes?: RecordView[];
  algorithmTopics?: RecordView[];
  tagCatalog?: unknown;
  tagCatalogError?: unknown;
  lastSync?: unknown;
}
export interface LocalView extends Record<string, unknown> {
  records: RecordView[];
  favorites: unknown[];
  mastery: Record<string, unknown>;
  published?: Record<string, unknown>;
}
export interface LocalUpdateView extends Record<string, unknown> { records: RecordView[] }
export interface SettingsUpdateView {
  repositories?: unknown;
  activeRepoId?: unknown;
  repo?: unknown;
  serverUrl?: unknown;
  clientId?: unknown;
  theme?: unknown;
  displayName?: unknown;
  autoSync?: unknown;
  codeFontSize?: unknown;
  codeLineNumbers?: unknown;
  contestOptOuts?: unknown;
}
export interface IdentityAccountView {
  id: unknown;
  login: unknown;
  name?: unknown;
  avatarUrl?: unknown;
  avatarData?: string | null;
}
export type MainAccount = AuthAccount | IdentityAccountView;
export interface IdentityResultView {
  account: IdentityAccountView;
  permissions?: { push: boolean; admin: boolean };
}
export interface CommentView {
  id?: unknown;
  body?: unknown;
  user?: { login?: unknown } | null;
  created_at?: unknown;
  html_url?: unknown;
}
export interface FailureView { status?: unknown; message?: unknown }
export interface OAuthView {
  error?: unknown;
  error_description?: unknown;
  user_code?: unknown;
  verification_uri?: unknown;
  expires_in?: unknown;
  interval?: unknown;
  device_code?: unknown;
  access_token?: unknown;
}
export interface AppArguments {
  getContests: [force?: unknown];
  bindPlatform: [platform: unknown, url: unknown];
  refreshPlatform: [platform: unknown];
  unbindPlatform: [platform: unknown];
  checkStartupUpdates: [];
  checkForUpdates: [];
  downloadUpdate: [];
  installUpdate: [];
  getTagCatalog: [];
  requestTag: [data: unknown];
  getTagReview: [];
  reviewTag: [data: unknown];
  saveAlgorithmTopic: [data: unknown];
  refreshAccount: [];
  sync: [];
  saveSettings: [data: SettingsUpdateView];
  login: [];
  logout: [];
  saveDocument: [record: RecordView];
  saveAlgorithmNote: [record: RecordView];
  submit: [record: RecordView];
  propose: [record: RecordView];
  deleteDocument: [record: RecordView];
  deleteIssue: [record: RecordView];
  comment: [data: RecordView];
  getComments: [number: unknown];
  plannerAction: PlannerActionArgs;
  bootstrap: [];
  updateLocal: [data: LocalUpdateView];
  openExternal: [url: string];
  openAuthUrl: [url: string];
  formatCode: [source: string, lang: string];
  cancelLogin: [];
  exportLocal: [];
}
export type Handle = <K extends keyof AppArguments>(name: K, fn: (...args: AppArguments[K]) => unknown) => void;
export interface BoundaryModule {
  registerBoundary(handle: Handle, operations: {
    [K in 'plannerAction' | 'bootstrap' | 'updateLocal' | 'openExternal' | 'openAuthUrl' | 'formatCode' | 'cancelLogin' | 'exportLocal']: (...args: AppArguments[K]) => unknown;
  }): void;
}
