export interface LibreOjProblem {
  id: string;
  title: string;
  url: string;
}

export interface LibreOjProblemPage {
  problems: LibreOjProblem[];
  page: number;
}

export interface LibreOjFetchResponse {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  text(): Promise<string>;
}

export type LibreOjFetcher = (url: string) => Promise<LibreOjFetchResponse>;

const LIST_URL = 'https://loj.ac/p';
const PAGE_LIMIT = 500;

function invalid(message: string): never {
  throw new Error(`LibreOJ public listing unavailable: ${message}`);
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' } as Record<string, string>)[entity.toLowerCase()];
    const hex = entity[1].toLowerCase() === 'x';
    const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) invalid('invalid HTML entity');
    return String.fromCodePoint(code);
  });
}

function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

export function parseLibreOjProblemPage(html: string, page = 1): LibreOjProblemPage {
  if (typeof html !== 'string' || html.length === 0) invalid('empty response');
  if (!Number.isSafeInteger(page) || page < 1 || page > PAGE_LIMIT) invalid('page is out of range');
  if (/Welcome to nginx!/i.test(html)) invalid('API host returned the nginx default page');

  const problems: LibreOjProblem[] = [];
  const links = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (const match of html.matchAll(links)) {
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[1]);
    const path = decodeEntities(href?.[1] ?? href?.[2] ?? href?.[3] ?? '');
    const idMatch = /^\/problem\/(\d+)$/.exec(path);
    if (!idMatch) continue;
    const title = text(match[2]);
    if (!title) continue;
    problems.push({ id: idMatch[1], title, url: `https://loj.ac/problem/${idMatch[1]}` });
  }

  if (problems.length === 0) invalid('no public problem links found in listing HTML');
  const unique = [...problems.reduce((byId, problem) => {
    if (!byId.has(problem.id)) byId.set(problem.id, problem);
    return byId;
  }, new Map<string, LibreOjProblem>()).values()];
  return { problems: unique, page };
}

export async function fetchLibreOjProblemPage(page = 1, fetcher: LibreOjFetcher = url => fetch(url) as unknown as Promise<LibreOjFetchResponse>): Promise<LibreOjProblemPage> {
  if (!Number.isSafeInteger(page) || page < 1 || page > PAGE_LIMIT) invalid('page is out of range');
  const url = new URL(LIST_URL);
  if (page > 1) url.searchParams.set('page', String(page));
  const response = await fetcher(url.href);
  if (!response.ok) invalid(`HTTP ${response.status}`);
  const contentType = response.headers?.get('content-type') ?? '';
  if (contentType && !/text\/html/i.test(contentType)) invalid(`unexpected content type ${contentType}`);
  return parseLibreOjProblemPage(await response.text(), page);
}
