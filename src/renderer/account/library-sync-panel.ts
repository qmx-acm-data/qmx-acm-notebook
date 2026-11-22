/** Per-platform library cache progress plus incremental/full rebuild/pause controls. */
import type { LibrarySyncMode, LibrarySyncPlatformState, LibrarySyncPlatformStatus, LibrarySyncState } from '../../shared/models/library-sync';

/**
 * The narrow bridge the panel needs. Real `window.notebook` methods are
 * assignable, but every response is re-validated as `unknown` before rendering
 * because persisted sync state crosses a process boundary.
 */
export interface LibrarySyncBridge {
  getLibrarySyncStatus(): Promise<unknown>;
  updateLibrary(full?: boolean): Promise<unknown>;
  pauseLibrarySync?(): Promise<unknown>;
}

export interface LibrarySyncPanelOptions {
  /** Defaults to `window.notebook`; pass `null` to force the no-bridge state. */
  bridge?: LibrarySyncBridge | null;
  /** Status poll interval while the panel is visible; defaults to 800ms. */
  pollMs?: number;
  /** Full rebuild always asks for confirmation; tests may inject a stub. */
  confirm?(message: string): boolean;
  onToast?(message: string): void;
  onError?(error: unknown): void;
}

export interface LibrarySyncPanelHandle {
  readonly section: HTMLElement;
  refresh(): Promise<void>;
  start(): void;
  stop(): void;
  destroy(): void;
}

const DEFAULT_POLL_MS = 800;
const PLATFORM_NAMES: Record<string, string> = { CF: 'Codeforces', AT: 'AtCoder', LG: '洛谷', NC: '牛客', LC: 'LeetCode', LOJ: 'LibreOJ' };
const PLATFORM_ORDER = ['CF', 'AT', 'LG', 'NC', 'LC', 'LOJ'];
const STATUS_LABELS: Record<LibrarySyncPlatformStatus, string> = {
  idle: '空闲', probing: '探测中', fetching: '抓取中', merging: '合并中', paused: '已暂停', done: '已完成', failed: '失败', skipped: '已跳过'
};
const STATUS_TONES: Record<LibrarySyncPlatformStatus, string> = {
  idle: 'tone-gray', probing: 'tone-blue', fetching: 'tone-blue', merging: 'tone-purple', paused: 'tone-yellow', done: 'tone-green', failed: 'tone-red', skipped: 'tone-gray'
};
const STATUS_NAMES = new Set<string>(Object.keys(STATUS_LABELS));
const NUMBER_FORMAT = new Intl.NumberFormat('zh-CN');

