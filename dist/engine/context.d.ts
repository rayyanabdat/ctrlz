import { PublicClient } from "viem";
import { TokenIdentity } from "./identity.js";
import { LiquidityResult } from "./liquidity.js";
import { ConstraintResult } from "./constraints.js";
import { HolderResult } from "./holders.js";
export interface ContextNote {
    type: string;
    note: string;
    adjustments?: {
        reduceHolderWeight?: boolean;
        increaseLogicSensitivity?: boolean;
    };
}
export interface ContextResult {
    notes: ContextNote[];
    isLegacyToken: boolean;
    isCentralizedStablecoin: boolean;
    isRebasingToken: boolean;
    isNonStandardProxy: boolean;
    hasVestingPattern: boolean;
}
export declare function analyzeContext(client: PublicClient, tokenAddress: string, identity: TokenIdentity, liquidityResult: LiquidityResult, constraintResult: ConstraintResult, holderResult: HolderResult, isProxy: boolean, ownerType: string): Promise<ContextResult>;
//# sourceMappingURL=context.d.ts.map