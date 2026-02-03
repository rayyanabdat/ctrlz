export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN" | "UNVERIFIABLE";
export interface LiquidityRiskBreakdown {
    controlRisk: RiskLevel;
    depthRisk: RiskLevel;
    verifiabilityRisk: RiskLevel;
}
export interface ScoreInput {
    logicRisk: RiskLevel;
    liquidityRisk: LiquidityRiskBreakdown;
    constraintRisk: RiskLevel;
    holderRisk: RiskLevel;
    contextFlags: {
        isCentralizedStablecoin: boolean;
        isRebasingToken: boolean;
        isLegacyToken: boolean;
        ownershipRenounced: boolean;
        hasVestingPattern: boolean;
        hasLiquidity: boolean;
        lpProtected: boolean;
        isProxy: boolean;
        hasMint: boolean;
        hasPause: boolean;
        liquidityDepthUsd: number | null;
        dexVersion: "v2" | "v3" | "v4" | "unknown";
        holderConcentrationPercent: number | null;
    };
}
export interface ScoreResult {
    finalScore: number;
    band: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    coverageCompleteness: number;
    breakdown: {
        baseScore: number;
        adjustments: {
            reason: string;
            delta: number;
        }[];
        guardrailsApplied: string[];
    };
    riskFactors: string[];
    positiveSignals: string[];
}
export declare function calculateFinalScore(input: ScoreInput): ScoreResult;
//# sourceMappingURL=scoring.d.ts.map