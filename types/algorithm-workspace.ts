/** App adapters for algorithm browsing, note dialogs, and account-scoped learning progress. */
export interface AlgorithmWorkspaceOptions {
  getAlgorithmNotes(): import('./app').AppState['algorithmNotes'];
  setAlgorithmNotes(notes: import('./app').AppState['algorithmNotes']): void;
  getAlgorithmTopics(): import('./app').AppState['algorithmTopics'];
  setAlgorithmTopics(topics: import('./app').AppState['algorithmTopics']): void;
  getAlgorithmTree(): import('./app').AppState['algorithmTree'];
  setAlgorithmTree(tree: import('./app').AppState['algorithmTree']): void;
  getAccount(): import('./app').AppState['account'];
  getPermissions(): import('./app').AppState['permissions'];
  getLocal(): import('./app').AppState['local'];
  getBusy(): boolean;
  getReadingDetail(): import('./reading-detail').ReadingDetailApi;
  accountId(): string | null;
  repo(): string;
  uuid(): string;
  setBusy(value: boolean): void;
  persistLocal(): Promise<unknown>;
  call(operation: 'saveAlgorithmTopic' | 'saveAlgorithmNote', argument: Record<string, unknown>): Promise<import('./app').AppResponse>;
  render(): void;
  renderMarkdown(container: HTMLElement, body: unknown): void;
  authorName(author: unknown): string;
  date(value: unknown): string;
  tags(note: import('./app').AppRecord): HTMLElement;
  toast(message: string | undefined): void;
  errorMessage(error: unknown): string;
}

export interface AlgorithmWorkspaceController {
  readonly algorithmSelectedNode: string | null;
  readonly algorithmMode: string;
  readonly algorithmPendingTopic: string | null;
  readonly learningController: import('./learning-path').LearningPathController | null;
  readonly algorithmTopicRequest: string | null;
  setSelectedNode(id: string | null): void;
  algorithmNodes(): import('./app').AppFlatNode[];
  learningProgressKey(): string;
  setAlgorithmMode(mode: string): void;
  openLearningTopic(id: string): void;
  saveLearningProgress(value: import('./learning-path').LearningPathSavedProgress): Promise<void>;
  renderAlgorithmNotes(): void;
  updateAlgorithmTopicKind(): void;
  openAlgorithmTopicEditor(parentId: string): void;
  isMineNote(note: import('./app').AppRecord): boolean;
  openAlgorithmNoteDetail(note: import('./learning-path').LearningPathNote, context?: { gateId?: string }): void;
  openAlgorithmNoteEditor(): void;
  /** Matches the algorithm data clearing performed by the app's demo repository switches. */
  resetRepository(): void;
}

export interface AlgorithmWorkspaceApi {
  create(options: AlgorithmWorkspaceOptions): AlgorithmWorkspaceController;
}
