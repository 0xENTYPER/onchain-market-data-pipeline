export type Chain = "ethereum" | "base" | "bsc" | "arbitrum" | "polygon" | "solana";
export type Quality = "validated" | "partial" | "degraded";
export type CacheState = "miss" | "fresh" | "stale";

export interface Candidate {
  provider: string;
  chain: Chain;
  address: string;
  pairAddress: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
}

export interface MarketSnapshot {
  chain: Chain;
  address: string;
  name: string | null;
  symbol: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  capitalization: {
    kind: "market-cap" | "fdv" | "unavailable";
    usd: number | null;
  };
  pair: {
    address: string;
    liquidityUsd: number | null;
    volume24hUsd: number | null;
  };
  quality: Quality;
  providers: string[];
  warnings: string[];
  generatedAt: string;
}

export interface CachedSnapshot {
  snapshot: MarketSnapshot;
  softExpiresAt: number;
  hardExpiresAt: number;
}

export interface ApiEnvelope {
  data: MarketSnapshot;
  cache: { state: CacheState; ageSeconds: number };
  requestId: string;
}
