/* Shared browser/Node helpers. Scores are relative relevance, not percentages. */

type SearchRecord = import('../../../types/search').SearchRecord;
type Difficulty = import('../../../types/search').Difficulty;
type Level = [Difficulty['tone'], string[]];

function text(value: unknown): string {
  return String(value == null ? '' : value).normalize('NFKC').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ς/g, 'σ').replace(/\s+/gu, ' ').trim();
}

function normalizePlatform(value: unknown): string {
  const name = text(value).replace(/[\s_-]/g, '');
  const aliases: Record<string, string> = { cf: 'CF', codeforces: 'CF', lg: 'LG', luogu: 'LG', '洛谷': 'LG', at: 'AT', atcoder: 'AT', nc: 'NC', nowcoder: 'NC', '牛客': 'NC', lc: 'LC', leetcode: 'LC', '力扣': 'LC', oth: 'Oth', other: 'Oth', '其他': 'Oth' };
  return aliases[name] || String(value == null ? '' : value).trim() || 'Oth';
}

const luoguLevels: Level[] = [
  ['red', ['入门']],
  ['orange', ['普及-', '普及减']],
  ['yellow', ['普及', '普及/提高-', '普及/提高减', '普及提高-']],
  ['green', ['普及+/提高-', '普及+/提高', '普及加/提高', '普及提高']],
  ['cyan', ['提高']],
  ['blue', ['提高+/省选-', '提高加/省选减', '提高/省选-', '提高省选-']],
  ['purple', ['省选/NOI-', '省选/NOI减', '省选NOI-']],
  ['black', ['NOI/NOI+/CTS', 'NOI/NOI+/CTSC', 'NOI+', 'NOI/CTSC', 'NOI', 'CTSC']]
];

function difficulty(input: unknown): Difficulty {
  const record = (input || {}) as SearchRecord;
  const code = normalizePlatform(record.platform);
  const native = String(record.difficulty == null ? '' : record.difficulty).trim();
  const hasRating = record.rating !== undefined && record.rating !== null && String(record.rating).trim() !== '' && Number.isFinite(Number(record.rating));
  let tone: Difficulty['tone'] = 'neutral', rank: Difficulty['rank'] = '', level: number | null = null;
  if (code === 'CF' && hasRating) {
    level = Number(record.rating);
    const tiers: [number, Difficulty['tone']][] = [[1200, 'gray'], [1400, 'green'], [1600, 'cyan'], [1900, 'blue'], [2100, 'purple'], [2300, 'orange'], [2400, 'orange'], [2600, 'red'], [3000, 'red']];
    const index = tiers.findIndex(function (tier) { return (level as number) < tier[0]; });
    tone = index < 0 ? 'red' : tiers[index][1];
    rank = index < 0 ? 'legendary' : index === 8 ? 'grandmaster' : '';
  } else if (code === 'LG' && native) {
    const name = text(native).replace(/[−–—﹣]/g, '-').replace(/\s/g, '');
    const index = luoguLevels.findIndex(function (entry) { return entry[1].some(function (alias) { return text(alias) === name; }); });
    if (index >= 0) { tone = luoguLevels[index][0]; level = index + 1; }
  } else if (code === 'LC' && native) {
    const name = text(native).replace(/[\s/()（）]/g, '');
    const levels: Level[] = [['green', ['easy', '简单', 'easy简单']], ['yellow', ['medium', '中等', 'medium中等']], ['red', ['hard', '困难', 'hard困难']]];
    const index = levels.findIndex(function (entry) { return entry[1].includes(name); });
    if (index >= 0) { tone = levels[index][0]; level = index + 1; }
  }
  const label = [hasRating ? (code === 'CF' ? 'CF ' : 'Rating ') + record.rating : '', native].filter(Boolean).join(' · ');
  return { tone: tone, rank: rank, label: label, native: native, level: level };
}

function compact(value: unknown): string { return text(value).replace(/[\s_-]/g, ''); }

