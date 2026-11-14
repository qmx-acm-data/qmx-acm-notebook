import type {
  AlgorithmNoteRecord,
  DocumentRecord,
  IssueRecord,
  LocalDataSnapshot,
  LocalRecord,
  LocalUpdate,
  NormalizedLocalData,
  NormalizedLocalRecord,
  NotebookRecord,
  RawLocalData,
  RawLocalRecord,
  RawRecord,
  RecordEnvelope,
  StoredLocalData,
  StoredRecord
} from '../../src/shared/models/records';

/** Compile-only assertions. This function is deliberately never called. */
function recordModelAssertions(
  document: DocumentRecord,
  issue: IssueRecord,
  note: AlgorithmNoteRecord,
  local: LocalRecord,
  snapshot: LocalDataSnapshot,
  normalized: NormalizedLocalData,
  record: NotebookRecord
): void {
  const envelope: RecordEnvelope = { id: 'legacy', custom: { retained: true } };
  const minimal: StoredRecord = { id: 'legacy' };
  const mirror: StoredRecord = { id: 'issue:7', kind: 'issue', number: 7 };
  const raw: RawRecord = { kind: 'document', id: 7, title: false };
  const legacy: RawLocalRecord = { id: 'old', kind: 'local', ownerId: 42, oldField: ['kept'] };
  const malformedLegacy: RawLocalRecord = { id: 7, clientId: { retained: true } };
  const rawData: RawLocalData = { records: false, favorites: null, mastery: 'legacy', extra: 42 };
  const stored: StoredLocalData = { records: false, favorites: null, mastery: [], draft: 'legacy' };
  const update: LocalUpdate = { records: [envelope, minimal, mirror, local, document, issue, note] };
  const permissiveUpdate: LocalUpdate = {
    records: [{ id: 'legacy', kind: 'local', ownerId: 42 }],
    favorites: false, mastery: null, draft: 'legacy', learningPaths: 7, published: ['legacy'], extra: true
  };
  const authored: LocalRecord = { id: 'local:one', kind: 'local', clientId: 'one', ownerId: null };
  const oddNormalized: NormalizedLocalRecord = {
    id: 7, kind: 'local', clientId: { retained: true }, ownerId: '42', title: false
  };
  const looseNormalized: NormalizedLocalData = {
    records: [oddNormalized, authored], favorites: [null, 7], mastery: [], draft: [], learningPaths: {}
  };
  void [raw, legacy, malformedLegacy, rawData, stored, update, permissiveUpdate, looseNormalized];

  // @ts-expect-error Main requires the records array even though other update fields are optional.
  const missingRecords: LocalUpdate = { favorites: [] };
  // @ts-expect-error Each incoming entry must have a string ID.
  const numericId: RecordEnvelope = { id: 42 };
  // @ts-expect-error A stored ID-bearing envelope must have an ID.
  const missingId: StoredRecord = { kind: 'local' };
  // @ts-expect-error Renderer-authored locals require an explicit local discriminator.
  const missingKind: LocalRecord = { id: 'one', clientId: 'one', ownerId: null };
  // @ts-expect-error Renderer-authored locals require a string client ID.
  const badClient: LocalRecord = { id: 'one', kind: 'local', clientId: 42, ownerId: null };
  // @ts-expect-error Renderer-authored locals use string or null owners.
  const badOwner: LocalRecord = { id: 'one', kind: 'local', clientId: 'one', ownerId: 42 };
  // @ts-expect-error Renderer-authored locals require an explicit owner, including null.
  const missingOwner: LocalRecord = { id: 'one', kind: 'local', clientId: 'one' };
  void [missingRecords, numericId, missingId, missingKind, badClient, badOwner, missingOwner];

  const persistedRecords: unknown = snapshot.records;
  const persistedFavorites: unknown = snapshot.favorites;
  const normalizedOwner: string | null = normalized.records[0].ownerId;
  const normalizedFavorites: unknown[] = normalized.favorites;
  const legacyField: unknown = local.oldField;
  const unvalidatedIssueFields: unknown[] = [issue.number, issue.title, issue.url, issue.comments, issue.problemUrl];
  const parserSchema: unknown = document.schema;
  const noteBody: string = note.body;
  const noteTitle: string = note.title;
  const noteRating: number | null = note.rating;
  void [persistedRecords, persistedFavorites, normalizedOwner, normalizedFavorites, legacyField, unvalidatedIssueFields, parserSchema, noteBody, noteTitle, noteRating];
  // @ts-expect-error Stored local defaults can be overwritten by malformed JSON values.
  const promisedRecords: StoredRecord[] = snapshot.records;
  // @ts-expect-error No validation of persisted favorites is performed by main.local.
  const promisedFavorites: string[] = snapshot.favorites;
  // @ts-expect-error normalizeLocal preserves a non-nullish legacy ID without string conversion.
  const promisedNormalizedId: string = normalized.records[0].id;
  // @ts-expect-error normalizeLocal preserves a truthy legacy client ID without string conversion.
  const promisedNormalizedClient: string = normalized.records[0].clientId;
  // @ts-expect-error Favorite array contents have not been normalized to strings.
  const promisedFavorite: string = normalized.favorites[0];
  // @ts-expect-error Legacy extension values stay unknown rather than becoming arbitrary typed values.
  const promisedTitle: string = local.title;
  // @ts-expect-error Issue API numbers are copied rather than validated.
  const promisedIssueNumber: number = issue.number;
  // @ts-expect-error Issue metadata problemUrl is copied rather than stringified.
  const promisedIssueUrl: string = issue.problemUrl;
  // @ts-expect-error Schema is raw YAML metadata, not necessarily a number.
  const promisedSchema: number = document.schema;
  void [promisedRecords, promisedFavorites, promisedNormalizedId, promisedNormalizedClient, promisedFavorite, promisedTitle, promisedIssueNumber, promisedIssueUrl, promisedSchema];

  if (record.kind === 'document') {
    const path: string = record.path;
    const managed: boolean = record.managed;
    void [path, managed];
  } else if (record.kind === 'issue') {
    const tags: unknown[] = record.tags;
    void tags;
  } else if (record.kind === 'algorithm-note') {
    const scope: 'public' | 'personal' = record.noteScope;
    const featured: boolean = record.featured;
    const nodeId: string = record.nodeId;
    void [scope, featured, nodeId];
  } else {
    const ownerId: string | null = record.ownerId;
    const clientId: string = record.clientId;
    void [ownerId, clientId];
  }
  // @ts-expect-error Algorithm-note scopes match the parser's two outputs.
  const privateScope: AlgorithmNoteRecord['noteScope'] = 'private';
  void privateScope;
}
void recordModelAssertions;
