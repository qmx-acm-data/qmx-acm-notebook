import * as YAML from 'yaml';
import { createHash } from 'node:crypto';
import type { AlgorithmNodeContent } from '../../shared/models/algorithm-node-content.js';
const { ROADMAP_DIRECTORY_IDS } = require('./algorithm-node-content-model.cjs') as typeof import('../../shared/models/algorithm-node-content.js');
const { isTrickTier, trickTiers } = require('./trick-model.cjs') as typeof import('../../shared/models/trick.js');
import type { LearningGateContent, LearningPracticeList } from '../../shared/models/learning-content.js';
import type { CurriculumGateLayout, CurriculumLayout, LearningCurriculumDocument } from '../../shared/models/learning-curriculum.js';
import type { AlgorithmDirectoryNode, AlgorithmDirectoryOverride } from '../../shared/models/algorithm-directory.js';
import type { AlgorithmTopic, TopicIndexEntry } from '../algorithms/contracts.js';
import { Buffer } from 'node:buffer';
import type { AlgorithmTopicsModule, ContentFields, ErrorFields, Fetcher, Fields, GitHubOptions, GraphQLDataFields, GraphQLFields, IssueFields, PermissionFields, RepositoryFields, RequestOptions, RequestResult, SyncInput, TagsModule, TreeEntry, TreeFields, UserFields, WriteFields } from './contracts.js';
const { Tags } = require('./tags.cjs') as TagsModule;
const { AlgorithmTopics, TOPICS_PATH, OVERRIDES_PATH, parseTopics, parseOverrides } = require('./algorithm-topics.cjs') as AlgorithmTopicsModule;

const API = 'https://api.github.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LEARNING_GATES_PREFIX = 'algorithms/learning-path/gates/';
// Relative to emitted electron/github.cjs; only the validated formal curriculum may define identities.
const learningCurriculum = require('../ui/algorithm-learning-path-data.js') as { stages: { id: string; sections: { id: string; scope: string; routeId: string | null }[]; gates: { id: string }[] }[] };
const learningGateIds = new Set(learningCurriculum.stages.flatMap(stage => stage.gates.map(gate => gate.id)));
const customGateId = /^custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const LEARNING_CURRICULUM_PATH = 'algorithms/learning-path/curriculum.json';
const builtinTopics = require('../ui/algorithm-tree.js') as AlgorithmDirectoryNode;
const { builtinIndex: curriculumTopicIndex } = require('./algorithm-topics.cjs') as typeof import('../algorithms/topics.cjs');
export const ALGORITHM_NODE_CONTENT_PREFIX = 'algorithms/node-content/';
const roadmapContentIds = new Set<string>(ROADMAP_DIRECTORY_IDS.map(id => `roadmap:${id}`));
/** Public introduction targets include approved roadmap directories; note targets remain leaf-only. */
export function algorithmContentTargetId(value: unknown, topics: readonly AlgorithmTopic[] = [], overrides: readonly AlgorithmDirectoryOverride[] = []): string | null {
  return typeof value === 'string' && roadmapContentIds.has(value) ? value : canonicalAlgorithmLeafId(value, topics, overrides);
}
function contentTargetFromIndex(value: unknown, index: ReadonlyMap<string, TopicIndexEntry>): string | null {
  return typeof value === 'string' && roadmapContentIds.has(value) ? value : leafIdFromIndex(value, index);
}
export function algorithmNodeContentPath(nodeId: string): string {
  return `${ALGORITHM_NODE_CONTENT_PREFIX}${createHash('sha256').update(nodeId, 'utf8').digest('hex')}.json`;
}
/** Resolve historic aliases and split algorithms, but never treat a physical branch as a leaf. */
export function canonicalAlgorithmLeafId(value: unknown, topics: readonly AlgorithmTopic[] = [], overrides: readonly AlgorithmDirectoryOverride[] = []): string | null {
  return leafIdFromIndex(value, curriculumTopicIndex(builtinTopics, [...topics], overrides));
}
function leafIdFromIndex(value: unknown, index: ReadonlyMap<string, TopicIndexEntry>): string | null {
  if (typeof value !== 'string') return null;
  let node = index.get(value); const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    if (!node.children.length && node.kind === 'algorithm') return node.id;
    node = index.get(`algorithm-content-${node.id}`);
  }
  return null;
}
function algorithmNodeContentFields(value: unknown) {
  const fields = learningFields(value);
  const nodeId = learningText(fields.nodeId, '算法叶节点标识', 1000);
  if (typeof fields.introduction !== 'string' || Buffer.byteLength(fields.introduction, 'utf8') > 100000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(fields.introduction)) throw new Error('算法介绍必须是100000字节以内的Markdown文本');
  if (!Array.isArray(fields.featuredNotePaths) || fields.featuredNotePaths.length > 100) throw new Error('精选笔记须为0-100项');
  const featuredNotePaths = fields.featuredNotePaths.map(path => {
    validatePath(path);
    if (typeof path !== 'string' || !/^algorithms\/notes\/(?:public\/|personal\/[1-9]\d*\/)[^/]+\.md$/.test(path)) throw new Error('精选笔记路径无效');
    return path;
  });
  if (new Set(featuredNotePaths).size !== featuredNotePaths.length) throw new Error('精选笔记路径不能重复');
  if (nodeId.startsWith('roadmap:') && (!roadmapContentIds.has(nodeId) || featuredNotePaths.length)) throw new Error('路线目录只能保存介绍，不能关联笔记');
  return { nodeId, introduction: fields.introduction, featuredNotePaths };
}
export function parseAlgorithmNodeContent(value: unknown, sha: unknown): AlgorithmNodeContent {
  const fields = learningFields(value), clean = algorithmNodeContentFields(fields), author = learningFields(fields.author);
  if (fields.schema !== 1) throw new Error('算法节点内容版本不受支持');
  if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('算法节点内容缺少有效SHA');
  if (!Number.isSafeInteger(author.id) || (author.id as number) < 1) throw new Error('算法节点内容缺少可信作者');
  if (typeof fields.updatedAt !== 'string' || !Number.isFinite(Date.parse(fields.updatedAt))) throw new Error('算法节点内容缺少有效更新时间');
  for (const path of clean.featuredNotePaths) {
    const owner = /^algorithms\/notes\/personal\/([1-9]\d*)\//.exec(path)?.[1];
    if (owner && owner !== String(author.id)) throw new Error('算法节点内容不能引用作者以外账号的个人笔记');
  }
  const storageNodeId = fields.storageNodeId === undefined ? undefined : learningText(fields.storageNodeId, '算法内容存储标识', 1000);
  const result = { ...clean, ...(storageNodeId === undefined ? {} : { storageNodeId }), sha, updatedAt: fields.updatedAt, author: { id: author.id as number, login: learningText(author.login, '作者', 100) } };
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 1000000) throw new Error('算法节点内容文件过大');
  return result;
}
export function parseAlgorithmNodeContentText(text: unknown, sha: unknown): AlgorithmNodeContent {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 1000000) throw new Error('算法节点内容文件过大');
  let value: unknown; try { value = JSON.parse(text); } catch { throw new Error('算法节点内容JSON无法解析'); }
  return parseAlgorithmNodeContent(value, sha);
}
export function learningCurriculumGateIds(document: LearningCurriculumDocument | null): Set<string> {
  return document ? new Set(document.layout.stages.flatMap(stage => stage.gates.map(gate => gate.id))) : new Set(learningGateIds);
}
export function validateLearningCurriculumLayout(value: unknown, topics: readonly AlgorithmTopic[] = [], overrides: readonly AlgorithmDirectoryOverride[] = []): CurriculumLayout {
  const fields = learningFields(value);
  if (!Array.isArray(fields.stages) || fields.stages.length !== learningCurriculum.stages.length) throw new Error('公共课程必须包含全部正式章节');
  const seenStages = new Set<string>(), seenGates = new Set<string>();
  const topicIds = new Set(curriculumTopicIndex(builtinTopics, [...topics], overrides).keys());
  const stages = fields.stages.map(raw => {
    const stage = learningFields(raw), id = learningText(stage.id, '章节标识', 200);
    const builtin = learningCurriculum.stages.find(item => item.id === id);
    if (!builtin || seenStages.has(id)) throw new Error('公共课程章节标识无效或重复');
    seenStages.add(id);
    if (!Array.isArray(stage.gates) || !stage.gates.length || stage.gates.length > 100) throw new Error('每章关卡须为1-100项');
    const gates = stage.gates.map(rawGate => {
      const gate = learningFields(rawGate), gateId = learningText(gate.id, '关卡标识', 200);
      const builtinGate = learningGateIds.has(gateId);
      if ((!builtinGate && !customGateId.test(gateId)) || seenGates.has(gateId)) throw new Error('公共课程关卡标识无效或重复');
      if (builtinGate && !builtin.gates.some(item => item.id === gateId)) throw new Error('正式关卡不能移动到其他章节');
      seenGates.add(gateId);
      if (seenGates.size > 1000) throw new Error('公共课程关卡总数不能超过1000');
      const sectionId = learningText(gate.sectionId, '学习段标识', 200), section = builtin.sections.find(item => item.id === sectionId);
      if (!section) throw new Error('学习段必须属于当前正式章节');
      if (gate.kind !== 'learning' && gate.kind !== 'mixed' && gate.kind !== 'challenge') throw new Error('关卡类型无效');
      if (gate.scope !== 'core' && gate.scope !== 'recommended' && gate.scope !== 'elective' && gate.scope !== 'route') throw new Error('关卡范围无效');
      if (gate.scope === 'route' && (section.scope !== 'route' || !section.routeId)) throw new Error('路线关卡必须属于正式路线学习段');
      const clean: CurriculumGateLayout = { id: gateId, title: learningText(gate.title, '关卡标题', 160), kind: gate.kind, sectionId, scope: gate.scope };
      if (builtinGate) {
        if (gate.description !== undefined || gate.goals !== undefined || gate.topicIds !== undefined) throw new Error('正式关卡布局不能覆盖学习内容');
      } else {
        clean.description = learningText(gate.description, '关卡说明', 6000, true);
        if (!Array.isArray(gate.goals) || !gate.goals.length || gate.goals.length > 20) throw new Error('学习目标须为1-20项');
        clean.goals = gate.goals.map(goal => learningText(goal, '学习目标', 500));
        if (clean.goals.join('\n').length > 6000) throw new Error('学习目标总长度不能超过6000字符');
        if (!Array.isArray(gate.topicIds) || gate.topicIds.length > 20) throw new Error('关联算法须为0-20项');
        clean.topicIds = gate.topicIds.map(topic => {
          const topicId = learningText(topic, '关联算法标识', 200);
          if (!topicIds.has(topicId)) throw new Error('关联算法标识不存在');
          return topicId;
        });
      }
      return clean;
    });
    return { id, title: learningText(stage.title, '章节标题', 160), gates };
  });
  return { stages };
}
export function parseLearningCurriculumContent(value: unknown, sha: unknown, topics: readonly AlgorithmTopic[] = [], overrides: readonly AlgorithmDirectoryOverride[] = []): LearningCurriculumDocument {
  const fields = learningFields(value), author = learningFields(fields.author);
  if (fields.schema !== 1) throw new Error('公共课程版本不受支持');
  if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('公共课程缺少有效SHA');
  if (!Number.isSafeInteger(author.id) || (author.id as number) < 1) throw new Error('公共课程缺少可信作者');
  if (typeof fields.updatedAt !== 'string' || !Number.isFinite(Date.parse(fields.updatedAt))) throw new Error('公共课程缺少有效更新时间');
  const result = { layout: validateLearningCurriculumLayout(fields.layout, topics, overrides), sha, updatedAt: fields.updatedAt, author: { id: author.id as number, login: learningText(author.login, '作者', 100) } };
  if (Buffer.byteLength(JSON.stringify({ schema: 1, layout: result.layout, updatedAt: result.updatedAt, author: result.author }), 'utf8') > 1000000) throw new Error('公共课程文件过大');
  return result;
}
export function parseLearningCurriculumText(text: unknown, sha: unknown, topics: readonly AlgorithmTopic[] = [], overrides: readonly AlgorithmDirectoryOverride[] = []): LearningCurriculumDocument {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 1000000) throw new Error('公共课程文件过大');
  let value: unknown; try { value = JSON.parse(text); } catch { throw new Error('公共课程JSON无法解析'); }
  return parseLearningCurriculumContent(value, sha, topics, overrides);
}
function learningFields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('公共关卡内容格式错误');
  return value as Record<string, unknown>;
}
function learningText(value: unknown, name: string, max: number, multiline = false): string {
  if (typeof value !== 'string' || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value)) throw new Error(`${name}必须是有效文本`);
  const clean = value.trim(); if (!clean || clean.length > max) throw new Error(`${name}长度须为1-${max}个字符`); return clean;
}
function learningContentFields(value: unknown) {
  const fields = learningFields(value);
  const gateId = learningText(fields.gateId, '关卡标识', 200);
  if (!learningGateIds.has(gateId) && !customGateId.test(gateId)) throw new Error('关卡标识不在正式学习路径中');
  const description = learningText(fields.description, '关卡说明', 6000, true);
  if (!Array.isArray(fields.goals) || !fields.goals.length || fields.goals.length > 20) throw new Error('学习目标须为1-20项');
  const goals = fields.goals.map(goal => learningText(goal, '学习目标', 500));
  if (goals.join('\n').length > 6000) throw new Error('学习目标总长度不能超过6000字符');
  let practiceList: LearningPracticeList | null = null;
  if (fields.practiceList !== null) {
    const practice = learningFields(fields.practiceList), title = learningText(practice.title, '题单标题', 120), raw = learningText(practice.url, '题单链接', 2000);
    let url: URL; try { url = new URL(raw); } catch { throw new Error('题单链接必须是有效HTTP或HTTPS地址'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[\u0000-\u0020\u007f\\]/.test(raw)) throw new Error('题单链接必须是有效HTTP或HTTPS地址，且不能包含凭据');
    practiceList = { title, url: url.href };
  }
  return { gateId, description, goals, practiceList };
}
export function parseLearningGateContent(value: unknown, expectedId: string, sha: unknown): LearningGateContent {
  const fields = learningFields(value), content = learningContentFields(value), author = learningFields(fields.author);
  if (fields.schema !== 1 || content.gateId !== expectedId) throw new Error('公共关卡版本或文件标识不匹配');
  if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('公共关卡缺少有效SHA');
  if (!Number.isSafeInteger(author.id) || (author.id as number) < 1) throw new Error('公共关卡缺少可信作者');
  const login = learningText(author.login, '作者', 100);
  if (typeof fields.updatedAt !== 'string' || !Number.isFinite(Date.parse(fields.updatedAt))) throw new Error('公共关卡缺少有效更新时间');
  return { ...content, sha, updatedAt: fields.updatedAt, author: { id: author.id as number, login } };
}
export function parseLearningGateText(text: unknown, expectedId: string, sha: unknown): LearningGateContent {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 64000) throw new Error('公共关卡文件过大');
  let value: unknown; try { value = JSON.parse(text); } catch { throw new Error('公共关卡JSON无法解析'); }
  return parseLearningGateContent(value, expectedId, sha);
}

