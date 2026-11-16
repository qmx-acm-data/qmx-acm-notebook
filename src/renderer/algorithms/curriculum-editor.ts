import type { LearningPathCurriculum, LearningPathNode, LearningPathSection } from '../../../types/learning-path';
import type { CurriculumGateKind, CurriculumGateLayout, CurriculumGateScope, CurriculumLayout, CurriculumStageLayout, LearningCurriculumDocument, SaveLearningCurriculumInput } from '../../shared/models/learning-curriculum.js';
import { createCurriculumLayout, applyCurriculumLayout } from '../../shared/learning-curriculum.js';

export interface CurriculumEditorOptions {
  host: HTMLElement;
  curriculum: LearningPathCurriculum;
  baseCurriculum?: LearningPathCurriculum;
  document: LearningCurriculumDocument | null;
  canManage: boolean;
  tree?: LearningPathNode | null;
  onSave: (input: Omit<SaveLearningCurriculumInput, 'repo'>) => Promise<LearningCurriculumDocument>;
  onApplied: (document: LearningCurriculumDocument) => void;
  onClose?: () => void;
}
export interface CurriculumEditorController { close(): void; destroy(): void }
type RemovedGate = { stageId: string; gate: CurriculumGateLayout; index: number; before?: string; after?: string };
const kindLabels: Record<CurriculumGateKind, string> = { learning: '学习', mixed: '混练', challenge: '验收' };
const scopeLabels: Record<CurriculumGateScope, string> = { core: '核心', recommended: '推荐', elective: '选修', route: '分路线' };
let serial = 0;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text: string, action: () => void, className = ''): HTMLButtonElement {
  const node = element('button', `alp-curriculum-button ${className}`, text); node.type = 'button'; node.addEventListener('click', action); return node;
}
function field(label: string, control: HTMLElement): HTMLLabelElement {
  const node = element('label', 'alp-curriculum-field'); node.append(element('span', '', label), control); return node;
}
function input(value: string, name: string, maxLength: number): HTMLInputElement {
  const node = element('input'); node.type = 'text'; node.name = name; node.value = value; node.maxLength = maxLength; node.required = true; return node;
}
function select<T extends string>(entries: readonly (readonly [T, string])[], value: T, name: string, update: (value: T) => void): HTMLSelectElement {
  const node = element('select'); node.name = name;
  entries.forEach(([id, title]) => { const option = element('option', '', title); option.value = id; node.append(option); });
  node.value = value;
  node.addEventListener('change', () => { const entry = entries.find(([id]) => id === node.value); if (entry) update(entry[0]); });
  return node;
}
function message(error: unknown): string { return error instanceof Error ? error.message : '发布失败，请稍后重试。'; }

