const { secretPatterns } = require("./secretPatterns");

/*
  Task 5.3
  Purpose:
    Scan GitLab merge request diff data for hardcoded secrets.

  Input example:
    {
      changes: [
        {
          new_path: "src/AuthService.java",
          diff: "+String api_key = \"abc123\";"
        }
      ]
    }

  Output example:
    {
      success: true,
      issues: [
        {
          file: "src/AuthService.java",
          line: 1,
          issueType: "Hardcoded API Key",
          riskLevel: "HIGH",
          explanation: "API key is stored directly in source code.",
          suggestedFix: "Move the secret to environment variables or Google Secret Manager."
        }
      ]
    }
*/
function scanMergeRequestDiff(mrDiff) {
  const issues = [];

  if (!mrDiff || !Array.isArray(mrDiff.changes)) {
    return {
      success: false,
      issues: [],
      message: "Invalid merge request diff data.",
    };
  }

  mrDiff.changes.forEach((changedFile) => {
    const fileName = changedFile.new_path || changedFile.old_path || "Unknown file";
    const diff = changedFile.diff || "";

    const lines = diff.split("\n");

    lines.forEach((lineContent, index) => {
      /*
        Git diff lines usually start with:
          + added line
          - removed line
          @@ metadata line

        We only scan added lines because those are new code changes.
      */
      if (!lineContent.startsWith("+") || lineContent.startsWith("+++")) {
        return;
      }

      const cleanLine = lineContent.substring(1).trim();

      secretPatterns.forEach((pattern) => {
        if (pattern.regex.test(cleanLine)) {
          issues.push({
            file: fileName,
            line: index + 1,
            issueType: pattern.issueType,
            riskLevel: pattern.riskLevel,
            explanation: pattern.explanation,
            suggestedFix: pattern.suggestedFix,
          });
        }
      });
    });
  });

  return {
    success: true,
    issues,
  };
}

module.exports = {
  scanMergeRequestDiff,
};