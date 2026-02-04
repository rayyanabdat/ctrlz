import { isAddress, createPublicClient, http, getAddress, zeroAddress } from "viem";
import { getChain, ChainConfig } from "../config/chains.js";
import { RpcPool } from "./rpc-pool.js";
import { DexDiscovery } from "./dex-discovery.js";
import { 
  ScanResult, 
  TokenInfo, 
  OwnershipInfo, 
  SecurityAnalysis,
  ConfidenceLevel,
  RiskLevel,
  AbortReason,
  createAbortedResult,
  shouldAbortScan
} from "./analysis-types.js";
import chalk from "chalk";

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const SCAN_TIMEOUT = 60000; // 60 seconds max per scan

export async function scanEvmContract(address: string, chainKey: string = "ethereum"): Promise<void> {
  const scanId = `scan-${Date.now()}`;
  let scanResult: ScanResult;
  
  try {
    scanResult = await performScan(address, chainKey, scanId);
  } catch (error) {
    scanResult = createAbortedResult(
      "RPC_FAILURE",
      "INITIALIZATION",
      error instanceof Error ? error.message : "Unknown error",
      { contractAddress: address, scanId, timestamp: Date.now() }
    );
  }

  // Display results
  displayScanResult(scanResult);
}
async function performScan(address: string, chainKey: string, scanId: string): Promise<ScanResult> {
  if (!isAddress(address)) {
    throw new Error("Invalid contract address format");
  }

  const chain = getChain(chainKey);
  const rpcPool = new RpcPool({
    chainId: chain.chainId,
    endpoints: chain.rpcPool
  });

  const scanResult: ScanResult = {
    contractAddress: address,
    chainId: chain.chainId,
    chainName: chain.name,
    scanId,
    timestamp: Date.now(),
    token: {} as TokenInfo,
    ownership: {} as OwnershipInfo,
    liquidity: { pools: [], liquidityLocked: null, findings: [], evidence: [], confidence: "UNVERIFIABLE", risk: "HIGH", timings: { startTime: Date.now() } },
    holders: { topHolders: [], distribution: { top10Percent: null, top100Percent: null, confidence: "UNVERIFIABLE" }, enumerationMethod: "FAILED", findings: [], evidence: [], confidence: "UNVERIFIABLE", risk: "HIGH", timings: { startTime: Date.now() } },
    security: {} as SecurityAnalysis,
    finalRisk: "HIGH",
    finalConfidence: "UNVERIFIABLE",
    totalScanTime: 0,
    rpcStats: {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0
    }
  };

  const startTime = Date.now();

  try {
    // Stage 1: Token Analysis
    console.log(chalk.cyan("━━━ ANALYZING TOKEN ━━━━━━━━━━━━━━━━━━━"));
    scanResult.token = await analyzeToken(rpcPool, address, chain);
    
    if (scanResult.token.aborted) {
      return { ...scanResult, aborted: scanResult.token.aborted };
    }

    // Stage 2: Ownership & Security Analysis (CRITICAL - check early)
    console.log(chalk.yellow("━━━ ANALYZING SECURITY ━━━━━━━━━━━━━━━━━"));
    const [ownershipResult, securityResult] = await Promise.all([
      analyzeOwnership(rpcPool, address, chain),
      analyzeSecurity(rpcPool, address, chain)
    ]);

    scanResult.ownership = ownershipResult;
    scanResult.security = securityResult;

    // Early abort on CRITICAL security risk
    if (shouldAbortScan(securityResult) || shouldAbortScan(ownershipResult)) {
      const reason: AbortReason = securityResult.risk === "CRITICAL" ? "CRITICAL_RISK" : "HIGH_RISK";
      return {
        ...scanResult,
        aborted: {
          reason,
          stage: "SECURITY_ANALYSIS",
          message: `Scan aborted due to ${reason.toLowerCase().replace('_', ' ')}`
        },
        finalRisk: securityResult.risk === "CRITICAL" ? "CRITICAL" : "HIGH"
      };
    }

    // Stage 3: Liquidity Analysis (parallel with holders)
    console.log(chalk.green("━━━ ANALYZING LIQUIDITY ━━━━━━━━━━━━━━━━"));
    const dexDiscovery = new DexDiscovery(rpcPool, chainKey);
    scanResult.liquidity = await dexDiscovery.discoverLiquidity(address);

    // Stage 4: Holder Analysis
    console.log(chalk.red("━━━ ANALYZING HOLDERS ━━━━━━━━━━━━━━━━━━"));
    scanResult.holders = await analyzeHoldersEnhanced(rpcPool, address, chain, scanResult.ownership.ownerAddress);

    // Calculate final risk assessment
    scanResult.finalRisk = calculateFinalRisk(scanResult);
    scanResult.finalConfidence = calculateFinalConfidence(scanResult);
    scanResult.totalScanTime = Date.now() - startTime;

    // Collect RPC stats
    const rpcStats = rpcPool.getStats();
    scanResult.rpcStats = {
      totalCalls: Object.values(rpcStats.failureCounts).reduce((a, b) => a + b, 0),
      successfulCalls: 0, // Would need to track this in RpcPool
      failedCalls: Object.values(rpcStats.failureCounts).reduce((a, b) => a + b, 0),
      averageResponseTime: 0 // Would need to track this in RpcPool
    };

    return scanResult;

  } catch (error) {
    return createAbortedResult(
      "RPC_FAILURE",
      "SCAN_EXECUTION",
      error instanceof Error ? error.message : "Unknown error",
      scanResult
    );
  }
}

