import type { AuthAccount } from './auth';
import type { SourceScope } from './bootstrap';
import type { Contest, ContestSourceId } from './contests';
import type { AlgorithmNoteRecord, DocumentRecord } from './records';

/** Renderer authoring inputs; main still performs all validation and ownership checks. */
export type PlatformCode = 'CF' | 'AT' | 'LG' | 'NC' | 'LC';
/** The service validates the outer object only; saved entries remain unchecked JSON. */
export type PlatformSnapshot = Record<string, unknown>;

export interface ContestPlatformSnapshot {
  id: ContestSourceId;
  name: string;
  url: string;
  contests: Contest[];
  updatedAt: string | null;
  error: string | null;
  stale: boolean;
}
export interface ContestSnapshot { platforms: ContestPlatformSnapshot[] }

export interface SourceInput {
  repo?: string;
  serverUrl?: string;
  sourceKey?: string;
}
export interface RepositoryInput {
  id?: string;
  name?: string;
  repo: string;
  serverUrl?: string;
}
export interface SettingsUpdate {
  repositories?: RepositoryInput[];
  activeRepoId?: string;
  repo?: string;
  serverUrl?: string;
  clientId?: string;
  theme?: string;
  displayName?: string;
  autoSync?: boolean;
  codeFontSize?: number;
  codeLineNumbers?: boolean;
  contestOptOuts?: string[];
}

/** Unknown metadata is deliberately retained: YAML values are normalized when parsed. */
export interface DocumentFields extends SourceInput, Record<string, unknown> {
  body?: string;
  tags?: unknown[];
}
/** New documents require a stable client ID; edits require both path and current SHA. */
export type DocumentWriteInput = DocumentFields & (
  | { path?: undefined; sha?: undefined; clientId: string }
  | { path: string; sha: string; clientId?: string }
);
export interface AlgorithmNoteFields extends DocumentFields {
  body: string;
  clientId?: string;
  noteScope?: 'public' | 'personal';
  featured?: boolean;
}
export type AlgorithmNoteInput = AlgorithmNoteFields & (
  | { path?: undefined; sha?: unknown }
  /** Algorithm notes require a truthy SHA on edits, without checking its scalar type. */
  | { path: string; sha: unknown }
);
export interface DeleteDocumentInput extends SourceInput { path: string; sha: string }
/** These handlers additionally require the issue's repository to equal the active one. */
export interface IssueInput extends SourceInput { repo: string; number: number }
/** getComments/comment coerce numeric issue identifiers; deletion requires a number. */
export type CommentNumber = number | string;
export interface CommentInput extends SourceInput { repo: string; number: CommentNumber; body: string }

/** recordResult dispatches on path, so either save method can return either parsed kind. */
export type SavedDocument = (DocumentRecord | AlgorithmNoteRecord) & SourceScope & {
  sha: unknown;
  branch: unknown;
  url: string;
};
export interface DeletedDocument extends SourceScope {
  id: string;
  path: string;
  deleted: boolean;
}
export interface DeletedIssue { id: string; number: number; repo: string; deleted: boolean }
/** Auth.commit validates id/login before login returns this account. */
export interface LoginAccount extends AuthAccount {
  name: unknown;
  avatarUrl: unknown;
  avatarData: string | null;
}
/** Only the projection's keys are fixed; none of these provider fields are validated. */
export interface CommentSnapshot {
  id: unknown;
  body: unknown;
  author: unknown;
  createdAt: unknown;
  url: unknown;
}

export interface TagEntry extends Record<string, unknown> { id?: unknown; name: string }
export interface TagCategory extends Record<string, unknown> { id: unknown; name: unknown; tags: TagEntry[] }
export interface TagCatalog extends Record<string, unknown> {
  categories: TagCategory[];
  approvals?: Record<string, unknown>;
}
export interface TagRequestInput { category: string; name: string }
export interface TagRequestExpected { category: string; name: string; updatedAt?: unknown }
export interface TagRequest extends Record<string, unknown> {
  number: unknown;
  category: string;
  name: string;
  author: unknown;
  url: unknown;
  state: unknown;
  expected?: TagRequestExpected;
}
export interface TagReviewSnapshot { canReview: boolean; requests: TagRequest[] }
export type TagReviewDecision = 'approve' | 'reject';
export interface TagReviewInput {
  number: number;
  decision: TagReviewDecision;
  expected: TagRequestExpected;
}
export interface TagReviewResult {
  number: number;
  decision: TagReviewDecision;
  approved: boolean;
  closed: boolean;
}

export type AlgorithmDifficulty = 'basic' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
export interface AlgorithmTopicFields extends SourceInput {
  parentId: string;
  label: string;
  fullLabel: string;
  scope?: string;
  requestId?: string;
}
export type AlgorithmTopicInput = AlgorithmTopicFields & (
  | { kind?: 'algorithm'; color: AlgorithmDifficulty }
  | { kind: 'directory'; color?: 'parent' }
);
export interface AlgorithmTopic extends Record<string, unknown> {
  repo: string;
  /** An id from an existing topic is regex-coerced, rather than checked as a string. */
  id: unknown;
  parentId: string;
  label: string;
  fullLabel: string;
  kind: 'directory' | 'algorithm';
  color: string;
  scope: string;
  requestId?: string;
  createdAt: string;
  createdBy: { id: number; login: string };
}
export interface InstallUpdateResult { installing: boolean }