function urlPid(value: unknown): string {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase();
    let parts: RegExpMatchArray | null;
    if (host === 'codeforces.com' || host.endsWith('.codeforces.com')) {
      parts = url.pathname.match(/^\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([a-z]\d*)\/?$/i);
      if (parts) return 'cf' + parts[1] + parts[2].toLowerCase();
    }
    if (host === 'luogu.com.cn' || host.endsWith('.luogu.com.cn') || host === 'luogu.org' || host.endsWith('.luogu.org')) {
      parts = url.pathname.match(/^\/problem\/([a-z]+\d+[a-z\d]*)\/?$/i);
      if (parts) return compact(parts[1]);
    }
  } catch (_) { /* A free-form pid is not a URL. */ }
  return '';
}

function identifiers(record: SearchRecord): string[] {
  const values = [record.pid, record.problemUrl, record.url, record.link];
  const ids = new Set<string>();
  values.forEach(function (value, index) {
    const pid = urlPid(value) || (index === 0 ? compact(value) : '');
    if (!pid) return;
    ids.add(pid);
    if (/^cf\d+[a-z]\d*$/.test(pid)) ids.add(pid.slice(2));
    else if (/^\d+[a-z]\d*$/.test(pid) && normalizePlatform(record.platform) === 'CF') ids.add('cf' + pid);
    if (/^p\d+$/.test(pid)) ids.add(pid.slice(1));
  });
  return Array.from(ids);
}

function queryText(query: unknown): string {
  return text(query)
    .replace(/https?:\/\/[^\s]+/g, function (url) { return urlPid(url) || url; })
    .replace(/\bcf[\s_-]*(\d+)[\s_-]*([a-z]\d*)\b/g, 'cf$1$2')
    .replace(/\b(\d+)[\s_-]+([a-z]\d*)\b/g, '$1$2')
    .replace(/\bp[\s_-]+(\d+)\b/g, 'p$1');
}

function match(input: unknown, query: unknown): number {
  const phrase = queryText(query);
  if (!phrase) return 1;
  const record = (input || {}) as SearchRecord;
  const terms = Array.from(new Set(phrase.split(/\s+/u)));
  const ids = identifiers(record);
  const title = text(record.title);
  const tags = text(Array.isArray(record.tags) ? (record.tags as unknown[]).join(' ') : record.tags);
  const author = text(typeof record.author === 'object' && record.author ? [(record.author as { name?: unknown; login?: unknown }).name, (record.author as { name?: unknown; login?: unknown }).login].filter(Boolean).join(' ') : record.author);
  const body = text(record.body);
  const metadata = text([record.platform, normalizePlatform(record.platform), record.rating, record.difficulty].filter(value => value != null).join(' '));
  let score = 0;
  for (const term of terms) {
    const pid = compact(term);
    let hit = 0;
    if (ids.includes(pid)) hit = 10000;
    else if (pid && ids.some(function (id) { return id.startsWith(pid); })) hit = 2500;
    if (title === term) hit = Math.max(hit, 1000);
    else if (title.startsWith(term)) hit = Math.max(hit, 700);
    else if (title.includes(term)) hit = Math.max(hit, 500);
    if (tags.includes(term)) hit = Math.max(hit, 300);
    if (author.includes(term)) hit = Math.max(hit, 200);
    if (metadata.includes(term)) hit = Math.max(hit, 100);
    if (body.includes(term)) hit = Math.max(hit, 50);
    if (!hit) return 0;
    score += hit;
  }
  // A contiguous title phrase outranks the same words scattered through it.
  if (terms.length > 1 && title.includes(phrase)) score += 1200;
  else if (terms.length > 1 && body.includes(phrase)) score += 20;
  return score;
}

function tagHits(input: unknown, selected: unknown): number {
  const record = input as SearchRecord | null | undefined;
  const wanted: Set<unknown> = selected instanceof Set ? selected : new Set((selected || []) as Iterable<unknown>);
  return Array.from(new Set(Array.isArray(record?.tags) ? (record.tags as unknown[]).map(String) : [])).filter(tag => wanted.has(tag)).length;
}
export const Search = { normalizePlatform: normalizePlatform, difficulty: difficulty, match: match, tagHits: tagHits };
