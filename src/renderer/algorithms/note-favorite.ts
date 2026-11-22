import type { AlgorithmBrowserNote } from '../../../types/algorithm-browser.js';

export interface AlgorithmNoteFavoriteOptions {
  note: AlgorithmBrowserNote;
  isFavorite?: (note: AlgorithmBrowserNote) => boolean;
  onToggleFavorite?: (note: AlgorithmBrowserNote) => Promise<void>;
  onError?: (error: unknown) => void;
}

/** Keep the active reader in place while the app persists a scoped favorite. */
export function noteFavoriteControl(options: AlgorithmNoteFavoriteOptions): HTMLElement | null {
  if (!options.isFavorite || !options.onToggleFavorite) return null;
  const control = document.createElement('span'); control.className = 'alg-note-favorite-control';
  const button = document.createElement('button'); button.type = 'button'; button.className = 'alg-button alg-note-favorite';
  const error = document.createElement('span'); error.className = 'alg-inline-error'; error.hidden = true; error.setAttribute('role', 'alert');
  function update(): void {
    const selected = options.isFavorite!(options.note);
    button.textContent = selected ? '★ 已收藏' : '☆ 收藏';
    button.setAttribute('aria-pressed', String(selected));
  }
  button.addEventListener('click', () => { void (async () => {
    if (button.disabled) return;
    button.disabled = true; error.hidden = true;
    try { await options.onToggleFavorite!(options.note); update(); }
    catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : '收藏保存失败，请重试'; error.hidden = false;
      options.onError?.(cause);
    } finally { button.disabled = false; }
  })(); });
  update(); control.append(button, error); return control;
}
