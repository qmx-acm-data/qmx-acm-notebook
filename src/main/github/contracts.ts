/** API fields remain unvalidated until the client consumes or checks them. */
export interface Fields { [key: string]: unknown }
export interface UserFields extends Fields {
  id?: unknown;
  login?: unknown;
  name?: unknown;
  avatar_url?: unknown;
}
export interface RepositoryFields extends Fields {
  permissions?: unknown;
  default_branch?: unknown;
}
export interface PermissionFields {
  push?: unknown;
  admin?: unknown;
}
export interface ContentFields extends Fields {
  type?: unknown;
  encoding?: unknown;
  content?: unknown;
  sha?: unknown;
}
export interface WriteFields extends Fields { content?: unknown }
export interface TreeFields extends Fields {
  tree?: unknown;
  truncated?: unknown;
  total_count?: unknown;
}
export interface TreeEntry extends Fields {
  type?: unknown;
  path?: unknown;
  sha?: unknown;
}
export interface IssueFields extends Fields {
  pull_request?: unknown;
  number?: unknown;
  node_id?: unknown;
  body?: unknown;
}
export interface GraphQLFields extends Fields { errors?: unknown; data?: unknown }
export interface GraphQLDataFields { deleteIssue?: unknown }
export interface ErrorFields { status?: unknown; cause?: unknown }
export interface RequestOptions extends RequestInit {}
export interface RequestResult { data: unknown; link: string }
export interface FetchResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}
export interface Fetcher {
  (url: string, options: RequestOptions): Promise<FetchResponse>;
}
export interface GitHubOptions {
  token?: string;
  repo?: string;
  fetcher?: Fetcher;
  serverUrl?: unknown;
}
export interface SyncInput extends Fields { blobs?: unknown }

/** Minimal host surface used by the still-CommonJS delegated services. */
export interface GitHubServiceHost {
  repo: string;
  token: string;
  request(path: string, options?: RequestOptions): Promise<RequestResult>;
  pages(path: string, max?: number): Promise<unknown[]>;
  contentEndpoint(path: string): string;
  currentDocument(path: string, branch: unknown): Promise<{ sha: unknown; text: string } | null>;
}
export interface TagCatalog extends Fields { categories: TagCategory[] }
export interface TagCategory extends Fields {
  id: unknown;
  name: unknown;
  tags: TagEntry[];
}
export interface TagEntry extends Fields { id?: unknown; name: unknown }
export interface TagRequest extends Fields {
  number: unknown;
  category: string;
  name: string;
  author: unknown;
  url: unknown;
  state: unknown;
  expected?: { category: string; name: string; updatedAt: unknown };
}
export interface TagService {
  getTagCatalog(): Promise<TagCatalog>;
  requestTag(input: unknown): Promise<TagRequest | null>;
  getTagReview(): Promise<{ canReview: boolean; requests: TagRequest[] }>;
  reviewTag(input: unknown): Promise<{ number: unknown; decision: unknown; approved: boolean; closed: boolean }>;
}
export interface TagsModule { Tags: new (github: GitHubServiceHost) => TagService }
export interface AlgorithmTopic extends Fields {
  /** Regex checks coerce this field; parseTopics does not require a string. */
  id: unknown;
  parentId: string;
  label: string;
  fullLabel: string;
  kind: 'directory' | 'algorithm';
  color: string;
  scope: string;
  requestId?: string;
  createdAt: string;
  createdBy: { id: number; login: string };
}
export interface AlgorithmTopicsService {
  save(input: unknown): Promise<{ topic: AlgorithmTopic & { repo: string }; topics: (AlgorithmTopic & { repo: string })[] }>;
}
export interface AlgorithmTopicsModule {
  AlgorithmTopics: new (github: GitHubServiceHost) => AlgorithmTopicsService;
  TOPICS_PATH: string;
  parseTopics(text: unknown): AlgorithmTopic[];
}
