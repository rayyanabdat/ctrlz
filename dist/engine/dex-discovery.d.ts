import { RpcPool } from "./rpc-pool.js";
import { LiquidityInfo } from "./analysis-types.js";
export declare class DexDiscovery {
    private rpcPool;
    private chainKey;
    private cache;
    constructor(rpcPool: RpcPool, chainKey: string);
    discoverLiquidity(tokenAddress: string): Promise<LiquidityInfo>;
    /**
     * LAYER 1: Direct pair discovery from known factories
     */
    private discoverDirectPairs;
    /**
     * LAYER 2: Event-based discovery - scan for PairCreated and Swap events
     */
    private discoverViaEvents;
    /**
     * LAYER 3: Pattern-based discovery for DEX families
     */
    private discoverViaPatterns;
    private deduplicatePools;
    private discoverUniswapV2Pairs;
    private discoverUniswapV3Pools;
    private discoverCurvePools;
    private discoverBalancerPools;
    private getUniswapV2Reserves;
    private checkLiquidityLock;
    private getCommonTokensForChain;
    private getViemChain;
    private getRpcUrl;
    /**
     * LAYER 4: Known token pairs for major tokens like SHIB
     */
    private discoverKnownPairs;
}
//# sourceMappingURL=dex-discovery.d.ts.map