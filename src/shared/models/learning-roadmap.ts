export interface RoadmapStage { name: string; color: string; bg: string }
export interface RoadmapNode {
  id: string; row: number; label: string; sub?: string; kind: 'root' | 'leaf' | 'aggregate' | 'branch' | 'adv';
  contextual?: boolean; px: number; py: number;
  detail: [string, string, string[], string[], string];
  /** Existing semantic curriculum identities; never title-based matching. */
  gateIds?: string[];
  topicIds?: string[];
}
export interface RoadmapEdge { from: string; to: string; bidir?: boolean; relation?: 'foundation' | 'contains'; detour?: string }
export interface RoadmapData { rows: RoadmapStage[]; nodes: RoadmapNode[]; edges: RoadmapEdge[]; goals: string[]; indexEntries: RoadmapNode[] }
