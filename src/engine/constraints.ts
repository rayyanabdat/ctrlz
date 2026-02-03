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

// Function selectors for constraint detection
const CONSTRAINT_SELECTORS = {
  // Cooldown
  cooldownEnabled: "0x4a8c1fb6",
  setCooldown: "0x10d5de53",
  tradingCooldown: "0x8cd09d50",
  
  // Blacklist / Whitelist
  isBlacklisted: "0xfe575a87",
  blacklist: "0xf9f92be4",
  addToBlacklist: "0x44337ea1",
  removeFromBlacklist: "0xe0a8eb8d",
  isWhitelisted: "0x3af32abf",
  whitelist: "0x9b19251a",
  addToWhitelist: "0xe43252d7",
  excludeFromFees: "0xc0246668",
  isExcludedFromFees: "0x4fbee193",
  
  // Anti-whale
  maxTxAmount: "0x8da5cb5b",
  maxTransactionAmount: "0xa9059cbb",
  maxWalletSize: "0x313ce567",
  maxWallet: "0xf8b45b05",
  setMaxTxAmount: "0xec28438a",
  setMaxWallet: "0xe99c9d09",
  
  // Tax
  buyTax: "0x4f7041a5",
  sellTax: "0xb0bc85de",
  totalFees: "0x13114a9d",
  taxFee: "0x061c82d0",
  setBuyTax: "0xaf8af690",
  setSellTax: "0x6402511e",
  setFees: "0xfdb78c0e",
  updateFees: "0x66ca9b83",
  
  // External calls
  uniswapV2Router: "0x1694505e",
  uniswapV2Pair: "0x49bd5a5e",
  
  // Ownership
  owner: "0x8da5cb5b",
  renounceOwnership: "0x715018a6",
  transferOwnership: "0xf2fde38b"
};

