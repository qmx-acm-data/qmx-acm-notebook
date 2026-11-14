/** Type-only adapters for record lists, reading details, and issue discussions. */
export interface LibraryReaderOptions {
  demo: boolean;
  stateLabels: Readonly<Record<string, string>>;
  getLocal(): import('./app').AppState['local'];
  setLocal(local: import('./app').AppState['local']): void;
  getAccount(): import('./app').AppState['account'];
  getPermissions(): import('./app').AppState['permissions'];
  getView(): import('./app').AppState['view'];
  getLibraryScope(): import('./app').AppState['libraryScope'];
  getSelected(): import('./app').AppState['selected'];
  setSelected(selected: import('./app').AppState['selected']): void;
  getComments(): import('./app').AppState['comments'];
  getBusy(): import('./app').AppState['busy'];
  setBusy(value: boolean): void;
  getLoading(): import('./app').AppState['loading'];
  getError(): import('./app').AppState['error'];
  /** All visible records, including current-repository issues and account-visible local records. */
  getRecords(): import('./app').AppRecord[];
  key(record: import('./app').AppRecord): string;
  isLocal(record: import('./app').AppRecord): boolean;
  visibleLocal(record: import('./app').AppRecord): boolean;
  canEditRemote(record: import('./app').AppRecord | null | undefined): boolean;
  sameRepo(record: import('./app').AppRecord): boolean;
  platformCode(value: unknown): string;
  authorName(author: unknown): string;
  date(value: unknown): string;
  quotaBlocked(): boolean;
  renderMarkdown(container: HTMLElement, body: unknown): void;
  persistLocal(): Promise<unknown>;
  call(name: 'getComments', number: import('./app').AppRecord['number']): Promise<import('./app').AppComment[] | { comments?: import('./app').AppComment[] }>;
  call(name: 'comment', payload: { number: import('./app').AppRecord['number']; repo: import('./app').AppRecord['repo']; body: string }): Promise<import('./app').AppResponse>;
  render(): void;
  clearFilters(): void;
  openSubmit(record?: import('./app').AppRecord | null): void;
  openLocalSolution(record: import('./app').AppRecord): void;
  deleteRecord(record: import('./app').AppRecord): Promise<void>;
  deleteDiscussion(record: import('./app').AppRecord): Promise<void>;
  openExternal(url: unknown): Promise<void>;
  toast(message: string | undefined): void;
  errorMessage(error: unknown): string;
}

export interface LibraryReaderController {
  favorite(record: import('./app').AppRecord): boolean;
  mastery(record: import('./app').AppRecord): string;
  tags(record: import('./app').AppRecord): HTMLDivElement;
  openDetail(record: import('./app').AppRecord): void;
  closeDetail(): void;
  /** Leave focused reading without rendering or restoring the previous position. */
  resetDetail(): void;
  isFocusedDetail(): boolean;
  /** Render the focused record before filters/list updates; false resumes the normal list path. */
  renderFocusedDetail(): boolean;
  renderLibrary(items: import('./app').AppRecord[]): void;
  renderDetail(record: import('./app').AppRecord): void;
  loadComments(record: import('./app').AppRecord, container: HTMLElement): Promise<void>;
  changeLocal(change: () => void): Promise<void>;
}

export interface LibraryReaderApi {
  create(options: LibraryReaderOptions): LibraryReaderController;
}
