// ============================================================
// SCORING SYSTEM - LOCKED IMPLEMENTATION
// ============================================================
// Base score = 70
// LOW risk → no effect
// MEDIUM risk → -5 each
// HIGH risk → -15 each
// UNKNOWN / UNVERIFIABLE → -3 each
// Positive evidence (max +15 total):
//   Owner is zero/dead → +5
//   No proxy + no mint + no pause → +5
//   Sufficient liquidity depth (> $50k) → +5
// GUARDRAILS:
//   If any HIGH risk exists → final score ≤65
//   If ≥2 MEDIUM risks exist → final score ≤75
//   V3/V4 unverifiable LP → final score ≤90
//   Score must NEVER increase due to LOW risk
// ============================================================
const BASE_SCORE = 70;
function countRiskPenalty(risk) {
    switch (risk) {
        case "LOW": return 0;
        case "MEDIUM": return -5;
        case "HIGH": return -15;
        case "CRITICAL": return -20;
        case "UNKNOWN": return -3;
        case "UNVERIFIABLE": return -3;
        default: return 0;
    }
}
function isHighRisk(risk) {
    return risk === "HIGH" || risk === "CRITICAL";
}
function isMediumRisk(risk) {
    return risk === "MEDIUM";
}
function isUnknown(risk) {
    return risk === "UNKNOWN" || risk === "UNVERIFIABLE";
}
function getBand(score) {
    if (score >= 90)
        return "STRONG CONFIDENCE";
    if (score >= 75)
        return "LOW RISK";
    if (score >= 55)
        return "CAUTION";
    return "HIGH / CRITICAL RISK";
}
export function calculateFinalScore(input) {
    const adjustments = [];
    const guardrailsApplied = [];
    const riskFactors = [];
    const positiveSignals = [];
    let score = BASE_SCORE;
    adjustments.push({ reason: "Base score", delta: BASE_SCORE });
    // ============================================================
    // RISK PENALTIES
    // ============================================================
    // Logic risk
    const logicPenalty = countRiskPenalty(input.logicRisk);
    if (logicPenalty !== 0) {
        score += logicPenalty;
        adjustments.push({ reason: `Logic risk (${input.logicRisk})`, delta: logicPenalty });
        if (isHighRisk(input.logicRisk))
            riskFactors.push("Critical/High logic risk detected");
        if (isMediumRisk(input.logicRisk))
            riskFactors.push("Moderate logic risk detected");
        if (isUnknown(input.logicRisk))
            riskFactors.push("Logic risk could not be fully verified");
    }
    // Liquidity risk breakdown
    const lpControlPenalty = countRiskPenalty(input.liquidityRisk.controlRisk);
    if (lpControlPenalty !== 0) {
        score += lpControlPenalty;
        adjustments.push({ reason: `LP control risk (${input.liquidityRisk.controlRisk})`, delta: lpControlPenalty });
        if (isHighRisk(input.liquidityRisk.controlRisk))
            riskFactors.push("LP tokens not protected (burned/locked)");
    }
    const lpDepthPenalty = countRiskPenalty(input.liquidityRisk.depthRisk);
    if (lpDepthPenalty !== 0) {
        score += lpDepthPenalty;
        adjustments.push({ reason: `LP depth risk (${input.liquidityRisk.depthRisk})`, delta: lpDepthPenalty });
        if (isHighRisk(input.liquidityRisk.depthRisk))
            riskFactors.push("Insufficient liquidity depth (<$1,000)");
        if (isMediumRisk(input.liquidityRisk.depthRisk))
            riskFactors.push("Low liquidity depth (<$10,000)");
    }
    const lpVerifiabilityPenalty = countRiskPenalty(input.liquidityRisk.verifiabilityRisk);
    if (lpVerifiabilityPenalty !== 0) {
        score += lpVerifiabilityPenalty;
        adjustments.push({ reason: `LP verifiability (${input.liquidityRisk.verifiabilityRisk})`, delta: lpVerifiabilityPenalty });
        if (isUnknown(input.liquidityRisk.verifiabilityRisk))
            riskFactors.push("Liquidity depth could not be verified");
    }
    // Constraint risk
    const constraintPenalty = countRiskPenalty(input.constraintRisk);
    if (constraintPenalty !== 0) {
        score += constraintPenalty;
        adjustments.push({ reason: `Constraint risk (${input.constraintRisk})`, delta: constraintPenalty });
        if (isHighRisk(input.constraintRisk))
            riskFactors.push("Restrictive trading controls detected");
        if (isMediumRisk(input.constraintRisk))
            riskFactors.push("Trading constraints detected");
    }
    // Holder risk
    const holderPenalty = countRiskPenalty(input.holderRisk);
    if (holderPenalty !== 0) {
        score += holderPenalty;
        adjustments.push({ reason: `Holder risk (${input.holderRisk})`, delta: holderPenalty });
        if (isHighRisk(input.holderRisk))
            riskFactors.push("High holder concentration risk");
        if (isMediumRisk(input.holderRisk))
            riskFactors.push("Moderate holder concentration");
        if (isUnknown(input.holderRisk))
            riskFactors.push("Holder distribution could not be fully verified");
    }
    // ============================================================
    // POSITIVE EVIDENCE BONUSES (max +15 total)
    // ============================================================
    let positiveBonus = 0;
    // +5: Owner is zero/dead
    if (input.contextFlags.ownershipRenounced) {
        const bonus = Math.min(5, 15 - positiveBonus);
        if (bonus > 0) {
            positiveBonus += bonus;
            score += bonus;
            adjustments.push({ reason: "Ownership renounced (zero/dead)", delta: bonus });
            positiveSignals.push("Ownership renounced to zero/dead address");
        }
    }
    // +5: No proxy + no mint + no pause
    if (!input.contextFlags.isProxy && !input.contextFlags.hasMint && !input.contextFlags.hasPause) {
        const bonus = Math.min(5, 15 - positiveBonus);
        if (bonus > 0) {
            positiveBonus += bonus;
            score += bonus;
            adjustments.push({ reason: "No proxy, mint, or pause functions", delta: bonus });
            positiveSignals.push("No proxy/mint/pause capabilities detected");
        }
    }
    // +5: Sufficient liquidity depth (> $50k)
    if (input.contextFlags.liquidityDepthUsd !== null && input.contextFlags.liquidityDepthUsd > 50000) {
        const bonus = Math.min(5, 15 - positiveBonus);
        if (bonus > 0) {
            positiveBonus += bonus;
            score += bonus;
            adjustments.push({ reason: "Sufficient liquidity depth (>$50k)", delta: bonus });
            positiveSignals.push(`Liquidity depth: $${input.contextFlags.liquidityDepthUsd.toLocaleString()}`);
        }
    }
    // ============================================================
    // GUARDRAILS (HARD CAPS)
    // ============================================================
    // Count HIGH and MEDIUM risks
    const allRisks = [
        input.logicRisk,
        input.liquidityRisk.controlRisk,
        input.liquidityRisk.depthRisk,
        input.constraintRisk,
        input.holderRisk
    ];
    const highRiskCount = allRisks.filter(isHighRisk).length;
    const mediumRiskCount = allRisks.filter(isMediumRisk).length;
    // If any HIGH risk exists → final score ≤65
    if (highRiskCount > 0) {
        if (score > 65) {
            guardrailsApplied.push(`HIGH risk detected (${highRiskCount}x): capped at 65`);
            score = 65;
        }
    }
    // If ≥2 MEDIUM risks exist → final score ≤75
    if (mediumRiskCount >= 2 && highRiskCount === 0) {
        if (score > 75) {
            guardrailsApplied.push(`Multiple MEDIUM risks (${mediumRiskCount}x): capped at 75`);
            score = 75;
        }
    }
    // V3/V4 unverifiable LP → final score ≤90
    if ((input.contextFlags.dexVersion === "v3" || input.contextFlags.dexVersion === "v4") &&
        input.liquidityRisk.verifiabilityRisk === "UNVERIFIABLE") {
        if (score > 90) {
            guardrailsApplied.push(`V3/V4 unverifiable LP: capped at 90`);
            score = 90;
        }
    }
    // HARD RULE: If holder concentration ≥80% → cap at 70
    if (input.contextFlags.holderConcentrationPercent !== null &&
        input.contextFlags.holderConcentrationPercent >= 80) {
        if (score > 70) {
            guardrailsApplied.push(`Single holder controls ≥80% supply: capped at 70`);
            score = 70;
        }
        riskFactors.push(`Single entity holds ${input.contextFlags.holderConcentrationPercent}% of circulating supply`);
    }
    // Clamp final score
    score = Math.max(0, Math.min(100, Math.round(score)));
    // ============================================================
    // CONFIDENCE & COVERAGE
    // ============================================================
    const unknownCount = allRisks.filter(isUnknown).length +
        (input.liquidityRisk.verifiabilityRisk === "UNVERIFIABLE" ? 1 : 0);
    let confidence;
    if (unknownCount === 0 && input.contextFlags.liquidityDepthUsd !== null) {
        confidence = "HIGH";
    }
    else if (unknownCount <= 1) {
        confidence = "MEDIUM";
    }
    else {
        confidence = "LOW";
    }
    const totalChecks = 6;
    const verifiedChecks = totalChecks - unknownCount;
    const coverageCompleteness = Math.round((verifiedChecks / totalChecks) * 100);
    return {
        finalScore: score,
        band: getBand(score),
        confidence,
        coverageCompleteness,
        breakdown: {
            baseScore: BASE_SCORE,
            adjustments,
            guardrailsApplied
        },
        riskFactors,
        positiveSignals
    };
}
//# sourceMappingURL=scoring.js.map