import type { ProblemAIStatus, ProblemEnrichmentView, ProblemSupplementFields, SaveProblemSupplementInput } from '../../shared/models/problem-enrichment';

import { luoguDifficultyLabel, luoguDifficultyRank, luoguNativeDifficultyLabels } from '../../shared/luogu-difficulty.js';
const luoguLevels = Object.values(luoguNativeDifficultyLabels);
function luoguOptionValue(value: string): string {
  const rank = luoguDifficultyRank(value);
  return rank === null ? '' : luoguNativeDifficultyLabels[rank];
}
let activeDialog: HTMLDialogElement | null = null;
function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag); element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function button(label: string, className: string, action: () => unknown) {
  const element = node('button', `button ${className}`, label); element.type = 'button'; element.addEventListener('click', action); return element;
}
function field(label: string, control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, hint?: string) {
  const wrapper = node('label', 'enrichment-field'); wrapper.append(node('span', '', label), control);
  if (hint) wrapper.append(node('small', '', hint));
  return wrapper;
}

/** Open one review dialog. Generation and approval are separate user actions. */
export function openProblemEnrichment(url: string, onApplied: () => void): void {
  if (activeDialog) { activeDialog.close(); activeDialog.remove(); }
  const bridge = window.notebook;
  const previousFocus = document.activeElement;
  const dialog = node('dialog', 'problem-enrichment-dialog'); activeDialog = dialog;
  dialog.setAttribute('aria-labelledby', 'problem-enrichment-title');
  const header = node('header', 'enrichment-header');
  const title = node('h2', '', '补充题目信息'); title.id = 'problem-enrichment-title';
  const close = button('关闭', 'subtle', () => dialog.close());
  header.append(title, close);
  const status = node('p', 'enrichment-status', '正在读取题目信息…'); status.setAttribute('role', 'status');
  const error = node('p', 'enrichment-error'); error.hidden = true; error.setAttribute('role', 'alert');
  const content = node('div', 'enrichment-content');
  dialog.append(header, status, error, content); document.body.append(dialog); dialog.showModal();
  dialog.addEventListener('close', () => {
    key.value = ''; statement.value = ''; dialog.remove();
    if (activeDialog === dialog) activeDialog = null;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });

  let view: ProblemEnrichmentView | null = null;
  let aiStatus: ProblemAIStatus | null = null;
  let busy = false;
  const controls: (HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[] = [];
  const tags = node('input', 'enrichment-tags'); tags.type = 'text'; tags.maxLength = 3030; tags.placeholder = '例如：动态规划, 二分';
  const cf = node('input', 'enrichment-cf'); cf.type = 'number'; cf.min = '800'; cf.max = '3500'; cf.step = '1'; cf.placeholder = '800–3500';
  const lg = node('select', 'enrichment-luogu');
  for (const value of ['', ...luoguLevels]) { const option = node('option', '', value ? luoguDifficultyLabel(value) : '不补充洛谷参考难度'); option.value = value; lg.append(option); }
  const reason = node('textarea', 'enrichment-reason'); reason.rows = 3; reason.maxLength = 4000; reason.required = true;
  const endpoint = node('input', 'enrichment-endpoint'); endpoint.type = 'url'; endpoint.placeholder = 'https://api.example.com/v1/chat/completions'; endpoint.maxLength = 2048;
  const model = node('input', 'enrichment-model'); model.type = 'text'; model.maxLength = 200;
  const key = node('input', 'enrichment-key'); key.type = 'password'; key.autocomplete = 'new-password'; key.maxLength = 8192;
  const statement = node('textarea', 'enrichment-statement'); statement.rows = 6; statement.minLength = 20; statement.maxLength = 100000; statement.required = true; statement.placeholder = '粘贴公开题面的描述、输入输出和约束，至少 20 个字符。请先检查发送内容。';
  const config = node('details', 'enrichment-ai-config');
  const configSummary = node('summary', '', '配置 AI 接口'); config.append(configSummary);
  const configStatus = node('p', 'enrichment-hint', '正在检查 AI 配置…');
  const saveConfig = button('保存 AI 配置', 'secondary enrichment-config-save', () => void run(async () => {
    if (!bridge) return;
    if (!endpoint.value.trim() || !model.value.trim()) throw new Error('请填写接口地址和模型名称');
    try {
      const input = { endpoint: endpoint.value.trim(), model: model.value.trim(), ...(key.value.trim() ? { apiKey: key.value } : {}) };
      aiStatus = await bridge.saveProblemAIConfig(input); renderAIStatus(); status.textContent = 'AI 配置已保存';
    } finally { key.value = ''; }
  }));
  const clearKey = button('清除 AI 配置和密钥', 'subtle enrichment-config-clear', () => void run(async () => {
    if (!bridge) return;
    aiStatus = await bridge.clearProblemAIConfig(); key.value = ''; renderAIStatus(); status.textContent = 'AI 配置和密钥已清除';
  }));
  const configActions = node('div', 'enrichment-actions'); configActions.append(saveConfig, clearKey);
  config.append(configStatus, field('OpenAI 兼容接口地址', endpoint, '填写完整的 chat/completions 地址。'), field('模型名称', model), field('API 密钥', key, '已配置时留空保留原密钥；更换接口需重新填写。密钥不会回显。'), configActions);
  const official = node('section', 'enrichment-official'); official.setAttribute('aria-label', '官方信息');
  const current = node('section', 'enrichment-current');
  const manual = node('section', 'enrichment-manual');
  const manualFields = node('div', 'enrichment-fields');
  const tagHint = node('p', 'enrichment-hint');
  const difficultyHint = node('p', 'enrichment-hint');
  manualFields.append(field('补充算法标签（逗号分隔）', tags), tagHint, field('CF 参考评分', cf), field('洛谷参考难度', lg), difficultyHint, field('补充理由', reason, '说明标签或参考难度的依据；所有补充均保留来源标记。'));
  const save = button('保存手动补充', 'primary enrichment-save', () => void run(async () => {
    if (!bridge || !view) return;
    const fields: ProblemSupplementFields = { reason: reason.value.trim() };
    if (view.canSupplementTags) fields.tags = [...new Set(tags.value.split(/[,，]/).map(value => value.trim()).filter(Boolean))];
    if (view.canSupplementDifficulty) {
      if (cf.value.trim()) {
        const rating = Number(cf.value);
        if (!Number.isInteger(rating) || rating < 800 || rating > 3500) throw new Error('CF 参考评分必须为 800–3500 的整数');
        fields.cfRating = rating;
      }
      if (lg.value) fields.luoguDifficulty = lg.value;
    }
    if (!fields.reason) throw new Error('请填写补充理由');
    if (!fields.tags?.length && fields.cfRating == null && (!fields.luoguDifficulty || fields.luoguDifficulty === '暂无评定')) throw new Error('请至少补充一项缺失的算法标签或难度');
    view = await bridge.saveProblemEnrichment({ ...fields, url: view.url, expectedRevision: view.revision });
    renderView(); status.textContent = '手动补充已保存'; onApplied();
  }));
  const remove = button('删除补充，恢复官方信息', 'subtle enrichment-remove', () => void run(async () => {
    if (!bridge || !view) return;
    view = await bridge.removeProblemEnrichment({ url: view.url, expectedRevision: view.revision }); renderView(); status.textContent = '补充已删除，官方信息保持原样'; onApplied();
  }));
  const manualActions = node('div', 'enrichment-actions'); manualActions.append(save, remove);
  manual.append(node('h3', '', '手动补充'), manualFields, manualActions);
  const ai = node('section', 'enrichment-ai'); ai.append(node('h3', '', 'AI 建议'), config);
  const generate = button('生成 AI 待审核建议', 'secondary enrichment-generate', () => void run(async () => {
    if (!bridge || !view) return;
    if (!aiStatus?.configured) { config.open = true; throw new Error('请先配置 AI 接口和模型'); }
    if (statement.value.trim().length < 20) { statement.focus(); throw new Error('请粘贴至少 20 个字符的公开题面，包含描述和约束，避免只凭标题推测'); }
    status.textContent = '正在生成建议，请等待审核…';
    view = await bridge.suggestProblemEnrichment({ url: view.url, statementText: statement.value.trim() }); renderView();
    status.textContent = '建议已生成，审核后点击“采用建议”才会保存';
  }));
  const pending = node('section', 'enrichment-pending'); pending.setAttribute('aria-label', 'AI 待审核建议');
  const approve = button('采用建议', 'primary enrichment-approve', () => void run(async () => {
    if (!bridge || !view?.suggestion) return;
    const suggestion = view.suggestion;
    // Preserve presence and exact values: the service checks them against the pending suggestion.
    const input: SaveProblemSupplementInput = { url: view.url, expectedRevision: view.revision, suggestionId: suggestion.id, reason: suggestion.reason };
    if (suggestion.tags !== undefined) input.tags = [...suggestion.tags];
    if (suggestion.cfRating !== undefined) input.cfRating = suggestion.cfRating;
    if (suggestion.luoguDifficulty !== undefined) input.luoguDifficulty = suggestion.luoguDifficulty;
    view = await bridge.saveProblemEnrichment(input); renderView(); status.textContent = 'AI 建议已审核采用'; onApplied();
  }));
  ai.append(field('将向你配置的 AI 接口发送以下公开题面文本', statement, '仅点击“生成”时发送题目标题、链接、平台与此处文本。至少 20 个字符，请勿填写私人信息。'), generate, pending);
  content.append(official, current, manual, ai);
  controls.push(tags, cf, lg, reason, endpoint, model, key, statement, saveConfig, clearKey, save, remove, generate, approve);

  function renderAIStatus() {
    if (aiStatus) {
      endpoint.value = aiStatus.endpoint ?? ''; model.value = aiStatus.model ?? '';
      configStatus.textContent = aiStatus.configured ? `AI 接口已配置 · 模型 ${aiStatus.model ?? ''}；密钥已保存，不会回显。` : '尚未配置 AI 接口。展开此处填写接口、模型和密钥后，即可手动生成建议。';
      configSummary.textContent = aiStatus.configured ? '管理 AI 接口配置' : '配置 AI 接口（尚未配置）';
      config.open = !aiStatus.configured;
    }
    syncDisabled();
  }
  function describe(fields: ProblemSupplementFields): HTMLElement {
    const detail = node('div', 'enrichment-values');
    if (fields.tags !== undefined) detail.append(node('p', '', `算法标签：${fields.tags.join('、') || '未补充'}`));
    if (fields.cfRating !== undefined) detail.append(node('p', '', `CF 参考评分：${fields.cfRating ?? '未补充'}`));
    if (fields.luoguDifficulty !== undefined) detail.append(node('p', '', `洛谷参考难度：${luoguDifficultyLabel(fields.luoguDifficulty)}`));
    detail.append(node('p', 'enrichment-reason-copy', `理由：${fields.reason}`)); return detail;
  }
  function renderView() {
    if (!view) return;
    official.replaceChildren(node('h3', '', view.title), node('p', 'enrichment-hint', `${view.platform} · ${view.url}`), node('p', '', `官方算法标签：${view.officialTags.join('、') || '未提供'}`), node('p', '', `官方难度：${view.officialDifficulty == null ? '未提供' : view.platform === 'LG' ? luoguDifficultyLabel(view.officialDifficulty) : view.officialDifficulty}`));
    current.replaceChildren();
    if (view.supplement) current.append(node('span', 'enrichment-badge', view.supplement.source === 'ai' ? 'AI 补充 · 已审核' : '手动补充'), describe(view.supplement));
    else current.append(node('p', 'enrichment-hint', '当前没有补充信息。只允许补充官方缺失的字段。'));
    tags.value = view.canSupplementTags ? (view.supplement?.tags ?? []).join(', ') : view.officialTags.join(', ');
    cf.value = view.canSupplementDifficulty && view.supplement?.cfRating != null ? String(view.supplement.cfRating) : '';
    lg.value = view.canSupplementDifficulty ? luoguOptionValue(view.supplement?.luoguDifficulty ?? '') : '';
    reason.value = view.supplement?.reason ?? '';
    tagHint.textContent = view.canSupplementTags ? '官方未提供算法标签，可以补充。' : '官方已有算法标签，不能补充或覆盖。';
    difficultyHint.textContent = view.canSupplementDifficulty ? '官方未提供难度，可以补充 CF 和洛谷参考难度。参考值不是官方评分。' : `官方已有难度（${view.officialDifficulty}），不能补充或覆盖参考难度。`;
    pending.replaceChildren(); pending.hidden = !view.suggestion;
    if (view.suggestion) pending.append(node('span', 'enrichment-badge enrichment-pending-badge', 'AI 待审核'), node('p', 'enrichment-hint', `模型：${view.suggestion.model}。请核对字段和理由；采用前不会影响当前题目。`), describe(view.suggestion), approve);
    syncDisabled();
  }
  function syncDisabled() {
    dialog.setAttribute('aria-busy', String(busy));
    for (const control of controls) control.disabled = busy || !bridge || !view;
    if (busy || !bridge || !view) return;
    tags.disabled = !view.canSupplementTags;
    cf.disabled = lg.disabled = !view.canSupplementDifficulty;
    save.disabled = reason.disabled = !view.canSupplementTags && !view.canSupplementDifficulty;
    remove.disabled = !view.supplement;
    generate.disabled = !aiStatus?.configured || (!view.canSupplementTags && !view.canSupplementDifficulty);
    clearKey.disabled = aiStatus?.configured === false;
    approve.disabled = !view.suggestion || Boolean(view.suggestion.tags?.length && !view.canSupplementTags) || Boolean((view.suggestion.cfRating != null || (view.suggestion.luoguDifficulty && view.suggestion.luoguDifficulty !== '暂无评定')) && !view.canSupplementDifficulty);
    dialog.setAttribute('aria-busy', 'false');
  }
  async function run(action: () => Promise<void>) {
    if (busy || !dialog.isConnected) return;
    busy = true; error.hidden = true; dialog.setAttribute('aria-busy', 'true'); syncDisabled();
    try { await action(); }
    catch (failure: unknown) { if (dialog.isConnected) { error.textContent = failure instanceof Error ? failure.message : '操作失败，请重试'; error.hidden = false; status.textContent = '操作未完成'; } }
    finally { busy = false; syncDisabled(); }
  }
  void run(async () => {
    if (!bridge) throw new Error('题目补充需要在桌面应用中使用');
    view = await bridge.getProblemEnrichment(url); renderView(); status.textContent = '已读取官方信息与当前补充';
    try { aiStatus = await bridge.getProblemAIStatus(); renderAIStatus(); }
    catch { config.open = true; configStatus.textContent = '无法读取 AI 配置，请重新保存接口、模型和密钥后重试。'; }
  });
}

// Build-only adapter export for isolated browser tests; the app imports the function directly.
export const ProblemEnrichment = { open: openProblemEnrichment };
