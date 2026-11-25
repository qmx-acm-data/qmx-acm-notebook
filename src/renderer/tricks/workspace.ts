import { isTrickTier, trickTierGuide, trickTiers, type Trick, type SaveTrickInput, type DeleteTrickInput, type TrickRecommendation, type TrickTier } from '../../shared/models/trick.js';
import { tagColorClass } from '../lib/tag-color.js';

export interface TrickContext {
  sourceKey: string;
  repo: string;
  accountId: string | null;
  displayName: string;
  canCreate: boolean;
  admin: boolean;
}
export interface TrickAlgorithmOption {
  id: string;
  label: string;
  aliases?: readonly string[];
  legacyIds?: readonly string[];
  tags?: readonly string[];
}
export interface TrickWorkspaceOptions {
  host: HTMLElement;
  getItems: () => readonly Trick[];
  getAlgorithms?: () => readonly TrickAlgorithmOption[];
  setItems: (items: Trick[]) => void;
  getContext: () => TrickContext;
  getBusy: () => boolean;
  setBusy: (busy: boolean) => void;
  save: (input: SaveTrickInput) => Promise<Trick>;
  remove: (input: DeleteTrickInput) => Promise<unknown>;
  renderMarkdown: (host: HTMLElement, source: string) => void;
  toast: (message: string) => void;
  isFavorite?: (item: Trick) => boolean;
  onToggleFavorite?: (item: Trick) => Promise<void>;
  errorMessage: (error: unknown) => string;
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function action(label: string, cls: string, run: () => void): HTMLButtonElement {
  const node = el('button', cls, label); node.type = 'button'; node.addEventListener('click', run); return node;
}
function authorName(item: Trick): string { return item.author.name || item.author.login || '匿名作者'; }
function sameContext(a: TrickContext, b: TrickContext): boolean { return a.sourceKey === b.sourceKey && a.accountId === b.accountId; }
const bytes = (value: string) => new TextEncoder().encode(value).length;
const maxPrerequisites = 8;
const maxReasonBytes = 600;
const maxDraftReasonBytes = 2400;
interface TrickDraft { clientId: string; baseSha: string; title: string; introduction: string; body: string; recommendation?: TrickRecommendation | null }
function readDraftRecommendation(value: unknown): TrickRecommendation | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object' || !value) return undefined;
  const row = value as Record<string, unknown>;
  const ids = row.prerequisiteIds;
  if (!isTrickTier(row.tier) || typeof row.reason !== 'string' || bytes(row.reason) > maxDraftReasonBytes || !Array.isArray(ids) || ids.length > maxPrerequisites) return undefined;
  const prerequisiteIds: string[] = [];
  for (const id of ids as unknown[]) {
    if (typeof id !== 'string' || !/^[\p{L}\p{N}._:-]{1,1000}$/u.test(id) || prerequisiteIds.includes(id)) return undefined;
    prerequisiteIds.push(id);
  }
  return { tier: row.tier, reason: row.reason, prerequisiteIds };
}
function draftKey(context: TrickContext, path = 'new'): string { return `qmx.trick-draft.v1:${JSON.stringify([context.sourceKey, context.accountId, path])}`; }
function readDraft(key: string): TrickDraft | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    if (typeof row.clientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.clientId) || typeof row.baseSha !== 'string' || typeof row.title !== 'string' || typeof row.introduction !== 'string' || typeof row.body !== 'string' || bytes(row.title) > 1000 || bytes(row.introduction) > 10000 || bytes(row.body) > 1000000) return null;
    const recommendation = readDraftRecommendation(row.recommendation);
    return { clientId: row.clientId, baseSha: row.baseSha, title: row.title, introduction: row.introduction, body: row.body, ...(recommendation !== undefined ? { recommendation } : {}) };
  } catch { return null; }
}

function algorithmCatalog(options: readonly TrickAlgorithmOption[]) {
  const canonical = new Map(options.map(option => [option.id, option]));
  const lookup = new Map(canonical);
  for (const option of canonical.values()) {
    for (const id of option.legacyIds || []) if (!lookup.has(id)) lookup.set(id, option);
  }
  return { options: Array.from(canonical.values()), lookup };
}
type AlgorithmCatalog = ReturnType<typeof algorithmCatalog>;
function algorithmLabel(id: string, catalog: AlgorithmCatalog): string { return catalog.lookup.get(id)?.label || `未识别算法：${id}`; }
function algorithmTags(values: readonly string[] = []): HTMLElement | null {
  if (!values.length) return null;
  const tags = el('span', 'trick-algorithm-tags');
  for (const tag of values) tags.append(el('span', `tag ${tagColorClass(tag)}`, tag));
  return tags;
}
function canonicalPrerequisites(ids: readonly string[], catalog: AlgorithmCatalog): string[] {
  return Array.from(new Set(ids.map(id => catalog.lookup.get(id)?.id ?? id)));
}

