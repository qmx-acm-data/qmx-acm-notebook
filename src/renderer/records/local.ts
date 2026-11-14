import type { NormalizedLocalData, RawLocalData, RawLocalRecord } from '../../shared/models/records';

export const LocalRecords = { createNormalizer };

export function createNormalizer(uuid: () => string): (local: unknown) => NormalizedLocalData {
  const migratedClientIds = new Map<string, unknown>();
  return function normalizeLocal(local: unknown): NormalizedLocalData {
    // Optional property access also boxes primitive legacy roots and entries.
    const raw = local as RawLocalData | null | undefined;
    return {
      records: (Array.isArray(raw?.records) ? raw.records : [])
        .filter((record: unknown): record is RawLocalRecord & { kind: 'local' } =>
          (record as RawLocalRecord | null | undefined)?.kind === 'local')
        .map(record => {
          const legacyKey = record.id == null ? null : String(record.id);
          const clientId = record.clientId || (legacyKey && migratedClientIds.get(legacyKey)) || uuid();
          if (legacyKey) migratedClientIds.set(legacyKey, clientId);
          return {
            ...record,
            clientId,
            id: record.id ?? `local:${clientId}`,
            ownerId: record.ownerId == null ? null : String(record.ownerId)
          };
        }),
      favorites: Array.isArray(raw?.favorites) ? raw.favorites : [],
      mastery: raw?.mastery && typeof raw.mastery === 'object' ? raw.mastery : {},
      draft: raw?.draft && typeof raw.draft === 'object' ? raw.draft : {},
      learningPaths: raw?.learningPaths && typeof raw.learningPaths === 'object' && !Array.isArray(raw.learningPaths) ? raw.learningPaths : {}
    };
  };
}
