import type { LearningPathController, LearningPathProgress } from '../../../types/learning-path.js';
import type { RoadmapData, RoadmapEdge, RoadmapNode } from '../../shared/models/learning-roadmap.js';
import type { AlgorithmDirectoryNode } from '../../shared/models/algorithm-directory.js';
import type { AlgorithmNodeContent } from '../../shared/models/algorithm-node-content.js';
import { resolveAlgorithmLeaf } from '../../shared/algorithm-leaf.js';

/** Route categories describe their range in one Markdown document. */
export function roadmapIntroduction(node: RoadmapNode): string {
  return [node.detail[0], node.detail[1], node.detail[2].map(text => `- ${text}`).join('\n')].filter(Boolean).join('\n\n');
}
export function roadmapLeaves(tree: AlgorithmDirectoryNode, node: RoadmapNode): AlgorithmDirectoryNode[] {
  const leaves = new Map<string, AlgorithmDirectoryNode>();
  for (const id of node.topicIds || []) { const leaf = resolveAlgorithmLeaf(tree, id); if (leaf) leaves.set(leaf.id, leaf); }
  return [...leaves.values()];
}

export interface RoadmapOptions {
  host: HTMLElement;
  data: RoadmapData;
  progress?: LearningPathProgress;
  onFocus?: (id: string | null) => Promise<unknown>;
  onOpenResources?: (node: RoadmapNode) => void;
  tree?: AlgorithmDirectoryNode;
  nodeContents?: AlgorithmNodeContent[];
  renderMarkdown?: (host: HTMLElement, markdown: string) => void;
  onOpenLeaf?: (topicId: string) => void;
  canManage?: boolean;
  getIntroduction?: (node: RoadmapNode) => string | undefined;
  onSaveIntroduction?: (nodeId: string, markdown: string) => Promise<void>;
  toast?: (message: string) => void;
}

type Point = [number, number];
type RouteNode = RoadmapNode & { w: number; h: number; x: number; y: number; cx: number };
type QueueEntry = { key: number; g: number; f: number };
const WIDTH = 1500, HEIGHT = 1240;
const BAND_STARTS = [16, 324, 646, 986], BAND_HEIGHTS = [250, 304, 310, 180];
let serial = 0;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(label: string, className: string, run: () => void): HTMLButtonElement {
  const node = element('button', `arm-button ${className}`, label);
  node.type = 'button';
  node.addEventListener('click', run);
  return node;
}
function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

