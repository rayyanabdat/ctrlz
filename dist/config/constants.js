// Uniswap V2 Factory addresses by chain
export const UNISWAP_V2_FACTORY = {
    ethereum: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    base: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    bsc: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" // PancakeSwap V2
};
// Uniswap V3 Factory addresses by chain
export const UNISWAP_V3_FACTORY = {
    ethereum: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    base: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
    bsc: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7" // PancakeSwap V3
};
// Uniswap V3 NonfungiblePositionManager addresses
export const UNISWAP_V3_NFT_MANAGER = {
    ethereum: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    base: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
    bsc: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"
};
// Common quote tokens by chain
export const QUOTE_TOKENS = {
    ethereum: [
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        "0xdAC17F958D2ee523a2206206994597C13D831ec7" // USDT
    ],
    base: [
        "0x4200000000000000000000000000000000000006", // WETH
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC
    ],
    bsc: [
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
        "0x55d398326f99059fF775485246999027B3197955", // USDT
        "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" // USDC
    ]
};
// Uniswap V4 PoolManager addresses by chain
export const UNISWAP_V4_POOL_MANAGER = {
    ethereum: "0x000000000004444c5dc75cB358380D2e3dE08A90",
    base: "0x000000000004444c5dc75cB358380D2e3dE08A90",
    bsc: "" // V4 not deployed on BSC yet
};
// ============ DEX FACTORY ADDRESSES ============
export const DEX_FACTORIES = {
    ethereum: {
        uniswap: {
            v2: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
            v3: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
            name: "Uniswap"
        },
        sushiswap: {
            v2: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
            name: "SushiSwap"
        },
        shibaswap: {
            v2: "0x115934131916C8b277DD010Ee02de363c09d037c",
            name: "ShibaSwap"
        }
    },
    base: {
        uniswap: {
            v2: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
            v3: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
            name: "Uniswap"
        },
        pancakeswap: {
            v2: "0x02a84c1b3BBD7401a5f7fa98a384EBC70bB5749E",
            v3: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
            name: "PancakeSwap"
        },
        baseswap: {
            v2: "0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB",
            name: "BaseSwap"
        },
        rocketswap: {
            v2: "0x1b8128c3A1B7D20053D10763ff02466ca7FF99FC",
            name: "RocketSwap"
        }
    },
    bsc: {
        pancakeswap: {
            v2: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
            v3: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
            name: "PancakeSwap"
        },
        uniswap: {
            v3: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
            name: "Uniswap"
        },
        apeswap: {
            v2: "0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6",
            name: "ApeSwap"
        }
    },
    polygon: {
        uniswap: {
            v3: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
            name: "Uniswap"
        },
        quickswap: {
            v2: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32",
            name: "QuickSwap"
        },
        sushiswap: {
            v2: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
            name: "SushiSwap"
        }
    },
    arbitrum: {
        uniswap: {
            v3: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
            name: "Uniswap"
        },
        sushiswap: {
            v2: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
            name: "SushiSwap"
        },
        camelot: {
            v2: "0x6EcCab422D763aC031210895C81787E87B43A652",
            name: "Camelot"
        }
    },
    optimism: {
        uniswap: {
            v3: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
            name: "Uniswap"
        },
        velodrome: {
            v2: "0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746",
            name: "Velodrome"
        }
    },
    avalanche: {
        uniswap: {
            v3: "0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD",
            name: "Uniswap"
        },
        traderjoe: {
            v2: "0x9Ad6C38BE94206cA50bb0d90783181c0dCA0B3B6",
            name: "TraderJoe"
        },
        pangolin: {
            v2: "0xefa94DE7a4656D787667C749f7E1223D71E9FD88",
            name: "Pangolin"
        }
    },
    fantom: {
        spookyswap: {
            v2: "0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3",
            name: "SpookySwap"
        },
        spiritswap: {
            v2: "0xEF45d134b73241eDa7703fa787148D9C9F4950b0",
            name: "SpiritSwap"
        }
    },
    blast: {
        thruster: {
            v2: "0xb4A7D971D0ADea1c73198C97d7ab3f9CE4aaFA13",
            name: "Thruster"
        }
    }
};
// V3 Fee Tiers
export const V3_FEE_TIERS = [100, 500, 3000, 10000];
// Burn addresses
export const BURN_ADDRESSES = [
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dEaD",
    "0xdead000000000000000000000000000000000000"
];
// Known LP locker contracts
export const KNOWN_LOCKERS = {
    ethereum: [
        "0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214",
        "0xDba68f07d1b7Ca219f78ae8582C213d975c25cAf",
        "0x71B5759d73262FBb223956913ecF4ecC51057641",
        "0xE2fE530C047f2d85298b07D9333C05737f1435fB"
    ],
    base: ["0x71B5759d73262FBb223956913ecF4ecC51057641"],
    bsc: [
        "0xc765bddB93b0D1c1A88282BA0fa6B2d00E3e0c83",
        "0x407993575c91ce7643a4d4cCACc9A98c36eE1BBE"
    ],
    polygon: [],
    arbitrum: [],
    optimism: [],
    avalanche: [],
    fantom: [],
    blast: []
};
// Chain identifiers for display
export const CHAIN_IDENTIFIERS = {
    ethereum: ["eth", "ethereum", "1"],
    base: ["base", "8453"],
    bsc: ["bsc", "bnb", "56"],
    polygon: ["polygon", "matic", "137"],
    arbitrum: ["arb", "arbitrum", "42161"],
    optimism: ["op", "optimism", "10"],
    avalanche: ["avax", "avalanche", "43114"],
    fantom: ["ftm", "fantom", "250"],
    blast: ["blast", "81457"]
};
// DEX coverage display
export const DEX_COVERAGE = {
    ethereum: ["Uniswap V2", "Uniswap V3", "SushiSwap", "ShibaSwap"],
    base: ["Uniswap V2", "Uniswap V3", "PancakeSwap V2/V3", "BaseSwap", "RocketSwap"],
    bsc: ["PancakeSwap V2", "PancakeSwap V3", "Uniswap V3", "ApeSwap"],
    polygon: ["Uniswap V3", "QuickSwap", "SushiSwap"],
    arbitrum: ["Uniswap V3", "SushiSwap", "Camelot"],
    optimism: ["Uniswap V3", "Velodrome"],
    avalanche: ["Uniswap V3", "TraderJoe", "Pangolin"],
    fantom: ["SpookySwap", "SpiritSwap"],
    blast: ["Thruster V2"]
};
//# sourceMappingURL=constants.js.map