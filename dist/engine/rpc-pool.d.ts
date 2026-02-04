export type RpcTier = "tier1" | "tier2" | "tier3";
export interface RpcEndpoint {
    url: string;
    tier: RpcTier;
    timeout: number;
    label?: string;
}
export interface RpcPoolConfig {
    chainId: number;
    endpoints: RpcEndpoint[];
}
export interface RpcCallResult<T = any> {
    data: T | null;
    success: boolean;
    error?: Error;
    endpoint?: string;
    attempts: number;
    totalTime: number;
}
export interface RpcPoolStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageResponseTime: number;
}
export declare class RpcPool {
    private clients;
    private cache;
    private failureCount;
    private config;
    private stats;
    private totalResponseTime;
    constructor(config: RpcPoolConfig);
    private initializeClients;
    private getOrderedEndpoints;
    call<T = any>(method: string, params?: any[], cacheKey?: string): Promise<RpcCallResult<T>>;
    private makeRpcCall;
    private timeoutPromise;
    getStats(): RpcPoolStats;
    getDetailedStats(): {
        endpoints: number;
        failureCounts: {
            [k: string]: number;
        };
        cacheSize: number;
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        averageResponseTime: number;
    };
    clearCache(): void;
}
//# sourceMappingURL=rpc-pool.d.ts.map