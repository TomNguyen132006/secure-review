/*
  Risk levels in increasing order. "none" disables the --fail-on gate.
*/
const RISK_ORDER = ["low", "medium", "high", "critical"];

const FAIL_ON_LEVELS = ["none", "low", "medium", "high"];

function normalizeLevel(level) {
  return String(level || "").trim().toLowerCase();
}

function isValidFailOnLevel(level) {
  return FAIL_ON_LEVELS.includes(normalizeLevel(level));
}

/*
  True if a finding's risk level is at or above the threshold.
  Unknown or missing risk levels count as matching (fail closed), so a
  finding with an unexpected level can never slip past the gate.
*/
function meetsThreshold(riskLevel, threshold) {
  const thresholdRank = RISK_ORDER.indexOf(normalizeLevel(threshold));

  if (thresholdRank === -1) {
    return false;
  }

  const findingRank = RISK_ORDER.indexOf(normalizeLevel(riskLevel));

  if (findingRank === -1) {
    return true;
  }

  return findingRank >= thresholdRank;
}

function countFindingsAtOrAbove(findings, threshold) {
  if (!Array.isArray(findings) || normalizeLevel(threshold) === "none") {
    return 0;
  }

  return findings.filter((finding) => meetsThreshold(finding && finding.riskLevel, threshold))
    .length;
}

module.exports = {
  RISK_ORDER,
  FAIL_ON_LEVELS,
  isValidFailOnLevel,
  meetsThreshold,
  countFindingsAtOrAbove,
};
