import type { Trick } from './trick';
import type { LearningCurriculumDocument } from './learning-curriculum';
import type { AlgorithmNodeContent } from './algorithm-node-content';
import type { LearningGateContent } from './learning-content';
import type { LocalDataSnapshot } from './records';
import type { AuthStatus } from './auth';
import type { PlannerSnapshot } from './planner';
import type { UpdateProgress } from '../contracts/notebook';

/** state() annotates cached objects without reparsing their persisted fields. */
export interface SourceScope { repo: string; serverUrl: string; sourceKey: string }
export type CachedDocument = Record<string, unknown> & SourceScope & { kind: 'document' };
export type CachedEntry = Record<string, unknown> & SourceScope;
/** Fields from services not yet migrated remain unknown, including old disk values. */
export interface BootstrapPayload {
  records: CachedDocument[];
  tricks: Trick[];
  algorithmNotes: CachedEntry[];
  algorithmTopics: CachedEntry[];
  algorithmNodeContents: AlgorithmNodeContent[];
  learningGateContents: LearningGateContent[];
  learningCurriculum: LearningCurriculumDocument | null;
  issues: CachedEntry[];
  local: LocalDataSnapshot;
  lastSync: unknown;
  tagCatalog: unknown;
  tagCatalogError: unknown;
  settings: Record<string, unknown>;
  account: unknown;
  authStatus: AuthStatus;
  appVersion: string;
  update: UpdateProgress | undefined;
  updateCapability: unknown;
  permissions: unknown;
  contests: unknown;
  platforms: unknown;
  planner: PlannerSnapshot;
  error: string | null;
}
