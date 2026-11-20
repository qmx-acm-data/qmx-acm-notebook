export interface NowcoderStatement {
  platform: 'NC';
  url: string;
  title: string;
  statementText: string;
  /** Escaped plain text only; safe to pass to an existing HTML statement view. */
  statementHtml: string;
  samples: { input: string; output: string; note: string }[];
}

export interface NowcoderStatementOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

type Fields = Record<string, unknown>;
function object(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Fields : null;
}

function canonicalUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('牛客题目链接无效'); }
  if (url.protocol !== 'https:' || url.hostname !== 'www.nowcoder.com' || url.port || url.username || url.password ||
      !/^\/practice\/[a-f0-9]{32}$/i.test(url.pathname)) throw new Error('仅支持牛客 HTTPS 公开题霸链接');
  // Topic/navigation parameters are deliberately not forwarded to the endpoint.
  return new URL(`https://www.nowcoder.com${url.pathname.toLowerCase()}`);
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (original, entity: string) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? original;
    const hex = entity[1].toLowerCase() === 'x';
    const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}

function plain(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

function htmlText(value: string): string {
  return plain(decodeEntities(value
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<img\b[^>]*>/gi, tag => {
      const match = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
      if (!match) return '[图片，请查看原题]';
      try {
        const url = new URL(decodeEntities(match[1] ?? match[2] ?? ''));
        if (url.origin === 'https://www.nowcoder.com' && url.pathname === '/equation') {
          return url.searchParams.get('tex') ?? '[公式，请查看原题]';
        }
      } catch { /* Unknown images remain a plain-text notice, never a resource request. */ }
      return '[图片，请查看原题]';
    })
    .replace(/<br\b[^>]*>|<\/(?:div|p|h[1-6]|li|tr|pre)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
  )).replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function parseNowcoderStatement(problemUrl: string, payload: unknown): NowcoderStatement {
  const url = canonicalUrl(problemUrl);
  const root = object(payload);
  const data = object(root?.data);
  const question = object(data?.question);
  if (root?.code !== 0 || root.msg !== 'OK' || !question) throw new Error('牛客未提供公开题面，可能需要登录或平台验证');
  if (question.paidQuestion !== false || question.visibility !== 100 || question.status !== 2 ||
      question.shield !== false || question.delete !== false || data?.onlyShowTips === true) {
    throw new Error('牛客题目不是可读取的公开免费题面');
  }
  if (typeof question.uuid !== 'string' || question.uuid.toLowerCase() !== url.pathname.split('/')[2] ||
      typeof question.title !== 'string' || typeof question.content !== 'string' ||
      typeof question.inputDesc !== 'string' || typeof question.outputDesc !== 'string' || !Array.isArray(question.samples)) {
    throw new Error('牛客公开题面响应格式无效');
  }
  const title = htmlText(question.title);
  const content = htmlText(question.content);
  if (!title || !content) throw new Error('牛客公开题面内容不完整');
  const samples = question.samples.map((value: unknown) => {
    const sample = object(value);
    if (!sample || typeof sample.input !== 'string' || typeof sample.output !== 'string' || typeof sample.note !== 'string') {
      throw new Error('牛客样例格式无效');
    }
    // Samples are already plain strings: do not strip literal <, > or decode entities.
    return { input: plain(sample.input), output: plain(sample.output), note: plain(sample.note) };
  });
  const sections = [content];
  const input = htmlText(question.inputDesc);
  const output = htmlText(question.outputDesc);
  if (input) sections.push(`输入描述\n${input}`);
  if (output) sections.push(`输出描述\n${output}`);
  samples.forEach((sample, index) => {
    sections.push(`示例 ${index + 1}\n输入\n${sample.input}\n输出\n${sample.output}${sample.note ? `\n说明\n${sample.note}` : ''}`);
  });
  const statementText = sections.join('\n\n');
  return { platform: 'NC', url: url.href, title, statementText, statementHtml: `<pre>${escapeHtml(statementText)}</pre>`, samples };
}

/** Public, unauthenticated read only. Never follows redirects or retries a platform challenge. */
export async function fetchNowcoderStatement(problemUrl: string, options: NowcoderStatementOptions = {}): Promise<NowcoderStatement> {
  const url = canonicalUrl(problemUrl);
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxBytes = options.maxBytes ?? 1_000_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000 ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > 1_500_000) throw new Error('牛客题面请求限制无效');
  const endpoint = `https://www.nowcoder.com/practice/terminal/${url.pathname.split('/')[2]}`;
  const response = await (options.fetcher ?? fetch)(endpoint, {
    signal: AbortSignal.timeout(timeoutMs), redirect: 'error', credentials: 'omit', headers: { accept: 'application/json' }
  });
  if (!response.ok || response.redirected) throw new Error(`牛客题面请求被拒绝：HTTP ${response.status}`);
  if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('牛客返回非 JSON 响应，未尝试绕过平台验证');
  if (!response.body) throw new Error('牛客题面响应为空');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('牛客题面超过大小限制'); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))); }
  catch { throw new Error('牛客题面 JSON 格式无效'); }
  return parseNowcoderStatement(url.href, payload);
}
