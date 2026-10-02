import { cacheKey, readCache, wrapSnapshot, writeCache } from "./cache";
import type { ApiEnvelope, CacheState, Chain, MarketSnapshot } from "./model";
import { buildSnapshot } from "./pipeline";
import { normalizeAddress, parseChain } from "./validation";

function json(value: unknown, status = 200, extra: HeadersInit = {}): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store", ...extra }
  });
}

function envelope(data: MarketSnapshot, state: CacheState, requestId: string, now: number): ApiEnvelope {
  return {
    data,
    cache: {
      state,
      ageSeconds: Math.max(0, Math.floor((now - new Date(data.generatedAt).getTime()) / 1000))
    },
    requestId
  };
}

async function refresh(chain: Chain, address: string, env: Env, requestId: string): Promise<MarketSnapshot> {
  const snapshot = await buildSnapshot(chain, address);
  await writeCache(env, cacheKey(chain, address), wrapSnapshot(snapshot, Date.now()));
  console.log(JSON.stringify({ event: "market_refresh", requestId, chain, address, quality: snapshot.quality }));
  return snapshot;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    if (request.method !== "GET") return json({ error: "method_not_allowed", requestId }, 405);
    if (url.pathname === "/health") return json({ status: "ok", requestId });

    const match = url.pathname.match(/^\/v1\/token\/([^/]+)\/([^/]+)$/);
    if (!match) return json({ error: "not_found", requestId }, 404);
    const chain = parseChain(match[1] ?? "");
    if (!chain) return json({ error: "unsupported_chain", requestId }, 400);

    let address: string;
    try {
      address = normalizeAddress(chain, decodeURIComponent(match[2] ?? ""));
    } catch (error) {
      return json({ error: "invalid_address", message: String(error), requestId }, 400);
    }

    const now = Date.now();
    const key = cacheKey(chain, address);
    const cached = await readCache(env, key);
    if (cached && cached.softExpiresAt > now) {
      return json(envelope(cached.snapshot, "fresh", requestId, now), 200, { "x-data-cache": "fresh" });
    }
    if (cached && cached.hardExpiresAt > now) {
      ctx.waitUntil(refresh(chain, address, env, requestId).catch((error: unknown) => {
        console.error(JSON.stringify({ event: "market_refresh_failed", requestId, chain, address, error: String(error) }));
      }));
      return json(envelope(cached.snapshot, "stale", requestId, now), 200, { "x-data-cache": "stale" });
    }

    try {
      const snapshot = await refresh(chain, address, env, requestId);
      return json(envelope(snapshot, "miss", requestId, now), 200, { "x-data-cache": "miss" });
    } catch (error) {
      console.error(JSON.stringify({ event: "market_request_failed", requestId, chain, address, error: String(error) }));
      return json({ error: "providers_unavailable", requestId }, 503);
    }
  }
} satisfies ExportedHandler<Env>;