// ABIs for reading contract state
const READ_ABIS = {
  maxTxAmount: {
    inputs: [],
    name: "_maxTxAmount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  maxWalletSize: {
    inputs: [],
    name: "_maxWalletSize",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  maxTransactionAmount: {
    inputs: [],
    name: "maxTransactionAmount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  maxWallet: {
    inputs: [],
    name: "maxWallet",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  buyTax: {
    inputs: [],
    name: "buyTax",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  sellTax: {
    inputs: [],
    name: "sellTax",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  totalFees: {
    inputs: [],
    name: "totalFees",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  tradingEnabled: {
    inputs: [],
    name: "tradingEnabled",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  tradingActive: {
    inputs: [],
    name: "tradingActive",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  }
};

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

async function readContractValue(
  client: PublicClient,
  address: string,
  abi: any,
  functionName: string
): Promise<any> {
  try {
    return await client.readContract({
      address: address as `0x${string}`,
      abi: [abi],
      functionName
    });
  } catch {
    return null;
  }
}

export async function analyzeConstraints(
  client: PublicClient,
  tokenAddress: string,
  ownerAddress: string | null,
  ownerType: string
): Promise<ConstraintResult> {
  const result: ConstraintResult = {
    hasCooldown: false,
    hasBlacklist: false,
    hasWhitelist: false,
    hasAntiWhale: false,
    hasTax: false,
    hasDynamicTax: false,
    hasExternalCall: false,
    ownershipRenounced: ownerType === "ZERO_ADDRESS",
    facts: [],
    risk: "LOW"
  };

  // Check cooldown functions
  const cooldownChecks = [
    CONSTRAINT_SELECTORS.cooldownEnabled,
    CONSTRAINT_SELECTORS.setCooldown,
    CONSTRAINT_SELECTORS.tradingCooldown
  ];

  for (const selector of cooldownChecks) {
    if (await checkFunctionExists(client, tokenAddress, selector)) {
      result.hasCooldown = true;
      result.facts.push("Trading cooldown mechanism detected");
      break;
    }
  }

  // Check blacklist functions
  const blacklistChecks = [
    CONSTRAINT_SELECTORS.isBlacklisted,
    CONSTRAINT_SELECTORS.blacklist,
    CONSTRAINT_SELECTORS.addToBlacklist
  ];

  for (const selector of blacklistChecks) {
    if (await checkFunctionExists(client, tokenAddress, selector)) {
      result.hasBlacklist = true;
      result.facts.push("Blacklist capability detected - addresses can be blocked from trading");
      break;
    }
  }

  // Check whitelist functions
  const whitelistChecks = [
    CONSTRAINT_SELECTORS.isWhitelisted,
    CONSTRAINT_SELECTORS.whitelist,
    CONSTRAINT_SELECTORS.addToWhitelist,
    CONSTRAINT_SELECTORS.excludeFromFees,
    CONSTRAINT_SELECTORS.isExcludedFromFees
  ];

  for (const selector of whitelistChecks) {
    if (await checkFunctionExists(client, tokenAddress, selector)) {
      result.hasWhitelist = true;
      result.facts.push("Whitelist or fee exclusion mechanism detected");
      break;
    }
  }

  // Check anti-whale mechanisms
  const maxTxAmount = await readContractValue(client, tokenAddress, READ_ABIS.maxTxAmount, "_maxTxAmount");
  const maxWallet = await readContractValue(client, tokenAddress, READ_ABIS.maxWallet, "maxWallet");
  const maxTxAlt = await readContractValue(client, tokenAddress, READ_ABIS.maxTransactionAmount, "maxTransactionAmount");
  const maxWalletAlt = await readContractValue(client, tokenAddress, READ_ABIS.maxWalletSize, "_maxWalletSize");

  if (maxTxAmount || maxWallet || maxTxAlt || maxWalletAlt) {
    result.hasAntiWhale = true;
    const limits: string[] = [];
    if (maxTxAmount || maxTxAlt) limits.push("max transaction");
    if (maxWallet || maxWalletAlt) limits.push("max wallet");
    result.facts.push(`Anti-whale limits detected: ${limits.join(", ")}`);
  }

  // Check for modifiable limits
  const setMaxTxExists = await checkFunctionExists(client, tokenAddress, CONSTRAINT_SELECTORS.setMaxTxAmount);
  const setMaxWalletExists = await checkFunctionExists(client, tokenAddress, CONSTRAINT_SELECTORS.setMaxWallet);

  if ((setMaxTxExists || setMaxWalletExists) && result.hasAntiWhale) {
    result.facts.push("Anti-whale limits can be modified by owner");
  }

  // Check tax mechanisms
  const buyTax = await readContractValue(client, tokenAddress, READ_ABIS.buyTax, "buyTax");
  const sellTax = await readContractValue(client, tokenAddress, READ_ABIS.sellTax, "sellTax");
  const totalFees = await readContractValue(client, tokenAddress, READ_ABIS.totalFees, "totalFees");

  if (buyTax !== null || sellTax !== null || totalFees !== null) {
    result.hasTax = true;
    const taxDetails: string[] = [];
    if (buyTax !== null) taxDetails.push(`buy: ${buyTax}%`);
    if (sellTax !== null) taxDetails.push(`sell: ${sellTax}%`);
    if (taxDetails.length > 0) {
      result.facts.push(`Trading tax detected (${taxDetails.join(", ")})`);
    } else {
      result.facts.push("Trading tax mechanism detected");
    }
  }

  // Check for modifiable tax
  const setTaxChecks = [
    CONSTRAINT_SELECTORS.setBuyTax,
    CONSTRAINT_SELECTORS.setSellTax,
    CONSTRAINT_SELECTORS.setFees,
    CONSTRAINT_SELECTORS.updateFees
  ];

  for (const selector of setTaxChecks) {
    if (await checkFunctionExists(client, tokenAddress, selector)) {
      result.hasDynamicTax = true;
      result.facts.push("Tax rates can be modified by owner");
      break;
    }
  }

  // Check for external calls (DEX router integration)
  const hasRouter = await checkFunctionExists(client, tokenAddress, CONSTRAINT_SELECTORS.uniswapV2Router);
  const hasPair = await checkFunctionExists(client, tokenAddress, CONSTRAINT_SELECTORS.uniswapV2Pair);

  if (hasRouter || hasPair) {
    result.hasExternalCall = true;
    result.facts.push("Contract integrates with DEX router for swap operations");
  }

  // Ownership status
  if (result.ownershipRenounced) {
    result.facts.push("Contract ownership has been renounced");
  } else if (ownerAddress && ownerType === "EOA") {
    result.facts.push("Contract is controlled by a single wallet (EOA)");
  } else if (ownerAddress && ownerType === "CONTRACT") {
    result.facts.push("Contract is controlled by another contract (possibly multisig)");
  }

  // Determine risk level
  let riskFactors = 0;

  // High risk factors
  if (result.hasBlacklist && result.hasDynamicTax) {
    riskFactors += 3;
    result.facts.push("Combination of blacklist and modifiable tax creates elevated risk");
  }

  if (result.hasBlacklist && !result.ownershipRenounced) {
    riskFactors += 2;
  }

  if (result.hasDynamicTax && !result.ownershipRenounced) {
    riskFactors += 2;
  }

  // Medium risk factors
  if (result.hasCooldown) riskFactors += 1;
  if (result.hasAntiWhale) riskFactors += 1;
  if (result.hasWhitelist) riskFactors += 1;
  if (result.hasTax && !result.hasDynamicTax) riskFactors += 1;

  // Reduce risk if ownership renounced
  if (result.ownershipRenounced && riskFactors > 0) {
    riskFactors = Math.max(0, riskFactors - 2);
  }

  // FAIR risk classification
  if (result.hasBlacklist && result.hasDynamicTax && ownerType === "EOA") {
    riskFactors += 3;
    result.facts.push("Blacklist and modifiable tax with EOA owner");
  } else if (result.hasBlacklist && ownerType === "EOA") {
    riskFactors += 2;
  } else if (result.hasDynamicTax && ownerType === "EOA") {
    riskFactors += 2;
  }

  // Medium factors
  if (result.hasCooldown) riskFactors += 1;
  if (result.hasAntiWhale) riskFactors += 1;
  if (result.hasTax && !result.hasDynamicTax) riskFactors += 0; // Fixed tax is not risky

  // Reduce risk significantly if ownership renounced
  if (ownerType === "ZERO_ADDRESS") {
    riskFactors = Math.max(0, riskFactors - 3);
    result.facts.push("Ownership renounced - controls are immutable");
  }

  // Reduce risk if owner is contract (multisig)
  if (ownerType === "CONTRACT") {
    riskFactors = Math.max(0, riskFactors - 1);
  }

  // Classify
  if (riskFactors >= 3) {
    result.risk = "HIGH";
  } else if (riskFactors >= 1) {
    result.risk = "MEDIUM";
  } else {
    result.risk = "LOW";
  }

  // Add summary fact if no constraints found
  if (result.facts.length === 0) {
    result.facts.push("No significant transfer or trading constraints detected");
  }

  return result;
}
