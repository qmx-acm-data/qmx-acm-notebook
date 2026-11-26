import type { AlgorithmDirectoryNode, HydratedAlgorithmDirectoryNode } from '../../shared/models/algorithm-directory.js';

export interface TopicInput {
  parentId: string;
  label: string;
  fullLabel: string;
  kind: 'directory' | 'algorithm';
  color: string;
  scope: string;
  requestId?: string;
}
export interface AlgorithmTopic extends TopicInput, Record<string, unknown> {
  // The stored UUID guard uses RegExp.test, which preserves JavaScript coercion.
  id: unknown;
  createdAt: string;
  createdBy: { id: number; login: string };
}
export interface TopicIndexEntry {
  id: string;
  label: string;
  fullLabel: string;
  kind: string | undefined;
  color: string;
  scope: string;
  parentId: string | null;
  depth: number;
  children: HydratedAlgorithmDirectoryNode[];
}
export interface TopicMutationWrite {
  path: string;
  branch: string;
  sha: string | null;
  message: string;
  text: string;
}
export interface TopicMutationContext extends Pick<TopicMutationWrite, 'path' | 'branch' | 'sha'> {
  id: string;
  topicsSha: string | null;
  overridesSha: string | null;
  index: ReadonlyMap<string, TopicIndexEntry>;
  removedIds: ReadonlySet<string>;
}
export type TopicMutationCommit = (write: TopicMutationWrite) => Promise<void>;
export type TopicMutationGuard = (context: TopicMutationContext) => Promise<void | TopicMutationCommit>;
export interface TopicsGitHub {
  token: string;
  repo: string;
  currentDocument(path: string, branch: unknown): Promise<{ text: string; sha: unknown } | null>;
  request(path: string, options?: { method?: string; body?: string }): Promise<{ data: unknown }>;
  contentEndpoint(path: string): string;
}
export interface TopicsOptions {
  tree?: AlgorithmDirectoryNode;
  uuid?: () => string;
  now?: () => string;
}
export interface UserFields { id?: unknown; login?: unknown }
export interface RepositoryFields { permissions?: { admin?: unknown } | null; default_branch?: unknown }
export interface WriteFields { content?: { sha?: unknown } | null }
export interface ErrorFields { status?: unknown }
