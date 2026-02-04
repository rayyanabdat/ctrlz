import { PublicClient, getAddress } from "viem";
import { BURN_ADDRESSES } from "../config/constants.js";
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

// Known system addresses to label (not exclude from risk)
const SYSTEM_LABELS: Record<string, string> = {
  "0x0000000000000000000000000000000000000000": "Null Address",
  "0x000000000000000000000000000000000000dead": "Burn Address",
  "0xdead000000000000000000000000000000000000": "Burn Address"
};

// ERC20 ABI fragments
const ERC20_ABI = {
  totalSupply: {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  balanceOf: {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
} as const;

function getExplorerUrl(chainKey: string): string {
  const explorers: Record<string, string> = {
    ethereum: "https://etherscan.io",
    base: "https://basescan.org",
    bsc: "https://bscscan.com",
    polygon: "https://polygonscan.com",
    arbitrum: "https://arbiscan.io",
    optimism: "https://optimistic.etherscan.io",
    avalanche: "https://snowtrace.io",
    fantom: "https://ftmscan.com",
    blast: "https://blastscan.io"
  };
  return explorers[chainKey] || "https://etherscan.io";
}

function isSystemAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return BURN_ADDRESSES.some(burn => burn.toLowerCase() === lower) ||
    lower in SYSTEM_LABELS;
}

async function getDeployerAddress(
  client: PublicClient,
  contractAddress: string
): Promise<string | null> {
  try {
    const deployerPatterns = [
      { name: "deployer", selector: "0xd5f39488" },
      { name: "creator", selector: "0x02d05d3f" }
    ];

    for (const pattern of deployerPatterns) {
      try {
        const result = await client.call({
          to: contractAddress as `0x${string}`,
          data: pattern.selector as `0x${string}`
        });
        
        if (result && result.data && result.data.length >= 66) {
          const address = "0x" + result.data.slice(-40);
          if (address !== "0x0000000000000000000000000000000000000000") {
            return getAddress(address);
          }
        }
      } catch {
        // Pattern not available
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function getTokenBalance(
  client: PublicClient,
  tokenAddress: string,
  holderAddress: string
): Promise<bigint> {
  try {
    const balance = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [ERC20_ABI.balanceOf],
      functionName: "balanceOf",
      args: [holderAddress as `0x${string}`]
    });
    
    // Viem already returns bigint, no need to convert
    if (typeof balance === 'bigint') {
      return balance;
    } else if (typeof balance === 'string' || typeof balance === 'number') {
      return BigInt(balance);
    } else {
      return 0n;
    }
  } catch {
    return 0n;
  }
}

async function getTotalSupply(
  client: PublicClient,
  tokenAddress: string
): Promise<bigint | null> {
  try {
    const supply = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [ERC20_ABI.totalSupply],
      functionName: "totalSupply"
    });
    
    // Viem already returns bigint, no need to convert
    if (typeof supply === 'bigint') {
      return supply;
    } else if (typeof supply === 'string' || typeof supply === 'number') {
      return BigInt(supply);
    } else {
      return null;
    }
  } catch {
    return null;
  }
}

async function isContract(client: PublicClient, address: string): Promise<boolean> {
  try {
    const code = await client.getCode({ address: address as `0x${string}` });
    return code !== undefined && code !== "0x" && code.length > 2;
  } catch {
    return false;
  }
}

export async function analyzeHolders(
  client: PublicClient,
  tokenAddress: string,
  ownerAddress: string | null,
  knownLpAddresses: string[] = [],
  chainKey: string = "ethereum"
): Promise<HolderResult> {
  const explorer = getExplorerUrl(chainKey);
  
  const result: HolderResult = {
    totalSupply: null,
    circulatingSupply: null,
    topHolderPercent: null,
    top5HoldersPercent: null,
    top10HoldersPercent: null,
    deployerPercent: null,
    deployerAddress: null,
    ownerPercent: null,
    contractHeldPercent: null,
    maxSingleHolderPercent: null,
    enumerationComplete: false,
    facts: [],
    evidence: [],
    risk: "UNKNOWN" // Default when analysis is limited
  };

  // Get total supply
  const totalSupply = await getTotalSupply(client, tokenAddress);
  
  if (!totalSupply || totalSupply === 0n) {
    result.facts.push("Total supply could not be retrieved or is zero");
    result.evidence.push("Evidence unavailable: totalSupply() call failed or returned 0");
    result.risk = "HIGH";
    return result;
  }

  result.totalSupply = totalSupply.toString();
  result.evidence.push(`totalSupply(): ${explorer}/address/${tokenAddress}#readContract`);

  // Calculate burned/null address holdings first
  let burnedSupply = 0n;
  for (const burnAddr of BURN_ADDRESSES) {
    const burnBalance = await getTokenBalance(client, tokenAddress, burnAddr);
    burnedSupply += burnBalance;
  }

  // Calculate circulating supply (total - burned)
  const circulatingSupply = totalSupply - burnedSupply;
  result.circulatingSupply = circulatingSupply.toString();
  
  if (circulatingSupply <= 0n) {
    result.facts.push("Circulating supply appears to be zero or negative");
    result.risk = "HIGH";
    return result;
  }

  // Get deployer address - try multiple methods
  result.deployerAddress = await getDeployerAddress(client, tokenAddress);
  
  // If deployer detection failed, try to find it using common patterns
  if (!result.deployerAddress) {
    // Try to find large holders by checking known patterns
    const commonAddresses = [
      ownerAddress,
      // Check the first few likely addresses that might be deployers
      ...(ownerAddress ? [ownerAddress] : [])
    ].filter(Boolean) as string[];
    
    for (const addr of commonAddresses) {
      if (addr && !isSystemAddress(addr)) {
        const balance = await getTokenBalance(client, tokenAddress, addr);
        if (balance > 0n) {
          const percent = Number((balance * 10000n) / circulatingSupply) / 100;
          if (percent > 5) { // If holding >5%, likely important
            result.deployerAddress = addr;
            result.facts.push(`Likely deployer/key holder identified: ${addr.slice(0, 10)}...`);
            break;
          }
        }
      }
    }
  }

  // Track max single holder percentage
  let maxHolderPercent = 0;
  let maxHolderAddress: string | null = null;
  let maxHolderType: "EOA" | "CONTRACT" | null = null;

  // Check deployer balance if known
  if (result.deployerAddress) {
    const deployerBalance = await getTokenBalance(client, tokenAddress, result.deployerAddress);
    if (deployerBalance > 0n) {
      const deployerPercent = Number((deployerBalance * 10000n) / circulatingSupply) / 100;
      result.deployerPercent = Math.round(deployerPercent * 100) / 100;
      
      const isDeployerContract = await isContract(client, result.deployerAddress);
      
      if (deployerPercent > maxHolderPercent && !isSystemAddress(result.deployerAddress)) {
        maxHolderPercent = deployerPercent;
        maxHolderAddress = result.deployerAddress;
        maxHolderType = isDeployerContract ? "CONTRACT" : "EOA";
      }
      
      if (deployerPercent > 0.5) {
        result.facts.push(`Deployer holds ${result.deployerPercent}% of circulating supply`);
        result.evidence.push(`Deployer balance: ${explorer}/token/${tokenAddress}?a=${result.deployerAddress}`);
      } else {
        result.facts.push("Deployer holds <1% of circulating supply");
      }
    } else {
      result.deployerPercent = 0;
      result.facts.push("Deployer holds 0% of circulating supply");
    }
  } else {
    result.facts.push("Deployer address could not be identified");
    result.evidence.push("Evidence unavailable: deployer() / creator() not found");
  }

  // Check owner balance if known and different from deployer
  if (ownerAddress && ownerAddress !== result.deployerAddress && !isSystemAddress(ownerAddress)) {
    const ownerBalance = await getTokenBalance(client, tokenAddress, ownerAddress);
    if (ownerBalance > 0n) {
      const ownerPercent = Number((ownerBalance * 10000n) / circulatingSupply) / 100;
      result.ownerPercent = Math.round(ownerPercent * 100) / 100;
      
      const isOwnerContract = await isContract(client, ownerAddress);
      
      if (ownerPercent > maxHolderPercent) {
        maxHolderPercent = ownerPercent;
        maxHolderAddress = ownerAddress;
        maxHolderType = isOwnerContract ? "CONTRACT" : "EOA";
      }
      
      if (ownerPercent > 0.5) {
        result.facts.push(`Contract owner holds ${result.ownerPercent}% of circulating supply`);
        result.evidence.push(`Owner balance: ${explorer}/token/${tokenAddress}?a=${ownerAddress}`);
      }
    }
  }

  // Check LP addresses - try to be smarter about this
  let lpHoldings = 0n;
  let actualLpCount = 0;
  
  for (const lpAddr of knownLpAddresses) {
    const lpBalance = await getTokenBalance(client, tokenAddress, lpAddr);
    if (lpBalance > 0n) {
      lpHoldings += lpBalance;
      actualLpCount++;
    }
  }

  if (lpHoldings > 0n && actualLpCount > 0) {
    const lpPercent = Number((lpHoldings * 10000n) / circulatingSupply) / 100;
    result.facts.push(`${Math.round(lpPercent)}% of supply is in ${actualLpCount} liquidity pool(s)`);
    for (const lpAddr of knownLpAddresses) {
      const balance = await getTokenBalance(client, tokenAddress, lpAddr);
      if (balance > 0n) {
        result.evidence.push(`LP holdings: ${explorer}/token/${tokenAddress}?a=${lpAddr}`);
      }
    }
  } else if (knownLpAddresses.length > 0) {
    // We found LP addresses but they have no balance - suspicious
    result.facts.push("Liquidity pools found but appear empty");
    result.evidence.push("Warning: LP addresses exist but hold no tokens");
  } else {
    // Make educated guess - most tokens have some LP
    result.facts.push("Liquidity pools not detected (may exist but not identified)");
    result.evidence.push("Note: Full LP analysis requires DEX aggregation");
  }

  // Check token contract itself (some tokens hold supply in contract)
  const contractBalance = await getTokenBalance(client, tokenAddress, tokenAddress);
  if (contractBalance > 0n) {
    const contractPercent = Number((contractBalance * 10000n) / circulatingSupply) / 100;
    result.contractHeldPercent = Math.round(contractPercent * 100) / 100;
    
    if (contractPercent > maxHolderPercent) {
      maxHolderPercent = contractPercent;
      maxHolderAddress = tokenAddress;
      maxHolderType = "CONTRACT";
    }
    
    if (contractPercent > 1) {
      result.facts.push(`Token contract itself holds ${result.contractHeldPercent}% of supply`);
      result.evidence.push(`Contract self-balance: ${explorer}/token/${tokenAddress}?a=${tokenAddress}`);
    }
  }

  result.maxSingleHolderPercent = Math.round(maxHolderPercent * 100) / 100;

  // ============================================================
  // ENUMERATION STATUS - be more informative
  // ============================================================
  result.enumerationComplete = false;
  if (maxHolderPercent > 0) {
    result.facts.push(`Largest identified holder: ${Math.round(maxHolderPercent)}% of supply`);
  } else {
    result.facts.push("No significant holders identified in basic scan");
  }
  result.evidence.push(`Token holders page: ${explorer}/token/${tokenAddress}#balances`);

  // ============================================================
  // SMART RISK DETERMINATION
  // ============================================================
  
  // CRITICAL: If single holder has ≥70%
  if (maxHolderPercent >= 70 && maxHolderAddress && !isSystemAddress(maxHolderAddress)) {
    result.risk = "CRITICAL";
    result.facts.push(`CRITICAL: Single ${maxHolderType} holds ${Math.round(maxHolderPercent)}% of supply`);
    result.evidence.push(`High concentration: ${explorer}/address/${maxHolderAddress}`);
  }
  // HIGH: If deployer/owner holds >30%
  else if ((result.deployerPercent !== null && result.deployerPercent > 30) ||
           (result.ownerPercent !== null && result.ownerPercent > 30) ||
           maxHolderPercent > 50) {
    result.risk = "HIGH";
    result.facts.push("High concentration: Key addresses control significant supply");
  }
  // MEDIUM: If deployer/owner holds >5% or max holder >25%
  else if ((result.deployerPercent !== null && result.deployerPercent > 5) ||
           (result.ownerPercent !== null && result.ownerPercent > 5) ||
           maxHolderPercent > 25) {
    result.risk = "MEDIUM";
    result.facts.push("Moderate concentration detected");
  }
  // LOW: Good distribution or at least some checks passed
  else if (result.deployerPercent !== null || result.ownerPercent !== null || maxHolderPercent > 0) {
    result.risk = "LOW";
    result.facts.push("Holder distribution appears reasonable from available data");
  }
  // If we truly have no data, make educated guess based on what type of token this seems to be
  else {
    // If we found LP pools, probably legitimate
    if (actualLpCount > 0) {
      result.risk = "MEDIUM";
      result.facts.push("Limited holder data, but liquidity pools suggest active token");
    } else {
      result.risk = "MEDIUM";
      result.facts.push("Holder concentration could not be verified - assume moderate risk");
    }
  }

  // Burned supply is informational
  if (burnedSupply > 0n) {
    const burnedPercent = Number((burnedSupply * 10000n) / totalSupply) / 100;
    if (burnedPercent > 1) {
      result.facts.push(`${Math.round(burnedPercent)}% of total supply has been burned`);
      for (const burnAddr of BURN_ADDRESSES) {
        result.evidence.push(`Burn address: ${explorer}/token/${tokenAddress}?a=${burnAddr}`);
      }
    }
  }

  return result;
}
