export function createAbortedResult(reason, stage, message, partialResults) {
    const baseResult = {
        contractAddress: partialResults?.contractAddress || "",
        chainId: partialResults?.chainId || 0,
        chainName: partialResults?.chainName || "",
        scanId: `scan-${Date.now()}`,
        timestamp: Date.now(),
        aborted: { reason, stage, message },
        token: {
            name: null,
            symbol: null,
            decimals: null,
            totalSupply: null,
            isStandard: false,
            findings: [],
            evidence: [],
            confidence: "UNVERIFIABLE",
            risk: "HIGH",
            timings: { startTime: Date.now() }
        },
        ownership: {
            ownerAddress: null,
            ownerType: null,
            isProxy: false,
            implementationAddress: null,
            upgradeability: "UNKNOWN",
            findings: [],
            evidence: [],
            confidence: "UNVERIFIABLE",
            risk: "HIGH",
            timings: { startTime: Date.now() }
        },
        liquidity: {
            pools: [],
            liquidityLocked: null,
            findings: [],
            evidence: [],
            confidence: "UNVERIFIABLE",
            risk: "HIGH",
            timings: { startTime: Date.now() }
        },
        holders: {
            topHolders: [],
            distribution: {
                top10Percent: null,
                top100Percent: null,
                confidence: "UNVERIFIABLE"
            },
            enumerationMethod: "FAILED",
            findings: [],
            evidence: [],
            confidence: "UNVERIFIABLE",
            risk: "HIGH",
            timings: { startTime: Date.now() }
        },
        security: {
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
            confidence: "UNVERIFIABLE",
            risk: "HIGH",
            timings: { startTime: Date.now() }
        },
        finalRisk: reason === "CRITICAL_RISK" ? "CRITICAL" : "HIGH",
        finalConfidence: "UNVERIFIABLE",
        totalScanTime: 0,
        rpcStats: {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0
        }
    };
    // Merge any partial results
    if (partialResults) {
        return { ...baseResult, ...partialResults };
    }
    return baseResult;
}
export function shouldAbortScan(result) {
    return result.risk === "CRITICAL" || (result.risk === "HIGH" && result.confidence === "VERIFIED");
}
//# sourceMappingURL=analysis-types.js.map