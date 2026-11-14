/** Filter UI access uses the existing app record views without normalizing values. */
export type FiltersRecord = import('./app').AppRecord;
export type FiltersFacet = import('./app').AppFacet;
export type FiltersTagGroup = import('./app').AppTagGroup;
export interface FiltersTagPickerContext {
  mode: string;
  original: Set<string>;
  selected: Set<string>;
}

export interface FiltersUIOptions {
  getRecords(): FiltersRecord[];
  getView(): import('./app').AppState['view'];
  getScope(): import('./app').AppState['libraryScope'];
  getAccount(): import('./app').AppState['account'];
  getTagCatalog(): import('./app').AppState['tagCatalog'];
  getBusy(): boolean;
  favorite(record: FiltersRecord): boolean;
  mastery(record: FiltersRecord): string;
  isLocal(record: FiltersRecord): boolean;
  authorName(author: unknown): string;
  render(): void;
}

export interface FiltersUIController {
  readonly facets: Record<string, Set<string>>;
  readonly facetNames: Record<string, string>;
  readonly platformNames: Record<string, string>;
  readonly luoguLevels: string[];
  readonly luoguTones: string[];
  readonly tagPickerContext: FiltersTagPickerContext | null;
  facetValue(record: FiltersRecord, group: string): string;
  fillFacetOptions(container: HTMLElement, group: string, values: unknown[], search?: string): void;
  refreshFilters(): void;
  tagGroups(extra?: string[]): FiltersTagGroup[];
  fillTagOptions(container: HTMLElement, selected: Set<string>, query: string, onChange: () => void): void;
  openTagPicker(mode: string): void;
  closeTagPicker(apply: boolean): void;
  renderEditorTags(): void;
  ranges(): (number | null)[];
  updateFacetCounts(): void;
  setDifficultyPlatform(platform: string): void;
  clearDifficulty(): void;
  filteredRecords(): FiltersRecord[];
  clearFilters(): void;
  colorRatingInput(input: HTMLInputElement): void;
  colorLuoguSelection(select: HTMLSelectElement): void;
}

export interface FiltersUIApi {
  create(options: FiltersUIOptions): FiltersUIController;
}
