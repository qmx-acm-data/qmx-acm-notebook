// Generated from src/main/storage/settings.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEAM_CLIENT_ID = void 0;
exports.createSettingsStore = createSettingsStore;
// Public OAuth application identifier; never embed a client secret or user token.
exports.TEAM_CLIENT_ID = 'Ov23likjqSdpkS6MYGzJ';
/** The parent supplies its existing JSON reader, including its filesystem mocks. */
function createSettingsStore({ read, repoParts, normalizeServerUrl, repositoryKey }) {
    const defaults = {
        serverUrl: '',
        repo: 'qmx-acm-data/2026',
        repositories: [
            { id: 'ctgu-2026', name: '三峡大学 2026 题解库 (校内)', serverUrl: 'http://172.25.5.128:3000', repo: 'ctguacm/2026' },
            { id: 'qmx-official', name: '官方公共题库 (GitHub)', serverUrl: '', repo: 'qmx-acm-data/2026' }
        ],
        activeRepoId: 'qmx-official',
        clientId: exports.TEAM_CLIENT_ID,
        theme: 'light'
    };
    function normalizeRepositories(input, fallbackRepo = defaults.repo, fallbackServerUrl = defaults.serverUrl) {
        // Assertions preserve primitive property reads and the original failure paths.
        const data = input;
        let repos = Array.isArray(data?.repositories) ? [...data.repositories] : [];
        if (repos.length === 0) {
            repos = [
                { id: 'ctgu-2026', name: '三峡大学 2026 题解库 (校内)', serverUrl: 'http://172.25.5.128:3000', repo: 'ctguacm/2026' },
                { id: 'qmx-official', name: '官方公共题库 (GitHub)', serverUrl: '', repo: 'qmx-acm-data/2026' }
            ];
        }
        if (data?.repo && !repos.some(candidate => {
            const r = candidate;
            try {
                return r && repositoryKey(r.repo, r.serverUrl || '') === repositoryKey(data.repo, data.serverUrl || '');
            }
            catch {
                return false;
            }
        })) {
            repos.unshift({ id: 'repo-current', name: '当前题库', serverUrl: data.serverUrl !== undefined ? data.serverUrl : fallbackServerUrl, repo: data.repo });
        }
        const validRepos = [];
        const seenIds = new Set();
        for (const item of repos) {
            if (!item || typeof item !== 'object')
                continue;
            const fields = item;
            let repoPath = String(fields.repo || '').trim();
            try {
                repoParts(repoPath);
            }
            catch {
                continue;
            }
            let id = String(fields.id || '').trim();
            if (!id || seenIds.has(id))
                id = 'repo-' + Math.random().toString(36).slice(2, 9);
            seenIds.add(id);
            let serverUrl;
            try {
                serverUrl = normalizeServerUrl(fields.serverUrl || '');
            }
            catch {
                continue;
            }
            const name = String(fields.name || '').trim().slice(0, 50) || repoPath;
            validRepos.push({ id, name, serverUrl, repo: repoPath });
        }
        if (validRepos.length === 0) {
            validRepos.push({ id: 'repo-current', name: '当前题库', serverUrl: fallbackServerUrl, repo: fallbackRepo });
        }
        let active = null;
        if (data?.activeRepoId) {
            active = validRepos.find(r => r.id === data.activeRepoId);
        }
        if (!active && data?.repo) {
            active = validRepos.find(r => repositoryKey(r.repo, r.serverUrl) === repositoryKey(data.repo, data.serverUrl || ''));
        }
        if (!active) {
            active = validRepos.find(r => r.id === data?.activeRepoId) || validRepos[0];
        }
        return { repositories: validRepos, activeRepoId: active.id, repo: active.repo, serverUrl: active.serverUrl };
    }
    function settings() {
        // Do not guard null: the legacy reader throws on stored.repo after spreading it.
        const stored = read('settings.json', {});
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
        value.clientId = typeof value.clientId === 'string' && value.clientId.trim() ? value.clientId.trim() : exports.TEAM_CLIENT_ID;
        return value;
    }
    function local() { return { records: [], favorites: [], mastery: {}, draft: {}, ...read('local.json', {}) }; }
    return { settings, local, normalizeRepositories, defaults, TEAM_CLIENT_ID: exports.TEAM_CLIENT_ID };
}
