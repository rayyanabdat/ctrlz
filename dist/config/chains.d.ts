import { RpcEndpoint } from "../engine/rpc-pool.js";
export interface ChainConfig {
    key: string;
    name: string;
    chainId: number;
    rpcUrl: string;
    rpcUrls?: string[];
    rpcPool: RpcEndpoint[];
    wrappedNative: string;
    stablecoins: string[];
}
export declare const CHAINS: Record<string, ChainConfig>;
export declare const CHAIN_ALIASES: Record<string, string>;
export declare function getChain(chainKey?: unknown): ChainConfig;
export declare function getSupportedChains(): string[];
//# sourceMappingURL=chains.d.ts.map