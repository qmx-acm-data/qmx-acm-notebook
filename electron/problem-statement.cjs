// Generated from src/main/contests/problem-statement.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPublicProblemStatement = fetchPublicProblemStatement;
exports.parsePublicStatement = parsePublicStatement;
const { marked } = require('marked');
const MAX_TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 1_500_000;
const LEETCODE_QUERY = `query questionData($titleSlug: String!) { question(titleSlug: $titleSlug) { title content translatedTitle translatedContent } }`;
const ALLOWED_TAGS = new Set(['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'pre', 'code', 'em', 'strong', 'b', 'i', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'a', 'sup', 'sub']);
function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function canonicalUrl(platform, input) {
    let url;
    try {
        url = new URL(input);
    }
    catch {
        throw new Error('题目链接无效');
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash)
        throw new Error('仅允许受支持平台的 HTTPS 公开题目链接');
    if (platform === 'CF' && url.hostname === 'codeforces.com' && /^\/contest\/[1-9]\d*\/problem\/[A-Za-z0-9]+$/.test(url.pathname))
        return url;
    if (platform === 'CF' && url.hostname === 'codeforces.com' && /^\/problemset\/problem\/[1-9]\d*\/[A-Za-z0-9]+$/.test(url.pathname))
        return url;
    if (platform === 'AT' && url.hostname === 'atcoder.jp' && /^\/contests\/[A-Za-z0-9_-]+\/tasks\/[A-Za-z0-9_-]+$/.test(url.pathname))
        return url;
    if (platform === 'LC' && (url.hostname === 'leetcode.com' || url.hostname === 'leetcode.cn') && /^\/problems\/[a-z0-9-]+\/?$/.test(url.pathname))
        return url;
    if (platform === 'LG' && url.hostname === 'www.luogu.com.cn' && /^\/problem\/(?:P[1-9]\d*|CF[1-9]\d*[A-Z][0-9]*|AT_[a-z0-9_]+|SP[1-9]\d*|UVA[1-9]\d*|U[1-9]\d*|T[1-9]\d*)$/.test(url.pathname))
        return url;
    throw new Error('题目链接主机或路径不受支持');
}
function decodeEntities(value) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity) => {
        if (entity[0] !== '#')
            return named[entity.toLowerCase()] ?? whole;
        const hex = entity[1].toLowerCase() === 'x';
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ' ';
    });
}
function sanitize(html) {
    const withoutActive = html.replace(/<(script|style|iframe|object|embed|form|svg|math|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        .replace(/<(script|style|iframe|object|embed|form|svg|math|template)\b[^>]*\/?>/gi, '');
    return withoutActive.replace(/<!--[^]*?-->/g, '').replace(/<\/?([a-z][\w:-]*)\b([^>]*)>/gi, (whole, rawTag, rawAttrs) => {
        const tag = rawTag.toLowerCase();
        if (!ALLOWED_TAGS.has(tag))
            return '';
        if (whole.startsWith('</'))
            return `</${tag}>`;
        if (tag === 'img') {
            const alt = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs);
            const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs);
            const source = decodeEntities(src?.[1] ?? src?.[2] ?? '');
            const safeSrc = /^(https:\/\/|\/)/i.test(source) && !source.startsWith('//') ? ` src="${escapeAttr(source)}"` : '';
            return `<img${safeSrc}${alt ? ` alt="${escapeAttr(decodeEntities(alt[1] ?? alt[2] ?? ''))}"` : ''}>`;
        }
        if (tag === 'a') {
            const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs);
            const target = decodeEntities(href?.[1] ?? href?.[2] ?? '');
            return /^(https?:\/\/|\/)/i.test(target) && !target.startsWith('//') ? `<a href="${escapeAttr(target)}" rel="noreferrer">` : '<a>';
        }
        return `<${tag}>`;
    });
}
function escapeAttr(value) { return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function elementBody(html, start, tag) {
    const match = start.exec(html);
    if (!match || match.index === undefined)
        return undefined;
    const openEnd = match.index + match[0].length;
    const token = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
    token.lastIndex = openEnd;
    let depth = 1;
    let next;
    while ((next = token.exec(html))) {
        const closing = next[0].startsWith('</');
        if (closing)
            depth -= 1;
        else if (!next[0].endsWith('/>'))
            depth += 1;
        if (depth === 0)
            return html.slice(openEnd, next.index);
    }
    return undefined;
}
function markdownText(markdown) {
    // Use the existing Markdown lexer; never render remote Markdown or HTML.
    function tokensText(tokens) {
        if (!Array.isArray(tokens))
            return '';
        return tokens.map((value) => {
            const token = object(value);
            if (!token)
                return '';
            if (token.type === 'html')
                return token.raw === '<br>' || token.raw === '<br/>' || token.raw === '<br />' ? '\n' : '';
            if (token.type === 'space' || token.type === 'hr' || token.type === 'br')
                return '\n';
            if (token.type === 'list')
                return tokensText(token.items);
            if (token.type === 'table') {
                const rows = [token.header, ...(Array.isArray(token.rows) ? token.rows : [])];
                return rows.map(row => Array.isArray(row) ? row.map((cell) => tokensText(object(cell)?.tokens)).join('\t') : '').join('\n') + '\n';
            }
            const text = Array.isArray(token.tokens) ? tokensText(token.tokens) : typeof token.text === 'string' ? decodeEntities(token.text) : '';
            return text + (['paragraph', 'heading', 'blockquote', 'list_item', 'code'].includes(String(token.type)) ? '\n\n' : '');
        }).join('');
    }
    return tokensText(marked.lexer(markdown)).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
function luoguStatement(html, url) {
    const context = /<script\b(?=[^>]*\bid\s*=\s*["']lentille-context["'])(?=[^>]*\btype\s*=\s*["']application\/json["'])[^>]*>([\s\S]*?)<\/script\s*>/i.exec(html)?.[1];
    if (!context)
        throw new Error('页面未提供可识别的洛谷公开题干；登录或验证码页面不受支持');
    let parsed;
    try {
        parsed = JSON.parse(context);
    }
    catch {
        throw new Error('页面中的洛谷题干数据格式无效');
    }
    const root = object(parsed);
    const problem = object(object(root?.data)?.problem);
    const content = object(problem?.contenu);
    if (root?.template !== 'problem.show' || root.status !== 200 || problem?.pid !== url.pathname.split('/')[2] || !content)
        throw new Error('页面未提供匹配的洛谷公开题干');
    const title = typeof content.name === 'string' ? markdownText(content.name) : '';
    if (!title || typeof content.description !== 'string' || !markdownText(content.description))
        throw new Error('页面中的洛谷公开题干内容不完整');
    const sections = [];
    for (const [key, label] of [['background', '题目背景'], ['description', '题目描述'], ['formatI', '输入格式'], ['formatO', '输出格式']]) {
        const value = content[key];
        if (typeof value === 'string' && value.trim())
            sections.push(`${label}\n${markdownText(value)}`);
    }
    if (Array.isArray(problem.samples))
        for (const [index, sample] of problem.samples.entries()) {
            if (!Array.isArray(sample) || sample.length !== 2 || !sample.every((part) => typeof part === 'string'))
                throw new Error('页面中的洛谷样例数据格式无效');
            sections.push(`样例输入 ${index + 1}\n${sample[0]}\n\n样例输出 ${index + 1}\n${sample[1]}`);
        }
    if (typeof content.hint === 'string' && content.hint.trim())
        sections.push(`说明/提示\n${markdownText(content.hint)}`);
    const statementText = sections.join('\n\n').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    return { platform: 'LG', url: url.href, title, statementText, statementHtml: `<pre>${escapeAttr(statementText)}</pre>` };
}
function extract(platform, html) {
    if (platform === 'LC')
        throw new Error('力扣题面应通过 GraphQL 获取');
    let title;
    let body;
    if (platform === 'CF') {
        body = elementBody(html, /<div\b(?=[^>]*\bclass\s*=\s*(?:"[^"]*\bproblem-statement\b[^"]*"|'[^']*\bproblem-statement\b[^']*'))[^>]*>/i, 'div');
        title = body && /<div\b[^>]*class\s*=\s*(["'])title\1[^>]*>([\s\S]*?)<\/div\s*>/i.exec(body)?.[2];
    }
    else {
        body = elementBody(html, /<div\b(?=[^>]*\bid\s*=\s*(["'])task-statement\1)[^>]*>/i, 'div');
        title = /<span\b[^>]*class\s*=\s*(["'])h2\1[^>]*>([\s\S]*?)<\/span\s*>/i.exec(html)?.[2]
            ?.replace(/<a\b[^>]*>[\s\S]*?<\/a\s*>/gi, ' ');
    }
    if (!body)
        throw new Error('页面未提供可识别的公开题面，未尝试使用题解替代');
    const cleanTitle = decodeEntities((title ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    const cleaned = sanitize(body).trim();
    const text = decodeEntities(cleaned.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!cleanTitle || text.length < 20)
        throw new Error('公开题面内容不完整');
    return { title: cleanTitle, body: cleaned };
}
async function boundedText(response, limit) {
    if (!response.body)
        throw new Error('题面响应为空');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const result = await reader.read();
            if (result.done)
                break;
            size += result.value.byteLength;
            if (size > limit) {
                await reader.cancel();
                throw new Error('题面页面超过大小限制');
            }
            chunks.push(result.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
}
function leetCodePayload(value) {
    const root = object(value);
    const data = object(root?.data);
    const question = object(data?.question);
    if (!question)
        throw new Error('力扣 GraphQL 未返回公开题面');
    const title = typeof question.title === 'string' ? question.title : (typeof question.translatedTitle === 'string' ? question.translatedTitle : '');
    const body = typeof question.content === 'string' ? question.content : (typeof question.translatedContent === 'string' ? question.translatedContent : '');
    if (!title.trim() || !body.trim())
        throw new Error('力扣公开题面内容不完整');
    const cleaned = sanitize(body).trim();
    const text = decodeEntities(cleaned.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (text.length < 20)
        throw new Error('力扣公开题面内容不完整');
    return { title: decodeEntities(title).replace(/\s+/g, ' ').trim(), body: cleaned };
}
/** Fetches only a public statement page. No authentication, cookies, or editorial fallback is used. */
async function fetchPublicProblemStatement(platform, problemUrl, options = {}) {
    if (platform !== 'CF' && platform !== 'AT' && platform !== 'LC' && platform !== 'LG')
        throw new Error('暂不支持该平台的公开题面获取');
    const url = canonicalUrl(platform, problemUrl);
    const timeout = options.timeoutMs ?? 12_000;
    const maxBytes = options.maxBytes ?? 1_000_000;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_MS)
        throw new Error('题面获取超时设置无效');
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > MAX_BODY_BYTES)
        throw new Error('题面大小限制无效');
    try {
        const isLc = platform === 'LC';
        const endpoint = isLc ? `${url.protocol}//${url.hostname}/graphql/` : url.href;
        const request = isLc ? { method: 'POST', signal: AbortSignal.timeout(timeout), redirect: 'error', credentials: 'omit', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ query: LEETCODE_QUERY, variables: { titleSlug: url.pathname.split('/')[2] } }) } : { signal: AbortSignal.timeout(timeout), redirect: 'error', credentials: 'omit', headers: { accept: 'text/html' } };
        const response = await (options.fetcher ?? fetch)(endpoint, request);
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        if (isLc) {
            const payload = await boundedText(response, maxBytes);
            let parsed;
            try {
                parsed = JSON.parse(payload);
            }
            catch {
                throw new Error('力扣 GraphQL 响应格式无效');
            }
            const statement = leetCodePayload(parsed);
            return { platform, url: url.href, title: statement.title, statementHtml: statement.body, statementText: decodeEntities(statement.body.replace(/<br\s*\/?>(?=\s*)/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() };
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (!/^text\/html\b/i.test(contentType))
            throw new Error('平台返回内容不是 HTML 题面');
        const html = await boundedText(response, maxBytes);
        if (platform === 'LG')
            return luoguStatement(html, url);
        const statement = extract(platform, html);
        return { platform, url: url.href, title: statement.title, statementHtml: statement.body, statementText: decodeEntities(statement.body.replace(/<br\s*\/?>(?=\s*)/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() };
    }
    catch (error) {
        if (error instanceof Error && /^(题面|页面|平台|HTTP)/.test(error.message))
            throw error;
        throw new Error(`公开题面获取失败：${error instanceof Error ? error.message : '未知网络错误'}`);
    }
}
function parsePublicStatement(platform, problemUrl, html) {
    const url = canonicalUrl(platform, problemUrl);
    if (typeof html !== 'string' || !html.trim())
        throw new Error('题面页面为空');
    if (platform === 'LG')
        return luoguStatement(html, url);
    const statement = extract(platform, html);
    return { platform, url: url.href, title: statement.title, statementHtml: statement.body, statementText: decodeEntities(statement.body.replace(/<br\s*\/?>(?=\s*)/gi, '\n').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() };
}
