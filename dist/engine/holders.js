import { getAddress } from "viem";
import { BURN_ADDRESSES } from "../config/constants.js";
// Known system addresses to label (not exclude from risk)
const SYSTEM_LABELS = {
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
};
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
function isSystemAddress(address) {
    const lower = address.toLowerCase();
    return BURN_ADDRESSES.some(burn => burn.toLowerCase() === lower) ||
        lower in SYSTEM_LABELS;
}
async function getDeployerAddress(client, contractAddress) {
    try {
        const deployerPatterns = [
            { name: "deployer", selector: "0xd5f39488" },
            { name: "creator", selector: "0x02d05d3f" }
        ];
        for (const pattern of deployerPatterns) {
            try {
                const result = await client.call({
                    to: contractAddress,
                    data: pattern.selector
                });
                if (result && result.data && result.data.length >= 66) {
                    const address = "0x" + result.data.slice(-40);
                    if (address !== "0x0000000000000000000000000000000000000000") {
                        return getAddress(address);
                    }
                }
            }
            catch {
                // Pattern not available
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
async function getTokenBalance(client, tokenAddress, holderAddress) {
    try {
        const balance = await client.readContract({
            address: tokenAddress,
            abi: [ERC20_ABI.balanceOf],
            functionName: "balanceOf",
            args: [holderAddress]
        });
        return BigInt(balance);
    }
    catch {
        return 0n;
    }
}
async function getTotalSupply(client, tokenAddress) {
    try {
        const supply = await client.readContract({
            address: tokenAddress,
            abi: [ERC20_ABI.totalSupply],
            functionName: "totalSupply"
        });
        return BigInt(supply);
    }
    catch {
        return null;
    }
}
async function isContract(client, address) {
    try {
        const code = await client.getCode({ address: address });
        return code !== undefined && code !== "0x" && code.length > 2;
    }
    catch {
        return false;
    }
}
export async function analyzeHolders(client, tokenAddress, ownerAddress, knownLpAddresses = [], chainKey = "ethereum") {
    const explorer = getExplorerUrl(chainKey);
    const result = {
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
    // Get deployer address
    result.deployerAddress = await getDeployerAddress(client, tokenAddress);
    // Calculate burned/null address holdings
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
    // Track max single holder percentage
    let maxHolderPercent = 0;
    let maxHolderAddress = null;
    let maxHolderType = null;
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
            }
            else {
                result.facts.push("Deployer holds <1% of circulating supply");
            }
        }
        else {
            result.deployerPercent = 0;
            result.facts.push("Deployer holds 0% of circulating supply");
        }
    }
    else {
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
    // Check LP addresses
    let lpHoldings = 0n;
    for (const lpAddr of knownLpAddresses) {
        const lpBalance = await getTokenBalance(client, tokenAddress, lpAddr);
        lpHoldings += lpBalance;
    }
    if (lpHoldings > 0n && knownLpAddresses.length > 0) {
        const lpPercent = Number((lpHoldings * 10000n) / circulatingSupply) / 100;
        result.facts.push(`${Math.round(lpPercent)}% of supply is in liquidity pools`);
        for (const lpAddr of knownLpAddresses) {
            result.evidence.push(`LP holdings: ${explorer}/token/${tokenAddress}?a=${lpAddr}`);
        }
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
    // ENUMERATION STATUS
    // ============================================================
    // Without indexer, we cannot enumerate all holders
    result.enumerationComplete = false;
    result.facts.push("Full holder enumeration requires indexer (not available)");
    result.evidence.push(`Token holders page (external): ${explorer}/token/${tokenAddress}#balances`);
    // ============================================================
    // RISK DETERMINATION - HARD RULES
    // ============================================================
    // HARD RULE: If single EOA or contract holds ≥80% → HIGH risk
    if (maxHolderPercent >= 80 && maxHolderAddress && !isSystemAddress(maxHolderAddress)) {
        result.risk = "HIGH";
        result.facts.push(`CRITICAL: Single ${maxHolderType} holds ${Math.round(maxHolderPercent)}% of circulating supply`);
        result.evidence.push(`High concentration holder: ${explorer}/address/${maxHolderAddress}`);
    }
    // If deployer/owner holds >40% → HIGH
    else if ((result.deployerPercent !== null && result.deployerPercent > 40) ||
        (result.ownerPercent !== null && result.ownerPercent > 40)) {
        result.risk = "HIGH";
        result.facts.push("High concentration: Deployer or owner controls significant supply");
    }
    // If deployer/owner holds >10% → MEDIUM
    else if ((result.deployerPercent !== null && result.deployerPercent > 10) ||
        (result.ownerPercent !== null && result.ownerPercent > 10)) {
        result.risk = "MEDIUM";
        result.facts.push("Deployer or owner retains notable share of supply");
    }
    // If we could not identify deployer AND owner percentage → UNKNOWN (not LOW)
    else if (result.deployerPercent === null && result.ownerPercent === null) {
        result.risk = "UNKNOWN";
        result.facts.push("Holder concentration could not be fully verified");
        result.evidence.push("Evidence unavailable: Could not identify key holder addresses");
    }
    // If deployer/owner holds minimal or zero → LOW only if verifiable
    else if ((result.deployerPercent !== null && result.deployerPercent <= 10) &&
        (result.ownerPercent === null || result.ownerPercent <= 10)) {
        // Even with low known concentration, we mark as MEDIUM due to incomplete enumeration
        result.risk = "MEDIUM";
        result.facts.push("Known key holders have low concentration, but full distribution unknown");
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
//# sourceMappingURL=holders.js.map