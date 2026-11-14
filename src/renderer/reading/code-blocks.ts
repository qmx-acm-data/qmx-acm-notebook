import { createNotebookIPC } from '../ipc/boundary.js';
type Options = import('../../../types/code-blocks').CodeBlocksOptions;
type Controller = import('../../../types/code-blocks').CodeBlocksController;
type ActionButton = import('../../../types/code-blocks').CodeBlockActionButton;
type Formatter = import('../../../types/code-blocks').CodeBlockFormatter;

export const CodeBlocks: import('../../../types/code-blocks').CodeBlocksApi = { create };

function create({ toast, errorMessage }: Options): Controller {
  const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(selector));
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function append<T extends HTMLElement>(parent: T, ...children: HTMLElement[]): T {
    children.filter(Boolean).forEach(child => parent.append(child));
    return parent;
  }

  // DOMPurify forbids <button> in Markdown, so these actions are app chrome created
  // after sanitizing. The wrapper keeps the buttons anchored while the pre scrolls.
  const codeLanguageAliases: Record<string, string> = { 'c++': 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', py: 'python', python3: 'python', js: 'javascript', node: 'javascript', nodejs: 'javascript', ts: 'typescript', 'c#': 'csharp', cs: 'csharp', objc: 'objectivec', 'objective-c': 'objectivec', golang: 'go', rs: 'rust', sh: 'bash', shell: 'bash', yml: 'yaml', html: 'markup', xml: 'markup' };
  const formattableLanguages = new Set(['c', 'cpp', 'java', 'javascript', 'typescript', 'csharp', 'objectivec', 'python', 'rust']);
  function normalizeCodeLanguage(language: string): string { const name = String(language || '').toLowerCase(); return codeLanguageAliases[name] || name; }
  function codeLanguage(pre: HTMLElement): string {
    const node = pre.querySelector('code') || pre;
    const match = /\blanguage-([\w#+.-]+)/i.exec(node.className || '');
    return normalizeCodeLanguage(match ? match[1] : '');
  }
  function codeBlockText(pre: HTMLElement): string {
    const code = pre.querySelector('code');
    if (!code) return pre.textContent || '';
    // Prism's line-number plugin leaves helper spans inside <code>; clone and drop
    // them so the clipboard always receives the exact source text.
    const clone = code.cloneNode(true) as HTMLElement;
    $$('.line-numbers-rows, .line-numbers-sizer', clone).forEach(node => node.remove());
    return clone.textContent || '';
  }
  function highlightCodeBlock(code: HTMLElement): void {
    const language = codeLanguage(code.parentElement || code);
    if (language) { Array.from(code.classList).filter(name => /^language-/i.test(name)).forEach(name => code.classList.remove(name)); code.classList.add('language-' + language); }
    try { window.Prism?.highlightElement(code); } catch (_) { /* Keep plain text if Prism fails. */ }
  }
  function announceCodeStatus(pre: HTMLElement, message: string): void { const status = pre.closest('.code-block')?.querySelector('.code-status'); if (status) status.textContent = message; }
  function preserveCodeScroll(pre: HTMLElement, mutate: () => void): void {
    const scroller = pre.closest<HTMLElement>('.detail-panel');
    const outerTop = scroller ? scroller.scrollTop : 0, preTop = pre.scrollTop, preLeft = pre.scrollLeft;
    mutate();
    if (scroller) scroller.scrollTop = Math.min(outerTop, Math.max(0, scroller.scrollHeight - scroller.clientHeight));
    pre.scrollTop = Math.min(preTop, Math.max(0, pre.scrollHeight - pre.clientHeight));
    pre.scrollLeft = preLeft;
  }
  function legacyCopyText(text: string): boolean {
    const area = element('textarea', 'clipboard-helper');
    area.value = text; area.setAttribute('readonly', ''); area.setAttribute('aria-hidden', 'true');
    document.body.append(area);
    let ok = false;
    try { area.focus({ preventScroll: true }); area.select(); ok = document.execCommand('copy'); } catch (_) {}
    area.remove();
    return ok;
  }
  async function copyCodeBlock(pre: HTMLElement, actionButton: ActionButton): Promise<void> {
    const text = codeBlockText(pre);
    if (!text) { toast('代码块为空'); return; }
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch (_) { copied = legacyCopyText(text); }
    clearTimeout(actionButton._codeResetTimer);
    if (copied) {
      actionButton.textContent = '已复制'; actionButton.setAttribute('aria-label', '已复制');
      actionButton.classList.add('is-copied'); actionButton.dataset.state = 'copied'; announceCodeStatus(pre, '已复制');
    } else {
      actionButton.textContent = '失败'; actionButton.setAttribute('aria-label', '复制失败');
      actionButton.dataset.state = 'error'; announceCodeStatus(pre, '复制失败，请手动选择代码复制'); toast('复制失败，请手动复制');
    }
    actionButton._codeResetTimer = window.setTimeout(() => {
      actionButton.textContent = '复制'; actionButton.setAttribute('aria-label', '复制代码');
      actionButton.classList.remove('is-copied'); delete actionButton.dataset.state; announceCodeStatus(pre, '');
    }, 1600);
  }
  async function formatCodeBlock(pre: HTMLElement, actionButton: ActionButton): Promise<void> {
    if (actionButton.disabled) return;
    const code = pre.querySelector('code') || pre;
    const language = codeLanguage(pre), source = codeBlockText(pre);
    if (!formattableLanguages.has(language)) { toast(language ? `暂不支持 ${language} 代码的格式化` : '未能识别代码语言，无法格式化'); return; }
    const format: Formatter | null = typeof window.notebook?.formatCode === 'function'
      ? (text, lang) => createNotebookIPC(window.notebook!).formatCode(text, lang)
      : typeof window.formatCode === 'function' ? (text, lang) => Promise.resolve(window.formatCode!(text, lang)) : null;
    if (!format) { toast('格式化功能尚未启用'); return; }
    actionButton.disabled = true; actionButton.setAttribute('aria-busy', 'true');
    const original = actionButton.textContent; actionButton.textContent = '格式化中…';
    try {
      const result = await format(source, language);
      if (typeof result !== 'string' && result?.error) throw new Error(errorMessage(result.error));
      const formatted = typeof result === 'string' ? result : result?.code;
      if (typeof formatted !== 'string' || !formatted.trim()) {
        toast(language ? `暂不支持 ${language} 代码的格式化` : '未能识别代码语言，无法格式化');
        return;
      }
      if (formatted === source) { toast('代码格式已是最新'); return; }
      preserveCodeScroll(pre, () => { code.textContent = formatted; highlightCodeBlock(code); });
      toast('已格式化代码块'); announceCodeStatus(pre, '已格式化');
    } catch (error) { const message = '格式化失败：' + errorMessage(error); toast(message); announceCodeStatus(pre, message); }
    finally { actionButton.disabled = false; actionButton.removeAttribute('aria-busy'); actionButton.textContent = original; }
  }
  function decorateCodeBlocks(container: ParentNode): void {
    $$('pre', container).forEach(pre => {
      if (pre.closest('.code-block')) return; // idempotent
      const block = element('div', 'code-block');
      pre.replaceWith(block); block.append(pre);
      const actions = element('div', 'code-actions');
      actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', '代码块操作');
      const copy = element('button', 'code-action-button', '复制');
      copy.type = 'button'; copy.dataset.action = 'copy'; copy.title = '复制代码'; copy.setAttribute('aria-label', '复制代码');
      const format = element('button', 'code-action-button', '格式化');
      format.type = 'button'; format.dataset.action = 'format'; format.title = '格式化代码'; format.setAttribute('aria-label', '格式化代码');
      const language = codeLanguage(pre);
      if (!formattableLanguages.has(language)) { format.disabled = true; format.title = language ? `暂不支持 ${language} 代码的格式化` : '未能识别代码语言，无法格式化'; format.setAttribute('aria-label', format.title); }
      const status = element('span', 'code-status'); status.setAttribute('role', 'status');
      append(actions, copy, format, status); block.append(actions);
    });
  }
  function codeBlockClick(event: Event): void {
    if (!(event.target instanceof Element)) return;
    const actionButton = event.target.closest<ActionButton>('.code-action-button');
    if (!actionButton) return;
    const pre = actionButton.closest('.code-block')?.querySelector('pre');
    if (!pre) return;
    if (actionButton.dataset.action === 'copy') void copyCodeBlock(pre, actionButton);
    else if (actionButton.dataset.action === 'format') void formatCodeBlock(pre, actionButton);
  }

  return { highlightCodeBlock, decorateCodeBlocks, codeBlockClick };
}
