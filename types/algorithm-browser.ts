import type { AlgorithmDirectoryNode } from '../src/shared/models/algorithm-directory';

/** Legacy note values are displayed/coerced by the browser, without extra validation. */
export interface AlgorithmBrowserNote {
  path?: unknown;
  id?: unknown;
  clientId?: unknown;
  nodeId?: unknown;
  title?: unknown;
  authorId?: unknown;
  author?: unknown;
  noteScope?: unknown;
  featured?: unknown;
  tags?: unknown;
  body?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export type AlgorithmBrowserScope = 'public' | 'personal';

export interface AlgorithmBrowserSnapshot {
  search: string;
  level: string;
  attribute: string;
  draftSearch: string;
  draftLevel: string;
  selectedNode: string | null;
  expanded: string[];
  scope: AlgorithmBrowserScope;
}

export interface AlgorithmBrowserOptions {
  host: HTMLElement;
  tree: AlgorithmDirectoryNode;
  notes?: unknown;
  scope?: string;
  account?: { id?: unknown } | null;
  canUpload?: unknown;
  canManage?: unknown;
  onScopeChange?: (scope: AlgorithmBrowserScope) => void;
  onSelect?: (id: string | null) => void;
  onUpload?: (id: string | null) => void;
  onAddTopic?: (id: string) => void;
  onLearningPath?: (id: string) => void;
  authorName?: (author: unknown) => unknown;
  formatDate?: (value: unknown) => unknown;
  renderMarkdown?: (host: HTMLElement, markdown: string) => void;
}

export interface AlgorithmBrowserController {
  selectNode(id: string): void;
  getState(): AlgorithmBrowserSnapshot;
  openNote(note: AlgorithmBrowserNote, options?: { fullscreen?: boolean }): void;
  destroy(): void;
}

export interface AlgorithmBrowserApi {
  render(options: AlgorithmBrowserOptions): AlgorithmBrowserController;
}
