const fs = require("fs");
const os = require("os");
const path = require("path");

const { createCli } = require("../bin/secure-review");

const TOKEN = "glpat-xxxxxxxxxxxxxxxxxxxx";

const SCAN_RESULT = {
  report: "=== Security Scan Report ===\nFinding #1 Hardcoded Password",
  findings: [
    {
      issueType: "Hardcoded Password",
      riskLevel: "High",
      fileName: "src/db.js",
      lineNumber: 12,
      explanation: "The code appears to contain a hardcoded password.",
      suggestedFix: "Use environment variables.",
      source: "local-fallback",
    },
  ],
};

describe("scan command", () => {
  let mockConsole;
  let mockAuthService;
  let mockHybridScanner;
  let mockCommentService;
  let tempDir;
  let originalCwd;

  function buildCli() {
    return createCli({
      console: mockConsole,
      authService: mockAuthService,
      hybridScannerService: mockHybridScanner,
      commentService: mockCommentService,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();

    process.exitCode = 0;

    mockConsole = {
      log: jest.fn(),
      error: jest.fn(),
    };

    mockAuthService = {
      isGitLabConnected: jest.fn(),
      getGitLabToken: jest.fn(),
    };

    mockHybridScanner = {
      runHybridScan: jest.fn().mockResolvedValue(SCAN_RESULT),
    };

    mockCommentService = {
      postMergeRequestComment: jest.fn().mockResolvedValue({
        success: true,
        message: "GitLab MR comment posted successfully.",
      }),
    };

    // Markdown files are written relative to cwd, so run in a temp folder.
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  test("should show error when --mr is missing", async () => {
    await buildCli().parseAsync(["scan"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining("Error: Missing required option --mr <id>")
    );
    expect(mockHybridScanner.runHybridScan).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("should show error when --project is missing", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);

    await buildCli().parseAsync(["scan", "--mr", "123"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing required option --project <id>")
    );
    expect(mockHybridScanner.runHybridScan).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("should show error when user is not logged in", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(null);

    await buildCli().parseAsync(["scan", "--project", "group/project", "--mr", "123"], {
      from: "user",
    });

    expect(mockAuthService.getGitLabToken).toHaveBeenCalled();

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining("Please login first using: secure-review gitlab login")
    );
    expect(mockHybridScanner.runHybridScan).not.toHaveBeenCalled();

    expect(process.exitCode).toBe(1);
  });

  test("should scan merge request successfully", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);

    await buildCli().parseAsync(["scan", "--project", "group/project", "--mr", "123"], {
      from: "user",
    });

    expect(mockHybridScanner.runHybridScan).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "group/project",
        mrId: "123",
        token: TOKEN,
      })
    );

    expect(mockConsole.log).toHaveBeenCalledWith(SCAN_RESULT.report);
    expect(mockCommentService.postMergeRequestComment).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(tempDir, "secure-review-report.md"))).toBe(false);

    expect(process.exitCode).toBe(0);
  });

  test("should show service error when scan fails", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);
    mockHybridScanner.runHybridScan.mockRejectedValue(
      new Error("Unable to fetch merge request diff.")
    );

    await buildCli().parseAsync(["scan", "--project", "group/project", "--mr", "999"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith(
      "Error: Unable to fetch merge request diff."
    );
    expect(process.exitCode).toBe(1);
  });

  test("should not crash if scan service throws an error", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);
    mockHybridScanner.runHybridScan.mockRejectedValue(new Error("GitLab API failed"));

    await buildCli().parseAsync(["scan", "--project", "group/project", "--mr", "123"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith("Error: GitLab API failed");
    expect(process.exitCode).toBe(1);
  });

  /**
  * Story 4 | Task 4.7 — Minh Nguyen
  * Test invalid MR error from scan service.
  */
  test("should show merge request not found error", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);
    mockHybridScanner.runHybridScan.mockRejectedValue(
      new Error("Merge request not found.")
    );

    await buildCli().parseAsync(["scan", "--project", "group/project", "--mr", "999"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith("Error: Merge request not found.");
    expect(process.exitCode).toBe(1);
  });

  /**
   * Story 4 | Task 4.7 — Minh Nguyen
   * Test invalid token error from private repo scan.
   */
  test("should show invalid token error for private repo", async () => {
    mockAuthService.getGitLabToken.mockReturnValue("glpat-expiredxxxxxxxxxxxx");
    mockHybridScanner.runHybridScan.mockRejectedValue(
      new Error("Invalid or expired GitLab token.")
    );

    await buildCli().parseAsync(["scan", "--project", "group/project", "--mr", "123"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith(
      "Error: Invalid or expired GitLab token."
    );
    expect(process.exitCode).toBe(1);
  });

  test("--markdown --output writes the report to the given file", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);
    const outputPath = path.join(tempDir, "reports", "mr-123.md");

    await buildCli().parseAsync(
      ["scan", "--project", "group/project", "--mr", "123", "--markdown", "--output", outputPath],
      { from: "user" }
    );

    const markdown = fs.readFileSync(outputPath, "utf8");

    expect(markdown).toContain("# SecureReview Security Report");
    expect(markdown).toContain("MR: 123");
    expect(markdown).toContain("Hardcoded Password");
    expect(markdown).toContain("src/db.js");
    expect(mockConsole.log).toHaveBeenCalledWith(
      `Markdown report exported to ${outputPath}`
    );
    expect(process.exitCode).toBe(0);
  });

  test("--markdown without --output writes secure-review-report.md", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);

    await buildCli().parseAsync(
      ["scan", "--project", "group/project", "--mr", "123", "--markdown"],
      { from: "user" }
    );

    expect(fs.existsSync(path.join(tempDir, "secure-review-report.md"))).toBe(true);
  });

  test("--comment posts the Markdown report to the merge request", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);

    await buildCli().parseAsync(
      ["scan", "--project", "group/project", "--mr", "123", "--comment"],
      { from: "user" }
    );

    expect(mockCommentService.postMergeRequestComment).toHaveBeenCalledWith(
      "group/project",
      "123",
      TOKEN,
      expect.stringContaining("# SecureReview Security Report")
    );
    expect(mockConsole.log).toHaveBeenCalledWith(
      "GitLab MR comment posted successfully."
    );
    expect(fs.existsSync(path.join(tempDir, "secure-review-report.md"))).toBe(false);
    expect(process.exitCode).toBe(0);
  });

  test("--comment failure is reported with exit code 1", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);
    mockCommentService.postMergeRequestComment.mockResolvedValue({
      success: false,
      message: "Invalid or expired GitLab token.",
    });

    await buildCli().parseAsync(
      ["scan", "--project", "group/project", "--mr", "123", "--comment"],
      { from: "user" }
    );

    expect(mockConsole.error).toHaveBeenCalledWith(
      "Error: Invalid or expired GitLab token."
    );
    expect(process.exitCode).toBe(1);
  });

  test("--markdown and --comment together export and post the same report", async () => {
    mockAuthService.getGitLabToken.mockReturnValue(TOKEN);
    const outputPath = path.join(tempDir, "report.md");

    await buildCli().parseAsync(
      [
        "scan",
        "--project",
        "group/project",
        "--mr",
        "123",
        "--markdown",
        "--output",
        outputPath,
        "--comment",
      ],
      { from: "user" }
    );

    const markdown = fs.readFileSync(outputPath, "utf8");
    const postedBody = mockCommentService.postMergeRequestComment.mock.calls[0][3];

    expect(postedBody).toBe(markdown);
    expect(process.exitCode).toBe(0);
  });

  describe("--fail-on", () => {
    const scanWithRisks = (...riskLevels) => ({
      report: "report",
      findings: riskLevels.map((riskLevel, index) => ({
        issueType: `Issue ${index + 1}`,
        riskLevel,
      })),
    });

    async function scan(extraArgs) {
      await buildCli().parseAsync(
        ["scan", "--project", "group/project", "--mr", "123", ...extraArgs],
        { from: "user" }
      );
    }

    beforeEach(() => {
      mockAuthService.getGitLabToken.mockReturnValue(TOKEN);
    });

    test("defaults to none: findings do not change the exit code", async () => {
      mockHybridScanner.runHybridScan.mockResolvedValue(scanWithRisks("Critical"));

      await scan([]);

      expect(process.exitCode).toBe(0);
    });

    test("exits 2 when a finding is at the threshold", async () => {
      mockHybridScanner.runHybridScan.mockResolvedValue(scanWithRisks("Low", "High"));

      await scan(["--fail-on", "high"]);

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failing: 1 finding(s) at or above "high" (--fail-on high).'
      );
      expect(process.exitCode).toBe(2);
    });

    test("exits 2 when a finding is above the threshold (Critical vs high)", async () => {
      mockHybridScanner.runHybridScan.mockResolvedValue(scanWithRisks("Critical"));

      await scan(["--fail-on", "HIGH"]);

      expect(process.exitCode).toBe(2);
    });

    test("exits 0 when every finding is below the threshold", async () => {
      mockHybridScanner.runHybridScan.mockResolvedValue(scanWithRisks("Low", "Medium"));

      await scan(["--fail-on", "high"]);

      expect(process.exitCode).toBe(0);
    });

    test("exits 0 when there are no findings", async () => {
      mockHybridScanner.runHybridScan.mockResolvedValue(scanWithRisks());

      await scan(["--fail-on", "low"]);

      expect(process.exitCode).toBe(0);
    });

    test("still writes the Markdown report before exiting 2", async () => {
      mockHybridScanner.runHybridScan.mockResolvedValue(scanWithRisks("Medium"));
      const outputPath = path.join(tempDir, "gate.md");

      await scan(["--fail-on", "medium", "--markdown", "--output", outputPath]);

      expect(fs.existsSync(outputPath)).toBe(true);
      expect(process.exitCode).toBe(2);
    });

    test("an error (failed --comment) wins over findings: exit 1", async () => {
      mockHybridScanner.runHybridScan.mockResolvedValue(scanWithRisks("High"));
      mockCommentService.postMergeRequestComment.mockResolvedValue({
        success: false,
        message: "Merge request not found.",
      });

      await scan(["--fail-on", "low", "--comment"]);

      expect(process.exitCode).toBe(1);
    });

    test("rejects an invalid level with exit 1 before scanning", async () => {
      await scan(["--fail-on", "critical"]);

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error: Invalid --fail-on value "critical". Use one of: none, low, medium, high'
      );
      expect(mockHybridScanner.runHybridScan).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });
  });
});
