// Generated from src/main/library/luogu-native.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLuoguNativeBaseline = parseLuoguNativeBaseline;
exports.estimateNativeLuoguCfRating = estimateNativeLuoguCfRating;
exports.recoverLuoguNativeRow = recoverLuoguNativeRow;
/** Validated, public Luogu native difficulty baseline; never writes a library shard. */
const { luoguNativeDifficultyLabel, luoguDifficultyRank } = require('./luogu-difficulty.js');
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
/** Validate the whole file before exposing any entry, so partial corruption never repairs rows. */
function parseLuoguNativeBaseline(value) {
    const row = object(value), difficulties = object(row?.difficulties);
    if (!row || row.schema !== 1 || row.mappingVersion !== 'luogu-native-2026-11'
        || row.source !== 'https://www.luogu.com.cn/problem/list?type=P'
        || typeof row.queriedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.queriedAt)
        || !Number.isFinite(Date.parse(row.queriedAt)) || new Date(row.queriedAt).toISOString() !== row.queriedAt
        || !difficulties || Object.keys(difficulties).length === 0)
        throw new Error('洛谷原生难度基线格式无效');
    const validated = {};
    for (const [pid, code] of Object.entries(difficulties)) {
        if (!/^P\d+$/.test(pid) || typeof code !== 'number' || luoguNativeDifficultyLabel(code) === null)
            throw new Error('洛谷原生难度基线包含无效题号或难度');
        validated[pid] = code;
    }
    return { schema: 1, mappingVersion: 'luogu-native-2026-11', queriedAt: row.queriedAt,
        source: 'https://www.luogu.com.cn/problem/list?type=P', difficulties: Object.freeze(validated) };
}
/** Uncalibrated CF representatives, shared by the library's native-code repair path. */
function estimateNativeLuoguCfRating(level) {
    const rank = luoguDifficultyRank(level);
    return rank === null || rank < 1 ? null : [900, 1100, 1300, 1600, 1800, 2100, 2400, 2800][rank - 1] ?? null;
}
function nativePid(row) {
    if (row.platform !== 'LG' || typeof row.id !== 'string' || typeof row.url !== 'string')
        return null;
    const pid = /^LG:(P\d+)$/.exec(row.id)?.[1];
    if (!pid || !/^https:\/\//i.test(row.url) || /[\s\\]/.test(row.url))
        return null;
    let url;
    try {
        url = new URL(row.url);
    }
    catch {
        return null;
    }
    return !url.username && !url.password && !url.port && ['luogu.com.cn', 'www.luogu.com.cn'].includes(url.hostname)
        && url.pathname.replace(/\/+$/, '') === `/problem/${pid}` ? pid : null;
}
/** Valid row codes win. Snapshot recovery additionally requires PID and official HTTPS route. */
function recoverLuoguNativeRow(value, baseline) {
    const row = object(value);
    if (!row || row.platform !== 'LG')
        return value;
    const ownLevel = luoguNativeDifficultyLabel(row.luoguDifficultyCode);
    const pid = ownLevel === null ? nativePid(row) : null;
    const code = ownLevel !== null ? row.luoguDifficultyCode : pid ? baseline?.difficulties[pid] : undefined;
    const level = luoguNativeDifficultyLabel(code);
    if (level === null || typeof code !== 'number')
        return value;
    const supplement = object(row.supplementInfo), reference = object(row.difficultyReference);
    const hasReference = supplement?.difficulty === true || reference?.basis === 'clist'
        || typeof row.clistRating === 'number' && Number.isFinite(row.clistRating) && row.clistRating > 0;
    return { ...row, luoguDifficultyCode: code, luoguDifficulty: level,
        officialDifficulty: code === 0 ? null : level,
        ...(!hasReference ? { estimatedCfRating: estimateNativeLuoguCfRating(level), estimatedLuoguDifficulty: null, estimateReason: null } : {}) };
}
