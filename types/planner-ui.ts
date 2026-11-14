import type { PlannerActionArgs, PlannerSnapshot } from '../src/shared/models/planner';
import type { DeadlineController } from './deadline';

/** Render accepts historical/browser snapshots without asserting service validation. */
export interface PlannerUIRecord {
  [key: string]: unknown;
  id?: unknown;
  title?: unknown;
  done?: unknown;
  url?: unknown;
  details?: unknown;
  dueAt?: unknown;
}

export interface PlannerUIState {
  [key: string]: unknown;
  problems: unknown[];
  tasks: unknown[];
  layout: unknown;
}

/** Only the operations used by the planner are required from its host. */
export interface PlannerUIBridge {
  plannerAction(...args: PlannerActionArgs): Promise<PlannerSnapshot>;
  openExternal?(url: string): Promise<unknown>;
}

export interface PlannerUIOptions {
  bridge?: PlannerUIBridge;
  onChange?: (state: PlannerUIState) => void;
}

export interface PlannerUIApi {
  init(options?: PlannerUIOptions): PlannerUIApi;
  render(next?: unknown): void;
}

export interface PlannerField<Input extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement> {
  wrap: HTMLLabelElement;
  input: Input;
}

export interface PlannerCard {
  card: HTMLElement;
  count: HTMLSpanElement;
  form: HTMLFormElement;
  error: HTMLParagraphElement;
  list: HTMLDivElement;
  more: HTMLButtonElement;
  hint: HTMLParagraphElement;
  completed: HTMLDetailsElement;
  summary: HTMLElement;
  doneList: HTMLDivElement;
}

export interface PlannerEditor {
  form: HTMLFormElement;
  heading: HTMLHeadingElement;
  title: PlannerField;
  url: PlannerField;
  details: PlannerField<HTMLTextAreaElement>;
  due: PlannerField;
  deadlinePicker: DeadlineController | undefined;
  error: HTMLParagraphElement;
  item: PlannerUIRecord | null;
  kind: import('../src/shared/models/planner').PlannerKind | null;
  initialLocal: string;
}

export interface PlannerFocus {
  kind: string | undefined;
  id: string | undefined;
  action: string | undefined;
}

export interface PlannerDeadline {
  text: string;
  title?: string;
  overdue: boolean;
}
