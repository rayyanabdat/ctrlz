# Ctrl+Z — EVM On-Chain Risk Scanner

[![npm](https://img.shields.io/npm/v/ctrlz-cli)](https://www.npmjs.com/package/ctrlz-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

> **Production-grade smart contract risk assessment tool for EVM-compatible blockchains**

Instantly analyze smart contract risk across multiple chains with comprehensive on-chain data verification, liquidity analysis, and evidence-backed scoring.

---

## 🚀 Quick Start

Execute risk analysis with zero setup:

```bash
npx ctrlz-cli <contract-address>
```

**Real-world examples:**
```bash
npx ctrlz-cli 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
npx ctrlz-cli 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --chain base
```

### ✅ Zero Configuration Required
- **No installation** — Runs directly via npx
- **Universal compatibility** — Works anywhere with Node.js 18+
- **Portable output** — Plain text reports safe to share

---

## 📋 Usage

```bash
ctrlz-cli <contract-address> [--chain <chainKey>]
```

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `<contract-address>` | `string` | EVM contract address (0x...) | **Required** |
| `--chain <chainKey>` | `string` | Target blockchain network | `ethereum` |

### Supported Networks

| Network | Chain Key | Status |
|---------|-----------|--------|
| Ethereum | `ethereum` | ✅ Available |
| Base | `base` | ✅ Available |
| BSC | `bsc` | ✅ Available |
| Polygon | `polygon` | 🔄 Coming Soon |
| Arbitrum | `arbitrum` | 🔄 Coming Soon |
| Optimism | `optimism` | 🔄 Coming Soon |
| Avalanche | `avalanche` | 🔄 Coming Soon |
| Fantom | `fantom` | 🔄 Coming Soon |
| Blast | `blast` | 🔄 Coming Soon |

---

## 💡 Examples

**Basic analysis:**
```bash
npx ctrlz-cli 0xabc123...
```

**Multi-chain analysis:**
```bash
npx ctrlz-cli 0xabc123... --chain arbitrum
npx ctrlz-cli 0xabc123... base
npx ctrlz-cli 0xdef456... --chain polygon
```

---

## 🔍 Analysis Coverage

### Core Risk Vectors

| **Category** | **Analysis Depth** |
|--------------|-------------------|
| **Access Control** | Owner privileges, role-based permissions, centralization risks |
| **Upgradeability** | Proxy patterns, admin controls, implementation risks |
| **Supply Controls** | Mint functions, pause mechanisms, blacklist capabilities |
| **Liquidity Infrastructure** | DEX integration, pool depth, LP token analysis |
| **Token Distribution** | Holder concentration, whale analysis, distribution patterns |
| **Code Verification** | Bytecode validation, source code availability, deployment context |

### Technical Standards

- **DEX Protocol Support:** Uniswap V2/V3/V4, SushiSwap, PancakeSwap, Curve
- **Proxy Pattern Detection:** Transparent, UUPS, Beacon, Diamond proxies
- **Token Standard Compliance:** ERC-20, ERC-721, ERC-1155 variants

---

## 📊 Risk Assessment Framework

### Scoring Methodology

- **Risk Tiers:** `LOW` → `MEDIUM` → `HIGH` → `CRITICAL`
- **Evidence-Based:** All findings linked to verifiable on-chain data
- **Conservative Approach:** Unknown data treated as potential risk
- **Guardrail System:** Hard limits prevent overconfidence in incomplete data

### Output Standards

✅ **Structured Reports** with clear risk categorization  
✅ **Evidence Links** to blockchain explorers and contract interactions  
✅ **Confidence Metrics** indicating data completeness and reliability  
✅ **Actionable Insights** for risk mitigation and due diligence  

---

## ⚙️ Development

> **Note:** This section is for contributors and maintainers. End users should use `npx ctrlz-cli` directly.

### Local Development Setup

```bash
git clone https://github.com/rayyanabdat/ctrlz
cd ctrlz
npm install
npm run build
```

### Project Structure
```
src/
├── cli.ts              # Command-line interface
├── engine/             # Core analysis engines
│   ├── evm.ts         # EVM contract scanner
│   ├── liquidity.ts   # DEX liquidity analysis
│   └── scoring.ts     # Risk scoring algorithms
└── config/            # Chain configurations
```

---

## ⚠️ Disclaimer

This tool provides **structural risk assessment** based on observable on-chain data and contract patterns. It does not constitute financial advice, investment recommendations, or security guarantees.

**Risk assessment scope:** Technical contract structure, not project legitimacy or market dynamics.

---

## 📄 License

**MIT License** — See [LICENSE](LICENSE) for full terms.

---

<div align="center">

**Built with precision for the DeFi ecosystem**

Made by [gogetrekt](https://github.com/rayyanabdat) | [Report Issues](https://github.com/rayyanabdat/ctrlz/issues)

</div>

