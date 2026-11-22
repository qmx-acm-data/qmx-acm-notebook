/** Luogu's official ProblemDifficulty IDs and names (including its Unicode minus). */
export const luoguNativeDifficultyLabels: Readonly<Record<number, string>> = {
  0: '暂无评定', 1: '入门', 2: '普及−', 3: '普及', 4: '普及+/提高−',
  5: '提高', 6: '提高+/省选−', 7: '省选/NOI−', 8: 'NOI/NOI+/CTS'
};
export function luoguNativeDifficultyLabel(code: unknown): string | null {
  return typeof code === 'number' && Number.isInteger(code) && code >= 0 && code <= 8
    ? luoguNativeDifficultyLabels[code] : null;
}

/** Application labels, with historical Luogu names resolved to the same level. */
export const luoguDifficultyLevels = ['入门', '普及-', '普及', '普及+/提高-', '提高', '提高+/省选-', '省选/NOI-', 'NOI/NOI+/CTS'] as const;
const aliases: Readonly<Record<string, number>> = {
  '暂无评定': 0, '入门': 1, '普及-': 2, '普及减': 2,
  '普及': 3, '普及/提高-': 3, '普及/提高减': 3, '普及提高-': 3,
  '普及+/提高-': 4, '普及+/提高': 4, '普及加/提高': 4,
  '提高': 5, '提高+/省选-': 6, '提高/省选-': 6,
  '省选/NOI-': 7, '省选/NOI减': 7,
  'NOI/NOI+/CTS': 8, 'NOI/NOI+/CTSC': 8, 'NOI/CTSC': 8, 'NOI': 8, 'NOI+': 8
};
export function luoguDifficultyRank(value: string): number | null {
  const key = value.trim().replace(/[−–—﹣]/g, '-').replace(/\s/g, '');
  return Object.hasOwn(aliases, key) ? aliases[key] : null;
}
export function luoguDifficultyLabel(value: string): string {
  const rank = luoguDifficultyRank(value);
  return rank === null ? value : rank === 0 ? '暂无评定' : luoguDifficultyLevels[rank - 1];
}
