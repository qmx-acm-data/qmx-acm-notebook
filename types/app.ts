/** Type-only access views for the legacy app. Assertions describe existing reads;
 * cached JSON and IPC values are not validated or normalized by these types. */
export interface AppRecord extends Record<string, unknown> {
  id?: unknown; number?: number; kind?: string; clientId?: unknown; ownerId?: unknown;
  title?: string; pid?: string; platform?: string; rating?: number | null;
  difficulty?: string; luoguDifficulty?: string; tags?: string[]; author?: unknown;
  authorId?: unknown; body?: unknown; url?: string; problemUrl?: string;
  updatedAt?: string; comments?: number | AppComment[]; state?: string;
  repo?: string; sourceKey?: string; serverUrl?: string; path?: string; sha?: string;
  proposalUrl?: string; sourceProblemId?: string; sourceProblemRepo?: string;
  nodeId?: string; featured?: unknown;
}
export interface AppComment { author?: unknown; user?: unknown; body?: unknown }
export interface AppRepository { id: string; name?: string; repo: string; serverUrl?: string }
export interface AppSettings extends Record<string, unknown> {
  repo?: string; serverUrl?: string; theme?: string; displayName?: string; clientId?: string;
  codeFontSize?: unknown; codeLineNumbers?: unknown; autoSync?: unknown;
  repositories?: AppRepository[]; activeRepoId?: string;
}
export interface AppAuthor { name?: string; login?: string }
export interface AppAccount extends AppAuthor { id?: unknown; username?: string; avatarData?: string }
export interface AppDraft extends Record<string, unknown> {
  source?: string; ownerId?: unknown; clientId?: unknown;
  base?: { path?: string; repo?: string; sha?: string }; data?: Record<string, unknown>;
}
export interface AppLocal {
  records: AppRecord[]; favorites: unknown[]; mastery: Record<string, string>;
  draft: Record<string, AppDraft>; learningPaths?: Record<string, import('./learning-path').LearningPathProgress>;
}
export interface AppEditor { source: string; ownerId: string | null; clientId: unknown; record: AppRecord | null; sourceProblemId?: string; sourceProblemRepo?: string }
export interface AppTagCatalog { categories: { id: string; name: string; tags?: { name: unknown }[] }[]; [key: string]: unknown }
export interface AppTagRequest { number: number; category: string; name: string; author?: unknown; state?: string; url?: string; expected?: unknown }
export interface AppTagReview { canReview?: boolean; requests?: AppTagRequest[] }
export interface AppPayload {
  [key: string]: unknown;
  records?: AppRecord[]; algorithmNotes?: AppRecord[]; algorithmTopics?: import('../src/shared/models/algorithm-directory').AlgorithmDirectoryTopic[];
  issues?: AppRecord[]; local?: unknown; settings?: AppSettings; account?: AppAccount | null;
  permissions?: { repo?: string; push?: boolean; admin?: boolean }; lastSync?: string | null;
  tagCatalog?: AppTagCatalog; authStatus?: { status: string }; appVersion?: string;
  update?: import('./updates-ui').UpdatesUIUpdateAccess; updateCapability?: import('./updates-ui').UpdatesUICapability;
  planner?: import('./planner-ui').PlannerUIState; error?: unknown;
}
export interface AppState {
  view: string; libraryScope: string; records: AppRecord[]; algorithmNotes: AppRecord[];
  algorithmTopics?: import('../src/shared/models/algorithm-directory').AlgorithmDirectoryTopic[];
  algorithmTree: import('../src/shared/models/algorithm-directory').AlgorithmDirectoryNode;
  local: AppLocal; settings: AppSettings; account: AppAccount | null; authStatus: { status: string };
  permissions: { repo?: string; push?: boolean; admin?: boolean }; issues: AppRecord[];
  editor: AppEditor | null; lastSync: string | null; error: string; selected: string | null;
  comments: Map<string, AppComment[]>; loading: boolean; busy: boolean; tagCatalog: AppTagCatalog; tagReview: AppTagReview | null;
  appVersion?: string; update?: import('./updates-ui').UpdatesUIUpdateAccess | null;
  updateCapability?: import('./updates-ui').UpdatesUICapability; planner?: import('./planner-ui').PlannerUIState; catalogFromPayload?: boolean;
}
export interface AppResponse extends AppPayload, AppRecord {
  error?: string; canReview?: boolean; requests?: AppTagRequest[]; categories?: AppTagCatalog['categories'];
  document?: AppRecord; record?: AppRecord; deleted?: boolean; canceled?: boolean;
}
export type AppCallName = import('../src/shared/contracts/notebook').InvokeName;
export interface AppCall {
  (name: 'getComments', ...args: unknown[]): Promise<AppComment[] | { comments?: AppComment[] }>;
  (name: 'exportLocal', ...args: unknown[]): Promise<false | { canceled?: boolean }>;
  (name: AppCallName, ...args: unknown[]): Promise<AppResponse>;
}
export type AppControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export type AppDisabledControl = HTMLButtonElement | AppControl;
export interface AppError { message?: string }
export type AppFlatNode = import('../src/shared/models/algorithm-directory').AlgorithmDirectoryNode & { depth: number; parent: string | null };
export type AppQuery = {
  <S extends keyof AppSelectorMap>(selector: S, root?: ParentNode): AppSelectorMap[S] | null;
  <K extends keyof HTMLElementTagNameMap>(selector: K, root?: ParentNode): HTMLElementTagNameMap[K] | null;
  <T extends Element = HTMLElement>(selector: string, root?: ParentNode): T | null;
};
export type AppQueryAll = {
  <K extends keyof HTMLElementTagNameMap>(selector: K, root?: ParentNode): HTMLElementTagNameMap[K][];
  <T extends Element = HTMLElement>(selector: string, root?: ParentNode): T[];
};
export interface AppSelectorMap {
  '#sidebar-toggle': HTMLElementTagNameMap['button'];
  '#count-public': HTMLElementTagNameMap['span'];
  '#count-favorites': HTMLElementTagNameMap['span'];
  '#account-button': HTMLElementTagNameMap['button'];
  '#account-name': HTMLElementTagNameMap['strong'];
  '#account-caption': HTMLElementTagNameMap['span'];
  '#breadcrumb-view': HTMLElementTagNameMap['strong'];
  '#repo-control': HTMLElementTagNameMap['label'];
  '#repo-select': HTMLElementTagNameMap['select'];
  '#theme-select': HTMLElementTagNameMap['select'];
  '#sync-button': HTMLElementTagNameMap['button'];
  '#submit-button': HTMLElementTagNameMap['button'];
  '#settings-button': HTMLElementTagNameMap['button'];
  '#status-banner': HTMLElementTagNameMap['div'];
  '#page-eyebrow': HTMLElementTagNameMap['div'];
  '#page-title': HTMLElementTagNameMap['h1'];
  '#page-description': HTMLElementTagNameMap['p'];
  '#sync-status': HTMLElementTagNameMap['span'];
  '#demo-label': HTMLElementTagNameMap['span'];
  '#home-panel': HTMLElementTagNameMap['section'];
  '#platform-overview': HTMLElementTagNameMap['section'];
  '#section-placeholder': HTMLElementTagNameMap['section'];
  '#algorithm-panel': HTMLElementTagNameMap['section'];
  '#library-panel': HTMLElementTagNameMap['section'];
  '#library-scope-controls': HTMLElementTagNameMap['div'];
  '#library-public-button': HTMLElementTagNameMap['button'];
  '#library-local-button': HTMLElementTagNameMap['button'];
  '#library-local-count': HTMLElementTagNameMap['span'];
  '#search-input': HTMLElementTagNameMap['input'];
  '#clear-filters': HTMLElementTagNameMap['button'];
  '#platform-filter': HTMLElementTagNameMap['div'];
  '#tag-filter': HTMLElementTagNameMap['div'];
  '#author-filter': HTMLElementTagNameMap['div'];
  '#difficulty-filter': HTMLElementTagNameMap['details'];
  '#difficulty-count': HTMLElementTagNameMap['span'];
  '#difficulty-platform': HTMLElementTagNameMap['select'];
  '#cf-difficulty-fields': HTMLElementTagNameMap['div'];
  '#rating-min': HTMLElementTagNameMap['input'];
  '#rating-max': HTMLElementTagNameMap['input'];
  '#lg-difficulty-fields': HTMLElementTagNameMap['div'];
  '#luogu-min': HTMLElementTagNameMap['select'];
  '#luogu-max': HTMLElementTagNameMap['select'];
  '#native-difficulty-fields': HTMLElementTagNameMap['div'];
  '#native-difficulty-options': HTMLElementTagNameMap['div'];
  '#range-error': HTMLElementTagNameMap['p'];
  '#clear-difficulty': HTMLElementTagNameMap['button'];
  '#state-filter': HTMLElementTagNameMap['select'];
  '#active-filters': HTMLElementTagNameMap['div'];
  '#result-count': HTMLElementTagNameMap['strong'];
  '#record-list': HTMLElementTagNameMap['div'];
  '#detail-panel': HTMLElementTagNameMap['section'];
  '#submit-dialog': HTMLElementTagNameMap['dialog'];
  '#submit-title': HTMLElementTagNameMap['h2'];
  '#draft-hint': HTMLElementTagNameMap['div'];
  '#record-url': HTMLElementTagNameMap['input'];
  '#record-tag-picker': HTMLElementTagNameMap['div'];
  '#record-tag-selected': HTMLElementTagNameMap['div'];
  '#record-tag-open': HTMLElementTagNameMap['button'];
  '#request-tag-open': HTMLElementTagNameMap['button'];
  '#editor-difficulty-picker': HTMLElementTagNameMap['div'];
  '#record-body': HTMLElementTagNameMap['textarea'];
  '#creation-extras': HTMLElementTagNameMap['details'];
  '#submit-error': HTMLElementTagNameMap['div'];
  '#save-local-button': HTMLElementTagNameMap['button'];
  '#publish-button': HTMLElementTagNameMap['button'];
  '#settings-dialog': HTMLElementTagNameMap['dialog'];
  '#platform-bindings': HTMLElementTagNameMap['section'];
  '#repo-fieldset': HTMLElementTagNameMap['fieldset'];
  '#settings-repo-list': HTMLElementTagNameMap['div'];
  '#new-repo-name': HTMLElementTagNameMap['input'];
  '#new-repo-server': HTMLElementTagNameMap['input'];
  '#new-repo-path': HTMLElementTagNameMap['input'];
  '#new-repo-add-btn': HTMLElementTagNameMap['button'];
  '#code-font-size-value': HTMLElementTagNameMap['span'];
  '#settings-login-button': HTMLElementTagNameMap['button'];
  '#export-local-button': HTMLElementTagNameMap['button'];
  '#auth-dialog': HTMLElementTagNameMap['dialog'];
  '#cancel-login-button': HTMLElementTagNameMap['button'];
  '#auth-message': HTMLElementTagNameMap['p'];
  '#auth-code': HTMLElementTagNameMap['div'];
  '#auth-url': HTMLElementTagNameMap['p'];
  '#auth-copy-button': HTMLElementTagNameMap['button'];
  '#auth-open-button': HTMLElementTagNameMap['button'];
  '#account-dialog': HTMLElementTagNameMap['dialog'];
  '#account-details': HTMLElementTagNameMap['div'];
  '#account-login': HTMLElementTagNameMap['button'];
  '#account-switch': HTMLElementTagNameMap['button'];
  '#account-refresh': HTMLElementTagNameMap['button'];
  '#account-logout': HTMLElementTagNameMap['button'];
  '#account-error': HTMLElementTagNameMap['p'];
  '#update-heading': HTMLElementTagNameMap['h3'];
  '#app-version': HTMLElementTagNameMap['strong'];
  '#update-notice': HTMLElementTagNameMap['p'];
  '#check-update-button': HTMLElementTagNameMap['button'];
  '#update-status': HTMLElementTagNameMap['p'];
  '#update-progress': HTMLElementTagNameMap['progress'];
  '#startup-update-dialog': HTMLElementTagNameMap['dialog'];
  '#startup-update-title': HTMLElementTagNameMap['h2'];
  '#startup-update-close': HTMLElementTagNameMap['button'];
  '#startup-update-description': HTMLElementTagNameMap['p'];
  '#startup-update-version': HTMLElementTagNameMap['strong'];
  '#startup-update-later': HTMLElementTagNameMap['button'];
  '#startup-update-now': HTMLElementTagNameMap['button'];
  '#tag-picker-dialog': HTMLElementTagNameMap['dialog'];
  '#tag-picker-title': HTMLElementTagNameMap['h2'];
  '#tag-picker-close': HTMLElementTagNameMap['button'];
  '#tag-picker-hint': HTMLElementTagNameMap['p'];
  '#tag-picker-search': HTMLElementTagNameMap['input'];
  '#tag-picker-dialog-options': HTMLElementTagNameMap['div'];
  '#tag-picker-cancel': HTMLElementTagNameMap['button'];
  '#tag-picker-confirm': HTMLElementTagNameMap['button'];
  '#tag-review-dialog': HTMLElementTagNameMap['dialog'];
  '#tag-request-form': HTMLElementTagNameMap['form'];
  '#request-tag-category': HTMLElementTagNameMap['select'];
  '#request-tag-dialog-name': HTMLElementTagNameMap['input'];
  '#tag-review-section': HTMLElementTagNameMap['section'];
  '#tag-review-list': HTMLElementTagNameMap['div'];
  '#contest-restore-dialog': HTMLElementTagNameMap['dialog'];
  '#contest-restore-title': HTMLElementTagNameMap['h2'];
  '#contest-restore-close': HTMLElementTagNameMap['button'];
  '#contest-restore-hint': HTMLElementTagNameMap['p'];
  '#contest-restore-count': HTMLElementTagNameMap['span'];
  '#contest-restore-all': HTMLElementTagNameMap['button'];
  '#contest-restore-none': HTMLElementTagNameMap['button'];
  '#contest-restore-options': HTMLElementTagNameMap['div'];
  '#contest-restore-error': HTMLElementTagNameMap['p'];
  '#contest-restore-cancel': HTMLElementTagNameMap['button'];
  '#contest-restore-confirm': HTMLElementTagNameMap['button'];
  '#algorithm-topic-dialog': HTMLElementTagNameMap['dialog'];
  '#algorithm-topic-parent': HTMLElementTagNameMap['strong'];
  '#algorithm-topic-kind-hint': HTMLElementTagNameMap['p'];
  '#algorithm-topic-difficulty': HTMLElementTagNameMap['label'];
  '#algorithm-topic-error': HTMLElementTagNameMap['p'];
  '#algorithm-topic-submit': HTMLElementTagNameMap['button'];
  '#algorithm-note-dialog': HTMLElementTagNameMap['dialog'];
  '#algorithm-note-node': HTMLElementTagNameMap['select'];
  '#algorithm-note-error': HTMLElementTagNameMap['p'];
  '#toast': HTMLElementTagNameMap['div'];
  '#submit-form': AppSubmitForm;
  '#settings-form': AppSettingsForm;
  '#algorithm-topic-form': AppTopicForm;
  '#algorithm-note-form': AppNoteForm;
}

