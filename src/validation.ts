import { CHAINS } from "./config";
import type { Chain } from "./model";

const EVM = /^0x[a-fA-F0-9]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function parseChain(value: string): Chain | null {
  return value in CHAINS ? value as Chain : null;
}

export function normalizeAddress(chain: Chain, value: string): string {
  const trimmed = value.trim();
  const family = CHAINS[chain].family;
  if (family === "evm" && !EVM.test(trimmed)) throw new Error("Invalid EVM token address");
  if (family === "solana" && !SOLANA.test(trimmed)) throw new Error("Invalid Solana token address");
  return family === "evm" ? trimmed.toLowerCase() : trimmed;
}