export function normalizeServerUrl(value: unknown = '') {
  if (typeof value !== 'string') throw new Error('Git 服务地址格式不正确');
  const text = value.trim();
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch { throw new Error('Git 服务地址格式不正确'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || /[\u0000-\u0020\u007f\\]/.test(text)) throw new Error('Git 服务地址格式不正确');
  const base = url.origin + url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  return ['https://github.com', API].includes(base) ? '' : base;
}
export function repositoryKey(repo: string, serverUrl: unknown = '') { return `${normalizeServerUrl(serverUrl) || API}|${repo.toLowerCase()}`; }

export function repoParts(repo: string) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('仓库格式应为 owner/repo');
  return repo.split('/');
}

const { identify, frontmatter, authorId, parseDocument, issueRecord, issueBody, documentContent, validatePath, parseAlgorithmNote, samePayload } = require('./record-parser.cjs') as typeof import('../records/parser.cjs');

const TRICK_PATH = /^tricks\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.md$/;
type Trick = import('../../shared/models/trick.js').Trick;
type TrickRecommendation = import('../../shared/models/trick.js').TrickRecommendation;
const TRICK_PREREQUISITE_ID = /^[\p{L}\p{N}._:-]{1,1000}$/u;
function validateTrickRecommendation(value: unknown): TrickRecommendation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Trick推荐格式无效');
  const { tier, prerequisiteIds, reason } = value as Fields;
  if (!isTrickTier(tier)) throw new Error(`Trick推荐等级必须是 ${trickTiers.join('、')} 之一`);
  if (typeof reason !== 'string' || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(reason)) throw new Error('Trick推荐理由必须为单行文本');
  const cleanReason = trickText(reason.trim(), 'Trick推荐理由', 600, true);
  if (!Array.isArray(prerequisiteIds) || prerequisiteIds.length > 8) throw new Error('Trick推荐前置算法须为0-8项');
  const ids: string[] = [];
  for (const id of prerequisiteIds as unknown[]) {
    if (typeof id !== 'string' || !TRICK_PREREQUISITE_ID.test(id)) throw new Error('Trick推荐前置算法标识无效');
    ids.push(id);
  }
  if (new Set(ids).size !== ids.length) throw new Error('Trick推荐前置算法不能重复');
  return { tier, prerequisiteIds: ids, reason: cleanReason };
}
function readTrickRecommendation(value: unknown): TrickRecommendation | undefined {
  try { return validateTrickRecommendation(value); } catch { return undefined; }
}
function sameTrickRecommendation(a: TrickRecommendation | undefined, b: TrickRecommendation | undefined): boolean {
  return a === b || !!a && !!b && a.tier === b.tier && a.reason === b.reason &&
    a.prerequisiteIds.length === b.prerequisiteIds.length && a.prerequisiteIds.every((id, i) => id === b.prerequisiteIds[i]);
}
function trickText(value: unknown, label: string, maxBytes: number, required = false): string {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > maxBytes || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) || required && !value.trim()) throw new Error(`${label}格式不正确或超过${maxBytes}字节`);
  return value;
}
export function validateTrickPath(value: unknown): string {
  if (typeof value !== 'string' || !TRICK_PATH.test(value)) throw new Error('Trick路径必须为 tricks/<UUID>.md');
  return value;
}
function parseTrickFile(path: unknown, text: unknown, sha: unknown, scope: import('../../shared/models/bootstrap.js').SourceScope): { trick: Trick; rawRecommendation: unknown; invalidRecommendation: boolean } {
  const safePath = validateTrickPath(path);
  if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('Trick缺少有效SHA');
  const { meta, body } = frontmatter(text, true);
  if (meta.schema !== 1 || meta.kind !== 'trick') throw new Error('Trick元数据schema/kind无效');
  const owner = authorId(meta.authorId);
  if (!owner || typeof meta.author !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(meta.author)) throw new Error('Trick作者无效');
  if (typeof meta.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(meta.updatedAt) || !Number.isFinite(Date.parse(meta.updatedAt))) throw new Error('Trick更新时间无效');
  const title = trickText(meta.title, 'Trick标题', 600, true).trim();
  const introduction = trickText(meta.introduction, 'Trick简介', 6000, true);
  trickText(body, 'Trick正文', 1000000, true);
  const clientId = TRICK_PATH.exec(safePath)![1];
  const rawRecommendation = meta.recommendation;
  const recommendation = readTrickRecommendation(rawRecommendation);
  return {
    trick: { id: `trick:${safePath}`, kind: 'trick', clientId, path: safePath, sha, title, introduction, body, authorId: owner, author: { id: owner, login: meta.author }, updatedAt: meta.updatedAt, ...scope, ...(recommendation ? { recommendation } : {}) },
    rawRecommendation,
    invalidRecommendation: Object.hasOwn(meta, 'recommendation') && !recommendation,
  };
}
/** Invalid optional review metadata does not make the underlying Trick unreadable. */
export function parseTrick(path: unknown, text: unknown, sha: unknown, scope: import('../../shared/models/bootstrap.js').SourceScope): Trick {
  return parseTrickFile(path, text, sha, scope).trick;
}
export function cachedTrick(value: unknown, scope: import('../../shared/models/bootstrap.js').SourceScope): Trick | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Fields;
  if (item.repo !== scope.repo || item.sourceKey !== scope.sourceKey || item.serverUrl !== scope.serverUrl || item.kind !== 'trick') return null;
  const author = item.author && typeof item.author === 'object' && !Array.isArray(item.author) ? item.author as Fields : null;
  if (!author || author.id !== item.authorId) return null;
  try {
    const text = `---\n${YAML.stringify({ schema: 1, kind: 'trick', title: item.title, introduction: item.introduction, authorId: item.authorId, author: author.login, updatedAt: item.updatedAt })}---\n${typeof item.body === 'string' ? item.body : ''}`;
    const parsed = parseTrick(item.path, text, item.sha, scope);
    if (item.id !== parsed.id || item.clientId !== parsed.clientId) return null;
    const recommendation = readTrickRecommendation(item.recommendation);
    return recommendation ? { ...parsed, recommendation } : parsed;
  } catch { return null; }
}

