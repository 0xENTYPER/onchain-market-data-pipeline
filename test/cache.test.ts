import { describe, expect, it } from "vitest";
import { cacheKey, wrapSnapshot } from "../src/cache";
import type { MarketSnapshot } from "../src/model";

const snapshot: MarketSnapshot = {
  chain: "base",
  address: "0x21cfcfc3d8f98fc728f48341d10ad8283f6eb7ab",
  name: "Token",
  symbol: "TOK",
  imageUrl: null,
  priceUsd: 1,
  capitalization: { kind: "market-cap", usd: 1_000_000 },
  pair: { address: "pair", liquidityUsd: 100_000, volume24hUsd: 10_000 },
  quality: "validated",
  providers: ["fixture"],
  warnings: [],
  generatedAt: "2026-10-03T00:00:00Z"
};

describe("cache policy", () => {
  it("uses versioned and normalized keys", () => {
    expect(cacheKey("base", snapshot.address)).toBe(`market:v1:base:${snapshot.address}`);
  });

  it("separates fresh and stale windows", () => {
    const wrapped = wrapSnapshot(snapshot, 1_000_000);
    expect(wrapped.softExpiresAt).toBe(1_030_000);
    expect(wrapped.hardExpiresAt).toBe(1_300_000);
  });
});
