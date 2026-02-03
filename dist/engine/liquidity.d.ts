import { PublicClient } from "viem";
import { LiquidityRiskBreakdown } from "./scoring.js";
export interface LiquidityPool {
    dex: string;
    version: "v2" | "v3" | "v4";
    pairAddress: string;
    quoteToken: string;
    quoteSymbol: string;
    reserves?: {
        token: bigint;
        quote: bigint;
    };
    liquidity?: bigint;
    sqrtPriceX96?: bigint;
    tick?: number;
    estimatedDepthUsd: number | null;
    depthVerifiable: boolean;
    evidence: string[];
}
export type { LiquidityRiskBreakdown } from "./scoring.js";
export interface LiquidityResult {
    found: boolean;
    pools: LiquidityPool[];
    primaryPool: LiquidityPool | null;
    totalPairsChecked: number;
    isBurned: boolean;
    isLocked: boolean;
    burnPercent: number;
    lockPercent: number;
    totalDepthUsd: number | null;
    depthVerifiable: boolean;
    dexVersion: "v2" | "v3" | "v4" | "unknown";
    facts: string[];
    evidence: string[];
    riskBreakdown: LiquidityRiskBreakdown;
}
export declare function analyzeLiquidity(client: PublicClient, tokenAddress: string, chainKey: string): Promise<LiquidityResult>;
//# sourceMappingURL=liquidity.d.ts.map