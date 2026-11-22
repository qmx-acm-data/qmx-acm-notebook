import type { AlgorithmDirectoryNode } from './models/algorithm-directory';

/** Physical branches stay directories; a converted algorithm is resolved to its own content leaf. */
export function isAlgorithmLeaf(node: AlgorithmDirectoryNode): boolean {
  return node.kind === 'algorithm' && !(node.children || []).length;
}
export function resolveAlgorithmLeaf(tree: AlgorithmDirectoryNode, id: unknown): AlgorithmDirectoryNode | null {
  if (typeof id !== 'string') return null;
  const index = new Map<string, AlgorithmDirectoryNode>();
  function walk(node: AlgorithmDirectoryNode): void { index.set(node.id, node); for (const alias of node.legacyIds || []) index.set(alias, node); (node.children || []).forEach(walk); }
  walk(tree); let current = index.get(id); const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    if (isAlgorithmLeaf(current)) return current;
    seen.add(current.id);
    const parentId = current.id;
    current = (current.children || []).find(child => child.contentOf === parentId || child.id === current?.algorithmContentId);
  }
  return null;
}
