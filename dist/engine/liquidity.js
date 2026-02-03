import { getAddress, formatUnits } from "viem";
import { DEX_FACTORIES, V3_FEE_TIERS, BURN_ADDRESSES, KNOWN_LOCKERS, UNISWAP_V4_POOL_MANAGER } from "../config/constants.js";
import { CHAINS } from "../config/chains.js";
// Stablecoin addresses with decimals (for USD estimation)
const STABLECOIN_DECIMALS = {
    // Ethereum
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6 },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6 },
    "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", decimals: 18 },
    // Base
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { symbol: "USDC", decimals: 6 },
    "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": { symbol: "DAI", decimals: 18 },
    // BSC
    "0x55d398326f99059ff775485246999027b3197955": { symbol: "USDT", decimals: 18 },
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": { symbol: "USDC", decimals: 18 },
    "0xe9e7cea3dedca5984780bafc599bd69add087d56": { symbol: "BUSD", decimals: 18 },
};
const V2_FACTORY_ABI = [
    {
        inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }],
        name: "getPair",
        outputs: [{ name: "pair", type: "address" }],
        stateMutability: "view",
        type: "function"
    }
];
const V2_PAIR_ABI = [
    { inputs: [], name: "getReserves", outputs: [{ name: "reserve0", type: "uint112" }, { name: "reserve1", type: "uint112" }, { name: "blockTimestampLast", type: "uint32" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "token0", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "token1", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "totalSupply", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" }
];
const V3_FACTORY_ABI = [
    {
        inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "fee", type: "uint24" }],
        name: "getPool",
        outputs: [{ name: "pool", type: "address" }],
        stateMutability: "view",
        type: "function"
    }
];
const V3_POOL_ABI = [
    { inputs: [], name: "liquidity", outputs: [{ name: "", type: "uint128" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "slot0", outputs: [{ name: "sqrtPriceX96", type: "uint160" }, { name: "tick", type: "int24" }, { name: "observationIndex", type: "uint16" }, { name: "observationCardinality", type: "uint16" }, { name: "observationCardinalityNext", type: "uint16" }, { name: "feeProtocol", type: "uint8" }, { name: "unlocked", type: "bool" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "token0", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "token1", outputs: [{ name: "", type: "address" }], stateMutability: "view", type: "function" }
];
const ERC20_DECIMALS_ABI = [
    { inputs: [], name: "decimals", outputs: [{ name: "", type: "uint8" }], stateMutability: "view", type: "function" }
];
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
function getDexUrl(dexName, chainKey, pairAddress) {
    const dexUrls = {
        "Uniswap": `https://app.uniswap.org/explore/pools/${chainKey === "ethereum" ? "ethereum" : chainKey}/${pairAddress}`,
        "Uniswap V3": `https://app.uniswap.org/explore/pools/${chainKey === "ethereum" ? "ethereum" : chainKey}/${pairAddress}`,
        "SushiSwap": `https://www.sushi.com/pool/${pairAddress}`,
        "PancakeSwap": `https://pancakeswap.finance/info/v2/pairs/${pairAddress}`,
        "PancakeSwap V3": `https://pancakeswap.finance/info/v3/${chainKey === "bsc" ? "bnb" : chainKey}/pairs/${pairAddress}`,
    };
    return dexUrls[dexName] || `${getExplorerUrl(chainKey)}/address/${pairAddress}`;
}
export async function analyzeLiquidity(client, tokenAddress, chainKey) {
    const explorer = getExplorerUrl(chainKey);
    const result = {
        found: false,
        pools: [],
        primaryPool: null,
        totalPairsChecked: 0,
        isBurned: false,
        isLocked: false,
        burnPercent: 0,
        lockPercent: 0,
        totalDepthUsd: null,
        depthVerifiable: false,
        dexVersion: "unknown",
        facts: [],
        evidence: [],
        riskBreakdown: {
            controlRisk: "UNKNOWN",
            depthRisk: "UNKNOWN",
            verifiabilityRisk: "UNKNOWN"
        }
    };
    const chainConfig = CHAINS[chainKey];
    if (!chainConfig) {
        result.facts.push("Chain configuration not found");
        result.evidence.push("Evidence unavailable: Chain not supported");
        return result;
    }
    const quoteTokens = [chainConfig.wrappedNative, ...chainConfig.stablecoins];
    const factories = DEX_FACTORIES[chainKey] || {};
    for (const [dexKey, dexConfig] of Object.entries(factories)) {
        // V2 scanning
        if (dexConfig.v2) {
            for (const quoteToken of quoteTokens) {
                result.totalPairsChecked++;
                const pool = await checkV2Pair(client, dexConfig.v2, tokenAddress, quoteToken, dexConfig.name, chainKey);
                if (pool) {
                    result.pools.push(pool);
                    result.found = true;
                }
            }
        }
        // V3 scanning
        if (dexConfig.v3) {
            for (const quoteToken of quoteTokens) {
                for (const fee of V3_FEE_TIERS) {
                    result.totalPairsChecked++;
                    const pool = await checkV3Pool(client, dexConfig.v3, tokenAddress, quoteToken, fee, dexConfig.name, chainKey);
                    if (pool) {
                        result.pools.push(pool);
                        result.found = true;
                    }
                }
            }
        }
    }
    // V4 detection
    const v4Manager = UNISWAP_V4_POOL_MANAGER[chainKey];
    if (v4Manager && v4Manager !== "") {
        const v4Detected = await detectV4Interaction(client, tokenAddress, v4Manager);
        if (v4Detected) {
            result.pools.push({
                dex: "Uniswap V4",
                version: "v4",
                pairAddress: v4Manager,
                quoteToken: "unknown",
                quoteSymbol: "UNKNOWN",
                estimatedDepthUsd: null,
                depthVerifiable: false,
                evidence: [
                    `V4 PoolManager: ${explorer}/address/${v4Manager}`,
                    "WARNING: V4 liquidity amount is NOT VERIFIABLE on-chain"
                ]
            });
            result.found = true;
        }
    }
    if (result.pools.length > 0) {
        // Sort: V2 with verifiable depth first, then by estimated USD
        const sorted = [...result.pools].sort((a, b) => {
            if (a.depthVerifiable && !b.depthVerifiable)
                return -1;
            if (!a.depthVerifiable && b.depthVerifiable)
                return 1;
            const aDepth = a.estimatedDepthUsd ?? 0;
            const bDepth = b.estimatedDepthUsd ?? 0;
            return bDepth - aDepth;
        });
        result.primaryPool = sorted[0];
        result.dexVersion = result.primaryPool.version;
        // Calculate total verifiable depth
        let totalVerifiableDepth = 0;
        let hasVerifiablePool = false;
        for (const pool of result.pools) {
            if (pool.depthVerifiable && pool.estimatedDepthUsd !== null) {
                totalVerifiableDepth += pool.estimatedDepthUsd;
                hasVerifiablePool = true;
            }
        }
        if (hasVerifiablePool) {
            result.totalDepthUsd = totalVerifiableDepth;
            result.depthVerifiable = true;
        }
        const dexNames = [...new Set(result.pools.map(p => p.dex))];
        result.facts.push(`Liquidity found on ${result.pools.length} pool(s): ${dexNames.join(", ")}`);
        // Add evidence from pools
        for (const pool of result.pools) {
            result.evidence.push(...pool.evidence);
        }
    }
    if (result.primaryPool && result.primaryPool.version === "v2") {
        const protection = await checkLpProtection(client, result.primaryPool.pairAddress, chainKey);
        result.isBurned = protection.isBurned;
        result.isLocked = protection.isLocked;
        result.burnPercent = protection.burnPercent;
        result.lockPercent = protection.lockPercent;
        if (protection.isBurned && protection.burnPercent > 90) {
            result.facts.push(`LP tokens ${protection.burnPercent}% burned`);
            result.evidence.push(`LP burn check: ${explorer}/token/${result.primaryPool.pairAddress}?a=${BURN_ADDRESSES[0]}`);
        }
        else if (protection.isLocked && protection.lockPercent > 50) {
            result.facts.push(`LP tokens ${protection.lockPercent}% locked`);
            result.evidence.push(`LP lock: Check locker contract on ${explorer}`);
        }
        else {
            result.facts.push("LP tokens NOT burned/locked or protection <50%");
        }
    }
    else if (result.primaryPool && result.primaryPool.version === "v3") {
        result.facts.push("V3 liquidity: NFT position ownership NOT verifiable on-chain");
        result.evidence.push("V3 LP positions are NFTs - individual position ownership requires indexer");
    }
    else if (result.primaryPool && result.primaryPool.version === "v4") {
        result.facts.push("V4 liquidity: Amount is NOT VERIFIABLE");
        result.evidence.push("V4 uses singleton PoolManager - liquidity depth cannot be reliably determined");
    }
    if (result.depthVerifiable && result.totalDepthUsd !== null) {
        result.facts.push(`Estimated total liquidity depth: $${result.totalDepthUsd.toLocaleString()}`);
    }
    else if (result.found) {
        result.facts.push("Liquidity depth: UNVERIFIABLE (V3/V4 or no stablecoin pair)");
    }
    result.riskBreakdown = calculateLiquidityRisks(result);
    if (!result.found) {
        result.facts.push(`No liquidity detected (${result.totalPairsChecked} pairs checked)`);
        result.evidence.push("Evidence unavailable: No DEX pairs found");
    }
    return result;
}
function calculateLiquidityRisks(result) {
    let controlRisk;
    if (!result.found) {
        controlRisk = "HIGH";
    }
    else if (result.isBurned && result.burnPercent > 90) {
        controlRisk = "LOW";
    }
    else if (result.isLocked && result.lockPercent > 50) {
        controlRisk = "LOW";
    }
    else if (result.primaryPool?.version === "v3" || result.primaryPool?.version === "v4") {
        // V3/V4: Cannot verify LP ownership → UNVERIFIABLE
        controlRisk = "UNVERIFIABLE";
    }
    else {
        // V2 without burn/lock → HIGH (LP can be rugged)
        controlRisk = "HIGH";
    }
    let depthRisk;
    if (!result.found) {
        depthRisk = "HIGH";
    }
    else if (!result.depthVerifiable || result.totalDepthUsd === null) {
        // Cannot determine depth
        depthRisk = "UNVERIFIABLE";
    }
    else if (result.totalDepthUsd < 1000) {
        depthRisk = "HIGH";
    }
    else if (result.totalDepthUsd < 10000) {
        depthRisk = "MEDIUM";
    }
    else {
        depthRisk = "LOW";
    }
    let verifiabilityRisk;
    if (!result.found) {
        verifiabilityRisk = "HIGH";
    }
    else if (result.depthVerifiable) {
        verifiabilityRisk = "LOW";
    }
    else if (result.primaryPool?.version === "v3") {
        verifiabilityRisk = "UNVERIFIABLE";
    }
    else if (result.primaryPool?.version === "v4") {
        verifiabilityRisk = "UNVERIFIABLE";
    }
    else {
        verifiabilityRisk = "UNKNOWN";
    }
    return { controlRisk, depthRisk, verifiabilityRisk };
}
async function getTokenDecimals(client, tokenAddress) {
    try {
        const decimals = await client.readContract({
            address: tokenAddress,
            abi: ERC20_DECIMALS_ABI,
            functionName: "decimals"
        });
        return Number(decimals);
    }
    catch {
        return 18; // Default assumption
    }
}
async function checkV2Pair(client, factoryAddress, tokenAddress, quoteToken, dexName, chainKey) {
    const explorer = getExplorerUrl(chainKey);
    try {
        const pairAddress = await client.readContract({
            address: factoryAddress,
            abi: V2_FACTORY_ABI,
            functionName: "getPair",
            args: [tokenAddress, quoteToken]
        });
        if (!pairAddress || pairAddress === "0x0000000000000000000000000000000000000000") {
            return null;
        }
        // Get reserves and token order
        const [reserves, token0] = await Promise.all([
            client.readContract({
                address: pairAddress,
                abi: V2_PAIR_ABI,
                functionName: "getReserves"
            }),
            client.readContract({
                address: pairAddress,
                abi: V2_PAIR_ABI,
                functionName: "token0"
            })
        ]);
        const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
        const tokenReserve = isToken0 ? reserves[0] : reserves[1];
        const quoteReserve = isToken0 ? reserves[1] : reserves[0];
        if (tokenReserve === 0n && quoteReserve === 0n) {
            return null;
        }
        // Calculate USD value if quote is stablecoin
        let estimatedDepthUsd = null;
        let depthVerifiable = false;
        let quoteSymbol = "UNKNOWN";
        const stablecoinInfo = STABLECOIN_DECIMALS[quoteToken.toLowerCase()];
        if (stablecoinInfo) {
            quoteSymbol = stablecoinInfo.symbol;
            const quoteDecimals = stablecoinInfo.decimals;
            const quoteValue = Number(formatUnits(quoteReserve, quoteDecimals));
            // Total liquidity ≈ 2x quote reserve (assuming 50/50 pool)
            estimatedDepthUsd = Math.round(quoteValue * 2);
            depthVerifiable = true;
        }
        else {
            // Check if it's wrapped native (ETH/BNB) - cannot reliably price without oracle
            quoteSymbol = "NATIVE";
        }
        const evidence = [
            `Pair contract: ${explorer}/address/${pairAddress}`,
            `Factory getPair(): ${explorer}/address/${factoryAddress}#readContract`,
            `getReserves(): ${explorer}/address/${pairAddress}#readContract`
        ];
        if (depthVerifiable) {
            evidence.push(`Quote reserve: ${formatUnits(quoteReserve, stablecoinInfo.decimals)} ${quoteSymbol}`);
        }
        return {
            dex: dexName,
            version: "v2",
            pairAddress: getAddress(pairAddress),
            quoteToken,
            quoteSymbol,
            reserves: { token: tokenReserve, quote: quoteReserve },
            estimatedDepthUsd,
            depthVerifiable,
            evidence
        };
    }
    catch {
        return null;
    }
}
async function checkV3Pool(client, factoryAddress, tokenAddress, quoteToken, fee, dexName, chainKey) {
    const explorer = getExplorerUrl(chainKey);
    try {
        const poolAddress = await client.readContract({
            address: factoryAddress,
            abi: V3_FACTORY_ABI,
            functionName: "getPool",
            args: [tokenAddress, quoteToken, fee]
        });
        if (!poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") {
            return null;
        }
        const [liquidity, slot0] = await Promise.all([
            client.readContract({
                address: poolAddress,
                abi: V3_POOL_ABI,
                functionName: "liquidity"
            }),
            client.readContract({
                address: poolAddress,
                abi: V3_POOL_ABI,
                functionName: "slot0"
            })
        ]);
        if (liquidity === 0n || slot0[0] === 0n) {
            return null;
        }
        const stablecoinInfo = STABLECOIN_DECIMALS[quoteToken.toLowerCase()];
        const quoteSymbol = stablecoinInfo?.symbol || "NATIVE";
        // V3: We have liquidity value but cannot reliably convert to USD
        // sqrtPriceX96 gives price, but TVL calculation requires tick range analysis
        const evidence = [
            `Pool contract: ${explorer}/address/${poolAddress}`,
            `Factory getPool(): ${explorer}/address/${factoryAddress}#readContract`,
            `slot0(): ${explorer}/address/${poolAddress}#readContract`,
            `liquidity(): ${liquidity.toString()}`,
            "WARNING: V3 USD depth estimation is NOT RELIABLE without tick range analysis"
        ];
        return {
            dex: `${dexName} V3`,
            version: "v3",
            pairAddress: getAddress(poolAddress),
            quoteToken,
            quoteSymbol,
            liquidity,
            sqrtPriceX96: slot0[0],
            tick: slot0[1],
            estimatedDepthUsd: null, // Explicitly not claiming USD value
            depthVerifiable: false,
            evidence
        };
    }
    catch {
        return null;
    }
}
async function detectV4Interaction(client, tokenAddress, poolManagerAddress) {
    // V4 detection is limited - we check if PoolManager has any state for this token
    // This is a heuristic and may not be fully accurate
    try {
        const code = await client.getCode({ address: poolManagerAddress });
        return code !== undefined && code !== "0x" && code.length > 2;
    }
    catch {
        return false;
    }
}
async function checkLpProtection(client, pairAddress, chainKey) {
    const protection = { isBurned: false, isLocked: false, burnPercent: 0, lockPercent: 0 };
    try {
        const totalSupply = await client.readContract({
            address: pairAddress,
            abi: V2_PAIR_ABI,
            functionName: "totalSupply"
        });
        if (totalSupply === 0n)
            return protection;
        // Check burn addresses
        let burnedAmount = 0n;
        for (const burnAddr of BURN_ADDRESSES) {
            try {
                const balance = await client.readContract({
                    address: pairAddress,
                    abi: V2_PAIR_ABI,
                    functionName: "balanceOf",
                    args: [burnAddr]
                });
                burnedAmount += balance;
            }
            catch { }
        }
        protection.burnPercent = Number((burnedAmount * 100n) / totalSupply);
        protection.isBurned = protection.burnPercent > 50;
        // Check lockers
        const lockers = KNOWN_LOCKERS[chainKey] || [];
        let lockedAmount = 0n;
        for (const locker of lockers) {
            try {
                const balance = await client.readContract({
                    address: pairAddress,
                    abi: V2_PAIR_ABI,
                    functionName: "balanceOf",
                    args: [locker]
                });
                lockedAmount += balance;
            }
            catch { }
        }
        protection.lockPercent = Number((lockedAmount * 100n) / totalSupply);
        protection.isLocked = protection.lockPercent > 50;
    }
    catch { }
    return protection;
}
//# sourceMappingURL=liquidity.js.map