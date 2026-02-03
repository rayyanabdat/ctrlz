import { isAddress, createPublicClient, http, getAddress, zeroAddress } from "viem";
import { getChain } from "../config/chains.js";
import { analyzeLiquidity } from "./liquidity.js";
import { analyzeConstraints } from "./constraints.js";
import { analyzeHolders } from "./holders.js";
import { calculateFinalScore } from "./scoring.js";
import { getTokenIdentity } from "./identity.js";
import { analyzeContext } from "./context.js";
import { DEX_COVERAGE, CHAIN_IDENTIFIERS } from "../config/constants.js";
import chalk from "chalk";
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
function getExplorerUrl(chainKey) {
    const explorers = {
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
export async function scanEvmContract(address, chainKey = "ethereum") {
    if (!isAddress(address)) {
        throw new Error("Invalid contract address format");
    }
    const chain = getChain(chainKey);
    const explorer = getExplorerUrl(chainKey);
    const client = createPublicClient({
        chain: undefined,
        transport: http(chain.rpcUrl, { timeout: 20000 })
    });
    // ===== TOKEN =====
    console.log("");
    console.log(chalk.cyan("━━━ TOKEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    const tokenIdentity = await getTokenIdentity(client, address);
    if (!tokenIdentity.hasCode) {
        console.log(chalk.red("No contract code found at this address"));
        console.log(chalk.gray(`Evidence: ${explorer}/address/${address}`));
        return;
    }
    console.log(`Name: ${tokenIdentity.name || "Non-standard ERC20"}`);
    console.log(`Symbol: ${tokenIdentity.symbol || "Non-standard"}`);
    console.log(`Decimals: ${tokenIdentity.decimals ?? "Assumed 18"}`);
    console.log(chalk.gray(`Contract: ${explorer}/address/${address}`));
    // ===== COVERAGE =====
    console.log("");
    console.log(chalk.cyan("━━━ COVERAGE ━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(`Chain: ${chain.name} (${chain.chainId})`);
    console.log(`Identifiers: ${(CHAIN_IDENTIFIERS[chain.key] || [chain.key]).join(", ")}`);
    console.log(`DEXes: ${(DEX_COVERAGE[chain.key] || []).join(", ")}`);
    // ===== LOGIC RISK =====
    console.log("");
    console.log(chalk.cyan("━━━ LOGIC RISK ━━━━━━━━━━━━━━━━━━━━━━"));
    const { isProxy, implementationAddress, ownerAddress, ownerType, detectedFunctions, riskLevel, logicFacts, logicEvidence } = await analyzeLogicRisk(client, address, chainKey);
    for (const fact of logicFacts) {
        console.log(`• ${fact}`);
    }
    console.log("");
    console.log(`Logic Risk: ${colorRisk(riskLevel)}`);
    console.log(chalk.gray("Evidence:"));
    for (const ev of logicEvidence) {
        console.log(chalk.gray(`  ${ev}`));
    }
    // ===== LIQUIDITY =====
    console.log("");
    console.log(chalk.cyan("━━━ LIQUIDITY ━━━━━━━━━━━━━━━━━━━━━━━"));
    const liquidityResult = await analyzeLiquidity(client, address, chain.key);
    for (const fact of liquidityResult.facts) {
        console.log(`• ${fact}`);
    }
    console.log("");
    console.log("Liquidity Risk Breakdown:");
    console.log(`  LP Control:      ${colorRisk(liquidityResult.riskBreakdown.controlRisk)}`);
    console.log(`  LP Depth:        ${colorRisk(liquidityResult.riskBreakdown.depthRisk)}`);
    console.log(`  LP Verifiability: ${colorRisk(liquidityResult.riskBreakdown.verifiabilityRisk)}`);
    if (liquidityResult.totalDepthUsd !== null) {
        console.log(`  Estimated Depth: $${liquidityResult.totalDepthUsd.toLocaleString()}`);
    }
    console.log(chalk.gray("Evidence:"));
    for (const ev of liquidityResult.evidence.slice(0, 5)) {
        console.log(chalk.gray(`  ${ev}`));
    }
    if (liquidityResult.evidence.length > 5) {
        console.log(chalk.gray(`  ... and ${liquidityResult.evidence.length - 5} more`));
    }
    // ===== CONSTRAINTS =====
    console.log("");
    console.log(chalk.cyan("━━━ TRANSFER CONSTRAINTS ━━━━━━━━━━━━"));
    const constraintResult = await analyzeConstraints(client, address, ownerAddress, ownerType);
    for (const fact of constraintResult.facts) {
        console.log(`• ${fact}`);
    }
    console.log("");
    console.log(`Constraint Risk: ${colorRisk(constraintResult.risk)}`);
    // ===== HOLDERS =====
    console.log("");
    console.log(chalk.cyan("━━━ HOLDERS ━━━━━━━━━━━━━━━━━━━━━━━━━"));
    const lpAddresses = liquidityResult.pools.map(p => p.pairAddress);
    const holderResult = await analyzeHolders(client, address, ownerAddress, lpAddresses, chainKey);
    for (const fact of holderResult.facts) {
        console.log(`• ${fact}`);
    }
    console.log("");
    console.log(`Holder Risk: ${colorRisk(holderResult.risk)}`);
    console.log(chalk.gray("Evidence:"));
    for (const ev of holderResult.evidence.slice(0, 5)) {
        console.log(chalk.gray(`  ${ev}`));
    }
    // ===== CONTEXT =====
    const contextResult = await analyzeContext(client, address, tokenIdentity, liquidityResult, constraintResult, holderResult, isProxy, ownerType);
    // ===== FINAL SCORE =====
    const hasMint = detectedFunctions.mint && detectedFunctions.mint.length > 0;
    const hasPause = detectedFunctions.pause && detectedFunctions.pause.length > 0;
    const scoreResult = calculateFinalScore({
        logicRisk: riskLevel,
        liquidityRisk: liquidityResult.riskBreakdown,
        constraintRisk: constraintResult.risk,
        holderRisk: holderResult.risk,
        contextFlags: {
            isCentralizedStablecoin: contextResult.isCentralizedStablecoin,
            isRebasingToken: contextResult.isRebasingToken,
            isLegacyToken: contextResult.isLegacyToken,
            ownershipRenounced: ownerType === "ZERO_ADDRESS",
            hasVestingPattern: contextResult.hasVestingPattern,
            hasLiquidity: liquidityResult.found,
            lpProtected: liquidityResult.isBurned || liquidityResult.isLocked,
            isProxy,
            hasMint,
            hasPause,
            liquidityDepthUsd: liquidityResult.totalDepthUsd,
            dexVersion: liquidityResult.dexVersion,
            holderConcentrationPercent: holderResult.maxSingleHolderPercent
        }
    });
    console.log("");
    console.log(chalk.cyan("━━━ FINAL SCORE ━━━━━━━━━━━━━━━━━━━━━"));
    console.log("");
    console.log(`Score: ${colorScore(scoreResult.finalScore)}/100`);
    console.log(`Risk Tier: ${colorBand(scoreResult.band)}`);
    console.log(`Confidence: ${scoreResult.confidence}`);
    console.log(`Coverage: ${scoreResult.coverageCompleteness}%`);
    console.log("");
    console.log(chalk.gray("Score Breakdown:"));
    console.log(chalk.gray(`  Base: ${scoreResult.breakdown.baseScore}`));
    for (const adj of scoreResult.breakdown.adjustments.slice(1)) {
        const sign = adj.delta >= 0 ? "+" : "";
        console.log(chalk.gray(`  ${adj.reason}: ${sign}${adj.delta}`));
    }
    if (scoreResult.breakdown.guardrailsApplied.length > 0) {
        console.log("");
        console.log(chalk.yellow("Guardrails Applied:"));
        for (const g of scoreResult.breakdown.guardrailsApplied) {
            console.log(chalk.yellow(`  ⚠ ${g}`));
        }
    }
    if (scoreResult.riskFactors.length > 0) {
        console.log("");
        console.log(chalk.gray("Risk Factors:"));
        for (const c of scoreResult.riskFactors) {
            console.log(chalk.red(`  ✗ ${c}`));
        }
    }
    if (scoreResult.positiveSignals.length > 0) {
        console.log("");
        console.log(chalk.gray("Positive Signals:"));
        for (const s of scoreResult.positiveSignals) {
            console.log(chalk.green(`  ✓ ${s}`));
        }
    }
    // ===== CONTEXT NOTES =====
    if (contextResult.notes.length > 0) {
        console.log("");
        console.log(chalk.cyan("━━━ CONTEXT ━━━━━━━━━━━━━━━━━━━━━━━━━"));
        for (const note of contextResult.notes) {
            console.log(`• ${note.note}`);
        }
    }
    // ===== SCORE BAND LEGEND =====
    console.log("");
    console.log(chalk.cyan("━━━ SCORE BANDS ━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.gray("90-100: Strong confidence, verified data"));
    console.log(chalk.gray("75-89:  Low risk, partial data"));
    console.log(chalk.gray("55-74:  Caution advised"));
    console.log(chalk.gray("<55:    High / Critical risk"));
    // ===== DISCLAIMER =====
    console.log("");
    console.log(chalk.gray("━━━ DISCLAIMER ━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.gray("This report evaluates on-chain contract structure and observable data."));
    console.log(chalk.gray("It does not guarantee safety and is not financial advice."));
    console.log(chalk.gray("Risk reflects structural exposure, not project legitimacy."));
    console.log(chalk.gray("UNKNOWN data reduces confidence and score."));
    console.log("");
}
async function analyzeLogicRisk(client, address, chainKey) {
    const explorer = getExplorerUrl(chainKey);
    let isProxy = false;
    let implementationAddress = null;
    let ownerAddress = null;
    let ownerType = "NOT_FOUND";
    const logicFacts = [];
    const logicEvidence = [];
    const detectedFunctions = {};
    // Proxy detection
    try {
        const storageValue = await client.getStorageAt({
            address: address,
            slot: IMPLEMENTATION_SLOT
        });
        if (storageValue && storageValue !== "0x" + "0".repeat(64)) {
            const addrHex = "0x" + storageValue.slice(-40);
            if (isAddress(addrHex) && addrHex !== zeroAddress) {
                isProxy = true;
                implementationAddress = getAddress(addrHex);
                logicFacts.push(`Upgradeable proxy → ${implementationAddress.slice(0, 10)}...`);
                logicEvidence.push(`Proxy implementation slot: ${explorer}/address/${address}#readProxyContract`);
                logicEvidence.push(`Implementation: ${explorer}/address/${implementationAddress}`);
            }
        }
    }
    catch { }
    if (!isProxy) {
        logicFacts.push("No proxy pattern detected");
        logicEvidence.push(`Storage slot check: ${IMPLEMENTATION_SLOT}`);
    }
    // Ownership
    try {
        const owner = await client.readContract({
            address: address,
            abi: [{ inputs: [], name: "owner", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" }],
            functionName: "owner"
        });
        if (owner && isAddress(owner)) {
            ownerAddress = getAddress(owner);
            if (ownerAddress === zeroAddress) {
                ownerType = "ZERO_ADDRESS";
                logicFacts.push("Ownership renounced (owner = 0x0)");
                logicEvidence.push(`owner(): ${explorer}/address/${address}#readContract`);
            }
            else {
                const code = await client.getCode({ address: ownerAddress });
                ownerType = (!code || code === "0x") ? "EOA" : "CONTRACT";
                logicFacts.push(`Owner: ${ownerAddress.slice(0, 10)}... (${ownerType})`);
                logicEvidence.push(`owner(): ${explorer}/address/${address}#readContract`);
                logicEvidence.push(`Owner address: ${explorer}/address/${ownerAddress}`);
            }
        }
    }
    catch {
        logicFacts.push("Ownership: Not detected (no owner() function)");
        logicEvidence.push("Evidence unavailable: owner() call failed");
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
                await client.call({ to: scanTarget, data: fn.sel });
                detectedFunctions[cat].push(fn.name);
                logicEvidence.push(`${fn.name}: ${explorer}/address/${scanTarget}#writeContract`);
            }
            catch { }
        }
    }
    const hasMint = detectedFunctions.mint.length > 0;
    const hasPause = detectedFunctions.pause.length > 0;
    const hasBlacklist = detectedFunctions.blacklist.length > 0;
    const hasFee = detectedFunctions.setFee.length > 0;
    if (hasMint)
        logicFacts.push("Mint function detected");
    if (hasPause)
        logicFacts.push("Pause function detected");
    if (hasBlacklist)
        logicFacts.push("Blacklist function detected");
    if (hasFee)
        logicFacts.push("Fee modification detected");
    // Risk calculation - STRICT rules
    let riskLevel = "LOW";
    if (hasMint && hasFee && ownerType === "EOA") {
        riskLevel = "CRITICAL";
    }
    else if ((hasMint || hasBlacklist) && ownerType === "EOA") {
        riskLevel = "HIGH";
    }
    else if (isProxy && ownerType === "EOA") {
        riskLevel = "HIGH";
    }
    else if (hasMint || hasBlacklist || hasFee) {
        riskLevel = "MEDIUM";
    }
    else if (ownerType === "ZERO_ADDRESS") {
        riskLevel = "LOW";
    }
    else if (ownerType === "NOT_FOUND") {
        riskLevel = "UNKNOWN"; // Cannot verify → UNKNOWN, not LOW
    }
    return { isProxy, implementationAddress, ownerAddress, ownerType, detectedFunctions, riskLevel, logicFacts, logicEvidence };
}
function colorRisk(risk) {
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
function colorScore(score) {
    if (score >= 90)
        return chalk.green(String(score));
    if (score >= 75)
        return chalk.greenBright(String(score));
    if (score >= 55)
        return chalk.yellow(String(score));
    return chalk.red(String(score));
}
function colorBand(band) {
    if (band.includes("STRONG"))
        return chalk.green(band);
    if (band.includes("LOW RISK"))
        return chalk.greenBright(band);
    if (band.includes("CAUTION"))
        return chalk.yellow(band);
    return chalk.red(band);
}
//# sourceMappingURL=evm.js.map