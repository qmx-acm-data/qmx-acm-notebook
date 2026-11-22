import { randomUUID } from 'node:crypto';
import type { DailyDrawProblem } from '../../shared/models/daily-problem.js';
import type { ProblemEnrichmentView, ProblemSupplement, ProblemSupplementFields, ProblemSuggestion } from '../../shared/models/problem-enrichment.js';

export interface ProblemEnrichmentOptions {
  read(): unknown;
  save(value: unknown): void;
  findProblem(url: string): DailyDrawProblem | null;
  now?: () => string | number | Date;
}
export interface ProblemEnrichment {
  view(url: string): ProblemEnrichmentView;
  saveSupplement(input: unknown): ProblemEnrichmentView;
  removeSupplement(input: unknown): ProblemEnrichmentView;
  storeSuggestion(url: string, fields: unknown, model: string): ProblemEnrichmentView;
  apply(problem: DailyDrawProblem): DailyDrawProblem;
  /** Revalidate the device cache once before a batch of apply() calls. */
  refresh(): void;
}
type Fields = Record<string, unknown>;
interface Store { root: Fields; records: Fields; suggestions: Fields }
const has = (value: object, key: string): boolean => Object.hasOwn(value, key);
// Retain the daily filter's finer levels and historical aliases alongside native Luogu names.
const levels = ['暂无评定', '入门', '普及−', '普及', '普及/提高−', '普及+/提高−', '普及+/提高', '提高', '提高+/省选−', '省选/NOI−', 'NOI/NOI+/CTSC', 'NOI/NOI+/CTS'];
const fieldKeys = ['tags', 'cfRating', 'luoguDifficulty', 'reason'];
function object(value: unknown): value is Fields { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, name: string, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) || (!empty && !value.trim())) throw new Error(`${name}格式无效或超过 ${max} 个字符`);
  return value.trim();
}
function revision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('补充信息版本无效');
  return value;
}
function date(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('补充信息时间无效');
  return value;
}
function tags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error('标签最多 30 个');
  const result = value.map(item => {
    const name = text(item, '标签', 100);
    if (!/[\p{L}]/u.test(name) || /[\r\n\t<>={}\\]|https?:|www\./iu.test(name)
      || /^(?:\d{2,4}|[〇零一二三四五六七八九十]{2,8})\s*(?:年(?:份|度)?)?$/u.test(name)
      || /^(?:来源|题目来源|年份|时间|地区|题型|传统题|交互题|交互|提交答案题?|特殊题目|special judge|interactive|output only|unknown|none|null|undefined)$/iu.test(name)) throw new Error('标签名称格式无效或属于非算法元数据');
    return name;
  });
  return [...new Set(result)];
}
function supplementFields(value: unknown): ProblemSupplementFields {
  if (!object(value)) throw new Error('补充信息字段无效');
  const result: ProblemSupplementFields = { reason: text(value.reason, '补充理由', 4000) };
  if (has(value, 'tags')) result.tags = tags(value.tags);
  if (has(value, 'cfRating')) {
    if (value.cfRating !== null && (typeof value.cfRating !== 'number' || !Number.isInteger(value.cfRating) || value.cfRating < 800 || value.cfRating > 3500)) throw new Error('CF 估计评分必须为 800–3500 的整数');
    result.cfRating = value.cfRating;
  }
  if (has(value, 'luoguDifficulty')) {
    const level = text(value.luoguDifficulty, '洛谷参考难度', 40).replace(/-/g, '−');
    if (!levels.includes(level)) throw new Error('洛谷参考难度无效');
    result.luoguDifficulty = level;
  }
  if (!result.tags?.length && result.cfRating == null && (!result.luoguDifficulty || result.luoguDifficulty === '暂无评定')) throw new Error('请提供至少一项补充标签或难度');
  return result;
}

