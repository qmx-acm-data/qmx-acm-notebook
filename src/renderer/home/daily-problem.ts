import type { DailyDrawFilters, DailyDrawResult } from '../../shared/models/daily-problem';
import { Search } from '../lib/search.js';
import { luoguDifficultyLabel, luoguDifficultyLevels } from '../../shared/luogu-difficulty.js';
import { tagColorClass } from '../lib/tag-color.js';
import { openProblemEnrichment } from './problem-enrichment.js';

interface DailyOptions {
  draw(filters: DailyDrawFilters): Promise<DailyDrawResult>;
  openExternal(url: string): unknown;
  chooseTags(selected: Set<string>, onApply: (tags: Set<string>) => void): void;
  updateLibrary?(): Promise<{ total?: number; platforms?: Record<string, { added?: number; status?: string }> }>;
  /** Draws once on the first mount so a launch shows a problem immediately. */
  autoDraw?: boolean;
  /** Account and library boundary for cached local problem data. */
  contextKey?: string;
}
// Survives home re-renders: the same draw result is shown without redrawing.
let cachedResult: DailyDrawResult | null = null;
let autoDrawStarted = false;
let pendingRequest: Promise<void> | null = null;
let lastDrawError = '';
let activeContext = '';
let contextGeneration = 0;
let resultRevision = 0;
let resultTagsExpanded = false;
let pendingClistRefresh: { generation: number; url: string; revision: number } | null = null;
let clistRefreshFeedback: { message: string; detail: string } | null = null;
let lastElapsedMs: number | null = null;
let lastServiceDurationMs: number | null = null;
const savedFilters = { source: 'all', ratingMin: '', ratingMax: '', luoguDifficultyMin: '', luoguDifficultyMax: '', tags: [] as string[] };
let latestMount: { section: HTMLElement; sync(): void; restoreFilters(): void; draw(): Promise<void> } | null = null;
function notifyMount() { if (latestMount?.section.isConnected) latestMount.sync(); }
const sources = [['all', '全部来源'], ['local', '本地题库'], ['public', '公共题库'], ['CF', 'Codeforces'], ['LG', '洛谷'], ['AT', 'AtCoder'], ['NC', '牛客'], ['LC', 'LeetCode'], ['LOJ', 'LibreOJ']];
const sourceNames: Record<string, string> = Object.fromEntries(sources);
const platformName = (source: string) => sourceNames[source] ?? source;
const luoguLevels = luoguDifficultyLevels;
const formatDuration = (durationMs: number) => durationMs < 1000 ? `${Math.round(durationMs)} 毫秒` : `${(durationMs / 1000).toFixed(2)} 秒`;
function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag); element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function button(label: string, className: string, onClick: () => unknown) {
  const element = node('button', className, label); element.type = 'button'; element.addEventListener('click', onClick); return element;
}
function option(value: string, label: string) { const element = node('option', '', label); element.value = value; return element; }
function create({ draw: drawApi, openExternal, chooseTags, updateLibrary, autoDraw = false, contextKey = '' }: DailyOptions) {
  if (activeContext !== contextKey) {
    activeContext = contextKey; contextGeneration += 1;
    cachedResult = null; pendingRequest = null; lastDrawError = ''; autoDrawStarted = false;
    resultRevision += 1; resultTagsExpanded = false; pendingClistRefresh = null; clistRefreshFeedback = null;
    lastElapsedMs = null; lastServiceDurationMs = null;
    Object.assign(savedFilters, { source: 'all', ratingMin: '', ratingMax: '', luoguDifficultyMin: '', luoguDifficultyMax: '', tags: [] });
  }
  const generation = contextGeneration;
  const section = node('section', 'daily-problem'); section.setAttribute('aria-labelledby', 'daily-problem-title');
  const heading = node('div', 'daily-problem-heading'), titleGroup = node('div', 'daily-problem-title-group');
  const title = node('h2', '', '每日一题'); title.id = 'daily-problem-title';
  titleGroup.append(node('span', 'eyebrow', 'DAILY PRACTICE'), title);
  const aside = node('div', 'daily-problem-heading-aside');
  const refresh = button('刷新题库', 'button subtle daily-refresh', () => refreshLibrary());
  refresh.title = '增量更新本地题库索引';
  aside.append(node('span', 'daily-problem-caption', '按今天的状态，抽一道值得做的题'), refresh);
  heading.append(titleGroup, aside);
  const filters = node('div', 'daily-problem-filters');
  const source = node('select', 'daily-filter-source'); source.setAttribute('aria-label', '题目来源');
  sources.forEach(([value, label]) => source.append(option(value, label)));
  const ratingMin = node('input', 'daily-filter-rating');
  ratingMin.type = 'number'; ratingMin.min = '0'; ratingMin.max = '3500'; ratingMin.step = '100'; ratingMin.placeholder = 'Rating ≥'; ratingMin.setAttribute('aria-label', '最低 Codeforces Rating');
  const ratingMax = node('input', 'daily-filter-rating');
  ratingMax.type = 'number'; ratingMax.min = '0'; ratingMax.max = '3500'; ratingMax.step = '100'; ratingMax.placeholder = 'Rating ≤'; ratingMax.setAttribute('aria-label', '最高 Codeforces Rating');
  const lgMin = node('select', 'daily-filter-luogu daily-filter-luogu-min'); lgMin.setAttribute('aria-label', '最低洛谷难度');
  const lgMax = node('select', 'daily-filter-luogu-max'); lgMax.setAttribute('aria-label', '最高洛谷难度');
  lgMin.append(option('', '洛谷难度 ≥不限')); lgMax.append(option('', '洛谷难度 ≤不限'));
  luoguLevels.forEach(level => { lgMin.append(option(level, level)); lgMax.append(option(level, level)); });
  let selectedTags = new Set<string>();
  const tags = button('算法标签…', 'button secondary daily-filter-tags', () => chooseTags(selectedTags, selected => {
    if (generation !== contextGeneration) return;
    savedFilters.tags = [...selected];
    if (latestMount?.section.isConnected) latestMount.restoreFilters();
  }));
  const presetNames = ['动态规划', '图论', '数据结构', '数学', '字符串', '贪心', '二分', '搜索', '树', '构造'];
  const presets = document.createElement('datalist'); presets.id = `daily-tag-suggestions-${Math.random().toString(36).slice(2)}`;
  presetNames.forEach(tag => presets.append(option(tag, tag)));
  tags.setAttribute('aria-label', '算法标签'); tags.setAttribute('aria-haspopup', 'dialog');
  filters.append(source, ratingMin, ratingMax, lgMin, lgMax, tags, presets);
  const result = node('article', 'daily-problem-result');
  const loading = node('div', 'daily-problem-loading'); loading.hidden = true; loading.setAttribute('role', 'status');
  const loadingCopy = node('div', 'daily-loading-copy');
  loadingCopy.append(node('strong', '', '正在抽题…'), node('span', '', '正在请求各平台题库，可能需要十几秒'));
  loading.append(node('span', 'daily-loading-spinner'), loadingCopy);
  const error = node('p', 'daily-problem-error'); error.hidden = true; error.setAttribute('role', 'alert');
  const empty = node('p', 'daily-problem-empty', '调整筛选后，试试手气。');
  result.append(empty, loading, error);
  const actions = node('div', 'daily-problem-actions');
  const draw = button('试试手气', 'button primary daily-draw', () => drawProblem());
  const change = button('换一道', 'button subtle daily-change', () => drawProblem(true)); change.hidden = true;
  const easier = button('− 难度', 'button subtle daily-easier', () => shiftDifficulty(-1));
  const harder = button('＋ 难度', 'button subtle daily-harder', () => shiftDifficulty(1));
  const currentDifficulty = node('span', 'daily-current-difficulty', '当前难度：洛谷不限');
  lgMin.addEventListener('change', updateDifficulty); lgMax.addEventListener('change', updateDifficulty);
  const copy = button('复制链接', 'button subtle daily-copy', () => copyLink()); copy.hidden = true;
  const duration = node('p', 'daily-duration'); duration.hidden = true; duration.setAttribute('role', 'status');
  const coverage = node('p', 'daily-coverage'); coverage.hidden = true;
  actions.append(draw, copy, change, easier, currentDifficulty, harder); section.append(heading, filters, result, duration, actions);
  let current: DailyDrawResult['problem'] | null = null;
  let renderedRevision = -1;
  let clistRefreshButton: HTMLButtonElement | null = null;
  let clistRefreshStatus: HTMLSpanElement | null = null;
  function syncClistRefresh() {
    if (clistRefreshButton) {
      const busy = pendingClistRefresh?.generation === generation && pendingClistRefresh.url === current?.url;
      clistRefreshButton.disabled = busy;
      clistRefreshButton.textContent = busy ? '查询中…' : '刷新评分';
    }
    if (clistRefreshStatus) {
      clistRefreshStatus.hidden = !clistRefreshFeedback;
      clistRefreshStatus.textContent = clistRefreshFeedback?.message ?? '';
      clistRefreshStatus.title = clistRefreshFeedback?.detail ?? '';
    }
  }
  async function refreshClistRating(url: string) {
    const bridge = window.notebook;
    if (typeof bridge?.refreshProblemClistRating !== 'function' || generation !== contextGeneration
      || cachedResult?.problem.url !== url || renderedRevision !== resultRevision || pendingClistRefresh) return;
    const request = { generation, url, revision: resultRevision };
    pendingClistRefresh = request; clistRefreshFeedback = null; notifyMount();
    const isCurrent = () => generation === contextGeneration && cachedResult?.problem.url === url && resultRevision === request.revision;
    try {
      const refreshed = await bridge.refreshProblemClistRating(url);
      if (!isCurrent() || !cachedResult) return;
      cachedResult = { ...cachedResult, problem: refreshed.problem }; resultRevision += 1;
      const message = refreshed.message.trim();
      clistRefreshFeedback = message ? { message: message.length > 48 ? `${message.slice(0, 47)}…` : message, detail: message } : null;
    } catch (cause) {
      if (!isCurrent()) return;
      const detail = cause instanceof Error ? cause.message : '评分查询失败，请稍后重试';
      const message = `评分刷新失败：${detail}`;
      clistRefreshFeedback = { message: message.length > 48 ? `${message.slice(0, 47)}…` : message, detail };
    } finally {
      if (pendingClistRefresh === request) pendingClistRefresh = null;
      if (generation === contextGeneration) notifyMount();
    }
  }
  function saveFilters() {
    if (generation !== contextGeneration) return;
    savedFilters.source = source.value; savedFilters.ratingMin = ratingMin.value;
    savedFilters.ratingMax = ratingMax.value;
    savedFilters.luoguDifficultyMin = lgMin.value; savedFilters.luoguDifficultyMax = lgMax.value;
    savedFilters.tags = [...selectedTags];
  }
  function restoreFilters() {
    source.value = savedFilters.source; ratingMin.value = savedFilters.ratingMin;
    ratingMax.value = savedFilters.ratingMax;
    lgMin.value = savedFilters.luoguDifficultyMin; lgMax.value = savedFilters.luoguDifficultyMax;
    selectedTags = new Set(savedFilters.tags);
    tags.textContent = selectedTags.size ? `算法标签…（已选 ${selectedTags.size}）` : '算法标签…';
    updateDifficulty();
  }
  for (const input of [source, ratingMin, ratingMax, lgMin, lgMax]) {
    input.addEventListener('input', saveFilters); input.addEventListener('change', saveFilters);
  }
  function readFilters(): DailyDrawFilters {
    return { source: source.value || undefined, platform: ['CF', 'LG', 'AT', 'NC', 'LC', 'LOJ'].includes(source.value) ? source.value : undefined,
      ratingMin: ratingMin.value ? Number(ratingMin.value) : undefined, ratingMax: ratingMax.value ? Number(ratingMax.value) : undefined,
      luoguDifficultyMin: lgMin.value || undefined, luoguDifficultyMax: lgMax.value || undefined, tags: [...selectedTags] };
  }
  function updateDifficulty() {
    const min = lgMin.value, max = lgMax.value;
    const label = min && max ? min === max ? min : `${min} ～ ${max}` : min ? `≥ ${min}` : max ? `≤ ${max}` : '不限';
    currentDifficulty.textContent = `当前难度：洛谷 ${label}`;
  }
  function shiftDifficulty(delta: number) {
    const min = lgMin.selectedIndex, max = lgMax.selectedIndex, last = luoguLevels.length;
    if (!min && !max) lgMin.selectedIndex = lgMax.selectedIndex = 1;
    else if (min && max) {
      const movement = Math.max(1 - Math.min(min, max), Math.min(last - Math.max(min, max), delta));
      lgMin.selectedIndex = min + movement; lgMax.selectedIndex = max + movement;
    } else {
      const selected = min ? lgMin : lgMax;
      selected.selectedIndex = Math.max(1, Math.min(last, selected.selectedIndex + delta));
    }
    updateDifficulty(); saveFilters();
  }
  function render(value: DailyDrawResult) {
    current = value.problem;
    if (current.clistRating === 0) {
      const zeroEstimate = current.estimatedCfRating === 0 || current.difficultyReference?.basis === 'clist';
      current = { ...current, clistRating: null, clistRatingStatus: 'no-data', ...(zeroEstimate && !current.supplementInfo?.difficulty ? { estimatedCfRating: null, estimatedLuoguDifficulty: null } : {}) };
    }
    renderedRevision = resultRevision; result.replaceChildren();
    clistRefreshButton = null; clistRefreshStatus = null;
    const meta = node('div', 'daily-problem-meta'); meta.append(node('span', 'daily-source', platformName(current.source)));
    const nativeCf = current.source === 'CF' && current.rating != null;
    const referenceCf = !nativeCf && current.estimatedCfRating != null;
    const cfLabel = nativeCf ? `CF 原生 ${current.rating}` : referenceCf ? `CF 参考 ${current.estimatedCfRating}` : current.clistRatingStatus === 'no-data' ? 'CF 参考：无数据' : 'CF 难度：待评级';
    const cf = node('span', `daily-cf ${nativeCf || referenceCf ? 'daily-rating' : 'daily-unrated'}${referenceCf ? ' daily-estimated' : ''}`, cfLabel);
    const cfDifficulty = nativeCf || referenceCf ? Search.difficulty({ platform: 'CF', rating: nativeCf ? current.rating : current.estimatedCfRating }) : null;
    if (cfDifficulty) cf.classList.add('difficulty-badge', `tone-${cfDifficulty.tone}`, ...(cfDifficulty.rank ? [`rank-${cfDifficulty.rank}`] : []));
    cf.title = nativeCf ? 'Codeforces 官方原生 Rating' : referenceCf ? '参考其他平台难度推算的 Codeforces Rating，不是官方评分' : '尚未获取 Codeforces 原生或参考评分';
    const nativeLuogu = current.luoguDifficulty ? luoguDifficultyLabel(current.luoguDifficulty) : '';
    const nativeLuoguLabel = nativeLuogu === '暂无评定' ? '' : nativeLuogu;
    const estimatedLuogu = current.estimatedLuoguDifficulty ? luoguDifficultyLabel(current.estimatedLuoguDifficulty) : '';
    const luogu = node('span', `daily-luogu${!nativeLuoguLabel && estimatedLuogu ? ' daily-estimated' : ''}`,
      nativeLuoguLabel ? `洛谷难度：${nativeLuoguLabel}` : estimatedLuogu ? `洛谷参考：${estimatedLuogu}` : current.clistRatingStatus === 'no-data' ? '洛谷参考：无数据' : '洛谷难度：待评级');
    const luoguDifficulty = Search.difficulty({ platform: 'LG', difficulty: nativeLuoguLabel || estimatedLuogu });
    if (luoguDifficulty.level !== null) luogu.classList.add('difficulty-badge', `tone-${luoguDifficulty.tone}`);
    else luogu.classList.add('daily-unrated');
    meta.append(cf, luogu);
    if (current.clistRating != null) meta.append(node('span', 'daily-rating daily-clist', `CLIST ${current.clistRating}`));
    else if (current.clistRatingStatus === 'not-found') meta.append(node('span', 'daily-unrated daily-clist-status', 'CLIST：未收录'));
    else if (current.clistRatingStatus === 'no-data') meta.append(node('span', 'daily-unrated daily-clist-status', 'CLIST：无数据'));
    else if (current.clistRatingStatus === 'not-configured' || current.clistRatingStatus === 'not-obtained') {
      const status = node('span', 'daily-unrated daily-clist-status', current.clistRatingStatus === 'not-configured' ? 'CLIST：未配置' : 'CLIST：未获取');
      status.title = '尚未取得该题的 CLIST 评分，不代表这道题在 CLIST 未评级'; meta.append(status);
    }
    const clistMetadata = [current.clistRatingCached ? '使用缓存评分' : '', current.clistRatingStale ? '缓存已过期，可刷新' : '',
      current.clistRatingQueriedAt ? `查询时间：${current.clistRatingQueriedAt}` : ''].filter(Boolean).join('；');
    const clistBadge = meta.querySelector<HTMLElement>('.daily-clist, .daily-clist-status');
    if (clistBadge && clistMetadata) clistBadge.title = [clistBadge.title, clistMetadata].filter(Boolean).join('；');
    if (current.clistRatingCached) {
      const cache = node('span', 'daily-clist-cache', current.clistRatingStale ? '缓存·待更新' : '缓存');
      cache.title = clistMetadata; meta.append(cache);
    }
    if (typeof window.notebook?.refreshProblemClistRating === 'function') {
      const url = current.url;
      clistRefreshButton = button('刷新评分', 'button subtle daily-clist-refresh', () => refreshClistRating(url));
      clistRefreshButton.title = '重新查询该题的 CLIST 评分';
      clistRefreshStatus = node('span', 'daily-clist-refresh-status'); clistRefreshStatus.setAttribute('role', 'status');
      meta.append(clistRefreshButton, clistRefreshStatus); syncClistRefresh();
    }
    if (current.source !== 'CF' && current.rating != null) meta.append(node('span', 'daily-rating', `来源评分 ${current.rating}`));
    const footer = node('div', 'daily-problem-footer');
    if (current.id) footer.append(node('span', 'daily-problem-pid', current.id));
    const url = current.url;
    if (url) {
      const link = node('a', 'daily-problem-link', url); link.href = url; link.target = '_blank'; link.rel = 'noreferrer noopener';
      link.addEventListener('click', event => { event.preventDefault(); openExternal(url); }); footer.append(link);
    }
    result.append(node('strong', 'daily-result-label', '抽取结果：'), meta, node('h3', 'daily-problem-title', current.title), footer);
    if (!['CF', 'LG'].includes(current.source) && current.clistRatingStatus === 'not-found' && (referenceCf || (!nativeLuoguLabel && Boolean(estimatedLuogu)))) {
      const warning = node('p', 'daily-difficulty-warning', 'CLIST 未收录：参考难度与实际难度可能存在很大偏差。');
      warning.setAttribute('role', 'note'); result.append(warning);
    }
    const problemTags = [...new Set((current.tags ?? []).filter(tag => tag.trim()))];
    const tagArea = node('div', 'daily-result-tags');
    if (problemTags.length) {
      const tagList = node('div', 'daily-problem-tags'); tagList.id = `daily-result-tags-${generation}-${resultRevision}`;
      const toggle = button('', 'button subtle daily-tags-toggle', () => {
        if (generation !== contextGeneration || renderedRevision !== resultRevision) return;
        resultTagsExpanded = !resultTagsExpanded; syncTags();
      });
      toggle.setAttribute('aria-controls', tagList.id);
      function syncTags() {
        toggle.textContent = resultTagsExpanded ? '收起算法标签' : '显示算法标签';
        toggle.setAttribute('aria-expanded', String(resultTagsExpanded));
        tagList.replaceChildren(); tagList.hidden = !resultTagsExpanded;
        if (resultTagsExpanded) problemTags.forEach(tag => tagList.append(node('span', `tag ${tagColorClass(tag)}`, tag)));
      }
      syncTags(); tagArea.append(toggle, tagList);
    } else tagArea.append(node('span', 'daily-tags-unavailable', '算法标签：未获取'));
    result.append(tagArea);
    if (typeof window.notebook?.getProblemEnrichment === 'function') {
      const url = current.url;
      const supplement = button('补充缺失信息 / AI 建议', 'button subtle daily-enrichment-open', () => openProblemEnrichment(url, () => {
        if (generation !== contextGeneration) return;
        void window.notebook!.getProblemEnrichment(url).then(view => {
          if (generation !== contextGeneration || cachedResult?.problem.url !== url || !view.problem) return;
          cachedResult = { ...cachedResult, problem: view.problem }; resultRevision += 1; notifyMount();
        }).catch(() => { if (generation === contextGeneration) { lastDrawError = '补充已保存，但结果刷新失败，请重新抽题查看'; notifyMount(); } });
      }));
      result.append(supplement);
    }
    if (current.supplementInfo) result.append(node('span', 'daily-supplement-source', current.supplementInfo.source === 'ai' ? 'AI 补充 · 已审核' : '人工补充'));
    const explanation = node('details', 'daily-rating-explanation');
    explanation.append(node('summary', '', '题目信息'));
    if (current.ratingEstimateReason) {
      const reason = current.supplementInfo?.source === 'ai'
        ? current.ratingEstimateReason.replace(/^(?:AI 建议（已确认）：)?AI 建议，待审核（低置信度）：/, 'AI 参考（低置信度）：')
        : current.ratingEstimateReason;
      explanation.append(node('p', 'daily-reference-note', reason));
    }
    if (value.note) explanation.append(node('p', 'daily-problem-note', value.note));
    const diagnostics = value.diagnostics;
    coverage.hidden = !diagnostics;
    if (diagnostics) {
      const mode = { index: '本地索引', online: '在线数据', mixed: '索引与在线数据', scoped: '当前账号/资料库' }[diagnostics.dataMode];
      const platforms = Object.entries(diagnostics.platforms).map(([code, item]) => `${platformName(code)} ${item.count} 题（有标签 ${item.tagged}）`);
      coverage.textContent = `数据覆盖（${mode}）：${platforms.join('；') || '暂未获取平台统计'}；本次候选 ${diagnostics.candidateCount} 题`;
    } else coverage.textContent = '';
    explanation.append(coverage);
    if (current.ratingEstimateReason || value.note || diagnostics) result.append(explanation);
    result.append(loading, error); error.hidden = true; change.hidden = false; copy.hidden = !url;
  }
  function setBusy(value: boolean) {
    draw.disabled = value; change.disabled = value;
    loading.hidden = !value;
    if (value) result.dataset.loading = 'true'; else delete result.dataset.loading;
    result.setAttribute('aria-busy', value ? 'true' : 'false');
  }
  let refreshing = false;
  async function refreshLibrary() {
    if (refreshing || !updateLibrary) return;
    refreshing = true; refresh.disabled = true;
    const label = refresh.textContent;
    refresh.textContent = '更新中…';
    error.hidden = true;
    try {
      const revision = resultRevision, url = cachedResult?.problem.url;
      const report = await updateLibrary();
      if (generation !== contextGeneration) return;
      if (url && typeof window.notebook?.getProblemEnrichment === 'function') {
        try {
          const view = await window.notebook.getProblemEnrichment(url);
          if (generation === contextGeneration && resultRevision === revision && cachedResult?.problem.url === url && view.problem) {
            cachedResult = { ...cachedResult, problem: view.problem }; resultRevision += 1; notifyMount();
          }
        } catch { /* Library sync succeeded; a failed result refresh must retain the displayed problem. */ }
      }
      const entries = Object.entries(report?.platforms ?? {});
      const added = entries.reduce((sum, [, item]) => sum + (typeof item?.added === 'number' ? item.added : 0), 0);
      const failed = entries.filter(([, item]) => item?.status === 'failed').map(([name]) => name);
      refresh.textContent = failed.length ? `已更新 ${added} 题，${failed.join('、')} 失败` : `已更新 ${added} 题`;
      setTimeout(() => { if (!refreshing) refresh.textContent = label; }, 2600);
    } catch (cause) {
      refresh.textContent = label;
      error.textContent = cause instanceof Error ? cause.message : '题库更新失败';
      error.hidden = false;
    } finally {
      refreshing = false;
      refresh.disabled = false;
    }
  }
  function syncDrawState() {
    if (cachedResult && (current !== cachedResult.problem || renderedRevision !== resultRevision)) render(cachedResult);
    empty.hidden = Boolean(cachedResult || pendingRequest || lastDrawError);
    error.textContent = lastDrawError; error.hidden = !lastDrawError;
    duration.hidden = lastElapsedMs === null || pendingRequest !== null;
    duration.textContent = lastElapsedMs === null ? '' : `抽题耗时：${formatDuration(lastElapsedMs)}${lastDrawError ? '（本次未完成）' : ''}`;
    duration.title = lastElapsedMs === null ? '' : `客户端总耗时 ${lastElapsedMs.toFixed(1)} 毫秒（从发起抽题到请求完成）${lastServiceDurationMs === null ? '' : `；服务端处理 ${lastServiceDurationMs.toFixed(1)} 毫秒`}`;
    setBusy(pendingRequest !== null); syncClistRefresh();
  }
  async function drawProblem(excludeCurrent = false) {
    if (pendingRequest || generation !== contextGeneration) return;
    saveFilters();
    const filters = readFilters();
    if (excludeCurrent && current) filters.excludedIds = [...new Set([current.id, current.url].filter(Boolean))];
    lastDrawError = ''; lastElapsedMs = null; lastServiceDurationMs = null;
    resultTagsExpanded = false; resultRevision += 1; pendingClistRefresh = null; clistRefreshFeedback = null;
    const startedAt = performance.now();
    pendingRequest = Promise.resolve().then(() => drawApi(filters)).then(value => {
      if (generation === contextGeneration) {
        cachedResult = value; resultRevision += 1;
        const serviceDurationMs = value.diagnostics?.durationMs;
        lastServiceDurationMs = typeof serviceDurationMs === 'number' && Number.isFinite(serviceDurationMs) ? serviceDurationMs : null;
      }
    }, cause => {
      if (generation === contextGeneration) lastDrawError = cause instanceof Error ? cause.message : '抽题失败，请稍后重试。';
    }).finally(() => {
      if (generation !== contextGeneration) return;
      lastElapsedMs = Math.max(0, performance.now() - startedAt);
      pendingRequest = null;
      notifyMount();
    });
    notifyMount();
    await pendingRequest;
  }
  async function copyLink() {
    if (!current?.url) return;
    try { await navigator.clipboard.writeText(current.url); copy.textContent = '已复制'; setTimeout(() => { copy.textContent = '复制链接'; }, 1400); }
    catch (_) { error.textContent = '复制失败，请手动打开题目链接。'; error.hidden = false; }
  }
  restoreFilters();
  latestMount = { section, sync: syncDrawState, restoreFilters, draw: () => drawProblem() };
  syncDrawState();
  if (!cachedResult && !pendingRequest && autoDraw && !autoDrawStarted) {
    autoDrawStarted = true;
    setTimeout(() => {
      if (generation !== contextGeneration) return;
      if (latestMount?.section.isConnected && !cachedResult && !pendingRequest) void latestMount.draw();
      else if (!cachedResult && !pendingRequest) autoDrawStarted = false;
    }, 260);
  }
  return section;
}
export const DailyProblem = { create };
