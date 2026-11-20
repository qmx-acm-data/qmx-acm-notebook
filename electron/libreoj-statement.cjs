// Generated from src/main/contests/libreoj-statement.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLibreOJStatement = parseLibreOJStatement;
exports.fetchLibreOJStatement = fetchLibreOJStatement;
const libreoj_daily_cjs_1 = require("./libreoj-daily.cjs");
const { marked } = require('marked');
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null; }
function canonicalUrl(input) {
    let url;
    try {
        url = new URL(input);
    }
    catch {
        throw new Error('LibreOJ 题目链接无效');
    }
    if (url.protocol !== 'https:' || url.hostname !== 'loj.ac' || url.username || url.password || url.port || url.search || url.hash || !/^\/p\/[1-9]\d*$/.test(url.pathname) || !Number.isSafeInteger(Number(url.pathname.split('/')[2])))
        throw new Error('仅支持 LibreOJ HTTPS 公开题目链接');
    return url;
}
function plain(text) { return text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''); }
function markdownText(text) {
    function tokensText(value) {
        if (!Array.isArray(value))
            return '';
        return value.map((value) => {
            const token = object(value);
            if (!token)
                return '';
            if (token.type === 'html')
                return '';
            if (token.type === 'image')
                return '[图片，请查看原题]';
            if (token.type === 'space' || token.type === 'hr' || token.type === 'br')
                return '\n';
            if (token.type === 'list')
                return tokensText(token.items);
            if (token.type === 'table')
                return [token.header, ...(Array.isArray(token.rows) ? token.rows : [])].map(row => Array.isArray(row) ? row.map((cell) => tokensText(object(cell)?.tokens)).join('\t') : '').join('\n') + '\n';
            return (Array.isArray(token.tokens) ? tokensText(token.tokens) : typeof token.text === 'string' ? token.text : '') + (['paragraph', 'heading', 'blockquote', 'list_item', 'code'].includes(String(token.type)) ? '\n\n' : '');
        }).join('');
    }
    const withoutActiveHtml = text.replace(/<(script|style|iframe|object|embed|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    return plain(tokensText(marked.lexer(withoutActiveHtml))).replace(/\n{3,}/g, '\n\n').trim();
}
function escapeHtml(text) { return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function parseLibreOJStatement(problemUrl, payload) {
    const url = canonicalUrl(problemUrl), root = object(payload), meta = object(root?.meta), localized = object(root?.localizedContentsOfLocale);
    if (root?.error || meta?.isPublic !== true || meta.displayId !== Number(url.pathname.split('/')[2]) || typeof localized?.title !== 'string' || !Array.isArray(localized.contentSections) || !Array.isArray(root?.samples))
        throw new Error('LibreOJ 未提供匹配的公开题干');
    const title = markdownText(localized.title);
    const samples = root.samples.map((value) => {
        const sample = object(value);
        if (typeof sample?.inputData !== 'string' || typeof sample.outputData !== 'string')
            throw new Error('LibreOJ 样例格式无效');
        return { input: plain(sample.inputData), output: plain(sample.outputData) };
    });
    const sections = localized.contentSections.map((value) => {
        const section = object(value);
        if (!section || typeof section.sectionTitle !== 'string' || typeof section.text !== 'string' || (section.type !== 'Text' && section.type !== 'Sample'))
            throw new Error('LibreOJ 题干分段格式不受支持');
        const heading = markdownText(section.sectionTitle), text = markdownText(section.text);
        if (section.type === 'Text')
            return [heading, text].filter(Boolean).join('\n');
        if (typeof section.sampleId !== 'number' || !Number.isSafeInteger(section.sampleId) || section.sampleId < 0 || !samples[section.sampleId])
            throw new Error('LibreOJ 题干样例引用无效');
        const sample = samples[section.sampleId];
        return `${heading || '样例'}\n输入\n${sample.input}\n\n输出\n${sample.output}${text ? `\n\n${text}` : ''}`;
    });
    if (!title || !sections.some(section => section.trim()))
        throw new Error('LibreOJ 公开题干不完整');
    const statementText = sections.join('\n\n');
    return { platform: 'LOJ', url: url.href, title, statementText, statementHtml: `<pre>${escapeHtml(statementText)}</pre>` };
}
/** Read-only public API, no login, cookies, or challenge handling. */
async function fetchLibreOJStatement(problemUrl, options = {}) {
    const url = canonicalUrl(problemUrl);
    const payload = await (0, libreoj_daily_cjs_1.requestLibreOJ)('getProblem', { displayId: Number(url.pathname.split('/')[2]), localizedContentsOfLocale: 'zh_CN', samples: true }, options.fetcher ?? fetch, options.timeoutMs ?? 12000, options.maxBytes ?? 1000000);
    return parseLibreOJStatement(url.href, payload);
}
