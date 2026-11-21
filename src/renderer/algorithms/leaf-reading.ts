import type { AlgorithmDirectoryNode } from '../../shared/models/algorithm-directory.js';
import type { AlgorithmNodeContent, SaveAlgorithmNodeContentInput } from '../../shared/models/algorithm-node-content.js';
import type { AlgorithmBrowserNote } from '../../../types/algorithm-browser.js';

export interface LeafReadingOptions {
  node: AlgorithmDirectoryNode; content?: AlgorithmNodeContent | null; notes: AlgorithmBrowserNote[];
  canManage: boolean; onSave?: (input: Omit<SaveAlgorithmNodeContentInput, 'repo'>) => Promise<AlgorithmNodeContent>;
  renderMarkdown?: (host: HTMLElement, markdown: string) => void;
  onRead: (note: AlgorithmBrowserNote) => void; onUpload?: () => void;
  authorName?: (author: unknown) => unknown; formatDate?: (value: unknown) => unknown;
}
function element<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function button(label: string, cls: string, run: () => void): HTMLButtonElement { const n = element('button', cls, label); n.type = 'button'; n.addEventListener('click', run); return n; }
function noteKey(note: AlgorithmBrowserNote): string { return String(note.path || note.id || note.clientId || `${String(note.nodeId)}:${String(note.title)}:${String(note.authorId)}`); }
/** The same three reading sections are used by the knowledge tree and route leaves. */
export function renderLeafReading(options: LeafReadingOptions): HTMLElement {
  const root = element('section', 'alg-leaf-reading'); root.dataset.nodeId = options.node.id;
  let current = options.content || null;
  function markdown(host: HTMLElement, text: string): void { if (options.renderMarkdown) options.renderMarkdown(host, text); else host.textContent = text; }
  function render(): void {
    root.replaceChildren();
    const intro = element('section', 'alg-leaf-introduction'), heading = element('div', 'alg-section-heading'); heading.append(element('h3', '', '简介'));
    if (options.canManage && options.onSave) heading.append(button('编辑简介与精选', 'alg-text-button alg-edit-leaf-content', edit));
    intro.append(heading); const body = element('div', 'markdown-body alg-introduction-markdown');
    const introduction = current?.introduction ?? options.node.scope ?? '';
    if (introduction.trim()) markdown(body, introduction); else body.append(element('p', 'alg-inline-empty', '暂无简介。'));
    intro.append(body); root.append(intro);
    const selectedPaths = new Set(current?.featuredNotePaths || []);
    const isFeatured = (note: AlgorithmBrowserNote) => current ? typeof note.path === 'string' && selectedPaths.has(note.path) : note.featured === true;
    const featured = options.notes.filter(isFeatured), ordinary = options.notes.filter(note => !isFeatured(note));
    for (const [title, notes, cls] of [['精选笔记', featured, 'alg-featured-section'], ['全部笔记', ordinary, 'alg-all-notes-section']] as const) {
      const section = element('section', cls), row = element('div', 'alg-section-heading'); row.append(element('h3', '', title), element('span', 'alg-section-count', String(notes.length))); section.append(row);
      const list = element('div', 'alg-note-list');
      for (const note of notes) {
        const card = button('', `alg-note-card${isFeatured(note) ? ' alg-note-featured' : ''}`, () => options.onRead(note)); card.dataset.noteKey = noteKey(note);
        const meta = element('div', 'alg-note-meta'); if (isFeatured(note)) meta.append(element('span', 'alg-featured', '精选'));
        if (note.author) meta.append(element('span', 'alg-note-author', String(options.authorName?.(note.author) || note.author)));
        if (note.updatedAt) meta.append(element('span', '', String(options.formatDate?.(note.updatedAt) || note.updatedAt)));
        card.append(element('h4', 'alg-note-title', String(note.title || '未命名笔记')), meta);
        if (Array.isArray(note.tags) && note.tags.length) { const tags = element('div', 'alg-note-tags'); note.tags.forEach(tag => tags.append(element('span', 'alg-tag', String(tag)))); card.append(tags); }
        list.append(card);
      }
      if (notes.length) section.append(list); else section.append(element('p', 'alg-inline-empty', title === '精选笔记' ? '暂无精选笔记。' : '暂无其他笔记。'));
      if (title === '全部笔记' && options.onUpload) section.append(button('＋ 上传笔记', 'alg-text-button alg-leaf-upload', options.onUpload));
      root.append(section);
    }
  }
  function edit(): void {
    if (!options.canManage || !options.onSave) return;
    const previous = document.activeElement, dialog = element('dialog', 'alg-leaf-editor'); dialog.setAttribute('aria-label', '编辑简介与精选笔记');
    const form = element('form', 'alg-leaf-content-form'); form.noValidate = true;
    const header = element('header', 'alg-leaf-editor-header'); header.append(element('h2', '', `${options.node.label} · 简介与精选`));
    const introduction = element('textarea', 'alg-leaf-markdown-input'); introduction.name = 'introduction'; introduction.rows = 11; introduction.value = current?.introduction ?? options.node.scope ?? ''; introduction.setAttribute('aria-label', 'Markdown简介');
    const label = element('label', 'alg-leaf-field'); label.append(element('strong', '', '简介（Markdown）'), introduction);
    const preview = element('section', 'alg-leaf-preview'); preview.append(element('h3', '', '预览')); const previewBody = element('div', 'markdown-body'); preview.append(previewBody);
    const renderPreview = () => markdown(previewBody, introduction.value); introduction.addEventListener('input', renderPreview); renderPreview();
    const choices = element('fieldset', 'alg-featured-choices'); choices.append(element('legend', '', '精选笔记（可多选）'));
    const visiblePaths = new Set(options.notes.flatMap(note => typeof note.path === 'string' ? [note.path] : []));
    const chosen = new Set(current?.featuredNotePaths || options.notes.filter(note => note.featured === true).flatMap(note => typeof note.path === 'string' ? [note.path] : []));
    for (const note of options.notes) {
      if (typeof note.path !== 'string') continue;
      const row = element('label', 'alg-featured-choice'), check = element('input'); check.type = 'checkbox'; check.value = note.path; check.checked = chosen.has(note.path); check.name = 'featuredNotePaths';
      check.addEventListener('change', () => { if (check.checked) chosen.add(check.value); else chosen.delete(check.value); });
      row.append(check, element('span', '', String(note.title || '未命名笔记'))); choices.append(row);
    }
    for (const path of [...chosen].filter(path => !visiblePaths.has(path))) {
      const row = element('label', 'alg-featured-choice alg-featured-unavailable'), check = element('input'); check.type = 'checkbox'; check.checked = true; check.name = 'featuredNotePaths'; check.value = path;
      check.addEventListener('change', () => { if (check.checked) chosen.add(path); else chosen.delete(path); });
      row.append(check, element('span', '', '其他范围或已不可用的精选引用（取消勾选可移除）')); choices.append(row);
    }
    if (!visiblePaths.size) choices.append(element('p', 'alg-inline-empty', '当前范围暂无可新增的精选。不可用的旧引用可在上方移除。'));
    const error = element('p', 'alg-inline-error'); error.hidden = true; error.setAttribute('role', 'alert');
    let busy = false;
    function close(): void { if (busy) return; dialog.close(); dialog.remove(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); }
    const actions = element('div', 'alg-leaf-editor-actions'), cancel = button('取消', 'alg-button', close), save = element('button', 'alg-button alg-button-primary', '保存'); save.type = 'submit'; actions.append(cancel, save);
    form.append(header, label, preview, choices, error, actions); dialog.append(form); root.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return; const text = introduction.value;
      if (new TextEncoder().encode(text).length > 100000 || chosen.size > 100) { error.textContent = '简介最多100000字节，精选最多100篇。'; error.hidden = false; return; }
      // Unseen curated paths from the other scope are kept instead of silently cleared.
      busy = true; error.hidden = true; form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input,textarea,button').forEach(n => { n.disabled = true; });
      try { const saved = await options.onSave!({ nodeId: options.node.id, introduction: text, featuredNotePaths: [...chosen], sha: current?.sha || null, ...(current?.storageNodeId ? { storageNodeId: current.storageNodeId } : {}) }); current = saved; busy = false; close(); render(); }
      catch (cause) { busy = false; error.textContent = cause instanceof Error ? cause.message : '保存失败，请重试'; error.hidden = false; form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input,textarea,button').forEach(n => { n.disabled = false; }); }
    }); dialog.showModal(); introduction.focus();
  }
  render(); return root;
}
