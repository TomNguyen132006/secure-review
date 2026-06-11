const fs = require("fs");
const path = require("path");

function getFindings(scanResult = {}) {
  if (Array.isArray(scanResult.findings)) return scanResult.findings;
  if (Array.isArray(scanResult.results)) return scanResult.results;
  if (Array.isArray(scanResult.issues)) return scanResult.issues;
  return [];
}

function formatValue(value, fallback = "Not provided") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return value;
}

function createMarkdownReport(scanResult = {}) {
  const mrId = formatValue(scanResult.mrId || scanResult.mergeRequestId, "Unknown");
  const findings = getFindings(scanResult);

  let markdown = `# SecureReview Security Report

## Merge Request

MR: ${mrId}

## Summary

Total Findings: ${findings.length}
`;

  if (findings.length === 0) {
    markdown += `

## Result

No security issues found.
`;
    return markdown;
  }

  markdown += `

## Findings
`;

  findings.forEach((finding, index) => {
    const issueType = formatValue(finding.issueType || finding.type, "Unknown Security Issue");
    const riskLevel = formatValue(finding.riskLevel, "Unknown");
    const fileName = formatValue(finding.fileName || finding.file, "Not provided");
    const lineNumber = formatValue(finding.lineNumber || finding.line, "Not provided");
    const source = formatValue(finding.source, "unknown");
    const explanation = formatValue(finding.explanation, "No explanation provided.");
    const suggestedFix = formatValue(finding.suggestedFix, "No suggested fix provided.");

    markdown += `

### ${index + 1}. ${issueType}

**Risk Level:** ${riskLevel}  
**File:** ${fileName}  
**Line:** ${lineNumber}  
**Source:** ${source}  

**Explanation:**  
${explanation}

**Suggested Fix:**  
${suggestedFix}
`;
  });

  return markdown;
}

function saveMarkdownReport(markdown, outputPath = "secure-review-report.md") {
  const finalPath = outputPath || "secure-review-report.md";
  const directory = path.dirname(finalPath);

  if (directory && directory !== ".") {
    fs.mkdirSync(directory, { recursive: true });
  }

  fs.writeFileSync(finalPath, markdown, "utf8");

  return {
    success: true,
    filePath: finalPath,
  };
}

module.exports = {
  createMarkdownReport,
  saveMarkdownReport,
  getFindings,
  formatValue,
};