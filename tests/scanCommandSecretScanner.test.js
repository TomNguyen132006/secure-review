const { createCli } = require("../bin/secure-review");
const { runHybridScan } = require("../services/hybridScannerService");

/*
  End-to-end scan tests through the CLI.
  The real hybrid scanner is injected; only fetch (GitLab) is mocked, and
  GEMINI_API_KEY is unset so the local fallback explanations are used.
*/
const TOKEN = "glpat-xxxxxxxxxxxxxxxxxxxx";

function gitlabChangesResponse(changes) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ changes }),
  };
}

describe("scan command secret scanner", () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let hybridScannerService;
  let originalGeminiKey;

  function buildCli() {
    return createCli({
      authService: { getGitLabToken: jest.fn(() => TOKEN) },
      hybridScannerService,
      console,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;

    originalGeminiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    global.fetch = jest.fn();
    hybridScannerService = { runHybridScan: jest.fn(runHybridScan) };

    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    process.exitCode = undefined;

    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  test("runs secret scanner when scanning a merge request", async () => {
    fetch.mockResolvedValue(
      gitlabChangesResponse([
        {
          new_path: "src/AuthService.java",
          old_path: "src/AuthService.java",
          diff: '@@ -0,0 +1,1 @@\n+String api_key = "abc123";\n',
        },
      ])
    );

    await buildCli().parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    expect(hybridScannerService.runHybridScan).toHaveBeenCalledWith({
      projectId: "123",
      mrId: "7",
      token: TOKEN,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/123/merge_requests/7/changes",
      expect.objectContaining({
        headers: { "PRIVATE-TOKEN": TOKEN },
      })
    );

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("High"));
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Hardcoded API Key")
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("src/AuthService.java")
    );
    expect(process.exitCode).toBe(0);
  });

  test("reports the real file name and new-file line number", async () => {
    fetch.mockResolvedValue(
      gitlabChangesResponse([
        {
          new_path: "src/config.js",
          old_path: "src/config.js",
          diff:
            "@@ -10,3 +10,4 @@ module.exports = {\n" +
            "   host: \"localhost\",\n" +
            "-  port: 5432,\n" +
            "+  port: 5433,\n" +
            "+  password = \"hunter2-secret\",\n" +
            "   user: \"app\",\n",
        },
      ])
    );

    await buildCli().parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    const report = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");

    expect(report).toContain("Hardcoded Password");
    expect(report).toMatch(/File\s+: src\/config\.js/);
    expect(report).toMatch(/Line\s+: 12/);
  });

  test("does not report secrets on lines the MR removes", async () => {
    fetch.mockResolvedValue(
      gitlabChangesResponse([
        {
          new_path: "src/config.js",
          old_path: "src/config.js",
          diff:
            "@@ -1,2 +1,2 @@\n" +
            "-const password = \"old-hardcoded-secret\";\n" +
            "+const password = process.env.DB_PASSWORD;\n" +
            " module.exports = { password };\n",
        },
      ])
    );

    await buildCli().parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("No security issues found.")
    );
  });

  test("prints no issues found message when scanner finds no secrets", async () => {
    fetch.mockResolvedValue(
      gitlabChangesResponse([
        {
          new_path: "src/App.java",
          old_path: "src/App.java",
          diff: '@@ -0,0 +1,1 @@\n+console.log("hello");\n',
        },
      ])
    );

    await buildCli().parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("No security issues found.")
    );
    expect(process.exitCode).toBe(0);
  });

  test("does not crash when GitLab cannot be reached", async () => {
    fetch.mockRejectedValue(new Error("GitLab API failed"));

    await buildCli().parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: Unable to fetch merge request diff."
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("No security issues found.")
    );
    expect(process.exitCode).toBe(1);
  });

  test("reports an expired token instead of an empty report", async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await buildCli().parseAsync(
      ["node", "secure-review", "scan", "--project", "123", "--mr", "7"],
      { from: "node" }
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: Invalid or expired GitLab token."
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
