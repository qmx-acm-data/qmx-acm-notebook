import type { LocalDataSnapshot } from '../../shared/models/records.js';
import type { NormalizedRepositories, RawSettings, RepositorySettings, Settings, SettingsDefaults } from '../../shared/models/settings.js';

export interface SettingsDependencies {
  read(name: string, fallback: unknown): unknown;
  repoParts: typeof import('../github/client.cjs').repoParts;
  normalizeServerUrl: typeof import('../github/client.cjs').normalizeServerUrl;
  repositoryKey: typeof import('../github/client.cjs').repositoryKey;
}

export interface SettingsStore {
  settings(): Settings;
  local(): LocalDataSnapshot;
  normalizeRepositories(data: unknown, fallbackRepo?: string, fallbackServerUrl?: string): NormalizedRepositories;
  defaults: SettingsDefaults;
  TEAM_CLIENT_ID: string;
}

// Public OAuth application identifier; never embed a client secret or user token.
export const TEAM_CLIENT_ID = 'Ov23likjqSdpkS6MYGzJ';

/** The parent supplies its existing JSON reader, including its filesystem mocks. */
export function createSettingsStore({ read, repoParts, normalizeServerUrl, repositoryKey }: SettingsDependencies): SettingsStore {
  const defaults: SettingsDefaults = {
    serverUrl: '',
    repo: 'qmx-acm-data/2026',
    repositories: [
      { id: 'ctgu-2026', name: '三峡大学 2026 题解库 (校内)', serverUrl: 'http://172.25.5.128:3000', repo: 'ctguacm/2026' },
      { id: 'qmx-official', name: '官方公共题库 (GitHub)', serverUrl: '', repo: 'qmx-acm-data/2026' }
    ],
    activeRepoId: 'qmx-official',
    clientId: TEAM_CLIENT_ID,
    theme: 'light'
  };

  function normalizeRepositories(input: unknown, fallbackRepo = defaults.repo, fallbackServerUrl = defaults.serverUrl): NormalizedRepositories {
    // Assertions preserve primitive property reads and the original failure paths.
    const data = input as RawSettings | null | undefined;
    let repos: unknown[] = Array.isArray(data?.repositories) ? [...data.repositories] : [];
    if (repos.length === 0) {
      repos = [
        { id: 'ctgu-2026', name: '三峡大学 2026 题解库 (校内)', serverUrl: 'http://172.25.5.128:3000', repo: 'ctguacm/2026' },
        { id: 'qmx-official', name: '官方公共题库 (GitHub)', serverUrl: '', repo: 'qmx-acm-data/2026' }
      ];
    }
    if (data?.repo && !repos.some(candidate => {
      const r = candidate as { repo: string; serverUrl: unknown } | null | undefined;
      try { return r && repositoryKey(r.repo, r.serverUrl || '') === repositoryKey(data.repo as string, data.serverUrl || ''); } catch { return false; }
    })) {
      repos.unshift({ id: 'repo-current', name: '当前题库', serverUrl: data.serverUrl !== undefined ? data.serverUrl : fallbackServerUrl, repo: data.repo });
    }
    const validRepos: RepositorySettings[] = [];
    const seenIds = new Set<string>();
    for (const item of repos) {
      if (!item || typeof item !== 'object') continue;
      const fields = item as Record<string, unknown>;
      let repoPath = String(fields.repo || '').trim();
      try { repoParts(repoPath); } catch { continue; }
      let id = String(fields.id || '').trim();
      if (!id || seenIds.has(id)) id = 'repo-' + Math.random().toString(36).slice(2, 9);
      seenIds.add(id);
      let serverUrl;
      try { serverUrl = normalizeServerUrl(fields.serverUrl || ''); } catch { continue; }
      const name = String(fields.name || '').trim().slice(0, 50) || repoPath;
      validRepos.push({ id, name, serverUrl, repo: repoPath });
    }
    if (validRepos.length === 0) {
      validRepos.push({ id: 'repo-current', name: '当前题库', serverUrl: fallbackServerUrl, repo: fallbackRepo });
    }
    let active: RepositorySettings | null | undefined = null;
    if (data?.activeRepoId) {
      active = validRepos.find(r => r.id === data.activeRepoId);
    }
    if (!active && data?.repo) {
      active = validRepos.find(r => repositoryKey(r.repo, r.serverUrl) === repositoryKey(data.repo as string, data.serverUrl || ''));
    }
    if (!active) {
      active = validRepos.find(r => r.id === data?.activeRepoId) || validRepos[0];
    }
    return { repositories: validRepos, activeRepoId: active.id, repo: active.repo, serverUrl: active.serverUrl };
  }

  function settings(): Settings {
    // Do not guard null: the legacy reader throws on stored.repo after spreading it.
    const stored = read('settings.json', {}) as RawSettings;
    const raw = { ...defaults, ...stored };
    const requestedRepo = stored.repo !== undefined ? stored.repo : raw.repo;
    const requestedActiveId = stored.activeRepoId !== undefined ? stored.activeRepoId : (stored.repo !== undefined || stored.serverUrl !== undefined ? null : raw.activeRepoId);
    const normalized = normalizeRepositories({ ...raw, repo: requestedRepo, activeRepoId: requestedActiveId }, defaults.repo, defaults.serverUrl);
    const value = {
      ...raw,
      repositories: normalized.repositories,
      activeRepoId: normalized.activeRepoId,
      repo: normalized.repo,
      serverUrl: normalized.serverUrl
    };
    value.clientId = typeof value.clientId === 'string' && value.clientId.trim() ? value.clientId.trim() : TEAM_CLIENT_ID;
    return value as Settings;
  }

  function local(): LocalDataSnapshot { return { records: [], favorites: [], mastery: {}, draft: {}, ...read('local.json', {}) as Record<string, unknown> }; }

  return { settings, local, normalizeRepositories, defaults, TEAM_CLIENT_ID };
}
