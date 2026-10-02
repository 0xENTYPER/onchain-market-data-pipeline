import { CHAINS } from "./config";
import type { Candidate, Chain } from "./model";

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function equalAddress(chain: Chain, left: string | undefined, right: string): boolean {
  if (!left) return false;
  return CHAINS[chain].family === "evm" ? left.toLowerCase() === right : left === right;
}

export async function dexScreener(chain: Chain, address: string, fetcher: typeof fetch): Promise<Candidate[]> {
  const response = await fetcher(`https://api.dexscreener.com/token-pairs/v1/${CHAINS[chain].dex}/${address}`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`DexScreener HTTP ${response.status}`);
  const payload = await response.json<unknown>();
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((raw): Candidate[] => {
    const item = raw as Record<string, unknown>;
    const base = item.baseToken as Record<string, unknown> | undefined;
    if (!equalAddress(chain, typeof base?.address === "string" ? base.address : undefined, address)) return [];
    const pairAddress = typeof item.pairAddress === "string" ? item.pairAddress : null;
    if (!pairAddress) return [];
    const liquidity = item.liquidity as Record<string, unknown> | undefined;
    const volume = item.volume as Record<string, unknown> | undefined;
    const info = item.info as Record<string, unknown> | undefined;
    return [{
      provider: "dex-screener",
      chain,
      address,
      pairAddress,
      name: typeof base?.name === "string" ? base.name : null,
      symbol: typeof base?.symbol === "string" ? base.symbol : null,
      imageUrl: typeof info?.imageUrl === "string" ? info.imageUrl : null,
      priceUsd: number(item.priceUsd),
      marketCapUsd: number(item.marketCap),
      fdvUsd: number(item.fdv),
      liquidityUsd: number(liquidity?.usd),
      volume24hUsd: number(volume?.h24)
    }];
  });
}

interface GeckoResource {
  id?: string;
  attributes?: Record<string, unknown>;
  relationships?: { base_token?: { data?: { id?: string } } };
}

export async function geckoTerminal(chain: Chain, address: string, fetcher: typeof fetch): Promise<Candidate[]> {
  const network = CHAINS[chain].gecko;
  const url = new URL(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address}/pools`);
  url.searchParams.set("include", "base_token");
  const response = await fetcher(url, { headers: { accept: "application/json;version=20230302" } });
  if (!response.ok) throw new Error(`GeckoTerminal HTTP ${response.status}`);
  const payload = await response.json<{ data?: GeckoResource[]; included?: GeckoResource[] }>();
  const included = new Map((payload.included ?? []).map((item) => [item.id, item]));

  return (payload.data ?? []).flatMap((pool): Candidate[] => {
    const baseId = pool.relationships?.base_token?.data?.id;
    const baseAddress = baseId?.slice(baseId.indexOf("_") + 1);
    if (!equalAddress(chain, baseAddress, address)) return [];
    const attributes = pool.attributes ?? {};
    const token = baseId ? included.get(baseId)?.attributes : undefined;
    const pairAddress = typeof attributes.address === "string" ? attributes.address : null;
    if (!pairAddress) return [];
    const volume = attributes.volume_usd as Record<string, unknown> | undefined;
    return [{
      provider: "gecko-terminal",
      chain,
      address,
      pairAddress,
      name: typeof token?.name === "string" ? token.name : null,
      symbol: typeof token?.symbol === "string" ? token.symbol : null,
      imageUrl: typeof token?.image_url === "string" ? token.image_url : null,
      priceUsd: number(attributes.base_token_price_usd),
      marketCapUsd: number(attributes.market_cap_usd),
      fdvUsd: number(attributes.fdv_usd),
      liquidityUsd: number(attributes.reserve_in_usd),
      volume24hUsd: number(volume?.h24)
    }];
  });
}
