import type { LocalDataSnapshot } from './records';
import type { UpdateProgress } from '../contracts/notebook';

/** state() annotates cached objects without reparsing their persisted fields. */
export interface SourceScope { repo: string; serverUrl: string; sourceKey: string }
export type CachedDocument = Record<string, unknown> & SourceScope & { kind: 'document' };
export type CachedEntry = Record<string, unknown> & SourceScope;
/** Fields from services not yet migrated remain unknown, including old disk values. */
export interface BootstrapPayload {
  records: CachedDocument[];
  algorithmNotes: CachedEntry[];
  algorithmTopics: CachedEntry[];
  issues: CachedEntry[];
  local: LocalDataSnapshot;
  lastSync: unknown;
  tagCatalog: unknown;
  tagCatalogError: unknown;
  settings: Record<string, unknown>;
  account: unknown;
  authStatus: unknown;
  appVersion: string;
  update: UpdateProgress | undefined;
  updateCapability: unknown;
  permissions: unknown;
  contests: unknown;
  platforms: unknown;
  planner: unknown;
  error: string | null;
}
