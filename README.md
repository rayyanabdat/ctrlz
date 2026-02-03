# Ctrl+Z

**Production-Grade EVM Risk Scanner**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A hardened CLI tool for analyzing smart contract risk on EVM-compatible blockchains. Built for traders, researchers, and security professionals who need accurate, evidence-backed risk assessments.

---

## Features

- **Multi-Chain Support** — Ethereum, Base, BSC, Polygon, Arbitrum, Optimism, Avalanche, Fantom, Blast
- **Quantified Liquidity Analysis** — Measures actual USD depth, not just presence
- **Evidence-Based Reports** — Every claim includes verifiable on-chain links
- **Strict Scoring Guardrails** — No false confidence from incomplete data
- **DEX Coverage** — Uniswap V2/V3/V4, SushiSwap, PancakeSwap, and more

---

## Quick Start

```bash
# Install dependencies
npm install

# Run scanner
npm run dev 0x<contract_address> --chain ethereum
```

---

## Scoring System

| Risk Level | Score Impact |
|------------|--------------|
| LOW | No effect |
| MEDIUM | -5 points |
| HIGH | -15 points |
| UNKNOWN | -3 points |

**Base Score:** 70

**Positive Signals (max +15):**
- Ownership renounced → +5
- No proxy/mint/pause → +5
- Liquidity > $50k → +5

**Hard Caps:**
- Any HIGH risk → max 65
- 2+ MEDIUM risks → max 75
- V3/V4 unverifiable → max 90
- 80%+ holder concentration → max 70

**Score Bands:**
| Range | Rating |
|-------|--------|
| 90-100 | Strong Confidence |
| 75-89 | Low Risk |
| 55-74 | Caution |
| < 55 | High/Critical Risk |

---

## Liquidity Analysis

### V2 Pools
- Reads `getReserves()` directly
- Calculates USD value from stablecoin reserves
- Verifies LP burn/lock status

### V3 Pools  
- Reads `slot0` and `liquidity`
- Marks depth as **UNVERIFIABLE** (no reliable USD conversion)
- Applies uncertainty penalty

### V4 Pools
- Detects PoolManager interaction
- Marks liquidity as **NOT VERIFIABLE**
- Applies uncertainty penalty

### Depth Risk Thresholds
| Liquidity | Risk |
|-----------|------|
| < $1,000 | HIGH |
| < $10,000 | MEDIUM |
| > $10,000 | LOW |

---

## Holder Analysis

Analyzes token distribution for concentration risk:

- Deployer holdings
- Owner holdings
- Contract self-holdings
- LP pool allocations

**Critical Rule:** Single holder ≥80% → HIGH risk, score capped at 70

---

## Usage

### Quick Start (Interactive)

```bash
npm install
npm run dev
# Enter contract address when prompted
# Select chain from menu (Ethereum/Base/BSC)
```

### Command Line Usage
```bash
npm run dev 0x1234...abcd --chain ethereum
npm run dev 0x1234...abcd --chain base
npm run dev 0x1234...abcd --chain bsc
```

### Build & Run
```bash
npm run build
npm start 0x1234...abcd --chain ethereum
```

---

## Supported Chains

| Chain | Key | Chain ID | Status |
|-------|-----|----------|---------|
| Ethereum | `ethereum` | 1 | ✅ Available |
| Base | `base` | 8453 | ✅ Available |
| BSC | `bsc` | 56 | ✅ Available |
| Polygon | `polygon` | 137 | 🔄 Coming Soon |
| Arbitrum | `arbitrum` | 42161 | 🔄 Coming Soon |
| Optimism | `optimism` | 10 | 🔄 Coming Soon |
| Avalanche | `avalanche` | 43114 | 🔄 Coming Soon |
| Fantom | `fantom` | 250 | 🔄 Coming Soon |
| Blast | `blast` | 81457 | 🔄 Coming Soon |

---

## Configuration

Set custom RPC endpoints via environment variables:

```bash
export ETH_RPC=https://your-eth-rpc.com
export BASE_RPC=https://your-base-rpc.com
export BSC_RPC=https://your-bsc-rpc.com
# Additional chains coming soon...
```

---

## Output Example

```
━━━ TOKEN ━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ExampleToken
Symbol: EXT
Decimals: 18
Contract: https://etherscan.io/address/0x...

━━━ LIQUIDITY ━━━━━━━━━━━━━━━━━━━━━━━
• Liquidity found on 2 pool(s): Uniswap, SushiSwap
• Estimated total liquidity depth: $125,000
• LP tokens 98% burned
Liquidity Risk Breakdown:
  LP Control:       LOW
  LP Depth:         LOW
  LP Verifiability: LOW
Evidence:
  Pair contract: https://etherscan.io/address/0x...
  getReserves(): https://etherscan.io/address/0x...#readContract

━━━ FINAL SCORE ━━━━━━━━━━━━━━━━━━━━━
Score: 78/100
Risk Tier: LOW RISK
Confidence: HIGH
Coverage: 100%

Score Breakdown:
  Base: 70
  Ownership renounced (zero/dead): +5
  No proxy, mint, or pause functions: +5
```

---

## Design Principles

1. **Evidence Required** — No claim without proof
2. **Uncertainty Penalized** — UNKNOWN ≠ LOW
3. **No False Confidence** — Scores reflect actual verification
4. **Risk Dominance** — HIGH/MEDIUM risks override positives
5. **Transparency** — Full breakdown of every adjustment

---

## Disclaimer

This tool evaluates on-chain contract structure and observable data. It does not guarantee safety and is not financial advice. Risk scores reflect structural exposure, not project legitimacy.

---

## License

MIT

---

**Made with precision by gogetrekt**

