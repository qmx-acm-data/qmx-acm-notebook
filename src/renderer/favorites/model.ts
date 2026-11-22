import type { AppRecord } from '../../../types/app.js';
export type FavoriteType = 'solution' | 'trick' | 'algorithm';
export interface FavoriteEntry { key: string; type: FavoriteType; record: AppRecord; source: string }
const PREFIX = 'qmx-favorite:v1:';
/** New favorites are private to an account and source; legacy string IDs remain readable. */
export function favoriteKey(account: string | null, source: string, type: FavoriteType, identity: string): string {
  return PREFIX + JSON.stringify([account, source, type, identity]);
}
export function contentType(record: AppRecord): FavoriteType {
  return record.kind === 'trick' ? 'trick' : record.kind === 'algorithm-note' ? 'algorithm' : 'solution';
}
export function contentIdentity(record: AppRecord): string { return String(record.path || record.id || record.clientId || ''); }
export function legacyFavorite(values: readonly unknown[], identity: string): boolean { return values.some(value => (typeof value === 'string' || typeof value === 'number') && !String(value).startsWith(PREFIX) && String(value) === identity); }
