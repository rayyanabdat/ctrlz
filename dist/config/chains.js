function resolveRpc(envKey, primaryFallback, secondaryFallback) {
    const envRpc = process.env[envKey];
    if (envRpc && envRpc.trim() !== "")
        return envRpc;
    if (primaryFallback && primaryFallback.trim() !== "")
        return primaryFallback;
    return secondaryFallback;
}
export const CHAINS = {
    ethereum: {
        key: "ethereum",
        name: "Ethereum",
        chainId: 1,
        rpcUrl: resolveRpc("ETH_RPC", "https://mainnet.infura.io/v3/3c7ff243cb5d4c7c998042a9d7bda05f", "https://eth.llamarpc.com"),
        rpcUrls: [
            "https://eth.llamarpc.com",
            "https://eth.public.nanopool.org",
            "https://eth.drpc.org"
        ],
        rpcPool: [
            { url: "https://mainnet.infura.io/v3/3c7ff243cb5d4c7c998042a9d7bda05f", tier: "tier1", timeout: 3000, label: "Infura" },
            { url: "https://eth.llamarpc.com", tier: "tier2", timeout: 4000, label: "LlamaRPC" },
            { url: "https://eth.public.nanopool.org", tier: "tier2", timeout: 5000, label: "Nanopool" },
            { url: "https://eth.drpc.org", tier: "tier3", timeout: 8000, label: "dRPC Archive" }
        ],
        wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        stablecoins: [
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
            "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
            "0x6B175474E89094C44Da98b954EescdeCB5e0Cf", // DAI
        ]
    },
    base: {
        key: "base",
        name: "Base",
        chainId: 8453,
        rpcUrl: resolveRpc("BASE_RPC", "https://base-mainnet.infura.io/v3/3c7ff243cb5d4c7c998042a9d7bda05f", "https://base.llamarpc.com"),
        rpcUrls: [
            "https://base.llamarpc.com",
            "https://mainnet.base.org",
            "https://base.drpc.org"
        ],
        rpcPool: [
            { url: "https://base-mainnet.infura.io/v3/3c7ff243cb5d4c7c998042a9d7bda05f", tier: "tier1", timeout: 3000, label: "Infura" },
            { url: "https://base.llamarpc.com", tier: "tier2", timeout: 4000, label: "LlamaRPC" },
            { url: "https://mainnet.base.org", tier: "tier2", timeout: 5000, label: "Base Official" },
            { url: "https://base.drpc.org", tier: "tier3", timeout: 8000, label: "dRPC" }
        ],
        wrappedNative: "0x4200000000000000000000000000000000000006",
        stablecoins: [
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
            "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
        ]
    },
    bsc: {
        key: "bsc",
        name: "BSC",
        chainId: 56,
        rpcUrl: resolveRpc("BSC_RPC", "https://bsc-mainnet.infura.io/v3/3c7ff243cb5d4c7c998042a9d7bda05f", "https://bsc.llamarpc.com"),
        rpcUrls: [
            "https://bsc.llamarpc.com",
            "https://bsc-dataseed1.binance.org",
            "https://bsc.drpc.org"
        ],
        rpcPool: [
            { url: "https://bsc-mainnet.infura.io/v3/3c7ff243cb5d4c7c998042a9d7bda05f", tier: "tier1", timeout: 3000, label: "Infura" },
            { url: "https://bsc.llamarpc.com", tier: "tier2", timeout: 4000, label: "LlamaRPC" },
            { url: "https://bsc-dataseed1.binance.org", tier: "tier2", timeout: 5000, label: "Binance" },
            { url: "https://bsc.drpc.org", tier: "tier3", timeout: 8000, label: "dRPC" }
        ],
        wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        stablecoins: [
            "0x55d398326f99059fF775485246999027B3197955", // USDT
            "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
            "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", // BUSD
        ]
    },
    polygon: {
        key: "polygon",
        name: "Polygon",
        chainId: 137,
        rpcUrl: resolveRpc("POLYGON_RPC", "https://polygon.llamarpc.com", "https://polygon-rpc.com"),
        wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        stablecoins: [
            "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC
            "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
        ],
        rpcPool: [
            { url: "https://polygon-mainnet.infura.io/v3", timeout: 3000, tier: "tier1" },
            { url: "https://polygon.llamarpc.com", timeout: 5000, tier: "tier2" },
            { url: "https://polygon-rpc.com", timeout: 5000, tier: "tier3" }
        ]
    },
    arbitrum: {
        key: "arbitrum",
        name: "Arbitrum",
        chainId: 42161,
        rpcUrl: resolveRpc("ARBITRUM_RPC", "https://arbitrum.llamarpc.com", "https://arb1.arbitrum.io/rpc"),
        wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        stablecoins: [
            "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
            "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT
        ],
        rpcPool: [
            { url: "https://arbitrum-mainnet.infura.io/v3", timeout: 3000, tier: "tier1" },
            { url: "https://arbitrum.llamarpc.com", timeout: 5000, tier: "tier2" },
            { url: "https://arb1.arbitrum.io/rpc", timeout: 5000, tier: "tier3" }
        ]
    },
    optimism: {
        key: "optimism",
        name: "Optimism",
        chainId: 10,
        rpcUrl: resolveRpc("OPTIMISM_RPC", "https://optimism.llamarpc.com", "https://mainnet.optimism.io"),
        wrappedNative: "0x4200000000000000000000000000000000000006",
        stablecoins: [
            "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC
            "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // USDT
        ],
        rpcPool: [
            { url: "https://optimism-mainnet.infura.io/v3", timeout: 3000, tier: "tier1" },
            { url: "https://optimism.llamarpc.com", timeout: 5000, tier: "tier2" },
            { url: "https://mainnet.optimism.io", timeout: 5000, tier: "tier3" }
        ]
    },
    avalanche: {
        key: "avalanche",
        name: "Avalanche",
        chainId: 43114,
        rpcUrl: resolveRpc("AVALANCHE_RPC", "https://avalanche.llamarpc.com", "https://api.avax.network/ext/bc/C/rpc"),
        wrappedNative: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
        stablecoins: [
            "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC
            "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", // USDT
        ],
        rpcPool: [
            { url: "https://avalanche.llamarpc.com", timeout: 5000, tier: "tier2" },
            { url: "https://api.avax.network/ext/bc/C/rpc", timeout: 5000, tier: "tier3" }
        ]
    },
    fantom: {
        key: "fantom",
        name: "Fantom",
        chainId: 250,
        rpcUrl: resolveRpc("FANTOM_RPC", "https://rpc.ftm.tools", "https://fantom-rpc.publicnode.com"),
        wrappedNative: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83",
        stablecoins: [
            "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75", // USDC
            "0x049d68029688eAbF473097a2fC38ef61633A3C7A", // fUSDT
        ],
        rpcPool: [
            { url: "https://rpc.ftm.tools", timeout: 5000, tier: "tier2" },
            { url: "https://fantom-rpc.publicnode.com", timeout: 5000, tier: "tier3" }
        ]
    },
    blast: {
        key: "blast",
        name: "Blast",
        chainId: 81457,
        rpcUrl: resolveRpc("BLAST_RPC", "https://rpc.blast.io", "https://blast.blockpi.network/v1/rpc/public"),
        wrappedNative: "0x4300000000000000000000000000000000000004",
        stablecoins: [
            "0x4300000000000000000000000000000000000003", // USDB
        ],
        rpcPool: [
            { url: "https://rpc.blast.io", timeout: 5000, tier: "tier2" },
            { url: "https://blast.blockpi.network/v1/rpc/public", timeout: 8000, tier: "tier3" }
        ]
    }
};
// Chain aliases for user convenience
export const CHAIN_ALIASES = {
    eth: "ethereum",
    "1": "ethereum",
    base: "base",
    "8453": "base",
    bsc: "bsc",
    bnb: "bsc",
    "56": "bsc",
    polygon: "polygon",
    matic: "polygon",
    "137": "polygon",
    arbitrum: "arbitrum",
    arb: "arbitrum",
    "42161": "arbitrum",
    optimism: "optimism",
    op: "optimism",
    "10": "optimism",
    avalanche: "avalanche",
    avax: "avalanche",
    "43114": "avalanche",
    fantom: "fantom",
    ftm: "fantom",
    "250": "fantom",
    blast: "blast",
    "81457": "blast"
};
export function getChain(chainKey) {
    const input = String(chainKey ?? "ethereum").toLowerCase();
    const resolved = CHAIN_ALIASES[input] || input;
    const chain = CHAINS[resolved];
    if (!chain) {
        throw new Error(`Chain '${input}' not supported. Available: ${Object.keys(CHAINS).join(", ")}`);
    }
    if (!chain.rpcUrl || chain.rpcUrl.trim() === "") {
        throw new Error(`RPC not configured for ${chain.name}`);
    }
    return chain;
}
export function getSupportedChains() {
    return Object.keys(CHAINS);
}
//# sourceMappingURL=chains.js.map