/** Approved card positions, with orthogonal paths through the empty corridors. */
function route(a: RouteNode, b: RouteNode, nodes: RouteNode[]): Point[] {
  const same = Math.abs(a.y - b.y) < 2, up = b.y < a.y;
  const start: Point = [a.cx, up ? a.y - 14 : a.y + a.h + 14];
  const end: Point = [b.cx, same || up ? b.y + b.h + 14 : b.y - 14];
  const xs = [...new Set([18, 1482, start[0], end[0], ...nodes.flatMap(n => [n.x - 14, n.x + n.w + 14, n.cx])])].sort((x, y) => x - y);
  const ys = [...new Set([10, 1170, start[1], end[1], ...nodes.flatMap(n => [n.y - 14, n.y + n.h + 14])])].sort((x, y) => x - y);
  const nx = xs.length, ny = ys.length, tx = xs.indexOf(end[0]), ty = ys.indexOf(end[1]);
  const initial = (ys.indexOf(start[1]) * nx + xs.indexOf(start[0])) * 3;
  const heap: QueueEntry[] = [], best = new Map<number, number>([[initial, 0]]), previous = new Map<number, number>();
  function push(entry: QueueEntry): void {
    heap.push(entry);
    let index = heap.length - 1;
    while (index) {
      const parent = (index - 1) >> 1;
      if (heap[parent].f <= entry.f) break;
      heap[index] = heap[parent]; index = parent;
    }
    heap[index] = entry;
  }
  function pop(): QueueEntry | undefined {
    const first = heap[0], last = heap.pop();
    if (heap.length && last) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let child = index * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++;
        if (heap[child].f >= last.f) break;
        heap[index] = heap[child]; index = child;
      }
      heap[index] = last;
    }
    return first;
  }
  function free(x1: number, y1: number, x2: number, y2: number): boolean {
    return !nodes.some(n => x1 === x2
      ? x1 > n.x - 5 && x1 < n.x + n.w + 5 && Math.max(y1, y2) > n.y - 5 && Math.min(y1, y2) < n.y + n.h + 5
      : y1 > n.y - 5 && y1 < n.y + n.h + 5 && Math.max(x1, x2) > n.x - 5 && Math.min(x1, x2) < n.x + n.w + 5);
  }
  push({ key: initial, g: 0, f: 0 });
  let finish: number | undefined;
  while (heap.length) {
    const entry = pop();
    if (!entry || entry.g !== best.get(entry.key)) continue;
    const direction = entry.key % 3, position = Math.floor(entry.key / 3), x = position % nx, y = Math.floor(position / nx);
    if (x === tx && y === ty) { finish = entry.key; break; }
    const neighbours: [number, number, number][] = [[x - 1, y, 1], [x + 1, y, 1], [x, y - 1, 2], [x, y + 1, 2]];
    for (const [xx, yy, nextDirection] of neighbours) {
      if (xx < 0 || xx >= nx || yy < 0 || yy >= ny || !free(xs[x], ys[y], xs[xx], ys[yy])) continue;
      const key = (yy * nx + xx) * 3 + nextDirection;
      const cost = entry.g + Math.abs(xs[x] - xs[xx]) + Math.abs(ys[y] - ys[yy]) + (direction && direction !== nextDirection ? 25 : 0);
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost); previous.set(key, entry.key);
      push({ key, g: cost, f: cost + Math.abs(xs[xx] - end[0]) + Math.abs(ys[yy] - end[1]) });
    }
  }
  if (finish === undefined) throw new Error(`No clear roadmap route: ${a.id} → ${b.id}`);
  const middle: Point[] = [];
  for (let key: number | undefined = finish; key !== undefined; key = previous.get(key)) {
    const position = Math.floor(key / 3);
    middle.push([xs[position % nx], ys[Math.floor(position / nx)]]);
  }
  middle.reverse();
  const points: Point[] = [[a.cx, up ? a.y : a.y + a.h], ...middle, [b.cx, same || up ? b.y + b.h : b.y]];
  const simplified: Point[] = [];
  for (const point of points) {
    while (simplified.length >= 2) {
      const before = simplified[simplified.length - 2], last = simplified[simplified.length - 1];
      if ((before[0] === last[0] && last[0] === point[0]) || (before[1] === last[1] && last[1] === point[1])) simplified.pop();
      else break;
    }
    simplified.push(point);
  }
  return simplified;
}