/** One device-local key per official platform problem, independent of library/repository. */
export function canonicalProblemUrl(value: unknown): string {
  const raw = text(value, '题目链接', 2048);
  if (!/^https:\/\//i.test(raw) || /[\s\\]/.test(raw)) throw new Error('仅支持官方 HTTPS 题目链接');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('题目链接无效'); }
  if (url.username || url.password || url.port) throw new Error('题目链接不能包含凭据或端口');
  const host = url.hostname, route = url.pathname.replace(/\/$/, '');
  let match: RegExpExecArray | null;
  if (['codeforces.com', 'www.codeforces.com', 'contest.codeforces.com'].includes(host)) {
    match = /^\/(?:problemset\/problem\/(\d+)\/([A-Za-z0-9]+)|contest\/(\d+)\/problem\/([A-Za-z0-9]+)|gym\/(\d+)\/problem\/([A-Za-z0-9]+))$/.exec(route);
    if (match) return match[5] ? `https://codeforces.com/gym/${match[5]}/problem/${match[6].toUpperCase()}` : `https://codeforces.com/problemset/problem/${match[1] ?? match[3]}/${(match[2] ?? match[4]).toUpperCase()}`;
  } else if (['atcoder.jp', 'www.atcoder.jp'].includes(host)) {
    match = /^\/contests\/([a-zA-Z0-9_-]+)\/tasks\/([a-zA-Z0-9_-]+)$/.exec(route);
    if (match) return `https://atcoder.jp/contests/${match[1]}/tasks/${match[2]}`;
  } else if (['luogu.com.cn', 'www.luogu.com.cn', 'luogu.com', 'www.luogu.com'].includes(host)) {
    match = /^\/problem\/([A-Za-z0-9_-]+)$/.exec(route);
    if (match) return `https://www.luogu.com.cn/problem/${match[1].toUpperCase()}`;
  } else if (['leetcode.com', 'www.leetcode.com', 'leetcode.cn', 'www.leetcode.cn'].includes(host)) {
    match = /^\/problems\/([a-z0-9-]+)(?:\/(?:description|solutions|submissions|discuss))?$/.exec(route);
    if (match) return `https://leetcode.com/problems/${match[1]}/`;
  } else if (['ac.nowcoder.com', 'www.nowcoder.com', 'nowcoder.com'].includes(host)) {
    const practice = /^\/practice\/([a-fA-F0-9]{32})$/.exec(route);
    if (practice) return `https://www.nowcoder.com/practice/${practice[1].toLowerCase()}`;
    match = /^\/acm\/(problem\/\d+|contest\/\d+\/[A-Za-z0-9]+)$/.exec(route);
    if (match) return `https://ac.nowcoder.com/acm/${match[1]}`;
  } else if (['loj.ac', 'www.loj.ac'].includes(host)) {
    match = /^\/p\/(\d+)$/.exec(route);
    if (match) return `https://loj.ac/p/${match[1]}`;
  }
  throw new Error('仅支持六个平台的官方题目链接');
}
function platform(url: string): string {
  const host = new URL(url).hostname;
  return host === 'codeforces.com' ? 'CF' : host === 'atcoder.jp' ? 'AT' : host === 'www.luogu.com.cn' ? 'LG' : host === 'leetcode.com' ? 'LC' : ['ac.nowcoder.com', 'www.nowcoder.com'].includes(host) ? 'NC' : 'LOJ';
}
function approved(value: unknown, url: string): ProblemSupplement | null {
  if (!object(value) || value.url !== url || revision(value.revision) < 1) throw new Error('补充信息记录无效');
  date(value.updatedAt);
  if (value.removed === true) return null;
  if (value.status !== 'approved' || !['manual', 'ai'].includes(String(value.source))) throw new Error('补充信息审批状态无效');
  const result: ProblemSupplement = { ...supplementFields(value), url, revision: revision(value.revision), source: value.source === 'ai' ? 'ai' : 'manual', status: 'approved', updatedAt: date(value.updatedAt) };
  if (value.source === 'ai') result.model = text(value.model, '模型名称', 200);
  return result;
}
function suggestion(value: unknown, url: string): ProblemSuggestion {
  if (!object(value) || value.url !== url || value.source !== 'ai' || value.status !== 'pending') throw new Error('AI 待审核记录无效');
  return { ...supplementFields(value), id: text(value.id, '建议 ID', 128), url, source: 'ai', status: 'pending', model: text(value.model, '模型名称', 200), createdAt: date(value.createdAt) };
}
function official(problem: DailyDrawProblem): { officialTags: string[]; officialDifficulty: string | null } {
  const officialTags = problem.officialTags ?? problem.tags;
  const legacyDifficulty = object(problem) ? problem.nativeDifficulty ?? problem.difficulty : undefined;
  const officialDifficulty = problem.officialDifficulty !== undefined ? problem.officialDifficulty
    : problem.source === 'CF' && problem.rating !== null ? String(problem.rating)
    : problem.luoguDifficulty && problem.luoguDifficulty !== '暂无评定' ? problem.luoguDifficulty
    : typeof legacyDifficulty === 'string' && legacyDifficulty.trim() && legacyDifficulty !== '暂无评定' ? legacyDifficulty.trim()
    : typeof legacyDifficulty === 'number' && Number.isFinite(legacyDifficulty) && legacyDifficulty > 0 ? String(legacyDifficulty) : null;
  return { officialTags: [...officialTags], officialDifficulty };
}
function sameFields(a: ProblemSupplementFields, b: ProblemSupplementFields): boolean {
  return JSON.stringify(a.tags) === JSON.stringify(b.tags) && a.cfRating === b.cfRating && a.luoguDifficulty === b.luoguDifficulty && a.reason === b.reason;
}
function only(value: unknown, allowed: string[]): asserts value is Fields {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('补充信息操作参数无效');
}

/** Views/writes refresh storage; apply uses the last validated snapshot for batch processing. */
export function createProblemEnrichment({ read, save, findProblem, now = () => new Date().toISOString() }: ProblemEnrichmentOptions): ProblemEnrichment {
  let cached: Store | undefined;
  function remember(store: Store): Store {
    cached = { root: { ...store.root }, records: { ...store.records }, suggestions: { ...store.suggestions } };
    return store;
  }
  function state(): Store {
    cached = undefined;
    let raw: unknown;
    try { raw = read(); } catch { throw new Error('题目补充缓存读取失败，原文件已保留'); }
    if (raw === undefined) return remember({ root: { schema: 1 }, records: {}, suggestions: {} });
    try {
      if (!object(raw) || raw.schema !== 1 || !object(raw.records) || !object(raw.suggestions)) throw new Error('schema');
      for (const [key, entry] of Object.entries(raw.records)) {
        if (canonicalProblemUrl(key) !== key) throw new Error('key');
        approved(entry, key);
      }
      for (const [key, entry] of Object.entries(raw.suggestions)) {
        if (canonicalProblemUrl(key) !== key) throw new Error('key');
        suggestion(entry, key);
      }
      return remember({ root: { ...raw }, records: { ...raw.records }, suggestions: { ...raw.suggestions } });
    } catch { throw new Error('题目补充缓存损坏或版本不支持，拒绝覆盖原文件'); }
  }
  function resolve(value: unknown): { url: string; problem: DailyDrawProblem } {
    const url = canonicalProblemUrl(value), problem = findProblem(url);
    if (!problem || canonicalProblemUrl(problem.url) !== url || problem.source !== platform(url)) throw new Error('题目不在可信本地题库中');
    return { url, problem };
  }
  function getRevision(store: Store, url: string): number {
    const entry = store.records[url];
    return object(entry) ? revision(entry.revision) : 0;
  }
  function snapshot(store: Store, url: string, problem: DailyDrawProblem): ProblemEnrichmentView {
    const metadata = official(problem);
    return { url, title: problem.title, platform: problem.source, ...metadata, revision: getRevision(store, url), canSupplementTags: metadata.officialTags.length === 0, canSupplementDifficulty: metadata.officialDifficulty === null, supplement: has(store.records, url) ? approved(store.records[url], url) : null, suggestion: has(store.suggestions, url) ? suggestion(store.suggestions[url], url) : null };
  }
  function checkFields(problem: DailyDrawProblem, fields: ProblemSupplementFields): void {
    const metadata = official(problem);
    if (fields.tags?.length && metadata.officialTags.length) throw new Error('官方标签已存在，不能补充或覆盖');
    if ((fields.cfRating != null || (fields.luoguDifficulty && fields.luoguDifficulty !== '暂无评定')) && metadata.officialDifficulty !== null) throw new Error('官方难度已存在，不能补充或覆盖');
  }
  function timestamp(): string {
    const value = now();
    return date(typeof value === 'string' ? value : new Date(value).toISOString());
  }
  function persist(store: Store): void {
    save({ ...store.root, schema: 1, records: store.records, suggestions: store.suggestions });
    remember(store);
  }
  function checkRevision(store: Store, url: string, expected: unknown): number {
    const current = getRevision(store, url);
    if (revision(expected) !== current) throw new Error('补充信息已被更新，请刷新后重试');
    if (current >= Number.MAX_SAFE_INTEGER) throw new Error('补充信息版本已达上限');
    return current;
  }
  return {
    view(value) { const store = state(), { url, problem } = resolve(value); return snapshot(store, url, problem); },
    saveSupplement(input) {
      only(input, ['url', 'expectedRevision', 'suggestionId', ...fieldKeys]);
      const store = state(), { url, problem } = resolve(input.url);
      const currentRevision = checkRevision(store, url, input.expectedRevision), fields = supplementFields(input);
      checkFields(problem, fields);
      let pending: ProblemSuggestion | null = null;
      if (has(input, 'suggestionId')) {
        pending = has(store.suggestions, url) ? suggestion(store.suggestions[url], url) : null;
        if (!pending || pending.id !== input.suggestionId || !sameFields(fields, pending)) throw new Error('AI 建议已失效或内容不一致，请按手动补充保存');
      }
      const previous = has(store.records, url) ? approved(store.records[url], url) : null;
      const source = pending ? 'ai' : 'manual';
      if (previous && previous.source === source && previous.model === pending?.model && sameFields(previous, fields)) {
        if (pending) { delete store.suggestions[url]; persist(store); }
        return snapshot(store, url, problem);
      }
      const previousRaw = store.records[url];
      const next: Fields = { ...(object(previousRaw) ? previousRaw : {}), ...fields, url, source, status: 'approved', revision: currentRevision + 1, updatedAt: timestamp() };
      for (const key of fieldKeys) if (!has(fields, key)) delete next[key];
      delete next.removed;
      delete next.model;
      if (pending) next.model = pending.model;
      store.records[url] = next;
      if (pending) delete store.suggestions[url];
      persist(store);
      return snapshot(store, url, problem);
    },
    removeSupplement(input) {
      only(input, ['url', 'expectedRevision']);
      const store = state(), { url, problem } = resolve(input.url), current = checkRevision(store, url, input.expectedRevision);
      const previous = store.records[url];
      if (!previous || (object(previous) && previous.removed === true)) return snapshot(store, url, problem);
      const next: Fields = { ...(object(previous) ? previous : {}), url, revision: current + 1, updatedAt: timestamp(), removed: true };
      for (const key of [...fieldKeys, 'source', 'status', 'model']) delete next[key];
      store.records[url] = next;
      persist(store);
      return snapshot(store, url, problem);
    },
    storeSuggestion(value, fieldsInput, modelInput) {
      only(fieldsInput, fieldKeys);
      const store = state(), { url, problem } = resolve(value), fields = supplementFields(fieldsInput), model = text(modelInput, '模型名称', 200);
      checkFields(problem, fields);
      const previous = store.suggestions[url];
      if (previous) {
        const pending = suggestion(previous, url);
        if (pending.model === model && sameFields(pending, fields)) return snapshot(store, url, problem);
      }
      const next: Fields = { ...(object(previous) ? previous : {}), ...fields, id: randomUUID(), url, source: 'ai', status: 'pending', model, createdAt: timestamp() };
      for (const key of fieldKeys) if (!has(fields, key)) delete next[key];
      store.suggestions[url] = next;
      persist(store);
      return snapshot(store, url, problem);
    },
    refresh() { state(); },
    apply(problem) {
      const store = cached ?? state();
      let url: string;
      try { url = canonicalProblemUrl(problem.url); } catch { return problem; }
      if (problem.source !== platform(url) || !has(store.records, url)) return problem;
      const fields = approved(store.records[url], url);
      if (!fields) return problem;
      const metadata = official(problem), supplementTags = fields.tags ?? [], useTags = metadata.officialTags.length === 0 && supplementTags.length > 0;
      const useDifficulty = metadata.officialDifficulty === null && (fields.cfRating != null || Boolean(fields.luoguDifficulty && fields.luoguDifficulty !== '暂无评定'));
      if (!useTags && !useDifficulty) return problem;
      return { ...problem, ...metadata,
        ...(useTags ? { tags: [...supplementTags] } : {}),
        ...(useDifficulty ? { estimatedCfRating: fields.cfRating ?? problem.estimatedCfRating, estimatedLuoguDifficulty: fields.luoguDifficulty && fields.luoguDifficulty !== '暂无评定' ? fields.luoguDifficulty : problem.estimatedLuoguDifficulty, ratingEstimateReason: `${fields.source === 'ai' ? 'AI 建议（已确认）' : '手动补充'}：${fields.reason}` } : {}),
        supplementInfo: { source: fields.source, revision: fields.revision, tags: useTags, difficulty: useDifficulty }
      };
    }
  };
}