function algorithmPicker(config: {
  className: string;
  label: string;
  catalog: AlgorithmCatalog;
  selected: Set<string>;
  query?: string;
  max?: number;
  onSearch?: (query: string) => void;
  onChange: () => void;
}) {
  const { catalog, selected, max } = config;
  const group = el('div', `trick-algorithm-picker ${config.className}`);
  group.setAttribute('role', 'group'); group.setAttribute('aria-label', config.label);
  const input = el('input', 'trick-algorithm-search'); input.type = 'search'; input.value = config.query || '';
  input.setAttribute('aria-label', `搜索${config.label}`); input.placeholder = '搜索算法名称、别名或标签';
  const header = el('div', 'trick-algorithm-heading'), count = el('span', 'trick-algorithm-count');
  count.setAttribute('aria-live', 'polite'); header.append(el('span', '', config.label), count);
  const chips = el('div', 'trick-algorithm-chips'), choices = el('div', 'trick-algorithm-options');
  const entries = catalog.options.map(option => ({ option, terms: [option.label, option.id, ...(option.aliases || []), ...(option.legacyIds || []), ...(option.tags || [])].join(' ').toLocaleLowerCase() }));
  function renderChoices(): void {
    const scroll = choices.scrollTop;
    const needle = input.value.trim().toLocaleLowerCase();
    const matching = entries.filter(({ terms }) => terms.includes(needle));
    choices.replaceChildren();
    if (!matching.length) choices.append(el('p', 'trick-algorithm-empty', entries.length ? '没有匹配的算法' : '暂无可选算法'));
    for (const { option } of matching) {
      const label = el('label', 'trick-algorithm-choice');
      const check = el('input', 'trick-algorithm-option'); check.type = 'checkbox'; check.dataset.algorithmId = option.id;
      check.checked = selected.has(option.id); check.disabled = !check.checked && max !== undefined && selected.size >= max;
      check.addEventListener('change', () => {
        if (check.checked) selected.add(option.id); else selected.delete(option.id);
        renderSelection();
        for (const node of choices.querySelectorAll<HTMLInputElement>('.trick-algorithm-option')) node.disabled = !node.checked && max !== undefined && selected.size >= max;
        config.onChange();
      });
      const title = el('span', 'trick-algorithm-choice-title', option.label);
      const tags = algorithmTags(option?.tags);
      if (tags) title.append(tags);
      label.append(check, title); choices.append(label);
    }
    choices.scrollTop = scroll;
  }
  function renderSelection(): void {
    count.textContent = max === undefined ? `已选 ${selected.size} 项` : `${selected.size} / ${max}`;
    chips.replaceChildren();
    for (const id of selected) {
      const label = algorithmLabel(id, catalog);
      const chip = action('', 'trick-algorithm-remove', () => {
        selected.delete(id); refresh(); input.focus(); config.onChange();
      });
      chip.dataset.algorithmId = id; chip.setAttribute('aria-label', `移除${label}`);
      if (!catalog.lookup.has(id)) chip.classList.add('trick-prerequisite-unrecognized');
      const icon = el('span', '', '×'); icon.setAttribute('aria-hidden', 'true');
      chip.append(el('span', '', label), icon); chips.append(chip);
    }
  }
  function refresh(): void { renderSelection(); renderChoices(); }
  function showChoices(focused: boolean): void { choices.hidden = !focused && !input.value.trim(); }
  input.addEventListener('input', () => { config.onSearch?.(input.value); choices.scrollTop = 0; renderChoices(); showChoices(true); });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
  choices.tabIndex = -1;
  group.addEventListener('focusin', () => showChoices(true));
  group.addEventListener('focusout', event => showChoices(event.relatedTarget instanceof Node && group.contains(event.relatedTarget)));
  group.append(header, chips, input, choices); refresh(); showChoices(false);
  return { group, refresh, clearSearch: () => { input.value = ''; showChoices(group.contains(document.activeElement)); } };
}

function tierLabel(tier: TrickTier): string {
  return `${tier} 级 · ${trickTierGuide[tier].label}`;
}
function tierBadge(tier: TrickTier): HTMLElement {
  const badge = el('span', 'trick-tier-badge', `${tier} 级`); badge.dataset.tier = tier;
  badge.title = `${tierLabel(tier)}：${trickTierGuide[tier].description}`;
  return badge;
}
function renderTierGuide(): HTMLDetailsElement {
  const guide = el('details', 'trick-tier-guide');
  guide.append(el('summary', '', '等级说明'));
  const definitions = el('dl', 'trick-tier-definitions');
  for (const tier of trickTiers) {
    const definition = el('div', 'trick-tier-definition');
    definition.append(el('dt', '', tierLabel(tier)), el('dd', '', trickTierGuide[tier].description));
    definitions.append(definition);
  }
  const unrated = el('div', 'trick-tier-definition');
  unrated.append(el('dt', '', '未评级'), el('dd', '', '尚无维护者评级，不属于 S–E 中的任何一档。'));
  definitions.append(unrated);
  guide.append(el('p', '', '等级表示满足前置后的学习优先级，不是算法难度。'), definitions);
  return guide;
}

