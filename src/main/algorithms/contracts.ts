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
  kind: string | undefined;
  parentId: string | null;
  depth: number;
  children: HydratedAlgorithmDirectoryNode[];
}
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
