const { createSecurityReport } = require("../services/securityReportService");

describe("securityReportService", () => {
  test("creates a report with local scanner findings", () => {
    const results = [
      {
        issueType: "Hardcoded Password",
        riskLevel: "High",
        fileName: "config.js",
        lineNumber: 8,
        explanation: "A password appears to be hardcoded.",
        suggestedFix: "Move the password into an environment variable.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Security Scan Report");
    expect(report).toContain("Hardcoded Password");
    expect(report).toContain("High");
    expect(report).toContain("config.js");
    expect(report).toContain("8");
    expect(report).toContain("A password appears to be hardcoded.");
    expect(report).toContain("Move the password into an environment variable.");
    expect(report).toContain("local");
  });

  test("creates a report with Gemini explanations", () => {
    const results = [
      {
        issueType: "SQL Injection Risk",
        riskLevel: "Critical",
        fileName: "db.js",
        lineNumber: 21,
        explanation:
          "Gemini explanation: User input may affect a database query.",
        suggestedFix: "Use parameterized queries.",
        source: "gemini",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("SQL Injection Risk");
    expect(report).toContain("Critical");
    expect(report).toContain("Gemini explanation");
    expect(report).toContain("Use parameterized queries.");
    expect(report).toContain("gemini");
  });

  test("creates a report with fallback findings when Gemini is unavailable", () => {
    const results = [
      {
        issueType: "Private Key Exposure",
        riskLevel: "Critical",
        fileName: "keys.js",
        explanation: "A private key pattern was detected.",
        suggestedFix: "Remove the key and rotate it immediately.",
        source: "local-fallback",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Private Key Exposure");
    expect(report).toContain("Critical");
    expect(report).toContain("keys.js");
    expect(report).toContain("Line       : Not provided");
    expect(report).toContain("local-fallback");
  });

  test("returns clean message when there are no findings", () => {
    const report = createSecurityReport([]);

    expect(report).toContain("No security issues found");
  });

  test("handles invalid input safely", () => {
    const report = createSecurityReport(null);

    expect(report).toContain("No security issues found");
  });

  test("clearly marks high-risk issues", () => {
    const results = [
      {
        issueType: "AWS Access Key Exposure",
        riskLevel: "High",
        explanation: "An AWS access key pattern was detected.",
        suggestedFix: "Remove the key and rotate it.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("HIGH RISK");
  });
});