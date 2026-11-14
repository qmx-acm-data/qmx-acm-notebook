import { Search } from '../lib/search.js';
/** Record previews, focused reading, and issue comments; the app supplies persistence and editing. */
type Options = import('../../../types/library-reader').LibraryReaderOptions;
type Controller = import('../../../types/library-reader').LibraryReaderController;
type AppRecord = import('../../../types/app').AppRecord;
type AppQuery = import('../../../types/app').AppQuery;
type AppQueryAll = import('../../../types/app').AppQueryAll;

export function createLibraryReader(options: Options): Controller {
  const global = window;
  const { demo, stateLabels, getLocal, setLocal, getAccount, getPermissions, getView, getLibraryScope, getSelected, setSelected, getComments, getBusy, setBusy, getLoading, getError, getRecords, key, isLocal, visibleLocal, canEditRemote, sameRepo, platformCode, authorName, date, quotaBlocked, renderMarkdown, persistLocal, call, render, clearFilters, openSubmit, openLocalSolution, deleteRecord, deleteDiscussion, openExternal, toast, errorMessage } = options;
  const $: AppQuery = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
  const $$: AppQueryAll = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(selector));
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function append<T extends HTMLElement>(parent: T, ...children: (Node | null | undefined | false)[]): T { children.filter(Boolean).forEach(child => parent.append(child as Node)); return parent; }
  function button(label: string, className: string, action: (event: MouseEvent) => unknown) { const node = element('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
  function favorite(record: AppRecord) { return getLocal().favorites.some(value => String(value) === key(record)); }
  function mastery(record: AppRecord) { return stateLabels[getLocal().mastery[key(record)]] ? getLocal().mastery[key(record)] : 'unreviewed'; }
  function badge(record: AppRecord) { return element('span', `badge ${isLocal(record) ? 'local' : 'shared'}`, isLocal(record) ? record.proposalUrl ? '旧版已投稿副本' : '仅本地 · 未上传' : record.kind === 'document' ? '正式题解' : '讨论 Issue'); }
  function platformLabel(record: AppRecord) { const code = platformCode(record.platform); const names: Record<string, string> = { CF: 'Codeforces', AT: 'AtCoder', LG: '洛谷', NC: '牛客', LC: 'LeetCode' }; const label = element('span', 'platform-label', names[code] || record.platform || '其他平台'); label.dataset.platform = ['CF', 'AT', 'LG', 'NC', 'LC'].includes(code) ? code : 'Oth'; return label; }
  function supplementaryDifficultyBadge(record: AppRecord) {
    if (platformCode(record.platform) === 'LG' || !record.luoguDifficulty) return element('span');
    const info = Search.difficulty({ platform:'LG', difficulty:record.luoguDifficulty });
    return element('span', `difficulty-badge tone-${info.tone}`, `洛谷 · ${record.luoguDifficulty}`);
  }
  function difficultyBadge(record: AppRecord) {
    const {tone,rank,label:text} = Search.difficulty(record);
    if (!text) return null;
    const code = Search.normalizePlatform(record.platform);
    const label = element('span', `difficulty-badge tone-${tone}${rank ? ` rank-${rank}` : ''}`, text);
    label.title = `${demo ? '演示值 · ' : ''}${code === 'CF' ? 'Codeforces 原生 Rating 色阶' : code === 'LG' ? '洛谷原生难度名称 · 颜色仅用于界面展示' : '平台原始数值 / 难度'}，不跨平台换算`;
    return label;
  }
  function tags(record: AppRecord) { const row = element('div', 'tag-row'); (Array.isArray(record.tags) ? record.tags : []).forEach(tag => { let hash = 0; for (const char of String(tag)) hash = (hash + char.codePointAt(0)!) % 5; row.append(element('span', `tag tag-color-${hash}`, tag)); }); return row; }
  function empty(title: string, description: string, action?: { label: string; fn: (event: MouseEvent) => unknown }) { const box = element('div', 'empty-state'); append(box, element('div', 'empty-icon', '⌑'), element('h3', '', title), element('p', '', description)); if (action) box.append(button(action.label, 'button secondary', action.fn)); return box; }
  let focusedDetail = false;
  let readerPosition: { window: number; list: number; panel: number; focus: Element | null } | null = null;
  let commentRequest = 0;
  function openDetail(record: AppRecord) {
    if (focusedDetail) return;
    setSelected(key(record)); readerPosition = { window: global.scrollY, list: $('#record-list')!.scrollTop, panel: $('#detail-panel')!.scrollTop, focus: document.activeElement };
    focusedDetail = true; document.body.classList.add('reading-detail'); render(); $('#detail-back-button')?.focus(); global.scrollTo(0, 0);
  }
  function resetDetail() { focusedDetail = false; document.body.classList.remove('reading-detail'); }
  function isFocusedDetail() { return focusedDetail; }
  function closeDetail() {
    resetDetail(); render();
    if (readerPosition) { $('#record-list')!.scrollTop = readerPosition.list; $('#detail-panel')!.scrollTop = readerPosition.panel; global.scrollTo(0, readerPosition.window); const card = $$('.record-card').find(n => n.dataset.key === getSelected()); card?.focus({ preventScroll: true }); }
  }
  function renderFocusedDetail() {
    if (!focusedDetail) return false;
    const selected = getRecords().find(record => key(record) === getSelected());
    if (selected) { renderDetail(selected); return true; }
    resetDetail(); return false;
  }
  function renderLibrary(items: AppRecord[]) {
    if (!items.some(record => key(record) === getSelected())) setSelected(items[0] ? key(items[0]) : null);
    const list = $('#record-list')!; list.replaceChildren();
    items.forEach(record => {
      const card = button('', `record-card${key(record) === getSelected() ? ' selected' : ''}`, () => { setSelected(key(record)); $$('.record-card').forEach(n => { const active = n.dataset.key === getSelected(); n.classList.toggle('selected', active); n.setAttribute('aria-pressed', String(active)); }); renderDetail(record); }); card.dataset.key = key(record); card.title = '单击预览，双击打开详情；Enter 打开详情'; card.setAttribute('aria-pressed', key(record) === getSelected() ? 'true' : 'false');
      card.addEventListener('dblclick', () => openDetail(record));
      card.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); openDetail(record); } });
      append(card, append(element('div', 'card-meta'), platformLabel(record), element('span', '', record.pid || `#${record.number || '本地'}`), difficultyBadge(record), supplementaryDifficultyBadge(record), badge(record)), element('h2', 'card-title', record.title || '未命名错题'), tags(record), append(element('div', 'card-footer'), element('span', `card-state ${mastery(record)}`, stateLabels[mastery(record)]), element('span', '', `${favorite(record) ? '★ · ' : ''}${date(record.updatedAt)}`)));
      list.append(card);
    });
    if (!items.length) list.append(empty(getLoading() ? '正在载入题库' : getView() === 'public' && getLibraryScope() === 'local' ? '还没有本地题解' : '这里还没有题目', getLoading() ? '等待客户端返回你的学习数据。' : '试试调整筛选，或记下第一道值得回顾的错题。', { label: '清空筛选', fn: clearFilters }));
    const record = items.find(item => key(item) === getSelected());
    if (record) renderDetail(record);
    else {
      const quota = quotaBlocked();
      $('#detail-panel')!.replaceChildren(empty('给思考留一个位置', quota ? 'GitHub 请求额度已用完，登录 GitHub 账户后即可同步题库，或先保存一道本地错题。' : getError() ? '客户端连接暂不可用。你可以重试同步，或先保存一道本地错题。' : getView() === 'favorites' ? '点击题目详情中的收藏，把想反复理解的思路留在这里。' : '从左侧选择题目，阅读分析、记录理解，再迈进一步。', { label: '＋ 记一道错题', fn: () => openSubmit() }));
    }
  }
  async function changeLocal(change: () => void) { if (getBusy()) return; setBusy(true); const before = structuredClone(getLocal()); change(); render(); try { await persistLocal(); } catch (error) { setLocal(before); render(); toast(`未能保存：${errorMessage(error)}`); } finally { setBusy(false); } }
  function renderDetail(record: AppRecord) {
    const panel = $('#detail-panel')!; const scroll = panel.scrollTop; panel.replaceChildren();
    if (focusedDetail) { const back = button('← 返回题目网格', 'button secondary detail-back', closeDetail); back.id = 'detail-back-button'; panel.append(back); } else { const open = button('打开详情 ↗', 'button primary detail-open', () => openDetail(record)); open.id = 'open-detail-button'; panel.append(open); }
    const actions = append(element('div', 'detail-actions'), button(favorite(record) ? '★ 已收藏' : '☆ 收藏', 'button secondary', () => changeLocal(() => { getLocal().favorites = favorite(record) ? getLocal().favorites.filter(value => String(value) !== key(record)) : [...getLocal().favorites, key(record)]; })), button('原题 ↗', 'button subtle', () => openExternal(record.problemUrl || record.url)));
    if (record.kind === 'document') {
      const localSolution = button('＋ 本地题解', 'button subtle public-local-solution', () => openLocalSolution(record));
      localSolution.id = 'local-solution-button'; localSolution.title = '为这道题写自己的本地题解；已有本地记录时继续编辑';
      actions.append(localSolution);
    }
    append(panel, append(element('div', 'detail-top'), append(element('div', 'detail-meta'), platformLabel(record), element('span', '', record.pid || `#${record.number || '本地'}`), difficultyBadge(record), supplementaryDifficultyBadge(record), badge(record)), actions), element('h2', 'detail-title', record.title || '未命名错题'));
    const author = authorName(record.author); append(panel, append(element('div', 'author-row'), element('span', 'mini-avatar', author.slice(0, 1)), element('span', '', author), element('span', 'separator', '·'), element('span', '', `更新于 ${date(record.updatedAt)}`), record.kind === 'document' ? element('span', 'badge document', '正式题解') : null));
    const tagrow = tags(record); tagrow.classList.add('detail-tags'); append(panel, tagrow, element('hr', 'detail-divider'), element('div', 'body-label', '思路与复盘'));
    const body = element('div', 'markdown-body'); renderMarkdown(body, record.body); panel.append(body);
    const masteryButtons = element('div', 'mastery-buttons'); Object.entries(stateLabels).forEach(([value, label]) => { const control = button(label, mastery(record) === value ? 'active' : '', () => changeLocal(() => { getLocal().mastery[key(record)] = value; })); control.setAttribute('aria-pressed', mastery(record) === value ? 'true' : 'false'); masteryButtons.append(control); });
    append(panel, append(element('div', 'mastery-box'), append(element('div'), element('strong', '', '这个思路，掌握了吗？'), element('small', '', '复习进度仅记录在你的学习空间')), masteryButtons));
    const edits = element('div', 'record-edit-actions');
    if (record.proposalUrl) edits.append(button('旧版已投稿副本 · 查看投稿 ↗', 'button secondary', () => openExternal(record.proposalUrl)));
    if (isLocal(record) && visibleLocal(record) || canEditRemote(record)) { const edit = button(isLocal(record) ? '编辑本地记录' : '编辑正式题解', 'button secondary', () => openSubmit(record)); edit.id = 'edit-record-button'; const remove = button(isLocal(record) ? '删除本地记录' : '删除正式题解', 'button danger', () => deleteRecord(record)); remove.id = 'delete-record-button'; append(edits, edit, remove); }
    if (record.kind === 'issue' && sameRepo(record) && getAccount() && getPermissions().admin === true) {
      const remove = button('永久删除讨论 Issue', 'button danger', () => deleteDiscussion(record)); remove.id = 'delete-issue-button'; edits.append(remove);
    }
    panel.append(edits); panel.scrollTop = scroll;
    if (record.kind !== 'issue' || !record.number) return;
    const comments = element('section', 'comments-section'); append(comments, append(element('div', 'section-heading'), element('h3', '', '一起讨论')));
    const commentList = element('div'); comments.append(commentList); panel.append(comments);
    const form = element('form', 'comment-form'); const input = element('textarea'); input.rows = 2; input.placeholder = '分享你的观察，或提出一个问题…'; input.setAttribute('aria-label', '评论内容'); input.required = true; input.maxLength = 10000;
    const submit = element('button', 'button secondary', demo ? '演示评论' : '发表讨论'); submit.type = 'submit'; append(form, input, submit); comments.append(form);
    form.addEventListener('submit', async event => { event.preventDefault(); const body = input.value.trim(); if (!body || getBusy()) return; if (!getAccount() && !demo) { toast('请先登录 GitHub 账户再评论'); return; } if (!navigator.onLine && !demo) { toast('当前离线，请联网后发表评论'); return; } setBusy(true); submit.disabled = true; try { if (demo) { const items = getComments().get(key(record)) || []; getComments().set(key(record), [...items, { author: '我 · 演示', body }]); } else { await call('comment', { number: record.number, repo: record.repo, body }); getComments().delete(key(record)); } input.value = ''; await loadComments(record, commentList); toast(demo ? '演示评论已添加，未向外部发送' : '评论已发表'); } catch (error) { toast(errorMessage(error)); } finally { setBusy(false); submit.disabled = false; } });
    void loadComments(record, commentList);
  }
  async function loadComments(record: AppRecord, container: HTMLElement) {
    const request = ++commentRequest;
    container.replaceChildren(element('div', 'comment-empty', '正在加载讨论…'));
    try {
      let comments = getComments().get(key(record));
      // A numeric comments field is a count, never a preloaded comment list.
      if (!comments) { if (Array.isArray(record.comments)) comments = record.comments; else if (demo) comments = []; else { const response = await call('getComments', record.number); comments = Array.isArray(response) ? response : response?.comments || []; } getComments().set(key(record), comments); }
      if (request !== commentRequest || !container.isConnected) return;
      container.replaceChildren();
      if (!comments.length) container.append(element('div', 'comment-empty', demo ? '演示讨论区 · 留下第一条思考，不会发送到外部。' : '还没有讨论，你的观察也许就是别人的突破口。'));
      comments.forEach(comment => { container.append(append(element('article', 'comment-item'), element('strong', '', authorName(comment.author || comment.user)), element('p', '', comment.body || ''))); });
    } catch (error) { if (container.isConnected) container.replaceChildren(element('div', 'comment-empty', `讨论暂不可用：${errorMessage(error)}`)); }
  }
  return { favorite, mastery, tags, openDetail, closeDetail, resetDetail, isFocusedDetail, renderFocusedDetail, renderLibrary, renderDetail, loadComments, changeLocal };
}
