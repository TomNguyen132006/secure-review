const { createCli } = require("../bin/secure-review");

jest.mock("../services/gitlabMergeRequestService", () => ({
  fetchMergeRequestDiff: jest.fn(),
}));

jest.mock("../security/secretScanner", () => ({
  scanMergeRequestDiff: jest.fn(),
}));

const { fetchMergeRequestDiff } = require("../services/gitlabMergeRequestService");
const { scanMergeRequestDiff } = require("../security/secretScanner");

describe("scan command secret scanner", () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;

    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test("runs secret scanner when scanning a merge request", async () => {
    const fakeAuthService = {
      getGitLabToken: jest.fn(() => "fake-token"),
    };

    const fakeDiff = {
      changes: [
        {
          new_path: "src/AuthService.java",
          diff: '+String api_key = "abc123";',
        },
      ],
    };

    fetchMergeRequestDiff.mockResolvedValue(fakeDiff);

    scanMergeRequestDiff.mockReturnValue({
      success: true,
      issues: [
        {
          file: "src/AuthService.java",
          line: 1,
          issueType: "Hardcoded API Key",
          riskLevel: "HIGH",
          explanation: "API key is stored directly in source code.",
          suggestedFix: "Move the secret to environment variables or Google Secret Manager.",
        },
      ],
    });

    const program = createCli({
      authService: fakeAuthService,
      console,
    });

    await program.parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    expect(fetchMergeRequestDiff).toHaveBeenCalledWith("123", "7", "fake-token");
    expect(scanMergeRequestDiff).toHaveBeenCalledWith(fakeDiff);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("HIGH")
    );

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("src/AuthService.java")
    );
  });

  test("prints no issues found message when scanner finds no secrets", async () => {
    const fakeAuthService = {
      getGitLabToken: jest.fn(() => "fake-token"),
    };

    const fakeDiff = {
      changes: [
        {
          new_path: "src/App.java",
          diff: '+console.log("hello");',
        },
      ],
    };

    fetchMergeRequestDiff.mockResolvedValue(fakeDiff);

    scanMergeRequestDiff.mockReturnValue({
      success: true,
      issues: [],
    });

    const program = createCli({
      authService: fakeAuthService,
      console,
    });

    await program.parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    expect(fetchMergeRequestDiff).toHaveBeenCalledWith("123", "7", "fake-token");
    expect(scanMergeRequestDiff).toHaveBeenCalledWith(fakeDiff);
    expect(consoleLogSpy).toHaveBeenCalledWith("No security issues found.");
  });

  test("does not crash when scan fails", async () => {
    const fakeAuthService = {
      getGitLabToken: jest.fn(() => "fake-token"),
    };

    fetchMergeRequestDiff.mockRejectedValue(new Error("GitLab API failed"));

    const program = createCli({
      authService: fakeAuthService,
      console,
    });

    await program.parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Scan failed:",
      "GitLab API failed"
    );

    expect(process.exitCode).toBe(1);
  });

  const { formatSecurityReport } = require("../services/securityReportFormatter");

  describe("Scan Command Secret Output", () => {
    test("prints no issue message when no secrets found", () => {
      const output = formatSecurityReport([]);

      expect(output).toContain("No security issues found");
    });

    test("prints risk level for secret finding", () => {
      const output = formatSecurityReport([
        {
          file: "src/app.js",
          line: 3,
          riskLevel: "HIGH",
          issueType: "Hardcoded Secret",
          explanation: "API key is hardcoded.",
          suggestedFix: "Move it to environment variables."
        }
      ]);

      expect(output).toContain("HIGH");
      expect(output).toContain("Hardcoded Secret");
      expect(output).toContain("src/app.js");
    });
  });
});