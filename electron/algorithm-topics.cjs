// Generated from src/main/algorithms/topics.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlgorithmTopics = exports.OVERRIDES_PATH = exports.TOPICS_PATH = void 0;
exports.normalizeInput = normalizeInput;
exports.builtinIndex = builtinIndex;
exports.validateOverrides = validateOverrides;
exports.parseOverrides = parseOverrides;
exports.validateTopics = validateTopics;
exports.parseTopics = parseTopics;
const node_crypto_1 = require("node:crypto");
// These paths are relative to the emitted electron/algorithm-topics.cjs module.
const BUILTINS = require('../ui/algorithm-tree.js');
const { hydrate } = require('../ui/algorithm-directory.js');
exports.TOPICS_PATH = 'algorithms/directory-additions.json';
exports.OVERRIDES_PATH = 'algorithms/directory-overrides.json';
const COLORS = new Set(['basic', 'beginner', 'intermediate', 'advanced', 'expert']);
const CUSTOM_ID = /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_SHA = /^[A-Za-z0-9_-]{1,200}$/;
const MAX_TOPICS = 5000;
const MAX_TOPICS_BYTES = 5000000;
// Fresh mutations read the full file through the Contents API.
const MAX_OVERRIDES_BYTES = 1000000;
const SYNTHETIC_PREFIX = 'algorithm-content-';
const TOPIC_FIELDS = ['parentId', 'label', 'fullLabel', 'kind', 'color', 'scope'];
const OVERRIDE_FIELDS = new Set(['id', 'label', 'fullLabel', 'color', 'scope', 'hidden']);
function inputFields(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('算法目录输入格式错误');
    return value;
}
function cleanText(value, name, max, optional = false) {
    if (optional && value === undefined)
        return '';
    if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value))
        throw new Error(`${name}必须是有效文本，不能包含控制字符`);
    const result = value.trim().replace(/\s+/g, ' ');
    if ((!optional && !result) || result.length > max)
        throw new Error(`${name}长度须为${optional ? '0' : '1'}-${max}个字符`);
    return result;
}
function normalizeInput(value) {
    const fields = inputFields(value);
    const parentId = cleanText(fields.parentId, '父分类标识', 200);
    const label = cleanText(fields.label, '简短标题', 80);
    const fullLabel = cleanText(fields.fullLabel, '完整标题', 200);
    const scope = cleanText(fields.scope, '学习范围', 2000, true);
    const kind = fields.kind === undefined ? 'algorithm' : fields.kind;
    if (kind !== 'directory' && kind !== 'algorithm')
        throw new Error('节点类型必须是目录或算法');
    const color = fields.color;
    if (kind === 'algorithm' && (typeof color !== 'string' || !COLORS.has(color)))
        throw new Error('算法难度必须是D1-D5对应的有效等级');
    if (kind === 'directory' && color !== undefined && color !== 'parent')
        throw new Error('目录不设置算法难度');
    const requestId = fields.requestId === undefined ? undefined : cleanText(fields.requestId, '请求标识', 100);
    if (requestId !== undefined && !/^[A-Za-z0-9._:-]+$/.test(requestId))
        throw new Error('请求标识格式错误');
    return { parentId, label, fullLabel, kind, color: kind === 'directory' ? 'parent' : color, scope, ...(requestId ? { requestId } : {}) };
}
function isLeaf(node) {
    return node?.kind === 'algorithm' && node.children.length === 0;
}
function builtinLeafId(id, bundled) {
    // A temporary split adds an algorithm-content prefix to the same bundled content.
    // Begin with the full ID because physically bundled content IDs can share this prefix.
    let candidate = id;
    while (true) {
        const node = bundled.get(candidate);
        if (node)
            return node.id === candidate && node.parentId !== null && isLeaf(node) ? candidate : undefined;
        if (!candidate.startsWith(SYNTHETIC_PREFIX))
            return undefined;
        candidate = candidate.slice(SYNTHETIC_PREFIX.length);
    }
}
function topicSelection(fields, bundled) {
    const { id } = fields;
    if (typeof id !== 'string' || id.length > 1000)
        throw new Error('算法目录节点标识无效');
    const overrideId = CUSTOM_ID.test(id) ? undefined : builtinLeafId(id, bundled);
    if (!CUSTOM_ID.test(id) && !overrideId)
        throw new Error('只能修改或删除已添加的算法目录节点或内置算法叶节点');
    const expected = inputFields(fields.expected);
    const { parentId, label, fullLabel, kind, color, scope } = expected;
    if (typeof parentId !== 'string' || typeof label !== 'string' || typeof fullLabel !== 'string' ||
        (kind !== 'directory' && kind !== 'algorithm') || typeof color !== 'string' || typeof scope !== 'string') {
        throw new Error('需要完整的算法目录原始字段，请先同步');
    }
    return { id, expected: { parentId, label, fullLabel, kind, color, scope }, overrideId };
}
function sameTopicFields(a, b) {
    return TOPIC_FIELDS.every(key => a[key] === b[key]);
}
function builtinIndex(tree = BUILTINS, topics = [], overrides = []) {
    const index = new Map();
    function visit(node, depth, parentId = null) {
        const { id, label, fullLabel, kind, color, scope = '', children } = node;
        const entry = { id, label, fullLabel, kind, color, scope, parentId, depth, children };
        index.set(id, entry);
        for (const alias of node.legacyIds || [])
            index.set(alias, entry);
        for (const child of children)
            visit(child, depth + 1, id);
    }
    visit(hydrate(tree, topics, overrides), 0);
    return index;
}
function normalizeOverrideFields(fields) {
    const label = cleanText(fields.label, '简短标题', 80);
    const fullLabel = cleanText(fields.fullLabel, '完整标题', 200);
    if (typeof fields.scope !== 'string')
        throw new Error('学习范围必须是有效文本');
    const scope = cleanText(fields.scope, '学习范围', 2000, true);
    const { color } = fields;
    if (typeof color !== 'string' || (!COLORS.has(color) && color !== 'unrated'))
        throw new Error('内置算法难度必须是D1-D5或未分级');
    return { label, fullLabel, color, scope };
}
function validateOverrides(value, tree = BUILTINS) {
    if (!Array.isArray(value) || value.length > MAX_TOPICS)
        throw new Error('内置算法覆盖配置格式错误或条目过多');
    const bundled = builtinIndex(tree), seen = new Set();
    return value.map((raw) => {
        const fields = inputFields(raw);
        const { id } = fields;
        const target = typeof id === 'string' ? bundled.get(id) : undefined;
        if (typeof id !== 'string' || !isLeaf(target) || target.id !== id || target.parentId === null || seen.has(id)) {
            throw new Error('内置算法覆盖配置包含无效或重复的内置算法叶节点标识');
        }
        if (Object.keys(fields).some(key => !OVERRIDE_FIELDS.has(key)) || (Object.hasOwn(fields, 'hidden') && fields.hidden !== true)) {
            throw new Error('内置算法覆盖配置包含无效字段');
        }
        const changes = normalizeOverrideFields(fields);
        if (!Object.entries(changes).every(([key, field]) => fields[key] === field))
            throw new Error('内置算法覆盖配置包含未规范化的文本');
        seen.add(id);
        return { id, ...changes, ...(fields.hidden === true ? { hidden: true } : {}) };
    });
}
function parseOverrides(text, tree = BUILTINS) {
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_OVERRIDES_BYTES)
        throw new Error('内置算法覆盖配置文件过大');
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new Error('内置算法覆盖配置JSON无法解析');
    }
    const fields = inputFields(value);
    if (fields.schema !== 1 || Object.keys(fields).some(key => key !== 'schema' && key !== 'overrides')) {
        throw new Error('内置算法覆盖配置版本或格式不受支持');
    }
    return validateOverrides(fields.overrides, tree);
}
function validateTopics(value, tree = BUILTINS) {
    if (!Array.isArray(value) || value.length > MAX_TOPICS)
        throw new Error('共享算法目录格式错误或条目过多');
    const builtins = builtinIndex(tree), custom = new Map();
    const topics = value.map(raw => {
        const fields = raw;
        if (!raw || !CUSTOM_ID.test(fields.id) || builtins.has(fields.id) || custom.has(fields.id))
            throw new Error('共享算法目录包含无效或重复节点标识');
        const normalized = normalizeInput(raw);
        if (!Number.isSafeInteger(fields.createdBy?.id) || fields.createdBy.id < 1 || typeof fields.createdBy.login !== 'string' || !fields.createdBy.login.trim())
            throw new Error('共享算法目录缺少创建者记录');
        if (typeof fields.createdAt !== 'string' || !Number.isFinite(Date.parse(fields.createdAt)))
            throw new Error('共享算法目录缺少创建时间');
        const topic = { id: fields.id, ...normalized, createdAt: fields.createdAt, createdBy: { id: fields.createdBy.id, login: fields.createdBy.login } };
        custom.set(topic.id, topic);
        return topic;
    });
    for (const topic of topics)
        topic.parentId = builtins.get(topic.parentId)?.id || topic.parentId;
    // Synthetic content nodes depend on the algorithm they were split from. Follow
    // that ownership as well as ordinary parents before hydrating any stored graph.
    for (const topic of topics) {
        const seen = new Set([topic.id]);
        let cursor = topic.parentId, depth = 0;
        while (!builtins.has(cursor)) {
            if (seen.has(cursor))
                throw new Error('共享算法目录存在循环父子关系');
            seen.add(cursor);
            if (custom.has(cursor))
                cursor = custom.get(cursor).parentId;
            else if (cursor.startsWith(SYNTHETIC_PREFIX))
                cursor = cursor.slice(SYNTHETIC_PREFIX.length);
            else
                throw new Error('共享算法目录包含不存在的父分类');
            if (++depth > 64)
                throw new Error('共享算法目录层级过深');
        }
    }
    const effective = builtinIndex(tree, topics), requests = new Set();
    for (const topic of topics) {
        const parent = effective.get(topic.parentId), node = effective.get(topic.id);
        if (!parent || !node || node.parentId !== parent.id)
            throw new Error('共享算法目录包含不存在的父分类或无法解析的合成节点');
        if (node.depth > 64)
            throw new Error('共享算法目录层级过深');
        if (parent.children.some(child => child.id !== topic.id && child.label.toLocaleLowerCase() === topic.label.toLocaleLowerCase()))
            throw new Error('同一父分类下已存在该算法标题');
        if (topic.requestId) {
            const requestKey = `${topic.createdBy.id}:${topic.requestId}`;
            if (requests.has(requestKey))
                throw new Error('共享算法目录包含重复请求标识');
            requests.add(requestKey);
        }
    }
    return topics;
}
function parseTopics(text, tree = BUILTINS) {
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_TOPICS_BYTES)
        throw new Error('共享算法目录文件过大');
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        throw new Error('共享算法目录JSON无法解析');
    }
    const fields = value;
    if (!value || fields.schema !== 1)
        throw new Error('共享算法目录版本或格式不受支持');
    return validateTopics(fields.topics, tree);
}
function documentSha(document) {
    if (!document)
        return null;
    if (typeof document.sha !== 'string' || !FILE_SHA.test(document.sha))
        throw new Error('无法确认当前算法目录文件SHA，请先同步');
    return document.sha;
}
function algorithmLeafId(id, index) {
    for (let node = index.get(id); node; node = index.get(`${SYNTHETIC_PREFIX}${node.id}`)) {
        if (isLeaf(node))
            return node.id;
    }
    return undefined;
}
class AlgorithmTopics {
    gh;
    tree;
    uuid;
    now;
    constructor(github, { tree = BUILTINS, uuid = node_crypto_1.randomUUID, now = () => new Date().toISOString() } = {}) { this.gh = github; this.tree = tree; this.uuid = uuid; this.now = now; }
    async current(branch) {
        const [catalog, overrides] = await Promise.all([
            this.gh.currentDocument(exports.TOPICS_PATH, branch),
            this.gh.currentDocument(exports.OVERRIDES_PATH, branch)
        ]);
        return {
            topics: catalog ? parseTopics(catalog.text, this.tree) : [],
            overrides: overrides ? parseOverrides(overrides.text, this.tree) : [],
            topicsSha: documentSha(catalog),
            overridesSha: documentSha(overrides)
        };
    }
    async writeContext() {
        if (!this.gh.token)
            throw new Error('请先登录 GitHub');
        // Never trust renderer or cached permission bits for shared directory modifications.
        const { data: userData } = await this.gh.request('/user');
        const user = userData;
        if (typeof user?.id !== 'number' || !Number.isSafeInteger(user.id) || user.id < 1 || typeof user.login !== 'string' || !user.login)
            throw new Error('无法确认GitHub登录用户身份');
        const { data: infoData } = await this.gh.request(`/repos/${this.gh.repo}`);
        const info = infoData;
        if (info?.permissions?.admin !== true)
            throw new Error('只有仓库管理员（admin）可以修改共享算法目录');
        if (typeof info.default_branch !== 'string' || !info.default_branch)
            throw new Error('仓库尚无默认分支，请先初始化仓库');
        return { branch: info.default_branch, user: { id: user.id, login: user.login } };
    }
    encode(document) {
        const text = JSON.stringify({ schema: 1, ...document }, null, 2) + '\n';
        const maxBytes = 'overrides' in document ? MAX_OVERRIDES_BYTES : MAX_TOPICS_BYTES;
        if (Buffer.byteLength(text, 'utf8') > maxBytes)
            throw new Error('共享算法目录文件过大');
        return text;
    }
    tag(topic) {
        return { ...topic, repo: this.gh.repo };
    }
    async write({ path, branch, sha, text, message }, requestId) {
        let response;
        try {
            response = await this.gh.request(this.gh.contentEndpoint(path), { method: 'PUT', body: JSON.stringify({ message, content: Buffer.from(text).toString('base64'), branch, ...(sha ? { sha } : {}) }) });
        }
        catch (error) {
            const status = error.status;
            if (status === 409 || status === 422) {
                const conflict = new Error('算法目录SHA冲突，请先同步后重试；远端内容未被覆盖', { cause: error });
                conflict.status = status;
                throw conflict;
            }
            throw error;
        }
        if (!response.data?.content?.sha)
            throw new Error(requestId ? '算法目录写入结果未知，请先同步核实；重试时保留同一请求标识' : '算法目录写入结果未知，请先同步核实');
    }
    replaceOverride(current, override) {
        return validateOverrides([...current.overrides.filter(item => item.id !== override.id), override], this.tree);
    }
    assertTitle(index, id) {
        const node = index.get(id);
        if (!node || node.parentId === null)
            throw new Error('算法目录包含已隐藏或无法解析的节点');
        const siblings = index.get(node.parentId)?.children || [];
        if (siblings.some(child => child.id !== id && child.label.toLocaleLowerCase() === node.label.toLocaleLowerCase()))
            throw new Error('同一父分类下已存在该算法标题');
    }
    async commitMutation(write, current, id, index, guard, removedIds = new Set()) {
        const { path, branch, sha } = write;
        const commit = await guard?.({ id, path, branch, sha, topicsSha: current.topicsSha, overridesSha: current.overridesSha, index, removedIds });
        if (commit)
            await commit(write);
        else if (path === exports.OVERRIDES_PATH)
            throw new Error('无法确认内置算法修改所依据的仓库提交，请先同步');
        else
            await this.write(write);
    }
    async save(input) {
        const clean = normalizeInput(input);
        const { branch, user } = await this.writeContext();
        const current = await this.current(branch);
        const index = builtinIndex(this.tree, current.topics, current.overrides);
        clean.parentId = index.get(clean.parentId)?.id || clean.parentId;
        const previous = clean.requestId && current.topics.find(topic => topic.createdBy.id === user.id && topic.requestId === clean.requestId);
        if (previous) {
            if (!sameTopicFields(previous, clean))
                throw new Error('同一请求标识已用于不同算法内容，请先同步确认');
            return { topic: this.tag(previous), topics: current.topics.map(topic => this.tag(topic)) };
        }
        if (!index.has(clean.parentId))
            throw new Error('共享算法目录包含不存在或已隐藏的父分类');
        const id = `custom-${this.uuid()}`;
        const topic = { id, ...clean, createdAt: this.now(), createdBy: user };
        const topics = validateTopics([...current.topics, topic], this.tree);
        if (current.overrides.length)
            this.assertTitle(builtinIndex(this.tree, topics, current.overrides), id);
        await this.write({ path: exports.TOPICS_PATH, branch, sha: current.topicsSha, text: this.encode({ topics }), message: `新增算法目录：${topic.label}` }, clean.requestId);
        return { topic: this.tag(topic), topics: topics.map(item => this.tag(item)) };
    }
    async update(input, guard) {
        const fields = inputFields(input), bundled = builtinIndex(this.tree);
        const { id, expected, overrideId } = topicSelection(fields, bundled);
        const { branch } = await this.writeContext();
        const current = await this.current(branch);
        const index = builtinIndex(this.tree, current.topics, current.overrides);
        if (overrideId) {
            const node = index.get(id);
            if (!isLeaf(node) || node.id !== id || !sameTopicFields(expected, node))
                throw new Error('算法目录节点已修改或删除，请先同步后重试');
            const override = { id: overrideId, ...normalizeOverrideFields(fields) };
            const overrides = this.replaceOverride(current, override);
            this.assertTitle(builtinIndex(this.tree, current.topics, overrides), id);
            await this.commitMutation({ path: exports.OVERRIDES_PATH, branch, sha: current.overridesSha, text: this.encode({ overrides }), message: `更新算法目录：${override.label}` }, current, id, index, guard);
            return { override, topics: current.topics.map(item => this.tag(item)), overrides };
        }
        const stored = current.topics.find(item => item.id === id);
        if (!stored || !sameTopicFields(expected, stored))
            throw new Error('算法目录节点已修改或删除，请先同步后重试');
        if (typeof fields.scope !== 'string')
            throw new Error('学习范围必须是有效文本');
        const changes = normalizeInput({ parentId: stored.parentId, kind: stored.kind, label: fields.label, fullLabel: fields.fullLabel, color: fields.color, scope: fields.scope });
        const topic = { ...stored, ...changes };
        const topics = validateTopics(current.topics.map(item => item === stored ? topic : item), this.tree);
        if (current.overrides.length)
            this.assertTitle(builtinIndex(this.tree, topics, current.overrides), id);
        await this.write({ path: exports.TOPICS_PATH, branch, sha: current.topicsSha, text: this.encode({ topics }), message: `更新算法目录：${topic.label}` });
        return { topic: this.tag(topic), topics: topics.map(item => this.tag(item)), overrides: current.overrides };
    }
    async remove(input, guard) {
        const { id, expected, overrideId } = topicSelection(inputFields(input), builtinIndex(this.tree));
        const { branch } = await this.writeContext();
        const current = await this.current(branch);
        const index = builtinIndex(this.tree, current.topics, current.overrides);
        const node = index.get(id);
        const stored = overrideId ? node : current.topics.find(item => item.id === id);
        if (!node || !stored || !sameTopicFields(expected, stored))
            throw new Error('算法目录节点已修改或删除，请先同步后重试');
        if (node.children.length || (overrideId && !isLeaf(node)))
            throw new Error('算法目录节点仍有子节点或合成内容，无法删除');
        const topics = overrideId ? current.topics : validateTopics(current.topics.filter(item => item !== stored), this.tree);
        const { label, fullLabel, color, scope } = node;
        const overrides = overrideId ? this.replaceOverride(current, { id: overrideId, label, fullLabel, color, scope, hidden: true }) : current.overrides;
        const remaining = builtinIndex(this.tree, topics, overrides);
        if (topics.some(topic => typeof topic.id !== 'string' || !remaining.has(topic.id)))
            throw new Error('算法目录节点仍有子节点或合成内容，无法删除');
        // A split content leaf may disappear during a deletion even when its wrapper remains.
        const removedIds = new Set();
        for (const key of index.keys()) {
            if (!remaining.has(key) || (overrideId && algorithmLeafId(key, index) === id && !algorithmLeafId(key, remaining)))
                removedIds.add(key);
        }
        const write = overrideId ? { path: exports.OVERRIDES_PATH, sha: current.overridesSha, text: this.encode({ overrides }) } : { path: exports.TOPICS_PATH, sha: current.topicsSha, text: this.encode({ topics }) };
        await this.commitMutation({ ...write, branch, message: `删除算法目录：${label}` }, current, id, index, guard, removedIds);
        return { topics: topics.map(item => this.tag(item)), overrides };
    }
}
exports.AlgorithmTopics = AlgorithmTopics;
