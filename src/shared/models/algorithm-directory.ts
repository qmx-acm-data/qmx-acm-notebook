/** Structural directory data: unrecognized source and editorial fields survive hydration. */
export interface AlgorithmRatingRange {
  min: number;
  max: number;
}

export interface AlgorithmRating extends Record<string, unknown> {
  status?: string;
  type?: string;
  range?: AlgorithmRatingRange;
}

/** Input nodes need not already have children, full labels, depths, or ratings. */
export interface AlgorithmDirectoryNode extends Record<string, unknown> {
  id: string;
  label: string;
  color: string;
  kind?: string;
  children?: AlgorithmDirectoryNode[];
  fullLabel?: string;
  aliases?: string[];
  legacyIds?: string[];
  rating?: AlgorithmRating;
  difficultySource?: Record<string, unknown>;
  level?: number;
  scope?: string;
  rationale?: string;
  attributes?: string[];
  origin?: string;
  contentOf?: string;
  algorithmContentId?: string;
  sourceHeading?: unknown;
  part?: unknown;
  nestedPart?: unknown;
  metadata?: unknown;
}

/** splitMixed fills children recursively, without inventing other optional fields. */
export interface AlgorithmDirectoryBranch extends AlgorithmDirectoryNode {
  children: AlgorithmDirectoryBranch[];
}

/** hydrate additionally indexes every node and calculates its rating. */
export interface HydratedAlgorithmDirectoryNode extends AlgorithmDirectoryBranch {
  children: HydratedAlgorithmDirectoryNode[];
  fullLabel: string;
  level: number;
  rating: AlgorithmRating;
}

/** Topic records are checked by hydrate before they become nodes. */
export interface AlgorithmDirectoryTopic extends Record<string, unknown> {
  id?: unknown;
  parentId?: unknown;
  label?: unknown;
  fullLabel?: string;
  color?: string;
  kind?: unknown;
  scope?: string;
}

/** Scoring converts field values to text and does not require a complete node or note. */
export interface AlgorithmDirectoryScoreField {
  value?: unknown;
  weight?: number;
}

export interface AlgorithmDirectorySearchNode {
  label?: unknown;
  fullLabel?: unknown;
  aliases?: unknown[];
}

export interface AlgorithmDirectorySearchNote {
  title?: unknown;
  tags?: unknown[];
  body?: unknown;
}

export interface AlgorithmDirectoryApi {
  normalize(value: unknown): string;
  compact(value: unknown): string;
  score(query: unknown, fields: AlgorithmDirectoryScoreField[]): number;
  topicScore(node: AlgorithmDirectorySearchNode, path: unknown[], query: unknown): number;
  noteScore(note: AlgorithmDirectorySearchNote, node: AlgorithmDirectorySearchNode | null | undefined,
    path: unknown[], query: unknown, author?: unknown): number;
  /** Mutates and returns the same tree, retaining absent optional properties. */
  splitMixed(tree: AlgorithmDirectoryNode): AlgorithmDirectoryBranch;
  /** Clones the input with JSON semantics before adding or splitting topics. */
  hydrate(base: AlgorithmDirectoryNode, topics?: (AlgorithmDirectoryTopic | null | undefined)[]): HydratedAlgorithmDirectoryNode;
}
