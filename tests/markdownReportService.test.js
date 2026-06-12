const fs = require("fs");
const path = require("path");

const {
  createMarkdownReport,
  saveMarkdownReport,
  getFindings,
  formatValue,
} = require("../services/markdownReportService");

describe("markdownReportService", () => {
  const testOutputPath = path.join(__dirname, "test-secure-review-report.md");

  afterEach(() => {
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  });

  test("creates markdown report title", () => {
    const markdown = createMarkdownReport({
      mrId: "123",
      findings: [],
    });

    expect(markdown).toContain("# SecureReview Security Report");
  });

  test("includes merge request number", () => {
    const markdown = createMarkdownReport({
      mrId: "123",
      findings: [],
    });

    expect(markdown).toContain("MR: 123");
  });

  test("includes finding details", () => {
    const markdown = createMarkdownReport({
      mrId: "123",
      findings: [
        {
          issueType: "Hardcoded Secret",
          riskLevel: "High",
          fileName: "src/config.js",
          lineNumber: 5,
          source: "local",
          explanation: "A secret appears to be hardcoded.",
          suggestedFix: "Move the secret to environment variables.",
        },
      ],
    });

    expect(markdown).toContain("Hardcoded Secret");
    expect(markdown).toContain("High");
    expect(markdown).toContain("src/config.js");
    expect(markdown).toContain("5");
    expect(markdown).toContain("local");
    expect(markdown).toContain("A secret appears to be hardcoded.");
    expect(markdown).toContain("Move the secret to environment variables.");
  });

  test("handles no findings", () => {
    const markdown = createMarkdownReport({
      mrId: "123",
      findings: [],
    });

    expect(markdown).toContain("No security issues found.");
    expect(markdown).toContain("Total Findings: 0");
  });

  test("supports issues array from older scan result format", () => {
    const findings = getFindings({
      issues: [
        {
          type: "API Key",
        },
      ],
    });

    expect(findings.length).toBe(1);
    expect(findings[0].type).toBe("API Key");
  });

  test("saves markdown report to file", () => {
    const markdown = "# Test Report";

    const result = saveMarkdownReport(markdown, testOutputPath);

    expect(result.success).toBe(true);
    expect(fs.existsSync(testOutputPath)).toBe(true);
    expect(fs.readFileSync(testOutputPath, "utf8")).toBe(markdown);
  });

  test("formatValue returns fallback for missing values", () => {
    expect(formatValue(undefined, "Fallback")).toBe("Fallback");
    expect(formatValue(null, "Fallback")).toBe("Fallback");
    expect(formatValue("", "Fallback")).toBe("Fallback");
  });
});