// Generated from src/shared/models/trick.ts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trickTierGuide = exports.trickTiers = void 0;
exports.isTrickTier = isTrickTier;
exports.trickTiers = ['S', 'A', 'B', 'C', 'D', 'E'];
exports.trickTierGuide = {
    S: { label: '优先掌握', description: '满足前置后，在多类题中常用，或能显著降低复杂度、代码量与出错风险。' },
    A: { label: '推荐掌握', description: '适用的一类题较明确，遇到时通常值得优先考虑。' },
    B: { label: '按需查阅', description: '有清晰的使用信号，遇到对应题型时再学即可。' },
    C: { label: '专题补充', description: '主要用于某个专题或解法变体，掌握常规做法后再补充。' },
    D: { label: '少见场景', description: '只在少数题型或严格的附加条件下有明显收益。' },
    E: { label: '备查参考', description: '适合作为例题、替代写法或经验记录保留，无需专门练习。' }
};
function isTrickTier(value) {
    return exports.trickTiers.some(tier => tier === value);
}
