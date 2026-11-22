/** CLIST rated-page synchronization controls; all network work stays in main. */
import type { ClistBulkResourceState, ClistBulkState } from '../../shared/models/clist-bulk';

export interface ClistBulkBridge {
  getClistBulkStatus(): Promise<unknown>;
  startClistBulkSync(): Promise<unknown>;
  pauseClistBulkSync(): Promise<unknown>;
  getClistStatus(): Promise<unknown>;
  getClistSharedCacheStatus?(): Promise<unknown>;
}
export interface ClistBulkPanelOptions {
  bridge?: ClistBulkBridge | null;
  pollMs?: number;
  onToast?(message: string): void;
  onError?(error: unknown): void;
}
export interface ClistBulkPanelHandle {
  readonly section: HTMLElement;
  refresh(): Promise<void>;
  start(): void;
  stop(): void;
  destroy(): void;
}
const RESOURCES = [
  ['codeforces.com', 'CF', 'Codeforces'], ['atcoder.jp', 'AT', 'AtCoder'],
  ['leetcode.com', 'LC', 'LeetCode'], ['luogu.com.cn', 'LG', '洛谷'],
  ['ac.nowcoder.com', 'NC', '牛客'], ['loj.ac', 'LOJ', 'LibreOJ']
] as const;
const LABELS = { idle: '等待更新', running: '运行中', paused: '已暂停', done: '已完成', failed: '更新失败' };
const NUMBERS = new Intl.NumberFormat('zh-CN');
const INVALID = 'CLIST 批量缓存状态无效，请稍后重试。';
const MERGED = '评分已合并到本机缓存，单题刷新保留';
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(INVALID);
  return value;
}
function status(value: unknown): ClistBulkState['status'] {
  if (value !== 'idle' && value !== 'running' && value !== 'paused' && value !== 'done' && value !== 'failed') throw new Error(INVALID);
  return value;
}
function time(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(INVALID);
  return value;
}
function normalize(value: unknown): ClistBulkState {
  if (!record(value) || value.schema !== 1 || typeof value.running !== 'boolean' || typeof value.pauseRequested !== 'boolean' || !record(value.resources)) throw new Error(INVALID);
  const resources: Record<string, ClistBulkResourceState> = {};
  for (const [key, row] of Object.entries(value.resources)) {
    if (!record(row)) throw new Error(INVALID);
    resources[key] = { offset: count(row.offset), total: row.total === null ? null : count(row.total), pages: count(row.pages), status: status(row.status), imported: count(row.imported),
      ...(row.ignored === undefined ? {} : { ignored: count(row.ignored) }), ...(row.lastId === undefined ? {} : { lastId: count(row.lastId) }) };
  }
  if (value.message !== undefined && typeof value.message !== 'string') throw new Error(INVALID);
  return { schema: 1, running: value.running, pauseRequested: value.pauseRequested, status: status(value.status), resources,
    startedAt: time(value.startedAt), finishedAt: time(value.finishedAt), ...(typeof value.message === 'string' ? { message: value.message } : {}) };
}
function failureText(error: unknown): string { return error instanceof Error && error.message.trim() ? error.message : 'CLIST 批量缓存操作失败，请稍后重试。'; }
export function resolveClistBulkBridge(candidate: unknown): ClistBulkBridge | null {
  if (!record(candidate)) return null;
  const get = candidate.getClistBulkStatus, start = candidate.startClistBulkSync, pause = candidate.pauseClistBulkSync, credentials = candidate.getClistStatus, shared = candidate.getClistSharedCacheStatus;
  if (typeof get !== 'function' || typeof start !== 'function' || typeof pause !== 'function' || typeof credentials !== 'function') return null;
  const invoke = (method: unknown): Promise<unknown> => Promise.resolve((method as (this: unknown) => unknown).call(candidate));
  return { getClistBulkStatus: () => invoke(get), startClistBulkSync: () => invoke(start), pauseClistBulkSync: () => invoke(pause), getClistStatus: () => invoke(credentials),
    ...(typeof shared === 'function' ? { getClistSharedCacheStatus: () => invoke(shared) } : {}) };
}
export function mountClistBulkPanel(section: HTMLElement, options: ClistBulkPanelOptions = {}): ClistBulkPanelHandle {
  const doc = section.ownerDocument, view = doc.defaultView;
  const bridge = resolveClistBulkBridge(options.bridge === undefined ? view?.notebook : options.bridge);
  section.classList.add('clist-bulk');
  if (!bridge) {
    section.hidden = true; section.replaceChildren();
    return { section, refresh: async () => {}, start: () => {}, stop: () => {}, destroy: () => {} };
  }
  const api = bridge;
  const pollMs = typeof options.pollMs === 'number' && Number.isFinite(options.pollMs) && options.pollMs >= 20 ? Math.floor(options.pollMs) : 800;
  let current: ClistBulkState | null = null, configured = false, credentialFailure = false;
  let starting = false, pausing = false, refreshing = false, destroyed = false;
  let timer: number | null = null, version = 0, startVersion = 0, actionFailure: string | null = null;
  let initialTotal: number | null = null;
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node;
  }
  const heading = element('div', 'clist-bulk-heading');
  const title = element('h3', '', 'CLIST 批量缓存'); title.id = 'clist-bulk-heading';
  const summary = element('p', 'clist-bulk-summary', '正在读取批量缓存状态…'); summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite');
  heading.append(title, summary);
  const intro = element('p', 'clist-bulk-intro', '每次请求 1 页，最多 1000 条，最多 10 次/分钟；先使用内置基线，再分页更新，并与个人缓存合并。');
  const baseline = element('p', 'clist-bulk-baseline');
  const hint = element('p', 'clist-bulk-hint', '使用初始缓存不需要 Key；更新评分需先在账户设置配置个人 CLIST 用户名与 API Key。'); hint.setAttribute('role', 'status');
  const resources = element('ul', 'clist-bulk-resources'); resources.setAttribute('aria-label', '各平台 CLIST 分页更新进度');
  const result = element('p', 'clist-bulk-result'); result.setAttribute('role', 'status'); result.hidden = true;
  const actions = element('div', 'clist-bulk-actions');
  const startButton = element('button', 'button secondary', '批量刷新评分'); startButton.type = 'button'; startButton.dataset.action = 'start';
  const pauseButton = element('button', 'button secondary', '暂停'); pauseButton.type = 'button'; pauseButton.dataset.action = 'pause'; actions.append(startButton, pauseButton);
  const error = element('p', 'clist-bulk-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  section.setAttribute('aria-labelledby', title.id); section.replaceChildren(heading, intro, baseline, hint, resources, result, actions, error); section.hidden = false;
  function running(): boolean { return current?.running === true || current?.status === 'running'; }
  function controls(): void {
    startButton.disabled = starting || pausing || running() || !configured;
    startButton.textContent = current?.status === 'paused' || current?.status === 'failed' ? '继续批量刷新评分' : '批量刷新评分';
    pauseButton.disabled = pausing || current?.pauseRequested === true || !(running() || (starting && startVersion === version));
    startButton.setAttribute('aria-busy', String(starting)); pauseButton.setAttribute('aria-busy', String(pausing));
    section.setAttribute('aria-busy', String(starting || pausing || running())); hint.hidden = configured;
    baseline.textContent = initialTotal === null ? '先使用内置基线，再分页更新。' : `内置基线 ${NUMBERS.format(initialTotal)} 条（不等于本地题库匹配 ${NUMBERS.format(initialTotal)} 条）`;
    if (actionFailure || credentialFailure) { error.textContent = actionFailure ?? '个人 CLIST 配置状态读取失败，请在账户设置中检查。'; error.hidden = false; }
    else { error.textContent = ''; error.hidden = true; }
  }
  function render(state: ClistBulkState): void {
    if (destroyed) return;
    const previous = current; current = state;
    const rows = RESOURCES.map(([resource]) => state.resources[resource]);
    const sum = (field: 'offset' | 'pages' | 'imported' | 'ignored') => rows.reduce((total, row) => total + (row?.[field] ?? 0), 0);
    const totalKnown = rows.every(row => row && row.total !== null);
    const total = rows.reduce((total, row) => total + (row?.total ?? 0), 0);
    const pagesTotal = rows.reduce((total, row) => total + Math.ceil((row?.total ?? 0) / 1000), 0);
    const empty = state.status === 'done' && totalKnown && total === 0 && sum('imported') === 0;
    const phase = state.running ? (state.pauseRequested ? '正在暂停' : '运行中') : LABELS[state.status];
    section.dataset.status = state.status;
    summary.textContent = `${phase} · 已请求 ${NUMBERS.format(sum('pages'))} 页${totalKnown ? ` / 总页 ${NUMBERS.format(pagesTotal)}` : ' / 总页待获取'} · 记录 ${NUMBERS.format(sum('offset'))} / ${totalKnown ? NUMBERS.format(total) : '待获取'} · 已合并 ${NUMBERS.format(sum('imported'))} · 忽略 ${NUMBERS.format(sum('ignored'))}${empty ? ' · CLIST 暂无有效分' : ''}`;
    resources.replaceChildren(...RESOURCES.map(([resource, platform, name]) => {
      const row = state.resources[resource]; const item = element('li', 'clist-bulk-row'); item.dataset.platform = platform; item.dataset.resource = resource;
      item.append(element('strong', 'clist-bulk-name', `${platform} · ${name}`));
      item.append(element('span', 'clist-bulk-counts', row ? `总记录 ${row.total === null ? '待获取' : NUMBERS.format(row.total)} · 游标 ${NUMBERS.format(row.offset)} · 页数 ${NUMBERS.format(row.pages)} · 合并 ${NUMBERS.format(row.imported)} · 忽略 ${NUMBERS.format(row.ignored ?? 0)}` : '总记录待获取 · 游标 0 · 页数 0 · 合并 0 · 忽略 0'));
      item.append(element('span', 'clist-bulk-resource-status', row?.status === 'done' && row.total === 0 && row.imported === 0 ? 'CLIST 暂无有效分' : row ? LABELS[row.status] : '等待更新'));
      return item;
    }));
    result.hidden = state.status !== 'done'; result.textContent = empty ? 'CLIST 暂无有效分' : MERGED;
    if (state.status === 'done' && previous && previous.status !== 'done' && !empty) options.onToast?.(MERGED);
    if (state.message) { result.textContent = [state.status === 'done' ? result.textContent : '', state.message].filter(Boolean).join(' · '); result.hidden = false; }
    controls();
  }
  function visible(): boolean {
    const dialog = section.closest('dialog');
    return section.isConnected && !section.hidden && doc.visibilityState !== 'hidden' && (!dialog || dialog.open) && section.getClientRects().length > 0;
  }
  async function readCredentials(): Promise<void> {
    try { const value = await api.getClistStatus(); if (!record(value) || typeof value.configured !== 'boolean') throw new Error(INVALID); configured = value.configured; credentialFailure = false; }
    catch { configured = false; credentialFailure = true; }
  }
  async function readBaseline(): Promise<void> {
    if (!api.getClistSharedCacheStatus) return;
    try { const value = await api.getClistSharedCacheStatus(); if (record(value) && value.initialTotal !== undefined) initialTotal = count(value.initialTotal); }
    catch { /* A missing shared cache status must not block personal updates. */ }
  }
  async function refresh(): Promise<void> {
    if (destroyed || refreshing || starting || pausing || !visible()) return;
    refreshing = true; const requestVersion = version;
    try {
      const [state] = await Promise.all([api.getClistBulkStatus(), readCredentials(), readBaseline()]);
      if (!destroyed && requestVersion === version) render(normalize(state));
    } catch (failure) { if (!destroyed && requestVersion === version) { error.textContent = actionFailure ?? failureText(failure); error.hidden = false; controls(); if (!actionFailure && !credentialFailure) { error.textContent = failureText(failure); error.hidden = false; } } }
    finally { refreshing = false; }
  }
  async function action(kind: 'start' | 'pause'): Promise<void> {
    if (destroyed) return;
    if (kind === 'start' ? starting || pausing || running() || !configured : pausing || current?.pauseRequested === true || !(running() || (starting && startVersion === version))) return;
    if (kind === 'start') starting = true; else pausing = true;
    const requestVersion = ++version;
    if (kind === 'start') startVersion = requestVersion;
    actionFailure = null; controls();
    try {
      const value = kind === 'start' ? await api.startClistBulkSync() : await api.pauseClistBulkSync();
      if (!destroyed && requestVersion === version) { render(normalize(value)); options.onToast?.(kind === 'start' ? '已开始批量刷新评分，分页更新会在后台继续' : '已请求暂停，当前页完成后停止'); }
    } catch (failure) { if (!destroyed && requestVersion === version) { actionFailure = failureText(failure); options.onError?.(failure); } }
    finally { if (kind === 'start') starting = false; else pausing = false; if (!destroyed) { controls(); void refresh(); } }
  }
  function start(): void { if (destroyed || timer !== null || !view) return; timer = view.setInterval(() => { if (visible()) void refresh(); }, pollMs); if (visible()) void refresh(); }
  function stop(): void { if (timer !== null && view) view.clearInterval(timer); timer = null; }
  startButton.addEventListener('click', () => { void action('start'); }); pauseButton.addEventListener('click', () => { void action('pause'); });
  controls(); start();
  return { section, refresh, start, stop, destroy(): void { if (destroyed) return; destroyed = true; version += 1; stop(); section.replaceChildren(); } };
}
// Standalone build adapter for browser tests; settings imports mount directly.
export const ClistBulkPanel = Object.freeze({ mount: mountClistBulkPanel });
