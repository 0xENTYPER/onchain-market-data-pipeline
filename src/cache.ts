import { FRESH_MS, KV_TTL_SECONDS, STALE_MS } from "./config";
import type { CachedSnapshot, MarketSnapshot } from "./model";

export function cacheKey(chain: string, address: string): string {
  return `market:v1:${chain}:${address}`;
}

export function wrapSnapshot(snapshot: MarketSnapshot, now: number): CachedSnapshot {
  return {
    snapshot,
    softExpiresAt: now + FRESH_MS,
    hardExpiresAt: now + STALE_MS
  };
}

export async function readCache(env: Env, key: string): Promise<CachedSnapshot | null> {
  return env.MARKET_CACHE.get<CachedSnapshot>(key, { type: "json", cacheTtl: 30 });
}

export async function writeCache(env: Env, key: string, value: CachedSnapshot): Promise<void> {
  await env.MARKET_CACHE.put(key, JSON.stringify(value), { expirationTtl: KV_TTL_SECONDS });
}
