/** Public administrator-authored overrides; remote file SHAs remain outside the JSON payload. */
export interface LearningPracticeList { title: string; url: string }
export interface LearningGateAuthor { id: number; login: string }
export interface SaveLearningGateInput {
  repo: string;
  gateId: string;
  description: string;
  goals: string[];
  practiceList: LearningPracticeList | null;
  sha: string | null;
}
export interface LearningGateContent {
  gateId: string;
  description: string;
  goals: string[];
  practiceList: LearningPracticeList | null;
  sha: string;
  updatedAt: string;
  author: LearningGateAuthor;
  repo?: string;
  serverUrl?: string;
  sourceKey?: string;
}
