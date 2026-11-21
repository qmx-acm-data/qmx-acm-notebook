/** Stable IDs of the approved roadmap directories; independent of shared gate identities. */
export const ROADMAP_DIRECTORY_IDS = ['g', 'xh', 'sz', 'hs', 'wy', 'ds', 'ss', 'px', 'ef', 'tx', 'dl', 'zfc', 'hm', 'ssr', 'jcdp', 'tl', 'srgt', 'zfsf', 'jcsz', 'jjsj', 'jjdp', 'jjgl', 'jjsz', 'recursion', 'struct', 'pointer', 'simulation', 'construction', 'prefix', 'two', 'basicdata', 'advancedstrings', 'geometry', 'offline'] as const;

export interface AlgorithmNodeContent {
  nodeId: string;
  /** Original on-disk identity when this algorithm has since split into a synthetic leaf. */
  storageNodeId?: string;
  introduction: string;
  featuredNotePaths: string[];
  sha: string;
  updatedAt: string;
  author: { id: number; login: string };
  repo?: string; serverUrl?: string; sourceKey?: string;
}
export interface SaveAlgorithmNodeContentInput {
  repo: string; nodeId: string; storageNodeId?: string; introduction: string; featuredNotePaths: string[]; sha: string | null;
}
