/** Per-platform CLIST rating cache progress plus start/pause controls. */
import type { DifficultyBackfillPlatformState, DifficultyBackfillState, DifficultyBackfillStatus } from '../../shared/models/difficulty-backfill';

/**
 * The narrow bridge the panel needs. `window.notebook` methods are assignable,
 * but every response is re-validated as `unknown` before rendering because
 * persisted backfill state crosses a process boundary.
 */
export interface DifficultyBackfillBridge {
  getDifficultyBackfillStatus(): Promise<unknown>;
  startDifficultyBackfill(): Promise<unknown>;
  pauseDifficultyBackfill(): Promise<unknown>;
  getClistStatus?(): Promise<unknown>;
}

export interface DifficultyBackfillPanelOptions {
  /** Defaults to `window.notebook`; pass `null` to force the no-bridge state. */
  bridge?: DifficultyBackfillBridge | null;
  /** Status poll interval while the panel is visible; defaults to 800ms. */
  pollMs?: number;
  onToast?(message: string): void;
  onError?(error: unknown): void;
}

export interface DifficultyBackfillPanelHandle {
  readonly section: HTMLElement;
  refresh(): Promise<void>;
  start(): void;
  stop(): void;
  destroy(): void;
}

const DEFAULT_POLL_MS = 800;
const CLIST_HINT = '需先在账户设置配置 CLIST 用户名与 API Key';
const PLATFORM_NAMES: Record<string, string> = { CF: 'Codeforces', AT: 'AtCoder', LG: '洛谷', NC: '牛客', LC: 'LeetCode', LOJ: 'LibreOJ' };
const PLATFORM_ORDER = ['CF', 'AT', 'LG', 'NC', 'LC', 'LOJ'];
const STATUS_LABELS: Record<DifficultyBackfillStatus, string> = {
  idle: '空闲', running: '运行中', pausing: '正在暂停', paused: '已暂停', done: '已完成', failed: '失败'
};
const NUMBER_FORMAT = new Intl.NumberFormat('zh-CN');

