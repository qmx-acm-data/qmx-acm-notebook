import type { LearningPathGate, LearningPathCurriculum, LearningPathNode, LearningPathNote, LearningPathProgress } from '../../../types/learning-path.js';
import type { LearningGateContent, SaveLearningGateInput } from '../../shared/models/learning-content.js';
import type { RoadmapNode } from '../../shared/models/learning-roadmap.js';

export interface RoadmapResourcesOptions {
  host: HTMLElement; node: RoadmapNode; curriculum: LearningPathCurriculum; tree: LearningPathNode;
  contents: LearningGateContent[]; notes: LearningPathNote[]; progress: LearningPathProgress; canManage: boolean;
  onSaveGate: (input: Omit<SaveLearningGateInput, 'repo'>) => Promise<LearningGateContent>;
  onPersonal: (gateId: string, url: string) => Promise<void>;
  onTopic: (id: string) => void; onNote: (note: LearningPathNote, gateId: string) => void;
  onExternal: (url: string) => Promise<void>;
}
export interface RoadmapResourceController { destroy(): void }
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className = ''): HTMLElementTagNameMap[K] { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; }
function button(text: string, cls: string, action: () => void): HTMLButtonElement { const b = el('button', text, `arm-button ${cls}`); b.type = 'button'; b.addEventListener('click', action); return b; }
function fields(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function safeUrl(value: unknown): string { if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u0020\u007f\\]/u.test(value)) return ''; try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } }
function message(error: unknown): string { return error instanceof Error ? error.message : '保存失败，请重试'; }
export function openRoadmapResources(options: RoadmapResourcesOptions): RoadmapResourceController {
  const { host, node } = options, previous = document.activeElement;
  const all = (options.curriculum.stages || []).flatMap(s => s.gates || []), ids = new Set(node.gateIds || []);
  const gates = all.filter(g => ids.has(g.id));
  const contents = new Map(options.contents.map(c => [c.gateId, c]));
  const topics = new Map<string, LearningPathNode>();
  function walk(n: LearningPathNode): void { topics.set(n.id, n); for (const id of n.legacyIds || []) topics.set(id, n); (n.children || []).forEach(walk); } walk(options.tree);
  const dialog = el('dialog', undefined, 'arm-detail-dialog arm-resource-dialog'); dialog.setAttribute('aria-label', `${node.label}相关资料`);
  const heading = el('header', undefined, 'arm-dialog-header'), title = el('h2', `${node.label} · 相关资料`, 'arm-detail-title');
  const close = button('×', 'arm-resource-close', () => { if (!busy) destroy(); }); close.setAttribute('aria-label', '关闭相关资料'); heading.append(title, close);
  const body = el('div', undefined, 'arm-dialog-body'); dialog.append(heading, body);
  let destroyed = false, busy = false; const children = new Set<HTMLDialogElement>();
  function destroy(): void { if (destroyed) return; destroyed = true; for (const child of children) { if (child.open) child.close(); child.remove(); } if (dialog.open) dialog.close(); dialog.remove(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); }
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) destroy(); });
  function external(url: string): void { void options.onExternal(url).catch(error => { if (!destroyed) { const note = el('p', message(error), 'arm-focus-error'); note.setAttribute('role', 'alert'); body.prepend(note); } }); }
  function openForm(gate: LearningPathGate, personal: boolean): void {
    if (busy || (!personal && !options.canManage)) return;
    const child = el('dialog', undefined, `arm-detail-dialog ${personal ? 'arm-personal-dialog' : 'arm-resource-edit-dialog'}`); child.setAttribute('aria-label', personal ? '我的题单' : '编辑公共资料');
    const form = el('form', undefined, personal ? 'arm-personal-form' : 'arm-resource-form'); form.noValidate = true;
    const formHead = el('header', undefined, 'arm-dialog-header'); formHead.append(el('h2', personal ? '我的题单' : '编辑公共资料', 'arm-detail-title'));
    const cancel = button('取消', '', () => { if (!busy) { child.close(); child.remove(); children.delete(child); } });
    const formBody = el('div', undefined, 'arm-dialog-body'), error = el('p', undefined, 'arm-focus-error'); error.setAttribute('role', 'alert'); error.hidden = true;
    const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement>(); const content = contents.get(gate.id), record = fields(options.progress.gates?.[gate.id]);
    function field(name: string, label: string, value: string, area = false): void { const wrap = el('label', undefined, 'arm-resource-field'), input = area ? el('textarea') : el('input'); input.name = name; input.value = value; if (input instanceof HTMLTextAreaElement) { input.rows = name === 'goals' ? 4 : 5; input.maxLength = 6000; } else input.maxLength = name === 'practiceTitle' ? 120 : 2000; wrap.append(el('span', label), input); inputs.set(name, input); formBody.append(wrap); }
    if (!personal) { field('description', '相关介绍', content?.description || gate.learningDescription || gate.description || '', true); field('goals', '核心目标（每行一条）', (content?.goals || gate.goals || []).join('\n'), true); field('practiceTitle', '官方精选题单名称', content?.practiceList?.title || ''); }
    field('practiceUrl', personal ? '我的题单链接' : '官方精选题单链接', personal ? String(record.practiceUrl || '') : content?.practiceList?.url || '');
    const save = el('button', personal ? '保存我的题单' : '保存公共资料', 'arm-button'); save.type = 'submit'; const actions = el('div', undefined, 'arm-resource-actions'); actions.append(cancel, save); formBody.append(error, actions); form.append(formHead, formBody); child.append(form); children.add(child); host.append(child);
    child.addEventListener('cancel', event => { event.preventDefault(); if (!busy) { child.close(); child.remove(); children.delete(child); } });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return; const value = (name: string) => inputs.get(name)!.value.trim();
      const rawUrl = value('practiceUrl'), url = safeUrl(rawUrl); error.hidden = true;
      if (rawUrl && !url) { error.textContent = '请填写有效的 HTTP 或 HTTPS 链接，不能包含凭据。'; error.hidden = false; return; }
      let description = '', goals: string[] = [], practiceTitle = '';
      if (!personal) { description = value('description'); goals = value('goals').split(/\r?\n/u).map(x => x.trim()).filter(Boolean); practiceTitle = value('practiceTitle');
        if (!description || description.length > 6000 || !goals.length || goals.length > 20 || goals.some(x => x.length > 500) || goals.join('\n').length > 6000) { error.textContent = '介绍须为1–6000字；目标须为1–20条，每条最多500字，总计最多6000字。'; error.hidden = false; return; }
        if (Boolean(practiceTitle) !== Boolean(url) || practiceTitle.length > 120) { error.textContent = '官方题单名称和链接须同时填写或同时留空，名称最多120字。'; error.hidden = false; return; }
      }
      busy = true; form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input,textarea,button').forEach(n => { n.disabled = true; });
      try { if (personal) { await options.onPersonal(gate.id, url); options.progress.gates = { ...(options.progress.gates || {}), [gate.id]: { ...record, practiceUrl: url } }; } else { const saved = await options.onSaveGate({ gateId: gate.id, description, goals, practiceList: url ? { title: practiceTitle, url } : null, sha: content?.sha || null }); contents.set(gate.id, saved); } if (!destroyed) { child.close(); child.remove(); children.delete(child); render(); } }
      catch (cause) { if (!destroyed) { error.textContent = message(cause); error.hidden = false; } }
      finally { busy = false; if (!destroyed) form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input,textarea,button').forEach(n => { n.disabled = false; }); }
    }); child.showModal(); inputs.values().next().value?.focus();
  }
  function render(): void {
    body.replaceChildren();
    body.append(el('p', '围绕这个知识范围查阅笔记和练习；资料来源与个人题单分别保存。', 'arm-resource-hint'));
    if (!gates.length) body.append(el('p', '当前公共课程中暂无对应资料条目，可先从相关知识点查阅。', 'arm-resource-hint'));
    for (const gate of gates) {
      const content = contents.get(gate.id), card = el('section', undefined, 'arm-resource-card'); card.dataset.gateId = gate.id;
      card.append(el('h3', (gate.title || '相关内容').replace(/^混练验收[：:]/u, '练习：')));
      if (content) { card.append(el('p', content.description)); const goals = el('ul'); content.goals.forEach(goal => goals.append(el('li', goal))); card.append(goals); }
      const links = el('div', undefined, 'arm-resource-links');
      for (const topicId of gate.topicIds || []) { const topic = topics.get(topicId); if (!topic) continue; const b = button(topic.label || topic.id, 'arm-topic-link', () => { destroy(); options.onTopic(topic.id); }); b.dataset.topicId = topic.id; links.append(b); }
      card.append(links);
      const gateTopics = new Set((gate.topicIds || []).map(id => topics.get(id)?.id || id));
      const notes = options.notes.filter(note => note.noteScope === 'public' && gateTopics.has(topics.get(note.nodeId)?.id || note.nodeId)).slice().sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
      for (const note of notes) { const b = button(note.title || '未命名笔记', `arm-note${note.featured ? ' arm-note-featured' : ''}`, () => { destroy(); options.onNote(note, gate.id); }); b.dataset.noteId = typeof note.id === 'string' ? note.id : ''; card.append(b); }
      const official = content?.practiceList || (content ? null : (gate.practiceLists || [])[0]); const officialUrl = safeUrl(official?.url);
      if (official && officialUrl) card.append(button(`官方精选题单 · ${official.title} ↗`, 'arm-official-list', () => external(officialUrl)));
      const record = fields(options.progress.gates?.[gate.id]), personalUrl = safeUrl(record.practiceUrl);
      if (personalUrl) card.append(button('我的题单 ↗', 'arm-personal-link', () => external(personalUrl)));
      const actions = el('div', undefined, 'arm-resource-actions'); actions.append(button(personalUrl ? '编辑我的题单' : '＋ 添加我的题单', 'arm-personal-button', () => openForm(gate, true)));
      if (options.canManage) actions.append(button('编辑介绍、目标与官方题单', 'arm-resource-edit', () => openForm(gate, false)));
      card.append(actions); body.append(card);
    }
    const covered = new Set(gates.flatMap(g => g.topicIds || [])); const extraTopics = (node.topicIds || []).filter(id => !covered.has(id));
    if (extraTopics.length) { const links = el('div', undefined, 'arm-resource-links'); extraTopics.forEach(id => { const topic = topics.get(id); if (topic) { const b = button(topic.label || topic.id, 'arm-topic-link', () => { destroy(); options.onTopic(topic.id); }); b.dataset.topicId = topic.id; links.append(b); } }); body.append(links); }
  }
  render(); host.append(dialog); dialog.showModal(); return { destroy };
}
