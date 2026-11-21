import type { LearningPathCurriculum, LearningPathNode, LearningPathNote, LearningPathProgress } from '../../../types/learning-path.js';
import type { AlgorithmBrowserNote } from '../../../types/algorithm-browser.js';
import type { LearningGateContent, SaveLearningGateInput } from '../../shared/models/learning-content.js';
import type { AlgorithmDirectoryNode } from '../../shared/models/algorithm-directory.js';
import type { AlgorithmNodeContent, SaveAlgorithmNodeContentInput } from '../../shared/models/algorithm-node-content.js';
import type { RoadmapNode } from '../../shared/models/learning-roadmap.js';
import { resolveAlgorithmLeaf } from '../../shared/algorithm-leaf.js';
import { renderLeafReading } from './leaf-reading.js';
import { roadmapIntroduction, roadmapLeaves } from './roadmap.js';

export interface RoadmapResourcesOptions {
  host: HTMLElement; node: RoadmapNode; curriculum: LearningPathCurriculum; tree: LearningPathNode;
  contents: LearningGateContent[]; notes: LearningPathNote[]; progress: LearningPathProgress; canManage: boolean;
  onSaveGate: (input: Omit<SaveLearningGateInput, 'repo'>) => Promise<LearningGateContent>;
  onPersonal: (gateId: string, url: string) => Promise<void>;
  onTopic: (id: string) => void; onNote: (note: LearningPathNote, gateId: string) => void;
  onExternal: (url: string) => Promise<void>;
  topicId?: string; nodeContents?: AlgorithmNodeContent[];
  onSaveNodeContent?: (input: Omit<SaveAlgorithmNodeContentInput, 'repo'>) => Promise<AlgorithmNodeContent>;
  renderMarkdown?: (host: HTMLElement, markdown: string) => void;
  scope?: 'public' | 'personal'; account?: { id?: unknown } | null;
  onUploadLeaf?: (id: string) => void;
  getIntroduction?: (node: RoadmapNode) => string | undefined;
  onSaveIntroduction?: (nodeId: string, markdown: string) => Promise<void>;
}
export interface RoadmapResourceController { destroy(): void }
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className = ''): HTMLElementTagNameMap[K] { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = text; return n; }
function button(text: string, cls: string, action: () => void): HTMLButtonElement { const b = el('button', text, `arm-button ${cls}`); b.type = 'button'; b.addEventListener('click', action); return b; }
function directoryTree(node: LearningPathNode): AlgorithmDirectoryNode {
  return { ...node, label: node.label || node.id, color: node.color || 'parent', children: (node.children || []).map(directoryTree) };
}
export function openRoadmapResources(options: RoadmapResourcesOptions): RoadmapResourceController {
  const { host, node } = options, previous = document.activeElement, tree = directoryTree(options.tree);
  const allGates = (options.curriculum.stages || []).flatMap(stage => stage.gates || []);
  let introduction = options.getIntroduction?.(node) ?? options.nodeContents?.find(content => content.nodeId === `roadmap:${node.id}`)?.introduction ?? roadmapIntroduction(node);
  let selected = options.topicId ? resolveAlgorithmLeaf(tree, options.topicId) : null;
  let scope = options.scope === 'personal' ? 'personal' : 'public', destroyed = false, busy = false;
  const dialog = el('dialog', undefined, 'arm-detail-dialog arm-resource-dialog');
  const heading = el('header', undefined, 'arm-dialog-header'), title = el('h2', '', 'arm-detail-title');
  const close = button('关闭 ×', 'arm-resource-close', () => { if (!busy) destroy(); }); close.setAttribute('aria-label', '关闭知识点浏览'); heading.append(title, close);
  const body = el('div', undefined, 'arm-dialog-body'); dialog.append(heading, body);
  function destroy(): void { if (destroyed) return; destroyed = true; if (dialog.open) dialog.close(); dialog.remove(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); }
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) destroy(); });
  function renderMarkdown(target: HTMLElement, markdown: string): void { if (options.renderMarkdown) options.renderMarkdown(target, markdown); else target.textContent = markdown; }
  function renderIntroduction(): HTMLElement {
    const section = el('section', undefined, 'arm-directory-introduction'), row = el('div', undefined, 'arm-directory-heading'); row.append(el('h3', '简介'));
    const markdown = el('div', undefined, 'markdown-body arm-directory-markdown'); renderMarkdown(markdown, introduction); section.append(row, markdown);
    if (options.canManage && options.onSaveIntroduction) row.append(button('编辑简介', 'arm-edit-introduction', () => {
      const form = el('form', undefined, 'arm-introduction-form'), input = el('textarea', undefined, 'arm-introduction-input'); input.name = 'introduction'; input.rows = 12; input.value = introduction; input.setAttribute('aria-label', '目录简介（Markdown）');
      const error = el('p', '', 'arm-focus-error'); error.hidden = true; error.setAttribute('role', 'alert');
      const cancel = button('取消', '', render), save = el('button', '保存简介', 'arm-button'); save.type = 'submit';
      const actions = el('div', undefined, 'arm-resource-actions'); actions.append(cancel, save); form.append(input, error, actions); section.replaceChildren(form); input.focus();
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (busy) return;
        if (!input.value.trim() || input.value.length > 6000) { error.textContent = '简介须为1–6000字。'; error.hidden = false; return; }
        busy = true; input.disabled = cancel.disabled = save.disabled = true;
        try { await options.onSaveIntroduction!(node.id, input.value); introduction = input.value; if (!destroyed) render(); }
        catch (cause) { error.textContent = cause instanceof Error ? cause.message : '简介保存失败，请重试'; error.hidden = false; }
        finally { busy = false; input.disabled = cancel.disabled = save.disabled = false; }
      });
    }));
    return section;
  }
  function render(): void {
    body.replaceChildren(); title.textContent = selected ? selected.label : `${node.label} · 目录`;
    dialog.setAttribute('aria-label', selected ? `${selected.label}知识点` : `${node.label}目录`);
    const scopes = el('nav', undefined, 'arm-note-scope'); scopes.setAttribute('aria-label', '笔记范围');
    for (const value of ['public', 'personal'] as const) {
      const control = button(value === 'public' ? '公开笔记' : '我的笔记', 'arm-scope-button', () => { scope = value; render(); });
      control.dataset.scope = value; control.setAttribute('aria-pressed', String(value === scope)); scopes.append(control);
    }
    body.append(scopes);
    if (!selected) {
      body.append(renderIntroduction());
      const choices = el('section', undefined, 'arm-leaf-choices'); choices.append(el('h3', '知识点')); const links = el('div', undefined, 'arm-resource-links');
      for (const leaf of roadmapLeaves(tree, node)) { const action = button(leaf.label, 'arm-leaf-link', () => { selected = leaf; dialog.scrollTop = 0; render(); }); action.dataset.topicId = leaf.id; links.append(action); }
      if (links.childElementCount) choices.append(links); else choices.append(el('p', '暂无可浏览的知识点。', 'arm-fine-print')); body.append(choices); return;
    }
    const leaf = selected;
    body.append(button('返回目录', 'arm-back-directory', () => { selected = null; render(); }));
    const originals = new Map<AlgorithmBrowserNote, LearningPathNote>();
    const notes = options.notes.filter(note => scope === 'public' ? note.noteScope === 'public' : note.noteScope === 'personal' && options.account?.id != null && String(note.authorId) === String(options.account.id)).flatMap(note => {
      if (resolveAlgorithmLeaf(tree, note.nodeId)?.id !== leaf.id) return [];
      const canonical = { ...note, nodeId: leaf.id }; originals.set(canonical, note); return [canonical];
    });
    const rawContent = options.nodeContents?.find(content => content.nodeId === leaf.id) || options.nodeContents?.find(content => resolveAlgorithmLeaf(tree, content.nodeId)?.id === leaf.id);
    const content = rawContent ? { ...rawContent, storageNodeId: rawContent.storageNodeId || rawContent.nodeId, nodeId: leaf.id } : null;
    const gateId = allGates.find(gate => (gate.topicIds || []).some(id => resolveAlgorithmLeaf(tree, id)?.id === leaf.id))?.id || '';
    const reading = renderLeafReading({ node: leaf, content, notes, canManage: options.canManage,
      onSave: options.onSaveNodeContent ? async input => {
        const saved = await options.onSaveNodeContent!(input);
        options.nodeContents = [...(options.nodeContents || []).filter(entry => resolveAlgorithmLeaf(tree, entry.nodeId)?.id !== leaf.id), saved]; return saved;
      } : undefined,
      renderMarkdown: options.renderMarkdown,
      onRead: note => { const original = originals.get(note); if (original) { destroy(); options.onNote({ ...original, nodeId: leaf.id }, gateId); } },
      onUpload: options.onUploadLeaf ? () => { destroy(); options.onUploadLeaf!(leaf.id); } : undefined,
    });
    reading.id = `topic-${leaf.id}`; body.append(reading);
  }
  render(); host.append(dialog); dialog.showModal(); return { destroy };
}
