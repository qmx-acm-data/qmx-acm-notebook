// Generated from src/shared/luogu-difficulty.ts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.luoguDifficultyLevels = void 0;
exports.luoguDifficultyRank = luoguDifficultyRank;
exports.luoguDifficultyLabel = luoguDifficultyLabel;
/** Application labels, with historical Luogu names resolved to the same level. */
exports.luoguDifficultyLevels = ['入门', '普及-', '普及', '普及+/提高-', '提高', '提高+/省选-', '省选/NOI-', 'NOI/NOI+/CTS'];
const aliases = {
    '暂无评定': 0, '入门': 1, '普及-': 2, '普及减': 2,
    '普及': 3, '普及/提高-': 3, '普及/提高减': 3, '普及提高-': 3,
    '普及+/提高-': 4, '普及+/提高': 4, '普及加/提高': 4,
    '提高': 5, '提高+/省选-': 6, '提高/省选-': 6,
    '省选/NOI-': 7, '省选/NOI减': 7,
    'NOI/NOI+/CTS': 8, 'NOI/NOI+/CTSC': 8, 'NOI/CTSC': 8, 'NOI': 8, 'NOI+': 8
};
function luoguDifficultyRank(value) {
    const key = value.trim().replace(/[−–—﹣]/g, '-').replace(/\s/g, '');
    return Object.hasOwn(aliases, key) ? aliases[key] : null;
}
function luoguDifficultyLabel(value) {
    const rank = luoguDifficultyRank(value);
    return rank === null ? value : rank === 0 ? '暂无评定' : exports.luoguDifficultyLevels[rank - 1];
}
