import { PublicClient } from "viem";
export interface TokenIdentity {
    name: string | null;
    symbol: string | null;
    decimals: number | null;
    isNonStandard: boolean;
    hasCode: boolean;
}
export declare function getTokenIdentity(client: PublicClient, tokenAddress: string, rpcUrl?: string): Promise<TokenIdentity>;
//# sourceMappingURL=identity.d.ts.map