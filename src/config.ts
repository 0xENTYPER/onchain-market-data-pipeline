import type { Chain } from "./model";

export const CHAINS: Record<Chain, { dex: string; gecko: string; family: "evm" | "solana" }> = {
  ethereum: { dex: "ethereum", gecko: "eth", family: "evm" },
  base: { dex: "base", gecko: "base", family: "evm" },
  bsc: { dex: "bsc", gecko: "bsc", family: "evm" },
  arbitrum: { dex: "arbitrum", gecko: "arbitrum", family: "evm" },
  polygon: { dex: "polygon", gecko: "polygon_pos", family: "evm" },
  solana: { dex: "solana", gecko: "solana", family: "solana" }
};

export const FRESH_MS = 30_000;
export const STALE_MS = 5 * 60_000;
export const KV_TTL_SECONDS = 10 * 60;
