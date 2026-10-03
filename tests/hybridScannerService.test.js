const {
  runHybridScan,
  getChunkFileName,
  buildNewFileLineMap,
} = require("../services/hybridScannerService");

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
  analyzeSecurityFindingWithStatus: jest.fn(),
  buildFallbackFinding: jest.fn((finding) => ({ ...finding, source: "local-fallback" })),
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
  analyzeSecurityFindingWithStatus,
  buildFallbackFinding,
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

    analyzeSecurityFindingWithStatus.mockResolvedValue({
      finding: {
        issueType: "Hardcoded API Key",
        riskLevel: "High",
        fileName: "app.js",
        explanation: "Gemini explanation for hardcoded API key.",
        suggestedFix: "Move the key into an environment variable.",
        source: "gemini",
      },
      skippedReason: null,
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
    expect(analyzeSecurityFindingWithStatus).toHaveBeenCalled();
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

    analyzeSecurityFindingWithStatus.mockResolvedValue({
      finding: {
        issueType: "SQL Injection Risk",
        riskLevel: "High",
        fileName: "db.js",
        explanation: "Unsafe SQL string concatenation was detected.",
        suggestedFix: "Use parameterized queries.",
        source: "local-fallback",
      },
      skippedReason: "GEMINI_API_KEY is not set",
    });

    createSecurityReport.mockReturnValue("Fallback Security Report");

    const onWarning = jest.fn();

    const result = await runHybridScan({
      projectId: "TomNguyen132006/secure-review",
      mrId: "123",
      token: "fake-token",
      onWarning,
    });

    expect(onWarning).toHaveBeenCalledWith(
      "Warning: AI analysis skipped (GEMINI_API_KEY is not set). Using local explanations."
    );
    expect(result.warnings).toHaveLength(1);

    expect(createSecurityReport).toHaveBeenCalledWith([
      expect.objectContaining({
        issueType: "SQL Injection Risk",
        source: "local-fallback",
      }),
    ]);

    expect(result.report).toBe("Fallback Security Report");
  });
});

describe("hybridScannerService failures and diff helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("throws instead of reporting no issues when the MR diff cannot be fetched", async () => {
    fetchMergeRequestDiff.mockResolvedValue({
      success: false,
      message: "Error: Merge request not found.",
      status: 404,
    });

    await expect(
      runHybridScan({ projectId: "group/project", mrId: "999", token: "glpat-xxxxxxxxxxxxxxxxxxxx" })
    ).rejects.toThrow("Merge request not found.");

    expect(createSecurityReport).not.toHaveBeenCalled();
  });

  test("getChunkFileName reads the new path from a diff --git header", () => {
    expect(getChunkFileName("diff --git a/old/name.js b/src/new name.js\n@@ -1 +1 @@\n+x")).toBe(
      "src/new name.js"
    );
    expect(getChunkFileName({ fileName: "app.js" })).toBe("app.js");
    expect(getChunkFileName("no header here")).toBeUndefined();
  });

  test("buildNewFileLineMap maps diff lines to new-file line numbers", () => {
    const chunk = [
      "diff --git a/a.js b/a.js",
      "@@ -10,3 +20,3 @@ function x() {",
      " context",
      "-removed",
      "+added",
      " more context",
      "@@ -50 +60 @@",
      "+second hunk",
    ].join("\n");

    expect(buildNewFileLineMap(chunk)).toEqual([
      undefined,
      undefined,
      20,
      null,
      21,
      22,
      undefined,
      60,
    ]);
  });
});

describe("hybridScannerService AI-skipped warning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("warns once per scan and stops calling Gemini after the first failure", async () => {
    fetchMergeRequestDiff.mockResolvedValue({ changes: [] });
    splitDiffByFile.mockReturnValue(["chunk-1", "chunk-2"]);
    scanSecurityPatterns.mockReturnValue([
      { issueType: "Hardcoded Password", riskLevel: "High", lineNumber: 1 },
      { issueType: "SQL Injection Risk", riskLevel: "High", lineNumber: 2 },
    ]);
    analyzeSecurityFindingWithStatus.mockImplementation(async (finding) => ({
      finding: { ...finding, source: "local-fallback" },
      skippedReason: "GEMINI_API_KEY is not set",
    }));
    createSecurityReport.mockReturnValue("Report");

    const onWarning = jest.fn();

    const result = await runHybridScan({
      projectId: "group/project",
      mrId: "1",
      token: "glpat-xxxxxxxxxxxxxxxxxxxx",
      onWarning,
    });

    // 2 chunks x 2 findings = 4 findings, but only one Gemini attempt and one warning.
    expect(result.findings).toHaveLength(4);
    expect(analyzeSecurityFindingWithStatus).toHaveBeenCalledTimes(1);
    expect(buildFallbackFinding).toHaveBeenCalledTimes(3);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual([
      "Warning: AI analysis skipped (GEMINI_API_KEY is not set). Using local explanations.",
    ]);
  });

  test("does not warn when Gemini succeeds", async () => {
    fetchMergeRequestDiff.mockResolvedValue({ changes: [] });
    splitDiffByFile.mockReturnValue(["chunk-1"]);
    scanSecurityPatterns.mockReturnValue([
      { issueType: "Hardcoded Password", riskLevel: "High", lineNumber: 1 },
    ]);
    analyzeSecurityFindingWithStatus.mockResolvedValue({
      finding: { issueType: "Hardcoded Password", source: "gemini" },
      skippedReason: null,
    });
    createSecurityReport.mockReturnValue("Report");

    const onWarning = jest.fn();

    const result = await runHybridScan({
      projectId: "group/project",
      mrId: "1",
      token: "glpat-xxxxxxxxxxxxxxxxxxxx",
      onWarning,
    });

    expect(onWarning).not.toHaveBeenCalled();
    expect(result.warnings).toEqual([]);
  });
});
