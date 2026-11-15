/* Stage-based learning route. Only explicit progress actions cross the persistence callback. */
import { ReadingDetail } from '../reading/reading-detail.js';
type Options = import('../../../types/learning-path').LearningPathOptions;
type Controller = import('../../../types/learning-path').LearningPathController;
type Stage = import('../../../types/learning-path').LearningPathStage;
type Gate = import('../../../types/learning-path').LearningPathGate;
type TopicNode = import('../../../types/learning-path').LearningPathNode;
type TopicEntry = { node: TopicNode; path: string[] };
type GateEntry = { gate: Gate; stage: Stage; stageIndex: number; index: number };
type Range = import('../../../types/learning-path').LearningPathRange;
type GateProgress = import('../../../types/learning-path').LearningPathGateProgress;
type Progress = import('../../../types/learning-path').LearningPathProgress;
type GateContent = import('../../shared/models/learning-content.js').LearningGateContent;
type EvidenceForm = HTMLFormElement & { elements: HTMLFormControlsCollection & {
  status: HTMLSelectElement; problemUrl: HTMLInputElement; reflection: HTMLTextAreaElement;
} };
function present<T>(value: T | null | undefined): value is T { return value !== null && value !== undefined; }
function errorMessage(error: unknown, fallback: string): string {
  return String((error as { message?: unknown } | null | undefined)?.message || fallback);
}
const views = new Map<string, { stageId: unknown; gateId: unknown }>();
let serial = 0;
const kinds: Record<string, string> = { learning: '学习关', mixed: '综合练习', challenge: '阶段挑战' };
const grades: Record<string, [string, string]> = { basic: ['D1 · 入门', 'basic'], beginner: ['D2 · 初级', 'beginner'], intermediate: ['D3 · 中级', 'intermediate'], advanced: ['D4 · 高级', 'advanced'], expert: ['D5 · 挑战', 'expert'] };
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function add<T extends HTMLElement>(parent: T, ...children: (Node | string | false | null | undefined)[]): T { children.forEach(child => { if (child) parent.append(child); }); return parent; }
function control(text: unknown, className: string, action: (event: MouseEvent) => unknown) {
  const node = el('button', className, text); node.type = 'button';
  node.addEventListener('click', action); return node;
}
function list<T>(value: T[] | null | undefined): T[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
function cfLabel(value?: Range) {
  if (!value || !Number.isFinite(value.min)) return '按关卡目标选题';
  return `CF ${value.min}${Number.isFinite(value.max) ? (value.max === value.min ? '' : `–${value.max}`) : '+'}`;
}
function authorName(author: unknown) {
  if (typeof author === 'string') return author;
  const value = author as { name?: unknown; login?: unknown } | null | undefined;
  return text(value?.name) || text(value?.login) || '未署名';
}
function render(options: Options): Controller {
  if (!options?.host) throw new TypeError('NotebookLearningPath.render requires a host.');
  const opts = options, host = opts.host, uid = `alp-${++serial}`;
  const stages = list(opts.curriculum?.stages).filter(stage => stage && typeof stage.id === 'string');
  const stageById = new Map<unknown, { stage: Stage; index: number }>(), gateById = new Map<unknown, GateEntry>(), topics = new Map<string, TopicEntry>();
  stages.forEach((stage, stageIndex) => {
    stageById.set(stage.id, { stage, index: stageIndex });
    list(stage.gates).forEach((gate, gateIndex) => { if (gate && typeof gate.id === 'string') gateById.set(gate.id, { gate, stage, stageIndex, index: gateIndex }); });
  });
  function walk(node: TopicNode | null | undefined, path: string[]) {
    if (!node || typeof node.id !== 'string') return;
    const entry = { node, path: [...path, text(node.label) || '未命名知识点'] };
    topics.set(node.id, entry); list(node.legacyIds).forEach(id => topics.set(id, entry));
    list(node.children).forEach(child => walk(child, entry.path));
  }
  walk(opts.tree, []);
  // Admin additions can turn a linked algorithm into a directory; follow its concrete child.
  for (const [id, entry] of topics) {
    if (entry.node.kind !== 'directory') continue;
    const concrete = list(entry.node.children).find(child => child.contentOf === entry.node.id && child.kind === 'algorithm');
    if (concrete && topics.has(concrete.id)) topics.set(id, topics.get(concrete.id)!);
  }
  const sharedNotes = list(opts.notes).filter(note => note?.noteScope === 'public' && topics.has(note.nodeId));
  const publicContents = new Map(list(opts.gateContents).filter(content => gateById.has(content.gateId)).map(content => [content.gateId, content]));
  const canManage = opts.canManage === true && typeof opts.onSaveGate === 'function';
  function contentGate(gate: Gate): Gate {
    const content = publicContents.get(gate.id);
    return content ? { ...gate, description: content.description, learningDescription: content.description, goals: [...content.goals] } : gate;
  }
  const viewKey = text(opts.progressKey) || `${opts.account?.id ?? 'local'}:${text(opts.curriculum?.id) || 'main'}`;
  const remembered = views.get(viewKey);
  let progress: Progress & { gates: Record<string, unknown> } = { ...(opts.progress || {}), gates: { ...(opts.progress?.gates || {}) } };
  let stageId = stageById.has(remembered?.stageId) ? remembered!.stageId : stageById.has(progress.stageId) ? progress.stageId : stages[0]?.id;
  let gateId = gateById.has(remembered?.gateId) && gateById.get(remembered!.gateId)!.stage.id === stageId ? remembered!.gateId
    : gateById.has(progress.gateId) && gateById.get(progress.gateId)!.stage.id === stageId ? progress.gateId : null;
  let destroyed = false, busy = false, celebrationTimer: ReturnType<typeof setTimeout> | undefined, saveError = '';
  let root: HTMLElement, routeScroll: HTMLDivElement, detail: HTMLElement, summary: HTMLDivElement, stageButton: HTMLButtonElement;
  let stageDialog: HTMLDialogElement, evidenceDialog: HTMLDialogElement, personalDialog: HTMLDialogElement, publicDialog: HTMLDialogElement;
  let personalGateId: string | null = null, publicGateId: string | null = null;
  let personalInput: HTMLInputElement, personalError: HTMLParagraphElement;
  let publicDescription: HTMLTextAreaElement, publicGoals: HTMLTextAreaElement, publicTitle: HTMLInputElement, publicUrl: HTMLInputElement, publicError: HTMLParagraphElement;
  let evidenceForm: EvidenceForm, evidenceError: HTMLParagraphElement, evidenceGateId: string | null = null;
  let previousFocus: Element | null | undefined, lastCelebrated: string | null = null;
  let detailController: import('../../../types/reading-detail').ReadingDetailController | null | undefined = null;
  const canSave = typeof opts.onProgress === 'function';
  const records = () => [...gateById.values()];
  const gateProgress = (id: string): GateProgress | null => {
    const value = progress.gates[id];
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return null;
    const record = value as GateProgress;
    return record.status === 'learning' || record.status === 'completed' ? record : null;
  };
  const isCompleted = (id: string) => gateProgress(id)?.status === 'completed';
  const completedCount = (gates: Gate[]) => list(gates).filter(gate => isCompleted(gate.id)).length;
  const validGates = (stage: Stage) => list(stage.gates).filter(gate => gateById.has(gate.id));
  const foundationGates = (gates: Gate[]) => gates.filter(gate => gate.scope === 'core' || gate.scope === 'route' || (!gate.scope && !gate.optional));
  const stageBasis = (stage: Stage) => foundationGates(validGates(stage)).filter(gate => stage.completionMode === 'routes' || gate.scope !== 'route');
  function completionText(stage: Stage) {
    const gates = stageBasis(stage);
    if (stage.completionMode !== 'routes') return `核心 ${completedCount(gates)} / ${gates.length} 关`;
    const routes = list(stage.sections).filter(section => section.scope === 'route');
    const finished = routes.filter(section => {
      const group = gates.filter(gate => gate.routeId === section.routeId);
      return group.length > 0 && completedCount(group) === group.length;
    }).length;
    return `${finished} / ${routes.length} 条路线基础完成`;
  }
  function stageCurrent(stage: Stage) {
    const all = validGates(stage), core = foundationGates(all);
    return all.find(gate => gateProgress(gate.id)?.status === 'learning') || core.find(gate => !isCompleted(gate.id)) || all.find(gate => !isCompleted(gate.id)) || all[0];
  }
  function currentEntry() { return gateById.get(gateId); }
  function remember() { views.set(viewKey, { stageId, gateId }); }
  if (!gateId) gateId = stages.length ? stageCurrent(stageById.get(stageId)!.stage)?.id : null;
  function notify(message: string) { if (typeof opts.toast === 'function') opts.toast(message); }
  function nodeButton(entry: TopicEntry, label?: string, className = 'alp-topic-link') {
    const button = control(label || entry.node.label, className, () => opts.onTopic?.(entry.node.id));
    button.title = `${entry.path.join(' / ')}${entry.node.fullLabel && entry.node.fullLabel !== entry.node.label ? ` · ${entry.node.fullLabel}` : ''}`; button.disabled = typeof opts.onTopic !== 'function'; return button;
  }
  function isOrientation(stage: Stage) { return stage.type === 'orientation'; }
  function learningPosition(stage: Stage, cf = stage.cf) { return isOrientation(stage) ? '入门导览' : cfLabel(cf); }
  function rangeTags(parent: HTMLElement, cf: Range | undefined, luogu: string[] | undefined, orientation = false) {
    if (orientation) { parent.append(el('span', 'alp-range', '入门导览')); return; }
    add(parent, el('span', cf ? 'alp-range alp-range-cf' : 'alp-range', cfLabel(cf)));
    if (list(luogu).length) parent.append(el('span', 'alp-range', `洛谷参考：${list(luogu).join(' / ')}`));
  }
  function statusOf(gate: Gate, stage: Stage) {
    if (isCompleted(gate.id)) return 'completed';
    return gateProgress(gate.id)?.status === 'learning' || stageCurrent(stage)?.id === gate.id ? 'learning' : 'todo';
  }
  function stageNumber(stage: Stage) { return Number.isInteger(stage.index) ? stage.index! : stageById.get(stage.id)!.index + 1; }
  function gateNumber(gate: Gate) { return gateById.get(gate.id)!.index + 1; }
  function selectGate(id: unknown, { focus = false, center = true } = {}) {
    const entry = gateById.get(id); if (!entry || destroyed || busy) return false;
    stageId = entry.stage.id; gateId = entry.gate.id; saveError = ''; remember();
    renderMain({ center });
    if (focus) (detailController ? detail.querySelector<HTMLElement>('.alp-gate-title') : root.querySelector<HTMLElement>('.alp-checkpoint[aria-pressed="true"]'))?.focus({ preventScroll: true });
    return true;
  }
  function renderSummary() {
    summary.replaceChildren();
    const done = records().filter(({ gate }) => isCompleted(gate.id)).length;
    for (const [value, label] of [[`${stages.filter(stage => !isOrientation(stage)).length} 章 + 导览`, '按主干知识逐章学完整'], [`${gateById.size} 关`, '分段学习 · 混练与验收'], [`${done} / ${gateById.size}`, '已记录完成，含选修与分路线']]) {
      const stat = el('div', 'alp-stat'); add(stat, el('strong', '', value), el('span', '', label)); summary.append(stat);
    }
    const resumed = records().find(({ gate }) => gateProgress(gate.id)?.status === 'learning') || records().find(({ gate }) => foundationGates([gate]).length && !isCompleted(gate.id)) || records().find(({ gate }) => !isCompleted(gate.id));
    if (resumed) summary.append(control(`继续 第${stageNumber(resumed.stage)}章 · 第${gateNumber(resumed.gate)}关 →`, 'alp-button alp-button-primary alp-resume', () => selectGate(resumed.gate.id, { focus: true })));
    else summary.append(el('span', 'alp-all-complete', '✓ 已完成全部关卡记录，可随时回顾'));
    const historical = Object.entries(progress.gates).filter(([id]) => !gateById.has(id) && gateProgress(id));
    if (historical.length) {
      const archive = el('details', 'alp-history');
      archive.append(el('summary', '', `旧版学习记录 · ${historical.length} 条已保留`));
      archive.append(el('p', 'alp-fine-print', '章节已重新编排，旧记录保留供回顾，不自动算作新版关卡完成。'));
      const names = new Map(list(opts.curriculum?.legacyGates).map(gate => [gate.id, gate]));
      for (const [id] of historical) {
        const record = gateProgress(id)!; const previous = names.get(id);
        const item = el('div', 'alp-history-item');
        add(item, el('strong', '', previous ? `${previous.stageTitle} · ${previous.title}` : `旧版关卡 ${id}`), el('span', '', record.status === 'completed' ? '已记录完成' : '学习中'));
        if (record.problemUrl) item.append(el('p', '', text(record.problemUrl)));
        if (record.reflection) item.append(el('p', '', text(record.reflection)));
        if (record.updatedAt && Number.isFinite(Date.parse(text(record.updatedAt)))) item.append(el('small', '', new Date(text(record.updatedAt)).toLocaleString('zh-CN')));
        archive.append(item);
      }
      summary.append(archive);
    }
  }
  function renderAchievements() {
    const container = root.querySelector<HTMLElement>('.alp-achievements')!; container.replaceChildren();
    const completed = records().filter(({ gate }) => isCompleted(gate.id));
    const finishedStage = stages.some(stage => !isOrientation(stage) && stage.completionMode !== 'routes' && stageBasis(stage).length > 0 && completedCount(stageBasis(stage)) === stageBasis(stage).length);
    const reflectionCount = records().filter(({ gate }) => text(gateProgress(gate.id)?.reflection).trim()).length;
    const items: [string, boolean, string][] = [
      ['迈出第一步', completed.length > 0, '完成第一关的学习记录'],
      ['综合初试', completed.some(({ gate }) => ['mixed', 'challenge'].includes(gate.kind || '')), '完成一次综合练习或阶段挑战'],
      ['章节里程碑', finishedStage, '完成一章核心关卡，推荐与选修分别记录'],
      ['复盘积累', reflectionCount >= 3, `为至少 3 关留下复盘，当前 ${reflectionCount} 关`]
    ];
    container.append(el('span', 'alp-achievement-heading', '我的学习足迹'));
    items.forEach(([label, earned, description]) => {
      const badge = el('span', 'alp-achievement', `${earned ? '✓' : '○'} ${label}`);
      badge.dataset.earned = String(earned); badge.title = description; container.append(badge);
    });
  }
  function renderStagePicker() {
    const grid = stageDialog.querySelector<HTMLElement>('.alp-stage-grid')!; grid.replaceChildren();
    stages.forEach(stage => {
      const gates = stageBasis(stage), done = completedCount(gates), complete = stage.completionMode !== 'routes' && gates.length > 0 && done === gates.length;
      const card = control('', 'alp-stage-card', () => { if (busy) return; stageDialog.close(); selectGate(stageCurrent(stage)?.id); stageButton.focus({ preventScroll: true }); });
      card.dataset.stageId = stage.id; card.dataset.completed = String(complete); card.setAttribute('aria-current', String(stageId === stage.id));
      add(card, el('span', 'alp-stage-index', `${complete ? '✓ 已完成 · ' : ''}第${stageNumber(stage)}章`), el('strong', 'alp-stage-name', stage.title), el('span', 'alp-stage-description', stage.description || stage.goal));
      const ranges = el('div', 'alp-ranges'); rangeTags(ranges, stage.cf, stage.luoguDifficulty, isOrientation(stage)); card.append(ranges);
      const bar = el('progress', 'alp-stage-progress'); bar.max = gates.length || 1; bar.value = done; bar.setAttribute('aria-label', `第${stageNumber(stage)}章完成 ${done} / ${gates.length} 关`);
      add(card, el('span', 'alp-stage-count', completionText(stage)), bar); grid.append(card);
    });
  }
  function openStagePicker() {
    if (busy) return; renderStagePicker(); previousFocus = stageButton; stageDialog.showModal();
    stageDialog.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  }
  function renderRoute(stage: Stage) {
    const route = el('div', 'alp-route');
    let previousSection: string | undefined;
    validGates(stage).forEach(gate => {
      if (gate.sectionId && gate.sectionId !== previousSection) {
        previousSection = gate.sectionId;
        const section = list(stage.sections).find(item => item.id === gate.sectionId);
        const heading = el('div', 'alp-section-marker');
        add(heading, el('strong', '', section?.title || gate.sectionTitle), el('span', '', section?.scope === 'route' ? '独立路线 · 按需进入' : section?.scope === 'elective' ? '选修扩展' : section?.scope === 'recommended' ? '推荐进阶' : '核心学习段'));
        route.append(heading);
      }
      const status = statusOf(gate, stage), selected = gateId === gate.id;
      const row = control('', 'alp-checkpoint', () => selectGate(gate.id, { focus: true, center: false }));
      row.dataset.gateId = gate.id; row.dataset.status = status; row.dataset.kind = gate.kind || 'learning'; row.setAttribute('aria-pressed', String(selected));
      const statusText = status === 'completed' ? '已完成' : gateProgress(gate.id)?.status === 'learning' ? '学习中' : status === 'learning' ? '下一关' : '未完成';
      row.setAttribute('aria-label', `第${stageNumber(stage)}章 第${gateNumber(gate)}关 ${gate.title}，${statusText}${selected ? '，已选择' : ''}`);
      const symbol = status === 'completed' ? '✓' : status === 'learning' ? '▶' : String(gateNumber(gate));
      const copy = el('span', 'alp-checkpoint-copy');
      add(copy, el('strong', '', `第${gateNumber(gate)}关 ${gate.title}`));
      if (gate.learningTitle && gate.learningTitle !== gate.title) copy.append(el('span', 'alp-checkpoint-story', gate.learningTitle));
      const scope = gate.scope === 'route' ? '路线基础' : gate.scope === 'recommended' ? '推荐进阶' : gate.scope === 'elective' || gate.optional ? '选修' : '核心';
      copy.append(el('span', 'alp-checkpoint-subtitle', `${kinds[gate.kind || ''] || '学习关'} · ${scope}${gate.cf || isOrientation(stage) ? ` · ${learningPosition(stage, gate.cf || stage.cf)}` : ''}`));
      add(row, el('span', 'alp-checkpoint-number', symbol), copy, el('span', 'alp-checkpoint-status', `${status === 'completed' ? '✓ ' : status === 'learning' ? '▶ ' : '○ '}${statusText}`));
      route.append(row);
      if (gate.kind === 'mixed' || gate.kind === 'challenge') {
        const checkpoint = el('div', 'alp-route-milestone'); checkpoint.append(el('span', '', gate.kind === 'challenge' ? '成果检验 · 独立应用与复盘' : '混合检验 · 选择已学工具')); route.append(checkpoint);
      }
    });
    routeScroll.replaceChildren(route);
  }
  function sectionHeading(title: string) { return el('h4', 'alp-section-title', title); }
  function renderDetail() {
    const entry = currentEntry(); detail.replaceChildren(); if (!entry) return;
    const { stage } = entry, gate = contentGate(entry.gate), record = gateProgress(gate.id);
    const readingPath = [
      { label: '闯关学习', onClick() { detailController?.close(); } },
      { label: `第${stageNumber(stage)}章 ${stage.title}`, onClick() { detailController?.close(); openStagePicker(); } },
      { label: `第${gateNumber(gate)}关 ${gate.title}` }
    ];
    detailController?.setPath(readingPath);
    const heading = el('h3', 'alp-gate-title', gate.title); heading.tabIndex = -1;
    const label = el('div', 'alp-detail-eyebrow', `第${stageNumber(stage)}章 · 第${gateNumber(gate)}关${gate.sectionTitle ? ` · ${gate.sectionTitle}` : ''}`);
    const header = el('div', 'alp-detail-header'), title = el('div', 'alp-detail-title');
    const scopeLabel = gate.scope === 'route' ? '路线基础' : gate.scope === 'recommended' ? '推荐进阶' : gate.scope === 'elective' ? '选修' : gate.scope === 'core' ? '核心' : gate.optional ? '选修' : '';
    add(title, label, heading, el('span', 'alp-kind', `${kinds[gate.kind || ''] || '学习关'}${scopeLabel ? ` · ${scopeLabel}` : ''}`));
    const open = control('打开详情', 'alp-button alp-button-secondary alp-detail-open-button reading-detail-trigger', () => {
      if (detailController || typeof ReadingDetail?.open !== 'function') return;
      detailController = ReadingDetail.open({ content: detail, mount: host, title: '关卡详情', path: readingPath, onClose() { detailController = null; } });
    });
    const headerActions = el('div', 'alp-detail-header-actions'); headerActions.append(open);
    if (canManage) {
      const content = publicContents.get(gate.id);
      const official = content ? content.practiceList : list(gate.practiceLists).find(item => practiceUrl(item.url));
      const edit = control(practiceUrl(official?.url) ? '编辑官方精选题单' : '＋ 添加官方精选题单', 'alp-button alp-button-secondary alp-official-add-button', () => openPublic(gate.id, true));
      edit.disabled = busy;
      headerActions.append(edit, control('编辑公共关卡', 'alp-text-button alp-public-edit-button', () => openPublic(gate.id)));
    }
    add(header, title, headerActions); detail.append(header);
    const publicVersion = publicContents.get(gate.id);
    if (publicVersion) detail.append(el('p', 'alp-public-version', `公共版${publicVersion.updatedAt && Number.isFinite(Date.parse(publicVersion.updatedAt)) ? ` · 更新于 ${new Date(publicVersion.updatedAt).toLocaleDateString('zh-CN')}` : ''}`));
    const introduction = text(gate.learningDescription).trim() || text(gate.description).trim();
    if (introduction || gate.learningTitle) {
      const story = el('div', 'alp-learning-story');
      if (gate.learningTitle && gate.learningTitle !== gate.title) story.append(el('strong', '', gate.learningTitle));
      if (introduction) {
        const sentences = introduction.match(/[^。！？]+[。！？]?/gu) || [introduction];
        const lead = introduction.length > 180 ? (sentences[0]!.length <= 180 ? sentences[0]! : introduction.slice(0, 170)) : introduction;
        story.append(el('p', 'alp-description', lead));
        if (lead !== introduction) {
          const expanded = el('details', 'alp-intro-more');
          add(expanded, el('summary', '', '继续阅读导读'), el('p', '', introduction.slice(lead.length).trim())); story.append(expanded);
        }
      }
      detail.append(story);
    }
    const related = list(gate.topicIds).map(id => topics.get(id)).filter(present);
    if (record) renderTasks(gate, related, record);
    else {
      detail.append(renderOfficialPractice(gate));
      if (gate.kind === 'learning') renderNotes(gate, related);
    }
    const goals = [...new Set(list(gate.goals).map(goal => text(goal).trim()).filter(Boolean))];
    if (goals.length) {
      const core = el('section', 'alp-core-goals');
      core.append(sectionHeading('本关核心目标'));
      const ul = el('ul', 'alp-goals'); goals.forEach(goal => ul.append(el('li', '', goal)));
      add(core, ul); detail.append(core);
    }
    const learningPanel = el('section', 'alp-learning-panel'), progressHeading = el('div', 'alp-progress-heading');
    const status = el('span', 'alp-progress-status', record?.status === 'completed' ? '✓ 已记录完成' : record?.status === 'learning' ? '▶ 学习中' : '○ 尚未记录');
    status.dataset.status = record?.status === 'completed' ? 'completed' : record?.status === 'learning' ? 'learning' : 'todo';
    add(progressHeading, sectionHeading('我的学习'), status); learningPanel.append(progressHeading);
    const actions = el('div', 'alp-actions');
    const complete = control(record?.status === 'completed' ? '编辑完成记录' : '✓ 记录本关完成', 'alp-button alp-button-primary alp-complete-button', () => openEvidence(gate.id));
    complete.disabled = busy || !canSave; actions.append(complete);
    const learning = control(record?.status === 'completed' ? '撤销完成，设为学习中' : record?.status === 'learning' ? '查看学习任务' : '▶ 开始学习', 'alp-button alp-button-secondary alp-learning-button', async () => {
      if (!record || record.status === 'completed') await saveStatus(gate.id, 'learning');
      if (!destroyed) detail.querySelector<HTMLElement>('.alp-task-list')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }); learning.disabled = busy || !canSave; actions.append(learning);
    add(learningPanel, actions, el('p', 'alp-fine-print alp-progress-hint', '自己记录学习状态，不代表系统判题通过。'));
    if (!canSave) learningPanel.append(el('p', 'alp-inline-error', '当前无法保存学习进度，请稍后重试。'));
    if (saveError) { const error = el('p', 'alp-inline-error', saveError); error.setAttribute('role', 'alert'); learningPanel.append(error); }
    if (record && (record.problemUrl || record.reflection || record.updatedAt)) {
      const saved = el('div', 'alp-saved-record');
      if (record.problemUrl) saved.append(el('p', 'alp-saved-url', record.problemUrl));
      if (record.reflection) saved.append(el('p', 'alp-saved-reflection', record.reflection));
      if (record.updatedAt && Number.isFinite(Date.parse(record.updatedAt as string))) saved.append(el('span', 'alp-saved-date', `记录于 ${new Date(record.updatedAt as string).toLocaleString('zh-CN')}`));
      learningPanel.append(saved);
    }
    const utilities = el('footer', 'alp-detail-utilities'), utilityActions = el('div', 'alp-utility-actions');
    if (related[0] && typeof opts.onUpload === 'function') {
      const upload = control('＋ 补充学习笔记', 'alp-text-button alp-upload-button', () => { if (opts.canUpload !== false) opts.onUpload!(related[0].node.id); });
      upload.disabled = opts.canUpload === false; if (upload.disabled) upload.title = '登录并获得仓库写入权限后可补充共享笔记'; utilityActions.append(upload);
    }
    utilities.append(utilityActions); learningPanel.append(utilities); detail.append(learningPanel);
    const supplementary = el('div', 'alp-supplementary');
    const knowledge = el('details', 'alp-detail-fold alp-knowledge-fold');
    add(knowledge, el('summary', '', `关联知识与难度${related.length ? ` · ${related.length} 项` : ''}`));
    const knowledgeBody = el('div', 'alp-fold-body'), ranges = el('div', 'alp-ranges');
    rangeTags(ranges, gate.cf || stage.cf, gate.luoguDifficulty || stage.luoguDifficulty, isOrientation(stage));
    knowledgeBody.append(ranges);
    if (!isOrientation(stage)) knowledgeBody.append(el('p', 'alp-fine-print', '题目难度用于选题；知识点等级独立显示，两者不作换算。'));
    if (related.length) {
      const group = el('div', 'alp-topics');
      related.forEach(topic => {
        const card = el('div', 'alp-topic'); card.append(nodeButton(topic));
        const grade = grades[topic.node.color || '']; if (grade && topic.node.kind !== 'directory') { const tag = el('span', 'alp-grade', grade[0]); tag.dataset.level = grade[1]; card.append(tag); }
        group.append(card);
      }); knowledgeBody.append(group);
    } else knowledgeBody.append(el('p', 'alp-fine-print', '知识点正在整理，可先按本关目标学习。'));
    knowledge.append(knowledgeBody); supplementary.append(knowledge);
    const thread = list(gate.threadGateIds).map(id => gateById.get(id)).filter(present);
    const requiredGates = list(gate.prerequisites?.gateIds).map(id => gateById.get(id)).filter(present);
    const requiredTopics = list(gate.prerequisites?.topicIds).map(id => topics.get(id)).filter(present);
    if (thread.length || requiredGates.length || requiredTopics.length) {
      const connections = el('details', 'alp-detail-fold alp-connections-fold'), connectionBody = el('div', 'alp-fold-body');
      connections.append(el('summary', '', '先修、回顾与延伸'));
      if (requiredGates.length || requiredTopics.length) {
        connectionBody.append(sectionHeading('先修与回补')); const group = el('div', 'alp-prerequisites');
        requiredGates.forEach(required => group.append(control(`${isCompleted(required.gate.id) ? '✓' : '↩'} 第${stageNumber(required.stage)}章·第${gateNumber(required.gate)}关 ${required.gate.title}`, 'alp-prerequisite', () => selectGate(required.gate.id, { focus: true }))));
        requiredTopics.forEach(topic => group.append(nodeButton(topic, `↩ ${topic.node.label}`, 'alp-prerequisite')));
        add(connectionBody, group, el('p', 'alp-fine-print', '先修是学习建议，可按掌握情况回补或跳学。'));
      }
      if (thread.length) {
        connectionBody.append(sectionHeading('把知识连成线')); const links = el('div', 'alp-thread');
        thread.forEach(item => {
          const before = item.stageIndex < entry.stageIndex || item.stageIndex === entry.stageIndex && item.index < entry.index;
          links.append(control(`${before ? '↩ 回顾' : '↗ 延伸'} · 第${stageNumber(item.stage)}章第${gateNumber(item.gate)}关 ${item.gate.title}`, 'alp-prerequisite alp-thread-link', () => selectGate(item.gate.id, { focus: true })));
        }); connectionBody.append(links);
      }
      connections.append(connectionBody); supplementary.append(connections);
    }
    const criteria = [...new Set(list(stage.completionCriteria).map(criterion => text(criterion).trim()).filter(Boolean))];
    if (criteria.length) {
      const chapterCheck = el('details', 'alp-detail-fold alp-chapter-fold'), chapterBody = el('div', 'alp-fold-body');
      chapterCheck.append(el('summary', '', isOrientation(stage) ? '导览完成检验' : '整章完成检验'));
      const criteriaList = el('ul', 'alp-goals alp-stage-criteria'); criteria.forEach(criterion => criteriaList.append(el('li', '', criterion)));
      add(chapterBody, el('p', 'alp-fine-print', '用于回看整章成果，不是额外的本关目标。'), criteriaList);
      chapterCheck.append(chapterBody); supplementary.append(chapterCheck);
    }
    detail.append(supplementary);
  }
  function taskState(record: GateProgress | null): Record<string, unknown> {
    const value = record?.tasks;
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...value as Record<string, unknown> } : {};
  }
  function practiceUrl(value: unknown): string | null {
    try { const parsed = new URL(text(value)); return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null; } catch { return null; }
  }
  async function openPractice(url: string) {
    try { if (opts.onExternal) await opts.onExternal(url); else window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (error) { notify(errorMessage(error, '暂时无法打开题单，请稍后重试。')); }
  }
  async function saveTask(gate: Gate, name: 'notes' | 'practice', checked: boolean) {
    if (busy || !canSave) return;
    const previous = gateProgress(gate.id), tasks = { ...taskState(previous), [name]: checked };
    const finished = tasks.practice === true && (gate.kind !== 'learning' || tasks.notes === true);
    try {
      await persist(gate.id, { ...previous, tasks, status: previous?.status === 'completed' && !finished ? 'learning' : previous?.status || 'learning', updatedAt: new Date().toISOString() });
      if (!destroyed) { renderMain(); detail.querySelector<HTMLInputElement>(`[data-task="${name}"] input`)?.focus({ preventScroll: true }); }
    } catch (error) { if (!destroyed) { saveError = errorMessage(error, '任务状态未能保存，请重试。'); renderDetail(); } }
  }
  function renderTasks(gate: Gate, related: TopicEntry[], record: GateProgress) {
    const tasks = taskState(record), ordinary = gate.kind === 'learning';
    const section = el('section', 'alp-task-list'); section.setAttribute('aria-label', '本关学习任务');
    const count = Number(tasks.practice === true) + Number(ordinary && tasks.notes === true);
    const heading = el('div', 'alp-task-heading'); add(heading, sectionHeading('本关学习任务'), el('span', 'alp-note-count', `${count} / ${ordinary ? 2 : 1} 项已完成`)); section.append(heading);
    function task(name: 'notes' | 'practice', title: string) {
      const card = el('section', 'alp-task-card'); card.dataset.task = name;
      const label = el('label', 'alp-task-check'), check = el('input'); check.type = 'checkbox'; check.checked = tasks[name] === true; check.disabled = busy || !canSave;
      check.addEventListener('change', () => { void saveTask(gate, name, check.checked); });
      add(label, check, el('strong', '', title)); card.append(label); return card;
    }
    if (ordinary) {
      const notes = task('notes', '算法笔记学习'); section.append(notes);
      const noteSection = renderNotes(gate, related);
      if (noteSection) notes.append(noteSection);
      else {
        const links = el('div', 'alp-task-topic-links'); related.forEach(topic => links.append(nodeButton(topic))); notes.append(links);
      }
    }
    const practice = task('practice', '对应题单练习'); section.append(practice);
    practice.append(renderOfficialPractice(gate));
    const personal = el('div', 'alp-personal-list');
    const savedUrl = practiceUrl(record.practiceUrl) || practiceUrl(record.problemUrl);
    if (savedUrl) personal.append(control('我的练习题单 ↗', 'alp-text-button alp-practice-link alp-personal-link', () => openPractice(savedUrl)));
    const edit = control(savedUrl ? '编辑我的题单' : '＋ 添加我的题单', 'alp-text-button alp-personal-list-button', () => openPersonal(gate.id)); edit.disabled = busy || !canSave;
    personal.append(edit); practice.append(personal);
    section.append(el('p', 'alp-fine-print', ordinary ? '先学习笔记，再完成题单；勾选记录后可记录本关完成。' : '本关为混练或验收，只需完成题单练习。'));
    detail.append(section);
  }
  function renderOfficialPractice(gate: Gate) {
    const section = el('section', 'alp-official-section'); section.setAttribute('aria-label', '官方精选题单');
    const content = publicContents.get(gate.id);
    const official = content ? content.practiceList : list(gate.practiceLists).find(item => practiceUrl(item.url));
    const officialUrl = practiceUrl(official?.url);
    if (official && officialUrl) {
      const recommendation = control('', 'alp-official-list alp-practice-link', () => openPractice(officialUrl));
      const copy = el('span', 'alp-official-copy');
      add(copy, el('span', 'alp-official-label', '官方精选题单'), el('strong', '', official.title || '本关精选练习'), el('span', 'alp-official-host', new URL(officialUrl).hostname));
      add(recommendation, copy, el('span', 'alp-list-arrow', '↗')); section.append(recommendation);
    } else {
      const empty = el('div', 'alp-official-empty');
      add(empty, el('strong', '', '官方精选题单'), el('span', 'alp-fine-print', '本关官方题单尚未发布'));
      section.append(empty);
    }
    return section;
  }
  function renderNotes(gate: Gate, related: TopicEntry[]) {
    const ids = new Set(related.map(topic => topic.node.id));
    related.forEach(topic => { if (topic.node.contentOf) ids.add(topics.get(topic.node.contentOf)?.node.id || topic.node.contentOf); });
    const notes = sharedNotes.filter(note => ids.has(topics.get(note.nodeId)?.node.id as string)).slice().sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (Date.parse(b.updatedAt as string) || 0) - (Date.parse(a.updatedAt as string) || 0));
    if (!notes.length) return null;
    const section = el('section', 'alp-note-section'), heading = el('div', 'alp-notes-heading');
    add(heading, sectionHeading(notes.some(note => note.featured) ? '精选与学习笔记' : '学习笔记'), el('span', 'alp-note-count', `${notes.length} 篇`)); section.append(heading);
    const noteList = el('div', 'alp-notes');
    notes.forEach((note, index) => {
      const topic = topics.get(note.nodeId)!; const noteButton = control('', `alp-note${note.featured ? ' alp-note-featured' : ''}`, () => { if (typeof opts.onNote === 'function') opts.onNote(note, { gateId: gate.id }); else opts.onTopic?.(topic.node.id); });
      const copy = el('span', 'alp-note-copy');
      if (note.featured) copy.append(el('span', 'alp-note-featured-label', '精选'));
      add(copy, el('strong', '', note.title || '未命名笔记'), el('span', 'alp-note-meta', `${authorName(note.author)} · ${topic.node.label}`));
      const arrow = el('span', 'alp-note-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
      add(noteButton, copy, arrow); noteButton.title = '打开笔记详情';
      if (index < 3) noteList.append(noteButton);
      else {
        let more = section.querySelector<HTMLDetailsElement>('.alp-more-notes');
        if (!more) { more = el('details', 'alp-more-notes'); more.append(el('summary', '', `更多笔记 · ${notes.length - 3} 篇`)); section.append(more); }
        more.append(noteButton);
      }
    });
    section.insertBefore(noteList, section.querySelector('.alp-more-notes')); detail.append(section);
    return section;
  }
  function renderMain({ center = false } = {}) {
    if (destroyed || !stages.length) return;
    const stage = stageById.get(stageId)!.stage, oldScroll = routeScroll.scrollTop;
    renderSummary(); renderAchievements();
    stageButton.replaceChildren();
    add(stageButton, el('span', 'alp-selected-stage-number', String(stageNumber(stage)).padStart(2, '0')));
    const name = el('span', 'alp-selected-stage-copy'); add(name, el('strong', '', `第${stageNumber(stage)}章 ${stage.title}`), el('span', '', `${completionText(stage)} · 共 ${validGates(stage).length} 关，含扩展`));
    add(stageButton, name, el('span', 'alp-switch-label', '切换阶段 ⌄'));
    const stageIntro = root.querySelector<HTMLElement>('.alp-stage-intro')!; stageIntro.replaceChildren();
    add(stageIntro, el('span', 'alp-eyebrow', `阶段 ${stageNumber(stage)} · ${isOrientation(stage) ? '入门导览' : stage.completionMode === 'routes' ? '选择具体路线，分别形成成果' : '一章一条主线，学完整再进阶'}`), el('h2', 'alp-stage-title', `第${stageNumber(stage)}章 ${stage.title}`));
    const ranges = el('div', 'alp-ranges'); rangeTags(ranges, stage.cf, stage.luoguDifficulty, isOrientation(stage));
    add(stageIntro, ranges, el('p', 'alp-description', stage.description || stage.goal));
    if (stage.entryText) stageIntro.append(el('p', 'alp-entry-text', `进入条件：${stage.entryText}`));
    if (list(stage.sections).length) {
      const sections = el('div', 'alp-section-overview');
      for (const section of list(stage.sections)) {
        const group = foundationGates(validGates(stage).filter(gate => gate.sectionId === section.id));
        const done = completedCount(group);
        const scope = section.scope === 'route' ? '路线基础' : section.scope === 'recommended' ? '推荐进阶' : section.scope === 'elective' ? '选修' : '核心';
        const link = control('', 'alp-section-chip', () => { const next = group.find(gate => !isCompleted(gate.id)) || validGates(stage).find(gate => gate.sectionId === section.id); if (next) selectGate(next.id, { center: true }); });
        add(link, el('strong', '', section.title), el('span', '', `${scope}${group.length ? ` · ${done} / ${group.length}` : ''}`));
        if (group.length && done === group.length) link.dataset.completed = 'true';
        sections.append(link);
      }
      stageIntro.append(sections);
    }
    const orientation = isOrientation(stage);
    root.querySelector<HTMLElement>('.alp-footer')!.hidden = orientation;
    renderRoute(stage); renderDetail();
    routeScroll.scrollTop = oldScroll;
    if (center) centerSelected();
    if (lastCelebrated) showCelebration(lastCelebrated);
  }
  function centerSelected() {
    const selected = root.querySelector<HTMLElement>('.alp-checkpoint[aria-pressed="true"]'); if (!selected) return;
    const delta = selected.getBoundingClientRect().top - routeScroll.getBoundingClientRect().top;
    routeScroll.scrollTop += delta - routeScroll.clientHeight * .38;
  }
  function showCelebration(message: string) {
    const band = root.querySelector<HTMLElement>('.alp-success')!; band.textContent = message; band.hidden = false;
    clearTimeout(celebrationTimer); celebrationTimer = setTimeout(() => { if (!destroyed) { band.hidden = true; lastCelebrated = null; } }, 2200);
  }
  function buildDialog(title: string, className: string) {
    const dialog = el('dialog', `alp-dialog ${className}`), headingId = `${uid}-${className}-heading`;
    dialog.setAttribute('aria-labelledby', headingId);
    const header = el('div', 'alp-dialog-heading'), heading = el('h2', '', title); heading.id = headingId;
    const close = control('×', 'alp-dialog-close', () => { if (!busy) dialog.close(); }); close.setAttribute('aria-label', '关闭');
    add(header, heading, close); dialog.append(header);
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('click', event => { if (event.target === dialog && !busy) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { if (!destroyed && previousFocus?.isConnected && 'focus' in previousFocus) (previousFocus as HTMLElement).focus({ preventScroll: true }); });
    return dialog;
  }
  function field(labelText: string, input: HTMLElement) { const label = el('label', 'alp-field'); add(label, el('span', '', labelText), input); return label; }
  function buildPersonalDialog() {
    const dialog = buildDialog('我的练习题单', 'alp-personal-dialog'), form = el('form', 'alp-task-practice-form'); form.noValidate = true;
    personalInput = el('input'); personalInput.type = 'url'; personalInput.maxLength = 2000; personalInput.placeholder = 'https://…'; personalInput.setAttribute('aria-label', '对应题单链接');
    personalError = el('p', 'alp-inline-error'); personalError.hidden = true; personalError.setAttribute('role', 'alert');
    const save = el('button', 'alp-button alp-button-primary', '保存题单'); save.type = 'submit';
    const actions = el('div', 'alp-dialog-actions'); add(actions, control('取消', 'alp-button alp-button-secondary', () => { if (!busy) dialog.close(); }), save);
    add(form, el('p', 'alp-fine-print', '仅保存到你的学习记录。留空保存可移除个人题单链接。'), field('题单链接', personalInput), personalError, actions);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || !canSave || !personalGateId) return;
      const value = personalInput.value.trim(), url = practiceUrl(value);
      if (value && !url) { personalError.textContent = '请填写有效的 HTTP 或 HTTPS 题单链接。'; personalError.hidden = false; personalInput.focus(); return; }
      personalError.hidden = true; const id = personalGateId;
      try {
        await persist(id, { ...gateProgress(id), status: gateProgress(id)?.status || 'learning', practiceUrl: url || '', updatedAt: new Date().toISOString() });
        if (!destroyed) { dialog.close(); renderMain(); detail.querySelector<HTMLButtonElement>('.alp-personal-list-button')?.focus({ preventScroll: true }); notify('题单链接已保存'); }
      } catch (cause) { if (!destroyed) { personalError.textContent = errorMessage(cause, '题单链接未能保存，请重试。'); personalError.hidden = false; } }
    });
    dialog.append(form); return dialog;
  }
  function openPersonal(id: string) {
    if (busy || !canSave || !gateById.has(id)) return;
    personalGateId = id; personalInput.value = text(gateProgress(id)?.practiceUrl); personalError.hidden = true;
    previousFocus = document.activeElement; personalDialog.showModal(); personalInput.focus();
  }
  function buildPublicDialog() {
    const dialog = buildDialog('编辑公共关卡', 'alp-public-dialog'), form = el('form', 'alp-public-form'); form.noValidate = true;
    publicDescription = el('textarea'); publicDescription.name = 'description'; publicDescription.rows = 4; publicDescription.maxLength = 6000;
    publicGoals = el('textarea'); publicGoals.name = 'goals'; publicGoals.rows = 5; publicGoals.maxLength = 6000;
    publicTitle = el('input'); publicTitle.name = 'practiceTitle'; publicTitle.maxLength = 120;
    publicUrl = el('input'); publicUrl.name = 'practiceUrl'; publicUrl.type = 'url'; publicUrl.maxLength = 2000; publicUrl.placeholder = 'https://…';
    publicError = el('p', 'alp-inline-error'); publicError.hidden = true; publicError.setAttribute('role', 'alert');
    const recommendation = el('fieldset', 'alp-public-practice'); recommendation.append(el('legend', '', '官方精选题单 · 最多一个'));
    add(recommendation, field('题单名称', publicTitle), field('题单链接', publicUrl));
    const preview = el('section', 'alp-public-preview'); preview.setAttribute('aria-label', '公共版预览');
    function renderPreview() {
      preview.replaceChildren(sectionHeading('公共版预览'), el('p', 'alp-preview-description', publicDescription.value.trim()));
      const goals = el('ul', 'alp-goals'); publicGoals.value.split(/\r?\n/u).map(value => value.trim()).filter(Boolean).forEach(value => goals.append(el('li', '', value))); preview.append(goals);
      const url = practiceUrl(publicUrl.value.trim());
      if (publicTitle.value.trim() && url) { const card = el('div', 'alp-official-list'); const copy = el('span', 'alp-official-copy'); add(copy, el('span', 'alp-official-label', '官方精选题单'), el('strong', '', publicTitle.value.trim()), el('span', 'alp-official-host', new URL(url).hostname)); card.append(copy); preview.append(card); }
    }
    form.addEventListener('input', renderPreview); dialog.addEventListener('alp:preview', renderPreview);
    const save = el('button', 'alp-button alp-button-primary', '发布公共版'); save.type = 'submit';
    const actions = el('div', 'alp-dialog-actions'); add(actions, control('取消', 'alp-button alp-button-secondary', () => { if (!busy) dialog.close(); }), save);
    add(form, el('p', 'alp-fine-print', '发布后，所有读者都可看到此简介、学习目标和官方题单。'), field('关卡简介', publicDescription), field('核心目标（每行一项）', publicGoals), recommendation, preview, publicError, actions);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || !canManage || !opts.onSaveGate || !publicGateId) return;
      const description = publicDescription.value.trim(), goals = publicGoals.value.split(/\r?\n/u).map(value => value.trim()).filter(Boolean);
      const title = publicTitle.value.trim(), value = publicUrl.value.trim(), url = practiceUrl(value);
      if (!description || !goals.length) { publicError.textContent = '请填写关卡简介和至少一项核心目标。'; publicError.hidden = false; (!description ? publicDescription : publicGoals).focus(); return; }
      if (goals.length > 20 || goals.some(goal => goal.length > 500)) { publicError.textContent = '核心目标最多 20 项，每项不超过 500 字。'; publicError.hidden = false; publicGoals.focus(); return; }
      if ((title || value) && (!title || !url)) { publicError.textContent = '官方题单需填写名称和有效的 HTTP 或 HTTPS 链接，或同时留空。'; publicError.hidden = false; (!title ? publicTitle : publicUrl).focus(); return; }
      const id = publicGateId; publicError.hidden = true; setBusy(true);
      try {
        const saved: GateContent = await opts.onSaveGate({ gateId: id, description, goals, practiceList: title && url ? { title, url } : null, sha: publicContents.get(id)?.sha || null });
        if (saved.gateId !== id) throw new Error('返回的公共关卡与当前关卡不一致，请刷新后重试。');
        if (!destroyed) { publicContents.set(id, saved); dialog.close(); renderMain(); detail.querySelector<HTMLButtonElement>('.alp-public-edit-button')?.focus({ preventScroll: true }); notify('公共版已发布'); }
      } catch (cause) { if (!destroyed) { publicError.textContent = errorMessage(cause, '公共版未能发布，请保留输入后重试。'); publicError.hidden = false; } }
      finally { if (!destroyed) setBusy(false); }
    });
    dialog.append(form); return dialog;
  }
  function openPublic(id: string, focusList = false) {
    if (busy || !canManage || !gateById.has(id)) return;
    const gate = contentGate(gateById.get(id)!.gate), content = publicContents.get(id), official = content ? content.practiceList : list(gate.practiceLists).find(item => practiceUrl(item.url));
    publicGateId = id; publicDescription.value = text(gate.learningDescription) || text(gate.description); publicGoals.value = list(gate.goals).join('\n'); publicTitle.value = text(official?.title); publicUrl.value = text(official?.url); publicError.hidden = true;
    previousFocus = document.activeElement; publicDialog.dispatchEvent(new Event('alp:preview')); publicDialog.showModal(); (focusList ? publicTitle : publicDescription).focus();
  }
  function buildEvidenceDialog() {
    const dialog = buildDialog('记录本关学习', 'alp-evidence-dialog');
    const form = el('form', 'alp-evidence-form') as EvidenceForm;
    const gateTitle = el('p', 'alp-evidence-title');
    const status = el('select'); status.name = 'status';
    for (const [value, label] of [['learning', '学习中'], ['completed', '已完成（自己记录）']]) { const option = el('option', '', label); option.value = value; status.append(option); }
    const url = el('input'); url.name = 'problemUrl'; url.type = 'url'; url.maxLength = 2000; url.placeholder = 'https://…'; url.autocomplete = 'off';
    const reflection = el('textarea'); reflection.name = 'reflection'; reflection.rows = 5; reflection.maxLength = 4000; reflection.placeholder = '写下独立解题过程、关键观察，或还没有弄清楚的地方。';
    evidenceError = el('p', 'alp-inline-error'); evidenceError.setAttribute('role', 'alert'); evidenceError.hidden = true;
    const actions = el('div', 'alp-dialog-actions'), cancel = control('取消', 'alp-button alp-button-secondary', () => { if (!busy) dialog.close(); });
    const save = el('button', 'alp-button alp-button-primary', '保存记录'); save.type = 'submit';
    add(actions, cancel, save);
    add(form, gateTitle, el('p', 'alp-fine-print', '如实记录学习情况；题目链接和复盘可选。这里不会自动判断提交结果，也不会向队友或外部平台发送内容。'), field('学习状态', status), field('练习题目链接（可选）', url), field('我的复盘（可选）', reflection), evidenceError, actions);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || !evidenceGateId || !canSave) return;
      const problemUrl = url.value.trim();
      if (problemUrl) { try { const parsed = new URL(problemUrl); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); } catch (_) { evidenceError.textContent = '请填写有效的 HTTP 或 HTTPS 题目链接。'; evidenceError.hidden = false; url.focus(); return; } }
      evidenceError.hidden = true;
      const nextRecord = { ...gateProgress(evidenceGateId), status: status.value, problemUrl, reflection: reflection.value.trim(), updatedAt: new Date().toISOString() };
      try {
        await persist(evidenceGateId, nextRecord);
        if (destroyed) return;
        dialog.close(); renderMain();
        if (nextRecord.status === 'completed') { lastCelebrated = isOrientation(gateById.get(evidenceGateId)!.stage) ? '✓ 导览完成记录已保存。' : '✓ 本关完成记录已保存，继续积累自己的解题方法。'; showCelebration(lastCelebrated); }
        detail.querySelector<HTMLButtonElement>('.alp-complete-button')?.focus({ preventScroll: true });
      } catch (error) { if (!destroyed) { evidenceError.textContent = errorMessage(error, '未能保存，请保留记录后重试。'); evidenceError.hidden = false; } }
    });
    evidenceForm = form; dialog.append(form); return dialog;
  }
  function openEvidence(id: string, preferredStatus?: string) {
    if (busy || !gateById.has(id)) return;
    evidenceGateId = id; const entry = gateById.get(id)!, record = gateProgress(id);
    evidenceForm.querySelector<HTMLElement>('.alp-evidence-title')!.textContent = `第${stageNumber(entry.stage)}章 · 第${gateNumber(entry.gate)}关 ${entry.gate.title}`;
    evidenceForm.elements.status.value = preferredStatus || 'completed';
    evidenceForm.elements.problemUrl.value = String(record?.problemUrl || '');
    evidenceForm.elements.reflection.value = String(record?.reflection || '');
    evidenceForm.elements.reflection.placeholder = isOrientation(entry.stage) ? '写下导览中的理解，或还没有弄清楚的地方。' : '写下独立解题过程、关键观察，或还没有弄清楚的地方。';
    evidenceError.hidden = true; previousFocus = document.activeElement;
    evidenceDialog.showModal(); evidenceForm.elements.reflection.focus();
  }
  function setBusy(value: boolean) {
    busy = value; root.dataset.saving = String(value); root.setAttribute('aria-busy', String(value));
    evidenceForm?.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement | HTMLSelectElement>('button,input,textarea,select').forEach(input => { input.disabled = value; });
    for (const dialog of [personalDialog, publicDialog]) dialog?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('button,input,textarea').forEach(input => { input.disabled = value; });
    evidenceDialog?.querySelector('.alp-dialog-close')?.toggleAttribute('disabled', value);
    detail.querySelectorAll<HTMLButtonElement>('.alp-public-edit-button,.alp-official-add-button,.alp-personal-list-button').forEach(button => { button.disabled = value; });
    detail.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.alp-complete-button,.alp-learning-button,.alp-task-list input,.alp-task-list button[type="submit"]').forEach(button => { button.disabled = value || !canSave; });
  }
  async function persist(id: string, record: GateProgress) {
    if (!canSave) throw new Error('当前无法保存学习进度，请稍后重试。');
    const entry = gateById.get(id); if (!entry) throw new Error('未找到此关卡，请重新打开学习路径。');
    const next = { ...progress, gates: { ...progress.gates, [id]: record }, stageId: entry.stage.id, gateId: id };
    setBusy(true);
    try { await opts.onProgress!(next); progress = next; saveError = ''; }
    finally { if (!destroyed) setBusy(false); }
  }
  async function saveStatus(id: string, status: string) {
    if (busy || !canSave) return;
    const previous = gateProgress(id);
    try {
      await persist(id, { ...previous, status, problemUrl: text(previous?.problemUrl), reflection: text(previous?.reflection), updatedAt: new Date().toISOString() });
      if (!destroyed) { renderMain(); notify(status === 'learning' ? '已保存为学习中' : '本关完成记录已保存'); }
    } catch (error) { if (!destroyed) { saveError = errorMessage(error, '进度未能保存，请重试。'); renderDetail(); } }
  }
  root = el('section', 'alp'); root.setAttribute('aria-label', '算法竞赛闯关学习路径');
  if (!stages.length || !gateById.size) {
    add(root, el('h2', 'alp-empty-title', '学习路径正在整理'), el('p', 'alp-description', '关卡准备完成后会显示在这里，可以先从知识树查看学习笔记。')); host.replaceChildren(root);
    return { destroy() { destroyed = true; root.remove(); }, selectTopic() { return false; }, selectGate() { return false; } };
  }
  summary = el('div', 'alp-summary'); summary.setAttribute('aria-label', '学习进度概览');
  const legend = el('div', 'alp-state-legend');
  for (const [type, symbol, label] of [['completed', '✓', '已完成'], ['learning', '▶', '学习中 / 下一关'], ['todo', '○', '未完成']]) { const item = el('span', 'alp-state-item'); const mark = el('i', 'alp-state-mark', symbol); mark.dataset.status = type; add(item, mark, el('span', '', label)); legend.append(item); }
  legend.append(el('span', 'alp-record-hint', '进度由自己记录，先修满足即可跳学'));
  const achievements = el('div', 'alp-achievements'); achievements.setAttribute('aria-label', '学习足迹');
  const main = el('div', 'alp-main');
  const pickerRow = el('div', 'alp-stage-picker-row'); stageButton = control('', 'alp-stage-picker', openStagePicker); stageButton.setAttribute('aria-haspopup', 'dialog'); pickerRow.append(stageButton);
  const stageIntro = el('div', 'alp-stage-intro');
  const columns = el('div', 'alp-columns');
  routeScroll = el('div', 'alp-route-scroll'); routeScroll.setAttribute('aria-label', '本章关卡路线'); routeScroll.tabIndex = 0;
  detail = el('aside', 'alp-detail'); detail.setAttribute('aria-label', '所选关卡详情'); add(columns, routeScroll, detail);
  add(main, pickerRow, stageIntro, columns);
  const success = el('div', 'alp-success'); success.hidden = true; success.setAttribute('role', 'status'); success.setAttribute('aria-live', 'polite');
  stageDialog = buildDialog('选择学习阶段', 'alp-stage-dialog'); stageDialog.append(el('p', 'alp-picker-hint', '以综合做题能力为主线，先广后深；阶段可以自由切换，已有基础可直接跳学。'), el('div', 'alp-stage-grid'));
  evidenceDialog = buildEvidenceDialog(); personalDialog = buildPersonalDialog(); publicDialog = buildPublicDialog();
  const footer = el('p', 'alp-footer', 'CF 区间和洛谷等级分别用于选题参考，不作等价换算。知识点难度与题目难度独立；阅读和勾选不能代替独立做题。');
  add(root, summary, legend, achievements, success, main, footer, stageDialog, evidenceDialog, personalDialog, publicDialog);
  host.replaceChildren(root); remember(); renderMain({ center: true });
  const controller = {
    destroy() { if (destroyed) return; destroyed = true; detailController?.close(); detailController = null; clearTimeout(celebrationTimer); [stageDialog, evidenceDialog, personalDialog, publicDialog].forEach(dialog => { if (dialog.open) dialog.close(); }); root.remove(); },
    selectGate(id: string) { return selectGate(id, { focus: true }); },
    selectTopic(id: string) {
      const canonicalId = topics.get(id)?.node.id || id;
      const matches = new Set([canonicalId]);
      function include(node: TopicNode | undefined) { if (!node) return; matches.add(node.id); list(node.children).forEach(include); }
      include(topics.get(id)?.node);
      for (const topic of topics.values()) if (topic.node.contentOf === canonicalId) matches.add(topic.node.id);
      const entry = records().find(({ gate }) => list(gate.topicIds).some(topicId => matches.has(topics.get(topicId)?.node.id || topicId)));
      if (entry) return selectGate(entry.gate.id, { focus: true });
      notify('该专题暂未编入主线，可在知识树继续学习'); return false;
    }
  };
  return controller;
}
export const LearningPath = Object.freeze({ render });
