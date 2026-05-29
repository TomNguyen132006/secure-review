function formatSecurityReport(issues = []) {
  if (!issues || issues.length === 0) {
    return "No security issues found.";
  }

  return issues.map((issue) => {
    return `
[${issue.riskLevel}] ${issue.issueType || issue.type}

File:
${issue.file}:${issue.line}

Issue:
${issue.explanation}

Suggested Fix:
${issue.suggestedFix}
`.trim();
  }).join("\n\n---\n\n");
}

module.exports = { formatSecurityReport };