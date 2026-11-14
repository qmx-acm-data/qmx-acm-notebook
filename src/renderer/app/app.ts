import { Search } from '../lib/search.js';
import { AlgorithmDirectory } from '../algorithms/directory.js';
import { Platforms } from '../platforms/dashboard.js';
import { Planner } from '../planner/planner.js';
import { HomeContests } from '../home/contests.js';
import { Updates } from '../account/updates.js';
import { CodeBlocks } from '../reading/code-blocks.js';
import { MarkdownMath } from '../reading/markdown-math.js';
import { MarkdownColor } from '../reading/markdown-color.js';
import { ReadingDetail } from '../reading/reading-detail.js';
import { createNotebookIPC } from '../ipc/boundary.js';
import { createNormalizer } from '../records/local.js';
'use strict';
import { createFilters } from '../library/filters.js';
import { createEditor } from '../library/editor.js';
import { createLibraryReader } from '../library/reader.js';
import { createSettings } from '../account/settings.js';
import { createAlgorithmWorkspace } from '../algorithms/workspace.js';
(() => {
  type AppError = import('../../../types/app').AppError;
  type AppAuthor = import('../../../types/app').AppAuthor;
  type AppComment = import('../../../types/app').AppComment;
  type AppTagGroup = import('../../../types/app').AppTagGroup;
  type AppTagCatalog = import('../../../types/app').AppTagCatalog;
  type AlgorithmDirectoryNode = import('../../../src/shared/models/algorithm-directory').AlgorithmDirectoryNode;
  type AppFlatNode = import('../../../types/app').AppFlatNode;
  type LearningPathController = import('../../../types/learning-path').LearningPathController;
  type LearningPathSavedProgress = import('../../../types/learning-path').LearningPathSavedProgress;
  type LearningPathNote = import('../../../types/learning-path').LearningPathNote;
  type AppWindowAccess = import('../../../types/app').AppWindowAccess;
  type AppFormDraft = import('../../../types/app').AppFormDraft;
  type AppSeed = import('../../../types/app').AppSeed;
  type AppRepository = import('../../../types/app').AppRepository;
  type AppAuthProgress = import('../../../types/app').AppAuthProgress;
  type AppRecord = import('../../../types/app').AppRecord;
  type AppState = import('../../../types/app').AppState;
  type AppSettings = import('../../../types/app').AppSettings;
  type AppLocal = import('../../../types/app').AppLocal;
  type AppPayload = import('../../../types/app').AppPayload;
  type AppResponse = import('../../../types/app').AppResponse;
  type AppCallName = import('../../../types/app').AppCallName;
  type AppCall = import('../../../types/app').AppCall;
  type AppFacet = import('../../../types/app').AppFacet;
  type AppControl = import('../../../types/app').AppControl;
  type AppDisabledControl = import('../../../types/app').AppDisabledControl;
  type AppQuery = import('../../../types/app').AppQuery;
  type AppQueryAll = import('../../../types/app').AppQueryAll;
  type AppSelectorMap = import('../../../types/app').AppSelectorMap;

  const $: AppQuery = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
  const $$: AppQueryAll = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(selector));
  const bridge = window.notebook;
  const demo = !bridge;
  const webPreview = demo && ['http:', 'https:'].includes(location.protocol);
  const STORAGE = 'acm-notebook.demo.v1';
  const THEME_STORAGE = 'acm-notebook.theme';
  const SIDEBAR_STORAGE = 'acm-notebook.sidebar';
  const stateLabels: Record<string, string> = { unreviewed: '待复习', reviewing: '复习中', mastered: '已掌握' };
  const views: Record<string, [string, string, string]> = {
    home: ['主页', '从这里开始，继续积累今天的理解。', 'WELCOME TO YOUR LEARNING SPACE'],
    tricks: ['tricks', '把灵光一现，留给下一次解题。', 'SMALL IDEAS, NEW POSSIBILITIES'],
    algorithms: ['算法笔记', '整理知识，连接思路。', 'BUILD YOUR KNOWLEDGE'],
    public: ['公共题库', '在他人的思路里，找到自己的突破口。', 'A LITTLE BETTER, EVERY DAY'],
    favorites: ['个人收藏', '再想一遍，让解题思路真正成为自己的。', 'REVISIT. UNDERSTAND. REMEMBER.']
  };
  const examples: AppRecord[] = [
    { id: 'demo-issue-1', number: 101, kind: 'issue', title: 'D. 数对计数：从枚举到贡献法', pid: 'CF1900D', platform: 'Codeforces', rating: 1900, tags: ['数论', '贡献法', '枚举优化'], author: '林间的二分树', body: '## 错因分析\n直接枚举三个位置会退化到 O(n³)。我一直试图优化判断过程，却没有先调整统计的顺序。\n\n## 关键观察\n排序后，固定中间位置，把左侧数字按因子归类。统计一个数对的贡献，比逐个寻找合法三元组更容易。\n\n> 先问「谁在产生贡献」，再问「如何更快地枚举」。\n\n## 复盘笔记\n1. 先用小数据写暴力，确认统计对象。\n2. 把 gcd 条件拆解为因子计数。\n3. 注意重复元素与 64 位整数溢出。\n\n```cpp\nlong long answer = 0;\n// 先计算贡献，再更新计数，避免重复统计。\n```\n\n*此内容为界面演示示例，并非该题的正式题解。*', url: 'https://codeforces.com/problemset/problem/1900/D', updatedAt: '2026-10-29T10:20:00Z', comments: 0, state: 'open' },
    { id: 'demo-document-2', number: 102, kind: 'document', title: '二分答案里的「最后一个正确」', pid: 'P1873', platform: '洛谷', difficulty: '普及−', tags: ['二分', '边界处理'], author: '不再 RE', body: '## 错因分析\n循环可以结束，不代表返回的位置正确。左闭右闭和左闭右开混用，让答案偏移了一个位置。\n\n## 解题 Trick\n先画出可行性序列：真、真、真、假、假。题目要找的是最后一个真。\n\n每次更新前，确认不变量仍然成立；最后用只有一个元素、全部可行和全部不可行三个边界检查。\n\n*此内容为演示正式题解样式，非真实题解。*', url: 'https://www.luogu.com.cn/problem/P1873', updatedAt: '2026-10-27T08:00:00Z', comments: 0, state: 'open' },
    { id: 'demo-local-3', kind: 'local', title: 'B. 边界条件：贪心之前先看约束', pid: 'CF1791B', platform: 'Codeforces', rating: 800, tags: ['贪心', '边界处理'], author: '我', body: '## 错因分析\n忽略了起点和终点之间的边界条件，在动手写贪心前没有先用最小规模数据模拟。\n\n## 下一次要记住\n先确认约束，再检查每一步是否保持可行。空路径、单步路径和提前到达终点都值得单独测试。\n\n这是只存在当前设备的演示错题。Rating 仅为展示数据，并非平台核验结果。收藏和复习状态都可以试着调整。', url: 'https://codeforces.com/problemset/problem/1791/B', updatedAt: '2026-10-25T09:00:00Z', comments: 0, state: 'open' }
  ];
  let cached: { settings?: AppSettings; local?: unknown } | null = null;
  try { cached = JSON.parse(localStorage.getItem(STORAGE) || 'null'); } catch (_) { /* Storage may be disabled. */ }
  const s: AppState = { view: 'home', libraryScope: 'public', records: [], algorithmNotes: [], algorithmTree: window.QMX_ALGORITHM_TREE || { id: 'root', label: 'XCPC算法', children: [] }, local: { records: [], favorites: [], mastery: {}, draft: {} }, settings: {}, account: null, authStatus: { status: 'anonymous' }, permissions: {}, issues: [], editor: null, lastSync: null, error: '', selected: null, comments: new Map(), loading: true, busy: false, tagCatalog: window.QMX_TAG_PRESETS || { version: 'local', source: 'local', categories: [] }, tagReview: null };
  s.appVersion = ''; s.update = null;
  Platforms?.init({ bridge, onSettings: () => $('#settings-button')!.click() });
  s.planner = { problems: [], tasks: [], layout: 'balanced' };
  Planner?.init({ bridge: bridge ? createNotebookIPC(bridge) : bridge, onChange: value => { s.planner = value; } });
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let draftTimer: ReturnType<typeof setTimeout> | undefined;
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function append<T extends HTMLElement>(parent: T, ...children: (Node | null | undefined | false)[]): T { children.filter(Boolean).forEach(child => parent.append(child as Node)); return parent; }
  function button(label: string, className: string, action: (event: MouseEvent) => unknown) { const node = element('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
  function toast(message: string | undefined) { $('#toast')!.textContent = message as string; $('#toast')!.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast')!.hidden = true; }, 3400); }
  function errorMessage(error: unknown) { const message = typeof error === 'string' ? error : (error as AppError | null | undefined)?.message || '操作未完成，请稍后重试'; return message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, ''); }
  function key(record: AppRecord) { const id = String(record.id ?? record.number ?? `${record.platform}:${record.pid}:${record.url}`); return record.kind !== 'local' && record.sourceKey && record.sourceKey !== 'https://api.github.com|qmx-acm-data/2026' ? `${record.sourceKey}:${id}` : id; }
  function uuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  function accountId() { return s.account?.id == null ? null : String(s.account.id); }
  function repo() { return s.permissions.repo || s.settings.repo || ''; }
  function repoSource(repoPath = repo(), serverUrl = s.settings.serverUrl) { let server = String(serverUrl || '').replace(/\/+$/, '').replace(/\/api\/v1$/, ''); if (!server || ['https://github.com', 'https://api.github.com'].includes(server)) server = 'https://api.github.com'; return `${server}|${String(repoPath).toLowerCase()}`; }
  function sameRepo(record: AppRecord) { return !!record.repo && String(record.repo).toLowerCase() === String(repo()).toLowerCase() && (record.sourceKey ? record.sourceKey === repoSource() : repoSource(record.repo, record.serverUrl) === repoSource()); }
  const normalizeLocal = createNormalizer(uuid) as (local: unknown) => AppLocal;
  function visibleLocal(record: AppRecord) { return record.ownerId == null || (accountId() !== null && String(record.ownerId) === accountId()); }
  function records() { return [...s.records.filter(record => record.kind === 'document' && sameRepo(record)), ...s.issues.filter(record => record.kind === 'issue' && sameRepo(record)), ...s.local.records.filter(record => record.kind === 'local' && visibleLocal(record))]; }
  function isLocal(record: AppRecord) { return record.kind === 'local'; }
  function isMine(record: AppRecord) { return isLocal(record) ? visibleLocal(record) : record.kind === 'document' && accountId() !== null && String(record.authorId) === accountId(); }
  function canEditRemote(record: AppRecord | null | undefined) { return record?.kind === 'document' && isMine(record) && sameRepo(record) && s.permissions.push === true; }
  function favorite(record: AppRecord) { return reader.favorite(record); }
  function mastery(record: AppRecord) { return reader.mastery(record); }
  function tags(record: AppRecord) { return reader.tags(record); }
  function authorName(author: unknown) { return typeof author === 'string' ? author : (author as AppAuthor | null | undefined)?.name || (author as AppAuthor | null | undefined)?.login || '匿名学习者'; }
  function date(value: unknown) { const time = new Date(value as string); return Number.isNaN(time.getTime()) ? '尚未同步' : time.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }); }
  function writeDemo() { if (!demo) return; try { localStorage.setItem(STORAGE, JSON.stringify({ local: s.local, settings: s.settings })); } catch (_) { toast('浏览器存储不可用，本次修改仅在当前页面保留'); } }
  function call(name: 'getComments', ...args: unknown[]): Promise<AppComment[] | { comments?: AppComment[] }>;
  function call(name: 'exportLocal', ...args: unknown[]): Promise<false | { canceled?: boolean }>;
  function call(name: AppCallName, ...args: unknown[]): Promise<AppResponse>;
  async function call(name: AppCallName, ...args: unknown[]): Promise<unknown> { if (typeof bridge?.[name] !== 'function') throw new Error(`客户端尚未提供 ${name} 接口`); const target = ['openExternal', 'openAuthUrl', 'formatCode', 'cancelLogin', 'exportLocal', 'bootstrap', 'updateLocal'].includes(name) ? createNotebookIPC(bridge) : bridge; const response = await (target as unknown as Record<AppCallName, (...args: unknown[]) => Promise<unknown>>)[name](...args); if ((response as AppPayload | null | undefined)?.error && !['bootstrap', 'sync'].includes(name)) throw new Error(errorMessage((response as AppPayload).error)); return response; }
  let localWrite: Promise<unknown> = Promise.resolve();
  async function persistLocal() { if (demo) { writeDemo(); return; } const snapshot = structuredClone(s.local); const write = localWrite.catch(() => {}).then(() => call('updateLocal', snapshot)); localWrite = write; await write; }
  function applyPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object') throw new Error('客户端未返回有效数据');

    if ((payload as AppPayload).tagCatalog && Array.isArray((payload as AppPayload).tagCatalog!.categories)) { s.tagCatalog = (payload as AppPayload).tagCatalog!; s.catalogFromPayload = true; }
    if (Object.prototype.hasOwnProperty.call(payload, 'contests')) acceptContests((payload as AppPayload).contests);
    if ((payload as AppPayload).authStatus) s.authStatus = (payload as AppPayload).authStatus!;
    Platforms?.render((payload as AppPayload).platforms || {});
    if ((payload as AppPayload).planner) s.planner = (payload as AppPayload).planner;
    Planner?.render(s.planner);
    if (typeof (payload as AppPayload).appVersion === 'string') s.appVersion = (payload as AppPayload).appVersion;
    if ((payload as AppPayload).update && typeof (payload as AppPayload).update === 'object') s.update = { ...(payload as AppPayload).update };
    if ((payload as AppPayload).updateCapability) s.updateCapability = (payload as AppPayload).updateCapability;
    updates.renderUpdate();
    s.records = (Array.isArray((payload as AppPayload).records) ? (payload as AppPayload).records! : []).filter(record => record.kind === 'document');
    s.algorithmNotes = (Array.isArray((payload as AppPayload).algorithmNotes) ? (payload as AppPayload).algorithmNotes! : []).filter(record => record.kind === 'algorithm-note');
    s.algorithmTopics = Array.isArray((payload as AppPayload).algorithmTopics) ? (payload as AppPayload).algorithmTopics : [];
    s.algorithmTree = AlgorithmDirectory.hydrate(window.QMX_ALGORITHM_TREE, s.algorithmTopics);
    s.issues = (Array.isArray((payload as AppPayload).issues) ? (payload as AppPayload).issues! : []).filter(record => record.kind === 'issue');
    s.permissions = (payload as AppPayload).permissions || {};
    s.settings = (payload as AppPayload).settings && typeof (payload as AppPayload).settings === 'object' ? (payload as AppPayload).settings! : {};
    s.local = normalizeLocal((payload as AppPayload).local);
    s.account = (payload as AppPayload).account || null; s.lastSync = (payload as AppPayload).lastSync || null; s.error = (payload as AppPayload).error ? errorMessage((payload as AppPayload).error) : '';
    applyTheme(s.settings.theme || readTheme());
    applyCodeSettings();
    renderRepoSelector();
  }
  // Anonymous GitHub API is capped at 60 requests/hour; a device-flow login raises it to 5000. These two
  // helpers keep the banner, sidebar caption, empty state and account recovery on one source of truth.
  function quotaBlocked() { return !demo && (!s.account || ['anonymous', 'expired', 'recovery-required'].includes(s.authStatus?.status)) && /额度已用完|rate limit/i.test(s.error || ''); }
  function reauthNeeded() { return !demo && (['expired', 'recovery-required'].includes(s.authStatus?.status) || /登录已失效|重新授权|请重新登录/i.test(s.error || '')); }
  function readSidebar() { try { return localStorage.getItem(SIDEBAR_STORAGE) === 'pinned'; } catch (_) { return false; } }
  let sidebarPinned = readSidebar(), sidebarHovered = false, sidebarFocused = false;
  let sidebarOpenTimer: ReturnType<typeof setTimeout> | undefined;
  function clearSidebarTimers() { clearTimeout(sidebarOpenTimer); }
  function updateSidebar() {
    const expanded = sidebarPinned || sidebarHovered || sidebarFocused;
    $('.sidebar-drawer')!.inert = !expanded;
    $('.sidebar-rail')!.inert = false;
    document.body.classList.toggle('sidebar-pinned', sidebarPinned);
    document.body.classList.toggle('sidebar-open', expanded);
    const toggle = $('#sidebar-toggle')!;
    toggle.title = sidebarPinned ? '取消固定，恢复悬浮展开' : '固定展开导航栏';
    toggle.setAttribute('aria-label', toggle.title);
    toggle.setAttribute('aria-pressed', String(sidebarPinned));
    toggle.setAttribute('aria-expanded', String(expanded));
    const railToggle = $('#sidebar-rail-toggle')!;
    if (railToggle) { railToggle.title = toggle.title; railToggle.setAttribute('aria-label', toggle.title); railToggle.setAttribute('aria-pressed', String(sidebarPinned)); }
  }
  function applySidebar(pinned: boolean) { clearSidebarTimers(); sidebarPinned = !!pinned; updateSidebar(); try { localStorage.setItem(SIDEBAR_STORAGE, sidebarPinned ? 'pinned' : 'auto'); } catch (_) {} }
  function updateStatus() {
    $('#demo-label')!.hidden = !demo;
    $('#sync-status')!.textContent = s.loading ? '正在载入…' : demo ? '浏览器预览 · 本地保存' : s.lastSync ? `最近同步 ${date(s.lastSync)}` : '尚未同步';
    const offline = !navigator.onLine;
    const banner = $('#status-banner')!;
    banner.replaceChildren();
    if (offline || s.error || reauthNeeded()) {
      banner.append(document.createTextNode(offline ? '当前处于离线状态。你仍可浏览已载入的题目、整理收藏和保存本地草稿，联网后可再次同步。' : s.error ? `连接提示：${s.error}。可稍后点击「同步」重试。` : 'GitHub 授权需要恢复。'));
      // Anonymous sync is limited to 60 requests/hour; a GitHub login raises it to 5000. Offer the
      // existing device-flow authorization right where the quota runs out, and re-authorize a stale token.
      const reauth = reauthNeeded();
      const quota = quotaBlocked();
      if (!demo && !offline && (reauth || quota)) {
        banner.append(document.createTextNode(reauth ? ' 请重新登录 GitHub 以恢复同步。' : ' 登录 GitHub 后，同步额度可由每小时 60 次提升至 5000 次。'));
        const login = button(reauth ? '重新登录 GitHub' : '使用 GitHub 登录', 'button secondary', startLoginFromBanner);
        login.id = 'banner-login-button';
        login.disabled = s.busy;
        banner.append(login);
      }
      banner.hidden = false;
    } else banner.hidden = true;
    const account = s.account;
    $('#account-name')!.textContent = account?.name || account?.login || account?.username || s.settings.displayName || '本地学习者';
    $('#account-caption')!.textContent = s.authStatus?.status === 'expired' ? '授权已过期 · 请重新登录' : s.authStatus?.status === 'recovery-required' ? '凭证恢复失败 · 请重新授权' : s.authStatus?.status === 'unverified' ? '账户尚未验证 · 请联网刷新' : account ? '账户已连接' : demo ? '演示模式 · 数据仅在本机' : quotaBlocked() ? '未登录 · 点此登录提升额度' : '未登录 · 可使用本地错题';
    for (const avatar of $$('.account-avatar')) {
      avatar.replaceChildren();
      if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(account?.avatarData || '')) { const image = element('img'); image.src = account!.avatarData!; image.alt = ''; avatar.append(image); } else avatar.textContent = String($('#account-name')!.textContent).slice(0, 1);
    }
    const accountButton = $('#account-button')!;
    accountButton.title = account ? 'GitHub 账户' : '登录 GitHub 账户';
    if (account) accountButton.removeAttribute('aria-label'); else accountButton.setAttribute('aria-label', accountButton.title);
  }
  const filters = createFilters({ getRecords: records, getView: () => s.view, getScope: () => s.libraryScope, getAccount: () => s.account, getTagCatalog: () => s.tagCatalog, getBusy: () => s.busy, favorite, mastery, isLocal, authorName, render });
  const { facets, facetNames, platformNames, luoguLevels, luoguTones, facetValue, fillFacetOptions, refreshFilters, tagGroups, fillTagOptions, openTagPicker, closeTagPicker, renderEditorTags, ranges, updateFacetCounts, setDifficultyPlatform, clearDifficulty, filteredRecords, clearFilters, colorRatingInput, colorLuoguSelection } = filters;
  async function openTagDialog() {
    const select = $('#request-tag-category')!; select.replaceChildren();
    (s.tagCatalog?.categories || []).forEach(c => { const option = element('option', '', c.name); option.value = c.id; select.append(option); });
    $('#tag-review-section')!.hidden = true; $('#tag-review-dialog')!.showModal();
    if (demo || typeof bridge?.getTagReview !== 'function') return;
    try { const result = await call('getTagReview'); s.tagReview = result; if (!result?.canReview) return; $('#tag-review-section')!.hidden = false; const list = $('#tag-review-list')!; list.replaceChildren();
      (result.requests || []).forEach(request => { const row = element('article', 'tag-request-row'); append(row, element('strong', '', `${request.category} / ${request.name}`), element('p', 'facet-help', `#${request.number} · ${authorName(request.author)} · ${request.state || 'open'}`));
        if(request.url) row.append(button('查看申请 ↗', 'button subtle', () => openExternal(request.url)));
        ['approve','reject'].forEach(decision => row.append(button(decision === 'approve' ? '批准' : '拒绝', 'button secondary', async () => { if (s.busy || !s.tagReview?.canReview || demo) return; setBusy(true); try { await call('reviewTag', { number: request.number, decision, expected: request.expected || { category: request.category, name: request.name } }); if (typeof bridge.getTagCatalog === 'function') { const catalog = await call('getTagCatalog'); if (Array.isArray(catalog?.categories)) s.tagCatalog = catalog as AppTagCatalog; } $('#tag-review-dialog')!.close(); refreshFilters(); if ($('#submit-dialog')!.open) renderEditorTags(); toast('标签申请已处理'); } catch(error) { toast(errorMessage(error)); } finally { setBusy(false); } })));
        list.append(row);
      }); if (!list.children.length) list.append(element('p', 'facet-help', '暂无待审核申请'));
    } catch(error) { toast(errorMessage(error)); }
  }
  function platformCode(value: unknown) { return Search.normalizePlatform(value); }
  const reader = createLibraryReader({ demo, stateLabels, getLocal: () => s.local, setLocal: value => { s.local = value; }, getAccount: () => s.account, getPermissions: () => s.permissions, getView: () => s.view, getLibraryScope: () => s.libraryScope, getSelected: () => s.selected, setSelected: value => { s.selected = value; }, getComments: () => s.comments, getBusy: () => s.busy, setBusy, getLoading: () => s.loading, getError: () => s.error, getRecords: records, key, isLocal, visibleLocal, canEditRemote, sameRepo, platformCode, authorName, date, quotaBlocked, renderMarkdown, persistLocal, call, render, clearFilters, openSubmit: record => editor.openSubmit(record), openLocalSolution: record => editor.openLocalSolution(record), deleteRecord: record => editor.deleteRecord(record), deleteDiscussion: record => editor.deleteDiscussion(record), openExternal, toast, errorMessage });
  const { openDetail, closeDetail, renderDetail, loadComments, changeLocal } = reader;
  function navigate(view: string | undefined) {
    if (!views[view!]) return;
    reader.resetDetail(); s.view = view!; clearFilters();
    if (view === 'home') refreshVisibleContests();
  }
  const contests = HomeContests.create({ demo, getSettings: () => s.settings, setSettings: value => { s.settings = value; }, getView: () => s.view, getLoading: () => s.loading, canRefresh: () => typeof bridge?.getContests === 'function', call, writeDemo, toast, errorMessage, openExternal });
  const { acceptContests, renderHomeContests, updateContestStatus, renderContestCards, refreshVisibleContests, refreshContests } = contests;
  function renderHome() {
    const panel = $('#home-panel')!;
    const overview = $('#platform-overview')!; overview.remove(); panel.replaceChildren();
    const toolbar = element('div', 'home-toolbar');
    const intro = element('div', 'home-intro');
    append(intro, element('span', 'home-date', new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })), element('h2', '', '今天，继续向前。'));
    append(toolbar, intro);
    const board = element('div', 'home-board');
    const planner = element('section', 'home-planner'); planner.id = 'home-planner'; planner.setAttribute('aria-label', '题单与学习任务');
    append(board, planner, renderHomeContests(), overview);
    append(panel, toolbar, board);
    Planner?.render(s.planner);
    updateContestStatus(); renderContestCards();
  }
  function render() {
    updateStateFacet();
    document.body.dataset.view = s.view;
    const [title, description, eyebrow] = views[s.view]; $('#page-title')!.replaceChildren(document.createTextNode(title), element('span', 'heading-dot', '.')); $('#breadcrumb-view')!.textContent = title; $('#page-description')!.textContent = description; $('#page-eyebrow')!.textContent = eyebrow;
    $$('.nav-item,.rail-nav-item').forEach(node => { node.classList.toggle('active', node.dataset.view === s.view); if (node.dataset.view === s.view) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
    const all = records(); $('#count-public')!.textContent = (all.filter(record => record.kind === 'document').length) as unknown as string; $('#count-favorites')!.textContent = (all.filter(favorite).length) as unknown as string;
    $('#home-panel')!.hidden = s.view !== 'home';
    $('#platform-overview')!.hidden = s.view !== 'home';
    $('#algorithm-panel')!.hidden = s.view !== 'algorithms';
    const placeholder = ['tricks'].includes(s.view);
    $('#section-placeholder')!.hidden = !placeholder;
    $('#library-panel')!.hidden = s.view === 'home' || placeholder || s.view === 'algorithms'; updateStatus();
    if (s.view === 'home') { renderHome(); return; }
    if (s.view === 'algorithms') { renderAlgorithmNotes(); return; }
    if (reader.renderFocusedDetail()) return;
    $('#library-scope-controls')!.hidden = s.view !== 'public';
    $('#library-public-button')!.setAttribute('aria-pressed', String(s.libraryScope !== 'local'));
    $('#library-local-button')!.setAttribute('aria-pressed', String(s.libraryScope === 'local'));
    $('#library-local-count')!.textContent = (s.local.records.filter(record => record.kind === 'local' && visibleLocal(record)).length) as unknown as string;
    const items = filteredRecords(); $('#result-count')!.textContent = (items.length) as unknown as string;
    $('.list-heading > span:last-child')!.textContent = facets.tags.size ? '标签命中数 ↓ · 相关度 / 更新时间' : $('#search-input')!.value.trim() ? '匹配程度 ↓' : '最近更新 ↓';
    reader.renderLibrary(items);
  }
  const { highlightCodeBlock, decorateCodeBlocks, codeBlockClick } = CodeBlocks.create({ toast, errorMessage });
  const algorithms = createAlgorithmWorkspace({ getAlgorithmNotes: () => s.algorithmNotes, setAlgorithmNotes: value => { s.algorithmNotes = value; }, getAlgorithmTopics: () => s.algorithmTopics, setAlgorithmTopics: value => { s.algorithmTopics = value; }, getAlgorithmTree: () => s.algorithmTree, setAlgorithmTree: value => { s.algorithmTree = value; }, getAccount: () => s.account, getPermissions: () => s.permissions, getLocal: () => s.local, getBusy: () => s.busy, getReadingDetail: () => ReadingDetail, accountId, repo, uuid, setBusy, persistLocal, call, render, renderMarkdown, authorName, date, tags, toast, errorMessage });
  const { renderAlgorithmNotes } = algorithms;
  function renderMarkdown(container: HTMLElement, body: unknown) {
    const source = String(body || '还没有题解内容。可以从记录错因开始。');
    if ((window as AppWindowAccess).marked! && (window as AppWindowAccess).DOMPurify!) {
      try { const parse = typeof (window as AppWindowAccess).marked!.parse === 'function' ? (window as AppWindowAccess).marked!.parse.bind((window as AppWindowAccess).marked!) : (window as AppWindowAccess).marked!; const html = MarkdownMath ? MarkdownMath.parse(source, (window as AppWindowAccess).marked!) : parse(source);
        if (MarkdownColor) container.replaceChildren(MarkdownColor.sanitize(html, (window as AppWindowAccess).DOMPurify!, container.ownerDocument));
        else container.innerHTML = (window as AppWindowAccess).DOMPurify!.sanitize(html, { FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button'], FORBID_ATTR: ['style', 'color'] });
        MarkdownMath?.render(container, (window as AppWindowAccess).katex);
        // Prism runs after sanitizing and reads textContent only, so highlighting cannot inject markup.
        $$('pre code', container).forEach(code => { if (code.parentElement && (settingsUI.settingsPreview || s.settings).codeLineNumbers) code.parentElement.classList.add('line-numbers'); highlightCodeBlock(code); });
        // Decorate after Prism: the buttons are app chrome, not sanitized Markdown.
        decorateCodeBlocks(container);
        container.classList.add('rendered'); $$('a', container).forEach(link => link.addEventListener('click', event => {
          event.preventDefault(); const href = link.getAttribute('href');
          if (href?.startsWith('#')) {
            let id; try { id = decodeURIComponent(href.slice(1)); } catch (_) { return; }
            const target = Array.from(container.querySelectorAll('[id],a[name]')).find(node => node.id === id || node.getAttribute('name') === id);
            (target || (href === '#' ? container : null))?.scrollIntoView({ block: 'start' });
            return;
          }
          openExternal(href);
        })); return; } catch (_) { /* Plain text is the secure fallback. */ }
    }
    container.textContent = source;
  }
  async function openExternal(url: unknown) { try { const parsed = new URL(String(url)); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('仅支持 http 或 https 题目链接'); if (demo) window.open(parsed.href, '_blank', 'noopener,noreferrer'); else await call('openExternal', parsed.href); } catch (error) { toast(errorMessage(error)); } }
  let updateLockedControls: [AppDisabledControl, boolean][] | null = null;
  function setBusy(value: boolean) {
    if (!value && updateLockedControls) { updateLockedControls.forEach(([node, disabled]) => { node.disabled = disabled; }); updateLockedControls = null; }
    s.busy = value;
    ['sync-button', 'account-button', 'settings-button', 'theme-select', 'submit-button', 'save-local-button', 'publish-button', 'account-login', 'account-logout', 'account-switch', 'account-refresh', 'banner-login-button'].forEach(id => { const node = document.getElementById(id); if (node) (node as AppDisabledControl).disabled = value; });
    $$<AppDisabledControl>('[data-close], #settings-form input, #settings-form select, #settings-form button').forEach(node => { node.disabled = value; });
    $$<HTMLInputElement | HTMLTextAreaElement>('#submit-form input, #submit-form textarea').forEach(node => { node.readOnly = value; });
    $$<HTMLSelectElement | HTMLButtonElement>('#submit-form select, #editor-difficulty-picker select, #editor-difficulty-picker button').forEach(node => { node.disabled = value; });
    if (!value && s.editor?.record?.kind === 'document') $('#save-local-button')!.disabled = true;
    if (value && updates.updateRunning) {
      const controls = $$<AppDisabledControl>('button, input, select, textarea');
      if (!updateLockedControls) updateLockedControls = controls.map(node => [node, node.disabled]);
      controls.forEach(node => { node.disabled = true; });
    }
    $('#check-update-button')!.disabled = value;
    if (!value) queueMicrotask(updates.showStartupUpdate);
  }
  const editor = createEditor({ demo, getEditor: () => s.editor, setEditor: value => { s.editor = value; }, getLocal: () => s.local, setLocal: value => { s.local = value; }, getRecords: () => s.records, setRecords: value => { s.records = value; }, getIssues: () => s.issues, setIssues: value => { s.issues = value; }, getComments: () => s.comments, getSelected: () => s.selected, setSelected: value => { s.selected = value; }, getBusy: () => s.busy, setBusy, getAccount: () => s.account, getPermissions: () => s.permissions, accountId, repo, key, uuid, isLocal, visibleLocal, canEditRemote, sameRepo, records, platformCode, colorRatingInput, renderEditorTags, cancelDraftSave: () => clearTimeout(draftTimer), persistLocal, call, refreshFilters, navigate, render, openDetail, toast, errorMessage });
  const { formDraft, fillForm, renderEditorDifficulty, setEditorPlatform, draftKey, editorError, openLocalSolution, openSubmit, saveDraft, saveRecord, deleteDiscussion, deleteRecord } = editor;
  async function sync() {
    if (s.busy || $('#submit-dialog')!.open) { toast('请先完成或关闭当前编辑'); return; }
    setBusy(true);
    try {
      if (demo && !webPreview) { toast('演示模式：本地记录已保留，未连接公共题库'); return; }
      if (demo) {
        const activeRepo = (s.settings.repositories || []).find(r => r.id === s.settings.activeRepoId) ||
          (s.settings.repositories || [])[0] ||
          { repo: 'qmx-acm-data/2026', serverUrl: '' };
        const currentRepo = activeRepo.repo || s.settings?.repo || 'qmx-acm-data/2026';
        const currentServer = activeRepo.serverUrl !== undefined ? activeRepo.serverUrl : (s.settings?.serverUrl || '');
        s.settings.repo = currentRepo;
        s.permissions.repo = currentRepo;

        try {
          const res = await fetch(`/api/sync?repo=${encodeURIComponent(currentRepo)}&serverUrl=${encodeURIComponent(currentServer)}`);
          if (res.ok) {
            const data = await res.json() as AppPayload;
            if (Array.isArray(data.records)) {
              s.records = data.records.map((r: AppRecord) => ({ ...r, repo: currentRepo, serverUrl: currentServer, sourceKey: repoSource(currentRepo, currentServer) }));
              s.issues = (Array.isArray(data.issues) ? data.issues : []).map((r: AppRecord) => ({ ...r, repo: currentRepo, serverUrl: currentServer, sourceKey: repoSource(currentRepo, currentServer) }));
              s.algorithmNotes = Array.isArray(data.algorithmNotes) ? data.algorithmNotes : [];
              s.algorithmTopics = Array.isArray(data.algorithmTopics) ? data.algorithmTopics : [];
              s.algorithmTree = AlgorithmDirectory.hydrate(window.QMX_ALGORITHM_TREE, s.algorithmTopics);
              s.lastSync = new Date().toISOString();
              s.comments.clear();
              refreshFilters();
              render();
              toast(`已从 ${currentRepo} 同步 ${s.records.length} 道题解`);
              return;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            toast(`同步失败：${errData.error || res.statusText}`);
            return;
          }
        } catch (fetchErr) {
          toast(`网络请求失败：${errorMessage(fetchErr)}`);
          return;
        }
        toast('演示模式：本地记录已保留，未连接公共题库');
        return;
      }
      if (!navigator.onLine) throw new Error('当前离线，请连接网络后重试');
      applyPayload(await call('sync'));
      s.comments.clear();
      refreshFilters();
      render();
      toast('学习空间已同步');
    } catch (error) {
      const message = errorMessage(error);
      try { applyPayload(await call('bootstrap')); } catch (_) {}
      s.error = message;
      refreshFilters();
      render();
      toast(`同步失败：${message}`);
    } finally {
      setBusy(false);
    }
  }
  $$('.nav-item').forEach(node => node.addEventListener('click', event => { navigate(node.dataset.view); if (event.pointerType === 'touch') { sidebarHovered = false; sidebarFocused = false; updateSidebar(); } }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && reader.isFocusedDetail() && !document.querySelector('dialog[open]')) { event.preventDefault(); closeDetail(); } });
  $('#record-tag-open')!.addEventListener('click', () => openTagPicker('editor'));
  $('#tag-picker-search')!.addEventListener('input', event => { if (filters.tagPickerContext) fillTagOptions($('#tag-picker-dialog-options')!, filters.tagPickerContext!.selected, (event.target as AppControl).value, () => {}); });
  $('#tag-picker-confirm')!.addEventListener('click', () => closeTagPicker(true));
  $('#tag-picker-cancel')!.addEventListener('click', () => closeTagPicker(false));
  $('#tag-picker-close')!.addEventListener('click', () => closeTagPicker(false));
  $('#tag-picker-dialog')!.addEventListener('cancel', event => { event.preventDefault(); closeTagPicker(false); });
  $('#request-tag-open')!.addEventListener('click', openTagDialog);
  const tagEntry = button('＋ 添加标签', 'button subtle', openTagDialog); tagEntry.id = 'tag-manager-button'; $('.topbar-actions')!.insertBefore(tagEntry, $('#sync-button')!);
  $('#tag-request-form')!.addEventListener('submit', async event => { event.preventDefault(); if (s.busy) return; const category = $('#request-tag-category')!.value, name = $('#request-tag-dialog-name')!.value.trim(); if (!category || !name) return;
    if (demo) { toast('演示模式：未发送标签申请，不会写入外部'); return; }
    setBusy(true); try { await call('requestTag', { category, name }); $('#request-tag-dialog-name')!.value = ''; $('#tag-review-dialog')!.close(); toast('标签申请已提交，审核后加入公共标签'); } catch(error) { toast(errorMessage(error)); } finally { setBusy(false); }
  });
  $('.brand')!.addEventListener('click', event => { event.preventDefault(); if (s.busy) return; reader.resetDetail(); s.view = 'home'; clearFilters(); });
  const stateSelect = $('#state-filter')!;
  const stateFacet = element('details', 'facet state-facet'); stateFacet.id = 'state-facet';
  const stateSummary = element('summary'); const stateLabel = element('span');
  append(stateSummary, stateLabel, element('span', 'facet-chevron', '⌄'));
  const stateOptions = element('div', 'facet-popover'); stateOptions.setAttribute('aria-label', '状态筛选');
  [...stateSelect.options].forEach(option => { const label = element('label', 'facet-option'); const input = element('input'); input.type = 'radio'; input.name = 'state-choice'; input.value = option.value;
    input.addEventListener('change', () => { stateSelect.value = input.value; stateFacet.open = false; render(); }); append(label, input, element('span', '', option.textContent)); stateOptions.append(label); });
  append(stateFacet, stateSummary, stateOptions); stateSelect.hidden = true; stateSelect.after(stateFacet);
  function updateStateFacet() { stateLabel.textContent = stateSelect.selectedOptions[0]?.textContent || '全部状态'; $$('input', stateOptions).forEach(input => { input.checked = input.value === stateSelect.value; }); }
  for (const [id, scope] of [['library-public-button', 'public'], ['library-local-button', 'local']]) $<HTMLInputElement>('#'+id)!.addEventListener('click', () => {
    if (s.busy) return;
    s.libraryScope = scope; s.selected = null; reader.resetDetail(); clearFilters();
  });
  $('#search-input')!.addEventListener('input', render); $('#state-filter')!.addEventListener('change', render); $('#clear-filters')!.addEventListener('click', clearFilters);
  for(const id of ['luogu-min','luogu-max']) { const select=$<HTMLSelectElement>('#'+id)!; const option=element('option','','不限');option.value='';select.append(option);luoguLevels.forEach((name,i)=>{const o=element('option',`tone-${luoguTones[i]}`,name);o.value=String(i+1);select.append(o);}); colorLuoguSelection(select);select.addEventListener('input',()=>colorLuoguSelection(select)); }
  $('#difficulty-platform')!.addEventListener('change', event => { ['rating-min','rating-max','luogu-min','luogu-max'].forEach(id => { $<HTMLInputElement>('#'+id)!.value = ''; }); facets.native.clear(); setDifficultyPlatform((event.target as AppControl).value); updateFacetCounts(); render(); });
  ['rating-min','rating-max','luogu-min','luogu-max'].forEach(id=>$<HTMLInputElement>('#'+id)!.addEventListener('input',()=>{updateFacetCounts();render();}));
  $$('[data-rating]').forEach(node=>node.addEventListener('click',()=>{const [min,max]=node.dataset.rating!.split(',');$('#rating-min')!.value=min;$('#rating-max')!.value=max;updateFacetCounts();render();}));
  $('#clear-difficulty')!.addEventListener('click',()=>{clearDifficulty();render();});
  document.addEventListener('click',event=>{ $$<HTMLDetailsElement>('.facet details[open],details.facet[open]').forEach(node=>{if(!node.contains(event.target as Node | null))node.open=false;}); });
  document.addEventListener('click', codeBlockClick);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')$$<HTMLDetailsElement>('.facet details[open],details.facet[open]').forEach(node=>node.open=false);});
  $('#submit-button')!.addEventListener('click', () => openSubmit()); $('#sync-button')!.addEventListener('click', sync);
  contests.start();
  $$('dialog').forEach(dialog => dialog.addEventListener('cancel', event => { if (s.busy) event.preventDefault(); }));
  $$('[data-close]').forEach(node => node.addEventListener('click', async () => { if (s.busy) return; if (node.dataset.close === 'submit-dialog') { clearTimeout(draftTimer); setBusy(true); await saveDraft(); setBusy(false); } (document.getElementById(node.dataset.close!) as HTMLDialogElement).close(); }));
  $('#submit-dialog')!.addEventListener('cancel', async event => { event.preventDefault(); if (s.busy) return; clearTimeout(draftTimer); setBusy(true); await saveDraft(); setBusy(false); $('#submit-dialog')!.close(); });
  $('#submit-form')!.addEventListener('input', () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 650); });
  $('#submit-form')!.elements.platform.addEventListener('change', () => { const form = $('#submit-form')!; form.elements.rating.value = ''; form.elements.difficulty.value = ''; setEditorPlatform(form.elements.platform.value, false); });
  $('#save-local-button')!.addEventListener('click', () => saveRecord(false)); $('#submit-form')!.addEventListener('submit', event => { event.preventDefault(); saveRecord(true); });
  const settingsUI = createSettings({ demo, bridge, themeStorage: THEME_STORAGE, getBusy: () => s.busy, setBusy, getSettings: () => s.settings, setSettings: value => { s.settings = value; }, getAccount: () => s.account, getAuthStatus: () => s.authStatus, getPermissions: () => s.permissions, setPermissionsRepo: value => { s.permissions.repo = value; }, getError: () => s.error, setError: value => { s.error = value; }, getLocal: () => s.local, repo, repoSource, quotaBlocked, reauthNeeded, call, applyPayload, resetRepositoryData: () => { s.records = []; s.issues = []; s.algorithmNotes = []; s.algorithmTopics = []; s.lastSync = null; s.algorithmTree = AlgorithmDirectory.hydrate(window.QMX_ALGORITHM_TREE, []); }, resetSourceView: () => { s.comments.clear(); s.selected = null; reader.resetDetail(); }, clearComments: () => s.comments.clear(), refreshFilters, render, renderUpdate: () => updates.renderUpdate(), updateStatus, sync, writeDemo, toast, errorMessage });
  const { readTheme, applyTheme, applyCodeSettings, renderRepoSelector, renderSettingsRepoList, renderAccount, startLoginFromBanner, accountAction, cancelLogin } = settingsUI;
  $('#sidebar-toggle')!.addEventListener('click', event => {
    const wasPinned = sidebarPinned; applySidebar(!wasPinned);
    if (wasPinned) { sidebarHovered = false; sidebarFocused = false; (event.currentTarget as HTMLElement).blur(); updateSidebar(); }
  });
  const sidebar = $('.sidebar')!;
  // The compact controls stay stationary beneath the translating full drawer.
  const rail = $('.sidebar-rail')!;
  for (const source of $$('.sidebar-drawer > *')) {
    const copy = source.cloneNode(true) as HTMLElement;
    for (const node of [copy, ...$$('[id]', copy)]) { if (node.id) node.removeAttribute('id'); }
    for (const node of [copy, ...$$('button,a', copy)]) {
      if (!node.matches('button,a')) continue;
      if (node.classList.contains('sidebar-toggle')) { node.id = 'sidebar-rail-toggle'; node.addEventListener('click', event => { const wasPinned = sidebarPinned; applySidebar(!wasPinned); if (wasPinned) { sidebarHovered = false; sidebarFocused = false; (event.currentTarget as HTMLElement).blur(); updateSidebar(); } }); }
      else if (node.classList.contains('nav-item')) { node.classList.replace('nav-item', 'rail-nav-item'); node.addEventListener('click', () => navigate(node.dataset.view)); }
      else if (node.classList.contains('brand')) { node.classList.replace('brand', 'rail-brand'); node.addEventListener('click', event => { event.preventDefault(); navigate('home'); }); }
      else if (node.classList.contains('sidebar-bottom')) node.addEventListener('click', () => $('#account-button')!.click());
    }
    // Avoid duplicate live account labels in the compact rail.
    rail.append(copy);
  }
  // The pin control belongs to the stationary rail and never travels with the text.
  rail.querySelector('.sidebar-toggle')!.replaceWith($('#sidebar-toggle')!);
  sidebar.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    clearSidebarTimers();
    sidebarOpenTimer = setTimeout(() => { sidebarHovered = true; updateSidebar(); }, 100);
  });
  sidebar.addEventListener('pointerleave', () => {
    clearSidebarTimers();
    sidebarHovered = false; sidebarFocused = false; updateSidebar();
  });
  sidebar.addEventListener('focusin', event => {
    if (!(event.target as Element).matches(':focus-visible')) return;
    clearTimeout(sidebarOpenTimer); sidebarFocused = true;
    updateSidebar();
  });
  sidebar.addEventListener('focusout', () => { queueMicrotask(() => { if (!sidebar.contains(document.activeElement)) { sidebarFocused = false; updateSidebar(); } }); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !sidebarPinned && !document.querySelector('dialog[open]')) { clearSidebarTimers(); sidebarHovered = false; sidebarFocused = false; if (sidebar.contains(document.activeElement)) (document.activeElement as HTMLElement).blur(); updateSidebar(); } });
  const updates = Updates.create({ demo, bridge, getAppVersion: () => s.appVersion!, getUpdate: () => s.update, setUpdate: update => { s.update = update; }, getUpdateCapability: () => s.updateCapability, getBusy: () => s.busy, setBusy, call, cancelDraftSave: () => clearTimeout(draftTimer), getLocalWrite: () => localWrite, resetLocalWrite: () => { localWrite = Promise.resolve(); }, hasEditor: () => !!s.editor, saveDraft, persistLocal, renderAccount, toast, errorMessage });
  $('#submit-form')!.elements.url.addEventListener('blur', event => {
    try { const url = new URL((event.target as AppControl).value); const form = $('#submit-form')!; let match;
      if (url.hostname.endsWith('codeforces.com') && (match = url.pathname.match(/(?:problemset\/problem\/(\d+)\/([A-Za-z0-9]+)|contest\/(\d+)\/problem\/([A-Za-z0-9]+))/))) { setEditorPlatform('CF'); form.elements.pid.value = `CF${match[1] || match[3]}${(match[2] || match[4]).toUpperCase()}`; }
      else if (url.hostname.endsWith('atcoder.jp') && (match = url.pathname.match(/\/tasks\/([^/]+)/))) { setEditorPlatform('AT'); form.elements.pid.value = match[1]; }
      else if (url.hostname.endsWith('luogu.com.cn') && (match = url.pathname.match(/\/problem\/([^/]+)/))) { setEditorPlatform('LG'); form.elements.pid.value = match[1]; }
      else if (url.hostname.endsWith('nowcoder.com')) { setEditorPlatform('NC'); if ((match = url.pathname.match(/\/acm\/problem\/(\d+)/))) form.elements.pid.value = match[1]; }
    } catch (_) { /* Validation is shown when saving. */ }
  });
  window.addEventListener('online', updateStatus); window.addEventListener('offline', updateStatus);
  document.addEventListener('keydown', event => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName as string) && !document.querySelector('dialog[open]')) { event.preventDefault(); if (['home', 'tricks', 'algorithms'].includes(s.view)) { navigate('public'); } $('#search-input')!.focus(); } });
  async function bootstrap() {
    applyTheme(readTheme()); applySidebar(readSidebar()); render();
    if (demo) {
      s.settings = cached?.settings || {};
      if (!Array.isArray(s.settings.repositories) || !s.settings.repositories.length) {
        s.settings.repositories = [
          { id: 'ctgu-2026', name: '三峡大学 2026 题解库 (校内)', repo: 'ctguacm/2026', serverUrl: 'http://172.25.5.128:3000' },
          { id: 'official', name: '官方题解库 (GitHub)', repo: 'qmx-acm-data/2026', serverUrl: '' }
        ];
        s.settings.activeRepoId = 'official';
        s.settings.repo = s.settings.repo || 'qmx-acm-data/2026';
        s.settings.serverUrl = s.settings.serverUrl || '';
      }
      s.permissions = { repo: s.settings.repo || 'qmx-acm-data/2026', push: false, admin: false };
      s.records = examples.filter(record => record.kind === 'document').map(record => ({ ...record, repo: s.permissions.repo }));
      s.issues = examples.filter(record => record.kind === 'issue').map(record => ({ ...record, repo: s.permissions.repo }));
      s.local = normalizeLocal(cached?.local || { records: [examples[2]], favorites: [key(examples[1])], mastery: { [key(examples[1])]: 'reviewing' }, draft: {} });
      s.local.records = s.local.records.map(record => record.id === 'demo-local-3' && record.pid === 'dp_f' && record.rating == null ? { ...examples[2] } : record);
      applyTheme(s.settings.theme || readTheme());
      applyCodeSettings();
      renderRepoSelector();
    }
    else { try { applyPayload(await call('bootstrap')); } catch (error) { s.error = errorMessage(error); } }
    s.loading = false; refreshFilters(); render();
    renderRepoSelector();
    void refreshContests(false);
    if (!demo && !s.catalogFromPayload && typeof bridge?.getTagCatalog === 'function') { try { const catalog = await call('getTagCatalog'); if (Array.isArray(catalog?.categories)) s.tagCatalog = catalog as AppTagCatalog; } catch (_) { /* Presets remain available offline. */ } }
    void updates.checkStartupUpdates();
    if (!demo && !s.error && s.settings.autoSync !== false && navigator.onLine) await sync();
    else if (webPreview && s.settings.autoSync !== false && navigator.onLine) void sync();
  }
  bootstrap();
})();
