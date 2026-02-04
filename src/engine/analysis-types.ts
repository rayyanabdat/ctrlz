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

export function createAbortedResult(
  reason: AbortReason,
  stage: string,
  message: string,
  partialResults?: Partial<ScanResult>
): ScanResult {
  const baseResult: ScanResult = {
    contractAddress: partialResults?.contractAddress || "",
    chainId: partialResults?.chainId || 0,
    chainName: partialResults?.chainName || "",
    scanId: `scan-${Date.now()}`,
    timestamp: Date.now(),
    aborted: { reason, stage, message },
    token: {
      name: null,
      symbol: null,
      decimals: null,
      totalSupply: null,
      isStandard: false,
      findings: [],
      evidence: [],
      confidence: "UNVERIFIABLE",
      risk: "HIGH",
      timings: { startTime: Date.now() }
    },
    ownership: {
      ownerAddress: null,
      ownerType: null,
      isProxy: false,
      implementationAddress: null,
      upgradeability: "UNKNOWN",
      findings: [],
      evidence: [],
      confidence: "UNVERIFIABLE",
      risk: "HIGH",
      timings: { startTime: Date.now() }
    },
    liquidity: {
      pools: [],
      liquidityLocked: null,
      findings: [],
      evidence: [],
      confidence: "UNVERIFIABLE",
      risk: "HIGH",
      timings: { startTime: Date.now() }
    },
    holders: {
      topHolders: [],
      distribution: {
        top10Percent: null,
        top100Percent: null,
        confidence: "UNVERIFIABLE"
      },
      enumerationMethod: "FAILED",
      findings: [],
      evidence: [],
      confidence: "UNVERIFIABLE",
      risk: "HIGH",
      timings: { startTime: Date.now() }
    },
    security: {
      functions: {
        mint: false,
        burn: false,
        pause: false,
        blacklist: false,
        rescue: false,
        setFee: false
      },
      accessControls: {
        hasOwner: false,
        hasAdmin: false,
        hasMultipleRoles: false,
        confidence: "UNVERIFIABLE"
      },
      upgradeability: {
        isUpgradeable: false,
        proxyType: null,
        confidence: "UNVERIFIABLE"
      },
      findings: [],
      evidence: [],
      confidence: "UNVERIFIABLE",
      risk: "HIGH",
      timings: { startTime: Date.now() }
    },
    finalRisk: reason === "CRITICAL_RISK" ? "CRITICAL" : "HIGH",
    finalConfidence: "UNVERIFIABLE",
    totalScanTime: 0,
    rpcStats: {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0
    }
  };

  // Merge any partial results
  if (partialResults) {
    return { ...baseResult, ...partialResults };
  }

  return baseResult;
}

export function shouldAbortScan(result: AnalysisResult): boolean {
  return result.risk === "CRITICAL" || (result.risk === "HIGH" && result.confidence === "VERIFIED");
}