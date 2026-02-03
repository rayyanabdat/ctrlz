export interface ChainConfig {
    key: string;
    name: string;
    chainId: number;
    rpcUrl: string;
    wrappedNative: string;
    stablecoins: string[];
}
export declare const CHAINS: Record<string, ChainConfig>;
export declare const CHAIN_ALIASES: Record<string, string>;
export declare function getChain(chainKey?: unknown): ChainConfig;
export declare function getSupportedChains(): string[];
//# sourceMappingURL=chains.d.ts.map