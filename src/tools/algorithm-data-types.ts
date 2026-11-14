/** Editable generator inputs. Extra JSON fields remain intact during serialization. */
export interface AlgorithmNode extends Record<string, unknown> {
  id: string;
  label: string;
  color: string;
  kind: string;
  level: number;
  children: AlgorithmNode[];
  fullLabel?: string;
  attributes?: string[];
  legacyIds?: string[];
  sourceHeading?: string;
  part?: string;
  rating: {
    status: string;
    type: string;
    scope: string;
    rationale: string;
    range?: { min: number; max: number };
  };
  difficultySource?: { kind: string };
  difficultyConfidence?: string;
  evidenceScope?: string;
  scope?: string | string[];
  prerequisites?: string | string[];
  crossRefs?: string | string[];
  sourceRefs?: string[];
  rationale?: string;
}

export interface DirectoryEntry {
  node: AlgorithmNode;
  ancestors: AlgorithmNode[];
  topPart: AlgorithmNode | null;
}

export interface AlgorithmDirectoryData extends Record<string, unknown> {
  schema: number;
  tree: AlgorithmNode;
  sources: {
    feishu: { title?: string; url: string; snapshot?: string };
    userMd: { path: string };
    research?: { date?: string };
  };
  summary: Record<string, number | boolean | Record<string, number>>;
  legend: Record<string, string>;
  legacyNodeMap: Record<string, string>;
  sourceIndex?: { nodeId: string; sourceHeading: string }[];
  ratingPolicy?: unknown;
  editorial: {
    titleSimplification?: {
      reviewed: number;
      changed: number;
      changes: { nodeId: string; before: string; after: string }[];
    };
    categoryRenames?: {
      nodeId: string;
      part?: string;
      before: string;
      after: string;
      reason: string;
    }[];
    structureChanges?: {
      type: string;
      nodeId: string;
      label?: string;
      from?: string | string[];
      to?: string | string[];
      reason?: string;
    }[];
    directorySeparation: {
      originalNodes: number;
      contentMoves: { directoryId: string; algorithmId: string }[];
    };
  };
}

export interface BuildOptions {
  check?: boolean;
}

export interface CodeforcesRange {
  min: number;
  max: number | null;
}

export interface LearningGate extends Record<string, unknown> {
  id: string;
  index: number;
  kind: string;
  title: string;
  description: string;
  goals: string[];
  learningTitle: string;
  learningDescription: string;
  threadGateIds: string[];
  optional: boolean;
  topicIds: string[];
  cf?: CodeforcesRange;
  luoguDifficulty: string[];
  prerequisites?: { gateIds?: string[]; topicIds?: string[] };
  problemIds?: unknown;
  knowledgeDifficulty?: unknown;
}

export interface LearningStage extends Record<string, unknown> {
  id: string;
  index: number;
  type?: string;
  title: string;
  description: string;
  goal: string;
  rationale: string;
  gates: LearningGate[];
  cf?: CodeforcesRange;
  luoguDifficulty: string[];
  prerequisites?: { stageIds?: string[] };
}

export interface LearningSummary {
  stages: number;
  gates: number;
  optionalGates: number;
  topicCount: number;
}

export interface AlgorithmLearningData extends Record<string, unknown> {
  schema: number;
  id: string;
  title: string;
  stages: LearningStage[];
  summary: LearningSummary;
  sources: { url: string }[];
}
