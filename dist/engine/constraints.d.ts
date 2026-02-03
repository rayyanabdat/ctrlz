import { PublicClient } from "viem";
import { RiskLevel } from "./scoring.js";
export interface ConstraintResult {
    hasCooldown: boolean;
    hasBlacklist: boolean;
    hasWhitelist: boolean;
    hasAntiWhale: boolean;
    hasTax: boolean;
    hasDynamicTax: boolean;
    hasExternalCall: boolean;
    ownershipRenounced: boolean;
    facts: string[];
    risk: RiskLevel;
}
export declare function analyzeConstraints(client: PublicClient, tokenAddress: string, ownerAddress: string | null, ownerType: string): Promise<ConstraintResult>;
//# sourceMappingURL=constraints.d.ts.map