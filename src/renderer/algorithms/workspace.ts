import { AlgorithmDirectory } from './directory.js';
import { AlgorithmBrowser } from './browser.js';
import { LearningPath } from './learning-path.js';
/** Algorithm app integration with the browser and learning-route renderers. */
type Options = import('../../../types/algorithm-workspace').AlgorithmWorkspaceOptions;
type Controller = import('../../../types/algorithm-workspace').AlgorithmWorkspaceController;
type AlgorithmDirectoryNode = import('../../shared/models/algorithm-directory').AlgorithmDirectoryNode;
type AppFlatNode = import('../../../types/app').AppFlatNode;
type AppRecord = import('../../../types/app').AppRecord;
type AppSelectorMap = import('../../../types/app').AppSelectorMap;
type AlgorithmBrowserController = import('../../../types/algorithm-browser').AlgorithmBrowserController;
type LearningPathController = import('../../../types/learning-path').LearningPathController;
type LearningPathSavedProgress = import('../../../types/learning-path').LearningPathSavedProgress;
type LearningPathNote = import('../../../types/learning-path').LearningPathNote;
type WorkspaceSelector = '#algorithm-panel' | '#algorithm-topic-form' | '#algorithm-topic-difficulty' | '#algorithm-topic-submit' | '#algorithm-topic-parent' | '#algorithm-topic-kind-hint' | '#algorithm-topic-error' | '#algorithm-topic-dialog' | '#algorithm-note-form' | '#algorithm-note-error' | '#algorithm-note-dialog';

