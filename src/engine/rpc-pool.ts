import { createPublicClient, http, PublicClient } from "viem";

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

export class RpcPool {
  private clients: Map<string, PublicClient> = new Map();
  private cache: Map<string, any> = new Map();
  private failureCount: Map<string, number> = new Map();
  private config: RpcPoolConfig;
  
  // Track global statistics
  private stats: RpcPoolStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    averageResponseTime: 0
  };
  private totalResponseTime: number = 0;

  constructor(config: RpcPoolConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients() {
    for (const endpoint of this.config.endpoints) {
      const client = createPublicClient({
        transport: http(endpoint.url, {
          timeout: endpoint.timeout,
          retryCount: 0 // We handle retries ourselves
        })
      });
      this.clients.set(endpoint.url, client);
      this.failureCount.set(endpoint.url, 0);
    }
  }

  private getOrderedEndpoints(): RpcEndpoint[] {
    // Sort by tier, then by failure count (ascending)
    return this.config.endpoints
      .slice()
      .sort((a, b) => {
        const tierPriority = { tier1: 0, tier2: 1, tier3: 2 };
        const tierDiff = tierPriority[a.tier] - tierPriority[b.tier];
        if (tierDiff !== 0) return tierDiff;
        
        const aFailures = this.failureCount.get(a.url) || 0;
        const bFailures = this.failureCount.get(b.url) || 0;
        return aFailures - bFailures;
      });
  }

  async call<T = any>(
    method: string,
    params: any[] = [],
    cacheKey?: string
  ): Promise<RpcCallResult<T>> {
    // Check cache first (does not count as a call)
    if (cacheKey && this.cache.has(cacheKey)) {
      return {
        data: this.cache.get(cacheKey),
        success: true,
        attempts: 0,
        totalTime: 0
      };
    }

    // Track this as a call
    this.stats.totalCalls++;
    
    const startTime = Date.now();
    const orderedEndpoints = this.getOrderedEndpoints();
    let attempts = 0;
    let lastError: Error | null = null;

    // Try up to 2 endpoints max
    for (const endpoint of orderedEndpoints.slice(0, 2)) {
      attempts++;
      const client = this.clients.get(endpoint.url);
      if (!client) continue;

      try {
        const result = await Promise.race([
          this.makeRpcCall(client, method, params),
          this.timeoutPromise(endpoint.timeout)
        ]);

        const callTime = Date.now() - startTime;
        
        // Success - cache and return
        if (cacheKey) {
          this.cache.set(cacheKey, result);
        }
        
        // Reset failure count on success
        this.failureCount.set(endpoint.url, 0);
        
        // Track success
        this.stats.successfulCalls++;
        this.totalResponseTime += callTime;
        this.stats.averageResponseTime = this.totalResponseTime / this.stats.successfulCalls;

        return {
          data: result,
          success: true,
          endpoint: endpoint.url,
          attempts,
          totalTime: callTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Increment failure count
        const currentFailures = this.failureCount.get(endpoint.url) || 0;
        this.failureCount.set(endpoint.url, currentFailures + 1);
        
        // Continue to next endpoint
        continue;
      }
    }

    // All endpoints failed - track as failed call
    this.stats.failedCalls++;
    
    return {
      data: null,
      success: false,
      error: lastError || new Error("All RPC endpoints failed"),
      attempts,
      totalTime: Date.now() - startTime
    };
  }

  private async makeRpcCall(client: PublicClient, method: string, params: any[]): Promise<any> {
    try {
      switch (method) {
        case "eth_getCode":
          return await client.getCode({ address: params[0], blockTag: params[1] || "latest" });
        case "eth_call":
          const result = await client.call({ to: params[0].to, data: params[0].data });
          // Viem returns { data: "0x..." } format
          return result.data;
        case "eth_getBlockNumber":
          return await client.getBlockNumber();
        case "eth_getStorageAt":
          return await client.getStorageAt({ 
            address: params[0], 
            slot: params[1], 
            blockTag: params[2] || "latest" 
          });
        default:
          throw new Error(`Unsupported RPC method: ${method}`);
      }
    } catch (error) {
      throw error;
    }
  }

  private timeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`RPC timeout after ${timeout}ms`)), timeout);
    });
  }

  getStats(): RpcPoolStats {
    return { ...this.stats };
  }
  
  getDetailedStats() {
    return {
      ...this.stats,
      endpoints: this.config.endpoints.length,
      failureCounts: Object.fromEntries(this.failureCount),
      cacheSize: this.cache.size
    };
  }

  clearCache() {
    this.cache.clear();
  }
}