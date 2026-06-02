/**
 * Task 6.4 : Convert a raw security finding into a safe abstract description.
 * Task 7.2 : Add safe abstraction for weak authentication.
 */

function createAbstractDescription(finding = {}) {
  const issueType = finding.issueType || "Unknown Security Issue";
  const riskLevel = finding.riskLevel || "Unknown";
  const fileName = finding.fileName || "Unknown file";
  const lineNumber = finding.lineNumber || "Unknown line";

  const safePatternDescription = getSafePatternDescription(issueType);

  return {
    issueType,
    riskLevel,
    fileName,
    lineNumber,
    description: safePatternDescription,
    geminiSafeSummary: [
      `Issue Type: ${issueType}`,
      `Risk Level: ${riskLevel}`,
      `File: ${fileName}`,
      `Line: ${lineNumber}`,
      `Safe Description: ${safePatternDescription}`,
      "Raw risky code was intentionally removed before sending to AI."
    ].join("\n")
  };
}

function getSafePatternDescription(issueType = "") {
  const normalizedIssueType = issueType.toLowerCase();

  if (normalizedIssueType.includes("weak authentication")) {
    return "Authentication logic compares a password variable directly against a hardcoded weak or default password value.";
  }

  if (normalizedIssueType.includes("api key")) {
    return "Variable assignment of string literal to credential-named identifier.";
  }

  if (normalizedIssueType.includes("password")) {
    return "Password-like credential appears to be hardcoded as a string literal.";
  }

  if (normalizedIssueType.includes("token")) {
    return "Token-like credential appears to be stored directly in source code.";
  }

  if (normalizedIssueType.includes("aws")) {
    return "Cloud access key pattern appears to be present in source code.";
  }

  if (normalizedIssueType.includes("private key")) {
    return "Private key material appears to be embedded directly in source code.";
  }

  if (
    normalizedIssueType.includes("sql injection") ||
    normalizedIssueType.includes("unsafe sql")
  ) {
    return "User-controlled input appears to be directly concatenated into a SQL query.";
  }

  if (
    normalizedIssueType.includes("data exfiltration") ||
    normalizedIssueType.includes("suspicious data")
  ) {
    return "Code appears to collect or transmit sensitive data in a suspicious way.";
  }
  if (
    normalizedIssueType.includes("missing authorization") ||
    normalizedIssueType.includes("authorization check")
  ) {
    return "Admin route appears to be defined without role-based authorization middleware.";
  }

  return "A potentially risky security pattern was detected and summarized without raw code.";
}

module.exports = {
  createAbstractDescription
};