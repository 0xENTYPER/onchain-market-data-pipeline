import type { Candidate, Chain, MarketSnapshot, Quality } from "./model";
import { dexScreener, geckoTerminal } from "./providers";

function score(candidate: Candidate): number {
  const liquidity = Math.log10(Math.max(1, candidate.liquidityUsd ?? 0)) * 14;
  const volume = Math.log10(Math.max(1, candidate.volume24hUsd ?? 0)) * 8;
  return 100 + liquidity + volume + (candidate.priceUsd ? 20 : 0) + (candidate.marketCapUsd ? 12 : 0);
}

function first<T>(items: Candidate[], read: (item: Candidate) => T | null): T | null {
  for (const item of items) {
    const value = read(item);
    if (value !== null) return value;
  }
  return null;
}

function qualityFor(selected: Candidate, providerCount: number): Quality {
  if ((selected.liquidityUsd ?? 0) >= 100_000 && selected.priceUsd !== null && providerCount > 1) {
    return "validated";
  }
  if (selected.priceUsd !== null && (selected.liquidityUsd ?? 0) >= 10_000) return "partial";
  return "degraded";
}

export async function buildSnapshot(
  chain: Chain,
  address: string,
  fetcher: typeof fetch = fetch,
  now: () => Date = () => new Date()
): Promise<MarketSnapshot> {
  const settled = await Promise.allSettled([
    dexScreener(chain, address, fetcher),
    geckoTerminal(chain, address, fetcher)
  ]);
  const candidates = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (candidates.length === 0) {
    throw new Error("No provider returned a usable base-oriented pool");
  }
  const ranked = [...candidates].sort((a, b) => score(b) - score(a));
  const selected = ranked[0];
  if (!selected) throw new Error("Candidate selection failed");
  const providers = [...new Set(candidates.map((candidate) => candidate.provider))];
  const marketCap = first(ranked, (item) => item.marketCapUsd);
  const fdv = first(ranked, (item) => item.fdvUsd);
  const warnings: string[] = [];
  if (marketCap === null && fdv !== null) warnings.push("Market cap unavailable; capitalization is explicitly FDV");
  if ((selected.liquidityUsd ?? 0) < 10_000) warnings.push("Canonical pair has low or unknown liquidity");
  for (const [index, result] of settled.entries()) {
    if (result.status === "rejected") warnings.push(`Provider ${index + 1} failed; response uses available fallbacks`);
  }

  return {
    chain,
    address,
    name: first(ranked, (item) => item.name),
    symbol: first(ranked, (item) => item.symbol),
    imageUrl: first(ranked, (item) => item.imageUrl),
    priceUsd: selected.priceUsd,
    capitalization: marketCap !== null
      ? { kind: "market-cap", usd: marketCap }
      : fdv !== null ? { kind: "fdv", usd: fdv } : { kind: "unavailable", usd: null },
    pair: {
      address: selected.pairAddress,
      liquidityUsd: selected.liquidityUsd,
      volume24hUsd: selected.volume24hUsd
    },
    quality: qualityFor(selected, providers.length),
    providers,
    warnings,
    generatedAt: now().toISOString()
  };
}
