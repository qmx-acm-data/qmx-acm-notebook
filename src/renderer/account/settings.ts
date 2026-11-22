/** Repository/settings editing and GitHub account device-flow UI. */
import { mountLibrarySyncPanel, resolveLibrarySyncBridge } from './library-sync-panel.js';
import { mountDifficultyBackfillPanel, resolveDifficultyBackfillBridge } from './difficulty-backfill-panel.js';
import { mountClistSharedCachePanel, resolveClistSharedCacheBridge } from './clist-shared-cache-panel.js';
import { mountClistBulkPanel, resolveClistBulkBridge } from './clist-bulk-panel.js';
type Options = import('../../../types/settings-ui').SettingsUIOptions;
type Controller = import('../../../types/settings-ui').SettingsUIController;
type AppSettings = import('../../../types/app').AppSettings;
type AppRepository = import('../../../types/app').AppRepository;
type AppAuthProgress = import('../../../types/app').AppAuthProgress;
type AppControl = import('../../../types/app').AppControl;
type AppQuery = import('../../../types/app').AppQuery;
type AppSelectorMap = import('../../../types/app').AppSelectorMap;
type ThemeMode = import('../../shared/models/settings').ThemeMode;
type Palette = import('../../shared/models/settings').Palette;
type LibrarySyncPanelHandle = import('./library-sync-panel').LibrarySyncPanelHandle;
type DifficultyBackfillPanelHandle = import('./difficulty-backfill-panel').DifficultyBackfillPanelHandle;
type ClistSharedCachePanelHandle = import('./clist-shared-cache-panel').ClistSharedCachePanelHandle;
type ClistBulkPanelHandle = import('./clist-bulk-panel').ClistBulkPanelHandle;