/** Opens a local draft. Only an explicit successful form submission applies a curriculum. */
export function openCurriculumEditor(options: CurriculumEditorOptions): CurriculumEditorController {
  if (options.canManage !== true) throw new Error('只有管理员可以编排课程。');
  const initial = structuredClone(options.document?.layout ?? createCurriculumLayout(options.curriculum));
  const draft: CurriculumLayout = structuredClone(initial);
  if (!draft.stages.length) throw new Error('课程没有可编排的章节。');
  const base = options.baseCurriculum ?? options.curriculum;
  const baseStages = new Map((base.stages ?? []).map(stage => [stage.id, stage]));
  const builtinIds = new Set((base.stages ?? []).flatMap(stage => (stage.gates ?? []).filter(gate => !gate.id.startsWith('custom-')).map(gate => gate.id)));
  const originalGates = new Map(initial.stages.flatMap(stage => stage.gates.map((gate, index) => [gate.id, { gate, index, stageId: stage.id }] as const)));
  const topics = new Map<string, string>();
  function walk(node: LearningPathNode, parents: string[]) {
    const path = [...parents, node.label || node.fullLabel || node.id];
    if (node.kind !== 'directory') topics.set(node.id, path.join(' / '));
    (node.children ?? []).forEach(child => walk(child, path));
  }
  if (options.tree) walk(options.tree, []);
  let stageId = draft.stages[0]!.id, busy = false, destroyed = false, pendingDelete: string | null = null, dragging: string | null = null;
  const removed: RemovedGate[] = [];
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const uid = `alp-curriculum-${++serial}`;
  const dialog = element('dialog', 'alp-curriculum-dialog');
  dialog.setAttribute('aria-labelledby', `${uid}-title`); dialog.setAttribute('aria-describedby', `${uid}-hint`);
  const form = element('form', 'alp-curriculum-form'); form.noValidate = true;
  const heading = element('header', 'alp-curriculum-heading');
  const headingCopy = element('div');
  headingCopy.append(element('span', 'alp-curriculum-eyebrow', '课程管理 · 管理员'), element('h2', '', '编排学习课程'));
  headingCopy.querySelector('h2')!.id = `${uid}-title`;
  const closeButton = button('×', close, 'alp-curriculum-close'); closeButton.setAttribute('aria-label', '关闭课程编排');
  heading.append(headingCopy, closeButton);
  const hint = element('p', 'alp-curriculum-hint', '自由调整章内顺序，已有前置依赖保持不变。取消会放弃本次草稿；发布后所有成员将看到新编排。'); hint.id = `${uid}-hint`;
  const controls = element('fieldset', 'alp-curriculum-controls');
  const body = element('div', 'alp-curriculum-body');
  const navigation = element('nav', 'alp-curriculum-navigation'); navigation.setAttribute('aria-label', '选择编排章节');
  const stageSelect = element('select', 'alp-curriculum-stage-select'); stageSelect.setAttribute('aria-label', '选择章节');
  stageSelect.addEventListener('change', () => { stageId = stageSelect.value; pendingDelete = null; renderStage(); });
  const chapterList = element('div', 'alp-curriculum-chapter-list');
  navigation.append(field('课程章节', stageSelect), chapterList);
  const editor = element('section', 'alp-curriculum-editor');
  const stageHeader = element('div', 'alp-curriculum-stage-header');
  const stageTitle = input('', 'stageTitle', 120); stageTitle.className = 'alp-curriculum-stage-title';
  const count = element('span', 'alp-curriculum-count');
  stageTitle.addEventListener('input', () => { current().title = stageTitle.value; refresh(); });
  stageHeader.append(field('章节标题', stageTitle), count);
  const rows = element('div', 'alp-curriculum-rows');
  const addButton = button('＋ 在章末新增关卡', () => insert(current().gates.length - 1), 'alp-curriculum-add'); addButton.dataset.action = 'add';
  editor.append(stageHeader, element('p', 'alp-curriculum-help', '拖动手柄调整顺序，也可使用上移 / 下移。关卡数量自动更新，每章保留 1–100 关。'), rows, addButton);
  const aside = element('aside', 'alp-curriculum-preview');
  const previewTitle = element('h3'); const previewCount = element('p', 'alp-curriculum-preview-count'); const preview = element('ol', 'alp-curriculum-preview-list');
  const removedTitle = element('h3', '', '待移除关卡'); const removedList = element('div', 'alp-curriculum-removed-list');
  aside.append(element('span', 'alp-curriculum-eyebrow', '实时预览'), previewTitle, previewCount, preview, removedTitle, removedList);
  body.append(navigation, editor, aside); controls.append(body);
  const footer = element('footer', 'alp-curriculum-footer');
  const summary = element('p', 'alp-curriculum-change-summary'); summary.setAttribute('aria-live', 'polite');
  const error = element('p', 'alp-curriculum-error'); error.setAttribute('role', 'alert'); error.hidden = true;
  const actions = element('div', 'alp-curriculum-actions');
  const cancelButton = button('取消', close);
  const saveButton = element('button', 'alp-curriculum-button alp-curriculum-publish', '发布课程编排'); saveButton.type = 'submit';
  actions.append(cancelButton, saveButton); footer.append(summary, error, actions);
  form.append(heading, hint, controls, footer); dialog.append(form);
  function current(): CurriculumStageLayout { return draft.stages.find(stage => stage.id === stageId)!; }
  function sections(): LearningPathSection[] { return baseStages.get(stageId)?.sections ?? []; }
  function total(): number { return draft.stages.reduce((sum, stage) => sum + stage.gates.length, 0); }
  function canInsert(): boolean { return current().gates.length < 100 && total() < 1000; }
  function restore(item: RemovedGate): void {
    const stage = draft.stages.find(entry => entry.id === item.stageId)!;
    if (busy || stage.gates.length >= 100 || total() >= 1000) return;
    const afterIndex = stage.gates.findIndex(gate => gate.id === item.after);
    const beforeIndex = stage.gates.findIndex(gate => gate.id === item.before);
    const index = afterIndex >= 0 ? afterIndex : beforeIndex >= 0 ? beforeIndex + 1 : Math.min(item.index, stage.gates.length);
    stage.gates.splice(index, 0, item.gate); removed.splice(removed.indexOf(item), 1); stageId = item.stageId; pendingDelete = null; renderStage(item.gate.id);
  }
  function insert(index: number): void {
    if (busy || !canInsert()) return;
    const stage = current(), neighbor = stage.gates[index] ?? stage.gates[0];
    const section = sections().find(entry => entry.id === neighbor?.sectionId) ?? sections()[0];
    const gate: CurriculumGateLayout = { id: `custom-${crypto.randomUUID()}`, title: '新学习关卡', kind: 'learning', sectionId: section?.id ?? '', scope: neighbor?.scope ?? section?.scope ?? 'core', description: '', goals: [], topicIds: [] };
    stage.gates.splice(index + 1, 0, gate); pendingDelete = null; renderStage(gate.id);
  }
  function move(id: string, offset: number): void {
    if (busy) return;
    const stage = current(), index = stage.gates.findIndex(gate => gate.id === id), target = index + offset;
    if (index < 0 || target < 0 || target >= stage.gates.length) return;
    const [gate] = stage.gates.splice(index, 1); stage.gates.splice(target, 0, gate!); pendingDelete = null; renderStage(id);
  }
  function remove(id: string): void {
    if (busy || current().gates.length <= 1) return;
    const stage = current(), index = stage.gates.findIndex(gate => gate.id === id);
    if (index < 0) return;
    const gate = stage.gates[index]!;
    removed.push({ stageId, gate, index, before: stage.gates[index - 1]?.id, after: stage.gates[index + 1]?.id });
    stage.gates.splice(index, 1); pendingDelete = null; renderStage(stage.gates[Math.min(index, stage.gates.length - 1)]?.id);
  }
  function refresh(): void {
    const stage = current();
    stageSelect.replaceChildren(); chapterList.replaceChildren();
    draft.stages.forEach((entry, index) => {
      const label = `${index + 1}. ${entry.title || '未命名章节'} · ${entry.gates.length} 关`;
      const option = element('option', '', label); option.value = entry.id; stageSelect.append(option);
      const item = button('', () => { stageId = entry.id; pendingDelete = null; renderStage(); }, 'alp-curriculum-chapter');
      item.dataset.stageId = entry.id; item.setAttribute('aria-current', String(stageId === entry.id));
      item.append(element('strong', '', `${index + 1}. ${entry.title || '未命名章节'}`), element('span', '', `${entry.gates.length} 关`)); chapterList.append(item);
    });
    stageSelect.value = stageId;
    count.textContent = `${stage.gates.length} / 100 关 · 全课 ${total()} / 1000 关`;
    previewTitle.textContent = stage.title || '未命名章节'; previewCount.textContent = `${stage.gates.length} 关 · 本章待移除 ${removed.filter(item => item.stageId === stageId).length} 关`;
    preview.replaceChildren();
    stage.gates.forEach(gate => { const row = element('li'); row.append(element('strong', '', gate.title || '未命名关卡'), element('span', '', `${kindLabels[gate.kind]} · ${scopeLabels[gate.scope]}`)); preview.append(row); });
    removedList.replaceChildren(); removedTitle.textContent = `待移除关卡 · ${removed.length}`;
    if (!removed.length) removedList.append(element('p', 'alp-curriculum-help', '尚未移除关卡'));
    removed.forEach(item => {
      const row = element('div', 'alp-curriculum-removed-item');
      const undo = button('撤销移除', () => restore(item)); undo.dataset.action = 'undo'; undo.dataset.gateId = item.gate.id;
      undo.disabled = busy || draft.stages.find(stage => stage.id === item.stageId)!.gates.length >= 100 || total() >= 1000;
      row.append(element('span', '', item.gate.title), undo); removedList.append(row);
    });
    const present = new Set(draft.stages.flatMap(entry => entry.gates.map(gate => gate.id)));
    const added = [...present].filter(id => !originalGates.has(id)).length;
    const deleted = [...originalGates.keys()].filter(id => !present.has(id)).length;
    let updated = 0, renamed = 0;
    draft.stages.forEach(entry => {
      if (initial.stages.find(stage => stage.id === entry.id)?.title !== entry.title) renamed++;
      entry.gates.forEach((gate, index) => { const old = originalGates.get(gate.id); if (old && (old.index !== index || JSON.stringify(old.gate) !== JSON.stringify(gate))) updated++; });
    });
    summary.textContent = `发布变更：新增 ${added} 关 · 移除 ${deleted} 关 · 调整 ${updated} 关 · 章节改名 ${renamed} 处`;
    addButton.disabled = busy || !canInsert();
    addButton.textContent = canInsert() ? '＋ 在章末新增关卡' : total() >= 1000 ? '全课已达 1000 关上限' : '本章已达 100 关上限';
    rows.querySelectorAll<HTMLButtonElement>('[data-action="insert"]').forEach(node => { node.disabled = busy || !canInsert(); });
  }
  function renderCustom(gate: CurriculumGateLayout): HTMLDetailsElement {
    const details = element('details', 'alp-curriculum-custom'); details.append(element('summary', '', '新增关卡内容 · 简介、目标与知识点'));
    const content = element('div', 'alp-curriculum-custom-fields');
    const description = element('textarea'); description.name = 'gateDescription'; description.rows = 3; description.maxLength = 6000; description.value = gate.description ?? '';
    description.addEventListener('input', () => { gate.description = description.value; refresh(); });
    const goals = element('textarea'); goals.name = 'gateGoals'; goals.rows = 3; goals.maxLength = 6000; goals.value = (gate.goals ?? []).join('\n');
    goals.addEventListener('input', () => { gate.goals = goals.value.split(/\r?\n/).filter(line => line.trim()); refresh(); });
    content.append(field('学习简介（必填，最多 6000 字）', description), field('学习目标（必填，每行一条，最多 20 条，每条 500 字，合计 6000 字）', goals));
    const knowledge = element('select'); knowledge.name = 'gateTopics'; knowledge.multiple = true; knowledge.size = 5;
    const choices = new Map(topics);
    (gate.topicIds ?? []).forEach(id => { if (!choices.has(id)) choices.set(id, id); });
    choices.forEach((label, id) => { const option = element('option', '', label); option.value = id; option.selected = (gate.topicIds ?? []).includes(id); knowledge.append(option); });
    knowledge.addEventListener('change', () => { gate.topicIds = Array.from(knowledge.selectedOptions, option => option.value); refresh(); });
    content.append(field('关联知识点（可多选，最多 20 个）', knowledge), element('p', 'alp-curriculum-help', topics.size ? '按住 Ctrl / Command 可多选；请选择课程中实际存在的知识点。' : '当前未提供知识树，可先发布并稍后补充知识点。'));
    knowledge.disabled = !choices.size; details.append(content); return details;
  }
  function renderStage(focusId?: string): void {
    stageTitle.value = current().title; rows.replaceChildren();
    current().gates.forEach((gate, index) => {
      const row = element('article', 'alp-curriculum-row'); row.dataset.gateId = gate.id;
      const top = element('div', 'alp-curriculum-row-top');
      const handle = button('⠿', () => {}, 'alp-curriculum-drag'); handle.draggable = true; handle.setAttribute('aria-label', `拖动第 ${index + 1} 关`); handle.title = '拖动调整顺序，键盘操作请使用上移 / 下移';
      handle.addEventListener('dragstart', event => { if (busy) { event.preventDefault(); return; } dragging = gate.id; event.dataTransfer?.setData('text/plain', gate.id); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; row.classList.add('is-dragging'); });
      handle.addEventListener('dragend', () => { dragging = null; rows.querySelectorAll('.is-dragging, .is-drop-target').forEach(node => node.classList.remove('is-dragging', 'is-drop-target')); });
      row.addEventListener('dragover', event => { if (busy || !dragging || dragging === gate.id) return; event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; row.classList.add('is-drop-target'); });
      row.addEventListener('dragleave', event => { if (!(event.relatedTarget instanceof Node) || !row.contains(event.relatedTarget)) row.classList.remove('is-drop-target'); });
      row.addEventListener('drop', event => { event.preventDefault(); const source = dragging; dragging = null; if (!source || busy) return; const from = current().gates.findIndex(item => item.id === source), to = current().gates.findIndex(item => item.id === gate.id); if (from >= 0 && to >= 0) move(source, to - from); });
      top.append(handle, element('span', 'alp-curriculum-row-number', `${index + 1}`), element('span', 'alp-curriculum-row-origin', builtinIds.has(gate.id) ? '内置关卡' : '新增关卡'));
      const actions = element('div', 'alp-curriculum-row-actions');
      ([['up', '上移', () => move(gate.id, -1), index === 0], ['down', '下移', () => move(gate.id, 1), index === current().gates.length - 1], ['insert', '在后面新增', () => insert(index), !canInsert()], ['delete', '移除', () => { pendingDelete = gate.id; renderStage(); rowFor(gate.id)?.querySelector<HTMLButtonElement>('[data-action="confirm-delete"]')?.focus(); }, current().gates.length <= 1]] as const).forEach(([action, label, run, disabled]) => {
        const control = button(label, run); control.dataset.action = action; control.disabled = disabled; control.setAttribute('aria-label', `${label}第 ${index + 1} 关`); actions.append(control);
      });
      top.append(actions);
      const fields = element('div', 'alp-curriculum-row-fields');
      const title = input(gate.title, 'gateTitle', 160); title.addEventListener('input', () => { gate.title = title.value; refresh(); });
      const kind = select(Object.entries(kindLabels) as [CurriculumGateKind, string][], gate.kind, 'gateKind', value => { gate.kind = value; refresh(); });
      const section = select(sections().length ? sections().map(entry => [entry.id, entry.title] as const) : [['', '本章（无独立学习段）']], gate.sectionId, 'gateSection', value => { gate.sectionId = value; const selected = sections().find(entry => entry.id === value); if (selected) gate.scope = selected.scope; renderStage(gate.id); });
      const scope = select((Object.entries(scopeLabels) as [CurriculumGateScope, string][]).filter(([value]) => value !== 'route' || sections().some(section => section.id === gate.sectionId && section.scope === 'route' && section.routeId)), gate.scope, 'gateScope', value => { gate.scope = value; refresh(); });
      fields.append(field('关卡标题', title), field('类型', kind), field('学习段', section), field('范围', scope));
      row.append(top, fields);
      if (!builtinIds.has(gate.id)) row.append(renderCustom(gate));
      else row.append(element('p', 'alp-curriculum-help', '简介与学习目标请在关卡详情的公共内容编辑器中维护。'));
      if (pendingDelete === gate.id) {
        const confirm = element('div', 'alp-curriculum-remove-confirm'); confirm.setAttribute('role', 'group'); confirm.setAttribute('aria-label', '确认移除关卡');
        const yes = button('确认移除', () => remove(gate.id)); yes.dataset.action = 'confirm-delete';
        const no = button('保留关卡', () => { pendingDelete = null; renderStage(gate.id); });
        confirm.append(element('span', '', '从本次编排移除？发布前仍可撤销。'), yes, no); row.append(confirm);
      }
      rows.append(row);
    });
    refresh();
    if (focusId) rowFor(focusId)?.querySelector<HTMLInputElement>('input[name="gateTitle"]')?.focus({ preventScroll: true });
  }
  function rowFor(id: string): HTMLElement | undefined { return Array.from(rows.querySelectorAll<HTMLElement>('.alp-curriculum-row')).find(row => row.dataset.gateId === id); }
  function showError(text: string): void { error.textContent = text; error.hidden = false; }
  function validate(): void {
    if (total() > 1000) throw new Error('全课最多 1000 关。');
    const invalidText = (value: string) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
    for (const stage of draft.stages) {
      if (!stage.title.trim() || stage.title.length > 120 || invalidText(stage.title)) { stageId = stage.id; renderStage(); stageTitle.focus(); throw new Error('请填写有效的章节标题（1–120 字）。'); }
      if (stage.gates.length < 1 || stage.gates.length > 100) throw new Error('每章必须保留 1–100 关。');
      const stageSections = baseStages.get(stage.id)?.sections ?? [];
      for (const gate of stage.gates) {
        if ((stageSections.length ? !stageSections.some(section => section.id === gate.sectionId) : gate.sectionId !== '') || !Object.hasOwn(kindLabels, gate.kind) || !Object.hasOwn(scopeLabels, gate.scope)) { stageId = stage.id; renderStage(gate.id); throw new Error('请选择本章的学习段、有效的关卡类型和范围。'); }
        if (!gate.title.trim() || gate.title.length > 160 || invalidText(gate.title)) { stageId = stage.id; renderStage(gate.id); throw new Error('请填写有效的关卡标题（1–160 字）。'); }
        const section = stageSections.find(entry => entry.id === gate.sectionId);
        if (gate.scope === 'route' && (section?.scope !== 'route' || !section.routeId)) { stageId = stage.id; renderStage(gate.id); throw new Error('分路线范围只能用于具有路线标识的学习段。'); }
        if (!builtinIds.has(gate.id)) {
          if (!gate.description?.trim() || gate.description.length > 6000 || invalidText(gate.description)) { stageId = stage.id; renderStage(gate.id); throw new Error('新增关卡需要填写学习简介（1–6000 字）。'); }
          if (!gate.goals?.length || gate.goals.length > 20 || gate.goals.join('\n').length > 6000 || gate.goals.some(goal => !goal.trim() || goal.length > 500 || invalidText(goal))) { stageId = stage.id; renderStage(gate.id); throw new Error('新增关卡需要 1–20 条学习目标，每条 1–500 字、合计最多 6000 字。'); }
          if ((gate.topicIds?.length ?? 0) > 20 || gate.topicIds?.some(id => id.length < 1 || id.length > 200 || invalidText(id))) { stageId = stage.id; renderStage(gate.id); throw new Error('每关最多选择 20 个有效知识点。'); }
        }
      }
    }
    applyCurriculumLayout(base, draft);
  }
  function setBusy(value: boolean): void {
    busy = value; controls.disabled = value; closeButton.disabled = value; cancelButton.disabled = value; saveButton.disabled = value;
    dialog.dataset.saving = String(value); dialog.setAttribute('aria-busy', String(value)); saveButton.textContent = value ? '正在发布…' : '发布课程编排';
    rows.querySelectorAll<HTMLButtonElement>('.alp-curriculum-drag').forEach(handle => { handle.draggable = !value; });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || destroyed) return;
    if (options.canManage !== true) { showError('管理员权限已失效，请重新打开课程编排。'); return; }
    error.hidden = true;
    try { validate(); } catch (cause) { showError(message(cause)); return; }
    setBusy(true);
    try {
      const saved = await options.onSave({ layout: structuredClone(draft), sha: options.document?.sha ?? null });
      if (destroyed) return;
      // Apply before closing: the host may synchronously replace the learning path.
      options.onApplied(saved);
      finish();
    } catch (cause) { if (!destroyed) { showError(message(cause)); setBusy(false); } }
  });
  function finish(): void {
    if (destroyed) return; destroyed = true;
    if (dialog.open) dialog.close(); dialog.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    options.onClose?.();
  }
  function close(): void { if (!busy) finish(); }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (!destroyed) { if (busy) dialog.showModal(); else finish(); } });
  (options.host.parentElement ?? options.host).append(dialog);
  renderStage(); setBusy(false); dialog.showModal(); stageSelect.focus();
  return { close, destroy: finish };
}
