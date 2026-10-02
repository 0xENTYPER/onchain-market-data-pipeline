<div align="center">

# Onchain Market Data Pipeline

### A Cloudflare Worker reference for normalizing unreliable multi-provider token data into an explainable edge API.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020) ![Storage](https://img.shields.io/badge/cache-Workers_KV-111827) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6) ![Data](https://img.shields.io/badge/data-quality_visible-16A085)

</div>

This repository demonstrates the backend layer behind a trustworthy multi-chain market interface: provider fan-out, normalization, canonical-pair selection, explicit MCAP/FDV semantics, edge caching, stale-while-revalidate, and visible data-quality states.

It is a runnable reference implementation, not production PNLFlex or Baggy source code. Private routes, credentials, paid providers, storage IDs, ranking configuration, and operational controls remain private.

## The problem

Onchain providers disagree in ways that directly affect product correctness:

- one token can have dozens of pools;
- providers return different metadata and images;
- the first pool is not necessarily the most representative one;
- market cap may be missing while FDV exists;
- APIs fail or rate-limit independently;
- an old but known response can be better than a blank screen;
- consumers need to know whether data is validated, partial, or degraded.

The pipeline converts that uncertainty into a stable API contract.

## Architecture

```mermaid
flowchart LR
    C[Client] --> W[Cloudflare Worker]
    W --> K{Workers KV}
    K -->|fresh| C
    K -->|stale| C
    K -->|stale| R[Background refresh]
    K -->|miss| P[Provider fan-out]
    R --> P
    P --> D[DexScreener]
    P --> G[GeckoTerminal]
    D --> N[Normalize and validate]
    G --> N
    N --> S[Canonical pair selection]
    S --> Q[Quality classification]
    Q --> K
```

## API

```text
GET /health
GET /v1/token/:chain/:address
```

Example:

```bash
curl http://localhost:8787/v1/token/base/0x4200000000000000000000000000000000000006
```

Every successful response includes the market snapshot, cache state, age, quality, providers, warnings, and a request ID:

```json
{
  "data": {
    "chain": "base",
    "symbol": "WETH",
    "priceUsd": 2663.3,
    "capitalization": {
      "kind": "market-cap",
      "usd": 701368898
    },
    "quality": "validated",
    "providers": ["dex-screener", "gecko-terminal"],
    "warnings": []
  },
  "cache": {
    "state": "fresh",
    "ageSeconds": 8
  },
  "requestId": "..."
}
```

Values in the example are illustrative and change with the market.

## Cache policy

| State | Behavior | Product meaning |
| --- | --- | --- |
| `fresh` | Return KV snapshot immediately | Recently refreshed data |
| `stale` | Return known snapshot and refresh with `ctx.waitUntil()` | Usable fallback with visible age |
| `miss` | Await providers before responding | No safe cached value exists |
| hard expired | Ignore the cache record | Old data must not silently survive |

KV is used through a Worker binding, not through Cloudflare's REST API. Cache writes are awaited when the response depends on them, while stale refreshes are explicitly passed to `ctx.waitUntil()`.

## Quality states

- **`validated`**: usable price, at least $100K canonical-pair liquidity, and more than one provider returned candidates.
- **`partial`**: usable price and at least $10K liquidity, but provider agreement or depth is limited.
- **`degraded`**: a result exists, but liquidity or pricing evidence is weak.

Quality is not a token safety score. It describes the evidence supporting the selected market snapshot.

## Failure behavior

The providers run with `Promise.allSettled()`. One timeout does not erase a usable result from another source. Provider failure is reflected in warnings and structured logs. If every source fails and no stale cache remains, the API returns `503 providers_unavailable` with a request ID.

## Cloudflare design decisions

| Decision | Reason |
| --- | --- |
| Worker binding for KV | Avoid REST authentication and an unnecessary network hop |
| Generated `Env` types | Keep code aligned with `wrangler.jsonc` bindings |
| `ctx.waitUntil()` for stale refresh | Return known data quickly while completing background work |
| Structured JSON logs | Make provider and refresh failures searchable |
| No request state in module globals | Worker isolates are reused across requests |
| `crypto.randomUUID()` request IDs | Use Web Crypto rather than predictable identifiers |
| Explicit hard expiry | Prevent stale data from becoming permanent truth |
| `no-store` client response | The API exposes its own freshness policy explicitly |

## Local development

```bash
npm install
npm run types
npm run check
npm test
npm run dev
```

Before deployment, create a KV namespace and replace the placeholder ID in `wrangler.jsonc`:

```bash
npx wrangler kv namespace create MARKET_CACHE
npx wrangler deploy
```

Secrets belong in Wrangler secrets or managed bindings, never in source control.

## Verification

The repository checks:

- strict TypeScript;
- generated Worker binding types;
- provider fallback behavior;
- canonical-pair selection;
- MCAP/FDV separation;
- metadata fallback behavior;
- fresh and stale cache boundaries;
- a Wrangler dry-run bundle.

```bash
npm run types
npm run check
npm test
npm run build
```

## References

- [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Workers KV read API](https://developers.cloudflare.com/kv/api/read-key-value-pairs/)
- [Workers KV write API](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [DexScreener API](https://docs.dexscreener.com/api/reference)
- [GeckoTerminal API](https://apiguide.geckoterminal.com/)

## Repository scope

This reference uses free public market-data endpoints and a placeholder KV namespace. It does not claim production SLA, audit status, token safety, or valuation accuracy. Provider terms and rate limits remain the responsibility of the deployer.

## Author

Built by [0xENTYPER](https://github.com/0xENTYPER).
