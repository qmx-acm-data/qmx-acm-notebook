/** Minimal injected GitHub surface; JSON remains unknown until consumed. */
export interface TagsGithub {
  repo: string;
  token: string;
  request(path: string, options?: { method?: string; body?: string }): Promise<{ data: unknown }>;
  pages(path: string): Promise<unknown[]>;
  contentEndpoint(path: string): string;
}

export interface TagEntry { [key: string]: unknown; id?: unknown; name: string }
export interface TagCategory {
  [key: string]: unknown;
  id: unknown;
  name: unknown;
  tags: TagEntry[];
}
export interface TagCatalog {
  [key: string]: unknown;
  categories: TagCategory[];
  /** Persisted entries are copied, not validated or upgraded to approved records. */
  approvals?: Record<string, unknown>;
}
export interface TagCatalogState { catalog: TagCatalog; branch: unknown; sha: unknown }
export interface ParsedTagRequest { category: string; name: string }
export interface TagRequest extends ParsedTagRequest {
  [key: string]: unknown;
  number: unknown;
  author: unknown;
  url: unknown;
  state: unknown;
  expected?: { category: string; name: string; updatedAt: unknown };
}
export interface RequestTagInput { category?: unknown; name?: unknown }
export interface ReviewTagInput { number?: unknown; decision?: unknown; expected?: unknown }

/** Structural views allow the original property access without asserting field validity. */
export interface IssueFields {
  number?: unknown;
  body?: unknown;
  user?: unknown;
  html_url?: unknown;
  state?: unknown;
  updated_at?: unknown;
  pull_request?: unknown;
}
export interface UserFields { id?: unknown; login?: unknown }
export interface RepositoryFields { default_branch?: unknown; permissions?: unknown; role_name?: unknown }
export interface PermissionFields { admin?: unknown; maintain?: unknown }
export interface ContentFields { type?: unknown; encoding?: unknown; content?: unknown; sha?: unknown }
export interface SavedCatalogFields { categories?: unknown; approvals?: unknown }
export interface SavedCategoryFields { id?: unknown; name?: unknown; tags?: unknown }
export interface SavedTagFields { id?: unknown; name?: unknown }
export interface ExpectedFields { category?: unknown; name?: unknown; updatedAt?: unknown }
export interface ApprovalFields { category?: unknown; name?: unknown }
export interface ErrorFields { status?: unknown; message?: unknown }
