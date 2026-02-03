import { PublicClient } from "viem";
import { RiskLevel } from "./scoring.js";
export interface HolderResult {
    totalSupply: string | null;
    circulatingSupply: string | null;
    topHolderPercent: number | null;
    top5HoldersPercent: number | null;
    top10HoldersPercent: number | null;
    deployerPercent: number | null;
    deployerAddress: string | null;
    ownerPercent: number | null;
    contractHeldPercent: number | null;
    maxSingleHolderPercent: number | null;
    enumerationComplete: boolean;
    facts: string[];
    evidence: string[];
    risk: RiskLevel;
}
export declare function analyzeHolders(client: PublicClient, tokenAddress: string, ownerAddress: string | null, knownLpAddresses?: string[], chainKey?: string): Promise<HolderResult>;
//# sourceMappingURL=holders.d.ts.map