import { Search } from '../lib/search.js';
/* Search facets, difficulty ranges and the shared filter/editor tag picker. */
type Options = import('../../../types/filters-ui').FiltersUIOptions;
type Controller = import('../../../types/filters-ui').FiltersUIController;
type AppRecord = import('../../../types/app').AppRecord;
type AppTagGroup = import('../../../types/app').AppTagGroup;
type AppQuery = import('../../../types/app').AppQuery;
type AppQueryAll = import('../../../types/app').AppQueryAll;

export function createFilters({ getRecords, getView, getScope, getAccount, getTagCatalog, getBusy, favorite, mastery, isLocal, authorName, render }: Options): Controller {
  const $: AppQuery = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
  const $$: AppQueryAll = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(selector));
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: unknown): HTMLElementTagNameMap[K] { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }
  function append<T extends HTMLElement>(parent: T, ...children: (Node | null | undefined | false)[]): T { children.filter(Boolean).forEach(child => parent.append(child as Node)); return parent; }
  function button(label: string, className: string, action: (event: MouseEvent) => unknown) { const node = element('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
  const stateLabels: Record<string, string> = { unreviewed: '待复习', reviewing: '复习中', mastered: '已掌握' };
  const facets: Record<string, Set<string>> = { platform: new Set(), tags: new Set(), authors: new Set(), native: new Set() };
  const facetNames: Record<string, string> = { platform: '平台', tags: '标签', authors: '作者', native: '难度' };
  const platformNames: Record<string, string> = { CF: 'Codeforces', LG: '洛谷', AT: 'AtCoder', NC: '牛客', LC: 'LeetCode', Oth: '其他平台' };
  function facetValue(record: AppRecord, group: string) { return group === 'platform' ? Search.normalizePlatform(record.platform) : group === 'authors' ? authorName(record.author || (isLocal(record) ? getAccount()?.login || '我（本地）' : '')) : ''; }
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
  function tagGroups(extra: string[] = []) {
    const groups: AppTagGroup[] = (getTagCatalog()?.categories || []).map(c => ({ id: String(c.id), name: String(c.name), tags: (c.tags || []).map(t => String(t.name)) }));
    const known = new Set(groups.flatMap(c => c.tags));
    const historical = [...new Set([...getRecords().flatMap(r => Array.isArray(r.tags) ? r.tags.map(String) : []), ...extra])].filter(t => !known.has(t));
    if (historical.length) groups.push({ id: 'history', name: '历史标签', tags: historical, historical: true });
    return groups;
  }
  function fillTagOptions(container: HTMLElement, selected: Set<string>, query: string, onChange: () => void) {
    container.replaceChildren();
    const counts = new Map<string, number>(); getRecords().forEach(r => new Set(r.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    tagGroups([...selected]).forEach(group => {
      const matching = group.tags.filter(t => `${group.name} ${t}`.toLowerCase().includes(query.toLowerCase())); if (!matching.length) return;
      container.append(element('strong', 'tag-category-heading', group.name));
      matching.forEach(value => { const label = element('label', 'facet-option'); const input = element('input'); input.type = 'checkbox'; input.value = value; input.checked = selected.has(value); input.disabled = getBusy();
        input.addEventListener('change', () => { input.checked ? selected.add(value) : selected.delete(value); $$<HTMLInputElement>('input[type="checkbox"]', container).filter(n => n.value === value).forEach(n => n.checked = input.checked); onChange(); });
        append(label, input, element('span', '', value + (group.historical ? ' · 历史' : '')), element('small', '', counts.get(value) || 0)); container.append(label);
      });
    });
    if (!container.children.length) container.append(element('p', 'facet-help', '没有匹配的标签'));
  }
  let tagPickerContext: { mode: string; original: Set<string>; selected: Set<string> } | null = null;
  function openTagPicker(mode: string) {
    if (getBusy()) return;
    const source = mode === 'filter' ? facets.tags : new Set($('#submit-form')!.elements.tags.value.split(/[,，、]/).map(t => t.trim()).filter(Boolean));
    tagPickerContext = { mode, original: new Set(source), selected: new Set(source) };
    $('#tag-picker-title')!.textContent = mode === 'filter' ? '筛选算法标签' : '选择算法标签';
    $('#tag-picker-hint')!.textContent = mode === 'filter' ? '命中任一已选标签的题目将显示；确定后应用筛选。' : '选择一个或多个标签，点击确定后加入错题。';
    $('#tag-picker-search')!.value = '';
    fillTagOptions($('#tag-picker-dialog-options')!, tagPickerContext.selected, '', () => {});
    $('#tag-picker-dialog')!.showModal(); $('#tag-picker-search')!.focus();
  }
  function closeTagPicker(apply: boolean) {
    if (!tagPickerContext) return;
    const context = tagPickerContext; tagPickerContext = null; $('#tag-picker-dialog')!.close();
    if (!apply) return;
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
      if (getView() === 'public' && record.kind !== (getScope() === 'local' ? 'local' : 'document')) return false;
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
