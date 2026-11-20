export type NowcoderTopicId = 295 | 383;

export interface NowcoderProblem {
  id: string;
  source: 'nowcoder';
  topicId: NowcoderTopicId;
  questionId: number;
  questionNo: string;
  title: string;
  url: string;
  difficulty: number | null;
  /** Nowcoder's own 1-5 scale; no cross-platform equivalence is claimed. */
  difficultyEstimated: false;
  acceptRate: number | null;
  tags: string[];
}

export interface NowcoderTopicPage {
  topicId: NowcoderTopicId;
  page: number;
  totalPage: number;
  totalCount: number;
  problems: NowcoderProblem[];
}

export interface NowcoderResult {
  problems: NowcoderProblem[];
  errors: { topicId: NowcoderTopicId; message: string }[];
}

type Fields = Record<string, unknown>;
function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}

/** Explicit heuristic only; Nowcoder's 1-5 scale is not a CF rating. */
export function estimateNowcoderCfRating(difficulty: number | null): number | null {
  if (difficulty === null || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) return null;
  return [800, 1200, 1600, 2000, 2400][difficulty - 1] ?? null;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function finiteRate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function parseProblem(value: unknown, expectedTopic: NowcoderTopicId): NowcoderProblem | null {
  const row = object(value);
  if (!row || row.tpId !== expectedTopic || !positiveInteger(row.questionId) ||
      typeof row.questionNo !== 'string' || !row.questionNo.trim() ||
      typeof row.questionTitle !== 'string' || !row.questionTitle.trim() ||
      typeof row.questionUUid !== 'string' || !/^[a-f0-9]{32}$/i.test(row.questionUUid)) return null;
  const difficulty = typeof row.difficulty === 'number' && Number.isInteger(row.difficulty) && row.difficulty >= 1 && row.difficulty <= 5 ? row.difficulty : null;
  const tags = Array.isArray(row.tags) ? row.tags.flatMap((value: unknown): string[] => {
    const tag = object(value);
    return typeof tag?.name === 'string' && tag.name.trim() ? [tag.name.trim()] : [];
  }) : [];
  return {
    id: `NC:${expectedTopic}:${row.questionId}`,
    source: 'nowcoder',
    topicId: expectedTopic,
    questionId: row.questionId,
    questionNo: row.questionNo.trim(),
    title: row.questionTitle.trim(),
    url: `https://www.nowcoder.com/practice/${row.questionUUid}?tpId=${expectedTopic}&tqId=${row.questionId}&sourceUrl=%2Fexam%2Foj`,
    difficulty,
    difficultyEstimated: false,
    acceptRate: finiteRate(row.acceptRate),
    tags: [...new Set(tags)]
  };
}

export function parseNowcoderTopicPage(payload: unknown, expectedTopic: NowcoderTopicId, page: number): NowcoderTopicPage {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('牛客分页页码无效');
  const root = object(payload);
  const data = object(root?.data);
  if (root?.code !== 0 || root?.msg !== 'OK' || !data || data.tpId !== undefined && data.tpId !== expectedTopic ||
      !positiveInteger(data.totalPage) || !positiveInteger(data.totalCount) || !Array.isArray(data.questions)) {
    throw new Error('牛客题库响应格式错误');
  }
  const problems = data.questions.flatMap((value: unknown): NowcoderProblem[] => {
    const parsed = parseProblem(value, expectedTopic);
    return parsed ? [parsed] : [];
  });
  return { topicId: expectedTopic, page, totalPage: data.totalPage, totalCount: data.totalCount, problems };
}

const endpoint = 'https://www.nowcoder.com/api/questiontraining/coding/getTopicQuestion';

export async function fetchNowcoderTopic(topic: NowcoderTopicId, fetcher: typeof fetch = fetch, timeoutMs = 15000, pageSize = 100): Promise<NowcoderProblem[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('牛客分页大小无效');
  const problems: NowcoderProblem[] = [];
  let totalPage = 1;
  for (let page = 1; page <= totalPage; page += 1) {
    const url = `${endpoint}?pageSize=${pageSize}&title=&topicId=${topic}&page=${page}`;
    const response = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit', headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseNowcoderTopicPage(await response.json() as unknown, topic, page);
    totalPage = parsed.totalPage;
    if (parsed.totalPage > 1000) throw new Error('牛客分页总页数异常');
    problems.push(...parsed.problems);
  }
  return [...new Map(problems.map(problem => [problem.id, problem])).values()];
}

export async function fetchNowcoderProblems(fetcher: typeof fetch = fetch, timeoutMs = 15000): Promise<NowcoderResult> {
  const problems: NowcoderProblem[] = [];
  const errors: { topicId: NowcoderTopicId; message: string }[] = [];
  for (const topic of [295, 383] as const) {
    try {
      problems.push(...await fetchNowcoderTopic(topic, fetcher, timeoutMs));
    } catch (error: unknown) {
      errors.push({ topicId: topic, message: error instanceof Error ? error.message : 'Unknown source error' });
    }
  }
  return { problems: [...new Map(problems.map(problem => [problem.id, problem])).values()], errors };
}
