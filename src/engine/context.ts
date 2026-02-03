import { PublicClient } from "viem";
import { TokenIdentity } from "./identity.js";
import { LiquidityResult } from "./liquidity.js";
import { ConstraintResult } from "./constraints.js";
import { HolderResult } from "./holders.js";
import { RiskLevel } from "./scoring.js";

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

// Function selectors for edge case detection
const EDGE_CASE_SELECTORS = {
  // Rebasing
  rebase: "0xaf14052c",
  rebaseOptOut: "0x8456cb59",
  scalingFactor: "0xb9f0baf7",
  
  // Stablecoin patterns
  freeze: "0x8d8f2adb",
  unfreeze: "0x6a28f000",
  addMinter: "0x983b2d56",
  removeMinter: "0x3092afd5",
  isMinter: "0xaa271e1a",
  
  // Vesting
  release: "0x86d1a69f",
  releasableAmount: "0x191655871",
  vestedAmount: "0x44b1231f",
  
  // Non-standard proxy
  implementation: "0x5c60da1b",
  upgradeTo: "0x3659cfe6",
  admin: "0xf851a440"
};

// Known stablecoin symbols
const KNOWN_STABLECOINS = ["USDT", "USDC", "DAI", "BUSD", "TUSD", "USDP", "FRAX", "LUSD", "GUSD"];

async function checkFunctionExists(
  client: PublicClient,
  address: string,
  selector: string
): Promise<boolean> {
  try {
    await client.call({
      to: address as `0x${string}`,
      data: selector as `0x${string}`
    });
    return true;
  } catch {
    return false;
  }
}

export async function analyzeContext(
  client: PublicClient,
  tokenAddress: string,
  identity: TokenIdentity,
  liquidityResult: LiquidityResult,
  constraintResult: ConstraintResult,
  holderResult: HolderResult,
  isProxy: boolean,
  ownerType: string
): Promise<ContextResult> {
  const result: ContextResult = {
    notes: [],
    isLegacyToken: false,
    isCentralizedStablecoin: false,
    isRebasingToken: false,
    isNonStandardProxy: false,
    hasVestingPattern: false
  };

  // 1) Legacy / Non-standard ERC20 detection
  if (!identity.name && !identity.symbol) {
    result.isLegacyToken = true;
    result.notes.push({
      type: "LEGACY_TOKEN",
      note: "Legacy or non-standard ERC20 implementation detected. Risk interpretation may differ from modern token standards."
    });
  }

  // 2) Centralized Stablecoin Pattern
  const isStablecoinSymbol = identity.symbol && KNOWN_STABLECOINS.includes(identity.symbol.toUpperCase());
  const hasFreezeCapability = constraintResult.hasBlacklist;
  const hasMintAuthority = await checkFunctionExists(client, tokenAddress, EDGE_CASE_SELECTORS.addMinter) ||
                          await checkFunctionExists(client, tokenAddress, EDGE_CASE_SELECTORS.isMinter);

  if (isStablecoinSymbol || (hasFreezeCapability && hasMintAuthority && liquidityResult.found)) {
    // Check for large, established liquidity (heuristic)
    if (liquidityResult.riskBreakdown.depthRisk !== "HIGH" || isStablecoinSymbol) {
      result.isCentralizedStablecoin = true;
      result.notes.push({
        type: "CENTRALIZED_STABLECOIN",
        note: "Centralized stablecoin design detected. Administrative controls are expected by design."
      });
    }
  }

  // 3) Rebasing Token Mechanics
  const hasRebase = await checkFunctionExists(client, tokenAddress, EDGE_CASE_SELECTORS.rebase);
  const hasScalingFactor = await checkFunctionExists(client, tokenAddress, EDGE_CASE_SELECTORS.scalingFactor);

  if (hasRebase || hasScalingFactor) {
    result.isRebasingToken = true;
    result.notes.push({
      type: "REBASING_TOKEN",
      note: "Rebasing mechanics detected. Supply and holder distribution may change dynamically.",
      adjustments: { reduceHolderWeight: true }
    });
  }

  // 4) Non-standard Proxy / Upgrade Pattern
  if (isProxy) {
    const hasStandardImpl = await checkFunctionExists(client, tokenAddress, EDGE_CASE_SELECTORS.implementation);
    const hasAdmin = await checkFunctionExists(client, tokenAddress, EDGE_CASE_SELECTORS.admin);

    if (!hasStandardImpl && !hasAdmin) {
      result.isNonStandardProxy = true;
      result.notes.push({
        type: "NON_STANDARD_PROXY",
        note: "Non-standard upgrade pattern detected. Upgradeable behavior may not be fully observable.",
        adjustments: { increaseLogicSensitivity: true }
      });
    }
  }

  // 5) Vesting / Treasury Holder Pattern
  // Check if there are large holders that appear to be contracts
  if (holderResult.risk === "HIGH" || holderResult.risk === "MEDIUM") {
    const hasVestingFunctions = await checkFunctionExists(client, tokenAddress, EDGE_CASE_SELECTORS.release) ||
                                await checkFunctionExists(client, tokenAddress, EDGE_CASE_SELECTORS.vestedAmount);

    if (hasVestingFunctions) {
      result.hasVestingPattern = true;
      result.notes.push({
        type: "VESTING_PATTERN",
        note: "Vesting or treasury contract patterns detected. Holder concentration may be overstated.",
        adjustments: { reduceHolderWeight: true }
      });
    }
  }

  // Additional context: ownership status
  if (ownerType === "ZERO_ADDRESS") {
    result.notes.push({
      type: "OWNERSHIP_RENOUNCED",
      note: "Contract ownership has been renounced. Administrative functions are permanently disabled."
    });
  }

  return result;
}