export class GitHub {
  declare repo: string;
  declare serverUrl: string;
  declare token: string;
  declare fetcher: Fetcher;
  constructor({ token = '', repo = 'qmx-acm-data/2026', fetcher = fetch, serverUrl = '' }: GitHubOptions = {}) {
    repoParts(repo);
    this.repo = repo;
    this.serverUrl = normalizeServerUrl(serverUrl);
    // GitHub OAuth credentials are valid only at GitHub. Custom Gitea sources are public reads.
    this.token = this.serverUrl ? '' : token;
    this.fetcher = fetcher;
  }

  apiUrl(path: string) { return (this.serverUrl ? this.serverUrl + '/api/v1' : API) + path; }

  async request(path: string, opts: RequestOptions = {}): Promise<RequestResult> {
    if (this.serverUrl && opts.method && opts.method !== 'GET') throw new Error('自定义 Gitea 目前仅支持匿名读取公开仓库');
    const headers = new Headers({
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'QMX-Notebook',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...opts.headers,
    });
    headers.delete('Authorization');
    if (this.token && !this.serverUrl) headers.set('Authorization', `Bearer ${this.token}`);
    let r;
    try {
      r = await this.fetcher(this.apiUrl(path), {
        ...opts,
        headers: { ...Object.fromEntries([...headers].filter(([name]) => name !== 'authorization')), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
        credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(25000),
      });
    } catch (error) {
      if (opts.method && opts.method !== 'GET') throw new Error('GitHub 写入结果未知（网络中断或超时）；请先同步确认结果，不要重复创建文档。', { cause: error });
      throw new Error('GitHub 请求超时或网络中断，请同步后重试', { cause: error });
    }
    const data: unknown = await r.json().catch(() => ({}));
    const details = data as { message?: unknown };
    if (!r.ok) {
      let message;
      if (r.status === 401) message = 'GitHub 登录已失效，请重新授权';
      else if (r.status === 403 || r.status === 429) {
        const reset = r.headers.get('x-ratelimit-reset');
        message = (details.message as string | null | undefined)?.includes('rate limit')
          ? `GitHub 请求额度已用完${reset ? '，预计 ' + new Date(Number(reset) * 1000).toLocaleTimeString() + ' 恢复' : ''}，缓存仍可使用`
          : 'GitHub 拒绝操作，请检查仓库写入权限、默认分支保护规则、授权范围或组织 OAuth 策略';
      } else if (r.status === 404) message = '找不到仓库或内容，也可能没有访问权限';
      else if (r.status === 409 || r.status === 422) message = `GitHub 内容冲突，请先同步后再编辑：${details.message || '文件已变化'}`;
      else message = `GitHub ${r.status}：${details.message || '请求失败'}`;
      const error: Error & { status?: number } = new Error(message);
      error.status = r.status;
      throw error;
    }
    return { data, link: r.headers.get('link') || '' };
  }

  async pages(path: string, max = 100) {
    const all: unknown[] = [];
    for (let page = 1; page <= max; page++) {
      const { data, link } = await this.request(`${path}${path.includes('?') ? '&' : '?'}${this.serverUrl ? 'limit' : 'per_page'}=100&page=${page}`);
      if (!Array.isArray(data)) throw new Error('GitHub 返回了意外的数据格式');
      all.push(...data);
      if (!link.includes('rel="next"') && (!this.serverUrl || data.length < 100)) return all;
    }
    throw new Error('数据量超过单次同步上限，请缩小仓库范围');
  }

  async identity() {
    if (!this.token) throw new Error('请先登录 GitHub');
    const { data: userData } = await this.request('/user');
    const user = userData as UserFields;
    if (!authorId(user.id) || !user.login) throw new Error('无法确认 GitHub 登录用户身份，请重新登录');
    return { account: { id: user.id, login: user.login, name: user.name || user.login, avatarUrl: user.avatar_url || '' } };
  }

  async profile() {
    if (!this.token) throw new Error('请先登录 GitHub');
    const { data: userData } = await this.request('/user');
    const user = userData as UserFields;
    if (!authorId(user.id) || !user.login) throw new Error('无法确认 GitHub 登录用户身份，请重新登录');
    const { data: infoData } = await this.request(`/repos/${this.repo}`);
    const info = infoData as RepositoryFields;
    return {
      account: { id: user.id, login: user.login, name: user.name || user.login, avatarUrl: user.avatar_url || '' },
      permissions: { push: Boolean((info.permissions as PermissionFields | null | undefined)?.push || (info.permissions as PermissionFields | null | undefined)?.admin), admin: Boolean((info.permissions as PermissionFields | null | undefined)?.admin), repo: this.repo },
    };
  }

  checkScope(input: unknown) {
    const record = input as Fields;
    if (record.repo !== undefined && (typeof record.repo !== 'string' || record.repo.toLowerCase() !== this.repo.toLowerCase())) {
      throw new Error('文档所属仓库与当前仓库不一致，请切换仓库并同步');
    }
    const expected = repositoryKey(this.repo, this.serverUrl);
    if ((record.sourceKey && record.sourceKey !== expected) || (record.serverUrl !== undefined && repositoryKey(this.repo, record.serverUrl) !== expected)) {
      throw new Error('文档所属 Git 服务与当前仓库不一致，请切换仓库并同步');
    }
  }

  async writeContext() {
    if (!this.token) throw new Error('请先登录 GitHub');
    const { data: userData } = await this.request('/user');
    const user = userData as UserFields;
    if (!authorId(user.id) || !user.login) throw new Error('无法确认 GitHub 登录用户身份，请重新登录');
    const { data: infoData } = await this.request(`/repos/${this.repo}`);
    const info = infoData as RepositoryFields;
    if (!(info.permissions as PermissionFields | null | undefined)?.push && !(info.permissions as PermissionFields | null | undefined)?.admin) throw new Error('当前账号没有该仓库的写入权限（push），请联系仓库管理员授权');
    if (!info.default_branch) throw new Error('仓库尚无默认分支，请先初始化仓库');
    return { user, branch: info.default_branch, admin: (info.permissions as PermissionFields | null | undefined)?.admin === true, writable: (info.permissions as PermissionFields | null | undefined)?.push === true || (info.permissions as PermissionFields | null | undefined)?.admin === true };
  }

  contentEndpoint(path: string) {
    return `/repos/${this.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  async currentDocument(path: string, branch: unknown) {
    try {
      const { data: contentData } = await this.request(`${this.contentEndpoint(path)}?ref=${encodeURIComponent(branch as string)}`);
      const data = contentData as ContentFields;
      if (data.type !== 'file' || (data.encoding !== 'base64' && !(this.serverUrl && !data.encoding)) || typeof data.content !== 'string' || !data.sha) throw new Error('GitHub 未返回完整 Markdown 文件，请同步后重试');
      return { sha: data.sha, text: Buffer.from(data.content, 'base64').toString('utf8') };
    } catch (error) {
      if ((error as ErrorFields).status === 404) return null;
      throw error;
    }
  }

  checkOwner(text: unknown, user: UserFields) {
    const { meta } = frontmatter(text, true);
    if (!authorId(meta.author_id)) throw new Error('旧文档缺少可信的 author_id，无法确认所有权；请联系维护者迁移文档元数据');
    if (meta.author_id !== user.id) throw new Error('只能修改或删除自己创建的文档（author_id 与登录账号不一致）');
    return meta;
  }

  recordResult(path: string, text: unknown, sha: unknown, branch: unknown) {
    const extra = { sha, repo: this.repo, serverUrl: this.serverUrl, sourceKey: repositoryKey(this.repo, this.serverUrl), branch,
      url: `${this.serverUrl || 'https://github.com'}/${this.repo}/${this.serverUrl ? 'src/branch' : 'blob'}/${encodeURIComponent(branch as string)}/${path.split('/').map(encodeURIComponent).join('/')}` };
    return path.startsWith('algorithms/notes/') ? parseAlgorithmNote(path, text, extra) : parseDocument(path, text, extra);
  }

  async clearFeaturedAlgorithmNotes(branch: unknown, exceptPath: string) {
    const { data: treeData } = await this.request(`/repos/${this.repo}/git/trees/${encodeURIComponent(branch as string)}?recursive=1`);
    const tree = treeData as TreeFields;
    const targets = ((tree.tree || []) as TreeEntry[]).filter(item => item.type === 'blob' && (item.path as string).startsWith('algorithms/notes/public/') && (item.path as string).endsWith('.md') && item.path !== exceptPath);
    for (const target of targets) {
      const current = await this.currentDocument(target.path as string, branch);
      if (!current) continue;
      const parsed = frontmatter(current.text, true);
      if (parsed.meta.featured !== true) continue;
      const meta: Fields = { ...parsed.meta, featured: false, updated_at: new Date().toISOString() };
      const text = `---\n${YAML.stringify(meta)}---\n${parsed.body}`;
      await this.request(this.contentEndpoint(target.path as string), { method: 'PUT', body: JSON.stringify({ message: `取消精选算法笔记：${meta.title || target.path}`, content: Buffer.from(text).toString('base64'), branch, sha: current.sha }) });
    }
  }

  async currentLearningCurriculum(branch: unknown): Promise<LearningCurriculumDocument | null> {
    const current = await this.currentDocument(LEARNING_CURRICULUM_PATH, branch);
    if (!current) return null;
    const { topics, overrides } = await new AlgorithmTopics(this).current(branch);
    return parseLearningCurriculumText(current.text, current.sha, topics, overrides);
  }

  async saveLearningCurriculum(input: unknown): Promise<LearningCurriculumDocument> {
    const fields = learningFields(input);
    if (typeof fields.repo !== 'string') throw new Error('公共课程必须指定当前仓库');
    this.checkScope(fields);
    if (fields.sha !== null && (typeof fields.sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(fields.sha))) throw new Error('请显式提供新增null或编辑SHA');
    if (!this.token) throw new Error('请先登录GitHub');
    const { user, branch } = await this.writeContext();
    const { data: repository } = await this.request(`/repos/${this.repo}`);
    if (((repository as RepositoryFields).permissions as PermissionFields | null | undefined)?.admin !== true) throw new Error('只有仓库管理员（admin）可以修改公共课程');
    if (!Number.isSafeInteger(user.id) || (user.id as number) < 1 || typeof user.login !== 'string') throw new Error('无法确认GitHub登录用户身份');
    const current = await this.currentDocument(LEARNING_CURRICULUM_PATH, branch);
    if (fields.sha === null ? current !== null : !current || current.sha !== fields.sha) throw new Error('公共课程SHA冲突，请先同步后重新编辑');
    const { topics, overrides } = await new AlgorithmTopics(this).current(branch);
    const provisional = parseLearningCurriculumContent({ schema: 1, layout: fields.layout, updatedAt: new Date().toISOString(), author: { id: user.id, login: user.login } }, fields.sha || 'pending', topics, overrides);
    const payload = { schema: 1, layout: provisional.layout, updatedAt: provisional.updatedAt, author: provisional.author };
    const text = JSON.stringify(payload, null, 2) + '\n';
    if (Buffer.byteLength(text, 'utf8') > 1000000) throw new Error('公共课程文件过大');
    const { data } = await this.request(this.contentEndpoint(LEARNING_CURRICULUM_PATH), { method: 'PUT', body: JSON.stringify({ message: '更新公共学习课程布局', content: Buffer.from(text).toString('base64'), branch, ...(fields.sha === null ? {} : { sha: fields.sha }) }) });
    const sha = ((data as WriteFields).content as ContentFields | null | undefined)?.sha;
    if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('公共课程写入结果未知，请先同步核实');
    return { ...provisional, sha, repo: this.repo, serverUrl: this.serverUrl, sourceKey: repositoryKey(this.repo, this.serverUrl) };
  }

  async saveLearningGate(input: unknown): Promise<LearningGateContent> {
    const fields = learningFields(input);
    if (typeof fields.repo !== 'string') throw new Error('公共关卡必须指定当前仓库');
    this.checkScope(fields);
    const clean = learningContentFields(fields);
    if (fields.sha !== null && (typeof fields.sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(fields.sha))) throw new Error('请显式提供新增null或编辑SHA');
    if (!this.token) throw new Error('请先登录GitHub');
    const { user, branch } = await this.writeContext();
    const { data: repository } = await this.request(`/repos/${this.repo}`);
    if ((repository as RepositoryFields).permissions === null || typeof (repository as RepositoryFields).permissions !== 'object' || ((repository as RepositoryFields).permissions as PermissionFields).admin !== true) throw new Error('只有仓库管理员（admin）可以修改公共关卡');
    if (!Number.isSafeInteger(user.id) || (user.id as number) < 1 || typeof user.login !== 'string') throw new Error('无法确认GitHub登录用户身份');
    const curriculum = await this.currentLearningCurriculum(branch);
    if (!learningCurriculumGateIds(curriculum).has(clean.gateId)) throw new Error('关卡不在当前已发布公共课程中，请先同步');
    const path = `${LEARNING_GATES_PREFIX}${clean.gateId}.json`, current = await this.currentDocument(path, branch);
    if (fields.sha === null ? current !== null : !current || current.sha !== fields.sha) throw new Error('公共关卡SHA冲突，请先同步后重新编辑');
    const payload = { schema: 1, ...clean, updatedAt: new Date().toISOString(), author: { id: user.id as number, login: user.login } };
    // Validate exactly what will be committed; never replace a supplied SHA with a fresh one.
    const provisional = parseLearningGateContent(payload, clean.gateId, fields.sha || 'pending');
    const { data } = await this.request(this.contentEndpoint(path), { method: 'PUT', body: JSON.stringify({ message: `更新公共学习关卡：${clean.gateId}`, content: Buffer.from(JSON.stringify(payload, null, 2) + '\n').toString('base64'), branch, ...(fields.sha === null ? {} : { sha: fields.sha }) }) });
    const savedSha = ((data as WriteFields).content as ContentFields | null | undefined)?.sha;
    if (typeof savedSha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(savedSha)) throw new Error('公共关卡写入结果未知，请先同步核实');
    return { ...provisional, sha: savedSha, repo: this.repo, serverUrl: this.serverUrl, sourceKey: repositoryKey(this.repo, this.serverUrl) };
  }

  async saveAlgorithmTopic(record: unknown) {
    if (record && typeof record === 'object') this.checkScope(record);
    return new AlgorithmTopics(this).save(record);
  }

  private algorithmTopicMutationFields(input: unknown): Fields {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('算法节点输入格式错误');
    const fields = input as Fields;
    if (typeof fields.repo !== 'string') throw new Error('算法节点必须指定当前仓库');
    this.checkScope(fields);
    if (fields.sourceKey !== undefined && fields.sourceKey !== repositoryKey(this.repo, this.serverUrl)) throw new Error('算法节点所属来源与当前仓库不一致');
    return fields;
  }

  async updateAlgorithmTopic(input: unknown) {
    const fields = this.algorithmTopicMutationFields(input);
    return new AlgorithmTopics(this).update(fields, context => this.guardAlgorithmTopicMutation(context));
  }

  async deleteAlgorithmTopic(input: unknown) {
    const fields = this.algorithmTopicMutationFields(input);
    return new AlgorithmTopics(this).remove(fields, context => this.guardAlgorithmTopicMutation(context));
  }

  private async guardAlgorithmTopicMutation({ branch, topicsSha, overridesSha, index, removedIds }: import('../algorithms/contracts.js').TopicMutationContext) {
      const branchPath = `/repos/${this.repo}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`;
      const ref = (await this.request(branchPath)).data as { object?: { sha?: unknown } };
      const head = ref?.object?.sha;
      if (typeof head !== 'string' || !/^[a-f0-9]{40}$/i.test(head)) throw new Error('无法确认默认分支提交，请先同步后重试');
      const commit = (await this.request(`/repos/${this.repo}/git/commits/${head}`)).data as { tree?: { sha?: unknown } };
      const treeSha = commit?.tree?.sha;
      if (typeof treeSha !== 'string' || !/^[a-f0-9]{40}$/i.test(treeSha)) throw new Error('无法确认算法目录所在提交的文件树');
      const tree = (await this.request(`/repos/${this.repo}/git/trees/${treeSha}?recursive=1`)).data as TreeFields;
      if (!Array.isArray(tree?.tree) || tree.truncated !== false) throw new Error('无法完整检查算法节点的仓库引用');
      const files = (tree.tree as TreeEntry[]).filter(entry => entry.type === 'blob' && typeof entry.path === 'string');
      for (const [path, expected] of [[TOPICS_PATH, topicsSha], [OVERRIDES_PATH, overridesSha]] as const) {
        if ((files.find(entry => entry.path === path)?.sha ?? null) !== expected) throw new Error('算法目录已更新，请先同步后重试');
      }
      const affected = (value: unknown) => typeof value === 'string' && (removedIds.has(value) || removedIds.has(index.get(value)?.id ?? ''));
      const candidates = removedIds.size ? files.filter(entry => {
        const path = entry.path as string;
        return path === LEARNING_CURRICULUM_PATH || /^(?:algorithms\/notes\/.+\.md|algorithms\/node-content\/[^/]+\.json)$/i.test(path) || TRICK_PATH.test(path);
      }) : [];
      for (let start = 0; start < candidates.length; start += 8) await Promise.all(candidates.slice(start, start + 8).map(async entry => {
        if (typeof entry.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(entry.sha)) throw new Error('引用文件缺少有效 SHA');
        const file = (await this.request(`/repos/${this.repo}/git/blobs/${entry.sha}`)).data as ContentFields;
        if (file?.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('无法完整检查算法关联文件');
        const text = Buffer.from(file.content, 'base64').toString('utf8');
        const filePath = entry.path as string;
        if (/^algorithms\/notes\//i.test(filePath)) {
          if (affected(frontmatter(text, true).meta.node_id)) throw new Error('该节点仍有算法笔记，请先将笔记移到其他节点或删除');
        } else if (filePath.startsWith(ALGORITHM_NODE_CONTENT_PREFIX)) {
          if (affected(parseAlgorithmNodeContentText(text, entry.sha).nodeId)) throw new Error('该节点仍有已保存的简介或精选内容，无法删除');
        } else if (filePath === LEARNING_CURRICULUM_PATH) {
          const { topics, overrides } = await new AlgorithmTopics(this).current(head);
          const curriculum = parseLearningCurriculumText(text, entry.sha, topics, overrides);
          if (curriculum.layout.stages.some(stage => stage.gates.some(gate => gate.topicIds?.some(affected)))) throw new Error('该节点仍被学习课程引用，请先修改课程');
        } else {
          const recommendation = frontmatter(text, true).meta.recommendation;
          const prerequisites = recommendation && typeof recommendation === 'object' ? (recommendation as Fields).prerequisiteIds : undefined;
          if (Array.isArray(prerequisites) && prerequisites.some(affected)) throw new Error('该节点仍被 Trick 用作前置算法，请先修改推荐');
        }
      }));
      return async ({ path, message, text }: import('../algorithms/contracts.js').TopicMutationWrite) => {
        const { data } = await this.request('/graphql', { method: 'POST', body: JSON.stringify({
          query: 'mutation SaveDirectory($input:CreateCommitOnBranchInput!){createCommitOnBranch(input:$input){commit{oid}}}',
          variables: { input: { branch: { repositoryNameWithOwner: this.repo, branchName: branch }, expectedHeadOid: head, message: { headline: message }, fileChanges: { additions: [{ path, contents: Buffer.from(text).toString('base64') }] } } },
        }) });
        const result = data as { errors?: unknown; data?: { createCommitOnBranch?: { commit?: { oid?: unknown } } } };
        if (Array.isArray(result?.errors) && result.errors.length) throw new Error('GitHub 拒绝写入算法节点，仓库可能已更新或权限已变更。请先同步再试');
        const oid = result?.data?.createCommitOnBranch?.commit?.oid;
        if (typeof oid !== 'string' || !/^[a-f0-9]{40}$/i.test(oid)) throw new Error('算法节点写入结果未知，请先同步确认');
      };
  }

  async saveAlgorithmNodeContent(input: unknown): Promise<AlgorithmNodeContent> {
    const fields = learningFields(input);
    if (typeof fields.repo !== 'string') throw new Error('算法节点内容必须指定当前仓库');
    this.checkScope(fields);
    const clean = algorithmNodeContentFields(fields);
    const requestedStorageId = fields.storageNodeId === undefined ? undefined : learningText(fields.storageNodeId, '算法内容存储标识', 1000);
    if (fields.sha !== null && (typeof fields.sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(fields.sha))) throw new Error('请显式提供新增null或编辑SHA');
    const { user, branch } = await this.writeContext();
    const { data: repository } = await this.request(`/repos/${this.repo}`);
    if (((repository as RepositoryFields).permissions as PermissionFields | null | undefined)?.admin !== true) throw new Error('只有仓库管理员（admin）可以修改算法介绍和精选笔记');
    if (!Number.isSafeInteger(user.id) || (user.id as number) < 1 || typeof user.login !== 'string') throw new Error('无法确认GitHub登录用户身份');
    const { topics, overrides } = await new AlgorithmTopics(this).current(branch);
    const leafIndex = curriculumTopicIndex(builtinTopics, topics, overrides);
    const nodeId = contentTargetFromIndex(clean.nodeId, leafIndex);
    if (!nodeId) throw new Error('算法介绍和笔记只能属于真实算法叶节点或批准的路线介绍目录');
    const storageNodeId = requestedStorageId ?? nodeId;
    if (contentTargetFromIndex(storageNodeId, leafIndex) !== nodeId) throw new Error('算法内容存储标识与当前节点不匹配');
    clean.nodeId = storageNodeId;
    for (const notePath of clean.featuredNotePaths) {
      const personal = /^algorithms\/notes\/personal\/([1-9]\d*)\//.exec(notePath);
      if (personal && personal[1] !== String(user.id)) throw new Error('不能公开引用其他账号的个人笔记');
      const noteFile = await this.currentDocument(notePath, branch);
      if (!noteFile) throw new Error('精选笔记不存在，请先同步');
      const note = parseAlgorithmNote(notePath, noteFile.text);
      if (personal ? note.noteScope !== 'personal' || note.authorId !== user.id : note.noteScope !== 'public') throw new Error('精选笔记路径与所有权元数据不匹配');
      if (leafIdFromIndex(note.nodeId, leafIndex) !== nodeId) throw new Error('精选笔记必须属于同一个算法叶节点');
    }
    if (fields.sha === null && storageNodeId !== nodeId) throw new Error('历史存储标识只能用于编辑已有算法内容，请先同步');
    const path = algorithmNodeContentPath(storageNodeId), current = await this.currentDocument(path, branch);
    if (fields.sha === null ? current !== null : !current || current.sha !== fields.sha) throw new Error('算法节点内容SHA冲突，请先同步后重新编辑');
    if (current && parseAlgorithmNodeContentText(current.text, current.sha).nodeId !== storageNodeId) throw new Error('算法节点内容文件与存储标识不匹配');
    const payload = { schema: 1, ...clean, updatedAt: new Date().toISOString(), author: { id: user.id as number, login: user.login } };
    const provisional = parseAlgorithmNodeContent(payload, fields.sha || 'pending');
    const text = JSON.stringify(payload, null, 2) + '\n';
    if (Buffer.byteLength(text, 'utf8') > 1000000) throw new Error('算法节点内容文件过大');
    const { data } = await this.request(this.contentEndpoint(path), { method: 'PUT', body: JSON.stringify({ message: `更新算法介绍和精选笔记：${nodeId}`, content: Buffer.from(text).toString('base64'), branch, ...(fields.sha === null ? {} : { sha: fields.sha }) }) });
    const sha = ((data as WriteFields).content as ContentFields | null | undefined)?.sha;
    if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('算法节点内容写入结果未知，请先同步核实');
    return { ...provisional, nodeId, ...(storageNodeId === nodeId ? {} : { storageNodeId }), sha, repo: this.repo, serverUrl: this.serverUrl, sourceKey: repositoryKey(this.repo, this.serverUrl) };
  }

  async saveAlgorithmNote(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('算法笔记输入格式无效');
    const record = input as Fields;
    this.checkScope(record);
    if (record.sourceKey !== undefined && record.sourceKey !== repositoryKey(this.repo, this.serverUrl)) throw new Error('算法笔记所属来源与当前仓库不一致，请重新同步');
    const editPath = record.path === undefined ? undefined : validatePath(record.path);
    if (editPath !== undefined && typeof record.repo !== 'string') throw new Error('算法笔记必须指定当前仓库');
    if (editPath === undefined ? record.sha !== undefined : typeof record.sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(record.sha)) {
      throw new Error('更新算法笔记必须同时提供路径和当前 SHA，请先同步');
    }
    if (!record.body || typeof record.body !== 'string') throw new Error('算法笔记正文必须是字符串');
    if (record.noteScope !== undefined && record.noteScope !== 'personal' && record.noteScope !== 'public') throw new Error('算法笔记范围无效');

    const { user, branch, admin, writable } = await this.writeContext();
    if (!writable) throw new Error('当前账号没有有效仓库写入权限');
    let path = editPath;
    let clientId: string | undefined;
    if (path === undefined) {
      const requestedId = record.clientId ?? (require('node:crypto') as typeof import('node:crypto')).randomUUID();
      if (typeof requestedId !== 'string' || !UUID.test(requestedId)) throw new Error('算法笔记 clientId 无效');
      clientId = requestedId.toLowerCase();
      path = record.noteScope === 'public' ? `algorithms/notes/public/${clientId}.md` : `algorithms/notes/personal/${user.id}/${clientId}.md`;
    }
    const target = /^algorithms\/notes\/(?:public\/|personal\/([1-9]\d*)\/)[^/]+\.md$/.exec(path);
    if (!target) throw new Error('算法笔记路径无效');
    const personalOwner = target[1];
    const scope = personalOwner ? 'personal' : 'public';
    if ((personalOwner && personalOwner !== String(user.id)) || (record.noteScope !== undefined && record.noteScope !== scope)) throw new Error('算法笔记路径的范围或账号归属不匹配');
    if (scope === 'public' && !admin) throw new Error('只有仓库管理员可以发布或编辑公共算法笔记');

    const current = await this.currentDocument(path, branch);
    if (editPath !== undefined && !current) throw new Error('算法笔记已被删除，请先同步');
    if (editPath !== undefined && current?.sha !== record.sha) throw new Error('算法笔记 SHA 冲突，请先同步');
    const existing = current ? frontmatter(current.text, true).meta : undefined;
    if (existing) {
      if (existing.note_scope !== scope || (existing.schema !== undefined && existing.schema !== 3) || typeof existing.node_id !== 'string' || !existing.node_id.trim() || !authorId(existing.author_id)) throw new Error('算法笔记路径与元数据不匹配或格式不受支持');
      if (personalOwner && existing.author_id !== user.id) throw new Error('只能编辑自己创建的个人算法笔记');
      if (editPath === undefined && existing.client_id !== clientId) throw new Error('算法笔记目标路径已存在且 clientId 不匹配，请同步');
    }
    const supplied = frontmatter(record.body, true);
    const { topics, overrides } = await new AlgorithmTopics(this).current(branch);
    const leafIndex = curriculumTopicIndex(builtinTopics, topics, overrides);
    const previous = editPath === undefined ? undefined : existing;
    const nodeId = leafIdFromIndex(record.nodeId ?? supplied.meta.node_id ?? previous?.node_id, leafIndex);
    if (!nodeId) throw new Error('算法笔记只能保存到真实算法叶节点，不能保存到目录');
    const tags = record.tags ?? supplied.meta.tags;
    const title = record.title || supplied.meta.title;
    const meta = previous ? {
      ...previous,
      node_id: leafIdFromIndex(previous.node_id, leafIndex) === nodeId ? previous.node_id : nodeId,
      ...(title ? { title: String(title) } : {}),
      ...(Array.isArray(tags) ? { tags: tags.map(String) } : {}),
      ...(admin && typeof record.featured === 'boolean' ? { featured: record.featured } : {}),
      updated_at: new Date().toISOString(),
    } : {
      schema: 3, note_scope: scope, node_id: nodeId, featured: admin && record.featured === true,
      author_id: user.id, author: user.login, title: String(title || '未命名算法笔记'),
      tags: Array.isArray(tags) ? tags.map(String) : [], client_id: clientId, updated_at: new Date().toISOString(),
    };
    const text = `---\n${YAML.stringify(meta)}---\n${supplied.body}`;
    if (text.length > 1000000) throw new Error('算法笔记内容过长');
    if (current && samePayload(current.text, text)) return { ...this.recordResult(path, current.text, current.sha, branch), nodeId };
    if (editPath === undefined && current) throw new Error('同一 clientId 的算法笔记已存在，但内容不同；请使用当前路径和 SHA 编辑');
    const { data } = await this.request(this.contentEndpoint(path), {
      method: 'PUT', body: JSON.stringify({
        message: `${editPath === undefined ? '新增' : '更新'}算法笔记：${title || previous?.title || '未命名算法笔记'}`,
        content: Buffer.from(text).toString('base64'), branch, ...(editPath === undefined ? {} : { sha: record.sha }),
      }),
    });
    const sha = ((data as WriteFields).content as ContentFields | null | undefined)?.sha;
    if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('算法笔记写入结果未知，请先同步核实');
    return { ...this.recordResult(path, text, sha, branch), nodeId };
  }

  async deleteAlgorithmNote(input: unknown) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('算法笔记输入格式无效');
    const record = input as Fields;
    if (typeof record.repo !== 'string') throw new Error('算法笔记必须指定当前仓库');
    this.checkScope(record);
    if (record.sourceKey !== undefined && record.sourceKey !== repositoryKey(this.repo, this.serverUrl)) throw new Error('算法笔记所属来源与当前仓库不一致，请重新同步');
    const path = validatePath(record.path);
    const target = /^algorithms\/notes\/(?:public\/|personal\/([1-9]\d*)\/)[^/]+\.md$/.exec(path);
    if (!target) throw new Error('算法笔记路径无效');
    if (typeof record.sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(record.sha)) throw new Error('删除算法笔记必须提供当前 SHA，请先同步');

    const { user, branch, admin, writable } = await this.writeContext();
    if (!writable) throw new Error('当前账号没有有效仓库写入权限');
    const personalOwner = target[1];
    const scope = personalOwner ? 'personal' : 'public';
    if (personalOwner && personalOwner !== String(user.id)) throw new Error('算法笔记路径的账号归属不匹配');
    if (scope === 'public' && !admin) throw new Error('只有仓库管理员可以删除公共算法笔记');
    const current = await this.currentDocument(path, branch);
    if (!current) throw new Error('算法笔记已不存在，请先同步');
    if (current.sha !== record.sha) throw new Error('算法笔记 SHA 冲突，请先同步');
    const { meta } = frontmatter(current.text, true);
    if (meta.note_scope !== scope || (meta.schema !== undefined && meta.schema !== 3) || typeof meta.node_id !== 'string' || !meta.node_id.trim() || !authorId(meta.author_id)) throw new Error('算法笔记路径与元数据不匹配或格式不受支持');
    if (personalOwner && meta.author_id !== user.id) throw new Error('只能删除自己创建的个人算法笔记');
    await this.request(this.contentEndpoint(path), {
      method: 'DELETE', body: JSON.stringify({ message: `删除算法笔记：${path}`, branch, sha: record.sha }),
    });
    return { id: `document:${path}`, path, deleted: true as const };
  }

  async saveTrick(input: unknown): Promise<Trick> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Trick输入格式无效');
    const record = input as Fields;
    this.checkScope(record);
    if (record.sourceKey !== undefined && record.sourceKey !== repositoryKey(this.repo, this.serverUrl)) throw new Error('Trick所属来源与当前仓库不一致，请重新同步');
    const title = trickText(record.title, 'Trick标题', 600, true).trim();
    const introduction = trickText(record.introduction, 'Trick简介', 6000, true);
    const body = trickText(record.body, 'Trick正文', 1000000, true);
    if (record.path !== undefined) validateTrickPath(record.path);
    if (record.path !== undefined && (typeof record.sha !== 'string' || !record.sha.trim())) throw new Error('更新Trick必须提供当前SHA，请先同步');
    const clientId = record.clientId === undefined ? (require('node:crypto') as typeof import('node:crypto')).randomUUID() : record.clientId;
    if (typeof clientId !== 'string' || !UUID.test(clientId)) throw new Error('Trick clientId必须为UUID');
    const path = record.path === undefined ? `tricks/${clientId.toLowerCase()}.md` : validateTrickPath(record.path);
    const { user, branch, admin, writable } = await this.writeContext();
    if (!writable) throw new Error('当前账号没有有效仓库写入权限');
    const current = await this.currentDocument(path, branch);
    if (record.path !== undefined && !current) throw new Error('Trick已被删除，请先同步');
    const scope = { repo: this.repo, serverUrl: this.serverUrl, sourceKey: repositoryKey(this.repo, this.serverUrl) };
    const currentFile = current ? parseTrickFile(path, current.text, current.sha, scope) : null;
    const existing = currentFile?.trick;
    if (existing && existing.authorId !== user.id && !admin) throw new Error('只能维护本人Trick，或由仓库管理员管理');
    if (record.path !== undefined && current!.sha !== record.sha) throw new Error('Trick SHA冲突，请先同步后再编辑');
    const previous = existing?.recommendation;
    const supplied = record.recommendation !== undefined;
    let recommendation = !supplied ? previous : record.recommendation === null ? undefined : validateTrickRecommendation(record.recommendation);
    let changed = supplied && (currentFile?.invalidRecommendation === true || !sameTrickRecommendation(previous, recommendation));
    if (changed) {
      if (!admin) throw new Error('只有仓库管理员（admin）可以修改Trick推荐');
      if (recommendation?.prerequisiteIds.length) {
        const { topics, overrides } = await new AlgorithmTopics(this).current(branch);
        const index = curriculumTopicIndex(builtinTopics, topics, overrides);
        const prerequisiteIds = recommendation.prerequisiteIds.map(id => {
          const canonical = leafIdFromIndex(id, index);
          if (!canonical || !TRICK_PREREQUISITE_ID.test(canonical)) throw new Error('Trick推荐前置算法必须是当前目录中的真实算法叶节点');
          return canonical;
        });
        if (new Set(prerequisiteIds).size !== prerequisiteIds.length) throw new Error('Trick推荐前置算法不能重复');
        recommendation = { ...recommendation, prerequisiteIds };
        changed = currentFile?.invalidRecommendation === true || !sameTrickRecommendation(previous, recommendation);
      }
    }
    if (existing && !changed && existing.title === title && existing.introduction === introduction && existing.body === body) return existing;
    if (record.path === undefined && current) throw new Error('同一clientId的Trick已存在但内容不同，请同步后使用路径和SHA编辑');
    // Do not rewrite an invalid optional section unless an admin explicitly clears or repairs it.
    if (!supplied && currentFile?.invalidRecommendation) throw new Error('Trick已有推荐格式无效；请由仓库管理员显式修正或清除后再编辑');
    const storedRecommendation = changed ? recommendation : currentFile?.rawRecommendation;
    const meta = { schema: 1, kind: 'trick', title, introduction, authorId: existing?.authorId ?? user.id, author: existing?.author.login ?? user.login, updatedAt: new Date().toISOString(), ...(storedRecommendation === undefined ? {} : { recommendation: storedRecommendation }) };
    const text = `---\n${YAML.stringify(meta)}---\n${body}`;
    const provisional = parseTrick(path, text, current?.sha ?? 'pending', scope);
    const { data } = await this.request(this.contentEndpoint(path), { method: 'PUT', body: JSON.stringify({ message: `${current ? '更新' : '新增'}Trick：${title}`, content: Buffer.from(text).toString('base64'), branch, ...(current ? { sha: current.sha } : {}) }) });
    const savedSha = ((data as WriteFields).content as ContentFields | null | undefined)?.sha;
    if (typeof savedSha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(savedSha)) throw new Error('Trick写入结果未知，请先同步确认，不要重复创建');
    return { ...provisional, sha: savedSha };
  }

  async deleteTrick(input: unknown): Promise<import('../../shared/models/trick.js').DeletedTrick> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Trick输入格式无效');
    const record = input as Fields;
    this.checkScope(record);
    if (record.sourceKey !== undefined && record.sourceKey !== repositoryKey(this.repo, this.serverUrl)) throw new Error('Trick所属来源与当前仓库不一致，请重新同步');
    const path = validateTrickPath(record.path);
    if (typeof record.sha !== 'string' || !record.sha.trim()) throw new Error('删除Trick必须提供当前SHA，请先同步');
    const { user, branch, admin, writable } = await this.writeContext();
    if (!writable) throw new Error('当前账号没有有效仓库写入权限');
    const current = await this.currentDocument(path, branch);
    if (!current) throw new Error('Trick已不存在，请先同步');
    const scope = { repo: this.repo, serverUrl: this.serverUrl, sourceKey: repositoryKey(this.repo, this.serverUrl) };
    const existing = parseTrick(path, current.text, current.sha, scope);
    if (existing.authorId !== user.id && !admin) throw new Error('只能删除本人Trick，或由仓库管理员管理');
    if (current.sha !== record.sha) throw new Error('Trick SHA冲突，请先同步后再删除');
    await this.request(this.contentEndpoint(path), { method: 'DELETE', body: JSON.stringify({ message: `删除Trick：${existing.title}`, sha: current.sha, branch }) });
    return { id: existing.id, path, deleted: true, ...scope };
  }

  async saveDocument(input: unknown) {
    const record = input as Fields;
    this.checkScope(record);
    if (record.path !== undefined && /^algorithms\/notes\//i.test(validatePath(record.path))) throw new Error('请使用算法笔记编辑入口');
    if (record.path !== undefined && (typeof record.sha !== 'string' || !record.sha.trim())) throw new Error('更新文档必须提供当前 SHA，请先同步');
    if (record.body !== undefined && typeof record.body !== 'string') throw new Error('Markdown 正文必须是字符串');
    const { user, branch } = await this.writeContext();
    const found = identify(record.problemUrl || '');
    const clientId = record.clientId;
    if (!record.path && (typeof clientId !== 'string' || !UUID.test(clientId))) throw new Error('新建文档必须提供有效的 UUID clientId，请保留同一个记录 ID 后重试');
    const path = (record.path as string) || `problems/qmx/${user.id}/${(clientId as string).toLowerCase()}.md`;
    const current = await this.currentDocument(path, branch);
    if (record.path && !current) throw new Error('文档已被删除或移动，请先同步');
    const previous = current ? this.checkOwner(current.text, user) : {};
    if (record.path && current!.sha !== record.sha) throw new Error('文档 SHA 冲突：文件已被更新，请先同步后再编辑');
    if (!record.path && current && previous.client_id !== (clientId as string).toLowerCase()) throw new Error('目标路径已存在且 clientId 不匹配，请同步');
    const supplied = record.body === undefined ? null : frontmatter(record.body, true);
    const value = (key: string, fallback: unknown) => {
      const metadataKey = key === 'problemUrl' ? 'problem_url' : key;
      return record[key] !== undefined ? record[key] : supplied?.meta[metadataKey] !== undefined ? supplied.meta[metadataKey] : fallback;
    };
    const meta = {
      ...previous, ...(supplied?.meta || {}), schema: 2, author_id: user.id, author: user.login,
      title: value('title', previous.title || record.pid || found.pid || '未命名文档'),
      pid: value('pid', previous.pid || found.pid), platform: value('platform', previous.platform || found.platform),
      tags: value('tags', previous.tags || []), rating: value('rating', previous.rating ?? null),
      difficulty: value('difficulty', previous.difficulty || ''),
      luoguDifficulty: value('luoguDifficulty', previous.luoguDifficulty || ''),
      problem_url: value('problemUrl', previous.problem_url || previous.problemUrl || ''),
      client_id: record.path ? (previous.client_id || '') : (clientId as string).toLowerCase(), updated_at: new Date().toISOString(),
    };
    if (!Array.isArray(meta.tags)) throw new Error('标签必须是数组');
    meta.tags = meta.tags.map(String);
    meta.rating = Number(meta.rating) > 0 && Number.isFinite(Number(meta.rating)) ? Number(meta.rating) : null;
    const body = supplied ? supplied.body : record.path ? frontmatter(current!.text, true).body
      : `## 错因\n\n${record.reason || ''}\n\n## 题解与代码\n\n${record.solution || ''}\n\n## 个人 trick\n\n${record.trick || ''}`;
    const text = `---\n${YAML.stringify(meta)}---\n${body}`;
    if (text.length > 1000000) throw new Error('文档内容过长，请控制在 1000000 字符以内');
    if (!record.path && current) {
      if (!samePayload(current.text, text)) throw new Error('同一 clientId 的文档已存在，但内容不同；请先同步，使用当前路径和 SHA 编辑');
      return this.recordResult(path, current.text, current.sha, branch);
    }
    const { data } = await this.request(this.contentEndpoint(path), {
      method: 'PUT', body: JSON.stringify({
        message: `${current ? '更新' : '新增'}文档：${meta.title}`, content: Buffer.from(text).toString('base64'), branch,
        ...(current ? { sha: current.sha } : {}),
      }),
    });
    if (!((data as WriteFields).content as ContentFields | null | undefined)?.sha) throw new Error('GitHub 写入结果未知，请先同步确认结果，不要重复创建文档');
    return this.recordResult(path, text, ((data as WriteFields).content as ContentFields).sha, branch);
  }

  async deleteDocument(input: unknown) {
    const record = input as Fields;
    this.checkScope(record);
    const path = validatePath(record.path);
    if (/^algorithms\/notes\//i.test(path)) throw new Error('请使用算法笔记删除入口');
    if (typeof record.sha !== 'string' || !record.sha.trim()) throw new Error('删除文档必须提供当前 SHA，请先同步');
    const { user, branch } = await this.writeContext();
    const current = await this.currentDocument(path, branch);
    if (!current) throw new Error('文档已不存在，请先同步');
    this.checkOwner(current.text, user);
    if (current.sha !== record.sha) throw new Error('文档 SHA 冲突：文件已被更新，请先同步后再删除');
    await this.request(this.contentEndpoint(path), {
      method: 'DELETE', body: JSON.stringify({ message: `删除文档：${path}`, sha: current.sha, branch }),
    });
    return { id: `document:${path}`, path, repo: this.repo, deleted: true };
  }

  async deleteIssue(input: unknown) {
    const record = input as Fields;
    this.checkScope(record);
    const { number } = record;
    if (!Number.isSafeInteger(number) || (number as number) < 1) throw new Error('无效 Issue 编号，必须为正整数');
    if (!this.token) throw new Error('请先登录 GitHub');
    const { data: userData } = await this.request('/user');
    const user = userData as UserFields;
    if (!authorId(user.id) || !user.login) throw new Error('无法确认 GitHub 登录用户身份，请重新登录');
    const { data: infoData } = await this.request(`/repos/${this.repo}`);
    const info = infoData as RepositoryFields;
    if ((info.permissions as PermissionFields | null | undefined)?.admin !== true) throw new Error('只有仓库管理员（admin）可以永久删除 Issue');
    const { data: issueData } = await this.request(`/repos/${this.repo}/issues/${number}`);
    const issue = issueData as IssueFields | null | undefined;
    if (issue?.pull_request) throw new Error('不能通过删除 Issue 操作删除 Pull Request');
    if (issue?.number !== number || typeof issue!.node_id !== 'string' || !issue!.node_id.trim()) {
      throw new Error('GitHub 未返回匹配的 Issue 编号和 node_id，请先同步后重试');
    }
    const permissionHint = '请检查令牌授权范围、组织策略及组织允许管理员删除 Issue 的设置（Allow members to delete issues）';
    let data: unknown;
    try {
      ({ data } = await this.request('/graphql', {
        method: 'POST', body: JSON.stringify({
          query: 'mutation DeleteIssue($issueId: ID!) { deleteIssue(input: { issueId: $issueId }) { clientMutationId } }',
          variables: { issueId: issue!.node_id },
        }),
      }));
    } catch (error) {
      if ((error as ErrorFields).status === 403) throw new Error(`GitHub 拒绝删除 Issue；${permissionHint}`, { cause: error });
      if ((error as ErrorFields).cause) throw new Error('GitHub 删除 Issue 结果未知（网络中断或超时）；请先同步确认结果，不要自动重试删除。', { cause: error });
      throw error;
    }
    const result = data as GraphQLFields | null | undefined;
    if (Array.isArray(result?.errors) && result.errors.length) {
      const details = (result.errors as unknown[]).map(value => { const error = value as { message?: unknown; type?: unknown } | null | undefined; return String(error?.message || error?.type || '未知 GraphQL 错误'); }).join('；');
      throw new Error(`GitHub 删除 Issue 失败：${details}；${permissionHint}`);
    }
    if (!(result?.data as GraphQLDataFields | null | undefined)?.deleteIssue || typeof (result!.data as GraphQLDataFields).deleteIssue !== 'object') {
      throw new Error('GitHub 删除 Issue 结果未知；请先同步确认结果，不要自动重试删除。');
    }
    return { id: `issue:${number}`, number, repo: this.repo, deleted: true };
  }

  async sync(previous: SyncInput = {}) {
    const scope = { repo: this.repo, serverUrl: this.serverUrl, sourceKey: repositoryKey(this.repo, this.serverUrl) };
    const { data: infoData } = await this.request(`/repos/${this.repo}`);
    const info = infoData as RepositoryFields;
    const branch = info.default_branch;
    const [{ data: treeData }, issueData] = await Promise.all([
      this.request(`/repos/${this.repo}/git/trees/${encodeURIComponent(branch as string)}?recursive=1${this.serverUrl ? '&per_page=1000&page=1' : ''}`),
      this.pages(`/repos/${this.repo}/issues?state=all&sort=updated&direction=desc`),
    ]);
    const tree = treeData as TreeFields;
    const issues = issueData as IssueFields[];
    if (tree.truncated) throw new Error('仓库目录过大，GitHub 未返回完整文件树');
    if (!Array.isArray(tree.tree)) throw new Error('Git 服务返回了意外的文件树格式');
    // Gitea paginates recursive trees and may clamp per_page below our request.
    if (this.serverUrl && Number(tree.total_count) > tree.tree.length) {
      const expected = Number(tree.total_count);
      for (let page = 2; tree.tree.length < expected; page++) {
        if (page > 100 || !tree.tree.length) throw new Error('Gitea 文件树超过单次同步上限');
        const { data: nextData } = await this.request(`/repos/${this.repo}/git/trees/${encodeURIComponent(branch as string)}?recursive=1&per_page=1000&page=${page}`);
        const next = nextData as TreeFields;
        if (next.truncated || !Array.isArray(next.tree) || !next.tree.length) throw new Error('Gitea 未返回完整文件树');
        tree.tree.push(...next.tree);
      }
    }
    const hasAlgorithmNotes = (tree.tree as TreeEntry[]).some(x => x.type === 'blob' && (x.path as string).startsWith('algorithms/notes/'));
    const currentUser = hasAlgorithmNotes && this.token ? (await this.request('/user')).data as UserFields : null;
    const personalPrefix = currentUser?.id ? `algorithms/notes/personal/${currentUser.id}/` : null;
    const docs = (tree.tree as TreeEntry[]).filter(x => {
      if (x.type !== 'blob') return false;
      try { validatePath(x.path); } catch { return false; }
      if ((x.path as string).startsWith('algorithms/notes/')) return (x.path as string).startsWith('algorithms/notes/public/') || !!personalPrefix && (x.path as string).startsWith(personalPrefix);
      return true;
    });
    const blobs = { ...(previous.blobs as Record<string, unknown> | null | undefined) };
    const records: ReturnType<GitHub['recordResult']>[] = [];
    for (let start = 0; start < docs.length; start += 4) {
      records.push(...await Promise.all(docs.slice(start, start + 4).map(async d => {
        let text = blobs[d.sha as string];
        if (text === undefined) {
          const { data } = await this.request(`/repos/${this.repo}/git/blobs/${d.sha}`);
          text = Buffer.from((data as ContentFields).content as string, 'base64').toString('utf8');
          blobs[d.sha as string] = text;
        }
        return this.recordResult(d.path as string, text, d.sha, branch);
      })));
    }
    const readPublicBlob = async (item: TreeEntry) => {
      const sha = item.sha;
      if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('公共课程缺少有效SHA');
      let text = blobs[sha];
      if (text === undefined) {
        const { data } = await this.request(`/repos/${this.repo}/git/blobs/${sha}`);
        const blob = data as ContentFields;
        if (typeof blob.content !== 'string' || (blob.encoding !== 'base64' && !(this.serverUrl && !blob.encoding))) throw new Error('Git 服务未返回完整公共课程文件');
        text = Buffer.from(blob.content, 'base64').toString('utf8');
        blobs[sha] = text;
      }
      return text;
    };
    const trickFiles = (tree.tree as TreeEntry[]).filter(item => item.type === 'blob' && typeof item.path === 'string' && TRICK_PATH.test(item.path));
    if (trickFiles.length > 10000) throw new Error('公共Trick文件数量超过同步上限');
    const tricks: Trick[] = [], seenTricks = new Set<string>();
    for (let start = 0; start < trickFiles.length; start += 4) {
      const batch = await Promise.all(trickFiles.slice(start, start + 4).map(async item => parseTrick(item.path, await readPublicBlob(item), item.sha, scope)));
      for (const trick of batch) {
        if (seenTricks.has(trick.id)) throw new Error('公共Trick标识重复');
        seenTricks.add(trick.id); tricks.push(trick);
      }
    }
    tricks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path));
    const additions = (tree.tree as TreeEntry[]).find(item => item.type === 'blob' && item.path === TOPICS_PATH);
    const algorithmTopics = additions ? parseTopics(await readPublicBlob(additions)).map(topic => ({ ...topic, ...scope })) : [];
    const overrideFile = (tree.tree as TreeEntry[]).find(item => item.type === 'blob' && item.path === OVERRIDES_PATH);
    const algorithmOverrides = overrideFile ? parseOverrides(await readPublicBlob(overrideFile)) : [];
    const curriculumFile = (tree.tree as TreeEntry[]).find(item => item.type === 'blob' && item.path === LEARNING_CURRICULUM_PATH);
    const curriculum = curriculumFile ? { ...parseLearningCurriculumText(await readPublicBlob(curriculumFile), curriculumFile.sha, algorithmTopics, algorithmOverrides), ...scope } : null;
    const activeGateIds = learningCurriculumGateIds(curriculum);
    const gateFiles = (tree.tree as TreeEntry[]).filter(item => item.type === 'blob' && typeof item.path === 'string' && item.path.startsWith(LEARNING_GATES_PREFIX) && item.path.endsWith('.json') && activeGateIds.has(item.path.slice(LEARNING_GATES_PREFIX.length, -5)));
    if (gateFiles.length > activeGateIds.size) throw new Error('公共关卡文件数量超过当前课程范围');
    const learningGateContents: LearningGateContent[] = [], seenGates = new Set<string>();
    for (const item of gateFiles) {
      const gateId = (item.path as string).slice(LEARNING_GATES_PREFIX.length, -5);
      if (!activeGateIds.has(gateId) || seenGates.has(gateId)) throw new Error('公共关卡文件标识无效或重复');
      seenGates.add(gateId);
      const sha = item.sha;
      if (typeof sha !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(sha)) throw new Error('公共关卡缺少有效SHA');
      let text = blobs[sha];
      if (text === undefined) {
        const { data } = await this.request(`/repos/${this.repo}/git/blobs/${sha}`);
        const blob = data as ContentFields;
        if (typeof blob.content !== 'string' || (blob.encoding !== 'base64' && !(this.serverUrl && !blob.encoding))) throw new Error('Git 服务未返回完整公共关卡文件');
        text = Buffer.from(blob.content, 'base64').toString('utf8');
        blobs[sha] = text;
      }
      // Revalidate cached bytes too; disk cache is not a trusted input boundary.
      learningGateContents.push({ ...parseLearningGateText(text, gateId, sha), ...scope });
    }
    const leafIndex = curriculumTopicIndex(builtinTopics, algorithmTopics, algorithmOverrides);
    const nodeContentFiles = (tree.tree as TreeEntry[]).filter(item => item.type === 'blob' && typeof item.path === 'string' && item.path.startsWith(ALGORITHM_NODE_CONTENT_PREFIX) && item.path.endsWith('.json'));
    if (nodeContentFiles.length > 10000) throw new Error('算法节点内容文件过多');
    const algorithmNodeContents: AlgorithmNodeContent[] = [], seenNodes = new Set<string>();
    for (const item of nodeContentFiles) {
      const content = parseAlgorithmNodeContentText(await readPublicBlob(item), item.sha);
      if (content.storageNodeId !== undefined || item.path !== algorithmNodeContentPath(content.nodeId)) throw new Error('算法节点内容文件名与标识不匹配');
      const storageNodeId = content.nodeId, nodeId = contentTargetFromIndex(storageNodeId, leafIndex);
      if (!nodeId) continue; // Deleted identities are ordinary absence; split identities retain their original file.
      if (seenNodes.has(nodeId)) throw new Error('算法节点内容标识重复');
      seenNodes.add(nodeId); algorithmNodeContents.push({ ...content, nodeId, ...(storageNodeId === nodeId ? {} : { storageNodeId }), ...scope });
    }
    return {
      tricks, algorithmTopics, algorithmOverrides, algorithmNodeContents, learningGateContents, learningCurriculum: curriculum,
      records: records.filter(r => r.kind === 'document'),
      algorithmNotes: records.filter(r => r.kind === 'algorithm-note').map(note => 'nodeId' in note ? { ...note, nodeId: leafIdFromIndex(note.nodeId, leafIndex) || note.nodeId } : note),
      issues: issues.filter(x => !x.pull_request && !/<!--\s*qmx-tag-request\s+[\s\S]*?-->/i.test(String(x.body || ''))).map(x => ({ ...issueRecord(x as Parameters<typeof issueRecord>[0]), ...scope })),
      blobs: Object.fromEntries([...docs, ...trickFiles, ...gateFiles, ...nodeContentFiles, ...(curriculumFile ? [curriculumFile] : []), ...(additions ? [additions] : []), ...(overrideFile ? [overrideFile] : [])].map(d => [d.sha, blobs[d.sha as string]])), branch, lastSync: new Date().toISOString(),
    };
  }