export function createAlgorithmWorkspace(options: Options): Controller {
  const global = window;
  const { getAlgorithmNotes, setAlgorithmNotes, getAlgorithmTopics, setAlgorithmTopics, getAlgorithmTree, setAlgorithmTree, getAccount, getPermissions, getLocal, getBusy, getReadingDetail, accountId, repo, uuid, setBusy, persistLocal, call, render, renderMarkdown, authorName, date, tags, toast, errorMessage } = options;
  const $ = <S extends WorkspaceSelector>(selector: S): AppSelectorMap[S] | null => document.querySelector<AppSelectorMap[S]>(selector);
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function append<T extends HTMLElement>(parent: T, ...children: (Node | null | undefined | false)[]): T { children.filter(Boolean).forEach(child => parent.append(child as Node)); return parent; }
  function button(label: string, className: string, action: (event: MouseEvent) => unknown) { const node = element('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
  let algorithmSelectedNode: string | null = 'root';
  function flattenTree(node: AlgorithmDirectoryNode, depth = 0, parent: string | null = null, out: AppFlatNode[] = []) { out.push({ ...node, depth, parent }); (node.children || []).forEach(child => flattenTree(child, depth + 1, node.id, out)); return out; }
  function algorithmNodes() { return flattenTree(getAlgorithmTree()); }
  let algorithmMode = 'tree';
  let algorithmPendingTopic: string | null = null;
  let algorithmController: AlgorithmBrowserController | null = null;
  let learningController: LearningPathController | null = null;
  function learningProgressKey() { return JSON.stringify([repo(), accountId() || 'anonymous', global.QMX_ALGORITHM_LEARNING_PATH?.id || 'xcpc-learning']); }
  function setAlgorithmMode(mode: string) { if (getBusy()) return; algorithmMode = mode; renderAlgorithmNotes(); }
  function openLearningTopic(id: string) { algorithmPendingTopic = id; setAlgorithmMode('tree'); }
  async function saveLearningProgress(value: LearningPathSavedProgress) {
    if (getBusy()) throw new Error('请等待当前操作完成后再保存学习进度');
    const id = learningProgressKey(), previous = getLocal().learningPaths?.[id];
    setBusy(true);
    getLocal().learningPaths = { ...(getLocal().learningPaths || {}), [id]: structuredClone(value) };
    try { await persistLocal(); }
    catch (error) {
      if (previous === undefined) delete getLocal().learningPaths![id];
      else getLocal().learningPaths![id] = previous;
      throw error;
    } finally { setBusy(false); }
  }
  function renderAlgorithmNotes() {
    getReadingDetail()?.closeAll();
    const panel = $('#algorithm-panel')!;
    algorithmController?.destroy(); learningController?.destroy(); learningController = null;
    panel.replaceChildren();
    const modes = element('div', 'algorithm-view-modes'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', '算法学习方式');
    for (const [mode, title] of [['tree', '知识树'], ['path', '闯关学习']]) {
      const control = button(title, 'button secondary', () => setAlgorithmMode(mode)); control.dataset.mode = mode; control.setAttribute('aria-pressed', String(algorithmMode === mode)); modes.append(control);
    }
    panel.append(modes); const host = element('div', 'algorithm-view-content'); panel.append(host);
    if (algorithmMode === 'path') {
      learningController = LearningPath.render({ host, tree: getAlgorithmTree(), curriculum: global.QMX_ALGORITHM_LEARNING_PATH,
        progress: getLocal().learningPaths?.[learningProgressKey()] || { gates: {} }, progressKey: learningProgressKey(), account: getAccount(), notes: getAlgorithmNotes() as LearningPathNote[], canUpload: Boolean(getAccount() && getPermissions().push),
        onProgress: saveLearningProgress, onTopic: openLearningTopic,
        onNote: openAlgorithmNoteDetail,
        onUpload: id => { algorithmSelectedNode = id; openAlgorithmNoteEditor(); }, toast });
      return;
    }
    algorithmController = AlgorithmBrowser.render({
      host, tree: getAlgorithmTree(), notes: getAlgorithmNotes(),
      onLearningPath(id) { setAlgorithmMode('path'); learningController?.selectTopic?.(id); },
      scope: panel.dataset.scope || 'public', account: getAccount(),
      canUpload: Boolean(getAccount() && getPermissions().push),
      canManage: Boolean(getAccount() && getPermissions().admin),
      onAddTopic: openAlgorithmTopicEditor,
      onScopeChange(scope) {
        if (scope === 'personal' && !getAccount()) { toast('请先登录 GitHub 账户'); return; }
        panel.dataset.scope = scope; renderAlgorithmNotes();
      },
      onSelect(id) { algorithmSelectedNode = id; },
      onUpload(id) { algorithmSelectedNode = id; openAlgorithmNoteEditor(); },
      renderMarkdown, authorName, formatDate: date
    });
    if (algorithmPendingTopic) { const id = algorithmPendingTopic; algorithmPendingTopic = null; algorithmController.selectNode(id); }
  }
  let algorithmTopicRequest: string | null = null;
  function updateAlgorithmTopicKind() {
    const form = $('#algorithm-topic-form')!, directory = form.elements.kind.value === 'directory';
    $('#algorithm-topic-difficulty')!.hidden = directory;
    form.elements.color.disabled = directory; form.elements.color.required = !directory;
    $('#algorithm-topic-submit')!.textContent = directory ? '保存目录' : '保存算法';
  }
  document.querySelector('#algorithm-topic-form [name="kind"]')!.addEventListener('change', updateAlgorithmTopicKind);
  function openAlgorithmTopicEditor(parentId: string) {
    if (!getAccount() || !getPermissions().admin) return;
    const parent = algorithmNodes().find(node => node.id === parentId); if (!parent) return;
    const form = $('#algorithm-topic-form')!; form.reset(); form.elements.parentId.value = parent.id;
    $('#algorithm-topic-parent')!.textContent = parent.fullLabel || parent.label;
    updateAlgorithmTopicKind();
    $('#algorithm-topic-kind-hint')!.textContent = parent.kind === 'algorithm'
      ? '添加子项后，此节点将保留为目录，原算法及难度移入同名子项。目录也可以上传笔记。'
      : '算法需要选择难度；目录不设置难度，也可以上传笔记。';
    $('#algorithm-topic-error')!.hidden = true; algorithmTopicRequest = uuid();
    $('#algorithm-topic-dialog')!.showModal(); form.elements.label.focus();
  }
  $('#algorithm-topic-form')!.addEventListener('submit', async event => {
    event.preventDefault(); if (getBusy() || !getPermissions().admin || !getAccount()) return;
    const form = event.currentTarget as AppSelectorMap['#algorithm-topic-form'], data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true); $('#algorithm-topic-error')!.hidden = true;
    try {
      const topic = await call('saveAlgorithmTopic', { repo: repo(), parentId: data.parentId, label: data.label.trim(), fullLabel: data.fullLabel.trim() || data.label.trim(), kind: data.kind, color: data.kind === 'directory' ? 'parent' : data.color, scope: data.scope.trim(), requestId: algorithmTopicRequest });
      setAlgorithmTopics([...(getAlgorithmTopics() || []).filter(record => record.id !== topic.id), topic]);
      setAlgorithmTree(AlgorithmDirectory.hydrate(global.QMX_ALGORITHM_TREE, getAlgorithmTopics()));
      algorithmSelectedNode = topic.id as string; $('#algorithm-topic-dialog')!.close();
      renderAlgorithmNotes(); algorithmController?.selectNode?.(topic.id as string);
      toast(topic.kind === 'directory' ? '目录已添加，可继续添加子项或上传笔记' : '算法已添加，可继续上传笔记');
    } catch (error) { $('#algorithm-topic-error')!.textContent = errorMessage(error); $('#algorithm-topic-error')!.hidden = false; }
    finally { setBusy(false); }
  });
  function isMineNote(note: AppRecord) { return accountId() !== null && String(note.authorId || '') === accountId(); }
  function openAlgorithmNoteDetail(note: LearningPathNote, { gateId }: { gateId?: string } = {}) {
    const holder = element('div', 'alg-browser'), pane = element('div', 'alg-pane'); holder.hidden = true;
    const article = element('article', 'alg-reading'), title = element('h2', 'alg-reading-title', note.title || '未命名笔记');
    const meta = element('div', 'alg-note-meta');
    if (note.featured) meta.append(element('span', 'alg-featured', '精选'));
    append(meta, element('span', 'alg-note-author', authorName(note.author)), element('span', '', date(note.updatedAt)));
    const body = element('div', 'markdown-body alg-markdown'); renderMarkdown(body, note.body);
    append(article, title, meta, tags(note), body); pane.append(article); holder.append(pane); $('#algorithm-panel')!.append(holder);
    const path = [];
    const stage = global.QMX_ALGORITHM_LEARNING_PATH?.stages!.find(item => item.gates!.some(gate => gateId ? gate.id === gateId : gate.topicIds!.includes(note.nodeId)));
    const gate = stage?.gates!.find(item => gateId ? item.id === gateId : item.topicIds!.includes(note.nodeId));
    path.push({ label: '闯关学习', onClick() { getReadingDetail().closeAll(); } });
    if (stage) path.push({ label: `第${stage.index}章 ${stage.title}`, onClick() { getReadingDetail().closeAll(); if (gate) learningController?.selectGate(gate.id); } });
    if (gate) path.push({ label: gate.title!, onClick() { noteDetail?.close(); } });
    path.push({ label: note.title || '未命名笔记' });
    const noteDetail = getReadingDetail().open({ content: pane, title: '算法笔记详情', path, onClose() { holder.remove(); } });
  }
  function openAlgorithmNoteEditor() { if (!getAccount() || !getPermissions().push) { toast('请先登录具有仓库写入权限的 GitHub 账户'); return; } const form=$('#algorithm-note-form')!; form.reset(); const node=form.elements.nodeId as unknown as HTMLSelectElement; node.replaceChildren(...algorithmNodes().map(n=>{const o=element('option','',n.label);o.value=n.id;return o;})); node.value=algorithmSelectedNode!; form.elements.noteScope.value=getPermissions().admin ? 'public' : 'personal'; form.elements.noteScope.disabled=!getPermissions().admin; $('#algorithm-note-error')!.hidden=true; $('#algorithm-note-dialog')!.showModal(); }
  $('#algorithm-note-form')!.addEventListener('submit', async event => { event.preventDefault(); const form=event.currentTarget as AppSelectorMap['#algorithm-note-form'];if(getBusy())return;const data=Object.fromEntries(new FormData(form)) as Record<string, string>;const note={title:data.noteTitle,noteScope:getPermissions().admin ? form.elements.noteScope.value : 'personal',nodeId:data.nodeId,tags:String(data.noteTags||'').split(/[,，、]/).map(x=>x.trim()).filter(Boolean),body:data.body,featured:data.featured === 'on',clientId:uuid(),repo:repo()};setBusy(true);try{const result=await call('saveAlgorithmNote',note);setAlgorithmNotes([...getAlgorithmNotes().filter(x=>x.path!==result.path),result]);$('#algorithm-note-dialog')!.close();render();toast('算法笔记已保存')}catch(error){$('#algorithm-note-error')!.textContent=errorMessage(error);$('#algorithm-note-error')!.hidden=false}finally{setBusy(false)}});
  function setSelectedNode(id: string | null) { algorithmSelectedNode = id; }
  function resetRepository() { setAlgorithmNotes([]); setAlgorithmTopics([]); setAlgorithmTree(AlgorithmDirectory.hydrate(global.QMX_ALGORITHM_TREE, [])); }
  return { get algorithmSelectedNode() { return algorithmSelectedNode; }, get algorithmMode() { return algorithmMode; }, get algorithmPendingTopic() { return algorithmPendingTopic; }, get learningController() { return learningController; }, get algorithmTopicRequest() { return algorithmTopicRequest; }, setSelectedNode, algorithmNodes, learningProgressKey, setAlgorithmMode, openLearningTopic, saveLearningProgress, renderAlgorithmNotes, updateAlgorithmTopicKind, openAlgorithmTopicEditor, isMineNote, openAlgorithmNoteDetail, openAlgorithmNoteEditor, resetRepository };
}
