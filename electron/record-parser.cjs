// Generated from src/main/records/parser.cts; run pnpm modules:build.
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.identify = identify;
exports.frontmatter = frontmatter;
exports.authorId = authorId;
exports.parseDocument = parseDocument;
exports.issueRecord = issueRecord;
exports.issueBody = issueBody;
exports.documentContent = documentContent;
exports.validatePath = validatePath;
exports.parseAlgorithmNote = parseAlgorithmNote;
exports.samePayload = samePayload;
const YAML = __importStar(require("yaml"));
function identify(url) {
    try {
        const u = new URL(url);
        let m;
        if (/(^|\.)codeforces\.com$/.test(u.hostname)) {
            m = u.pathname.match(/\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Za-z]\d*)/);
            if (m)
                return { pid: `CF${m[1]}${m[2].toUpperCase()}`, platform: 'CF' };
        }
        if (u.hostname === 'atcoder.jp' && (m = u.pathname.match(/\/tasks\/([\w-]+)/)))
            return { pid: m[1], platform: 'AT' };
        if (/(^|\.)luogu\.com\.cn$/.test(u.hostname) && (m = u.pathname.match(/\/problem\/([\w-]+)/)))
            return { pid: m[1], platform: 'LG' };
        if (/(^|\.)nowcoder\.com$/.test(u.hostname))
            return { pid: u.pathname.split('/').filter(Boolean).slice(-2).join('-'), platform: 'NC' };
        return { pid: '', platform: 'Oth' };
    }
    catch {
        return { pid: '', platform: 'Oth' };
    }
}
function frontmatter(text, strict = false) {
    const source = String(text).replace(/^\uFEFF/, '');
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match)
        return { meta: {}, body: source };
    try {
        const meta = YAML.parse(match[1]) || {};
        if (typeof meta !== 'object' || Array.isArray(meta))
            throw new Error('元数据必须是对象');
        return { meta: meta, body: source.slice(match[0].length) };
    }
    catch (error) {
        if (strict)
            throw new Error(`Markdown 元数据无法解析：${error.message}`);
        return { meta: {}, body: source.slice(match[0].length) };
    }
}
function authorId(value) {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function parseDocument(path, text, extra = {}) {
    const { meta, body } = frontmatter(text);
    const record = {
        id: `document:${path}`, kind: 'document', path,
        title: String(meta.title || path.split('/').pop().replace(/\.md$/i, '')),
        pid: String(meta.pid || ''), platform: String(meta.platform || (path.startsWith('algorithms/') ? '算法' : 'Oth')),
        rating: Number(meta.rating) > 0 && Number.isFinite(Number(meta.rating)) ? Number(meta.rating) : null,
        difficulty: String(meta.difficulty || ''), luoguDifficulty: String(meta.luoguDifficulty || ''), tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
        author: String(meta.author || '未知'), authorId: authorId(meta.author_id),
        problemUrl: String(meta.problem_url || meta.problemUrl || ''), clientId: String(meta.client_id || ''),
        managed: meta.schema === 2 && authorId(meta.author_id) !== null,
        schema: meta.schema ?? null, body, updatedAt: String(meta.updated_at || meta.date || ''), ...extra
    };
    return record;
}
function issueRecord(x) {
    const text = x.body || '';
    const metaMatch = text.match(/<!-- qmx-record\s*([\s\S]*?)\s*-->/);
    let meta = {};
    if (metaMatch) {
        try {
            meta = JSON.parse(metaMatch[1]);
        }
        catch { }
    }
    return {
        id: `issue:${x.number}`, kind: 'issue', number: x.number, title: x.title,
        pid: String(meta.pid || ''), platform: String(meta.platform || 'Oth'),
        rating: Number.isFinite(Number(meta.rating)) && Number(meta.rating) > 0 ? Number(meta.rating) : null,
        difficulty: String(meta.difficulty || ''), luoguDifficulty: String(meta.luoguDifficulty || ''),
        tags: [...new Set([...(Array.isArray(meta.tags) ? meta.tags.map(String) : []), ...(x.labels || []).map(l => typeof l === 'string' ? l : l.name)])],
        author: x.user?.login || '', authorId: authorId(x.user?.id),
        body: text.replace(/<!-- qmx-record[\s\S]*?-->/g, ''), url: x.html_url,
        updatedAt: x.updated_at, comments: x.comments, state: x.state, problemUrl: meta.problemUrl || ''
    };
}
function issueBody(record) {
    const found = identify(record.problemUrl || record.url || '');
    const meta = { schema: 1, pid: record.pid || found.pid, platform: record.platform || found.platform, tags: record.tags || [], problemUrl: record.problemUrl || '', cohort: record.cohort || '', rating: Number(record.rating) > 0 ? Number(record.rating) : null, difficulty: record.difficulty || '', luoguDifficulty: record.luoguDifficulty || '' };
    const text = `<!-- qmx-record ${JSON.stringify(meta).replace(/-->/g, '')} -->\n\n${record.problemUrl ? `题目链接：${record.problemUrl}\n\n` : ''}## 错因\n\n${record.reason || ''}\n\n## 题解与代码\n\n${record.solution || ''}\n\n## 个人 trick\n\n${record.trick || ''}`;
    if (text.length > 60000)
        throw new Error('内容过长，请控制在 60000 字符以内');
    return text;
}
function documentContent(r, author) {
    const found = identify(r.problemUrl || '');
    const pid = r.pid || found.pid;
    if (!pid)
        throw new Error('正式题解需要题号，请补充题号');
    const platform = r.platform || found.platform;
    return { platform, pid, text: `---\n${YAML.stringify({ pid, title: r.title || pid, platform, rating: Number(r.rating) > 0 ? Number(r.rating) : null, difficulty: r.difficulty || '', luoguDifficulty: r.luoguDifficulty || '', tags: r.tags || [], author, date: new Date().toISOString().slice(0, 10) })}---\n\n# 题意\n\n${r.problemUrl || ''}\n\n## 思路\n\n${r.solution || ''}\n\n## 正确性\n\n${r.proof || '待补充'}\n\n## 复杂度\n\n${r.complexity || '待补充'}\n\n## 易错点\n\n${r.reason || ''}\n\n## 个人 trick\n\n${r.trick || ''}\n` };
}
function validatePath(path) {
    if (typeof path !== 'string' || !/^(problems|algorithms)\/.+\.md$/i.test(path)
        || /[\\%?#\u0000-\u001f\u007f]/.test(path)
        || path.split('/').some(part => !part || part === '.' || part === '..')) {
        throw new Error('文档路径必须位于 problems/ 或 algorithms/ 下，使用 .md 扩展名且不能包含路径穿越');
    }
    return path;
}
function parseAlgorithmNote(path, text, extra = {}) {
    const record = parseDocument(path, text, extra);
    const { meta } = frontmatter(text);
    return { ...record, kind: 'algorithm-note', noteScope: meta.note_scope === 'public' ? 'public' : 'personal', nodeId: String(meta.node_id || 'root'), featured: meta.featured === true };
}
function samePayload(a, b) {
    const comparable = (text) => {
        const { meta, body } = frontmatter(text, true);
        delete meta.updated_at;
        const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
            ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
        return JSON.stringify({ meta: stable(meta), body });
    };
    return comparable(a) === comparable(b);
}