  // Legacy entry points now publish Markdown directly instead of opening Issues or PRs.
  async submit(record: unknown) { return this.saveDocument(record); }
  async propose(record: unknown) { return this.saveDocument(record); }

  async getTagCatalog() { return new Tags(this).getTagCatalog(); }
  async requestTag(data: unknown) { return new Tags(this).requestTag(data); }
  async getTagReview() { return new Tags(this).getTagReview(); }
  async reviewTag(data: unknown) { return new Tags(this).reviewTag(data); }

  async comments(number: unknown) {
    if (!Number.isInteger(Number(number)) || Number(number) < 1) throw new Error('无效题目编号');
    return this.pages(`/repos/${this.repo}/issues/${number}/comments`);
  }

  async comment(input: unknown) {
    const { number, body } = input as { number?: unknown; body?: string | null };
    if (!this.token) throw new Error('请先登录 GitHub');
    if (!body?.trim()) throw new Error('请填写评论');
    if (!Number.isInteger(Number(number)) || Number(number) < 1) throw new Error('无效题目编号');
    await this.request('/user');
    return (await this.request(`/repos/${this.repo}/issues/${number}/comments`, { method: 'POST', body: JSON.stringify({ body }) })).data;
  }
}

export { identify, parseDocument, parseAlgorithmNote, issueRecord, issueBody, documentContent };