/** A compact directory; Markdown is mounted only after opening a trick. */
export function createTrickWorkspace(options: TrickWorkspaceOptions) {
  const host = options.host;
  host.classList.remove('section-placeholder'); host.classList.add('tricks-workspace'); host.setAttribute('aria-label', 'Trick 集');
  let scope = '', query = '', selected: string | null = null, listScroll = 0;
  let view: 'latest' | 'ranking' = 'latest', learnedQuery = '', readyOnly = false, showTierGuide = false;
  const learned = new Set<string>();
  let editor: HTMLDialogElement | null = null;
  let list: HTMLElement | null = null;
  let search: HTMLInputElement | null = null;
  function getCatalog(): AlgorithmCatalog { return algorithmCatalog(options.getAlgorithms?.() || []); }
  function items(): Trick[] {
    const source = options.getContext().sourceKey;
    return options.getItems().filter(item => item.sourceKey === source)
      .slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path));
  }
  function canEdit(item: Trick): boolean {
    const context = options.getContext();
    return context.canCreate && (context.admin || String(item.authorId) === context.accountId);
  }
  function author(item: Trick): HTMLElement {
    const row = el('span', 'trick-author'); row.append(el('span', 'trick-avatar', authorName(item).slice(0, 1)), el('span', '', authorName(item))); return row;
  }
  function reset(): void {
    scope = ''; query = ''; selected = null; listScroll = 0;
    view = 'latest'; learnedQuery = ''; readyOnly = false; showTierGuide = false; learned.clear();
  }
  function closeDetail(): void {
    const previous = selected; selected = null; render();
    const target = Array.from(host.querySelectorAll<HTMLButtonElement>('.trick-row')).find(row => row.dataset.path === previous);
    target?.focus({ preventScroll: true }); window.scrollTo({ top: listScroll });
  }
  function open(item: Trick): void {
    listScroll = window.scrollY; selected = item.path; render();
    host.querySelector<HTMLButtonElement>('.trick-back')?.focus({ preventScroll: true });
    host.scrollIntoView({ block: 'start' });
  }
  function showDelete(item: Trick): void {
    if (!canEdit(item) || options.getBusy()) return;
    const context = options.getContext(), dialog = el('dialog', 'trick-delete-dialog'); dialog.setAttribute('aria-label', '删除 Trick');
    const heading = el('h2', '', '删除 Trick？');
    const message = el('p', '', `将从 ${context.repo} 删除「${item.title}」，同步后队员也将不再看到它。`);
    const error = el('p', 'form-error'); error.hidden = true; error.setAttribute('role', 'alert');
    let saving = false;
    const close = () => { if (!saving) { dialog.close(); dialog.remove(); host.querySelector<HTMLButtonElement>('.trick-delete')?.focus(); } };
    const controls = el('div', 'trick-form-actions'); controls.append(action('取消', 'button secondary', close));
    const confirm = action('确认删除', 'button danger', () => { void (async () => {
      if (saving || options.getBusy()) return;
      if (!sameContext(context, options.getContext()) || !canEdit(item)) { error.textContent = '账号或资料库已变化，请关闭后重试。'; error.hidden = false; return; }
      saving = true; options.setBusy(true); error.hidden = true; controls.querySelectorAll('button').forEach(node => { node.disabled = true; });
      try {
        await options.remove({ repo: context.repo, sourceKey: context.sourceKey, path: item.path, sha: item.sha });
        if (sameContext(context, options.getContext())) { options.setItems(options.getItems().filter(row => row.path !== item.path)); selected = null; }
        saving = false; close(); render(); options.toast('Trick 已删除');
      } catch (cause) { error.textContent = options.errorMessage(cause); error.hidden = false; }
      finally { saving = false; options.setBusy(false); controls.querySelectorAll('button').forEach(node => { node.disabled = false; }); }
    })(); });
    controls.append(confirm); dialog.append(heading, message, error, controls); document.body.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }); dialog.showModal();
  }
  function edit(item?: Trick): void {
    const context = options.getContext();
    if (options.getBusy() || editor?.open || !context.canCreate || item && !canEdit(item)) return;
    const previousFocus = document.activeElement, dialog = el('dialog', 'trick-editor'); editor = dialog;
    const key = draftKey(context, item?.path), draft = readDraft(key);
    const clientId = item?.clientId || draft?.clientId || crypto.randomUUID();
    let baseSha = draft?.baseSha ?? item?.sha ?? '';
    const staleDraft = !!item && !!draft && draft.baseSha !== item.sha;
    dialog.setAttribute('aria-label', item ? '编辑 Trick' : '新增 Trick');
    const form = el('form', 'trick-form'); form.noValidate = true;
    const heading = el('div', 'trick-editor-heading'); heading.append(el('h2', '', item ? '编辑 Trick' : '新增 Trick'));
    let saving = false;
    const close = (keepDraft = true) => { if (saving) return; if (keepDraft && !storeDraft()) return; dialog.close(); dialog.remove(); editor = null; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true }); };
    heading.append(action('×', 'icon-button', () => close())); heading.lastElementChild?.setAttribute('aria-label', '关闭编辑');
    const destination = el('p', 'trick-editor-destination', `共享到 ${context.repo} · 作者：${item ? authorName(item) : context.displayName}`);
    function field(label: string, control: HTMLInputElement | HTMLTextAreaElement): HTMLLabelElement {
      const row = el('label', 'field'); row.append(el('span', '', label), control); return row;
    }
    const title = el('input'); title.name = 'title'; title.maxLength = 180; title.required = true; title.value = draft?.title ?? item?.title ?? ''; title.placeholder = '用一句话说清这个技巧';
    const intro = el('textarea'); intro.name = 'introduction'; intro.rows = 2; intro.maxLength = 2000; intro.required = true; intro.value = draft?.introduction ?? item?.introduction ?? ''; intro.placeholder = '列表里展示的简短说明';
    const body = el('textarea'); body.name = 'body'; body.rows = 14; body.required = true; body.value = draft?.body ?? item?.body ?? ''; body.placeholder = '支持 Markdown、代码块和公式。写下关键观察、适用条件与示例。';
    const bodyHeading = el('div', 'trick-body-heading'); bodyHeading.append(el('span', '', '具体内容 · Markdown'));
    const previewToggle = action('预览', 'button subtle', () => {
      preview.hidden = !preview.hidden; body.hidden = !preview.hidden;
      previewToggle.textContent = preview.hidden ? '预览' : '继续编辑';
      if (!preview.hidden) options.renderMarkdown(preview, body.value);
    }); bodyHeading.append(previewToggle);
    const preview = el('div', 'markdown-body trick-editor-preview'); preview.hidden = true;
    const bodyField = el('section', 'trick-body-field'); body.setAttribute('aria-label', '具体内容'); bodyField.append(bodyHeading, body, preview);
    const error = el('p', 'form-error'); error.hidden = true; error.setAttribute('role', 'alert');
    const review = context.admin ? recommendationEditor() : null;
    function recommendationEditor() {
      const catalog = getCatalog(), initial = draft?.recommendation === undefined ? item?.recommendation : draft.recommendation;
      let touched = draft?.recommendation !== undefined;
      let clearRequested = draft?.recommendation === null;
      const prerequisites = new Set(canonicalPrerequisites(initial?.prerequisiteIds || [], catalog));
      const section = el('fieldset', 'trick-recommendation-editor');
      section.append(el('legend', '', '维护者推荐'));
      const tier = el('select'); tier.name = 'recommendationTier';
      for (const value of ['', ...trickTiers] as const) { const choice = el('option', '', value ? tierLabel(value) : '未评级'); choice.value = value; tier.append(choice); }
      tier.value = initial?.tier || '';
      const tierHint = el('p', 'trick-tier-hint'); tierHint.id = 'trick-editor-tier-hint';
      tier.setAttribute('aria-describedby', tierHint.id);
      const tierField = el('label', 'field'); tierField.append(el('span', '', '推荐等级'), tier);
      const clear = action('清除推荐', 'button subtle trick-recommendation-clear', () => {
        tier.value = ''; clearRequested = true; updateTier(); tier.focus();
      });
      const top = el('div', 'trick-recommendation-editor-top'); top.append(tierField, clear);
      const controls = el('div', 'trick-recommendation-fields');
      const reason = el('input'); reason.name = 'recommendationReason'; reason.type = 'text'; reason.maxLength = maxReasonBytes; reason.value = initial?.reason || ''; reason.required = true;
      const reasonCount = el('span', 'trick-recommendation-reason-count');
      const reasonField = field('推荐理由', reason); reasonField.append(reasonCount);
      function renderReasonCount(): void { reasonCount.textContent = `${bytes(reason.value.trim())} / ${maxReasonBytes} 字节`; }
      reason.addEventListener('input', () => { touched = true; renderReasonCount(); storeDraft(); });
      const picker = algorithmPicker({ className: 'trick-prerequisite-picker', label: '前置算法', catalog, selected: prerequisites, max: maxPrerequisites, onChange: () => { touched = true; storeDraft(); } });
      function renderTier(): void {
        controls.hidden = !tier.value; clear.hidden = !item && !tier.value; clear.disabled = clearRequested && !tier.value;
        tierHint.textContent = isTrickTier(tier.value) ? trickTierGuide[tier.value].description : clearRequested ? '保存后将清除已有推荐。' : '未评级不等同于 E 级。';
      }
      function updateTier(): void {
        touched = true;
        if (!tier.value) { prerequisites.clear(); picker.clearSearch(); picker.refresh(); reason.value = ''; renderReasonCount(); }
        renderTier(); storeDraft();
      }
      function recommendation(): TrickRecommendation | null | undefined {
        if (!touched) return undefined;
        if (!isTrickTier(tier.value)) return item?.recommendation || clearRequested ? null : undefined;
        return { tier: tier.value, prerequisiteIds: Array.from(prerequisites), reason: reason.value };
      }
      function validate(value: TrickRecommendation): string {
        if (!value.reason || bytes(value.reason) > maxReasonBytes || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value.reason)) return '请填写单行推荐理由，最多 600 字节。';
        if (value.prerequisiteIds.length > maxPrerequisites) return '最多选择 8 项前置算法。';
        if (value.prerequisiteIds.some(id => !getCatalog().lookup.has(id))) return '请移除未识别的前置算法后再保存推荐。';
        return '';
      }
      tier.addEventListener('change', updateTier); renderTier(); renderReasonCount();
      controls.append(picker.group, reasonField); section.append(top, tierHint, controls);
      return { section, recommendation, validate };
    }
    const draftNotice = el('section', 'trick-draft-notice');
    draftNotice.hidden = !draft;
    draftNotice.append(el('p', '', staleDraft ? '已恢复本机草稿，但远端版本已更新。请先对照最新内容，再确认使用草稿保存。' : '已恢复本机草稿。关闭编辑会保留输入，仅在发布成功或主动丢弃后清除。'));
    const acceptLatest = el('input'); acceptLatest.type = 'checkbox'; acceptLatest.setAttribute('aria-label', '已核对最新远端，使用草稿保存');
    if (staleDraft && item) {
      const compare = el('details'), summary = el('summary', '', '查看最新远端内容'), latest = el('pre', 'trick-conflict-latest', `${item.title}\n\n${item.introduction}\n\n${item.body}`); compare.append(summary);
      if (review) compare.append(renderRecommendation(item.recommendation));
      const consent = el('label', 'checkbox-field'); consent.append(acceptLatest, el('span', '', '已核对最新远端，使用草稿保存')); compare.append(latest); draftNotice.append(compare, consent);
    }
    const controls = el('div', 'trick-form-actions'), cancel = action('保存草稿并关闭', 'button secondary', () => close()), submit = el('button', 'button primary', item ? '保存修改' : '发布 Trick'); submit.type = 'submit';
    controls.append(action('丢弃草稿', 'button subtle', () => { try { localStorage.removeItem(key); } catch { /* The in-memory editor can still be closed explicitly. */ } close(false); }), cancel, submit);
    function storeDraft(): boolean {
      const recommendation = review ? review.recommendation() : draft?.recommendation;
      if (bytes(title.value) > 1000 || bytes(intro.value) > 10000 || bytes(body.value) > 1000000 || recommendation && bytes(recommendation.reason) > maxDraftReasonBytes) {
        error.textContent = '内容超过草稿保存上限，请先缩短或复制到其他位置。当前编辑仍保留，不能直接保存草稿关闭。'; error.hidden = false; return false;
      }
      try { localStorage.setItem(key, JSON.stringify({ clientId, baseSha, title: title.value, introduction: intro.value, body: body.value, recommendation })); return true; }
      catch { error.textContent = '本机草稿存储不可用，请复制内容后再丢弃关闭。'; error.hidden = false; return false; }
    }
    [title, intro, body].forEach(control => control.addEventListener('input', storeDraft));
    form.append(heading, destination, draftNotice, field('标题', title), field('简介', intro));
    if (review) form.append(review.section);
    form.append(bodyField, error, controls); dialog.append(form); document.body.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    form.addEventListener('submit', event => { event.preventDefault(); void (async () => {
      if (saving || options.getBusy()) return;
      const currentContext = options.getContext();
      const input = { title: title.value.trim(), introduction: intro.value.trim(), body: body.value };
      const draftRecommendation = review?.recommendation();
      const recommendation = draftRecommendation ? { ...draftRecommendation, prerequisiteIds: canonicalPrerequisites(draftRecommendation.prerequisiteIds, getCatalog()), reason: draftRecommendation.reason.trim() } : draftRecommendation;
      let problem = '';
      if (!sameContext(context, currentContext) || !currentContext.canCreate || item && !canEdit(item)) problem = '账号、资料库或编辑权限已变化，草稿仍保留，请重新打开。';
      else if (recommendation !== undefined && !currentContext.admin) problem = '推荐编辑权限已变化，草稿仍保留，请重新打开。';
      else if (staleDraft && !acceptLatest.checked) problem = '远端版本已变化，请先核对最新内容并勾选确认。';
      else if (!input.title || !input.introduction || !input.body.trim()) problem = '请填写标题、简介和具体内容。';
      else if (bytes(input.title) > 600 || bytes(input.introduction) > 6000) problem = '标题最多 600 字节，简介最多 6000 字节。';
      else if (bytes(input.body) > 1000000) problem = '具体内容最多 1000000 字节。';
      else if (review && recommendation) problem = review.validate(recommendation);
      if (problem) { error.textContent = problem; error.hidden = false; return; }
      if (staleDraft && acceptLatest.checked && item) baseSha = item.sha;
      if (!storeDraft()) return;
      saving = true; options.setBusy(true); error.hidden = true;
      const enabled = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | HTMLSelectElement>('input:enabled,textarea:enabled,button:enabled,select:enabled');
      enabled.forEach(node => { node.disabled = true; });
      try {
        const saved = await options.save({ ...input, clientId, repo: context.repo, sourceKey: context.sourceKey, ...(item ? { path: item.path, sha: baseSha } : {}), ...(recommendation !== undefined ? { recommendation } : {}) });
        if (sameContext(context, options.getContext())) { options.setItems([saved, ...options.getItems().filter(row => row.path !== saved.path)]); selected = saved.path; }
        try { localStorage.removeItem(key); } catch { /* A successful server save remains authoritative. */ }
        saving = false; close(false); render(); options.toast(item ? 'Trick 已更新' : 'Trick 已发布');
      } catch (cause) { error.textContent = options.errorMessage(cause); error.hidden = false; }
      finally { saving = false; options.setBusy(false); enabled.forEach(node => { node.disabled = false; }); }
    })(); });
    dialog.showModal(); title.focus();
  }
  function dependencyGraph(item: Trick, ids: readonly string[], catalog: AlgorithmCatalog): HTMLElement {
    const graph = el('div', 'trick-dependency-graph');
    const sources = el('ul', 'trick-dependency-sources'); sources.setAttribute('aria-label', '前置算法');
    const target = el('div', 'trick-dependency-target');
    const counter = el('span', 'trick-dependency-counter'); counter.setAttribute('role', 'status');
    const progress = el('progress', 'trick-dependency-progress'); progress.max = ids.length;
    progress.setAttribute('aria-label', '已满足的前置算法');
    target.append(el('span', 'trick-dependency-target-label', '当前 Trick'), el('strong', 'trick-dependency-title', item.title), counter, progress);
    function updateProgress(): void {
      const met = ids.filter(id => learned.has(id) && catalog.lookup.has(id)).length;
      counter.textContent = met === ids.length ? `前置已满足 ${met} / ${ids.length}` : `已满足 ${met} / ${ids.length}`;
      progress.value = met;
      target.dataset.ready = String(met === ids.length);
    }
    for (const id of ids) {
      const option = catalog.lookup.get(id);
      const row = el('li', 'trick-dependency-source');
      const node = option ? el('label', 'trick-dependency-node') : el('div', 'trick-dependency-node trick-prerequisite-unrecognized');
      const name = el('span', 'trick-dependency-name', option?.label ?? `未识别算法：${id}`);
      const state = el('span', 'trick-dependency-state');
      node.dataset.algorithmId = id;
      if (option) {
        const check = el('input'); check.type = 'checkbox'; check.checked = learned.has(id);
        check.setAttribute('aria-label', `已学：${option.label}`);
        const updateNode = () => { row.dataset.state = check.checked ? 'learned' : 'pending'; state.textContent = check.checked ? '已学' : '未学'; };
        updateNode();
        check.addEventListener('change', () => {
          if (check.checked) learned.add(id); else learned.delete(id);
          updateNode(); updateProgress();
        });
        node.append(check);
      } else {
        row.dataset.state = 'unknown'; state.textContent = '目录中未找到';
      }
      const description = el('span', 'trick-dependency-description'); description.append(name);
      const tags = algorithmTags(option?.tags);
      if (tags) description.append(tags);
      node.append(description, state);
      const edge = el('span', 'trick-dependency-edge'); edge.setAttribute('aria-hidden', 'true');
      row.append(node, edge); sources.append(row);
    }
    const join = el('span', 'trick-dependency-join'); join.setAttribute('aria-hidden', 'true');
    graph.append(sources, join, target); updateProgress();
    return graph;
  }
  function renderRecommendation(recommendation?: TrickRecommendation, item?: Trick): HTMLElement {
    const block = el('section', 'trick-recommendation'); block.setAttribute('aria-label', '维护者推荐');
    const heading = el('div', 'trick-recommendation-heading'); heading.append(el('strong', '', '维护者推荐'));
    block.append(heading);
    if (!recommendation) { heading.append(el('span', 'trick-recommendation-unrated', '未评级')); return block; }
    heading.append(tierBadge(recommendation.tier), el('span', '', trickTierGuide[recommendation.tier].label));
    const catalog = getCatalog(), ids = canonicalPrerequisites(recommendation.prerequisiteIds, catalog);
    if (item && ids.length) {
      const prerequisites = el('section', 'trick-dependency'); prerequisites.setAttribute('aria-label', '前置算法依赖图');
      prerequisites.append(el('h3', '', '前置算法'), dependencyGraph(item, ids, catalog));
      block.append(prerequisites);
    } else {
      const prerequisites = el('div', 'trick-prerequisites');
      prerequisites.append(el('strong', '', '前置算法'));
      if (!ids.length) prerequisites.append(el('span', '', '无'));
      for (const id of ids) {
        const tag = el('span', 'trick-prerequisite', algorithmLabel(id, catalog)); tag.dataset.algorithmId = id;
        if (!catalog.lookup.has(id)) tag.classList.add('trick-prerequisite-unrecognized');
        prerequisites.append(tag);
      }
      block.append(prerequisites);
    }
    const reason = el('p', 'trick-recommendation-reason'); reason.append(el('strong', '', '推荐理由'), el('span', '', recommendation.reason));
    block.append(reason); return block;
  }
  type DirectoryEntry = { item: Trick; tags: readonly string[] };
  function renderDirectory(visible: readonly DirectoryEntry[], numbered: boolean): HTMLUListElement {
    const rows = el('ul', 'tricks-directory');
    visible.forEach(({ item, tags }, index) => {
      const li = el('li'), row = action('', 'trick-row', () => open(item)); row.dataset.path = item.path;
      const tier = item.recommendation?.tier;
      row.setAttribute('aria-label', `打开 ${item.title}，作者 ${authorName(item)}${tier ? `，${tierLabel(tier)}` : ''}${tags.length ? `，算法标签：${tags.join('、')}` : ''}`);
      const titleCell = el('span', 'trick-row-title-cell');
      const title = el('span', 'trick-row-title', item.title); title.title = item.title;
      titleCell.append(title); if (tier) titleCell.append(tierBadge(tier));
      const tagCell = el('span', 'trick-row-prerequisites');
      if (tags.length) {
        tagCell.title = tags.join('、');
        const chips = algorithmTags(tags.slice(0, 2));
        if (chips) { chips.classList.add('trick-row-tags'); tagCell.append(chips); }
        if (tags.length > 2) tagCell.append(el('span', 'trick-row-extra trick-row-extra-wide', `+${tags.length - 2}`));
        if (tags.length > 1) tagCell.append(el('span', 'trick-row-extra trick-row-extra-narrow', `+${tags.length - 1}`));
      }
      const intro = el('span', 'trick-row-intro', item.introduction); intro.title = item.introduction;
      if (numbered) row.append(el('span', 'trick-row-number', String(index + 1).padStart(2, '0')));
      row.append(titleCell, tagCell, author(item), intro, el('span', 'trick-row-arrow', '↗'));
      li.append(row); rows.append(li);
    });
    return rows;
  }
  function renderRows(): void {
    if (!list) return;
    list.replaceChildren();
    const value = query.trim().toLocaleLowerCase(), filtering = view === 'ranking' && readyOnly;
    const all = items(), catalog = getCatalog();
    const visible: DirectoryEntry[] = [];
    for (const item of all) {
      const prerequisites = (item.recommendation?.prerequisiteIds ?? []).map(id => catalog.lookup.get(id));
      if (filtering && (!item.recommendation || prerequisites.some(option => !option || !learned.has(option.id)))) continue;
      const tags = [...new Set(prerequisites.flatMap(option => option?.tags ?? []))];
      if (!`${item.title} ${authorName(item)} ${item.introduction} ${tags.join(' ')}`.toLocaleLowerCase().includes(value)) continue;
      visible.push({ item, tags });
    }
    const count = host.querySelector('.tricks-count'); if (count) count.textContent = value || filtering ? `${visible.length} / ${all.length} 条` : `${all.length} 条`;
    if (!visible.length) {
      const empty = el('div', 'tricks-empty');
      if (filtering && all.length) empty.append(el('h3', '', '没有符合已学条件的 Trick'), el('p', '', '可调整已学算法、搜索词，或关闭按已学筛选。'));
      else if (value) empty.append(el('h3', '', '没有匹配的 Trick'), el('p', '', '试试其他关键词或算法标签。'));
      else {
        empty.append(el('h3', '', '还没有 Trick'), el('p', '', '把解题时的一个小观察，整理成队友也能读懂的技巧。'));
        if (!options.getContext().canCreate) empty.append(el('p', '', '同步当前资料库，或使用有写入权限的 GitHub 账号发布。'));
      }
      list.append(empty); return;
    }
    const head = el('div', 'tricks-columns'); head.setAttribute('aria-hidden', 'true');
    if (view === 'latest') head.append(el('span', 'trick-column-number', '#'));
    head.append(el('span', 'trick-column-title', '标题'), el('span', 'trick-column-prerequisites', '前置算法'), el('span', 'trick-column-author', '作者'), el('span', 'trick-column-intro', '简介'), el('span', 'trick-column-arrow'));
    list.append(head);
    if (view === 'latest') { list.append(renderDirectory(visible, true)); return; }
    const groups = new Map<TrickTier | 'unrated', DirectoryEntry[]>();
    for (const tier of [...trickTiers, 'unrated'] as const) groups.set(tier, []);
    for (const entry of visible) groups.get(entry.item.recommendation?.tier || 'unrated')?.push(entry);
    for (const [tier, rows] of groups) {
      if (!rows.length) continue;
      const group = el('section', 'trick-rank-group'); group.dataset.tier = tier;
      const heading = el('h3', 'trick-rank-heading', tier === 'unrated' ? '未评级' : tierLabel(tier));
      group.append(heading, renderDirectory(rows, false)); list.append(group);
    }
  }
  function rankFilters(): HTMLElement {
    const filters = el('div', 'tricks-ranking-filters'), controls = el('div', 'tricks-ranking-actions');
    const catalog = getCatalog();
    const ids = canonicalPrerequisites(Array.from(learned), catalog); learned.clear(); ids.forEach(id => learned.add(id));
    const picker = algorithmPicker({ className: 'tricks-learned-algorithms', label: '已学算法', catalog, selected: learned, query: learnedQuery, onSearch: value => { learnedQuery = value; refreshReset(); }, onChange: () => { refreshReset(); renderRows(); } });
    const check = el('input', 'tricks-ready-filter'); check.type = 'checkbox'; check.checked = readyOnly;
    check.addEventListener('change', () => { readyOnly = check.checked; refreshReset(); renderRows(); });
    const label = el('label', 'tricks-ready-label'); label.append(check, el('span', '', '按已学筛选'));
    const clear = action('重置筛选', 'button subtle tricks-filter-reset', () => {
      learned.clear(); learnedQuery = ''; readyOnly = false; check.checked = false;
      picker.clearSearch(); picker.refresh(); check.focus(); refreshReset(); renderRows();
    });
    function refreshReset(): void { clear.disabled = !learned.size && !learnedQuery && !readyOnly; }
    refreshReset(); controls.append(label, clear); filters.append(picker.group, controls); return filters;
  }
  function render(): void {
    const context = options.getContext(), identity = JSON.stringify([context.sourceKey, context.accountId]);
    if (scope !== identity) { reset(); scope = identity; }
    host.replaceChildren(); list = null; search = null;
    const item = selected ? items().find(row => row.path === selected) : undefined;
    if (item) {
      const reader = el('article', 'trick-reader'), top = el('div', 'trick-reader-top');
      top.append(action('← 返回 Trick 集', 'button subtle trick-back', closeDetail));
      if (options.isFavorite && options.onToggleFavorite) {
        const star = action(options.isFavorite(item) ? '★ 已收藏' : '☆ 收藏', 'button secondary trick-favorite', () => {
          if (options.getBusy()) return;
          void options.onToggleFavorite!(item).then(() => { star.textContent = options.isFavorite!(item) ? '★ 已收藏' : '☆ 收藏'; star.setAttribute('aria-pressed', String(options.isFavorite!(item))); }).catch(cause => options.toast(options.errorMessage(cause)));
        }); star.setAttribute('aria-pressed', String(options.isFavorite(item))); top.append(star);
      }
      if (canEdit(item)) {
        const controls = el('div', 'trick-reader-actions');
        controls.append(action('编辑', 'button secondary trick-edit', () => edit(item)), action('删除', 'button subtle trick-delete', () => showDelete(item))); top.append(controls);
      }
      const intro = el('p', 'trick-reader-intro', item.introduction), body = el('div', 'markdown-body trick-content');
      options.renderMarkdown(body, item.body);
      reader.append(top, el('h2', 'trick-reader-title', item.title), author(item), intro, renderRecommendation(item.recommendation, item), body); host.append(reader); return;
    }
    selected = null;
    const toolbar = el('div', 'tricks-toolbar');
    const segments = el('div', 'tricks-view-controls'); segments.setAttribute('role', 'group'); segments.setAttribute('aria-label', 'Trick 视图');
    for (const [mode, label] of [['latest', '最近更新'], ['ranking', '等级排行']] as const) {
      const button = action(label, `tricks-view-${mode}`, () => {
        if (mode === view) return;
        view = mode; render(); host.querySelector<HTMLButtonElement>(`.tricks-view-${mode}`)?.focus({ preventScroll: true });
      }); button.setAttribute('aria-pressed', String(mode === view)); segments.append(button);
    }
    const label = el('label', 'tricks-search'); label.append(el('span', '', '⌕'));
    search = el('input'); search.type = 'search'; search.placeholder = '搜索标题、作者、简介或标签'; search.setAttribute('aria-label', '搜索 Trick'); search.value = query;
    search.addEventListener('input', () => { query = search?.value || ''; renderRows(); }); label.append(search);
    toolbar.append(segments, label, el('span', 'tricks-count'));
    if (context.canCreate) toolbar.append(action('＋ 新增 Trick', 'button primary trick-create', () => edit()));
    host.append(toolbar);
    if (view === 'ranking') {
      const guide = renderTierGuide();
      guide.open = showTierGuide;
      guide.addEventListener('toggle', () => { if (guide.isConnected) showTierGuide = guide.open; });
      host.append(rankFilters(), guide);
    }
    list = el('div', `tricks-list tricks-list-${view}`); host.append(list); renderRows();
  }
  return { render, reset, openEditor: () => edit(), isReading: () => selected !== null, closeDetail, focusSearch: () => search?.focus(), hasEditor: () => editor?.open === true };
}