function render(options: RoadmapOptions): LearningPathController {
  const { host, data } = options, uid = `arm-${++serial}`;
  const nodes: RouteNode[] = data.nodes.map(node => ({ ...node, x: node.px, y: node.py, w: 164, h: 74, cx: node.px + 82 }));
  const graphById = new Map(nodes.map(node => [node.id, node]));
  const byId = new Map([...data.nodes, ...data.indexEntries].map(node => [node.id, node]));
  const cards = new Map<string, HTMLButtonElement[]>(), edgeElements: { edge: RoadmapEdge; path: SVGPathElement }[] = [];
  const stageButtons: HTMLButtonElement[] = [];
  let selected: string | null = null, hovered: string | null = null, stage: number | null = null, query = '';
  let position = typeof options.progress?.roadmapFocus === 'string' ? options.progress.roadmapFocus : null;
  let autoFit = true, zoom = 1, listMode = false, highlight = true, destroyed = false, pending = false, frame = 0;
  let detailNode: RoadmapNode | null = null, previousFocus: HTMLElement | null = null;

  const root = element('section', 'arm'); root.setAttribute('aria-label', '学习路线'); root.dataset.view = 'graph';
  const header = element('header', 'arm-header');
  const heading = element('div', 'arm-heading');
  heading.append(element('span', 'arm-eyebrow', 'C++ · ALGORITHM ROADMAP'), element('h2', 'arm-title', '由广入深，看清知识怎样连接。'), element('p', 'arm-subtitle', '初窥、入门、基础、进阶，沿知识联系逐步展开。点击节点查看范围，按问题跳学与回补。'));
  const readingHint = element('aside', 'arm-reading-hint');
  readingHint.append(element('strong', '', '读图方式'), element('p', '', '纵向看层次，横向看分支。悬停看关联，点击看知识范围。'));
  header.append(heading, readingHint); root.append(header);
  const top = element('section', 'arm-top-stages'); top.setAttribute('aria-label', '四个知识阶段');
  const navigation = element('nav', 'arm-stage-nav'); navigation.setAttribute('aria-label', '阶段定位');
  data.rows.forEach((row, index) => {
    const card = button('', 'arm-stage-button', () => {
      stage = stage === index ? null : index; selected = null; hovered = null; paint();
      if (stage !== null && !listMode) bands[index]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    card.dataset.stage = String(index); card.style.setProperty('--arm-stage', row.color); card.style.setProperty('--arm-stage-soft', row.bg);
    card.append(element('span', 'arm-stage-number', `阶段 ${index + 1}`), element('strong', '', row.name), element('p', '', data.goals[index] || ''));
    card.setAttribute('aria-pressed', 'false'); navigation.append(card); stageButtons.push(card);
  });
  top.append(navigation, element('p', 'arm-color-note', '绿 · 蓝 · 金 · 红表示内容由浅入深。同一阶段可以有多条并行分支；虚线节点可在遇到时补学。'));
  root.append(top);
  const controls = element('div', 'arm-controls'), controlLeft = element('div', 'arm-control-left'), controlRight = element('div', 'arm-control-right');
  const search = element('input', 'arm-search'); search.type = 'search'; search.placeholder = '找知识，例如：线性基、STL、BFS'; search.setAttribute('aria-label', '搜索知识节点');
  search.addEventListener('input', () => { query = search.value.trim().normalize('NFKC').toLowerCase(); stage = null; selected = null; hovered = null; paint(); });
  const reset = button('显示全图', 'arm-reset-button', () => { query = ''; search.value = ''; stage = null; selected = null; hovered = null; paint(); });
  const listButton = button('列表视图', 'arm-list-button', () => {
    listMode = !listMode; root.dataset.view = listMode ? 'list' : 'graph';
    scroll.hidden = listMode; list.hidden = !listMode;
    listButton.setAttribute('aria-pressed', String(listMode)); listButton.textContent = listMode ? '返回关系图' : '列表视图';
    if (!listMode) scheduleFit();
  }); listButton.setAttribute('aria-pressed', 'false');
  const highlightButton = button('关联高亮：开', 'arm-highlight-button', () => {
    highlight = !highlight; highlightButton.textContent = `关联高亮：${highlight ? '开' : '关'}`; highlightButton.setAttribute('aria-pressed', String(highlight)); paint();
  }); highlightButton.setAttribute('aria-pressed', 'true');
  const fitButton = button('适应窗口', 'arm-fit-button', () => { autoFit = true; resize(); scroll.scrollLeft = 0; });
  const actualButton = button('100%', 'arm-actual-button', () => { autoFit = false; zoom = 1; resize(); });
  const zoomControls = element('div', 'arm-zoom');
  const zoomOut = button('−', 'arm-zoom-out', () => { autoFit = false; zoom = Math.max(.2, Math.round((zoom - .1) * 100) / 100); resize(); }); zoomOut.setAttribute('aria-label', '缩小');
  const zoomIn = button('＋', 'arm-zoom-in', () => { autoFit = false; zoom = Math.min(2, Math.round((zoom + .1) * 100) / 100); resize(); }); zoomIn.setAttribute('aria-label', '放大');
  const zoomValue = element('output', 'arm-zoom-value', '100%'); zoomValue.setAttribute('aria-label', '路线图缩放比例');
  zoomControls.append(zoomOut, zoomValue, zoomIn);
  controlLeft.append(search, reset); controlRight.append(listButton, highlightButton, fitButton, actualButton, zoomControls); controls.append(controlLeft, controlRight); root.append(controls);

  const panel = element('div', 'arm-graph-panel'), captionRow = element('div', 'arm-caption-row'), caption = element('strong', 'arm-caption');
  captionRow.append(caption, element('span', 'arm-legend', '实线：学习联系　虚线：相关基础　双向：对照理解'));
  const scroll = element('div', 'arm-graph-scroll'); scroll.setAttribute('aria-label', '知识关系图');
  const space = element('div', 'arm-canvas-space'), canvas = element('div', 'arm-canvas');
  const svg = svgElement('svg', { class: 'arm-edges', width: String(WIDTH), height: String(HEIGHT), viewBox: `0 0 ${WIDTH} ${HEIGHT}`, 'aria-hidden': 'true' });
  const defs = svgElement('defs', {});
  for (const [name, color] of [['arrow', '#92a4bf'], ['arrow-lit', '#4778be'], ['arrow-compare', '#ad7755']]) {
    const marker = svgElement('marker', { id: `${uid}-${name}`, viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' });
    marker.append(svgElement('path', { d: 'M0 0L10 5L0 10z', fill: color })); defs.append(marker);
  }
  svg.append(defs);
  const bands = data.rows.map((row, index) => {
    const band = element('div', 'arm-band'); band.dataset.stage = String(index);
    band.style.top = `${BAND_STARTS[index]}px`; band.style.height = `${BAND_HEIGHTS[index]}px`;
    band.style.setProperty('--arm-stage', row.color); band.style.setProperty('--arm-stage-soft', row.bg);
    band.append(element('span', 'arm-band-label', `0${index + 1} / ${row.name}`)); canvas.append(band); return band;
  });
  for (const edge of data.edges) {
    const from = graphById.get(edge.from), to = graphById.get(edge.to);
    if (!from || !to) continue;
    const points = route(from, to, nodes);
    const path = svgElement('path', { class: `arm-edge${edge.bidir ? ' arm-compare' : ''}${edge.relation === 'foundation' ? ' arm-foundation' : ''}`, d: points.map((point, index) => `${index ? 'L' : 'M'}${point.join(' ')}`).join(' '), 'data-from': edge.from, 'data-to': edge.to, 'data-points': JSON.stringify(points), 'marker-end': `url(#${uid}-${edge.bidir ? 'arrow-compare' : 'arrow'})` });
    if (edge.bidir) path.setAttribute('marker-start', `url(#${uid}-arrow-compare)`);
    svg.append(path); edgeElements.push({ edge, path });
  }
  canvas.append(svg);
  function nodeCard(node: RoadmapNode, graph: boolean): HTMLButtonElement {
    const card = button('', graph ? `arm-node arm-kind-${node.kind}${node.contextual ? ' arm-contextual' : ''}` : 'arm-list-node', () => open(node.id));
    card.dataset.node = node.id; card.dataset.stage = String(node.row);
    const row = data.rows[node.row];
    card.style.setProperty('--arm-stage', row?.color || '#4778be'); card.style.setProperty('--arm-stage-soft', row?.bg || '#edf4ff');
    card.setAttribute('aria-label', `${row?.name || '专题'}：${node.label}，打开详情`); card.setAttribute('aria-haspopup', 'dialog');
    card.append(element('strong', '', node.label));
    const sub = node.sub || (node.id === 'g' ? '表达与实现' : node.id === 'ds' ? '容器与常用接口' : node.id === 'ssr' ? '状态与转移' : '');
    if (!graph || sub) card.append(element('small', '', graph ? sub : node.detail[0]));
    if (graph && node.contextual) card.append(element('span', 'arm-context-badge', '遇到再学'));
    if (graph) card.append(element('span', 'arm-open-icon', '↗'));
    card.addEventListener('pointerenter', () => { hovered = node.id; paint(); });
    card.addEventListener('pointerleave', () => { hovered = null; paint(); });
    card.addEventListener('focus', () => { hovered = node.id; paint(); });
    card.addEventListener('blur', () => { hovered = null; paint(); });
    const existing = cards.get(node.id) || []; existing.push(card); cards.set(node.id, existing); return card;
  }
  for (const node of nodes) {
    const card = nodeCard(node, true); card.style.left = `${node.x}px`; card.style.top = `${node.y}px`; canvas.append(card);
  }
  space.append(canvas); scroll.append(space);
  const list = element('div', 'arm-list'); list.hidden = true;
  data.rows.forEach((row, index) => {
    const section = element('section', 'arm-list-stage'); section.dataset.stage = String(index); section.style.setProperty('--arm-stage', row.color);
    section.append(element('h3', '', row.name), element('p', '', data.goals[index] || ''));
    const group = element('div', 'arm-list-nodes');
    data.nodes.filter(node => node.row === index).forEach(node => group.append(nodeCard(node, false)));
    section.append(group); list.append(section);
  });
  const empty = element('p', 'arm-empty', '没有找到对应知识，试试其他名称或关键词。'); empty.hidden = true; empty.setAttribute('role', 'status');
  panel.append(captionRow, scroll, list, empty); root.append(panel);
  const insight = element('div', 'arm-insight');
  const insightCopy = element('p', 'arm-insight-copy', '选一个节点，查看它的知识范围与前后联系。');
  const insightOpen = button('查看节点详情', 'arm-insight-open', () => { if (selected) open(selected); }); insightOpen.hidden = true;
  insight.append(insightCopy, insightOpen); root.append(insight);
  for (const entry of data.indexEntries) {
    const index = element('section', 'arm-topic-index'), text = element('div', '');
    text.append(element('strong', '', entry.label), element('p', '', 'CDQ 分治、整体二分、莫队与特殊题型，按需要查阅专项索引。'));
    const action = button('查看专项索引 →', 'arm-index-button', () => open(entry.id)); action.dataset.node = entry.id;
    index.append(text, action); root.append(index);
  }

  const dialog = element('dialog', 'arm-detail-dialog'); dialog.setAttribute('aria-labelledby', `${uid}-detail-title`);
  const dialogHeader = element('div', 'arm-dialog-header'), breadcrumb = element('span', 'arm-breadcrumb');
  const close = button('关闭 ×', 'arm-close-button', () => dialog.close()); close.setAttribute('aria-label', '关闭节点详情');
  dialogHeader.append(breadcrumb, close);
  const detailBody = element('div', 'arm-detail-body'); dialog.append(dialogHeader, detailBody); root.append(dialog);
  dialog.addEventListener('close', () => { if (!destroyed && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });

  function matches(node: RoadmapNode): boolean { return [node.label, node.sub || '', ...node.detail.flat()].join(' ').normalize('NFKC').toLowerCase().includes(query); }
  function paint(): void {
    const active = highlight ? hovered || selected : null;
    const related = active ? new Set([active, ...data.edges.flatMap(edge => edge.from === active ? [edge.to] : edge.to === active ? [edge.from] : [])]) : null;
    let matchCount = 0;
    for (const node of data.nodes) {
      const match = !query || matches(node); if (match) matchCount++;
      for (const card of cards.get(node.id) || []) {
        card.classList.toggle('arm-dim', !match || (stage !== null && node.row !== stage) || (!query && stage === null && !!related && !related.has(node.id)));
        card.classList.toggle('arm-match', !!query && match); card.classList.toggle('arm-selected', node.id === selected);
        card.classList.toggle('arm-related', !!related?.has(node.id)); card.classList.toggle('arm-position', node.id === position);
        card.dataset.focused = String(node.id === position); card.setAttribute('aria-pressed', String(node.id === selected));
      }
    }
    for (const { edge, path } of edgeElements) {
      const from = byId.get(edge.from), to = byId.get(edge.to), lit = !!active && (edge.from === active || edge.to === active);
      path.classList.toggle('arm-lit', lit);
      path.classList.toggle('arm-dim', (!!query && !!from && !!to && !matches(from) && !matches(to)) || (stage !== null && (from?.row !== stage || to?.row !== stage)) || (!query && stage === null && !!related && !lit));
      path.setAttribute('marker-end', `url(#${uid}-${edge.bidir ? 'arrow-compare' : lit ? 'arrow-lit' : 'arrow'})`);
    }
    stageButtons.forEach((card, index) => card.setAttribute('aria-pressed', String(stage === index)));
    const indexMatch = data.indexEntries.some(entry => query && matches(entry));
    empty.hidden = !query || matchCount > 0 || indexMatch;
    root.querySelectorAll<HTMLButtonElement>('.arm-index-button').forEach(card => { const node = byId.get(card.dataset.node || ''); card.classList.toggle('arm-match', !!query && !!node && matches(node)); });
    caption.textContent = query ? `搜索结果 · ${matchCount} 个知识节点${indexMatch ? ' · 含专项索引' : ''}` : stage === null ? `完整框架 · ${data.rows.length} 层 / ${data.nodes.length} 个知识节点` : `${data.rows[stage].name} · ${data.goals[stage] || ''}`;
    const current = selected ? byId.get(selected) : null;
    const bookmark = position ? byId.get(position) : null;
    insightCopy.textContent = current ? `${current.label} · ${current.detail[0]}` : bookmark ? `当前关注：${bookmark.label}。可以随时沿相关基础回补，或选择其他分支。` : '选一个节点，查看它的知识范围与前后联系。';
    insightOpen.hidden = !current;
  }
  const introductions = new Map<string, string>();
  function renderDetail(node: RoadmapNode): void {
    detailBody.replaceChildren();
    const row = data.rows[node.row]; breadcrumb.textContent = `四层大纲 / ${row?.name || '专项索引'} / 目录`;
    const title = element('h2', 'arm-detail-title', node.label); title.id = `${uid}-detail-title`;
    detailBody.append(title);
    const introduction = element('section', 'arm-directory-introduction');
    const heading = element('div', 'arm-directory-heading'); heading.append(element('h3', '', '简介'));
    const markdown = introductions.get(node.id) ?? options.getIntroduction?.(node) ?? roadmapIntroduction(node);
    const body = element('div', 'markdown-body arm-directory-markdown');
    if (options.renderMarkdown) options.renderMarkdown(body, markdown); else body.textContent = markdown;
    introduction.append(heading, body); detailBody.append(introduction);
    if (options.canManage && options.onSaveIntroduction) heading.append(button('编辑简介', 'arm-edit-introduction', () => {
      const form = element('form', 'arm-introduction-form'), input = element('textarea', 'arm-introduction-input');
      input.name = 'introduction'; input.rows = 12; input.value = markdown; input.setAttribute('aria-label', '目录简介（Markdown）');
      const error = element('p', 'arm-focus-error'); error.hidden = true; error.setAttribute('role', 'alert');
      const actions = element('div', 'arm-resource-actions');
      const cancel = button('取消', '', () => renderDetail(node)), save = element('button', 'arm-button', '保存简介'); save.type = 'submit';
      actions.append(cancel, save); form.append(input, error, actions); introduction.replaceChildren(form);
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (save.disabled) return;
        if (!input.value.trim() || input.value.length > 6000) { error.textContent = '简介须为1–6000字。'; error.hidden = false; return; }
        input.disabled = cancel.disabled = save.disabled = true;
        const isCurrentEditor = () => !destroyed && dialog.open && detailNode?.id === node.id && form.isConnected;
        try { await options.onSaveIntroduction!(node.id, input.value); introductions.set(node.id, input.value); if (isCurrentEditor()) renderDetail(node); }
        catch (cause) { if (isCurrentEditor()) { error.textContent = cause instanceof Error ? cause.message : '简介保存失败，请重试。'; error.hidden = false; input.disabled = cancel.disabled = save.disabled = false; } }
      }); input.focus();
    }));
    const choices = element('section', 'arm-leaf-choices'); choices.append(element('h3', '', '知识点'));
    const links = element('div', 'arm-resource-links');
    for (const leaf of options.tree ? roadmapLeaves(options.tree, node) : []) {
      const action = button(leaf.label, 'arm-leaf-link', () => { dialog.close(); options.onOpenLeaf?.(leaf.id); });
      action.dataset.topicId = leaf.id; links.append(action);
    }
    if (links.childElementCount) choices.append(links); else choices.append(element('p', 'arm-fine-print', '暂无可浏览的知识点。'));
    detailBody.append(choices);
    const actions = element('div', 'arm-detail-actions');
    if (options.onOpenResources) actions.append(button('浏览知识点', 'arm-resources-button', () => { dialog.close(); options.onOpenResources?.(node); }));
    if (options.onFocus) { const focus = button(position === node.id ? '取消当前关注' : '设为当前关注', 'arm-focus-button', () => { void saveFocus(node); }); focus.disabled = pending; focus.setAttribute('aria-pressed', String(position === node.id)); actions.append(focus); }
    const error = element('p', 'arm-focus-error'); error.hidden = true; error.setAttribute('role', 'alert'); detailBody.append(actions, error);
  }
  async function saveFocus(node: RoadmapNode): Promise<void> {
    if (pending || destroyed || !options.onFocus) return;
    const before = position, next = position === node.id ? null : node.id;
    pending = true; position = next; paint(); if (detailNode) renderDetail(detailNode);
    try {
      await options.onFocus(next);
      if (!destroyed) options.toast?.(next ? `当前关注：${node.label}` : '已取消当前关注');
    } catch (error: unknown) {
      if (!destroyed) {
        position = before; paint();
        if (detailNode) renderDetail(detailNode);
        const message = error instanceof Error ? error.message : '当前关注保存失败，请重试。';
        const errorNode = detailBody.querySelector<HTMLElement>('.arm-focus-error'); if (errorNode) { errorNode.textContent = message; errorNode.hidden = false; }
        options.toast?.(message);
      }
    } finally {
      pending = false;
      if (!destroyed) { const action = detailBody.querySelector<HTMLButtonElement>('.arm-focus-button'); if (action) action.disabled = !options.onFocus; }
    }
  }
  function open(id: string): boolean {
    const node = byId.get(id); if (!node || destroyed) return false;
    if (!dialog.open) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    selected = id; hovered = null; detailNode = node; paint(); renderDetail(node);
    if (!dialog.open) dialog.showModal();
    detailBody.scrollTop = 0;
    return true;
  }
  function resize(): void {
    if (destroyed) return;
    if (autoFit && scroll.clientWidth > 0) zoom = Math.min(1.5, Math.max(.15, (scroll.clientWidth - 2) / WIDTH));
    canvas.style.transform = `scale(${zoom})`; space.style.width = `${WIDTH * zoom}px`; space.style.height = `${HEIGHT * zoom}px`;
    zoomValue.textContent = `${Math.round(zoom * 100)}%`; root.dataset.zoomMode = autoFit ? 'fit' : 'manual';
    fitButton.setAttribute('aria-pressed', String(autoFit)); actualButton.setAttribute('aria-pressed', String(!autoFit && zoom === 1));
  }
  function scheduleFit(): void {
    if (frame || destroyed) return;
    frame = requestAnimationFrame(() => { frame = 0; if (!listMode) resize(); });
  }
  host.replaceChildren(root); paint(); resize();
  const observer = new ResizeObserver(scheduleFit); observer.observe(scroll);
  return {
    selectGate(id: string): boolean { const node = data.nodes.find(entry => entry.gateIds?.includes(id)); return node ? open(node.id) : false; },
    selectTopic(id: string): boolean {
      const leafId = options.tree ? resolveAlgorithmLeaf(options.tree, id)?.id : undefined;
      const node = [...data.nodes, ...data.indexEntries].find(entry => entry.topicIds?.includes(id) || (leafId && options.tree && roadmapLeaves(options.tree, entry).some(leaf => leaf.id === leafId)));
      return node ? open(node.id) : false;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true; observer.disconnect(); if (frame) cancelAnimationFrame(frame);
      if (dialog.open) dialog.close(); root.remove();
    }
  };
}

export const LearningRoadmap = Object.freeze({ render });
