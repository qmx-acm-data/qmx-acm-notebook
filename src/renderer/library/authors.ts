import type { AppAccount, AppRecord } from '../../../types/app.js';

export interface RecordAuthor {
  name: string;
  avatarUrl: string | null;
  avatarData: string | null;
}

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
function identity(value: unknown): string | null {
  const id = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  return /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id)) ? id : null;
}
function githubSource(record: AppRecord): boolean {
  if (record.kind === 'local') return true;
  if (record.sourceKey) return record.sourceKey.startsWith('https://api.github.com|');
  return !record.serverUrl || /^https:\/\/(?:api\.)?github\.com\/?$/i.test(record.serverUrl);
}

/** Display metadata never establishes edit permission or record ownership. */
export function recordAuthor(record: AppRecord, account: AppAccount | null): RecordAuthor {
  const value = record.author && typeof record.author === 'object' ? record.author as { name?: unknown; login?: unknown } : null;
  const explicit = text(record.author) || text(value?.name) || text(value?.login);
  const owner = record.kind === 'local' ? identity(record.ownerId) : identity(record.authorId);
  const currentOwner = githubSource(record) && owner !== null && owner === identity(account?.id);
  const accountLogin = currentOwner ? text(account?.login) : '';
  const name = explicit || accountLogin || (record.kind === 'local' ? '本地学习者' : '匿名学习者');
  if (!githubSource(record)) return { name, avatarUrl: null, avatarData: null };
  // Unbound legacy records are device-local; never attribute them to whoever signs in next.
  const id = record.kind === 'local' ? identity(record.ownerId) : identity(record.authorId);
  const login = text(value?.login) || (record.kind === 'local' ? accountLogin : text(record.author));
  const validLogin = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(login) && !login.includes('--') && !['unknown', 'anonymous'].includes(login.toLowerCase());
  const avatarUrl = id ? `https://avatars.githubusercontent.com/u/${id}?s=64` : record.kind !== 'local' && validLogin ? `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=64` : null;
  const avatarData = currentOwner && typeof account?.avatarData === 'string' && /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(account.avatarData) ? account.avatarData : null;
  return { name, avatarUrl, avatarData };
}

export function recordAuthorName(record: AppRecord, account: AppAccount | null): string { return recordAuthor(record, account).name; }

export function authorAvatar(author: RecordAuthor): HTMLSpanElement {
  const avatar = document.createElement('span'); avatar.className = 'mini-avatar'; avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = author.name.slice(0, 1);
  const source = author.avatarData || author.avatarUrl;
  if (source) {
    const image = document.createElement('img'); image.alt = ''; image.referrerPolicy = 'no-referrer'; image.loading = 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = source; avatar.append(image);
  }
  return avatar;
}
