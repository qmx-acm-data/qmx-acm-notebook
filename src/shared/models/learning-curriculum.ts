export type CurriculumGateKind = 'learning' | 'mixed' | 'challenge';
export type CurriculumGateScope = 'core' | 'recommended' | 'elective' | 'route';
export interface CurriculumGateLayout {
  id: string;
  title: string;
  kind: CurriculumGateKind;
  sectionId: string;
  scope: CurriculumGateScope;
  /** Only custom gates store their initial content here. Built-in descriptions remain in the formal curriculum. */
  description?: string;
  goals?: string[];
  topicIds?: string[];
}
export interface CurriculumStageLayout { id: string; title: string; gates: CurriculumGateLayout[] }
export interface CurriculumLayout { stages: CurriculumStageLayout[] }
export interface LearningCurriculumDocument {
  layout: CurriculumLayout;
  sha: string;
  updatedAt: string;
  author: { id: number; login: string };
  repo?: string;
  serverUrl?: string;
  sourceKey?: string;
}
export interface SaveLearningCurriculumInput { repo: string; layout: CurriculumLayout; sha: string | null }
