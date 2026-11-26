import { AlgorithmDirectory } from './directory.js';
import { AlgorithmBrowser } from './browser.js';
import { LearningRoadmap } from './roadmap.js';
import { roadmapData } from './roadmap-data.js';
import { openRoadmapResources } from './roadmap-resources.js';
import { applyCurriculumLayout } from '../../shared/learning-curriculum.js';
import { isAlgorithmLeaf, resolveAlgorithmLeaf } from '../../shared/algorithm-leaf.js';
import { noteFavoriteControl } from './note-favorite.js';
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
type WorkspaceSelector = Extract<keyof AppSelectorMap, `#algorithm-${string}`>;
type AlgorithmBrowserNote = import('../../../types/algorithm-browser').AlgorithmBrowserNote;
type AlgorithmTopic = import('../../shared/models/algorithm-directory').AlgorithmDirectoryTopic;
type AlgorithmDirectoryOverride = import('../../shared/models/algorithm-directory').AlgorithmDirectoryOverride;
type NoteScope = import('../../../types/algorithm-browser').AlgorithmBrowserScope;
type MutationContext = { repo: string; sourceKey: string; owner: string | null };
type TopicFields = { parentId: string; kind: 'algorithm' | 'directory'; label: string; fullLabel: string; color: string; scope: string };
type TopicTarget = { id: string; expected: TopicFields; overrideIds?: string[] };
type NoteTarget = AppRecord & { path: string; sha: string; noteScope: NoteScope };
type NoteOrigin = { view: 'tree'; fullscreen: boolean } | { view: 'path'; gateId?: string } | { view: 'favorites' };
type DeleteTarget = { kind: 'topic'; topic: TopicTarget } | { kind: 'note'; note: NoteTarget; origin: NoteOrigin };

