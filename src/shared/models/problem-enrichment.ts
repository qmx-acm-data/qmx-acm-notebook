export interface ProblemSupplementFields {
  tags?: string[];
  cfRating?: number | null;
  luoguDifficulty?: string;
  reason: string;
}
export interface ProblemSupplement extends ProblemSupplementFields {
  url: string;
  source: 'manual' | 'ai';
  status: 'approved';
  updatedAt: string;
  revision: number;
  model?: string;
}
export interface ProblemSuggestion extends ProblemSupplementFields {
  id: string;
  url: string;
  source: 'ai';
  status: 'pending';
  model: string;
  createdAt: string;
}
export interface ProblemEnrichmentView {
  problem?: import('./daily-problem').DailyDrawProblem;
  revision: number;
  url: string;
  title: string;
  platform: string;
  officialTags: string[];
  officialDifficulty: string | null;
  canSupplementTags: boolean;
  canSupplementDifficulty: boolean;
  supplement: ProblemSupplement | null;
  suggestion: ProblemSuggestion | null;
}
export interface SaveProblemSupplementInput extends ProblemSupplementFields {
  url: string;
  expectedRevision: number;
  suggestionId?: string;
}
export interface ProblemAIConfigInput { endpoint: string; model: string; apiKey?: string }
export interface ProblemAIStatus { configured: boolean; endpoint: string | null; model: string | null }
export interface SuggestProblemSupplementInput { url: string; statementText: string }
