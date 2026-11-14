/** Existing inline-reader API. Types only; no runtime imports or emitted code. */
export interface ReadingPathItem {
  label: string;
  onClick?: () => void;
}

export interface ReadingDetailOptions {
  content?: HTMLElement;
  title?: string;
  mount?: HTMLElement | null;
  path?: ReadingPathItem[];
  onClose?: () => void;
}

export interface ReadingDetailController {
  setPath(items: ReadingPathItem[]): void;
  close(): void;
}

export interface ReadingDetailApi {
  open(options?: ReadingDetailOptions): ReadingDetailController | undefined;
  closeAll(): void;
}
