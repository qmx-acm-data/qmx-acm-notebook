import type { SourceScope } from './bootstrap';

/** Public repository Markdown document. The body is mounted only after opening it. */
export interface Trick extends SourceScope {
  id: string;
  kind: 'trick';
  clientId: string;
  path: string;
  sha: string;
  title: string;
  introduction: string;
  body: string;
  authorId: number;
  author: { id: number; login: string; name?: string };
  updatedAt: string;
  url?: string;
}
export type PublicTrick = Trick;
export interface SaveTrickInput {
  /** Keep one UUID for a new draft to make retries idempotent. */
  clientId?: string;
  path?: string;
  sha?: string;
  title: string;
  introduction: string;
  body: string;
  repo?: string;
  serverUrl?: string;
  sourceKey?: string;
}
export interface DeleteTrickInput {
  path: string;
  sha: string;
  repo?: string;
  serverUrl?: string;
  sourceKey?: string;
}
export interface DeletedTrick extends SourceScope {
  id: string;
  path: string;
  deleted: true;
}
