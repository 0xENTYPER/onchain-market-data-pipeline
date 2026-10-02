import { describe, expect, it } from "vitest";
import { buildSnapshot } from "../src/pipeline";

const ADDRESS = "0x21cfcfc3d8f98fc728f48341d10ad8283f6eb7ab";

function response(body: unknown): Response {
  return Response.json(body);
}

describe("market pipeline", () => {
  it("keeps FDV explicit and merges an image from the fallback provider", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("dexscreener")) {
        return response([{
          pairAddress: "liquid-pair",
          baseToken: { address: ADDRESS, name: "Token", symbol: "TOK" },
          priceUsd: "0.25",
          fdv: 2_500_000,
          liquidity: { usd: 500_000 },
          volume: { h24: 100_000 }
        }]);
      }
      return response({
        data: [{
          id: "base_thin-pair",
          attributes: {
            address: "thin-pair",
            base_token_price_usd: "0.25",
            fdv_usd: "2500000",
            reserve_in_usd: "1000",
            volume_usd: { h24: "100" }
          },
          relationships: { base_token: { data: { id: `base_${ADDRESS}` } } }
        }],
        included: [{
          id: `base_${ADDRESS}`,
          attributes: { name: "Token", symbol: "TOK", image_url: "https://example.com/token.png" }
        }]
      });
    };

    const snapshot = await buildSnapshot("base", ADDRESS, fetcher, () => new Date("2026-10-03T00:00:00Z"));
    expect(snapshot.pair.address).toBe("liquid-pair");
    expect(snapshot.imageUrl).toBe("https://example.com/token.png");
    expect(snapshot.capitalization).toEqual({ kind: "fdv", usd: 2_500_000 });
    expect(snapshot.quality).toBe("validated");
  });

  it("continues when one provider fails", async () => {
    const fetcher: typeof fetch = async (input) => {
      if (String(input).includes("geckoterminal")) throw new Error("provider timeout");
      return response([{
        pairAddress: "only-pair",
        baseToken: { address: ADDRESS, name: "Token", symbol: "TOK" },
        priceUsd: "1",
        marketCap: 1_000_000,
        liquidity: { usd: 50_000 },
        volume: { h24: 10_000 }
      }]);
    };

    const snapshot = await buildSnapshot("base", ADDRESS, fetcher);
    expect(snapshot.quality).toBe("partial");
    expect(snapshot.providers).toEqual(["dex-screener"]);
    expect(snapshot.warnings).toContain("Provider 2 failed; response uses available fallbacks");
  });
});
