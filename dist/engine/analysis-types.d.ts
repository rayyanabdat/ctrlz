export type ConfidenceLevel = "VERIFIED" | "PARTIAL" | "UNVERIFIABLE";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AbortReason = "HIGH_RISK" | "CRITICAL_RISK" | "RPC_FAILURE" | "TIMEOUT";
export interface AnalysisEvidence {
    description: string;
    url?: string;
    confidence: ConfidenceLevel;
    method: "RPC_CALL" | "EVENT_LOG" | "STATIC_ANALYSIS" | "EXTERNAL_API";
}
export interface AnalysisResult {
    findings: string[];
    evidence: AnalysisEvidence[];
    confidence: ConfidenceLevel;
    risk: RiskLevel;
    aborted?: {
        reason: AbortReason;
        stage: string;
        message: string;
    };
    timings: {
        startTime: number;
        endTime?: number;
        duration?: number;
    };
}
export interface TokenInfo extends AnalysisResult {
    name: string | null;
    symbol: string | null;
    decimals: number | null;
    totalSupply: string | null;
    isStandard: boolean;
}
export interface OwnershipInfo extends AnalysisResult {
    ownerAddress: string | null;
    ownerType: "EOA" | "CONTRACT" | "MULTISIG" | "TIMELOCK" | "ZERO_ADDRESS" | null;
    isProxy: boolean;
    implementationAddress: string | null;
    upgradeability: "UPGRADEABLE" | "IMMUTABLE" | "UNKNOWN";
}
export interface LiquidityInfo extends AnalysisResult {
    pools: Array<{
        dexType: "UNISWAP_V2" | "UNISWAP_V3" | "CURVE" | "BALANCER" | "SOLIDLY" | "UNKNOWN";
        pairAddress: string;
        token0: string;
        token1: string;
        reserves?: {
            token0: string;
            token1: string;
            confidence: ConfidenceLevel;
        };
        tvlUsd?: {
            amount: number;
            confidence: ConfidenceLevel;
        };
    }>;
    totalTvlUsd?: {
        amount: number;
        confidence: ConfidenceLevel;
    };
    liquidityLocked: boolean | null;
    lockDetails?: {
        lockerAddress: string;
        unlockTime: number;
        confidence: ConfidenceLevel;
    };
}
export interface HolderInfo extends AnalysisResult {
    topHolders: Array<{
        address: string;
        balance: string;
        percentage: number;
        type: "EOA" | "CONTRACT" | "EXCHANGE" | "BRIDGE" | "LP_POOL" | "BURN";
        confidence: ConfidenceLevel;
    }>;
    distribution: {
        top10Percent: number | null;
        top100Percent: number | null;
        confidence: ConfidenceLevel;
    };
    enumerationMethod: "FULL" | "PARTIAL" | "SAMPLE" | "FAILED";
}
export interface SecurityAnalysis extends AnalysisResult {
    functions: {
        mint: boolean;
        burn: boolean;
        pause: boolean;
        blacklist: boolean;
        rescue: boolean;
        setFee: boolean;
    };
    accessControls: {
        hasOwner: boolean;
        hasAdmin: boolean;
        hasMultipleRoles: boolean;
        confidence: ConfidenceLevel;
    };
    upgradeability: {
        isUpgradeable: boolean;
        proxyType: "TRANSPARENT" | "UUPS" | "BEACON" | "DIAMOND" | null;
        confidence: ConfidenceLevel;
    };
}
export interface ScanResult {
    contractAddress: string;
    chainId: number;
    chainName: string;
    scanId: string;
    timestamp: number;
    aborted?: {
        reason: AbortReason;
        stage: string;
        message: string;
    };
    token: TokenInfo;
    ownership: OwnershipInfo;
    liquidity: LiquidityInfo;
    holders: HolderInfo;
    security: SecurityAnalysis;
    finalRisk: RiskLevel;
    finalConfidence: ConfidenceLevel;
    totalScanTime: number;
    rpcStats: {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        averageResponseTime: number;
    };
}
export declare function createAbortedResult(reason: AbortReason, stage: string, message: string, partialResults?: Partial<ScanResult>): ScanResult;
export declare function shouldAbortScan(result: AnalysisResult): boolean;
//# sourceMappingURL=analysis-types.d.ts.map