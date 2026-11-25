import type { SourceScope } from './bootstrap';

export const trickTiers = ['S', 'A', 'B', 'C', 'D', 'E'] as const;
export type TrickTier = typeof trickTiers[number];
export const trickTierGuide: Readonly<Record<TrickTier, { label: string; description: string }>> = {
  S: { label: '优先掌握', description: '满足前置后，在多类题中常用，或能显著降低复杂度、代码量与出错风险。' },
  A: { label: '推荐掌握', description: '适用的一类题较明确，遇到时通常值得优先考虑。' },
  B: { label: '按需查阅', description: '有清晰的使用信号，遇到对应题型时再学即可。' },
  C: { label: '专题补充', description: '主要用于某个专题或解法变体，掌握常规做法后再补充。' },
  D: { label: '少见场景', description: '只在少数题型或严格的附加条件下有明显收益。' },
  E: { label: '备查参考', description: '适合作为例题、替代写法或经验记录保留，无需专门练习。' }
};
export function isTrickTier(value: unknown): value is TrickTier {
  return trickTiers.some(tier => tier === value);
}
export interface TrickRecommendation {
  tier: TrickTier;
  prerequisiteIds: string[];
  reason: string;
}

/** Public repository Markdown document. The body is mounted only after opening it. */
export interface Trick extends SourceScope {
  id: string;
  kind: 'trick';
  clientId: string;
  path: string;
  sha: string;
  title: string;
  introduction: string;
  body: string;
  authorId: number;
  author: { id: number; login: string; name?: string };
  updatedAt: string;
  recommendation?: TrickRecommendation;
  url?: string;
}
export type PublicTrick = Trick;
export interface SaveTrickInput {
  /** Keep one UUID for a new draft to make retries idempotent. */
  clientId?: string;
  path?: string;
  sha?: string;
  title: string;
  introduction: string;
  body: string;
  /** Omit to preserve the existing review; null explicitly removes it. */
  recommendation?: TrickRecommendation | null;
  repo?: string;
  serverUrl?: string;
  sourceKey?: string;
}
export interface DeleteTrickInput {
  path: string;
  sha: string;
  repo?: string;
  serverUrl?: string;
  sourceKey?: string;
}
export interface DeletedTrick extends SourceScope {
  id: string;
  path: string;
  deleted: true;
}
