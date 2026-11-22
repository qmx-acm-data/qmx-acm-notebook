import { Search } from '../lib/search.js';
import { tagColorClass } from '../lib/tag-color.js';
/* Search facets, difficulty ranges and the shared filter/editor tag picker. */
type Options = import('../../../types/filters-ui').FiltersUIOptions;
type Controller = import('../../../types/filters-ui').FiltersUIController;
type AppRecord = import('../../../types/app').AppRecord;
type AppTagGroup = import('../../../types/app').AppTagGroup;
type AppQuery = import('../../../types/app').AppQuery;
type AppQueryAll = import('../../../types/app').AppQueryAll;
type DailyTagCatalog = import('../../shared/models/daily-problem').DailyTagCatalog;

export function createFilters({ getRecords, getView, getScope, getTagCatalog, getDailyTagCatalog, getBusy, favorite, mastery, isLocal, isOwnSolution, recordAuthorName, render }: Options): Controller {
  const $: AppQuery = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
  const $$: AppQueryAll = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(selector));
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function append<T extends HTMLElement>(parent: T, ...children: (Node | null | undefined | false)[]): T { children.filter(Boolean).forEach(child => parent.append(child as Node)); return parent; }
  function button(label: string, className: string, action: (event: MouseEvent) => unknown) { const node = element('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
  const stateLabels: Record<string, string> = { unreviewed: '待复习', reviewing: '复习中', mastered: '已掌握' };
  const facets: Record<string, Set<string>> = { platform: new Set(), tags: new Set(), authors: new Set(), native: new Set() };
  const facetNames: Record<string, string> = { platform: '平台', tags: '标签', authors: '作者', native: '难度' };
  const platformNames: Record<string, string> = { CF: 'Codeforces', LG: '洛谷', AT: 'AtCoder', NC: '牛客', LC: 'LeetCode', Oth: '其他平台' };
  function facetValue(record: AppRecord, group: string) { return group === 'platform' ? Search.normalizePlatform(record.platform) : group === 'authors' ? recordAuthorName(record) : ''; }
  function fillFacetOptions(container: HTMLElement, group: string, values: unknown[], search = '') {
    container.replaceChildren();
    const counts = new Map<string, number>(); values.forEach(value => counts.set(String(value), (counts.get(String(value)) || 0) + 1));
    const options = [...new Set([...counts.keys(), ...facets[group]])].sort((a,b) => a.localeCompare(b, 'zh-CN'));
    options.filter(value => (group === 'platform' ? platformNames[value] || value : value).toLowerCase().includes(search.toLowerCase())).forEach(value => {
      const label = element('label', 'facet-option'); const input = element('input'); input.type = 'checkbox'; input.value = value; input.checked = facets[group].has(value);
      input.addEventListener('change', () => { input.checked ? facets[group].add(value) : facets[group].delete(value); if (group === 'platform' && facets.platform.size === 1) { const selected = [...facets.platform][0]; setDifficultyPlatform(['CF','LG'].includes(selected) ? selected : 'native'); } updateFacetCounts(); render(); });
      append(label, input, element('span', '', group === 'platform' ? platformNames[value] || value : value), element('small', '', counts.get(value) || 0)); container.append(label);
    });
    if (!container.children.length) container.append(element('p', 'facet-help', '没有匹配的选项'));
  }
  function refreshFilters() {
    const all = getRecords();
    for (const group of ['platform', 'tags', 'authors']) {
      const host = $(group === 'tags' ? '#tag-filter' : group === 'authors' ? '#author-filter' : '#platform-filter')!;
      const values = group === 'tags' ? all.flatMap(r => Array.isArray(r.tags) ? r.tags : []) : all.map(r => facetValue(r, group));
      if (group === 'tags') {
        const trigger = button('', 'facet-trigger', () => openTagPicker('filter'));
        append(trigger, document.createTextNode(facetNames[group] + ' '), element('span', 'facet-chevron', '⌄'));
        trigger.id = 'tag-filter-trigger'; trigger.setAttribute('aria-haspopup', 'dialog'); host.replaceChildren(trigger);
      } else {
        const wasOpen = host.querySelector('details')?.open; const query = host.querySelector<HTMLInputElement>('input[type="search"]')?.value || '';
        const details = element('details'); details.open = !!wasOpen; const summary = element('summary'); append(summary, document.createTextNode(facetNames[group]+' '), element('span', 'facet-count'), element('span', 'facet-chevron', '⌄'));
        const popover = element('div', 'facet-popover'); const search = element('input', 'facet-search'); search.type = 'search'; search.placeholder = `查找${facetNames[group]}`; search.setAttribute('aria-label', `查找${facetNames[group]}`); search.value = query;
        const options = element('div', 'facet-options'); search.addEventListener('input', () => fillFacetOptions(options, group, values, search.value));
        append(popover, search, options, button('清除本组', 'facet-clear', () => { facets[group].clear(); fillFacetOptions(options, group, values, search.value); updateFacetCounts(); render(); })); append(details, summary, popover); host.replaceChildren(details); fillFacetOptions(options, group, values, query);
      }
    }
    const native = all.filter(r => !['CF','LG'].includes(Search.normalizePlatform(r.platform))).map(r => String(r.difficulty || '').trim()).filter(Boolean);
    fillFacetOptions($('#native-difficulty-options')!, 'native', native); updateFacetCounts();
  }
  let acquiredTagCatalog: DailyTagCatalog | null = null;
  const tagKey = (value: string) => value.trim().toLocaleLowerCase();
  function nonAlgorithmTag(value: string) {
    const excluded = window.QMX_TAG_PRESETS?.nonAlgorithmNames;
    return /^洛谷标签#-?\d+$/.test(value) || (Array.isArray(excluded) && excluded.some(name => typeof name === 'string' && tagKey(name) === tagKey(value)));
  }
  const tagSourceIndex = new Map<string, Set<string>>();
  function indexTagSources() {
    tagSourceIndex.clear();
    const add = (name: string, sources: string[]) => { const key = tagKey(name); const values = tagSourceIndex.get(key) || new Set<string>(); sources.forEach(source => values.add(source)); tagSourceIndex.set(key, values); };
    for (const category of window.QMX_TAG_PRESETS?.categories || []) for (const tag of category.tags || []) add(String(tag.name), ['LG']);
    for (const tag of acquiredTagCatalog?.tags || []) add(tag.name, tag.sources);
  }
  indexTagSources();
  function tagSources(value: string): string[] { return [...(tagSourceIndex.get(tagKey(value)) || [])].sort(); }
  function tagGroups(extra: string[] = []) {
    const groups: AppTagGroup[] = [];
    const identities = new Map<AppTagGroup, { ids: Set<string>; names: Set<string> }>();
    const rawTypes = window.QMX_TAG_PRESETS?.tagTypes;
    const tagTypes = rawTypes && typeof rawTypes === 'object' && !Array.isArray(rawTypes) ? rawTypes as Record<string, unknown> : {};
    // A cached GitHub catalog can predate the bundled directory. Always expose
    // offline presets as well as repository additions, without changing records.
    for (const catalog of [window.QMX_TAG_PRESETS, getTagCatalog()]) {
      for (const category of catalog?.categories || []) {
        let group = groups.find(item => item.id === String(category.id) || item.name === String(category.name));
        if (!group) {
          group = { id: String(category.id), name: String(category.name), tags: [] };
          groups.push(group); identities.set(group, { ids: new Set(), names: new Set() });
        }
        const seen = identities.get(group)!;
        for (const tag of category.tags || []) {
          // Explicitly typed external entries must be algorithms. Existing record
          // labels still appear below as history, including manually written tags.
          const id = 'id' in tag ? String(tag.id ?? '') : '';
          const type = tagTypes[id] ?? ('type' in tag ? tag.type : undefined);
          if (type !== undefined && type !== 2) continue;
          const name = String(tag.name).trim(), key = name.toLocaleLowerCase();
          if (!name || (id && seen.ids.has(id)) || seen.names.has(key)) continue;
          if (id) seen.ids.add(id);
          seen.names.add(key); group.tags.push(name);
        }
      }
    }
    const knownKeys = new Set(groups.flatMap(c => c.tags).map(tagKey));
    const acquired = [...new Map((acquiredTagCatalog?.tags || []).filter(tag => typeof tag.name === 'string' && tag.name.trim() && !nonAlgorithmTag(tag.name)).map(tag => [tagKey(tag.name), tag.name.trim()])).values()].filter(name => !knownKeys.has(tagKey(name)));
    if (acquired.length) groups.push({ id: 'acquired-platform-tags', name: '已获取的平台算法标签', tags: acquired });
    const known = new Set(groups.flatMap(c => c.tags).map(tagKey));
    const excludedNames = new Set(Array.isArray(window.QMX_TAG_PRESETS?.nonAlgorithmNames) ? window.QMX_TAG_PRESETS.nonAlgorithmNames as string[] : []);
    const historical = [...new Set([...getRecords().flatMap(r => Array.isArray(r.tags) ? r.tags.map(String) : []), ...extra])].filter(t => !known.has(tagKey(t)) && (tagPickerContext?.mode !== 'daily' || (!excludedNames.has(t.trim()) && !/^洛谷标签#-?\d+$/.test(t))));
    if (historical.length) groups.push({ id: 'history', name: '历史标签', tags: historical, historical: true });
    return groups.filter(group => group.tags.length);
  }
  type TagOption = { label: HTMLLabelElement; input: HTMLInputElement; search: string };
  type TagOptionsView = { selected: Set<string>; onChange: () => void; groups: { heading: HTMLElement; options: TagOption[] }[]; inputs: Map<string, HTMLInputElement[]>; empty: HTMLElement };
  const tagOptionsViews = new WeakMap<HTMLElement, TagOptionsView>();
  function fillTagOptions(container: HTMLElement, selected: Set<string>, query: string, onChange: () => void) {
    let view = tagOptionsViews.get(container);
    // A new selected Set marks a new picker session. Count records and create
    // nodes once; typing and toggling within that session keep the same DOM.
    if (!view || view.selected !== selected) {
      const counts = new Map<string, number>();
      getRecords().forEach(r => new Set(r.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
      const inputs = new Map<string, HTMLInputElement[]>();
      const fragment = document.createDocumentFragment();
      const groups = tagGroups([...selected]).map(group => {
        const heading = element('strong', 'tag-category-heading', group.name); fragment.append(heading);
        const options = group.tags.map(value => {
          const label = element('label', 'facet-option'), input = element('input');
          input.type = 'checkbox'; input.value = value; input.checked = selected.has(value); input.disabled = getBusy();
          const duplicates = inputs.get(value) || []; duplicates.push(input); inputs.set(value, duplicates);
          const sources = tagSources(value);
          const source = element('small', 'tag-option-sources', sources.join(' · ')); source.title = sources.length ? `算法标签来源：${sources.join('、')}` : '已有题解或自定义标签';
          append(label, input, element('span', `tag tag-option-name ${tagColorClass(value)}`, value + (group.historical ? ' · 历史' : '')), source, element('small', 'tag-option-count', counts.get(value) || 0)); fragment.append(label);
          return { label, input, search: `${group.name} ${value} ${sources.join(' ')}`.toLowerCase() };
        });
        return { heading, options };
      });
      const empty = element('p', 'facet-help', '没有匹配的标签'); fragment.append(empty);
      view = { selected, onChange, groups, inputs, empty };
      tagOptionsViews.set(container, view);
      container.onchange = event => {
        const current = tagOptionsViews.get(container), input = event.target;
        if (!current || !(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
        if (getBusy()) { input.checked = current.selected.has(input.value); return; }
        input.checked ? current.selected.add(input.value) : current.selected.delete(input.value);
        current.inputs.get(input.value)?.forEach(node => { node.checked = input.checked; });
        current.onChange();
        renderPickerSelection();
      };
      container.replaceChildren(fragment);
    }
    view.onChange = onChange;
    const search = query.toLowerCase();
    let matches = 0;
    view.groups.forEach(group => {
      let groupMatches = 0;
      group.options.forEach(option => {
        const visible = option.search.includes(search);
        if (option.label.hidden !== !visible) option.label.hidden = !visible;
        if (visible) groupMatches++;
      });
      if (group.heading.hidden !== !groupMatches) group.heading.hidden = !groupMatches;
      matches += groupMatches;
    });
    view.empty.hidden = matches > 0;
  }
  let tagPickerContext: { mode: string; original: Set<string>; selected: Set<string>; onApply?: (tags: Set<string>) => void } | null = null;
  function renderPickerSelection() {
    const context = tagPickerContext;
    if (!context) return;
    let host = document.getElementById('tag-picker-selected');
    if (!host) {
      host = element('section', 'tag-picker-selected'); host.id = 'tag-picker-selected'; host.setAttribute('aria-label', '已选标签');
      $('#tag-picker-dialog')!.insertBefore(host, $('#tag-picker-search')!);
    }
    const heading = element('div', 'tag-picker-selected-heading');
    const count = element('span', '', `已选 ${context.selected.size} 个标签`); count.setAttribute('aria-live', 'polite');
    const clear = button('清空已选', 'button subtle tag-picker-clear', () => {
      if (getBusy() || tagPickerContext !== context) return;
      context.selected.clear();
      tagOptionsViews.get($('#tag-picker-dialog-options')!)?.inputs.forEach(inputs => inputs.forEach(input => { input.checked = false; }));
      renderPickerSelection();
    }); clear.disabled = getBusy() || context.selected.size === 0;
    append(heading, count, clear);
    const chips = element('div', 'tag-picker-selected-chips');
    for (const tag of context.selected) {
      const chip = button(`${tag} ×`, `tag ${tagColorClass(tag)} tag-picker-selected-chip`, () => {
        if (getBusy() || tagPickerContext !== context) return;
        context.selected.delete(tag);
        tagOptionsViews.get($('#tag-picker-dialog-options')!)?.inputs.get(tag)?.forEach(input => { input.checked = false; });
        renderPickerSelection();
      });
      chip.setAttribute('aria-label', `移除标签 ${tag}`); chip.disabled = getBusy(); chips.append(chip);
    }
    if (!context.selected.size) chips.append(element('span', 'tag-picker-selection-empty', '尚未选择标签'));
    host.replaceChildren(heading, chips);
  }
  function coverageElement(): HTMLElement {
    let coverage = document.getElementById('daily-tag-coverage');
    if (!coverage) { coverage = element('div', 'daily-tag-coverage'); coverage.id = 'daily-tag-coverage'; coverage.setAttribute('role', 'status'); $('#tag-picker-dialog')!.insertBefore(coverage, $('#tag-picker-dialog-options')!); }
    return coverage;
  }
  function showTagCoverage(loading = false, failed = false) {
    const coverage = coverageElement(); coverage.replaceChildren();
    coverage.hidden = !getDailyTagCatalog;
    if (!getDailyTagCatalog) return;
    if (acquiredTagCatalog) {
      const summary = element('div', 'daily-tag-coverage-platforms');
      for (const [platform, info] of Object.entries(acquiredTagCatalog.platforms)) {
        const label = info.tagged === 0 ? `${platform}：${info.count} 题，未提供标签` : `${platform}：${info.tagged}/${info.count} 题有标签，${info.tagCount} 标签`;
        const entry = element('span', '', label); entry.dataset.platform = platform; summary.append(entry);
      }
      coverage.append(summary);
      coverage.append(element('small', '', `索引 ${acquiredTagCatalog.total} 题${acquiredTagCatalog.builtAt ? ` · 更新于 ${acquiredTagCatalog.builtAt}` : ' · 尚无更新时间'}`));
    }
    if (loading) coverage.append(element('small', '', '正在读取本地索引标签…'));
    else if (failed) coverage.append(element('small', '', '暂时无法读取索引标签，仍可使用离线算法目录。'));
    else if (!acquiredTagCatalog || acquiredTagCatalog.total === 0) coverage.append(element('small', '', '尚无本地索引题目；离线算法目录仍可选择。'));
  }
  function openTagPicker(mode: string, selection?: { selected: Set<string>; onApply(tags: Set<string>): void }) {
    if (getBusy()) return;
    const source = selection?.selected ?? (mode === 'filter' ? facets.tags : new Set($('#submit-form')!.elements.tags.value.split(/[,，、]/).map(t => t.trim()).filter(Boolean)));
    tagPickerContext = { mode, original: new Set(source), selected: new Set(source), onApply: selection?.onApply };
    $('#tag-picker-title')!.textContent = mode === 'filter' ? '筛选算法标签' : mode === 'daily' ? '选择每日一题算法标签' : '选择算法标签';
    $('#tag-picker-hint')!.textContent = mode === 'daily' ? '选择每日一题的算法标签。' : mode === 'filter' ? '命中任一已选标签的题目将显示；确定后应用筛选。' : '选择一个或多个标签，点击确定后加入错题。';
    $('#tag-picker-search')!.value = '';
    fillTagOptions($('#tag-picker-dialog-options')!, tagPickerContext.selected, '', () => {});
    renderPickerSelection();
    document.body.classList.add('tag-picker-open');
    showTagCoverage(Boolean(getDailyTagCatalog));
    $('#tag-picker-dialog')!.showModal(); $('#tag-picker-search')!.focus();
    if (getDailyTagCatalog) {
      const context = tagPickerContext;
      void Promise.resolve().then(() => getDailyTagCatalog()).then(catalog => {
        if (tagPickerContext !== context || !$('#tag-picker-dialog')!.open) return;
        acquiredTagCatalog = catalog; indexTagSources();
        const container = $('#tag-picker-dialog-options')!, scroll = container.scrollTop, search = $('#tag-picker-search')!.value;
        const focused = document.activeElement instanceof HTMLInputElement && container.contains(document.activeElement) ? document.activeElement.value : null;
        tagOptionsViews.delete(container);
        fillTagOptions(container, context.selected, search, () => {});
        container.scrollTop = scroll;
        if (focused !== null) Array.from(container.querySelectorAll<HTMLInputElement>('input')).find(input => input.value === focused)?.focus({ preventScroll: true });
        showTagCoverage();
      }, () => { if (tagPickerContext === context && $('#tag-picker-dialog')!.open) showTagCoverage(false, true); });
    }
  }
  function closeTagPicker(apply: boolean) {
    if (!tagPickerContext) return;
    const context = tagPickerContext; tagPickerContext = null; $('#tag-picker-dialog')!.close(); document.body.classList.remove('tag-picker-open');
    if (!apply) return;
    if (context.onApply) { context.onApply(context.selected); return; }
    if (context.mode === 'filter') {
      facets.tags.clear(); context.selected.forEach(tag => facets.tags.add(tag)); refreshFilters(); render();
    } else {
      const field = $('#submit-form')!.elements.tags; field.value = [...context.selected].join(', '); renderEditorTags(); field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function renderEditorTags() {
    const field = $('#submit-form')!.elements.tags;
    const selected = new Set(field.value.split(/[,，、]/).map(t => t.trim()).filter(Boolean));
    const host = $('#record-tag-selected')!; host.replaceChildren();
    selected.forEach(t => host.append(button(t + ' ×', 'filter-chip', () => { if(getBusy())return; selected.delete(t); field.value = [...selected].join(', '); renderEditorTags(); field.dispatchEvent(new Event('input', { bubbles: true })); })));
    $('#record-tag-open')!.textContent = selected.size ? `选择标签…（已选 ${selected.size}）` : '选择标签…';
  }
  function ranges() { return ['rating-min','rating-max','luogu-min','luogu-max'].map(id => { const v=$<HTMLInputElement>('#'+id)!.value; return v === '' ? null : Number(v); }); }
  function updateFacetCounts() {
    ['rating-min','rating-max'].forEach(id => colorRatingInput($<HTMLInputElement>('#'+id)!));
    for (const group of ['platform','tags','authors']) { const count = facets[group].size; const node = $(`[data-facet="${group}"] .facet-count`)!; if(node) node.textContent = (count || '') as string; }
    const range = ranges(); const count = range.filter(v=>v!==null).length + facets.native.size; $('#difficulty-count')!.textContent = count ? '已选' : '';
    const chips=$('#active-filters')!; chips.replaceChildren();
    for(const group of Object.keys(facets)) for(const value of facets[group]) chips.append(button(`${facetNames[group]} · ${group === 'platform' ? platformNames[value] || value : value} ×`, 'filter-chip', () => { facets[group].delete(value); refreshFilters(); render(); }));
    if(range.some(v=>v!==null)) chips.append(button('难度区间 ×','filter-chip',()=>{clearDifficulty();render();}));
    chips.hidden=!chips.children.length;
    $('#range-error')!.hidden = !((range[0]!==null && range[1]!==null && range[0]>range[1]) || (range[2]!==null && range[3]!==null && range[2]>range[3]));
  }
  function setDifficultyPlatform(platform: string) {
    const select = $('#difficulty-platform')!;
    if (select.value !== platform) {
      select.value = platform;
      ['rating-min','rating-max','luogu-min','luogu-max'].forEach(id => { $<HTMLInputElement>('#'+id)!.value = ''; });
      facets.native.clear();
    }
    for (const [code,id] of [['CF','cf-difficulty-fields'],['LG','lg-difficulty-fields'],['native','native-difficulty-fields']]) $<HTMLInputElement>('#'+id)!.hidden = code !== platform;
    ['luogu-min','luogu-max'].forEach(id => colorLuoguSelection($<HTMLSelectElement>('#'+id)!));
    ['rating-min','rating-max'].forEach(id => colorRatingInput($<HTMLInputElement>('#'+id)!));
  }
  function clearDifficulty() { ['rating-min','rating-max','luogu-min','luogu-max'].forEach(id=>$<HTMLInputElement>('#'+id)!.value=''); facets.native.clear(); ['luogu-min','luogu-max'].forEach(id=>colorLuoguSelection($<HTMLSelectElement>('#'+id)!)); refreshFilters(); }
  function filteredRecords() {
    const search = $('#search-input')!.value.trim(); const status = $('#state-filter')!.value;
    const [min,max,lgMin,lgMax] = ranges();
    const scores = new Map<AppRecord, number>();
    const difficultyActive = [min,max,lgMin,lgMax].some(v=>v!==null) || facets.native.size>0;
    return getRecords().filter(record => {
      if (getView() === 'public' && (getScope() === 'local' ? !isOwnSolution(record) : record.kind !== 'document')) return false;
      if (getView() === 'favorites' && !favorite(record)) return false;
      if (facets.platform.size && !facets.platform.has(facetValue(record,'platform'))) return false;
      if (facets.tags.size && !(record.tags || []).some(tag=>facets.tags.has(String(tag)))) return false;
      if (facets.authors.size && !facets.authors.has(facetValue(record,'authors'))) return false;
      if (difficultyActive) {
        const code=Search.normalizePlatform(record.platform), info=Search.difficulty(record);
        const cf=code==='CF' && (min!==null || max!==null) && info.level!==null && (min===null || info.level>=min) && (max===null || info.level<=max);
        const lgInfo = code === 'LG' ? info : Search.difficulty({ platform:'LG', difficulty:record.luoguDifficulty });
        const lg=(lgMin!==null || lgMax!==null) && lgInfo.level!==null && (lgMin===null || lgInfo.level>=lgMin) && (lgMax===null || lgInfo.level<=lgMax);
        const native=!['CF','LG'].includes(code) && facets.native.has(String(record.difficulty || '').trim());
        if(!cf && !lg && !native) return false;
      }
      if (status === 'local' && !isLocal(record) || status === 'shared' && isLocal(record)) return false;
      if (stateLabels[status] && mastery(record) !== status) return false;
      const score=Search.match(record,search); scores.set(record,score); return score>0;
    }).sort((a, b) => Search.tagHits(b, facets.tags) - Search.tagHits(a, facets.tags) || (search ? scores.get(b)!-scores.get(a)! : 0) || (new Date(b.updatedAt as string).getTime() || 0) - (new Date(a.updatedAt as string).getTime() || 0));
  }
  function clearFilters() { $('#search-input')!.value = ''; $('#state-filter')!.value=''; Object.values(facets).forEach(set=>set.clear()); clearDifficulty(); render(); }
  const luoguLevels=['入门','普及-','普及','普及+/提高-','提高','提高+/省选-','省选/NOI-','NOI/NOI+/CTS'];
  const luoguTones=['red','orange','yellow','green','cyan','blue','purple','black'];
  function colorRatingInput(input: HTMLInputElement) {
    const valid = input.value !== '' && !input.validity.badInput && Number.isInteger(input.valueAsNumber) && input.valueAsNumber >= 0 && input.valueAsNumber <= 10000;
    const info = valid ? Search.difficulty({ platform:'CF', rating:input.valueAsNumber }) : null;
    input.className = `rating-range${info ? ` tone-${info.tone}` : ''}`;
    input.style.caretColor = info ? 'var(--difficulty-color)' : '';
  }
  function colorLuoguSelection(select: HTMLSelectElement) { select.className = select.value ? `luogu-range tone-${luoguTones[Number(select.value)-1]}` : 'luogu-range'; }

  return { facets, facetNames, platformNames, facetValue, fillFacetOptions, refreshFilters, tagGroups, fillTagOptions, get tagPickerContext() { return tagPickerContext; }, openTagPicker, closeTagPicker, renderEditorTags, ranges, updateFacetCounts, setDifficultyPlatform, clearDifficulty, filteredRecords, clearFilters, luoguLevels, luoguTones, colorRatingInput, colorLuoguSelection };
}
