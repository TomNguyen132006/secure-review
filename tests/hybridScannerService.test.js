const { runHybridScan } = require("../services/hybridScannerService");

jest.mock("../services/gitlabMergeRequestService", () => ({
  fetchMergeRequestDiff: jest.fn(),
}));

jest.mock("../services/diffChunkService", () => ({
  splitDiffByFile: jest.fn(),
}));

jest.mock("../services/localSecurityScanner", () => ({
  scanSecurityPatterns: jest.fn(),
}));

jest.mock("../services/geminiAnalysisService", () => ({
  analyzeSecurityFinding: jest.fn(),
}));

jest.mock("../services/securityReportService", () => ({
  createSecurityReport: jest.fn(),
}));

const {
  fetchMergeRequestDiff,
} = require("../services/gitlabMergeRequestService");

const { splitDiffByFile } = require("../services/diffChunkService");

const {
  scanSecurityPatterns,
} = require("../services/localSecurityScanner");

const {
  analyzeSecurityFinding,
} = require("../services/geminiAnalysisService");

const {
  createSecurityReport,
} = require("../services/securityReportService");

describe("hybridScannerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should run the full safe scanning flow", async () => {
    fetchMergeRequestDiff.mockResolvedValue({
      changes: [
        {
          new_path: "app.js",
          diff: '+ const apiKey = "fake-api-key-123";',
        },
      ],
    });

    splitDiffByFile.mockReturnValue([
      {
        fileName: "app.js",
        content: '+ const apiKey = "fake-api-key-123";',
      },
    ]);

    scanSecurityPatterns.mockReturnValue([
      {
        issueType: "Hardcoded API Key",
        riskLevel: "High",
        explanation: "A hardcoded API key was detected.",
        suggestedFix: "Move the key into an environment variable.",
      },
    ]);

    analyzeSecurityFinding.mockResolvedValue({
      issueType: "Hardcoded API Key",
      riskLevel: "High",
      fileName: "app.js",
      explanation: "Gemini explanation for hardcoded API key.",
      suggestedFix: "Move the key into an environment variable.",
      source: "gemini",
    });

    createSecurityReport.mockReturnValue("Final Security Report");

    const result = await runHybridScan({
      projectId: "TomNguyen132006/secure-review",
      mrId: "123",
      token: "fake-token",
    });

    expect(fetchMergeRequestDiff).toHaveBeenCalled();
    expect(splitDiffByFile).toHaveBeenCalled();
    expect(scanSecurityPatterns).toHaveBeenCalled();
    expect(analyzeSecurityFinding).toHaveBeenCalled();
    expect(createSecurityReport).toHaveBeenCalled();

    expect(result.report).toBe("Final Security Report");
  });

  test("should still create report when Gemini returns fallback result", async () => {
    fetchMergeRequestDiff.mockResolvedValue({
      changes: [
        {
          new_path: "db.js",
          diff: '+ const query = "SELECT * FROM users WHERE id = " + userId;',
        },
      ],
    });

    splitDiffByFile.mockReturnValue([
      {
        fileName: "db.js",
        content: '+ const query = "SELECT * FROM users WHERE id = " + userId;',
      },
    ]);

    scanSecurityPatterns.mockReturnValue([
      {
        issueType: "SQL Injection Risk",
        riskLevel: "High",
        explanation: "Unsafe SQL string concatenation was detected.",
        suggestedFix: "Use parameterized queries.",
      },
    ]);

    analyzeSecurityFinding.mockResolvedValue({
      issueType: "SQL Injection Risk",
      riskLevel: "High",
      fileName: "db.js",
      explanation: "Unsafe SQL string concatenation was detected.",
      suggestedFix: "Use parameterized queries.",
      source: "local-fallback",
    });

    createSecurityReport.mockReturnValue("Fallback Security Report");

    const result = await runHybridScan({
      projectId: "TomNguyen132006/secure-review",
      mrId: "123",
      token: "fake-token",
    });

    expect(createSecurityReport).toHaveBeenCalledWith([
      expect.objectContaining({
        issueType: "SQL Injection Risk",
        source: "local-fallback",
      }),
    ]);

    expect(result.report).toBe("Fallback Security Report");
  });
});