async function analyzeToken(rpcPool: RpcPool, address: string, chain: ChainConfig): Promise<TokenInfo> {
  const startTime = Date.now();
  const result: TokenInfo = {
    name: null,
    symbol: null,
    decimals: null,
    totalSupply: null,
    isStandard: false,
    findings: [],
    evidence: [],
    confidence: "UNVERIFIABLE",
    risk: "HIGH",
    timings: { startTime }
  };

  try {
    // Check if contract has code
    const codeResult = await rpcPool.call(
      "eth_getCode",
      [address, "latest"],
      `code_${address}`
    );

    if (!codeResult.success || !codeResult.data || codeResult.data === "0x") {
      result.findings.push("No contract code found at this address");
      result.evidence.push({
        description: `Contract code check: ${getExplorerUrl(chain.key)}/address/${address}`,
        confidence: "VERIFIED",
        method: "RPC_CALL"
      });
      result.risk = "CRITICAL";
      result.aborted = {
        reason: "CRITICAL_RISK",
        stage: "TOKEN_ANALYSIS",
        message: "Address has no contract code"
      };
      return result;
    }

    // Try to get token information in parallel
    const [nameResult, symbolResult, decimalsResult, supplyResult] = await Promise.allSettled([
      rpcPool.call("eth_call", [{ to: address, data: "0x06fdde03" }], `name_${address}`), // name()
      rpcPool.call("eth_call", [{ to: address, data: "0x95d89b41" }], `symbol_${address}`), // symbol()
      rpcPool.call("eth_call", [{ to: address, data: "0x313ce567" }], `decimals_${address}`), // decimals()
      rpcPool.call("eth_call", [{ to: address, data: "0x18160ddd" }], `supply_${address}`) // totalSupply()
    ]);

    // Process results
    let standardFunctions = 0;

    if (nameResult.status === "fulfilled" && nameResult.value.success) {
      result.name = decodeString(nameResult.value.data) || "Unknown";
      standardFunctions++;
    }

    if (symbolResult.status === "fulfilled" && symbolResult.value.success) {
      result.symbol = decodeString(symbolResult.value.data) || "Unknown";
      standardFunctions++;
    }

    if (decimalsResult.status === "fulfilled" && decimalsResult.value.success) {
      const decimals = parseInt(decimalsResult.value.data.slice(-2), 16);
      if (!isNaN(decimals) && decimals <= 77) {
        result.decimals = decimals;
        standardFunctions++;
      }
    }

    if (supplyResult.status === "fulfilled" && supplyResult.value.success) {
      result.totalSupply = BigInt(supplyResult.value.data).toString();
      standardFunctions++;
    }

    // Determine if it's a standard ERC20
    result.isStandard = standardFunctions >= 3;
    result.confidence = standardFunctions >= 2 ? "VERIFIED" : "PARTIAL";
    result.risk = result.isStandard ? "LOW" : "MEDIUM";

    if (result.isStandard) {
      result.findings.push(`Standard ERC20 token detected (${standardFunctions}/4 functions)`);
    } else {
      result.findings.push(`Non-standard token (only ${standardFunctions}/4 ERC20 functions found)`);
    }

    result.evidence.push({
      description: `Token functions: ${getExplorerUrl(chain.key)}/address/${address}#readContract`,
      confidence: result.confidence,
      method: "RPC_CALL"
    });

  } catch (error) {
    result.findings.push(`Token analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    result.confidence = "UNVERIFIABLE";
    result.risk = "HIGH";
  }

  result.timings.endTime = Date.now();
  result.timings.duration = result.timings.endTime - result.timings.startTime;
  return result;
}

async function analyzeOwnership(rpcPool: RpcPool, address: string, chain: ChainConfig): Promise<OwnershipInfo> {
  const startTime = Date.now();
  const result: OwnershipInfo = {
    ownerAddress: null,
    ownerType: null,
    isProxy: false,
    implementationAddress: null,
    upgradeability: "UNKNOWN",
    findings: [],
    evidence: [],
    confidence: "UNVERIFIABLE",
    risk: "HIGH",
    timings: { startTime }
  };

  try {
    // Check for proxy pattern first
    const storageResult = await rpcPool.call(
      "eth_getStorageAt",
      [address, IMPLEMENTATION_SLOT, "latest"],
      `proxy_${address}`
    );

    if (storageResult.success && storageResult.data && storageResult.data !== "0x" + "0".repeat(64)) {
      const implAddr = "0x" + storageResult.data.slice(-40);
      if (isAddress(implAddr) && implAddr !== zeroAddress) {
        result.isProxy = true;
        result.implementationAddress = getAddress(implAddr);
        result.upgradeability = "UPGRADEABLE";
        result.findings.push(`Upgradeable proxy pattern detected`);
        result.evidence.push({
          description: `Implementation: ${getExplorerUrl(chain.key)}/address/${result.implementationAddress}`,
          confidence: "VERIFIED",
          method: "RPC_CALL"
        });
      }
    }

    // Try multiple ownership patterns
    const ownershipPatterns = [
      { selector: "0x8da5cb5b", name: "owner()" },
      { selector: "0x893d20e8", name: "getOwner()" }
    ];

    for (const pattern of ownershipPatterns) {
      const ownerResult = await rpcPool.call(
        "eth_call",
        [{ to: address, data: pattern.selector }],
        `owner_${address}_${pattern.name}`
      );

      if (ownerResult.success && ownerResult.data && ownerResult.data.length >= 66) {
        const ownerAddr = "0x" + ownerResult.data.slice(-40);
        if (isAddress(ownerAddr)) {
          result.ownerAddress = getAddress(ownerAddr);
          
          if (result.ownerAddress === zeroAddress) {
            result.ownerType = "ZERO_ADDRESS";
            result.findings.push("Ownership renounced (owner = 0x0)");
            result.risk = "LOW";
          } else {
            // Check if owner is a contract
            const ownerCodeResult = await rpcPool.call(
              "eth_getCode",
              [result.ownerAddress, "latest"],
              `owner_code_${result.ownerAddress}`
            );

            if (ownerCodeResult.success && ownerCodeResult.data && ownerCodeResult.data !== "0x") {
              result.ownerType = "CONTRACT";
              result.findings.push(`Owner is a contract: ${result.ownerAddress.slice(0, 10)}...`);
              result.risk = "MEDIUM";
            } else {
              result.ownerType = "EOA";
              result.findings.push(`Owner is an EOA: ${result.ownerAddress.slice(0, 10)}...`);
              result.risk = result.isProxy ? "HIGH" : "MEDIUM";
            }
          }

          result.confidence = "VERIFIED";
          result.evidence.push({
            description: `${pattern.name}: ${getExplorerUrl(chain.key)}/address/${result.ownerAddress}`,
            confidence: "VERIFIED",
            method: "RPC_CALL"
          });
          break;
        }
      }
    }

    if (!result.ownerAddress) {
      result.findings.push("No standard ownership pattern detected");
      result.confidence = "VERIFIED";
      result.risk = "LOW"; // No owner = decentralized
    }

  } catch (error) {
    result.findings.push(`Ownership analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    result.confidence = "UNVERIFIABLE";
    result.risk = "HIGH";
  }

  result.timings.endTime = Date.now();
  result.timings.duration = result.timings.endTime - result.timings.startTime;
  return result;
}

async function analyzeSecurity(rpcPool: RpcPool, address: string, chain: ChainConfig): Promise<SecurityAnalysis> {
  const startTime = Date.now();
  const result: SecurityAnalysis = {
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
    confidence: "PARTIAL",
    risk: "LOW",
    timings: { startTime }
  };

  try {
    // Check for dangerous functions
    const functionChecks = [
      { selector: "0x40c10f19", name: "mint", key: "mint" as const },
      { selector: "0x42966c68", name: "burn", key: "burn" as const },
      { selector: "0x8456cb59", name: "pause", key: "pause" as const },
      { selector: "0xf9f92be4", name: "blacklist", key: "blacklist" as const },
      { selector: "0x69fe0e2d", name: "setFee", key: "setFee" as const },
      { selector: "0xb782ac4c", name: "rescue", key: "rescue" as const }
    ];

    const functionResults = await Promise.allSettled(
      functionChecks.map(fn => 
        rpcPool.call("eth_call", [{ to: address, data: fn.selector }], `func_${address}_${fn.name}`)
      )
    );

    let detectedFunctions = 0;
    let criticalFunctions = 0;

    functionResults.forEach((fnResult, index) => {
      const functionCheck = functionChecks[index];
      if (fnResult.status === "fulfilled" && fnResult.value.success) {
        result.functions[functionCheck.key] = true;
        detectedFunctions++;
        
        if (functionCheck.key === "mint" || functionCheck.key === "blacklist" || functionCheck.key === "setFee") {
          criticalFunctions++;
        }
        
        result.findings.push(`${functionCheck.name}() function detected`);
        result.evidence.push({
          description: `${functionCheck.name}(): ${getExplorerUrl(chain.key)}/address/${address}#writeContract`,
          confidence: "VERIFIED",
          method: "RPC_CALL"
        });
      }
    });

    // Risk assessment based on detected functions
    if (criticalFunctions >= 2) {
      result.risk = "CRITICAL";
      result.findings.push(`CRITICAL: Multiple dangerous functions (${criticalFunctions}) detected`);
    } else if (criticalFunctions === 1) {
      result.risk = "HIGH";
      result.findings.push(`HIGH: Dangerous function detected`);
    } else if (detectedFunctions > 0) {
      result.risk = "MEDIUM";
    } else {
      result.risk = "LOW";
      result.findings.push("No dangerous functions detected");
    }

    result.confidence = "VERIFIED";

  } catch (error) {
    result.findings.push(`Security analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    result.confidence = "UNVERIFIABLE";
    result.risk = "HIGH";
  }

  result.timings.endTime = Date.now();
  result.timings.duration = result.timings.endTime - result.timings.startTime;
  return result;
}

async function analyzeHoldersEnhanced(rpcPool: RpcPool, address: string, chain: ChainConfig, ownerAddress: string | null): Promise<import("./analysis-types.js").HolderInfo> {
  const startTime = Date.now();
  const result: import("./analysis-types.js").HolderInfo = {
    topHolders: [],
    distribution: {
      top10Percent: null,
      top100Percent: null,
      confidence: "UNVERIFIABLE"
    },
    enumerationMethod: "FAILED",
    findings: [],
    evidence: [],
    confidence: "PARTIAL",
    risk: "MEDIUM",
    timings: { startTime }
  };

  try {
    // Get total supply first
    const supplyResult = await rpcPool.call(
      "eth_call",
      [{ to: address, data: "0x18160ddd" }], // totalSupply()
      `supply_${address}`
    );

    if (!supplyResult.success) {
      result.findings.push("Could not retrieve total supply");
      result.confidence = "UNVERIFIABLE";
      result.risk = "HIGH";
      return result;
    }

    const totalSupply = BigInt(supplyResult.data);
    
    // Check key addresses we know about
    const addressesToCheck = [
      { addr: ownerAddress, type: "Owner" },
      { addr: "0x000000000000000000000000000000000000dead", type: "Burn" },
      { addr: "0x0000000000000000000000000000000000000000", type: "Zero" },
      { addr: address, type: "Contract" } // Self-held
    ].filter(item => item.addr && isAddress(item.addr));

    const balanceChecks = await Promise.allSettled(
      addressesToCheck.map(item => 
        rpcPool.call(
          "eth_call",
          [{ to: address, data: "0x70a08231" + item.addr!.slice(2).padStart(64, '0') }], // balanceOf(address)
          `balance_${address}_${item.addr}`
        ).then(result => ({ ...item, result }))
      )
    );

    let totalChecked = 0n;
    let knownHolders = 0;

    balanceChecks.forEach(check => {
      if (check.status === "fulfilled" && check.value.result.success) {
        const balance = BigInt(check.value.result.data);
        if (balance > 0n) {
          const percentage = Number((balance * 10000n) / totalSupply) / 100;
          
          result.topHolders.push({
            address: check.value.addr!,
            balance: balance.toString(),
            percentage,
            type: check.value.type === "Contract" ? "CONTRACT" : 
                  check.value.type === "Burn" || check.value.type === "Zero" ? "BURN" : "EOA",
            confidence: "VERIFIED"
          });
          
          totalChecked += balance;
          knownHolders++;
        }
      }
    });

    // Sort by percentage
    result.topHolders.sort((a, b) => b.percentage - a.percentage);

    if (knownHolders > 0) {
      result.enumerationMethod = "PARTIAL";
      result.confidence = "PARTIAL";
      
      const checkedPercentage = Number((totalChecked * 10000n) / totalSupply) / 100;
      result.findings.push(`Analyzed ${knownHolders} key addresses representing ${checkedPercentage.toFixed(1)}% of supply`);
      
      // Risk assessment based on concentration
      const maxHolderPercentage = result.topHolders[0]?.percentage || 0;
      if (maxHolderPercentage > 50) {
        result.risk = "CRITICAL";
        result.findings.push(`CRITICAL: Single address holds ${maxHolderPercentage.toFixed(1)}% of supply`);
      } else if (maxHolderPercentage > 30) {
        result.risk = "HIGH";
        result.findings.push(`HIGH: Concentrated ownership detected`);
      } else if (maxHolderPercentage > 10) {
        result.risk = "MEDIUM";
      } else {
        result.risk = "LOW";
        result.findings.push("Reasonable distribution among checked addresses");
      }
    } else {
      result.findings.push("No significant balances found in checked addresses");
      result.enumerationMethod = "FAILED";
      result.risk = "MEDIUM"; // Unknown = moderate risk
    }

    result.evidence.push({
      description: `Token holders: ${getExplorerUrl(chain.key)}/token/${address}#balances`,
      confidence: "PARTIAL",
      method: "EXTERNAL_API"
    });

  } catch (error) {
    result.findings.push(`Holder analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    result.confidence = "UNVERIFIABLE";
    result.risk = "HIGH";
  }

  result.timings.endTime = Date.now();
  result.timings.duration = result.timings.endTime - result.timings.startTime;
  return result;
}

function calculateFinalRisk(scanResult: ScanResult): RiskLevel {
  const risks = [
    scanResult.token.risk,
    scanResult.ownership.risk,
    scanResult.security.risk,
    scanResult.liquidity.risk,
    scanResult.holders.risk
  ];

  // If any component is CRITICAL, final is CRITICAL
  if (risks.includes("CRITICAL")) return "CRITICAL";
  
  // If any verified component is HIGH, final is HIGH
  if (risks.includes("HIGH")) return "HIGH";
  
  // If majority is MEDIUM or higher, final is MEDIUM
  const mediumOrHigher = risks.filter(r => r === "MEDIUM" || r === "HIGH").length;
  if (mediumOrHigher >= 3) return "MEDIUM";
  
  return "LOW";
}

function calculateFinalConfidence(scanResult: ScanResult): ConfidenceLevel {
  const confidences = [
    scanResult.token.confidence,
    scanResult.ownership.confidence,
    scanResult.security.confidence,
    scanResult.liquidity.confidence,
    scanResult.holders.confidence
  ];

  // If any is UNVERIFIABLE, final is UNVERIFIABLE
  if (confidences.includes("UNVERIFIABLE")) return "UNVERIFIABLE";
  
  // If all are VERIFIED, final is VERIFIED
  if (confidences.every(c => c === "VERIFIED")) return "VERIFIED";
  
  return "PARTIAL";
}

function displayScanResult(result: ScanResult): void {
  // Banner and basic info
  console.log("");
  console.log(chalk.blue("━━━ SCAN RESULTS ━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.white(`Contract: ${chalk.cyan(result.contractAddress)}`));
  console.log(chalk.white(`Chain: ${chalk.cyan(result.chainName)} (${result.chainId})`));
  console.log(chalk.white(`Scan ID: ${chalk.gray(result.scanId)}`));
  
  if (result.aborted) {
    console.log("");
    console.log(chalk.red("⚠️  SCAN ABORTED"));
    console.log(chalk.red(`Reason: ${result.aborted.reason.replace('_', ' ')}`));
    console.log(chalk.red(`Stage: ${result.aborted.stage}`));
    console.log(chalk.red(`Message: ${result.aborted.message}`));
    console.log("");
  }

  // Token Information
  console.log("");
  console.log(chalk.cyan("━━━ TOKEN INFO ━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.white(`Name: ${chalk.green(result.token.name || "Unknown")}`));
  console.log(chalk.white(`Symbol: ${chalk.green(result.token.symbol || "Unknown")}`));
  console.log(chalk.white(`Decimals: ${chalk.green(String(result.token.decimals ?? "Unknown"))}`));
  console.log(chalk.white(`Standard: ${result.token.isStandard ? chalk.green("ERC20") : chalk.yellow("Non-standard")}`));
  
  displayAnalysisSection("TOKEN", result.token);

  // Security Analysis
  console.log("");
  console.log(chalk.yellow("━━━ SECURITY ANALYSIS ━━━━━━━━━━━━━━━"));
  
  const functions = result.security.functions;
  const activeFunctions = Object.entries(functions).filter(([_, active]) => active).map(([name]) => name);
  
  if (activeFunctions.length > 0) {
    console.log(chalk.white(`Dangerous Functions: ${chalk.red(activeFunctions.join(", "))}`));
  } else {
    console.log(chalk.white(`Dangerous Functions: ${chalk.green("None detected")}`));
  }
  
  displayAnalysisSection("SECURITY", result.security);

  // Ownership
  console.log("");
  console.log(chalk.magenta("━━━ OWNERSHIP ━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.white(`Owner: ${result.ownership.ownerAddress ? 
    chalk.cyan(`${result.ownership.ownerAddress.slice(0, 10)}... (${result.ownership.ownerType})`) : 
    chalk.green("None")}`));
  console.log(chalk.white(`Proxy: ${result.ownership.isProxy ? chalk.red("Yes") : chalk.green("No")}`));
  console.log(chalk.white(`Upgradeable: ${result.ownership.upgradeability === "UPGRADEABLE" ? chalk.red("Yes") : chalk.green("No")}`));
  
  displayAnalysisSection("OWNERSHIP", result.ownership);

  // Liquidity
  console.log("");
  console.log(chalk.green("━━━ LIQUIDITY ━━━━━━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.white(`Pools Found: ${chalk.green(String(result.liquidity.pools.length))}`));
  
  if (result.liquidity.totalTvlUsd) {
    console.log(chalk.white(`Total TVL: ${chalk.green(`$${result.liquidity.totalTvlUsd.amount.toLocaleString()}`)} (${result.liquidity.totalTvlUsd.confidence})`));
  }
  
  console.log(chalk.white(`Liquidity Locked: ${result.liquidity.liquidityLocked === true ? chalk.green("Yes") : 
    result.liquidity.liquidityLocked === false ? chalk.red("No") : chalk.yellow("Unknown")}`));
  
  displayAnalysisSection("LIQUIDITY", result.liquidity);

  // Holders
  console.log("");
  console.log(chalk.red("━━━ HOLDER ANALYSIS ━━━━━━━━━━━━━━━━━"));
  console.log(chalk.white(`Method: ${chalk.cyan(result.holders.enumerationMethod)}`));
  console.log(chalk.white(`Top Holders: ${chalk.cyan(String(result.holders.topHolders.length))}`));
  
  if (result.holders.topHolders.length > 0) {
    const topHolder = result.holders.topHolders[0];
    console.log(chalk.white(`Largest: ${chalk.red(`${topHolder.percentage.toFixed(2)}%`)} (${topHolder.type})`));
  }
  
  displayAnalysisSection("HOLDERS", result.holders);

  // Final Assessment
  console.log("");
  console.log(chalk.blue("━━━ FINAL ASSESSMENT ━━━━━━━━━━━━━━━━"));
  console.log(chalk.white(`Overall Risk: ${colorRisk(result.finalRisk)}`));
  console.log(chalk.white(`Confidence: ${colorConfidence(result.finalConfidence)}`));
  console.log(chalk.white(`Scan Time: ${chalk.gray(`${result.totalScanTime}ms`)}`));
  
  // RPC Statistics
  console.log("");
  console.log(chalk.gray("━━━ RPC STATISTICS ━━━━━━━━━━━━━━━━━━"));
  console.log(chalk.gray(`Total Calls: ${result.rpcStats.totalCalls}`));
  console.log(chalk.gray(`Success Rate: ${result.rpcStats.successfulCalls}/${result.rpcStats.totalCalls}`));
}

function displayAnalysisSection(title: string, analysis: any): void {
  analysis.findings.forEach((finding: string) => {
    console.log(chalk.white(`• ${finding}`));
  });
  
  console.log("");
  console.log(chalk.white(`${title} Risk: ${colorRisk(analysis.risk)} (${colorConfidence(analysis.confidence)})`));
  
  if (analysis.evidence.length > 0) {
    console.log(chalk.gray("Evidence:"));
    analysis.evidence.slice(0, 3).forEach((evidence: any) => {
      console.log(chalk.gray(`  • ${evidence.description} [${evidence.confidence}]`));
    });
    
    if (analysis.evidence.length > 3) {
      console.log(chalk.gray(`  ... and ${analysis.evidence.length - 3} more`));
    }
  }
}

// Helper functions
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

function decodeString(data: string): string | null {
  if (!data || data === "0x" || data.length < 66) return null;
  
  try {
    const hex = data.slice(2);
    if (hex.length >= 128) {
      const offset = parseInt(hex.slice(0, 64), 16) * 2;
      const length = parseInt(hex.slice(64, 128), 16);
      const stringData = hex.slice(128, 128 + length * 2);
      return Buffer.from(stringData, 'hex').toString('utf8').replace(/\0/g, '');
    }
  } catch {
    return null;
  }
  return null;
}

function colorRisk(risk: string): string {
  switch (risk) {
    case "LOW": return chalk.green(risk);
    case "MEDIUM": return chalk.yellow(risk);
    case "HIGH": return chalk.red(risk);
    case "CRITICAL": return chalk.redBright(risk);
    default: return chalk.magenta(risk);
  }
}

function colorConfidence(confidence: string): string {
  switch (confidence) {
    case "VERIFIED": return chalk.green(confidence);
    case "PARTIAL": return chalk.yellow(confidence);
    case "UNVERIFIABLE": return chalk.red(confidence);
    default: return chalk.gray(confidence);
  }
}
      // Check DEFAULT_ADMIN_ROLE
      const hasRole = await client.call({
        to: address as `0x${string}`,
        data: "0x2f2ff15d0000000000000000000000000000000000000000000000000000000000000000" // hasRole(bytes32,address) with zero role
      });
      if (hasRole) {
        logicFacts.push("AccessControl pattern detected (no single owner)");
        logicEvidence.push(`AccessControl: ${explorer}/address/${address}#readContract`);
        ownerType = "CONTRACT"; // Managed by roles
        ownershipDetected = true;
      }
    } catch {}
  }
  
  // 4. Smart assumption: if no ownership pattern, likely a simple token
  if (!ownershipDetected) {
    // Check if it's a common pattern token by looking for typical functions
    const hasTransfer = await checkFunctionExists(client, address, "0xa9059cbb"); // transfer
    const hasApprove = await checkFunctionExists(client, address, "0x095ea7b3"); // approve
    
    if (hasTransfer && hasApprove) {
      logicFacts.push("Standard ERC20 (no ownership controls detected)");
      logicEvidence.push("Standard transfer/approve functions found");
      ownerType = "ZERO_ADDRESS"; // Treat as decentralized
    } else {
      logicFacts.push("Ownership: Unknown pattern (contract may use custom logic)");
      logicEvidence.push("No standard ownership patterns found");
      ownerType = "NOT_FOUND";
    }
  }

  // Function scanning
  const scanTarget = implementationAddress || address;
  const functions = {
    mint: [{ name: "mint(address,uint256)", sel: "0x40c10f19" }],
    pause: [{ name: "pause()", sel: "0x8456cb59" }],
    blacklist: [{ name: "blacklist(address)", sel: "0xf9f92be4" }],
    setFee: [{ name: "setFee(uint256)", sel: "0x69fe0e2d" }]
  };

  for (const [cat, fns] of Object.entries(functions)) {
    detectedFunctions[cat] = [];
    for (const fn of fns) {
      try {
        await client.call({ to: scanTarget as `0x${string}`, data: fn.sel as `0x${string}` });
        detectedFunctions[cat].push(fn.name);
        logicEvidence.push(`${fn.name}: ${explorer}/address/${scanTarget}#writeContract`);
      } catch {}
    }
  }

  const hasMint = detectedFunctions.mint.length > 0;
  const hasPause = detectedFunctions.pause.length > 0;
  const hasBlacklist = detectedFunctions.blacklist.length > 0;
  const hasFee = detectedFunctions.setFee.length > 0;

  if (hasMint) logicFacts.push("Mint function detected");
  if (hasPause) logicFacts.push("Pause function detected");
  if (hasBlacklist) logicFacts.push("Blacklist function detected");
  if (hasFee) logicFacts.push("Fee modification detected");

  // Risk calculation - IMPROVED logic
  let riskLevel: RiskLevel = "LOW";

  if (hasMint && hasFee && ownerType === "EOA") {
    riskLevel = "CRITICAL";
  } else if ((hasMint || hasBlacklist) && ownerType === "EOA") {
    riskLevel = "HIGH";
  } else if (isProxy && ownerType === "EOA") {
    riskLevel = "HIGH";
  } else if (hasMint || hasBlacklist || hasFee) {
    riskLevel = "MEDIUM";
  } else if (ownerType === "ZERO_ADDRESS") {
    riskLevel = "LOW";
  } else if (ownerType === "CONTRACT") {
    riskLevel = "MEDIUM"; // Managed by contract, could be good or bad
  } else {
    // Instead of UNKNOWN, make educated guess based on what we found
    if (isProxy) {
      riskLevel = "MEDIUM"; // Proxy but can't determine owner control
    } else {
      riskLevel = "LOW"; // Simple contract, likely safe
    }
  }

  return { isProxy, implementationAddress, ownerAddress, ownerType, detectedFunctions, riskLevel, logicFacts, logicEvidence };
}

// Helper function to check if a function exists
async function checkFunctionExists(client: any, address: string, selector: string): Promise<boolean> {
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

function colorRisk(risk: string): string {
  switch (risk) {
    case "LOW": return chalk.green(risk);
    case "MEDIUM": return chalk.yellow(risk);
    case "HIGH": return chalk.red(risk);
    case "CRITICAL": return chalk.redBright(risk);
    case "UNKNOWN": return chalk.magenta(risk);
    case "UNVERIFIABLE": return chalk.magenta(risk);
    default: return risk;
  }
}

function colorScore(score: number): string {
  if (score >= 90) return chalk.green(String(score));
  if (score >= 75) return chalk.greenBright(String(score));
  if (score >= 55) return chalk.yellow(String(score));
  return chalk.red(String(score));
}

function colorBand(band: string): string {
  if (band.includes("STRONG")) return chalk.green(band);
  if (band.includes("LOW RISK")) return chalk.greenBright(band);
  if (band.includes("CAUTION")) return chalk.yellow(band);
  return chalk.red(band);
}
