/** Types only: reading JSON or crossing IPC does not validate record contents. */
export interface RawRecord extends Record<string, unknown> {
  id?: unknown;
  kind?: unknown;
}

/** The structural requirement checked by updateLocal, before ownership checks and filtering. */
export interface RecordEnvelope extends RawRecord {
  id: string;
}

/** ID-bearing persisted/legacy entries may be local records or old online mirrors. */
export type StoredRecord = RecordEnvelope;

/** Local JSON predates client IDs and account ownership; retain all legacy fields. */
export interface RawLocalRecord extends RawRecord {
  clientId?: unknown;
  ownerId?: unknown;
}

export interface RawLocalData extends Record<string, unknown> {
  records?: unknown;
  favorites?: unknown;
  mastery?: unknown;
  draft?: unknown;
  learningPaths?: unknown;
  published?: unknown;
}

/** main.local supplies these keys, but persisted values can overwrite every default. */
export interface StoredLocalData extends RawLocalData {
  records: unknown;
  favorites: unknown;
  mastery: unknown;
  draft: unknown;
}

/** A main-process snapshot is still persisted JSON, not renderer-normalized data. */
export type LocalDataSnapshot = StoredLocalData;

/** Other fields are shallow-spread by main; their contents are not validated. */
export interface LocalUpdate extends RawLocalData {
  records: RecordEnvelope[];
}

/**
 * Expected renderer authoring shape. This is not a guarantee about arbitrary cache
 * entries: normalizeLocal preserves truthy client IDs and non-nullish record IDs.
 */
export interface LocalRecord extends RecordEnvelope {
  kind: 'local';
  clientId: string;
  ownerId: string | null;
}

/** Actual normalizeLocal output when its source fields have not been validated. */
export interface NormalizedLocalRecord extends RawLocalRecord {
  /** An inherited kind passes the filter but is not copied by object spread. */
  kind?: 'local';
  id: unknown;
  clientId: unknown;
  ownerId: string | null;
}

export interface NormalizedLocalData {
  records: NormalizedLocalRecord[];
  favorites: unknown[];
  /** The renderer checks typeof object; arrays also pass for mastery and draft. */
  mastery: object;
  draft: object;
  /** Arrays are rejected here, but entries and learning-path contents are unchecked. */
  learningPaths: object;
}

/** Scalar metadata explicitly converted by the document and issue parsers. */
interface ParsedProblemFields extends RecordEnvelope {
  pid: string;
  platform: string;
  rating: number | null;
  difficulty: string;
  luoguDifficulty: string;
  authorId: number | null;
  body: string;
}

/**
 * Domain result of parseDocument with ordinary source/path extras. Arbitrary extra
 * properties are retained; callers that override parser fields must model that override.
 * Unvalidated cache records must not be assumed to have this complete shape.
 */
interface ParsedDocumentFields extends ParsedProblemFields {
  path: string;
  title: string;
  tags: string[];
  author: string;
  problemUrl: string;
  clientId: string;
  managed: boolean;
  /** YAML schema values are copied without validation. */
  schema: unknown;
  updatedAt: string;
}

export interface DocumentRecord extends ParsedDocumentFields {
  kind: 'document';
}

/** issueRecord copies API scalars and label names without validating their types. */
export interface IssueRecord extends ParsedProblemFields {
  kind: 'issue';
  number: unknown;
  title: unknown;
  tags: unknown[];
  author: unknown;
  url: unknown;
  updatedAt: unknown;
  comments: unknown;
  state: unknown;
  /** Unlike parseDocument, issueRecord does not stringify this metadata field. */
  problemUrl: unknown;
}

export type AlgorithmNoteScope = 'public' | 'personal';

/** parseAlgorithmNote adds these fields to the parsed document shape. */
export interface AlgorithmNoteRecord extends ParsedDocumentFields {
  kind: 'algorithm-note';
  noteScope: AlgorithmNoteScope;
  nodeId: string;
  featured: boolean;
}

/** Complete domain records, rather than arbitrary persisted/cache entries. */
export type NotebookRecord = DocumentRecord | IssueRecord | AlgorithmNoteRecord | LocalRecord;
