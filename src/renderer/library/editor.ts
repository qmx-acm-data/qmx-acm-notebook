import { Search } from '../lib/search.js';
/** Record editing and account-scoped drafts, using the app's existing persistence queue. */
type Options = import('../../../types/editor-ui').EditorUIOptions;
type Controller = import('../../../types/editor-ui').EditorUIController;
type AppRecord = import('../../../types/app').AppRecord;
type AppFormDraft = import('../../../types/app').AppFormDraft;
type AppSeed = import('../../../types/app').AppSeed;
type AppControl = import('../../../types/app').AppControl;
type EditorSelector = '#submit-form' | '#editor-difficulty-picker' | '#submit-error' | '#submit-title' | '#creation-extras' | '#save-local-button' | '#draft-hint' | '#publish-button' | '#submit-dialog';
type EditorSelectorMap = Pick<import('../../../types/app').AppSelectorMap, EditorSelector>;

export function createEditor(options: Options): Controller {
  const { demo, getEditor, setEditor, getLocal, setLocal, getRecords, setRecords, getIssues, setIssues, getComments, getSelected, setSelected, getBusy, setBusy, getAccount, getPermissions, accountId, repo, key, uuid, isLocal, visibleLocal, canEditRemote, sameRepo, records, platformCode, colorRatingInput, renderEditorTags, cancelDraftSave, persistLocal, call, refreshFilters, navigate, render, openDetail, toast, errorMessage } = options;
  const $ = <S extends EditorSelector>(selector: S): EditorSelectorMap[S] | null => document.querySelector<EditorSelectorMap[S]>(selector);
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function formDraft(): AppFormDraft { const form = $('#submit-form')!; return Object.fromEntries(['url', 'title', 'pid', 'platform', 'tags', 'reason', 'body', 'trick', 'rating', 'difficulty', 'luoguDifficulty'].map(name => [name, String((form.elements.namedItem(name) as AppControl | null)?.value || '')])) as AppFormDraft; }
  function fillForm(draft: Record<string, unknown> | undefined) { const form = $('#submit-form')!; form.reset(); Object.entries(draft || {}).forEach(([name, value]) => { const input = form.elements.namedItem(name) as AppControl | null; if (input) input.value = String(value ?? ''); }); }
  const editorLuoguLevels = ['入门','普及-','普及','普及+/提高-','提高','提高+/省选-','省选/NOI-','NOI/NOI+/CTS'];
  const editorLuoguTones = ['red','orange','yellow','green','cyan','blue','purple','black'];
  function renderEditorDifficulty() {
    const form = $('#submit-form')!, host = $('#editor-difficulty-picker')!;
    const platform = platformCode(form.elements.platform.value);
    const rating = form.elements.rating, native = form.elements.difficulty;
    const wrapper = element('div', 'editor-difficulty-controls');
    if (platform === 'CF') {
      const ratingField = element('label', 'range-field'); ratingField.append(element('span', '', 'Codeforces Rating'));
      const input = element('input', 'rating-range'); input.type = 'number'; input.min = '0'; input.max = '10000'; input.step = '100'; input.placeholder = '未指定'; input.setAttribute('aria-label', 'Codeforces Rating'); input.value = rating.value;
      native.value = '';
      const color = () => colorRatingInput(input);
      input.addEventListener('input', () => { rating.value = input.value; native.value = ''; color(); }); color(); ratingField.append(input);
      wrapper.append(ratingField);
    } else if (platform === 'LG') {
      const select = element('select', 'luogu-range'); select.setAttribute('aria-label', '洛谷原生难度');
      [['','未指定'], ...editorLuoguLevels.map(name => [name,name])].forEach(([value,label], index) => { const option = element('option', index ? `tone-${editorLuoguTones[index - 1]}` : '', label); option.value = value; select.append(option); });
      const current = Search.difficulty({ platform:'LG', difficulty:native.value });
      const known = current.level ? editorLuoguLevels[current.level! - 1] : editorLuoguLevels.find(level => level === native.value);
      if (known) select.value = known; else if (native.value) { const legacy = element('option', '', native.value); legacy.value = native.value; select.append(legacy); select.value = native.value; }
      rating.value = '';
      const color = () => { const level = editorLuoguLevels.indexOf(select.value); select.className = `luogu-range${level >= 0 ? ` tone-${editorLuoguTones[level]}` : ''}`; };
      select.addEventListener('change', () => { native.value = select.value; color(); }); color();
      const field = element('label', 'range-field'); field.append(element('span', '', '洛谷难度'), select); wrapper.append(field);
    } else if (platform === 'LC') {
      const select = element('select', 'luogu-range'); select.setAttribute('aria-label', 'LeetCode 原生难度');
      [['','未指定',''],['Easy','Easy / 简单','green'],['Medium','Medium / 中等','yellow'],['Hard','Hard / 困难','red']].forEach(([value,label,tone]) => { const option = element('option', tone ? `tone-${tone}` : '', label); option.value = value; select.append(option); });
      const level = Search.difficulty({ platform:'LC', difficulty:native.value }).level;
      const known = ['Easy','Medium','Hard'][level! - 1];
      if (known) select.value = known;
      else if (native.value) { const legacy = element('option', '', native.value); legacy.value = native.value; select.append(legacy); select.value = native.value; }
      const color = () => { const tone = { Easy:'green', Medium:'yellow', Hard:'red' }[select.value]; select.className = `luogu-range${tone ? ` tone-${tone}` : ''}`; };
      select.addEventListener('change', () => { native.value = select.value; color(); }); color(); wrapper.append(select);
    } else {
      const input = element('input'); input.type = 'text'; input.maxLength = 60; input.placeholder = '原生难度，如 ABC D / 3'; input.setAttribute('aria-label', '平台原生难度'); input.value = native.value;
      const datalist = element('datalist'); datalist.id = 'editor-native-difficulties';
      const values = platform === 'AT' ? ['ABC A','ABC B','ABC C','ABC D','ABC E','ABC F','ARC A','ARC B','ARC C','ARC D','ARC E','ARC F'] : platform === 'NC' ? ['简单','中等','困难'] : [];
      values.forEach(value => { const option = element('option'); option.value = value; datalist.append(option); }); input.setAttribute('list', datalist.id);
      input.addEventListener('input', () => { native.value = input.value; }); wrapper.append(input, datalist);
    }
    if (platform !== 'LG') {
      const field = element('label', 'range-field'); field.append(element('span', '', '洛谷难度（可选）'));
      const select = element('select', 'luogu-range'); select.setAttribute('aria-label', '补充洛谷难度');
      [['','未指定'], ...editorLuoguLevels.map(name => [name,name])].forEach(([value,label], index) => { const option = element('option', index ? `tone-${editorLuoguTones[index - 1]}` : '', label); option.value = value; select.append(option); });
      select.value = form.elements.luoguDifficulty.value;
      const color = () => { const level = editorLuoguLevels.indexOf(select.value); select.className = `luogu-range${level >= 0 ? ` tone-${editorLuoguTones[level]}` : ''}`; };
      select.addEventListener('change', () => { form.elements.luoguDifficulty.value = select.value; color(); }); color(); field.append(select); wrapper.append(field);
    }
    host.replaceChildren(wrapper);
  }
  function setEditorPlatform(value: unknown, clearDifficulty = true) {
    const form = $('#submit-form')!, next = platformCode(value);
    if (form.elements.platform.value !== next) {
      form.elements.platform.value = next;
      if (clearDifficulty) { form.elements.rating.value = ''; form.elements.difficulty.value = ''; }
    }
    renderEditorDifficulty();
  }
  function draftKey(source: string, ownerId: string | null) { return JSON.stringify([source || 'new', ownerId]); }
  function editorError(error: unknown) { $('#submit-error')!.textContent = errorMessage(error); $('#submit-error')!.hidden = false; }
  function openLocalSolution(problem: AppRecord) {
    if (getBusy() || problem.kind !== 'document') return;
    const ownerId = accountId();
    const sourceUrl = problem.problemUrl || problem.url;
    const sameProblem = (record: AppRecord) => {
      if (record.sourceProblemId === key(problem) && record.sourceProblemRepo === problem.repo) return true;
      if (sourceUrl && (record.problemUrl || record.url) === sourceUrl) return true;
      return !!problem.pid && platformCode(record.platform) === platformCode(problem.platform) && String(record.pid || '').replace(/^CF/i, '').toLowerCase() === String(problem.pid).replace(/^CF/i, '').toLowerCase();
    };
    const matches = getLocal().records.filter(record => visibleLocal(record) && sameProblem(record));
    const existing = matches.find(record => record.ownerId === ownerId) || matches[0];
    if (existing) { openSubmit(existing); return; }
    const source = `problem:${JSON.stringify([problem.repo, key(problem)])}`;
    const draft = { url: sourceUrl || '', title: problem.title || '', pid: problem.pid || '', platform: platformCode(problem.platform), tags: (problem.tags || []).join(', '), body: '', rating: problem.rating ?? '', difficulty: problem.difficulty || '', luoguDifficulty: problem.luoguDifficulty || '' };
    openSubmit(null, { source, data: draft, sourceProblemId: key(problem), sourceProblemRepo: problem.repo });
    $('#submit-title')!.textContent = '写本地题解';
  }
  function openSubmit(record?: AppRecord | null, seed: AppSeed | null = null) {
    if (getBusy()) return;
    if (record && !(isLocal(record) && visibleLocal(record) || canEditRemote(record))) { toast('当前账户无权编辑这条记录'); return; }
    const source = record ? key(record) : seed?.source || 'new', ownerId = accountId();
    const candidate = getLocal().draft[draftKey(source, ownerId)];
    const saved = candidate?.source === source && candidate.ownerId === ownerId ? candidate : null;
    const original = record ? structuredClone(record) : null;
    if (original?.kind === 'document' && saved?.base?.path === original.path && saved!.base!.repo === original.repo) original.sha = saved!.base!.sha;
    setEditor({ source, ownerId, clientId: saved?.clientId || record?.clientId || uuid(), record: original, ...(seed ? { sourceProblemId: seed.sourceProblemId, sourceProblemRepo: seed.sourceProblemRepo } : {}) });
    const data = record ? { url: record.problemUrl || record.url, title: record.title, pid: record.pid, platform: platformCode(record.platform), tags: (record.tags || []).join(', '), body: record.body || '', rating: record.rating ?? '', difficulty: record.difficulty || '', luoguDifficulty: record.luoguDifficulty || '' } : {};
    fillForm(saved?.source === source && saved.ownerId === ownerId ? saved.data : seed?.data || data);
    renderEditorDifficulty();
    renderEditorTags();
    const editing = !!record;
    $('#creation-extras')!.hidden = editing;
    $('#save-local-button')!.disabled = record?.kind === 'document';
    $('#save-local-button')!.title = record?.kind === 'document' ? '在线题解修改保存在独立编辑草稿中，请直接更新原文档' : '';
    $('#submit-title')!.textContent = record?.kind === 'document' ? '编辑正式题解' : editing ? '编辑本地记录' : '记下一道错题';
    $('#submit-error')!.hidden = true;
    $('#draft-hint')!.textContent = saved ? '已恢复此来源与当前账户的编辑草稿' : record?.kind === 'document' ? '保留完整 Markdown 原文，失败后编辑内容仍在此处' : '草稿按来源与当前账户保存在本机';
    $('#publish-button')!.textContent = record?.kind === 'document' ? '更新原文档' : '上传正式题解';
    $('#submit-dialog')!.showModal();
  }
  async function saveDraft(required = false) {
    if (!getEditor()! || getEditor()!.ownerId !== accountId()) return;
    const { source, ownerId, clientId, record } = getEditor()!;
    getLocal().draft[draftKey(source, ownerId)] = { source, ownerId, clientId, ...(record?.kind === 'document' ? { base: { path: record.path, repo: record.repo, sha: record.sha } } : {}), data: formDraft() };
    try { await persistLocal(); $('#draft-hint')!.textContent = '编辑草稿已保存到当前设备'; } catch (error) { $('#draft-hint')!.textContent = `编辑草稿保存失败：${errorMessage(error)}；请勿关闭窗口`; if (required) throw new Error(`无法持久化编辑标识，尚未写入 GitHub：${errorMessage(error)}`); }
  }
  async function saveRecord(remote: boolean) {
    const form = $('#submit-form')!; if (getBusy() || !form.reportValidity() || !getEditor()!) return;
    if (getEditor()!.ownerId !== accountId()) { editorError('账户已变更，请重新打开编辑器'); return; }
    cancelDraftSave();
    const data = formDraft(), existing = getEditor()!.record;
    if (!data.body.trim()) { editorError('请填写完整 Markdown 题解正文'); return; }
    let parsed; try { parsed = new URL(data.url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); } catch (_) { editorError('请输入有效的 http 或 https 题目链接'); return; }
    if (existing?.kind === 'document' && (!remote || !canEditRemote(existing))) { editorError('当前账户无权执行此操作；在线编辑只能更新原文档'); return; }
    if (remote) {
      if (demo) { editorError('浏览器演示不会写入 GitHub，请保存本地记录'); return; }
      if (!getAccount() || getPermissions().push !== true || !repo()) { editorError('请登录具有当前仓库 push 权限的 GitHub 账户并刷新账户'); return; }
      if (existing?.proposalUrl) { editorError('这是旧版已投稿副本，请先查看原投稿，不能重复上传'); return; }
      if (!navigator.onLine) { editorError('当前离线，编辑内容保留，请联网后重试或保存本地记录'); await saveDraft(); return; }
      const binding = existing?.kind === 'local' && existing.ownerId == null;
      if (!window.confirm(existing?.kind === 'document' ? `确认直接更新 ${existing.repo} 中的原文档 ${existing.path}？` : `确认上传正式题解到 ${repo()}？${binding ? ' 此未绑定本地记录将绑定当前 GitHub ID ' + accountId() + '。' : ''}`)) return;
    }
    const clientId = getEditor()!.clientId;
    const body = !existing ? [data.body, data.reason.trim() ? `## 错因分析\n${data.reason.trim()}` : '', data.trick.trim() ? `## Trick\n${data.trick.trim()}` : ''].filter(Boolean).join('\n\n') : data.body;
    const record = { ...(existing || {}), ...(getEditor()!.sourceProblemId ? { sourceProblemId: getEditor()!.sourceProblemId, sourceProblemRepo: getEditor()!.sourceProblemRepo } : {}), clientId, ownerId: existing && !remote ? existing.ownerId : existing?.ownerId ?? accountId(), title: data.title.trim() || data.pid.trim() || '未命名错题', pid: data.platform === 'CF' && data.pid.trim() ? `CF${data.pid.trim().replace(/^CF/i, '')}` : data.pid.trim(), platform: data.platform, rating: data.rating.trim() ? Number(data.rating) : null, difficulty: data.difficulty.trim(), luoguDifficulty: data.platform === 'LG' ? '' : data.luoguDifficulty.trim(), tags: data.tags.split(/[,，、]/).map(tag => tag.trim()).filter(Boolean), problemUrl: parsed.href, url: parsed.href, body, updatedAt: new Date().toISOString() };
    setBusy(true); $('#submit-error')!.hidden = true;
    let wroteRemote = false; const previousLocal = structuredClone(getLocal());
    try {
      if (remote && existing?.kind === 'local' && existing.ownerId == null) {
        const source = getLocal().records.find(item => key(item) === getEditor()!.source && item.clientId === existing.clientId && item.ownerId == null);
        if (!source) throw new Error('本地来源记录已变化，请重新打开编辑器');
        source.ownerId = accountId();
        existing.ownerId = accountId();
      }
      await saveDraft(remote);
      if (remote) {
        const response = await call('saveDocument', { ...record, repo: existing?.kind === 'document' ? existing.repo : repo(), ...(existing?.kind === 'document' ? { path: existing.path, sha: existing.sha } : {}) });
        const documentRecord = response?.document || response?.record || response;
        if (documentRecord?.kind !== 'document' || !documentRecord.path || !documentRecord.sha) throw new Error('客户端返回的文档不完整，请同步核实；编辑草稿已保留');
        wroteRemote = true;
        setRecords([...getRecords().filter(item => !(item.path === documentRecord.path && item.repo === documentRecord.repo)), documentRecord]);
        if (existing?.kind === 'local') getLocal().records = getLocal().records.filter(item => !(key(item) === getEditor()!.source && item.clientId === existing.clientId && item.ownerId === existing.ownerId));
        setSelected(key(documentRecord));
      } else {
        const localRecord = { ...record, id: existing?.id ?? `local:${clientId}`, kind: 'local' };
        getLocal().records = [...getLocal().records.filter(item => !(existing?.kind === 'local' && key(item) === getEditor()!.source && item.clientId === existing.clientId && item.ownerId === existing.ownerId)), localRecord]; setSelected(key(localRecord));
      }
      delete getLocal().draft[draftKey(getEditor()!.source, getEditor()!.ownerId)];
      try { await persistLocal(); } catch (error) { if (wroteRemote) { toast('GitHub 已更新，本地清理未保存，请同步核实'); } else throw error; }
      const savedRecord = records().find(item => key(item) === getSelected());
      form.reset(); $('#submit-dialog')!.close(); setEditor(null); refreshFilters(); navigate('public');
      if (remote) { setSelected(key(savedRecord!)); render(); }
      else openDetail(savedRecord!);
      toast(remote ? '正式题解已保存到 GitHub' : '已保存本地记录，收藏后可从个人收藏访问');
    } catch (error) { if (!remote) setLocal(previousLocal); editorError(error); await saveDraft(); }
    finally { setBusy(false); }
  }
  async function deleteDiscussion(record: AppRecord) {
    if (getBusy()) return;
    if (demo) { toast('浏览器演示不会删除 GitHub 讨论'); return; }
    if (!sameRepo(record) || !getAccount() || getPermissions().admin !== true) { toast('永久删除讨论需要当前仓库管理员权限'); return; }
    if (!window.confirm(`永久删除 GitHub 仓库 ${record.repo} 的 Issue #${record.number}「${record.title}」及其讨论？此操作不能撤销，不会删除正式题解文件。`)) return;
    setBusy(true);
    try {
      const result = await call('deleteIssue', { number: record.number, repo: record.repo });
      if (!result?.deleted) throw new Error('GitHub 未确认删除，请同步核实');
      setIssues(getIssues().filter(item => !(item.repo === record.repo && item.number === record.number)));
      getComments().delete(key(record));
      getLocal().favorites = getLocal().favorites.filter(id => String(id) !== key(record));
      delete getLocal().mastery[key(record)];
      try { await persistLocal(); } catch (_) { toast('讨论已删除，本地复习状态清理未保存，请同步'); }
      setSelected(null); refreshFilters(); render(); toast('GitHub 讨论已永久删除');
    } catch (error) { toast(`删除讨论失败：${errorMessage(error)}`); }
    finally { setBusy(false); }
  }
  async function deleteRecord(record: AppRecord) {
    if (getBusy()) return;
    const local = isLocal(record);
    if (!(local && visibleLocal(record) || canEditRemote(record))) { toast('当前账户没有删除权限'); return; }
    if (demo && !local) { toast('浏览器演示不会删除 GitHub 文档'); return; }
    if (!window.confirm(local ? '确认删除这条本地记录？此操作只修改本机。' : `确认从 GitHub 仓库 ${record.repo} 删除 ${record.path}？`)) return;
    setBusy(true);
    try {
      if (local) { const previous = structuredClone(getLocal()); getLocal().records = getLocal().records.filter(item => item.clientId !== record.clientId); try { await persistLocal(); } catch (error) { setLocal(previous); throw error; } }
      else { await call('deleteDocument', { path: record.path, sha: record.sha, repo: record.repo }); setRecords(getRecords().filter(item => !(item.path === record.path && item.repo === record.repo))); }
      setSelected(null); refreshFilters(); render(); toast(local ? '本地记录已删除' : 'GitHub 文档已删除');
    } catch (error) { toast(`删除失败：${errorMessage(error)}`); } finally { setBusy(false); }
  }

  return { formDraft, fillForm, renderEditorDifficulty, setEditorPlatform, draftKey, editorError, openLocalSolution, openSubmit, saveDraft, saveRecord, deleteDiscussion, deleteRecord };
}