export function createSettings(options: Options): Controller {
  const { demo, bridge, themeStorage, paletteStorage, getBusy, setBusy, getSettings, setSettings, getAccount, getAuthStatus, getPermissions, setPermissionsRepo, getError, setError, getLocal, repo, repoSource, quotaBlocked, reauthNeeded, call, applyPayload, resetRepositoryData, resetSourceView, clearComments, refreshFilters, render, renderUpdate, updateStatus, sync, writeDemo, toast, errorMessage } = options;
  const $: AppQuery = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function append<T extends HTMLElement>(parent: T, ...children: (Node | null | undefined | false)[]): T { children.filter(Boolean).forEach(child => parent.append(child as Node)); return parent; }
  const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  let settingsPreview: AppSettings | null = null;
  let appearanceBeforePreview: { theme: ThemeMode; palette: Palette } | null = null;
  let editingRepos: AppRepository[] = [];
  let editingActiveId = '';
  let authUrl = '';
  type ClistStatus = { configured?: boolean; username?: unknown };
  type ClistApi = { saveClistCredentials(input: { username: string; apiKey: string }): unknown; clearClistCredentials(): unknown; getClistStatus(): unknown };
  function clistApi(): ClistApi | null {
    const candidate = (window.notebook as unknown as Partial<ClistApi> | undefined);
    return candidate && typeof candidate.saveClistCredentials === 'function' && typeof candidate.clearClistCredentials === 'function' && typeof candidate.getClistStatus === 'function' ? candidate as ClistApi : null;
  }
  function clistStatusText(status: unknown): string {
    const value = status && typeof status === 'object' ? status as ClistStatus : {};
    return value.configured === true ? `已配置${typeof value.username === 'string' && value.username.trim() ? ` · ${value.username.trim()}` : ''}` : '未配置';
  }
  async function renderClistStatus() {
    const statusNode = $('#clist-status');
    if (!statusNode) return;
    const api = clistApi();
    if (!api) { statusNode.textContent = '桌面端未接入'; return; }
    try { statusNode.textContent = clistStatusText(await api.getClistStatus()); }
    catch (_) { statusNode.textContent = '状态不可用'; }
  }
  async function saveClistCredentials() {
    const usernameNode = $('#clist-username') as HTMLInputElement | null;
    const apiKeyNode = $('#clist-api-key') as HTMLInputElement | null;
    const errorNode = $('#clist-error');
    if (!usernameNode || !apiKeyNode) return;
    const username = usernameNode.value.trim();
    const apiKey = apiKeyNode.value;
    apiKeyNode.value = '';
    if (!username || !apiKey) { if (errorNode) { errorNode.textContent = '请输入 CLIST 用户名和 API key'; errorNode.hidden = false; } return; }
    const api = clistApi();
    if (!api) { if (errorNode) { errorNode.textContent = '当前桌面端未接入 CLIST 配置接口'; errorNode.hidden = false; } return; }
    if (errorNode) errorNode.hidden = true;
    const saveButton = $('#clist-save-button') as HTMLButtonElement | null;
    if (saveButton) saveButton.disabled = true;
    try {
      await api.saveClistCredentials({ username, apiKey });
      usernameNode.value = username;
      await renderClistStatus();
      toast('CLIST 配置已保存');
    } catch (error) {
      if (errorNode) { errorNode.textContent = errorMessage(error); errorNode.hidden = false; }
    } finally { if (saveButton) saveButton.disabled = false; }
  }
  async function clearClistCredentials() {
    const apiKeyNode = $('#clist-api-key') as HTMLInputElement | null;
    if (apiKeyNode) apiKeyNode.value = '';
    const errorNode = $('#clist-error');
    const api = clistApi();
    if (!api) { if (errorNode) { errorNode.textContent = '当前桌面端未接入 CLIST 配置接口'; errorNode.hidden = false; } return; }
    if (errorNode) errorNode.hidden = true;
    const clearButton = $('#clist-clear-button') as HTMLButtonElement | null;
    if (clearButton) clearButton.disabled = true;
    try { await api.clearClistCredentials(); const usernameNode = $('#clist-username') as HTMLInputElement | null; if (usernameNode) usernameNode.value = ''; await renderClistStatus(); toast('CLIST 配置已删除'); }
    catch (error) { const errorNode = $('#clist-error'); if (errorNode) { errorNode.textContent = errorMessage(error); errorNode.hidden = false; } }
    finally { if (clearButton) clearButton.disabled = false; }
  }
  let librarySyncPanel: LibrarySyncPanelHandle | null = null;
  // Host the panel inside the settings dialog, after the platform bindings.
  function ensureLibrarySyncPanel() {
    const syncBridge = resolveLibrarySyncBridge(bridge) ?? resolveLibrarySyncBridge(window.notebook);
    const existing = document.getElementById('library-sync-panel');
    if (existing) {
      if (!librarySyncPanel) librarySyncPanel = mountLibrarySyncPanel(existing, { bridge: syncBridge, onToast: toast, onError: error => toast(errorMessage(error)) });
      return;
    }
    const dialog = document.getElementById('settings-dialog');
    if (!dialog) return;
    const section = document.createElement('section');
    section.id = 'library-sync-panel';
    section.className = 'library-sync';
    const form = dialog.querySelector('#settings-form');
    const anchor = form && form.parentElement === dialog ? form : null;
    if (anchor) dialog.insertBefore(section, anchor); else dialog.append(section);
    librarySyncPanel = mountLibrarySyncPanel(section, { bridge: syncBridge, onToast: toast, onError: error => toast(errorMessage(error)) });
  }
  let difficultyBackfillPanel: DifficultyBackfillPanelHandle | null = null;
  let clistBulkPanel: ClistBulkPanelHandle | null = null;
  // New desktop bridges use rated pages; older preload fixtures keep per-item backfill.
  function ensureDifficultyBackfillPanel() {
    const bulkBridge = resolveClistBulkBridge(bridge) ?? resolveClistBulkBridge(window.notebook);
    if (bulkBridge) {
      difficultyBackfillPanel?.destroy();
      difficultyBackfillPanel = null;
      document.getElementById('difficulty-backfill-panel')?.remove();
      const existing = document.getElementById('clist-bulk-panel');
      if (existing) {
        if (!clistBulkPanel) clistBulkPanel = mountClistBulkPanel(existing, { bridge: bulkBridge, onToast: toast, onError: error => toast(errorMessage(error)) });
        return;
      }
      const dialog = document.getElementById('settings-dialog');
      if (!dialog) return;
      const section = document.createElement('section');
      section.id = 'clist-bulk-panel';
      section.className = 'clist-bulk';
      const form = dialog.querySelector('#settings-form');
      const previous = document.getElementById('clist-shared-cache-panel') ?? document.getElementById('library-sync-panel');
      if (previous?.parentElement === dialog) previous.after(section);
      else if (form?.parentElement === dialog) dialog.insertBefore(section, form);
      else dialog.append(section);
      clistBulkPanel = mountClistBulkPanel(section, { bridge: bulkBridge, onToast: toast, onError: error => toast(errorMessage(error)) });
      return;
    }
    const backfillBridge = resolveDifficultyBackfillBridge(bridge) ?? resolveDifficultyBackfillBridge(window.notebook);
    const existing = document.getElementById('difficulty-backfill-panel');
    if (existing) {
      if (!difficultyBackfillPanel) difficultyBackfillPanel = mountDifficultyBackfillPanel(existing, { bridge: backfillBridge, onToast: toast, onError: error => toast(errorMessage(error)) });
      return;
    }
    const dialog = document.getElementById('settings-dialog');
    if (!dialog) return;
    const section = document.createElement('section');
    section.id = 'difficulty-backfill-panel';
    section.className = 'difficulty-backfill';
    const form = dialog.querySelector('#settings-form');
    const librarySync = document.getElementById('library-sync-panel');
    if (librarySync && librarySync.parentElement === dialog) librarySync.after(section);
    else if (form && form.parentElement === dialog) dialog.insertBefore(section, form);
    else dialog.append(section);
    difficultyBackfillPanel = mountDifficultyBackfillPanel(section, { bridge: backfillBridge, onToast: toast, onError: error => toast(errorMessage(error)) });
  }

  let clistSharedCachePanel: ClistSharedCachePanelHandle | null = null;
  function ensureClistSharedCachePanel() {
    const sharedBridge = resolveClistSharedCacheBridge(bridge) ?? resolveClistSharedCacheBridge(window.notebook);
    const existing = document.getElementById('clist-shared-cache-panel');
    if (existing) {
      if (!clistSharedCachePanel) clistSharedCachePanel = mountClistSharedCachePanel(existing, { bridge: sharedBridge, onToast: toast, onError: error => toast(errorMessage(error)) });
      return;
    }
    const dialog = document.getElementById('settings-dialog');
    if (!dialog) return;
    const section = document.createElement('section');
    section.id = 'clist-shared-cache-panel';
    section.className = 'clist-shared-cache';
    const librarySync = document.getElementById('library-sync-panel');
    const backfill = document.getElementById('clist-bulk-panel') ?? document.getElementById('difficulty-backfill-panel');
    const form = dialog.querySelector('#settings-form');
    if (librarySync?.parentElement === dialog) librarySync.after(section);
    else if (backfill?.parentElement === dialog) dialog.insertBefore(section, backfill);
    else if (form?.parentElement === dialog) dialog.insertBefore(section, form);
    else dialog.append(section);
    clistSharedCachePanel = mountClistSharedCachePanel(section, { bridge: sharedBridge, onToast: toast, onError: error => toast(errorMessage(error)) });
  }

  function normalizeTheme(theme: unknown): ThemeMode { return theme === 'dark' ? 'dark' : 'light'; }
  function normalizePalette(palette: unknown, fallback: Palette = 'porcelain'): Palette {
    switch (palette) {
      case 'porcelain': case 'blue': case 'violet': case 'rose': case 'amber': case 'teal': return palette;
      default: return fallback;
    }
  }
  function readTheme() { try { return localStorage.getItem(themeStorage) || 'light'; } catch (_) { return 'light'; } }
  function readPalette(): Palette {
    try { const palette = localStorage.getItem(paletteStorage); return normalizePalette(palette, palette === null && readTheme() === 'cards' ? 'amber' : 'porcelain'); }
    catch (_) { return 'porcelain'; }
  }
  function applyTheme(theme: unknown) { const mode = normalizeTheme(theme); document.body.dataset.theme = mode; $('#theme-select')!.value = mode; try { localStorage.setItem(themeStorage, mode); } catch (_) {} }
  function applyPalette(palette: unknown) { const value = normalizePalette(palette); document.body.dataset.palette = value; $('#palette-select')!.value = value; try { localStorage.setItem(paletteStorage, value); } catch (_) {} }
  function applyAppearance(settings: AppSettings) {
    const theme = normalizeTheme(settings.theme);
    const palette = normalizePalette(settings.palette, settings.theme === 'cards' && settings.palette === undefined ? 'amber' : 'porcelain');
    settings.theme = theme; settings.palette = palette;
    applyTheme(theme); applyPalette(palette);
  }
  function applyCodeSettings(settings = settingsPreview || getSettings()) { const size = Math.round(Number(settings.codeFontSize)); document.body.style.setProperty('--code-font-size', (Number.isFinite(size) && size >= 10 && size <= 18 ? size : 11) + 'px'); }

  function renderRepoSelector() {
    const select = $('#repo-select')!;
    if (!select) return;
    const settings = getSettings();
    const repos = Array.isArray(settings?.repositories) && settings.repositories.length ? settings.repositories : [
      { id: 'repo-current', name: '当前题库', repo: settings?.repo || 'qmx-acm-data/2026', serverUrl: settings?.serverUrl || '' }
    ];
    const activeId = settings?.activeRepoId || repos[0].id;
    select.replaceChildren();
    repos.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.name || r.repo} (${r.repo})`;
      if (r.id === activeId) opt.selected = true;
      select.append(opt);
    });
  }

  function renderSettingsRepoList() {
    const container = $('#settings-repo-list')!;
    if (!container) return;
    container.replaceChildren();
    editingRepos.forEach((r, idx) => {
      const item = document.createElement('div');
      item.className = 'repo-card-item' + (r.id === editingActiveId ? ' active' : '');
      item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border:1px solid var(--line);border-radius:6px;margin-bottom:6px;background:var(--surface-soft);font-size:11px;';
      if (r.id === editingActiveId) {
        item.style.borderColor = 'var(--accent)';
        item.style.background = 'var(--accent-soft)';
      }
      const meta = document.createElement('div');
      meta.style.cssText = 'min-width:0;flex:1;';
      meta.innerHTML = `<div><strong>${escapeHtml(r.name || r.repo)}</strong> ${r.id === editingActiveId ? '<span style="color:var(--accent);font-size:10px;font-weight:600;">[当前使用]</span>' : ''}</div><div style="font-size:10px;color:var(--muted);">${escapeHtml(r.serverUrl ? r.serverUrl + ' · ' : 'GitHub · ')}${escapeHtml(r.repo)}</div>`;
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:6px;align-items:center;';
      if (r.id !== editingActiveId) {
        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'button secondary';
        switchBtn.style.padding = '4px 8px';
        switchBtn.style.fontSize = '10px';
        switchBtn.textContent = '设为当前';
        switchBtn.onclick = () => { editingActiveId = r.id; renderSettingsRepoList(); };
        actions.append(switchBtn);
      }
      if (editingRepos.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'icon-button';
        delBtn.style.fontSize = '12px';
        delBtn.title = '删除此仓库';
        delBtn.textContent = '✕';
        delBtn.onclick = () => {
          editingRepos.splice(idx, 1);
          if (editingActiveId === r.id) editingActiveId = editingRepos[0].id;
          renderSettingsRepoList();
        };
        actions.append(delBtn);
      }
      item.append(meta, actions);
      container.append(item);
    });
  }

  async function switchRepository(event: Event) {
    const selectedId = (event.target as AppControl).value;
    if (selectedId === getSettings().activeRepoId) return;
    if (getBusy() || $('#submit-dialog')!.open || document.querySelector('dialog[open]')) { (event.target as AppControl).value = getSettings().activeRepoId!; toast('请先完成当前操作或关闭弹窗'); return; }
    setBusy(true);
    try {
      if (!demo) {
        await call('saveSettings', { activeRepoId: selectedId });
        applyPayload(await call('bootstrap'));
      } else {
        const settings = getSettings();
        settings.activeRepoId = selectedId;
        const target = (settings.repositories || []).find(r => r.id === selectedId);
        if (target) {
          settings.repo = target.repo;
          settings.serverUrl = target.serverUrl;
          setPermissionsRepo(target.repo);
        }
        writeDemo();
        resetRepositoryData();
        renderRepoSelector();
      }
      resetSourceView();
      refreshFilters(); render();
      toast('已切换到仓库：' + (getSettings().repo || ''));
    } catch (err) {
      renderRepoSelector(); toast(errorMessage(err)); return;
    } finally {
      setBusy(false);
    }
    await sync();
  }

  function addRepository() {
    const nameInput = $('#new-repo-name')!, serverInput = $('#new-repo-server')!, pathInput = $('#new-repo-path')!;
    const name = nameInput.value.trim();
    const serverUrl = serverInput.value.trim();
    const repoPath = pathInput.value.trim();
    if (!repoPath || !/^[\w.-]+\/[\w.-]+$/.test(repoPath)) {
      toast('仓库路径格式不正确，应为 owner/repo');
      return;
    }
    if (serverUrl) {
      try { const url = new URL(serverUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || /[\s\\]/.test(serverUrl)) throw new Error(); }
      catch { toast('Git 服务地址须为不含账号密码、查询参数和锚点的 HTTP/HTTPS 地址'); return; }
    }
    const id = 'repo-' + Math.random().toString(36).slice(2, 9);
    editingRepos.push({ id, name: name || repoPath, serverUrl, repo: repoPath });
    nameInput.value = ''; serverInput.value = ''; pathInput.value = '';
    renderSettingsRepoList();
    toast('已添加仓库：' + (name || repoPath));
  }

  async function changeAppearance(field: 'theme' | 'palette', event: Event) {
    if (getBusy()) return;
    const previous = { ...getSettings() };
    const settings = getSettings();
    if (field === 'theme') { settings.theme = normalizeTheme((event.target as AppControl).value); applyTheme(settings.theme); }
    else { settings.palette = normalizePalette((event.target as AppControl).value); applyPalette(settings.palette); }
    setBusy(true);
    try { if (demo) writeDemo(); else await call('saveSettings', { [field]: settings[field] }); }
    catch (error) { setSettings(previous); toast(`当前外观已预览，设置未保存：${errorMessage(error)}`); }
    finally { setBusy(false); }
  }
  function changeTheme(event: Event) { return changeAppearance('theme', event); }
  function changePalette(event: Event) { return changeAppearance('palette', event); }
  function previewAppearance() {
    if (!settingsPreview) return;
    const form = $('#settings-form')!;
    settingsPreview.theme = normalizeTheme(form.elements.theme.value);
    settingsPreview.palette = normalizePalette(form.elements.palette.value);
    applyTheme(settingsPreview.theme); applyPalette(settingsPreview.palette);
  }

  function openSettings() {
    if (getBusy() || $('#submit-dialog')!.open) { toast('请先完成或关闭编辑'); return; }
    try {
      const settings = getSettings();
      appearanceBeforePreview = { theme: normalizeTheme(document.body.dataset.theme), palette: normalizePalette(document.body.dataset.palette) };
      settingsPreview = { ...settings, ...appearanceBeforePreview };
      const form = $('#settings-form')!;
      if (form.elements.theme) form.elements.theme.value = settingsPreview.theme!;
      if (form.elements.palette) form.elements.palette.value = settingsPreview.palette!;
      editingRepos = (Array.isArray(settings.repositories) && settings.repositories.length) ? structuredClone(settings.repositories) : [
        { id: 'repo-current', name: '当前题库', serverUrl: settings.serverUrl || '', repo: settings.repo || 'qmx-acm-data/2026' }
      ];
      editingActiveId = settings.activeRepoId || editingRepos[0]?.id || 'repo-current';
      renderSettingsRepoList();
      if (form.elements.clientId) form.elements.clientId.value = settings.clientId || '';
      if (form.elements.displayName) form.elements.displayName.value = settings.displayName || '';
      if (form.elements.autoSync) form.elements.autoSync.checked = settings.autoSync !== false;
      if (form.elements.codeFontSize) form.elements.codeFontSize.value = String(settings.codeFontSize || 11);
      const fontSizeNode = $('#code-font-size-value')!;
      if (fontSizeNode) fontSizeNode.textContent = (settings.codeFontSize || 11) + 'px';
      if (form.elements.codeLineNumbers) form.elements.codeLineNumbers.checked = settings.codeLineNumbers === true;
    } catch (e) {
      console.error('Settings init error:', e);
    }
    $('#settings-dialog')!.showModal();
    void librarySyncPanel?.refresh();
    void clistSharedCachePanel?.refresh();
    void difficultyBackfillPanel?.refresh();
    void clistBulkPanel?.refresh();
  }

  async function saveSettings(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as AppSelectorMap['#settings-form'];
    const previousSource = repoSource(); let saved = false;
    const activeRepoObj = editingRepos.find(r => r.id === editingActiveId) || editingRepos[0];
    const currentSettings = getSettings();
    const settings = {
      ...currentSettings,
      theme: normalizeTheme(form.elements.theme.value),
      palette: normalizePalette(form.elements.palette.value),
      repositories: editingRepos,
      activeRepoId: editingActiveId,
      serverUrl: activeRepoObj ? activeRepoObj.serverUrl : (currentSettings.serverUrl || ''),
      repo: activeRepoObj ? activeRepoObj.repo : (currentSettings.repo || 'qmx-acm-data/2026'),
      clientId: form.elements.clientId.value.trim(),
      displayName: form.elements.displayName.value.trim(),
      autoSync: form.elements.autoSync.checked,
      codeFontSize: Number(form.elements.codeFontSize.value),
      codeLineNumbers: form.elements.codeLineNumbers.checked
    };
    if (getBusy()) return;
    setBusy(true);
    try {
      if (!demo) {
        await call('saveSettings', settings);
        applyPayload(await call('bootstrap'));
      } else {
        setSettings(settings); setPermissionsRepo(settings.repo);
        if (previousSource !== repoSource()) resetRepositoryData();
      }
      if (previousSource !== repoSource()) resetSourceView();
      saved = true;
      settingsPreview = null;
      appearanceBeforePreview = null;
      applyCodeSettings();
      applyAppearance(getSettings());
      renderRepoSelector();
      writeDemo();
      $('#settings-dialog')!.close();
      refreshFilters();
      render();
      toast('设置已保存');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
    if (saved && previousSource !== repoSource()) await sync();
  }
  function previewCodeFontSize() { if (!settingsPreview) return; const size = Number($('#settings-form')!.elements.codeFontSize.value); settingsPreview.codeFontSize = size; applyCodeSettings(); $('#code-font-size-value')!.textContent = size + 'px'; }
  function previewCodeLineNumbers() { if (!settingsPreview) return; settingsPreview.codeLineNumbers = $('#settings-form')!.elements.codeLineNumbers.checked; render(); }
  function closeSettings() {
    if (!settingsPreview) return;
    settingsPreview = null;
    if (appearanceBeforePreview) { applyTheme(appearanceBeforePreview.theme); applyPalette(appearanceBeforePreview.palette); }
    appearanceBeforePreview = null;
    applyCodeSettings(); render();
  }

  function renderAccount() {
    renderUpdate();
    const account = getAccount(), permissions = getPermissions(), authStatus = getAuthStatus();
    const box = $('#account-details')!; box.replaceChildren();
    for (const [label, value] of [['姓名', account?.name || '未设置'], ['GitHub 登录名', account?.login || '未登录'], ['GitHub ID', account?.id ?? '未登录'], ['当前仓库', repo() || '未配置'], ['权限', account ? permissions.admin ? '管理员 · 可直接维护自己的题解' : permissions.push ? '可推送 · 可直接维护自己的题解' : '只读 · 可使用本地记录' : '未登录 · 仅本地编辑']]) append(box, element('dt', '', label), element('dd', '', value));
    const clistUsername = $('#clist-username') as HTMLInputElement | null;
    if (clistUsername) clistUsername.value = '';
    void renderClistStatus();
    const authLabel: Record<string, string> = { anonymous: '未登录', restored: '已恢复，等待验证', verified: '已验证', expired: '授权已过期，请重新登录', unverified: '尚未验证，请联网刷新', 'recovery-required': '凭证恢复失败，请重新授权' };
    if (authLabel[authStatus?.status]) append(box, element('dt', '', '认证状态'), element('dd', '', authLabel[authStatus.status]));
    $('#account-login')!.textContent = ['expired','recovery-required'].includes(authStatus?.status) ? '重新授权 GitHub' : '登录 GitHub';
    $('#account-login')!.hidden = !!account && !['expired','recovery-required'].includes(authStatus?.status); ['account-switch', 'account-logout', 'account-refresh'].forEach(id => { document.getElementById(id)!.hidden = !account; });
  }
  function openAccount() { if (getBusy()) return; if ($('#submit-dialog')!.open) { toast('请先完成或关闭编辑，草稿不会跨账户恢复'); return; } renderAccount(); $('#account-error')!.hidden = true; $('#account-dialog')!.showModal(); }
  async function startLoginFromBanner() {
    if (getBusy() || demo) return;
    renderAccount();
    $('#account-error')!.hidden = true;
    $('#account-dialog')!.showModal();
    const ok = await accountAction('login');
    if (ok) $('#account-dialog')!.close();
  }
  async function accountAction(action: string) {
    if (getBusy()) return false;
    if (demo) { $('#account-error')!.hidden = false; $('#account-error')!.textContent = '浏览器演示不连接 GitHub，账户功能请在桌面客户端使用'; return false; }
    setBusy(true); $('#account-error')!.hidden = true;
    // Both account entry points retry a pull blocked by quota or expired authorization.
    const resumeSync = action === 'login' || action === 'switch' ? reauthNeeded() || quotaBlocked() : false;
    const previousError = getError();
    let loggedIn = false;
    try {
      if (action === 'refresh') applyPayload(await call('refreshAccount'));
      else {
        if (action === 'logout' || action === 'switch') await call('logout');
        if (action === 'login' || action === 'switch') { $('#auth-message')!.textContent = '正在请求设备授权…'; $('#auth-code')!.textContent = ''; $('#auth-open-button')!.hidden = true; $('#auth-copy-button')!.hidden = true; $('#auth-dialog')!.showModal(); await call('login'); loggedIn = true; }
        applyPayload(await call('bootstrap'));
      }
      clearComments(); refreshFilters(); render(); renderAccount(); toast('账户与仓库权限已更新');
      return true;
    } catch (error) {
      $('#account-error')!.hidden = false; $('#account-error')!.textContent = errorMessage(error);
      try { applyPayload(await call('bootstrap')); refreshFilters(); render(); renderAccount(); } catch (_) {}
      // A cancelled or failed device flow must preserve the banner that offered login.
      if (!loggedIn && previousError && (action === 'login' || action === 'switch')) { setError(previousError); updateStatus(); }
      return false;
    } finally {
      $('#auth-dialog')!.close(); setBusy(false);
      if (loggedIn && resumeSync) void sync();
    }
  }
  function receiveAuthProgress(progress: unknown) {
    $('#auth-message')!.textContent = (progress as AppAuthProgress)?.message || '请在 GitHub 页面完成授权，当前窗口会自动更新。';
    $('#auth-code')!.textContent = (progress as AppAuthProgress)?.userCode || (progress as AppAuthProgress)?.user_code || '';
    authUrl = (progress as AppAuthProgress)?.verificationUri || (progress as AppAuthProgress)?.verification_uri || (progress as AppAuthProgress)?.verificationUrl || (progress as AppAuthProgress)?.url || '';
    $('#auth-open-button')!.hidden = !authUrl;
    $('#auth-copy-button')!.hidden = !authUrl;
    $('#auth-url')!.textContent = authUrl;
    $('#auth-url')!.hidden = !authUrl;
    if (!$('#auth-dialog')!.open) $('#auth-dialog')!.showModal();
  }
  async function openAuthUrl() { if (!authUrl) return; try { await call('openAuthUrl', authUrl); } catch (error) { toast(`无法打开浏览器：${errorMessage(error)}。可复制下方链接手动授权`); } }
  async function copyAuthUrl() {
    if (!authUrl) return;
    try { await navigator.clipboard.writeText(authUrl); toast('授权链接已复制，可粘贴到浏览器打开'); }
    catch (_) { toast('复制失败，请手动复制链接'); }
  }
  async function cancelLogin() { try { if (!demo) await call('cancelLogin'); } catch (error) { toast(errorMessage(error)); } $('#auth-dialog')!.close(); }
  async function loginFromSettings() {
    if (getBusy()) return;
    if (demo) { toast('浏览器演示不连接 GitHub，账户功能请在桌面客户端使用'); return; }
    $('#settings-dialog')!.close();
    await startLoginFromBanner();
  }
  async function exportLocal() {
    try {
      if (demo) {
        const blob = new Blob([JSON.stringify(getLocal(), null, 2)], { type: 'application/json' }); const href = URL.createObjectURL(blob); const link = element('a'); link.href = href; link.download = 'acm-notebook-demo-local.json'; link.click(); setTimeout(() => URL.revokeObjectURL(href), 1000); toast('演示本地数据已导出');
      } else { const result = await call('exportLocal'); if (result !== false && !result?.canceled) toast('本地数据已导出'); }
    } catch (error) { toast(errorMessage(error)); }
  }

  $('#repo-select')?.addEventListener('change', switchRepository);
  $('#new-repo-add-btn')?.addEventListener('click', addRepository);
  $('#theme-select')!.addEventListener('change', changeTheme);
  $('#palette-select')!.addEventListener('change', changePalette);
  $('#settings-form')!.elements.theme.addEventListener('change', previewAppearance);
  $('#settings-form')!.elements.palette.addEventListener('change', previewAppearance);
  $('#settings-button')!.addEventListener('click', openSettings);
  $('#open-clist-config')?.addEventListener('click', () => {
    $('#settings-dialog')!.close();
    openAccount();
    window.requestAnimationFrame(() => {
      document.querySelector('.clist-credentials')?.scrollIntoView({ block: 'center' });
      const username = document.querySelector('#clist-username') as HTMLInputElement | null;
      if (username) username.focus({ preventScroll: true });
    });
  });
  $('#settings-form')!.addEventListener('submit', saveSettings);
  $('#settings-form')!.elements.codeFontSize.addEventListener('input', previewCodeFontSize);
  $('#settings-form')!.elements.codeLineNumbers.addEventListener('change', previewCodeLineNumbers);
  $('#settings-dialog')!.addEventListener('close', closeSettings);
  $('#settings-login-button')!.addEventListener('click', loginFromSettings);
  $('#account-button')!.addEventListener('click', openAccount);
  $('#account-dialog')!.addEventListener('close', () => {
    const apiKeyNode = $('#clist-api-key') as HTMLInputElement | null;
    if (apiKeyNode) apiKeyNode.value = '';
  });
  $('#clist-save-button')?.addEventListener('click', () => void saveClistCredentials());
  $('#clist-clear-button')?.addEventListener('click', () => void clearClistCredentials());
  ['login', 'logout', 'switch', 'refresh'].forEach(action => { document.getElementById(`account-${action}`)!.addEventListener('click', () => accountAction(action)); });
  if (typeof bridge?.onAuthProgress === 'function') bridge.onAuthProgress(receiveAuthProgress);
  $('#auth-open-button')!.addEventListener('click', openAuthUrl);
  $('#auth-copy-button')!.addEventListener('click', copyAuthUrl);
  $('#cancel-login-button')!.addEventListener('click', cancelLogin);
  $('#auth-dialog')!.addEventListener('cancel', event => { event.preventDefault(); void cancelLogin(); });
  $('#export-local-button')!.addEventListener('click', exportLocal);
  ensureLibrarySyncPanel();
  ensureDifficultyBackfillPanel();
  ensureClistSharedCachePanel();

  return { readTheme, readPalette, applyTheme, applyPalette, applyAppearance, applyCodeSettings, renderRepoSelector, renderSettingsRepoList, switchRepository, addRepository, changeTheme, changePalette, previewAppearance, openSettings, saveSettings, previewCodeFontSize, previewCodeLineNumbers, closeSettings, renderAccount, openAccount, startLoginFromBanner, accountAction, receiveAuthProgress, openAuthUrl, copyAuthUrl, cancelLogin, loginFromSettings, exportLocal,
    get settingsPreview() { return settingsPreview; }, get editingRepos() { return editingRepos; }, get editingActiveId() { return editingActiveId; }, get authUrl() { return authUrl; } };
}
