import type { Trick, SaveTrickInput, DeleteTrickInput } from '../../shared/models/trick.js';

export interface TrickContext {
  sourceKey: string;
  repo: string;
  accountId: string | null;
  displayName: string;
  canCreate: boolean;
  admin: boolean;
}
export interface TrickWorkspaceOptions {
  host: HTMLElement;
  getItems: () => readonly Trick[];
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
interface TrickDraft { clientId: string; baseSha: string; title: string; introduction: string; body: string }
function draftKey(context: TrickContext, path = 'new'): string { return `qmx.trick-draft.v1:${JSON.stringify([context.sourceKey, context.accountId, path])}`; }
function readDraft(key: string): TrickDraft | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    if (typeof row.clientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.clientId) || typeof row.baseSha !== 'string' || typeof row.title !== 'string' || typeof row.introduction !== 'string' || typeof row.body !== 'string' || bytes(row.title) > 1000 || bytes(row.introduction) > 10000 || bytes(row.body) > 1000000) return null;
    return { clientId: row.clientId, baseSha: row.baseSha, title: row.title, introduction: row.introduction, body: row.body };
  } catch { return null; }
}

/** D layout: a compact directory; Markdown is mounted only after opening a trick. */
export function createTrickWorkspace(options: TrickWorkspaceOptions) {
  const host = options.host;
  host.classList.remove('section-placeholder'); host.classList.add('tricks-workspace'); host.setAttribute('aria-label', 'Trick 集');
  let scope = '', query = '', selected: string | null = null, listScroll = 0;
  let editor: HTMLDialogElement | null = null;
  let list: HTMLElement | null = null;
  let search: HTMLInputElement | null = null;
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
  function reset(): void { scope = ''; query = ''; selected = null; listScroll = 0; }
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
    const draftNotice = el('section', 'trick-draft-notice');
    draftNotice.hidden = !draft;
    draftNotice.append(el('p', '', staleDraft ? '已恢复本机草稿，但远端版本已更新。请先对照最新内容，再确认使用草稿保存。' : '已恢复本机草稿。关闭编辑会保留输入，仅在发布成功或主动丢弃后清除。'));
    const acceptLatest = el('input'); acceptLatest.type = 'checkbox'; acceptLatest.setAttribute('aria-label', '已核对最新远端，使用草稿保存');
    if (staleDraft && item) {
      const compare = el('details'), summary = el('summary', '', '查看最新远端内容'), latest = el('pre', 'trick-conflict-latest', `${item.title}\n\n${item.introduction}\n\n${item.body}`); compare.append(summary, latest);
      const consent = el('label', 'checkbox-field'); consent.append(acceptLatest, el('span', '', '已核对最新远端，使用草稿保存')); draftNotice.append(compare, consent);
    }
    const controls = el('div', 'trick-form-actions'), cancel = action('保存草稿并关闭', 'button secondary', () => close()), submit = el('button', 'button primary', item ? '保存修改' : '发布 Trick'); submit.type = 'submit';
    controls.append(action('丢弃草稿', 'button subtle', () => { try { localStorage.removeItem(key); } catch { /* The in-memory editor can still be closed explicitly. */ } close(false); }), cancel, submit);
    function storeDraft(): boolean {
      if (bytes(title.value) > 1000 || bytes(intro.value) > 10000 || bytes(body.value) > 1000000) {
        error.textContent = '内容超过草稿保存上限，请先缩短或复制到其他位置。当前编辑仍保留，不能直接保存草稿关闭。'; error.hidden = false; return false;
      }
      try { localStorage.setItem(key, JSON.stringify({ clientId, baseSha, title: title.value, introduction: intro.value, body: body.value })); return true; }
      catch { error.textContent = '本机草稿存储不可用，请复制内容后再丢弃关闭。'; error.hidden = false; return false; }
    }
    form.addEventListener('input', storeDraft);
    form.append(heading, destination, draftNotice, field('标题', title), field('简介', intro), bodyField, error, controls); dialog.append(form); document.body.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    form.addEventListener('submit', event => { event.preventDefault(); void (async () => {
      if (saving || options.getBusy()) return;
      const input = { title: title.value.trim(), introduction: intro.value.trim(), body: body.value };
      let problem = '';
      if (!sameContext(context, options.getContext()) || !options.getContext().canCreate) problem = '账号或资料库已变化，草稿仍保留，请复制后重新打开。';
      else if (staleDraft && !acceptLatest.checked) problem = '远端版本已变化，请先核对最新内容并勾选确认。';
      else if (!input.title || !input.introduction || !input.body.trim()) problem = '请填写标题、简介和具体内容。';
      else if (bytes(input.title) > 600 || bytes(input.introduction) > 6000) problem = '标题最多 600 字节，简介最多 6000 字节。';
      else if (bytes(input.body) > 1000000) problem = '具体内容最多 1000000 字节。';
      if (problem) { error.textContent = problem; error.hidden = false; return; }
      if (staleDraft && acceptLatest.checked && item) baseSha = item.sha;
      if (!storeDraft()) return;
      saving = true; options.setBusy(true); error.hidden = true;
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input,textarea,button').forEach(node => { node.disabled = true; });
      try {
        const saved = await options.save({ ...input, clientId, repo: context.repo, sourceKey: context.sourceKey, ...(item ? { path: item.path, sha: baseSha } : {}) });
        if (sameContext(context, options.getContext())) { options.setItems([saved, ...options.getItems().filter(row => row.path !== saved.path)]); selected = saved.path; }
        try { localStorage.removeItem(key); } catch { /* A successful server save remains authoritative. */ }
        saving = false; close(false); render(); options.toast(item ? 'Trick 已更新' : 'Trick 已发布');
      } catch (cause) { error.textContent = options.errorMessage(cause); error.hidden = false; }
      finally { saving = false; options.setBusy(false); form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input,textarea,button').forEach(node => { node.disabled = false; }); }
    })(); });
    dialog.showModal(); title.focus();
  }
  function renderRows(): void {
    if (!list) return;
    list.replaceChildren();
    const value = query.trim().toLocaleLowerCase();
    const all = items(), visible = all.filter(item => `${item.title} ${authorName(item)} ${item.introduction}`.toLocaleLowerCase().includes(value));
    const count = host.querySelector('.tricks-count'); if (count) count.textContent = value ? `${visible.length} / ${all.length} 条` : `${all.length} 条`;
    if (!visible.length) {
      const empty = el('div', 'tricks-empty'); empty.append(el('h3', '', value ? '没有匹配的 Trick' : '还没有 Trick'), el('p', '', value ? '试试其他标题、作者或简介关键词。' : '把解题时的一个小观察，整理成队友也能读懂的技巧。'));
      if (!value && !options.getContext().canCreate) empty.append(el('p', '', '同步当前资料库，或使用有写入权限的 GitHub 账号发布。'));
      list.append(empty); return;
    }
    const head = el('div', 'tricks-columns'); head.setAttribute('aria-hidden', 'true');
    ['#', '标题', '作者', '简介', ''].forEach(label => head.append(el('span', '', label))); list.append(head);
    const rows = el('ul', 'tricks-directory');
    visible.forEach((item, index) => {
      const li = el('li'), row = action('', 'trick-row', () => open(item)); row.dataset.path = item.path; row.setAttribute('aria-label', `打开 ${item.title}，作者 ${authorName(item)}`);
      const title = el('span', 'trick-row-title', item.title); title.title = item.title;
      const intro = el('span', 'trick-row-intro', item.introduction); intro.title = item.introduction;
      row.append(el('span', 'trick-row-number', String(index + 1).padStart(2, '0')), title, author(item), intro, el('span', 'trick-row-arrow', '↗'));
      li.append(row); rows.append(li);
    }); list.append(rows);
  }
  function render(): void {
    const context = options.getContext(), identity = `${context.sourceKey}|${context.accountId || ''}`;
    if (scope !== identity) { scope = identity; query = ''; selected = null; }
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
      reader.append(top, el('h2', 'trick-reader-title', item.title), author(item), intro, body); host.append(reader); return;
    }
    selected = null;
    const toolbar = el('div', 'tricks-toolbar');
    const label = el('label', 'tricks-search'); label.append(el('span', '', '⌕'));
    search = el('input'); search.type = 'search'; search.placeholder = '搜索标题、作者或简介'; search.setAttribute('aria-label', '搜索 Trick'); search.value = query;
    search.addEventListener('input', () => { query = search?.value || ''; renderRows(); }); label.append(search);
    toolbar.append(label, el('span', 'tricks-count'));
    if (context.canCreate) toolbar.append(action('＋ 新增 Trick', 'button primary trick-create', () => edit()));
    host.append(toolbar); list = el('div', 'tricks-list'); host.append(list); renderRows();
  }
  return { render, reset, openEditor: () => edit(), isReading: () => selected !== null, closeDetail, focusSearch: () => search?.focus(), hasEditor: () => editor?.open === true };
}