export type AppForm<Fields> = HTMLFormElement & { elements: Omit<HTMLFormControlsCollection, 'namedItem'> & Fields & { namedItem(name: string): AppControl | null } };
export type AppSubmitForm = AppForm<Record<'url' | 'title' | 'pid' | 'tags' | 'rating' | 'difficulty' | 'luoguDifficulty', HTMLInputElement> & Record<'reason' | 'body' | 'trick', HTMLTextAreaElement> & { platform: HTMLSelectElement }>;
export type AppSettingsForm = AppForm<Record<'clientId' | 'displayName' | 'autoSync' | 'codeFontSize' | 'codeLineNumbers', HTMLInputElement> & { theme: HTMLSelectElement }>;
export type AppTopicForm = AppForm<Record<'parentId' | 'label' | 'fullLabel' | 'scope', HTMLInputElement> & Record<'kind' | 'color', HTMLSelectElement>>;
export type AppNoteForm = AppForm<Record<'nodeId' | 'noteScope', HTMLSelectElement>>;
export interface AppFormDraft extends Record<string, string> { url: string; title: string; pid: string; platform: string; tags: string; reason: string; body: string; trick: string; rating: string; difficulty: string; luoguDifficulty: string }
export type AppFacet = 'platform' | 'tags' | 'authors' | 'native';
export interface AppTagGroup { id: string; name: string; tags: string[]; historical?: boolean }
export interface AppSeed { source: string; data: Record<string, unknown>; sourceProblemId?: string; sourceProblemRepo?: string }
export interface AppAuthProgress { message?: string; userCode?: string; user_code?: string; verificationUri?: string; verification_uri?: string; verificationUrl?: string; url?: string }
export interface AppMarked { (source: string): string; parse(source: string): string; Marked: import('./markdown-math').MarkdownMathMarked['Marked'] }
export type AppPurifier = import('./markdown').MarkdownPurifier;

declare global {
  interface Window {
    QMX_TAG_PRESETS?: AppTagCatalog;
    QMX_ALGORITHM_TREE: import('../src/shared/models/algorithm-directory').AlgorithmDirectoryNode;
    QMX_ALGORITHM_LEARNING_PATH?: import('./learning-path').LearningPathCurriculum;
  }
}

export interface AppWindowAccess {
  marked?: AppMarked;
  DOMPurify?: import('./markdown').MarkdownPurifier & { sanitize(html: string, options: { FORBID_TAGS: string[]; FORBID_ATTR: string[] }): string };
  katex?: import('./markdown-math').MarkdownMathKatex;
}