type PanelPhase = 'idle' | 'running' | 'pausing' | 'paused' | 'done';
const PHASE_LABELS: Record<PanelPhase, string> = { idle: '空闲', running: '运行中', pausing: '正在暂停', paused: '已暂停', done: '已完成' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
function toOptionalCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}
function toStatus(value: unknown): LibrarySyncPlatformStatus {
  return typeof value === 'string' && STATUS_NAMES.has(value) ? value as LibrarySyncPlatformStatus : 'idle';
}
function toText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
function toTime(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
function normalizePlatform(value: unknown): LibrarySyncPlatformState {
  const source = isRecord(value) ? value : {};
  const state: LibrarySyncPlatformState = {
    status: toStatus(source.status), known: toCount(source.known), total: toOptionalCount(source.total),
    fetched: toCount(source.fetched), added: toCount(source.added), cursor: toOptionalCount(source.cursor), updatedAt: toTime(source.updatedAt)
  };
  const message = toText(source.message);
  if (message !== undefined) state.message = message;
  return state;
}
function normalizeState(value: unknown): LibrarySyncState {
  const source = isRecord(value) ? value : {};
  const platforms: Record<string, LibrarySyncPlatformState> = {};
  if (isRecord(source.platforms)) {
    for (const [key, item] of Object.entries(source.platforms)) platforms[key] = normalizePlatform(item);
  }
  const mode: LibrarySyncMode | null = source.mode === 'full' ? 'full' : source.mode === 'incremental' ? 'incremental' : null;
  return {
    running: source.running === true, pauseRequested: source.pauseRequested === true, mode, startedAt: toTime(source.startedAt),
    finishedAt: toTime(source.finishedAt), platforms, totalCount: toCount(source.totalCount)
  };
}
function hasStatus(state: LibrarySyncState, status: LibrarySyncPlatformStatus): boolean {
  return Object.values(state.platforms).some(row => row.status === status);
}
function hasFinishedPlatform(state: LibrarySyncState): boolean {
  return Object.values(state.platforms).some(row => row.status === 'done' || row.status === 'failed' || row.status === 'skipped');
}
function panelPhase(state: LibrarySyncState): PanelPhase {
  if (state.running) return state.pauseRequested ? 'pausing' : 'running';
  if (hasStatus(state, 'paused')) return 'paused';
  if (state.finishedAt !== null || hasFinishedPlatform(state)) return 'done';
  return 'idle';
}
function pad(value: number): string { return String(value).padStart(2, '0'); }
function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatNumber(value: number): string { return NUMBER_FORMAT.format(value); }
function progressText(row: LibrarySyncPlatformState): string {
  if (row.status === 'skipped') return `已缓存 ${formatNumber(row.known)} 题 · 本次抓取 ${formatNumber(row.fetched)}`;
  if (row.status === 'done') return `本次抓取 ${formatNumber(row.fetched)} 题`;
  if (row.total !== null && row.total > 0) return `本次抓取 ${formatNumber(row.fetched)} / 上游 ${formatNumber(row.total)}`;
  return `已缓存 ${formatNumber(row.known)} 题 · 本次抓取 ${formatNumber(row.fetched)}`;
}
function platformRank(key: string): number {
  const index = PLATFORM_ORDER.indexOf(key);
  return index === -1 ? PLATFORM_ORDER.length : index;
}
/** Sums report.added when an update result follows the documented shape. */
function totalAdded(result: unknown): number | null {
  if (!isRecord(result) || !isRecord(result.platforms)) return null;
  let added = 0, seen = false;
  for (const value of Object.values(result.platforms)) {
    if (!isRecord(value) || typeof value.added !== 'number' || !Number.isFinite(value.added)) continue;
    added += value.added; seen = true;
  }
  return seen ? added : null;
}

/** Wraps the global bridge (or any candidate) after checking the required methods. */
export function resolveLibrarySyncBridge(candidate: unknown): LibrarySyncBridge | null {
  if (!isRecord(candidate)) return null;
  const getStatus = candidate.getLibrarySyncStatus;
  const update = candidate.updateLibrary;
  if (typeof getStatus !== 'function' || typeof update !== 'function') return null;
  const pause = candidate.pauseLibrarySync;
  return {
    getLibrarySyncStatus: () => (getStatus as (this: unknown) => Promise<unknown>).call(candidate),
    updateLibrary: (full?: boolean) => (update as (this: unknown, full?: boolean) => Promise<unknown>).call(candidate, full),
    ...(typeof pause === 'function' ? { pauseLibrarySync: () => (pause as (this: unknown) => Promise<unknown>).call(candidate) } : {})
  };
}

/**
 * Mounts the panel into an existing section. The section is hidden when the
 * bridge is unavailable (browser preview or an older preload); status is
 * polled only while the panel is actually visible inside an open dialog.
 */
export function mountLibrarySyncPanel(section: HTMLElement, options: LibrarySyncPanelOptions = {}): LibrarySyncPanelHandle {
  const doc = section.ownerDocument;
  const view = doc.defaultView;
  section.classList.add('library-sync');
  const candidate = options.bridge === undefined ? resolveLibrarySyncBridge(view?.notebook) : options.bridge;
  if (!candidate) {
    section.hidden = true;
    section.replaceChildren();
    return { section, refresh: async () => {}, start: () => {}, stop: () => {}, destroy: () => {} };
  }
  const bridge: LibrarySyncBridge = candidate;

  const pollMs = typeof options.pollMs === 'number' && Number.isFinite(options.pollMs) && options.pollMs >= 20 ? Math.floor(options.pollMs) : DEFAULT_POLL_MS;
  const confirmAction = options.confirm ?? ((message: string) => (view ? view.confirm(message) : false));
  const onToast = options.onToast ?? (() => {});
  const onError = options.onError ?? (() => {});
  let current: LibrarySyncState | null = null;
  let actionPending: 'incremental' | 'full' | 'pause' | null = null;
  let refreshing = false;
  let destroyed = false;
  let timer: number | null = null;

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const heading = element('div', 'library-sync-heading');
  const title = element('h3', '', '题库缓存');
  title.id = 'library-sync-heading';
  const summary = element('p', 'library-sync-summary');
  summary.setAttribute('role', 'status');
  summary.setAttribute('aria-live', 'polite');
  heading.append(title, summary);
  const intro = element('p', 'library-sync-intro', '逐平台维护本地题库缓存；更新在后台继续，关闭弹窗不会中断。');
  const platforms = element('ul', 'library-sync-platforms');
  platforms.setAttribute('aria-label', '各平台题库缓存进度');
  const empty = element('p', 'library-sync-empty', '尚未开始更新。点击「增量更新」建立本地题库缓存，已有数据会保留。');
  const failedNote = element('p', 'library-sync-failed');
  failedNote.hidden = true;
  const actions = element('div', 'library-sync-actions');
  const incremental = element('button', 'button secondary', '增量更新');
  incremental.type = 'button'; incremental.dataset.action = 'incremental';
  const full = element('button', 'button secondary', '完整重建');
  full.type = 'button'; full.dataset.action = 'full';
  const pause = element('button', 'button secondary', '暂停');
  pause.type = 'button'; pause.dataset.action = 'pause';
  actions.append(incremental, full, pause);
  const feedback = element('p', 'library-sync-feedback');
  feedback.setAttribute('role', 'status');
  feedback.hidden = true;
  const error = element('p', 'library-sync-error');
  error.hidden = true;
  error.setAttribute('role', 'alert');
  section.setAttribute('aria-labelledby', 'library-sync-heading');
  section.replaceChildren(heading, intro, platforms, empty, failedNote, actions, feedback, error);
  section.hidden = false;

  function reportError(failure: unknown): void {
    error.textContent = failure instanceof Error && failure.message.trim() ? failure.message : '题库更新失败，请稍后重试。';
    error.hidden = false;
    onError(failure);
  }

  function syncControls(): void {
    const running = current?.running === true;
    const pending = actionPending !== null;
    incremental.disabled = pending || running;
    full.disabled = pending || running;
    // A running crawl is pausable even while the start action is still pending.
    pause.disabled = actionPending === 'pause' || !running || current?.pauseRequested === true;
    pause.hidden = typeof bridge.pauseLibrarySync !== 'function';
    incremental.setAttribute('aria-busy', String(actionPending === 'incremental'));
    full.setAttribute('aria-busy', String(actionPending === 'full'));
    pause.setAttribute('aria-busy', String(actionPending === 'pause'));
    section.setAttribute('aria-busy', String(pending || running));
  }

  function renderRow(key: string, row: LibrarySyncPlatformState): HTMLLIElement {
    const item = element('li', 'library-sync-row');
    item.dataset.platform = key;
    item.dataset.status = row.status;
    const name = PLATFORM_NAMES[key] || key;
    const line = element('div', 'library-sync-line');
    const status = element('span', `library-sync-status ${STATUS_TONES[row.status]}`, STATUS_LABELS[row.status]);
    status.dataset.status = row.status;
    line.append(element('span', 'library-sync-name', name), status, element('span', 'library-sync-count', progressText(row)));
    const total = row.total !== null && row.total > 0 ? row.total : null;
    const max = total ?? Math.max(row.known, row.fetched, 1);
    const now = total === null ? Math.min(row.known, max) : Math.min(row.fetched, total);
    const percent = total === null ? 0 : Math.round(Math.min(1, row.fetched / total) * 100);
    const bar = element('div', `library-sync-bar${total === null ? ' is-indeterminate' : ''}`);
    bar.hidden = row.status === 'skipped' || row.status === 'done' || row.status === 'idle';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', `${name} 题库更新进度`);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(max));
    bar.setAttribute('aria-valuenow', String(now));
    const fill = element('div', 'library-sync-bar-fill');
    if (total !== null) fill.style.width = `${percent}%`;
    bar.append(fill);
    const meta = element('div', 'library-sync-meta');
    meta.append(element('span', 'library-sync-added', `新增 ${formatNumber(row.added)}`));
    meta.append(element('span', 'library-sync-updated', row.updatedAt ? `更新于 ${formatTime(row.updatedAt)}` : '未更新'));
    item.append(line, bar, meta);
    const message = row.message ?? (row.status === 'skipped' ? '题量未变，已跳过' : row.status === 'failed' ? '更新失败，可重试' : '');
    if (message) item.append(element('p', 'library-sync-message', message));
    return item;
  }

  function render(state: LibrarySyncState): void {
    current = state;
    section.hidden = false;
    const phase = panelPhase(state);
    section.dataset.status = phase;
    const parts = [PHASE_LABELS[phase]];
    if (state.mode === 'full') parts.push('完整重建');
    else if (state.mode === 'incremental') parts.push('增量更新');
    if (state.startedAt) parts.push(`开始于 ${formatTime(state.startedAt)}`);
    parts.push(`已知 ${formatNumber(state.totalCount)} 题`);
    summary.textContent = parts.join(' · ');
    const entries = Object.entries(state.platforms).sort(([left], [right]) => platformRank(left) - platformRank(right) || left.localeCompare(right));
    platforms.replaceChildren(...entries.map(([key, row]) => renderRow(key, row)));
    empty.hidden = entries.length > 0;
    const failed = entries.filter(([, row]) => row.status === 'failed').map(([key]) => PLATFORM_NAMES[key] || key);
    failedNote.hidden = state.running || failed.length === 0;
    failedNote.textContent = failed.length ? `${failed.join('、')} 更新失败，可点击「增量更新」重试；已有题库数据不会丢失。` : '';
    const hint = state.running && state.pauseRequested
      ? '已请求暂停，正在保存已抓取的进度…'
      : !state.running && hasStatus(state, 'paused') ? '已暂停。再次点击「增量更新」可续传。' : '';
    feedback.hidden = hint === '';
    feedback.textContent = hint;
    error.hidden = true;
    syncControls();
  }

  async function refresh(): Promise<void> {
    if (destroyed || refreshing) return;
    refreshing = true;
    try {
      const next = normalizeState(await bridge.getLibrarySyncStatus());
      if (!destroyed) render(next);
    } catch (failure) {
      if (!destroyed) {
        error.textContent = failure instanceof Error && failure.message.trim() ? failure.message : '题库进度读取失败，请稍后重试。';
        error.hidden = false;
      }
    } finally {
      refreshing = false;
    }
  }

  function visible(): boolean {
    if (!section.isConnected || section.hidden) return false;
    const dialog = section.closest('dialog');
    if (dialog && !dialog.open) return false;
    return section.getClientRects().length > 0;
  }

  function start(): void {
    if (destroyed || timer !== null || !view) return;
    timer = view.setInterval(() => { if (visible()) void refresh(); }, pollMs);
    if (visible()) void refresh();
  }

  function stop(): void {
    if (timer === null || !view) { timer = null; return; }
    view.clearInterval(timer);
    timer = null;
  }

  async function runAction(kind: 'incremental' | 'full' | 'pause', action: () => Promise<void>): Promise<void> {
    // Pause must be able to interrupt a still-pending start action.
    if ((actionPending !== null && kind !== 'pause') || destroyed) return;
    actionPending = kind;
    error.hidden = true;
    syncControls();
    try {
      await action();
    } catch (failure) {
      reportError(failure);
    } finally {
      actionPending = null;
      if (!destroyed) {
        await refresh();
        syncControls();
      }
    }
  }

  incremental.addEventListener('click', () => {
    if (actionPending !== null || current?.running === true) return;
    void runAction('incremental', async () => {
      const added = totalAdded(await bridge.updateLibrary(false));
      onToast(added === null ? '增量更新已完成' : `增量更新完成，新增 ${formatNumber(added)} 题`);
    });
  });
  full.addEventListener('click', () => {
    if (actionPending !== null || current?.running === true) return;
    if (!confirmAction('完整重建会重新抓取全部平台并替换本地题库缓存，耗时可能较长。确定继续？')) return;
    void runAction('full', async () => {
      await bridge.updateLibrary(true);
      onToast('完整重建已完成');
    });
  });
  pause.addEventListener('click', () => {
    if (actionPending === 'pause' || current?.running !== true) return;
    void runAction('pause', async () => {
      const pauseSync = bridge.pauseLibrarySync;
      if (typeof pauseSync !== 'function') return;
      render(normalizeState(await pauseSync()));
      onToast('已请求暂停，正在保存已抓取进度');
    });
  });

  start();
  syncControls();
  return {
    section,
    refresh,
    start,
    stop,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      stop();
      section.replaceChildren();
    }
  };
}

// Build-only adapter export for isolated browser tests; the app imports the function directly.
export const LibrarySyncPanel = Object.freeze({ mount: mountLibrarySyncPanel });
