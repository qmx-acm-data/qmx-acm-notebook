/** App adapters for algorithm browsing, note dialogs, and account-scoped learning progress. */
export interface AlgorithmWorkspaceOptions {
  getAlgorithmNotes(): import('./app').AppState['algorithmNotes'];
  setAlgorithmNotes(notes: import('./app').AppState['algorithmNotes']): void;
  getAlgorithmNodeContents(): import('../src/shared/models/algorithm-node-content').AlgorithmNodeContent[];
  setAlgorithmNodeContents(contents: import('../src/shared/models/algorithm-node-content').AlgorithmNodeContent[]): void;
  saveAlgorithmNodeContent(input: import('../src/shared/models/algorithm-node-content').SaveAlgorithmNodeContentInput): Promise<import('../src/shared/models/algorithm-node-content').AlgorithmNodeContent>;
  getLearningCurriculum(): import('../src/shared/models/learning-curriculum').LearningCurriculumDocument | null;
  setLearningCurriculum(document: import('../src/shared/models/learning-curriculum').LearningCurriculumDocument | null): void;
  saveLearningCurriculum(input: import('../src/shared/models/learning-curriculum').SaveLearningCurriculumInput): Promise<import('../src/shared/models/learning-curriculum').LearningCurriculumDocument>;
  getLearningGateContents(): import('../src/shared/models/learning-content').LearningGateContent[];
  setLearningGateContents(contents: import('../src/shared/models/learning-content').LearningGateContent[]): void;
  saveLearningGate(input: import('../src/shared/models/learning-content').SaveLearningGateInput): Promise<import('../src/shared/models/learning-content').LearningGateContent>;
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
  repoSource(): string;
  uuid(): string;
  setBusy(value: boolean): void;
  persistLocal(): Promise<unknown>;
  call(operation: 'saveAlgorithmTopic' | 'saveAlgorithmNote', argument: Record<string, unknown>): Promise<import('./app').AppResponse>;
  openExternal(url: unknown): Promise<void>;
  render(): void;
  renderMarkdown(container: HTMLElement, body: unknown): void;
  authorName(author: unknown): string;
  date(value: unknown): string;
  tags(note: import('./app').AppRecord): HTMLElement;
  isFavorite?: (note: import('./algorithm-browser').AlgorithmBrowserNote) => boolean;
  onToggleFavorite?: (note: import('./algorithm-browser').AlgorithmBrowserNote) => Promise<void>;
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
