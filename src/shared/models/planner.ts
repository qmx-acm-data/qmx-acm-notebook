/** Validated planner data; persisted JSON and action inputs enter the service as unknown. */
export type PlannerLayout = 'balanced' | 'compact' | 'focus';

export interface PlannerRecord {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerProblem extends PlannerRecord {
  url: string;
}

export interface PlannerTask extends PlannerRecord {
  details: string;
  /** Empty when no deadline is set; otherwise an explicitly zoned ISO datetime. */
  dueAt: string;
}

export type PlannerItem = PlannerProblem | PlannerTask;
export type PlannerKind = 'problems' | 'tasks';

export interface PlannerSnapshot {
  problems: PlannerProblem[];
  tasks: PlannerTask[];
  layout: PlannerLayout;
}

export interface PlannerAddProblem {
  url: string;
  /** Empty or omitted titles use the URL-derived label. */
  title?: string;
}

export interface PlannerAddTask {
  title: string;
  details?: string;
  dueAt?: string;
}

export interface PlannerUpdateProblem {
  id: string;
  title?: string;
  url?: string;
  done?: boolean;
}

export interface PlannerUpdateTask {
  id: string;
  title?: string;
  details?: string;
  dueAt?: string;
  done?: boolean;
}

export interface PlannerDelete {
  id: string;
}

export interface PlannerActionPayloads {
  addProblem: PlannerAddProblem;
  addTask: PlannerAddTask;
  updateProblem: PlannerUpdateProblem;
  updateTask: PlannerUpdateTask;
  deleteProblem: PlannerDelete;
  deleteTask: PlannerDelete;
  setLayout: { layout: PlannerLayout };
}

export type PlannerActionName = keyof PlannerActionPayloads;
export type PlannerActionArgs = {
  [Name in PlannerActionName]: [name: Name, payload: PlannerActionPayloads[Name]]
}[PlannerActionName];
export type PlannerAction = {
  [Name in PlannerActionName]: { name: Name; payload: PlannerActionPayloads[Name] }
}[PlannerActionName];

export interface PlannerServiceOptions {
  read: (name: 'planner.json', fallback: null) => unknown;
  save: (name: 'planner.json', snapshot: PlannerSnapshot) => void;
  now?: () => string;
  id?: () => string;
}

export interface PlannerService {
  state(): PlannerSnapshot;
  /** IPC callers may supply arbitrary values; validation occurs inside the service. */
  action(name: unknown, payload: unknown): PlannerSnapshot;
}
