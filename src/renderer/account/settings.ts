/** Repository/settings editing and GitHub account device-flow UI. */
type Options = import('../../../types/settings-ui').SettingsUIOptions;
type Controller = import('../../../types/settings-ui').SettingsUIController;
type AppSettings = import('../../../types/app').AppSettings;
type AppRepository = import('../../../types/app').AppRepository;
type AppAuthProgress = import('../../../types/app').AppAuthProgress;
type AppControl = import('../../../types/app').AppControl;
type AppQuery = import('../../../types/app').AppQuery;
type AppSelectorMap = import('../../../types/app').AppSelectorMap;

export function createSettings(options: Options): Controller {
  const { demo, bridge, themeStorage, getBusy, setBusy, getSettings, setSettings, getAccount, getAuthStatus, getPermissions, setPermissionsRepo, getError, setError, getLocal, repo, repoSource, quotaBlocked, reauthNeeded, call, applyPayload, resetRepositoryData, resetSourceView, clearComments, refreshFilters, render, renderUpdate, updateStatus, sync, writeDemo, toast, errorMessage } = options;
  const $: AppQuery = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function append<T extends HTMLElement>(parent: T, ...children: (Node | null | undefined | false)[]): T { children.filter(Boolean).forEach(child => parent.append(child as Node)); return parent; }
  const escapeHtml = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  let settingsPreview: AppSettings | null = null;
  let editingRepos: AppRepository[] = [];
  let editingActiveId = '';
  let authUrl = '';

  function readTheme() { try { return localStorage.getItem(themeStorage) || 'light'; } catch (_) { return 'light'; } }
  function applyTheme(theme: string) { theme = ['light', 'dark', 'cards'].includes(theme) ? theme : 'light'; document.body.dataset.theme = theme; $('#theme-select')!.value = theme; try { localStorage.setItem(themeStorage, theme); } catch (_) {} }
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

  async function changeTheme(event: Event) {
    const previous = { ...getSettings() };
    const settings = getSettings();
    settings.theme = (event.target as AppControl).value;
    applyTheme(settings.theme);
    try { if (demo) writeDemo(); else await call('saveSettings', { ...getSettings() }); }
    catch (error) { setSettings(previous); toast(`当前风格已预览，设置未保存：${errorMessage(error)}`); }
  }

  function openSettings() {
    if (getBusy() || $('#submit-dialog')!.open) { toast('请先完成或关闭编辑'); return; }
    try {
      const settings = getSettings();
      settingsPreview = { ...settings, theme: document.body.dataset.theme };
      const form = $('#settings-form')!;
      if (form.elements.theme) form.elements.theme.value = settingsPreview.theme!;
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
  }

  async function saveSettings(event: Event) {
    event.preventDefault();
    const form = event.currentTarget as AppSelectorMap['#settings-form'];
    const previousSource = repoSource(); let saved = false;
    const activeRepoObj = editingRepos.find(r => r.id === editingActiveId) || editingRepos[0];
    const currentSettings = getSettings();
    const settings = {
      ...currentSettings,
      theme: form.elements.theme.value,
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
      applyCodeSettings();
      applyTheme(settings.theme);
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
  function closeSettings() { if (!settingsPreview) return; settingsPreview = null; applyCodeSettings(); render(); }

  function renderAccount() {
    renderUpdate();
    const account = getAccount(), permissions = getPermissions(), authStatus = getAuthStatus();
    const box = $('#account-details')!; box.replaceChildren();
    for (const [label, value] of [['姓名', account?.name || '未设置'], ['GitHub 登录名', account?.login || '未登录'], ['GitHub ID', account?.id ?? '未登录'], ['当前仓库', repo() || '未配置'], ['权限', account ? permissions.admin ? '管理员 · 可直接维护自己的题解' : permissions.push ? '可推送 · 可直接维护自己的题解' : '只读 · 可使用本地记录' : '未登录 · 仅本地编辑']]) append(box, element('dt', '', label), element('dd', '', value));
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
  $('#settings-button')!.addEventListener('click', openSettings);
  $('#settings-form')!.addEventListener('submit', saveSettings);
  $('#settings-form')!.elements.codeFontSize.addEventListener('input', previewCodeFontSize);
  $('#settings-form')!.elements.codeLineNumbers.addEventListener('change', previewCodeLineNumbers);
  $('#settings-dialog')!.addEventListener('close', closeSettings);
  $('#settings-login-button')!.addEventListener('click', loginFromSettings);
  $('#account-button')!.addEventListener('click', openAccount);
  ['login', 'logout', 'switch', 'refresh'].forEach(action => { document.getElementById(`account-${action}`)!.addEventListener('click', () => accountAction(action)); });
  if (typeof bridge?.onAuthProgress === 'function') bridge.onAuthProgress(receiveAuthProgress);
  $('#auth-open-button')!.addEventListener('click', openAuthUrl);
  $('#auth-copy-button')!.addEventListener('click', copyAuthUrl);
  $('#cancel-login-button')!.addEventListener('click', cancelLogin);
  $('#auth-dialog')!.addEventListener('cancel', event => { event.preventDefault(); void cancelLogin(); });
  $('#export-local-button')!.addEventListener('click', exportLocal);

  return { readTheme, applyTheme, applyCodeSettings, renderRepoSelector, renderSettingsRepoList, switchRepository, addRepository, changeTheme, openSettings, saveSettings, previewCodeFontSize, previewCodeLineNumbers, closeSettings, renderAccount, openAccount, startLoginFromBanner, accountAction, receiveAuthProgress, openAuthUrl, copyAuthUrl, cancelLogin, loginFromSettings, exportLocal,
    get settingsPreview() { return settingsPreview; }, get editingRepos() { return editingRepos; }, get editingActiveId() { return editingActiveId; }, get authUrl() { return authUrl; } };
}