export function createAlgorithmWorkspace(options: Options): Controller {
  const global = window;
  const { getAlgorithmNotes, setAlgorithmNotes, getAlgorithmTopics, setAlgorithmTopics, getAlgorithmOverrides, setAlgorithmOverrides, getAlgorithmTree, setAlgorithmTree, getAccount, getPermissions, getLocal, getBusy, getReadingDetail, accountId, repo, uuid, setBusy, persistLocal, call, render, renderMarkdown, authorName, date, tags, toast, errorMessage } = options;
  const $ = <S extends WorkspaceSelector>(selector: S): AppSelectorMap[S] | null => document.querySelector<AppSelectorMap[S]>(selector);
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function append<T extends HTMLElement>(parent: T, ...children: (Node | null | undefined | false)[]): T { children.filter(Boolean).forEach(child => parent.append(child as Node)); return parent; }
  function button(label: string, className: string, action: (event: MouseEvent) => unknown) { const node = element('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
  function mutationContext(): MutationContext { return { repo: repo(), sourceKey: options.repoSource(), owner: accountId() }; }
  function assertMutationContext(context: MutationContext) {
    const current = mutationContext();
    if (context.repo !== current.repo || context.sourceKey !== current.sourceKey || context.owner !== current.owner) throw new Error('账号或资料来源已改变，请关闭后重试');
  }
  function isGitHubSource() { return options.repoSource().startsWith('https://api.github.com|'); }
  function canManageTopics() { return accountId() !== null && isGitHubSource() && getPermissions().admin === true; }
  function canUploadNotes() { return accountId() !== null && isGitHubSource() && getPermissions().push === true; }
  function showError(selector: '#algorithm-topic-error' | '#algorithm-note-error' | '#algorithm-delete-error', cause: unknown) {
    const error = $(selector)!; error.textContent = errorMessage(cause); error.hidden = false;
  }
  function lockForm(form: HTMLFormElement) {
    const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input, select, textarea, button[type="submit"]'));
    const states = controls.map(control => control.disabled);
    setBusy(true);
    controls.forEach(control => { control.disabled = true; });
    return () => {
      controls.forEach((control, index) => { control.disabled = states[index]; });
      setBusy(false);
    };
  }
  function hasEditor() { return $('#algorithm-topic-dialog')!.open || $('#algorithm-note-dialog')!.open || $('#algorithm-delete-dialog')!.open; }
  let algorithmSelectedNode: string | null = 'root';
  function flattenTree(node: AlgorithmDirectoryNode, depth = 0, parent: string | null = null, out: AppFlatNode[] = []) { out.push({ ...node, depth, parent }); (node.children || []).forEach(child => flattenTree(child, depth + 1, node.id, out)); return out; }
  function algorithmNodes() { return flattenTree(getAlgorithmTree()); }
  async function saveNodeContent(input: Omit<import('../../shared/models/algorithm-node-content').SaveAlgorithmNodeContentInput, 'repo'>) {
    if (getBusy()) throw new Error('请等待当前操作完成');
    if (!getAccount() || getPermissions().admin !== true) throw new Error('只有管理员可以修改简介与精选');
    const source = options.repoSource(), owner = accountId(); setBusy(true);
    try {
      const saved = await options.saveAlgorithmNodeContent({ ...input, repo: repo() });
      if (source !== options.repoSource() || owner !== accountId()) throw new Error('账号或资料来源已改变，请重新同步');
      options.setAlgorithmNodeContents([...options.getAlgorithmNodeContents().filter(content => content.nodeId !== saved.nodeId), saved]); return saved;
    } finally { setBusy(false); }
  }
  async function saveRouteIntroduction(nodeId: string, introduction: string): Promise<void> {
    if (getBusy()) throw new Error('请等待当前操作完成');
    if (!getAccount() || getPermissions().admin !== true) throw new Error('只有管理员可以修改简介');
    const target = `roadmap:${nodeId}`;
    const current = options.getAlgorithmNodeContents().find(item => item.nodeId === target);
    await saveNodeContent({ nodeId: target, introduction, featuredNotePaths: [], sha: current?.sha || null });
  }
  let algorithmMode = 'tree';
  let algorithmPendingTopic: string | null = null;
  let algorithmController: AlgorithmBrowserController | null = null;
  let learningController: LearningPathController | null = null;
  let resources: ReturnType<typeof openRoadmapResources> | null = null;
  let openRoadmapLeaf: ((id: string, scope?: NoteScope) => void) | null = null;
  function effectiveCurriculum() {
    const base = global.QMX_ALGORITHM_LEARNING_PATH;
    const document = options.getLearningCurriculum();
    return base && document ? applyCurriculumLayout(base, document.layout) : base;
  }
  function learningProgressKey() { return JSON.stringify([options.repoSource(), accountId() || 'anonymous', global.QMX_ALGORITHM_LEARNING_PATH?.id || 'xcpc-learning']); }
  function learningProgress(): import('../../../types/learning-path').LearningPathProgress {
    const current = getLocal().learningPaths?.[learningProgressKey()];
    if (current) return current;
    if (options.repoSource().startsWith('https://api.github.com|')) {
      const legacy = JSON.stringify([repo(), accountId() || 'anonymous', global.QMX_ALGORITHM_LEARNING_PATH?.id || 'xcpc-learning']);
      return getLocal().learningPaths?.[legacy] || { gates: {} };
    }
    return { gates: {} };
  }
  async function saveRoadmapProgress(next: import('../../../types/learning-path').LearningPathProgress): Promise<void> {
    if (getBusy()) throw new Error('请等待当前操作完成');
    const key = learningProgressKey(), previous = getLocal().learningPaths?.[key];
    setBusy(true); getLocal().learningPaths = { ...(getLocal().learningPaths || {}), [key]: structuredClone(next) };
    try { await persistLocal(); } catch (error) { if (previous === undefined) delete getLocal().learningPaths![key]; else getLocal().learningPaths![key] = previous; throw error; }
    finally { setBusy(false); }
  }
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
    resources?.destroy(); resources = null; openRoadmapLeaf = null;
    algorithmController?.destroy(); algorithmController = null;
    learningController?.destroy(); learningController = null;
    panel.replaceChildren();
    const modes = element('div', 'algorithm-view-modes'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', '算法学习方式');
    for (const [mode, title] of [['tree', '知识树'], ['path', '学习路线']]) {
      const control = button(title, 'button secondary', () => setAlgorithmMode(mode)); control.dataset.mode = mode; control.setAttribute('aria-pressed', String(algorithmMode === mode)); modes.append(control);
    }
    panel.append(modes); const host = element('div', 'algorithm-view-content'); panel.append(host);
    if (algorithmMode === 'path') {
      const curriculum = effectiveCurriculum();
      const mapped = { ...roadmapData, nodes: roadmapData.nodes.map(node => ({ ...node })), indexEntries: roadmapData.indexEntries.map(node => ({ ...node })) };
      // Administrator-added curriculum entries remain reachable through their exact topic identities.
      const allGates = (curriculum?.stages || []).flatMap(stage => stage.gates || []);
      for (const node of [...mapped.nodes, ...mapped.indexEntries]) {
        const known = new Set(node.topicIds || []);
        const added = allGates.filter(gate => gate.id.startsWith('custom-') && (gate.topicIds || []).some(id => known.has(id)));
        node.gateIds = [...new Set([...(node.gateIds || []), ...added.map(gate => gate.id)])];
        node.topicIds = [...new Set([...(node.topicIds || []), ...added.flatMap(gate => gate.topicIds || [])])];
      }
      function openLeaf(topicId: string, scope?: NoteScope): void {
        const node = [...mapped.nodes, ...mapped.indexEntries].find(item => (item.topicIds || []).some(id => resolveAlgorithmLeaf(getAlgorithmTree(), id)?.id === topicId));
        if (!node || !curriculum) return;
        resources?.destroy();
        resources = openRoadmapResources({ host: host.querySelector<HTMLElement>('.arm') || host, node, topicId, curriculum, tree: getAlgorithmTree(), notes: getAlgorithmNotes() as LearningPathNote[],
          contents: options.getLearningGateContents(), progress: structuredClone(learningProgress()), canManage: Boolean(getAccount() && getPermissions().admin === true),
          nodeContents: options.getAlgorithmNodeContents(), onSaveNodeContent: saveNodeContent, renderMarkdown, scope: scope ?? (panel.dataset.scope === 'personal' ? 'personal' : 'public'), account: getAccount(),
          onSaveGate: async () => { throw new Error('请通过简介编辑入口保存'); }, onPersonal: async () => {}, onTopic: openLearningTopic,
          onNote: (note, gateId) => openAlgorithmNoteDetail(note, { gateId }), onExternal: options.openExternal,
          onUploadLeaf: canUploadNotes() ? id => { algorithmSelectedNode = id; openAlgorithmNoteEditor(); } : undefined, onSaveIntroduction: saveRouteIntroduction
        });
      }
      openRoadmapLeaf = openLeaf;
      learningController = LearningRoadmap.render({ host, data: mapped, progress: learningProgress(), tree: getAlgorithmTree(), nodeContents: options.getAlgorithmNodeContents(), renderMarkdown,
        canManage: Boolean(getAccount() && getPermissions().admin === true), onSaveIntroduction: saveRouteIntroduction,
        getIntroduction: node => options.getAlgorithmNodeContents().find(item => item.nodeId === `roadmap:${node.id}`)?.introduction,
        onOpenLeaf: openLeaf,
        onFocus: async id => { await saveRoadmapProgress({ ...learningProgress(), roadmapFocus: id }); }, toast,
        onOpenResources: node => {
          if (!curriculum || getBusy()) return;
          resources?.destroy();
          resources = openRoadmapResources({ host: host.querySelector<HTMLElement>('.arm') || host, node, curriculum, tree: getAlgorithmTree(), notes: getAlgorithmNotes() as LearningPathNote[],
            progress: structuredClone(learningProgress()), contents: options.getLearningGateContents(), canManage: Boolean(getAccount() && getPermissions().admin === true),
            nodeContents: options.getAlgorithmNodeContents(), onSaveNodeContent: saveNodeContent, renderMarkdown, scope: panel.dataset.scope === 'personal' ? 'personal' : 'public', account: getAccount(),
            onUploadLeaf: canUploadNotes() ? id => { algorithmSelectedNode = id; openAlgorithmNoteEditor(); } : undefined, onSaveIntroduction: saveRouteIntroduction,
            onSaveGate: async input => {
              if (getBusy()) throw new Error('请等待当前操作完成');
              if (!getAccount() || getPermissions().admin !== true) throw new Error('只有管理员可以修改公共资料');
              const source = options.repoSource(), owner = accountId(); setBusy(true);
              try {
                const saved = await options.saveLearningGate({ ...input, repo: repo() });
                if (source !== options.repoSource() || owner !== accountId()) throw new Error('账号或资料库已改变，请重新同步');
                options.setLearningGateContents([...options.getLearningGateContents().filter(content => content.gateId !== saved.gateId), saved]); return saved;
              } finally { setBusy(false); }
            },
            onPersonal: async (gateId, url) => {
              const previous = learningProgress(), record = previous.gates?.[gateId];
              const fields = record && typeof record === 'object' && !Array.isArray(record) ? record as Record<string, unknown> : {};
              await saveRoadmapProgress({ ...previous, gates: { ...(previous.gates || {}), [gateId]: { ...fields, practiceUrl: url } } });
            },
            onTopic: openLearningTopic, onNote: (note, gateId) => openAlgorithmNoteDetail(note, { gateId }), onExternal: options.openExternal
          });
        }
      });
      return;
    }
    algorithmController = AlgorithmBrowser.render({
      host, tree: getAlgorithmTree(), notes: getAlgorithmNotes(), nodeContents: options.getAlgorithmNodeContents(), onSaveNodeContent: saveNodeContent,
      onLearningPath(id) { setAlgorithmMode('path'); learningController?.selectTopic?.(id); },
      scope: panel.dataset.scope || 'public', account: getAccount(),
      canUpload: canUploadNotes(),
      canManage: canManageTopics(),
      onAddTopic: openAlgorithmTopicEditor, topicActions,
      noteActions: (note, context) => noteActions(note, () => ({ view: 'tree', fullscreen: context.isFullscreen() })),
      onScopeChange(scope) {
        if (scope === 'personal' && !getAccount()) { toast('请先登录 GitHub 账户'); return; }
        panel.dataset.scope = scope; renderAlgorithmNotes();
      },
      onSelect(id) { algorithmSelectedNode = id; },
      onUpload(id) { algorithmSelectedNode = id; openAlgorithmNoteEditor(); },
      renderMarkdown, authorName, formatDate: date,
      isFavorite: options.isFavorite, onToggleFavorite: options.onToggleFavorite
    });
    if (algorithmPendingTopic) { const id = algorithmPendingTopic; algorithmPendingTopic = null; algorithmController.selectNode(id); }
  }
  const topicDialog = $('#algorithm-topic-dialog')!, topicForm = $('#algorithm-topic-form')!;
  const topicSubmit = $('#algorithm-topic-submit')!;
  const unratedOption = element('option', '', '未分级');
  unratedOption.value = 'unrated';
  let topicEditor: (MutationContext & ({ target: TopicTarget } | { parentId: string; requestId: string })) | null = null;
  function currentTopic(id: string): TopicTarget | null {
    if (!canManageTopics()) return null;
    const entry = (getAlgorithmTopics() || []).find(record => record.id === id);
    if (entry) {
      if (typeof entry.repo !== 'string' || entry.repo.toLowerCase() !== repo().toLowerCase() || (entry.sourceKey !== undefined && entry.sourceKey !== options.repoSource())) return null;
      const { parentId, kind, label, fullLabel, color, scope } = entry;
      if (typeof parentId !== 'string' || typeof label !== 'string' || (kind !== 'algorithm' && kind !== 'directory') || typeof color !== 'string') return null;
      return { id, expected: { parentId, kind, label, fullLabel: fullLabel ?? label, color, scope: scope ?? '' } };
    }
    const nodes = algorithmNodes();
    const node = nodes.find(item => item.id === id);
    if (!node?.parent || node.origin === 'admin' || !isAlgorithmLeaf(node)) return null;
    const { parent: parentId, label, fullLabel, color, scope } = node;
    // A built-in leaf split by custom children can be persisted under its original ID.
    const overrideIds = [id];
    let content = node;
    while (content.contentOf && content.contentOf === content.parent) {
      const parent = nodes.find(item => item.id === content.contentOf);
      if (!parent) break;
      overrideIds.push(parent.id);
      content = parent;
    }
    return { id, expected: { parentId, kind: 'algorithm', label, fullLabel: fullLabel ?? label, color, scope: scope ?? '' }, overrideIds };
  }
  function topicActions(id: string) {
    const topic = currentTopic(id);
    if (!topic) return null;
    const noun = topic.expected.kind === 'directory' ? '目录' : '算法';
    const actions = element('div', 'alg-management-actions');
    return append(actions,
      button(`编辑${noun}`, 'button secondary alg-topic-edit', () => openTopicEdit(id)),
      button(`删除${noun}`, 'button danger alg-topic-delete', () => {
        const current = currentTopic(id);
        if (current) openDelete({ kind: 'topic', topic: current });
      }));
  }
  function updateAlgorithmTopicKind() {
    const directory = topicForm.elements.kind.value === 'directory';
    $('#algorithm-topic-difficulty')!.hidden = directory;
    topicForm.elements.color.disabled = directory; topicForm.elements.color.required = !directory;
    topicSubmit.textContent = directory ? '保存目录' : '保存算法';
  }
  topicForm.elements.kind.addEventListener('change', updateAlgorithmTopicKind);
  function showTopicEditor(parent: AppFlatNode | undefined, target?: TopicTarget) {
    const fields = topicForm.elements;
    if (target?.overrideIds) fields.color.append(unratedOption);
    else unratedOption.remove();
    topicForm.reset(); fields.parentId.value = target?.expected.parentId || parent?.id || '';
    fields.kind.disabled = Boolean(target);
    $('#algorithm-topic-parent-line')!.hidden = Boolean(target);
    $('#algorithm-topic-parent')!.textContent = parent?.fullLabel || parent?.label || '';
    $('#algorithm-topic-title')!.textContent = target ? (target.expected.kind === 'directory' ? '编辑目录' : '编辑算法') : '添加目录或算法';
    $('#algorithm-topic-kind-hint')!.textContent = target ? '节点类型与所属目录固定。' : parent?.kind === 'algorithm'
      ? '添加子项后，此节点将保留为目录，原算法及难度移入同名叶子，笔记保存在具体知识点。'
      : '算法需要选择难度；目录只组织子节点，不保存笔记。';
    if (target) {
      const { kind, label, fullLabel, color, scope } = target.expected;
      fields.kind.value = kind; fields.label.value = label; fields.fullLabel.value = fullLabel; fields.color.value = color; fields.scope.value = scope;
    }
    updateAlgorithmTopicKind();
    $('#algorithm-topic-error')!.hidden = true;
    topicDialog.showModal(); fields.label.focus();
  }
  function openAlgorithmTopicEditor(parentId: string) {
    if (!canManageTopics() || getBusy() || hasEditor()) return;
    const parent = algorithmNodes().find(node => node.id === parentId);
    if (!parent) return;
    topicEditor = { ...mutationContext(), parentId, requestId: uuid() };
    showTopicEditor(parent);
  }
  function openTopicEdit(id: string) {
    if (getBusy() || hasEditor()) return;
    const target = currentTopic(id);
    if (!target) return;
    topicEditor = { ...mutationContext(), target };
    showTopicEditor(undefined, target);
  }
  function setDirectory(topics: AlgorithmTopic[], overrides: AlgorithmDirectoryOverride[]) {
    setAlgorithmTopics(topics);
    setAlgorithmOverrides(overrides);
    setAlgorithmTree(AlgorithmDirectory.hydrate(global.QMX_ALGORITHM_TREE, topics, overrides));
  }
  function refreshTopics(topics: AlgorithmTopic[], id: string, overrides = getAlgorithmOverrides()) {
    setDirectory(topics, overrides);
    algorithmPendingTopic = id;
    render();
  }
  topicForm.addEventListener('submit', async event => {
    event.preventDefault();
    const editor = topicEditor;
    if (!editor || !topicDialog.open || getBusy()) return;
    const { repo, sourceKey } = editor, fields = topicForm.elements;
    const label = fields.label.value.trim();
    const details = { label, fullLabel: fields.fullLabel.value.trim() || label, color: fields.kind.value === 'directory' ? 'parent' : fields.color.value, scope: fields.scope.value.trim() };
    const unlock = lockForm(topicForm); $('#algorithm-topic-error')!.hidden = true;
    try {
      assertMutationContext(editor);
      if (!canManageTopics()) throw new Error('只有管理员可以修改算法目录');
      if ('target' in editor) {
        const { id, expected, overrideIds } = editor.target;
        const result = await call('updateAlgorithmTopic', { repo, sourceKey, id, expected, ...details });
        assertMutationContext(editor);
        const overrides = Array.isArray(result.overrides) ? result.overrides : undefined;
        const updated = overrideIds
          ? overrides?.some(override => override && overrideIds.includes(override.id) && override.hidden !== true)
          : result.topic?.id === id;
        if (!updated || !Array.isArray(result.topics)) throw new Error('算法目录更新结果未知，请先同步核实');
        topicDialog.close(); refreshTopics(result.topics, id, overrides); toast('算法目录已更新');
      } else {
        const topic = await call('saveAlgorithmTopic', { repo, sourceKey, parentId: editor.parentId, kind: fields.kind.value, requestId: editor.requestId, ...details });
        assertMutationContext(editor);
        if (typeof topic.id !== 'string') throw new Error('算法目录写入结果未知，请先同步核实');
        topicDialog.close(); refreshTopics([...(getAlgorithmTopics() || []).filter(record => record.id !== topic.id), topic], topic.id);
        toast(topic.kind === 'directory' ? '目录已添加，可继续添加子项或上传笔记' : '算法已添加，可继续上传笔记');
      }
    } catch (error) { showError('#algorithm-topic-error', error); }
    finally { unlock(); }
  });
  function isMineNote(note: AppRecord) { return accountId() !== null && String(note.authorId ?? '') === accountId(); }
  function currentNote(note: AlgorithmBrowserNote): NoteTarget | null {
    if (!isGitHubSource() || accountId() === null || typeof note.path !== 'string' || typeof note.sha !== 'string' || !note.sha.trim()) return null;
    if (typeof note.repo !== 'string' || note.repo.toLowerCase() !== repo().toLowerCase() || note.sourceKey !== options.repoSource()) return null;
    const record = getAlgorithmNotes().find(item => item.path === note.path && item.sha === note.sha && item.sourceKey === note.sourceKey && item.repo === note.repo);
    if (!record || record.kind !== 'algorithm-note') return null;
    const { path, sha } = note;
    if (record.noteScope === 'public' && /^algorithms\/notes\/public\/[^/]+\.md$/.test(path) && getPermissions().admin === true) return { ...record, path, sha, noteScope: 'public' };
    const owner = /^algorithms\/notes\/personal\/([1-9]\d*)\/[^/]+\.md$/.exec(path)?.[1];
    if (record.noteScope === 'personal' && owner === accountId() && isMineNote(record) && canUploadNotes()) return { ...record, path, sha, noteScope: 'personal' };
    return null;
  }
  function noteActions(note: AlgorithmBrowserNote, origin: () => NoteOrigin = () => ({ view: 'favorites' })) {
    if (!currentNote(note)) return null;
    const actions = element('div', 'alg-management-actions');
    return append(actions,
      button('编辑笔记', 'button secondary alg-note-edit', () => {
        const current = currentNote(note);
        if (current) showNoteEditor(current, origin());
        else toast('笔记或权限已改变，请同步后重试');
      }),
      button('删除笔记', 'button danger alg-note-delete', () => {
        const current = currentNote(note);
        if (current) openDelete({ kind: 'note', note: current, origin: origin() });
        else toast('笔记或权限已改变，请同步后重试');
      }));
  }
  function openAlgorithmNoteDetail(note: LearningPathNote, { gateId }: { gateId?: string } = {}) {
    const holder = element('div', 'alg-browser'), pane = element('div', 'alg-pane'); holder.hidden = true;
    const article = element('article', 'alg-reading'), title = element('h2', 'alg-reading-title', note.title || '未命名笔记');
    const meta = element('div', 'alg-note-meta');
    if (note.featured) meta.append(element('span', 'alg-featured', '精选'));
    append(meta, element('span', 'alg-note-author', authorName(note.author)), element('span', '', date(note.updatedAt)));
    const body = element('div', 'markdown-body alg-markdown'); renderMarkdown(body, note.body, true);
    append(article, title, meta, tags(note));
    const favorite = noteFavoriteControl({ note, isFavorite: options.isFavorite, onToggleFavorite: options.onToggleFavorite, onError: cause => toast(errorMessage(cause)) });
    const management = noteActions(note, () => ({ view: 'path', gateId }));
    if (favorite || management) article.append(append(element('div', 'reading-detail-actions'), favorite, management));
    article.append(body); pane.append(article); holder.append(pane); $('#algorithm-panel')!.append(holder);
    const path = [];
    const stage = global.QMX_ALGORITHM_LEARNING_PATH?.stages!.find(item => item.gates!.some(gate => gateId ? gate.id === gateId : gate.topicIds!.includes(note.nodeId)));
    const gate = stage?.gates!.find(item => gateId ? item.id === gateId : item.topicIds!.includes(note.nodeId));
    path.push({ label: '学习路线', onClick() { getReadingDetail().closeAll(); } });
    if (stage) path.push({ label: `第${stage.index}章 ${stage.title}`, onClick() { getReadingDetail().closeAll(); if (gate) learningController?.selectGate(gate.id); } });
    if (gate) path.push({ label: gate.title!, onClick() { noteDetail?.close(); } });
    path.push({ label: note.title || '未命名笔记' });
    const noteDetail = getReadingDetail().open({ content: pane, title: '算法笔记详情', path, onClose() { holder.remove(); } });
  }
  const noteDialog = $('#algorithm-note-dialog')!, noteForm = $('#algorithm-note-form')!;
  let noteEditor: (MutationContext & ({ target: NoteTarget; origin: NoteOrigin } | { clientId: string })) | null = null;
  function showNoteEditor(target?: NoteTarget, origin?: NoteOrigin) {
    if (getBusy() || hasEditor()) return;
    noteEditor = target && origin ? { ...mutationContext(), target, origin } : { ...mutationContext(), clientId: uuid() };
    const fields = noteForm.elements, admin = getPermissions().admin === true;
    noteForm.reset();
    fields.nodeId.replaceChildren(...algorithmNodes().filter(isAlgorithmLeaf).map(node => {
      const choice = element('option', '', node.label); choice.value = node.id; return choice;
    }));
    fields.nodeId.value = resolveAlgorithmLeaf(getAlgorithmTree(), target ? target.nodeId : algorithmSelectedNode)?.id || '';
    fields.noteScope.value = target?.noteScope || (admin ? 'public' : 'personal');
    fields.noteScope.disabled = Boolean(target) || !admin;
    fields.featured.disabled = !admin;
    if (target) {
      fields.noteTitle.value = target.title || '';
      fields.noteTags.value = Array.isArray(target.tags) ? target.tags.join(', ') : '';
      fields.body.value = String(target.body ?? '');
      fields.featured.checked = target.featured === true;
    }
    $('#algorithm-note-title')!.textContent = target ? '编辑算法笔记' : '上传算法笔记';
    $('#algorithm-note-error')!.hidden = true;
    noteDialog.showModal(); fields.noteTitle.focus();
  }
  function openAlgorithmNoteEditor() {
    if (!canUploadNotes()) { toast('请先登录具有仓库写入权限的 GitHub 账户'); return; }
    showNoteEditor();
  }
  function refreshNote(origin: NoteOrigin, note: AppRecord, saved?: AppRecord) {
    const leaf = resolveAlgorithmLeaf(getAlgorithmTree(), note.nodeId);
    if (origin.view === 'tree') algorithmPendingTopic = leaf?.id || getAlgorithmTree().id;
    render();
    if (origin.view === 'tree' && saved) algorithmController?.openNote(saved, { fullscreen: origin.fullscreen });
    if (origin.view === 'path' && algorithmMode === 'path') {
      if (saved && leaf) openAlgorithmNoteDetail({ ...saved, nodeId: leaf.id }, { gateId: origin.gateId });
      else if (leaf) openRoadmapLeaf?.(leaf.id, note.noteScope === 'personal' ? 'personal' : 'public');
    }
  }
  noteForm.addEventListener('submit', async event => {
    event.preventDefault();
    const editor = noteEditor;
    if (!editor || !noteDialog.open || getBusy()) return;
    const fields = noteForm.elements, target = 'target' in editor ? editor.target : undefined;
    const { repo, sourceKey } = editor;
    const admin = getPermissions().admin === true;
    const noteScope = target?.noteScope || (admin ? fields.noteScope.value : 'personal');
    const nodeId = fields.nodeId.value;
    const unlock = lockForm(noteForm); $('#algorithm-note-error')!.hidden = true;
    try {
      assertMutationContext(editor);
      if (target ? !currentNote(target) : !canUploadNotes()) throw new Error('笔记或写入权限已改变，请同步后重试');
      if (resolveAlgorithmLeaf(getAlgorithmTree(), nodeId)?.id !== nodeId) throw new Error('请选择一个算法知识点');
      const note = { repo, sourceKey, title: fields.noteTitle.value, noteScope, nodeId,
        tags: fields.noteTags.value.split(/[,，、]/).map(tag => tag.trim()).filter(Boolean), body: fields.body.value,
        ...(admin ? { featured: fields.featured.checked } : {}) };
      const result = await call('saveAlgorithmNote', 'target' in editor
        ? { ...note, path: editor.target.path, sha: editor.target.sha }
        : { ...note, clientId: editor.clientId });
      assertMutationContext(editor);
      if (typeof result.path !== 'string' || (target && result.path !== target.path)) throw new Error('算法笔记保存结果未知，请先同步核实');
      setAlgorithmNotes([...getAlgorithmNotes().filter(item => item.path !== result.path || item.sourceKey && item.sourceKey !== sourceKey), result]);
      noteDialog.close();
      if ('target' in editor) refreshNote(editor.origin, result, result);
      else render();
      toast('算法笔记已保存');
    } catch (error) { showError('#algorithm-note-error', error); }
    finally { unlock(); }
  });

  const deleteDialog = $('#algorithm-delete-dialog')!, deleteForm = $('#algorithm-delete-form')!;
  let deletion: (MutationContext & DeleteTarget) | null = null;
  function openDelete(target: DeleteTarget) {
    if (getBusy() || hasEditor()) return;
    deletion = { ...mutationContext(), ...target };
    $('#algorithm-delete-error')!.hidden = true;
    $('#algorithm-delete-title')!.textContent = target.kind === 'topic'
      ? (target.topic.expected.kind === 'directory' ? '删除目录？' : '删除算法？') : '删除笔记？';
    $('#algorithm-delete-target')!.textContent = target.kind === 'topic' ? target.topic.expected.fullLabel : target.note.title || '未命名笔记';
    deleteDialog.showModal();
  }
  deleteForm.addEventListener('submit', async event => {
    event.preventDefault();
    const pending = deletion;
    if (!pending || !deleteDialog.open || getBusy()) return;
    const { repo, sourceKey } = pending;
    const unlock = lockForm(deleteForm); $('#algorithm-delete-error')!.hidden = true;
    try {
      assertMutationContext(pending);
      if (pending.kind === 'topic') {
        if (!canManageTopics()) throw new Error('只有管理员可以删除算法目录');
        const { id, expected, overrideIds } = pending.topic;
        const result = await call('deleteAlgorithmTopic', { repo, sourceKey, id, expected });
        assertMutationContext(pending);
        const overrides = Array.isArray(result.overrides) ? result.overrides : undefined;
        if (!Array.isArray(result.topics) || (overrideIds && !overrides?.some(override => override && overrideIds.includes(override.id) && override.hidden === true))) {
          throw new Error('算法目录删除结果未知，请先同步核实');
        }
        const parent = algorithmNodes().find(node => node.id === id)?.parent || getAlgorithmTree().id;
        deleteDialog.close(); refreshTopics(result.topics, parent, overrides); toast('算法目录已删除');
      } else {
        if (!currentNote(pending.note)) throw new Error('笔记或写入权限已改变，请同步后重试');
        const { path, sha } = pending.note;
        const result = await call('deleteAlgorithmNote', { repo, sourceKey, path, sha });
        assertMutationContext(pending);
        if (result.deleted !== true || result.path !== path) throw new Error('算法笔记删除结果未知，请先同步核实');
        setAlgorithmNotes(getAlgorithmNotes().filter(item => item.path !== path || item.sourceKey !== sourceKey));
        deleteDialog.close(); refreshNote(pending.origin, pending.note); toast('算法笔记已删除');
      }
    } catch (error) { showError('#algorithm-delete-error', error); }
    finally { unlock(); }
  });
  function setSelectedNode(id: string | null) { algorithmSelectedNode = id; }
  function resetRepository() { setAlgorithmNotes([]); options.setLearningGateContents([]); options.setLearningCurriculum(null); options.setAlgorithmNodeContents([]); setDirectory([], []); }
  return { get algorithmSelectedNode() { return algorithmSelectedNode; }, get algorithmMode() { return algorithmMode; }, get algorithmPendingTopic() { return algorithmPendingTopic; }, get learningController() { return learningController; }, get algorithmTopicRequest() { return topicEditor && 'requestId' in topicEditor ? topicEditor.requestId : null; }, setSelectedNode, algorithmNodes, learningProgressKey, setAlgorithmMode, openLearningTopic, saveLearningProgress, renderAlgorithmNotes, updateAlgorithmTopicKind, openAlgorithmTopicEditor, isMineNote, openAlgorithmNoteDetail, openAlgorithmNoteEditor, noteActions, hasEditor, resetRepository };
}
