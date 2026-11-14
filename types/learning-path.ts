import type { ReadingDetailApi } from './reading-detail';

/** Structural curriculum fields consumed by the route renderer. */
export interface LearningPathRange {
  min?: number;
  max?: number;
}

export interface LearningPathGate {
  id: string;
  title?: string;
  kind?: string;
  optional?: boolean;
  description?: string;
  learningTitle?: string;
  learningDescription?: string;
  cf?: LearningPathRange;
  luoguDifficulty?: string[];
  goals?: string[];
  topicIds?: string[];
  threadGateIds?: string[];
  prerequisites?: { gateIds?: string[]; topicIds?: string[] };
}

export interface LearningPathStage {
  id: string;
  index?: number;
  title?: string;
  type?: string;
  description?: string;
  goal?: string;
  cf?: LearningPathRange;
  luoguDifficulty?: string[];
  completionCriteria?: string[];
  gates?: LearningPathGate[];
}

export interface LearningPathCurriculum {
  id?: string;
  stages?: LearningPathStage[];
}

export interface LearningPathNode {
  id: string;
  label?: string;
  fullLabel?: string;
  kind?: string;
  color?: string;
  contentOf?: string;
  legacyIds?: string[];
  children?: LearningPathNode[];
}

/** Notes keep host-owned metadata when passed back through onNote. */
export interface LearningPathNote {
  [key: string]: unknown;
  nodeId: string;
  noteScope?: string;
  title?: string;
  author?: unknown;
  featured?: unknown;
  updatedAt?: string;
}

/** Historical records are partial and their values have not been validated. */
export interface LearningPathGateProgress {
  [key: string]: unknown;
  status?: unknown;
  problemUrl?: unknown;
  reflection?: unknown;
  updatedAt?: unknown;
}

/** Unknown keys and unknown gate values survive every targeted progress update. */
export interface LearningPathProgress {
  [key: string]: unknown;
  stageId?: unknown;
  gateId?: unknown;
  gates?: Record<string, unknown> | null;
}

export interface LearningPathSavedProgress extends LearningPathProgress {
  stageId: string;
  gateId: string;
  gates: Record<string, unknown>;
}

/** Only the data and callbacks used by the original renderer are required. */
export interface LearningPathOptions {
  host: HTMLElement;
  tree?: LearningPathNode | null;
  curriculum?: LearningPathCurriculum | null;
  progress?: LearningPathProgress | null;
  progressKey?: string;
  account?: { id?: unknown } | null;
  notes?: LearningPathNote[];
  canUpload?: boolean;
  onProgress?: (progress: LearningPathSavedProgress) => unknown;
  onTopic?: (id: string) => unknown;
  onNote?: (note: LearningPathNote, context: { gateId: string }) => unknown;
  onUpload?: (id: string) => unknown;
  toast?: (message: string) => unknown;
}

export interface LearningPathController {
  destroy(): void;
  selectTopic(id: string): boolean;
  selectGate(id: string): boolean;
}

export interface LearningPathApi {
  render(options: LearningPathOptions): LearningPathController;
}

/** The IIFE also supports evaluation without a browser window, as before. */
export interface LearningPathGlobal {
  NotebookLearningPath?: Readonly<LearningPathApi>;
  NotebookReadingDetail?: Pick<ReadingDetailApi, 'open'>;
}