type ClistCredentialState = { configured: boolean; username: string | null };
type ActionKind = 'start' | 'pause';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
function toStatus(value: unknown): DifficultyBackfillStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STATUS_LABELS, value)
    ? value as DifficultyBackfillStatus
    : 'idle';
}
function toText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}
function toTime(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
function normalizePlatform(value: unknown): DifficultyBackfillPlatformState {
  const source = isRecord(value) ? value : {};
  return {
    missing: toCount(source.missing),
    ...(source.total === undefined ? {} : { total: toCount(source.total) }),
    ...(source.clistCached === undefined ? {} : { clistCached: toCount(source.clistCached) }),
    ...(source.clistPending === undefined ? {} : { clistPending: toCount(source.clistPending) }),
    ...(source.sourceMissing === undefined ? {} : { sourceMissing: toCount(source.sourceMissing) }),
    ...(source.resolved === undefined ? {} : { resolved: toCount(source.resolved) }),
    attempted: toCount(source.attempted), found: toCount(source.found),
    notFound: toCount(source.notFound), noRating: toCount(source.noRating), failed: toCount(source.failed)
  };
}
function normalizeState(value: unknown): DifficultyBackfillState {
  const source = isRecord(value) ? value : {};
  const platforms: Record<string, DifficultyBackfillPlatformState> = {};
  if (isRecord(source.platforms)) {
    for (const [key, item] of Object.entries(source.platforms)) platforms[key] = normalizePlatform(item);
  }
  const state: DifficultyBackfillState = {
    status: toStatus(source.status),
    running: source.running === true,
    pauseRequested: source.pauseRequested === true,
    batchSize: toCount(source.batchSize),
    processed: toCount(source.processed),
    found: toCount(source.found),
    ...(source.notFound === undefined ? {} : { notFound: toCount(source.notFound) }),
    ...(source.noRating === undefined ? {} : { noRating: toCount(source.noRating) }),
    skipped: toCount(source.skipped),
    failed: toCount(source.failed),
    startedAt: toTime(source.startedAt),
    finishedAt: toTime(source.finishedAt),
    platforms
  };
  const message = toText(source.message);
  if (message !== undefined) state.message = message;
  return state;
}
function normalizeClistStatus(value: unknown): ClistCredentialState {
  const source = isRecord(value) ? value : {};
  return {
    configured: source.configured === true,
    username: typeof source.username === 'string' && source.username.trim() !== '' ? source.username.trim() : null
  };
}
/** A running worker wins over a stale persisted status field. */
function panelStatus(state: DifficultyBackfillState | null): DifficultyBackfillStatus {
  if (!state) return 'idle';
  if (state.running) return state.pauseRequested ? 'pausing' : 'running';
  return state.status;
}
function isRunningState(state: DifficultyBackfillState | null): boolean {
  if (!state) return false;
  const status = panelStatus(state);
  return status === 'running' || status === 'pausing';
}
function pad(value: number): string { return String(value).padStart(2, '0'); }
function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatNumber(value: number): string { return NUMBER_FORMAT.format(value); }
function platformRank(key: string): number {
  const index = PLATFORM_ORDER.indexOf(key);
  return index === -1 ? PLATFORM_ORDER.length : index;
}

/** Wraps the global bridge (or any candidate) after checking the required methods. */
export function resolveDifficultyBackfillBridge(candidate: unknown): DifficultyBackfillBridge | null {
  if (!isRecord(candidate)) return null;
  const getStatus = candidate.getDifficultyBackfillStatus;
  const start = candidate.startDifficultyBackfill;
  const pause = candidate.pauseDifficultyBackfill;
  if (typeof getStatus !== 'function' || typeof start !== 'function' || typeof pause !== 'function') return null;
  const getClist = candidate.getClistStatus;
  return {
    getDifficultyBackfillStatus: () => (getStatus as (this: unknown) => Promise<unknown>).call(candidate),
    startDifficultyBackfill: () => (start as (this: unknown) => Promise<unknown>).call(candidate),
    pauseDifficultyBackfill: () => (pause as (this: unknown) => Promise<unknown>).call(candidate),
    ...(typeof getClist === 'function' ? { getClistStatus: () => (getClist as (this: unknown) => Promise<unknown>).call(candidate) } : {})
  };
}

/**
 * Mounts the panel into an existing section. The section is hidden when the
 * bridge is unavailable (browser preview or an older preload); status is
 * polled only while the panel is actually visible inside an open dialog.
 */
export function mountDifficultyBackfillPanel(section: HTMLElement, options: DifficultyBackfillPanelOptions = {}): DifficultyBackfillPanelHandle {
  const doc = section.ownerDocument;
  const view = doc.defaultView;
  section.classList.add('difficulty-backfill');
  const candidate = options.bridge === undefined ? resolveDifficultyBackfillBridge(view?.notebook) : options.bridge;
  if (!candidate) {
    section.hidden = true;
    section.replaceChildren();
    return { section, refresh: async () => {}, start: () => {}, stop: () => {}, destroy: () => {} };
  }
  const bridge: DifficultyBackfillBridge = candidate;

  const pollMs = typeof options.pollMs === 'number' && Number.isFinite(options.pollMs) && options.pollMs >= 20 ? Math.floor(options.pollMs) : DEFAULT_POLL_MS;
  const onToast = options.onToast ?? (() => {});
  const onError = options.onError ?? (() => {});
  let current: DifficultyBackfillState | null = null;
  let clist: ClistCredentialState | null = null;
  let clistFailure = false;
  let actionFailure: string | null = null;
  let actionPending: ActionKind | null = null;
  let refreshing = false;
  let destroyed = false;
  let timer: number | null = null;

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const heading = element('div', 'difficulty-backfill-heading');
  const title = element('h3', '', 'CLIST 评分缓存');
  title.id = 'difficulty-backfill-heading';
  const summary = element('p', 'difficulty-backfill-summary');
  summary.setAttribute('role', 'status');
  summary.setAttribute('aria-live', 'polite');
  heading.append(title, summary);
  const history = element('p', 'difficulty-backfill-history');
  const legacy = element('p', 'difficulty-backfill-legacy');
  legacy.hidden = true;
  const intro = element('p', 'difficulty-backfill-intro', '所有题目按批查询；有效评分写入本机缓存；没有有效CLIST评分则沿用原生或社区难度。每批默认 100 题，遵守 CLIST 限流。');
  const hint = element('p', 'difficulty-backfill-hint', CLIST_HINT);
  hint.setAttribute('role', 'status');
  hint.hidden = true;
  const platforms = element('ul', 'difficulty-backfill-platforms');
  platforms.setAttribute('aria-label', '各平台 CLIST 评分缓存进度');
  const actions = element('div', 'difficulty-backfill-actions');
  const startButton = element('button', 'button secondary', '开始缓存');
  startButton.type = 'button'; startButton.dataset.action = 'start';
  const pauseButton = element('button', 'button secondary', '暂停');
  pauseButton.type = 'button'; pauseButton.dataset.action = 'pause';
  actions.append(startButton, pauseButton);
  const error = element('p', 'difficulty-backfill-error');
  error.hidden = true;
  error.setAttribute('role', 'alert');
  section.setAttribute('aria-labelledby', 'difficulty-backfill-heading');
  section.replaceChildren(heading, history, legacy, intro, hint, platforms, actions, error);
  section.hidden = false;

  function reportError(failure: unknown): void {
    actionFailure = failure instanceof Error && failure.message.trim() ? failure.message : 'CLIST 评分缓存操作失败，请稍后重试。';
    error.textContent = actionFailure;
    error.hidden = false;
    onError(failure);
  }

  function renderError(): void {
    if (actionFailure !== null) { error.textContent = actionFailure; error.hidden = false; return; }
    if (clistFailure) { error.textContent = 'CLIST 配置状态读取失败，请稍后在账户设置中检查。'; error.hidden = false; return; }
    error.hidden = true;
    error.textContent = '';
  }

  function syncControls(): void {
    const running = isRunningState(current);
    const pending = actionPending !== null;
    const configured = clist?.configured === true;
    startButton.disabled = pending || running || !configured;
    // Pause must be able to interrupt a start request that is still pending.
    pauseButton.disabled = actionPending === 'pause' || current?.pauseRequested === true || !(running || actionPending === 'start');
    startButton.setAttribute('aria-busy', String(actionPending === 'start'));
    pauseButton.setAttribute('aria-busy', String(actionPending === 'pause'));
    section.setAttribute('aria-busy', String(pending || running));
  }

  function renderRow(key: string, row: DifficultyBackfillPlatformState): HTMLLIElement {
    const item = element('li', 'difficulty-backfill-row');
    item.dataset.platform = key;
    const line = element('div', 'difficulty-backfill-line');
    const name = PLATFORM_NAMES[key] || key;
    line.append(element('span', 'difficulty-backfill-name', name));
    if (row.total !== undefined && row.clistCached !== undefined && row.clistPending !== undefined) {
      line.append(element('span', 'difficulty-backfill-cache', `待查 CLIST ${formatNumber(row.clistPending)} · 已缓存 ${formatNumber(row.clistCached)} / 总题 ${formatNumber(row.total)}`));
    }
    const gaps = element('div', 'difficulty-backfill-gaps');
    gaps.append(element('span', 'difficulty-backfill-missing', `仍无可用难度 ${formatNumber(row.missing)}`));
    if (row.sourceMissing !== undefined && row.resolved !== undefined) {
      gaps.append(element('span', 'difficulty-backfill-coverage', `原生/社区缺失 ${formatNumber(row.sourceMissing)} · 已补 ${formatNumber(row.resolved)}`));
    }
    const counts = element('div', 'difficulty-backfill-counts');
    counts.append(element('span', 'difficulty-backfill-attempted', `本批查询 ${formatNumber(row.attempted)}：`));
    counts.append(element('span', 'difficulty-backfill-found', `查到 ${formatNumber(row.found)}`));
    counts.append(element('span', 'difficulty-backfill-not-found', `未收录 ${formatNumber(row.notFound ?? 0)}`));
    counts.append(element('span', 'difficulty-backfill-no-rating', `无评分 ${formatNumber(row.noRating ?? 0)}`));
    counts.append(element('span', 'difficulty-backfill-failed', `失败 ${formatNumber(row.failed ?? 0)}`));
    item.append(line, gaps, counts);
    return item;
  }

  function render(state: DifficultyBackfillState): void {
    current = state;
    section.hidden = false;
    const phase = panelStatus(state);
    section.dataset.status = phase;
    const parts = [
      STATUS_LABELS[phase],
      `本批已处理 ${formatNumber(state.processed)} / ${formatNumber(state.batchSize)}`,
      `查到 ${formatNumber(state.found)}`,
      `未收录 ${formatNumber(state.notFound ?? 0)}`,
      `无评分 ${formatNumber(state.noRating ?? 0)}`,
      `请求失败 ${formatNumber(state.failed)}`
    ];
    if (state.startedAt) parts.push(`开始于 ${formatTime(state.startedAt)}`);
    if (state.finishedAt) parts.push(`结束于 ${formatTime(state.finishedAt)}`);
    if (state.message) parts.push(state.message);
    summary.textContent = parts.join(' · ');
    history.textContent = `历史记录跳过 ${formatNumber(state.skipped)} 题（已有 CLIST 正分缓存或台账冷却中，不计入本批）`;
    const entries = Object.entries(state.platforms).sort(([left], [right]) => platformRank(left) - platformRank(right) || left.localeCompare(right));
    const attempted = entries.reduce((total, [, row]) => total + row.attempted, 0);
    const legacyParts: string[] = [];
    if (state.processed !== attempted) legacyParts.push('旧批次统计，重新开始后按本批计数');
    if (state.processed > 0 && (state.notFound === undefined || state.noRating === undefined)) {
      legacyParts.push('旧批次未分原因，后续查询开始分类');
    }
    legacy.textContent = legacyParts.join('；');
    legacy.hidden = legacyParts.length === 0;
    platforms.replaceChildren(...entries.map(([key, row]) => renderRow(key, row)));
    hint.hidden = clist?.configured === true;
    renderError();
    syncControls();
  }

  async function loadClistStatus(): Promise<void> {
    const getClist = bridge.getClistStatus;
    if (typeof getClist !== 'function') {
      clist = { configured: false, username: null };
      clistFailure = false;
      return;
    }
    try {
      clist = normalizeClistStatus(await getClist());
      clistFailure = false;
    } catch {
      clistFailure = true;
    }
  }

  async function refresh(): Promise<void> {
    if (destroyed || refreshing) return;
    refreshing = true;
    try {
      const [state] = await Promise.all([bridge.getDifficultyBackfillStatus(), loadClistStatus()]);
      if (!destroyed) render(normalizeState(state));
    } catch (failure) {
      if (!destroyed) {
        error.textContent = failure instanceof Error && failure.message.trim() ? failure.message : 'CLIST 评分缓存进度读取失败，请稍后重试。';
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

  async function runAction(kind: ActionKind, action: () => Promise<void>): Promise<void> {
    // Pause must be able to interrupt a still-pending start action.
    if (destroyed) return;
    if (kind === 'start') {
      if (actionPending !== null || isRunningState(current) || clist?.configured !== true) return;
    } else if (actionPending === 'pause' || current?.pauseRequested === true || !(isRunningState(current) || actionPending === 'start')) {
      return;
    }
    actionPending = kind;
    actionFailure = null;
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

  startButton.addEventListener('click', () => {
    if (actionPending !== null || isRunningState(current) || clist?.configured !== true) return;
    void runAction('start', async () => {
      render(normalizeState(await bridge.startDifficultyBackfill()));
      onToast('已开始 CLIST 评分缓存，进度会在后台继续');
    });
  });
  pauseButton.addEventListener('click', () => {
    if (actionPending === 'pause' || current?.pauseRequested === true || !(isRunningState(current) || actionPending === 'start')) return;
    void runAction('pause', async () => {
      render(normalizeState(await bridge.pauseDifficultyBackfill()));
      onToast('已请求暂停，CLIST 评分缓存将在当前题目完成后停止');
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
export const DifficultyBackfillPanel = Object.freeze({ mount: mountDifficultyBackfillPanel });
