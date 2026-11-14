import * as YAML from 'yaml';

type Fields = Record<string, unknown>;
type DocumentRecord = import('../../shared/models/records').DocumentRecord;
type IssueRecord = import('../../shared/models/records').IssueRecord;
type AlgorithmNoteRecord = import('../../shared/models/records').AlgorithmNoteRecord;
type KnownFields<T> = { [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K] };
/** Last spread wins, including caller overrides of parser fields. */
export type ParsedDocument<T extends Fields = Record<never, never>> = Omit<KnownFields<DocumentRecord>, keyof T> & T;
export type ParsedAlgorithmNote<T extends Fields = Record<never, never>> = Omit<ParsedDocument<T>, 'kind' | 'noteScope' | 'nodeId' | 'featured'> & Pick<AlgorithmNoteRecord, 'kind' | 'noteScope' | 'nodeId' | 'featured'>;

interface IssueInput extends Fields {
  body?: string | null;
  labels?: (string | { name?: unknown })[] | null;
  user?: { login?: unknown; id?: unknown } | null;
}
export function identify(url: unknown) {
  try {
    const u = new URL(url as string);
    let m;
    if (/(^|\.)codeforces\.com$/.test(u.hostname)) {
      m = u.pathname.match(/\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Za-z]\d*)/);
      if (m) return { pid: `CF${m[1]}${m[2].toUpperCase()}`, platform: 'CF' };
    }
    if (u.hostname === 'atcoder.jp' && (m = u.pathname.match(/\/tasks\/([\w-]+)/))) return { pid: m[1], platform: 'AT' };
    if (/(^|\.)luogu\.com\.cn$/.test(u.hostname) && (m = u.pathname.match(/\/problem\/([\w-]+)/))) return { pid: m[1], platform: 'LG' };
    if (/(^|\.)nowcoder\.com$/.test(u.hostname)) return { pid: u.pathname.split('/').filter(Boolean).slice(-2).join('-'), platform: 'NC' };
    return { pid: '', platform: 'Oth' };
  } catch { return { pid: '', platform: 'Oth' }; }
}
export function frontmatter(text: unknown, strict = false): { meta: Fields; body: string } {
  const source = String(text).replace(/^\uFEFF/, '');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { meta: {}, body: source };
  try {
    const meta = YAML.parse(match[1]) || {};
    if (typeof meta !== 'object' || Array.isArray(meta)) throw new Error('元数据必须是对象');
    return { meta: meta as Fields, body: source.slice(match[0].length) };
  } catch (error) {
    if (strict) throw new Error(`Markdown 元数据无法解析：${(error as Error).message}`);
    return { meta: {}, body: source.slice(match[0].length) };
  }
}
export function authorId(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}
export function parseDocument<T extends Fields = Record<never, never>>(path: string, text: unknown, extra = {} as T): ParsedDocument<T> {
  const { meta, body } = frontmatter(text);
  const record = {
    id: `document:${path}`, kind: 'document' as const, path,
    title: String(meta.title || path.split('/').pop()!.replace(/\.md$/i, '')),
    pid: String(meta.pid || ''), platform: String(meta.platform || (path.startsWith('algorithms/') ? '算法' : 'Oth')),
    rating: Number(meta.rating) > 0 && Number.isFinite(Number(meta.rating)) ? Number(meta.rating) : null,
    difficulty: String(meta.difficulty || ''), luoguDifficulty: String(meta.luoguDifficulty || ''), tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
    author: String(meta.author || '未知'), authorId: authorId(meta.author_id),
    problemUrl: String(meta.problem_url || meta.problemUrl || ''), clientId: String(meta.client_id || ''),
    managed: meta.schema === 2 && authorId(meta.author_id) !== null,
    schema: meta.schema ?? null, body, updatedAt: String(meta.updated_at || meta.date || ''), ...extra
  };
  return record as ParsedDocument<T>;
}
export function issueRecord(x: IssueInput): IssueRecord {
  const text = x.body || '';
  const metaMatch = text.match(/<!-- qmx-record\s*([\s\S]*?)\s*-->/);
  let meta: Fields = {};
  if (metaMatch) { try { meta = JSON.parse(metaMatch[1]) as Fields; } catch {} }
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
export function issueBody(record: Fields): string {
  const found = identify(record.problemUrl || record.url || '');
  const meta = { schema: 1, pid: record.pid || found.pid, platform: record.platform || found.platform, tags: record.tags || [], problemUrl: record.problemUrl || '', cohort: record.cohort || '', rating: Number(record.rating) > 0 ? Number(record.rating) : null, difficulty: record.difficulty || '', luoguDifficulty: record.luoguDifficulty || '' };
  const text = `<!-- qmx-record ${JSON.stringify(meta).replace(/-->/g, '')} -->\n\n${record.problemUrl ? `题目链接：${record.problemUrl}\n\n` : ''}## 错因\n\n${record.reason || ''}\n\n## 题解与代码\n\n${record.solution || ''}\n\n## 个人 trick\n\n${record.trick || ''}`;
  if (text.length > 60000) throw new Error('内容过长，请控制在 60000 字符以内');
  return text;
}
export function documentContent(r: Fields, author: unknown) {
  const found = identify(r.problemUrl || '');
  const pid = r.pid || found.pid;
  if (!pid) throw new Error('正式题解需要题号，请补充题号');
  const platform = r.platform || found.platform;
  return { platform, pid, text: `---\n${YAML.stringify({ pid, title: r.title || pid, platform, rating: Number(r.rating) > 0 ? Number(r.rating) : null, difficulty: r.difficulty || '', luoguDifficulty: r.luoguDifficulty || '', tags: r.tags || [], author, date: new Date().toISOString().slice(0, 10) })}---\n\n# 题意\n\n${r.problemUrl || ''}\n\n## 思路\n\n${r.solution || ''}\n\n## 正确性\n\n${r.proof || '待补充'}\n\n## 复杂度\n\n${r.complexity || '待补充'}\n\n## 易错点\n\n${r.reason || ''}\n\n## 个人 trick\n\n${r.trick || ''}\n` };
}
export function validatePath(path: unknown): string {
  if (typeof path !== 'string' || !/^(problems|algorithms)\/.+\.md$/i.test(path)
    || /[\\%?#\u0000-\u001f\u007f]/.test(path)
    || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('文档路径必须位于 problems/ 或 algorithms/ 下，使用 .md 扩展名且不能包含路径穿越');
  }
  return path;
}
export function parseAlgorithmNote<T extends Fields = Record<never, never>>(path: string, text: unknown, extra = {} as T): ParsedAlgorithmNote<T> {
  const record = parseDocument(path, text, extra);
  const { meta } = frontmatter(text);
  return { ...record, kind: 'algorithm-note', noteScope: meta.note_scope === 'public' ? 'public' : 'personal', nodeId: String(meta.node_id || 'root'), featured: meta.featured === true } as ParsedAlgorithmNote<T>;
}
export function samePayload(a: unknown, b: unknown): boolean {
  const comparable = (text: unknown) => {
    const { meta, body } = frontmatter(text, true);
    delete meta.updated_at;
    const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable((value as Fields)[key])])) : value;
    return JSON.stringify({ meta: stable(meta), body });
  };
  return comparable(a) === comparable(b);
}
