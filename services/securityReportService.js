/*
  Task 6.6: Make sure the report does not print undefined or null.
*/
function formatValue(value, fallback = "Not provided") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return value;
}

/*
  Check if a finding should be clearly marked as dangerous.
*/
function isHighRisk(riskLevel) {
  const normalizedRisk = String(riskLevel || "").toLowerCase();

  return normalizedRisk === "high" || normalizedRisk === "critical";
}

/*
  Convert one security finding into a readable terminal section.
  Each section includes:
    - issue type
    - risk level
    - file name
    - line number
    - explanation
    - suggested fix
    - result source
*/
function formatFinding(finding, index) {
  const issueType = formatValue(finding.issueType, "Unknown Security Issue");
  const riskLevel = formatValue(finding.riskLevel, "Unknown");
  const fileName = formatValue(finding.fileName);
  const lineNumber = formatValue(finding.lineNumber);
  const explanation = formatValue(
    finding.explanation,
    "No explanation provided."
  );
  const suggestedFix = formatValue(
    finding.suggestedFix,
    "No suggested fix provided."
  );
  const source = formatValue(finding.source, "unknown");

  const riskMarker = isHighRisk(riskLevel) ? " !!! HIGH RISK !!!" : "";

  return `
------------------------------------------------------------
Finding #${index + 1}${riskMarker}
------------------------------------------------------------
Issue Type : ${issueType}
Risk Level : ${riskLevel}
File       : ${fileName}
Line       : ${lineNumber}
Source     : ${source}

Explanation:
${explanation}

Suggested Fix:
${suggestedFix}
`;
}

/*
  Combine local scanner findings, Gemini explanations, and fallback results into one readable terminal report.
*/
function createSecurityReport(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return `
============================================================
Security Scan Report
============================================================

No security issues found.

============================================================
End of Report
============================================================
`;
  }

  const totalFindings = results.length;
  const highRiskCount = results.filter((finding) =>
    isHighRisk(finding.riskLevel)
  ).length;

  const formattedFindings = results
    .map((finding, index) => formatFinding(finding, index))
    .join("\n");

  return `
============================================================
Security Scan Report
============================================================

Total Findings   : ${totalFindings}
High-Risk Issues : ${highRiskCount}

${formattedFindings}

============================================================
End of Report
============================================================
`;
}

module.exports = {
  createSecurityReport,
  formatFinding,
  formatValue,
  isHighRisk,
};