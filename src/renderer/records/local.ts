(() => {
  type RawLocal = import('../../shared/models/records').RawLocalData;
  type RawRecord = import('../../shared/models/records').RawLocalRecord;
  type NormalizedLocalData = import('../../shared/models/records').NormalizedLocalData;

  window.NotebookLocal = {
    createNormalizer(uuid: () => string) {
      const migratedClientIds = new Map<string, unknown>();
      return function normalizeLocal(local: unknown): NormalizedLocalData {
        // Optional property access also boxes primitive legacy roots and entries.
        const raw = local as RawLocal | null | undefined;
        return {
          records: (Array.isArray(raw?.records) ? raw.records : [])
            .filter((record: unknown): record is RawRecord & { kind: 'local' } =>
              (record as RawRecord | null | undefined)?.kind === 'local')
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
  };
})();
