import type { PlatformCode, PlatformFetcher, PlatformPageReader } from './data-types.js';
export type { PlatformCode, PlatformFetcher, PlatformPageReader, PlatformRequestOptions } from './data-types.js';

/** Saved snapshots are passed through; nested stored fields are not validated here. */
export type PlatformSnapshot = Record<string, unknown>;

export interface PlatformServiceOptions {
  read(name: 'platforms.json', fallback: PlatformSnapshot): unknown;
  save(name: 'platforms.json', snapshot: PlatformSnapshot): void;
  fetcher?: PlatformFetcher;
  readPage?: PlatformPageReader;
  now?: () => string;
}

export interface PlatformService {
  state(): PlatformSnapshot;
  bind(platform: unknown, url: unknown): Promise<PlatformSnapshot>;
  refresh(platform: unknown): Promise<PlatformSnapshot>;
  unbind(platform: unknown): PlatformSnapshot;
  isBusy(): boolean;
}

// The generated service and collector live beside each other in electron/.
const { parseProfileLink, fetchPlatform } = require('./platform-data.cjs') as typeof import('./data.cjs');

// Bindings and public snapshots belong to this device, independently of GitHub login.
export function createPlatformService({ read, save, fetcher, readPage, now = () => new Date().toISOString() }: PlatformServiceOptions): PlatformService {
  const running = new Set<PlatformCode>();
  function state(): PlatformSnapshot {
    const value = read('platforms.json', {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value as PlatformSnapshot : {};
  }
  function code(value: unknown): asserts value is PlatformCode {
    if (value !== 'CF' && value !== 'AT' && value !== 'LG' && value !== 'NC' && value !== 'LC') throw new Error('不支持的平台');
  }
  function lock(platform: unknown): asserts platform is PlatformCode {
    code(platform);
    if (running.has(platform)) throw new Error('该平台正在查询，请稍候');
    running.add(platform);
  }
  async function bind(platform: unknown, url: unknown): Promise<PlatformSnapshot> {
    lock(platform);
    try {
      const binding = parseProfileLink(platform, url);
      const data = await fetchPlatform(binding, { fetcher, readPage });
      const next = state();
      next[platform] = { binding: { ...binding, username: data.username }, data, updatedAt: now(), attemptedAt: now(), error: '' };
      save('platforms.json', next);
      return state();
    } finally { running.delete(platform); }
  }
  async function refresh(platform: unknown): Promise<PlatformSnapshot> {
    lock(platform);
    try {
      // Only property access is described: preserve legacy optional access and spreading,
      // including malformed stored primitives, without asserting a persisted entry model.
      const entry = state()[platform] as { binding?: unknown } | null | undefined;
      if (!entry?.binding) throw new Error('请先绑定账号');
      try {
        const data = await fetchPlatform(entry.binding, { fetcher, readPage });
        const next = state();
        next[platform] = { ...entry, binding: { ...entry.binding as object, username: data.username }, data, updatedAt: now(), attemptedAt: now(), error: '' };
        save('platforms.json', next);
      } catch (error) {
        const next = state();
        // Keep the original direct message access, truthy fallback, coercion and limit.
        next[platform] = { ...entry, attemptedAt: now(), error: String((error as { message?: unknown }).message || '查询失败').slice(0, 500) };
        save('platforms.json', next);
      }
      return state();
    } finally { running.delete(platform); }
  }
  function unbind(platform: unknown): PlatformSnapshot {
    code(platform);
    if (running.has(platform)) throw new Error('该平台正在查询，请稍候');
    const next = state();
    delete next[platform];
    save('platforms.json', next);
    return state();
  }
  return { state, bind, refresh, unbind, isBusy: () => running.size > 0 };
}
