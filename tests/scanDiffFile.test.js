const fs = require("fs");
const os = require("os");
const path = require("path");

const { createCli } = require("../bin/secure-review");

/*
  Offline mode: scan --diff-file runs the real scanner on a local diff,
  with no GitLab login and no network (fetch is blocked by the Jest setup).
*/
const EXAMPLES = path.join(__dirname, "..", "examples");
const VULNERABLE = path.join(EXAMPLES, "vulnerable.diff");
const SAFE = path.join(EXAMPLES, "safe.diff");

const EXPECTED_FINDINGS = [
  { issueType: "Hardcoded Password", fileName: "src/db.js", lineNumber: 4 },
  { issueType: "SQL Injection Risk", fileName: "src/db.js", lineNumber: 9 },
  { issueType: "Weak Authentication", fileName: "src/auth.js", lineNumber: 4 },
];

describe("scan --diff-file (offline)", () => {
  let mockConsole;
  let authService;
  let commentService;
  let tempDir;
  let originalGeminiKey;

  function output() {
    return mockConsole.log.mock.calls.map((call) => call[0]).join("\n");
  }

  async function scan(args) {
    await createCli({ console: mockConsole, authService, commentService }).parseAsync(
      ["scan", ...args],
      { from: "user" }
    );
  }

  beforeEach(() => {
    process.exitCode = 0;
    originalGeminiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    mockConsole = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    authService = { getGitLabToken: jest.fn(() => null) };
    commentService = { postMergeRequestComment: jest.fn() };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    process.exitCode = undefined;

    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  test("finds the planted issues in examples/vulnerable.diff without logging in", async () => {
    await scan(["--diff-file", VULNERABLE]);

    const report = output();

    for (const { issueType, fileName, lineNumber } of EXPECTED_FINDINGS) {
      expect(report).toContain(issueType);
      expect(report).toContain(fileName);
      expect(report).toMatch(new RegExp(`Line\\s+: ${lineNumber}`));
    }

    expect(report).toContain("Total Findings   : 3");
    expect(authService.getGitLabToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(mockConsole.warn).toHaveBeenCalledTimes(1);
    expect(process.exitCode).toBe(0);
  });

  test("examples/safe.diff has no findings", async () => {
    await scan(["--diff-file", SAFE]);

    expect(output()).toContain("No security issues found.");
    expect(process.exitCode).toBe(0);
  });

  test("--fail-on high: vulnerable exits 2, safe exits 0", async () => {
    await scan(["--diff-file", VULNERABLE, "--fail-on", "high"]);
    expect(process.exitCode).toBe(2);

    process.exitCode = 0;
    await scan(["--diff-file", SAFE, "--fail-on", "high"]);
    expect(process.exitCode).toBe(0);
  });

  test("--markdown --output writes a report naming the diff file", async () => {
    const outputPath = path.join(tempDir, "report.md");

    await scan(["--diff-file", VULNERABLE, "--markdown", "--output", outputPath]);

    const markdown = fs.readFileSync(outputPath, "utf8");

    expect(markdown).toContain(`Diff file: ${VULNERABLE}`);
    expect(markdown).not.toContain("MR: Unknown");
    expect(markdown).toContain("Total Findings: 3");
  });

  test("CRLF and UTF-16 copies of the diff give the same findings (Windows)", async () => {
    const original = fs.readFileSync(VULNERABLE, "utf8").replace(/\r\n/g, "\n");
    const crlfPath = path.join(tempDir, "crlf.diff");
    const utf16Path = path.join(tempDir, "utf16.diff");

    fs.writeFileSync(crlfPath, original.replace(/\n/g, "\r\n"));
    fs.writeFileSync(
      utf16Path,
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(original.replace(/\n/g, "\r\n"), "utf16le")])
    );

    await scan(["--diff-file", VULNERABLE]);
    const baseline = output();

    for (const filePath of [crlfPath, utf16Path]) {
      mockConsole.log.mockClear();
      await scan(["--diff-file", filePath]);
      expect(output().replace(filePath, VULNERABLE)).toBe(baseline);
    }
  });

  test("--comment is rejected with a clear error", async () => {
    await scan(["--diff-file", VULNERABLE, "--comment"]);

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining("--comment posts to a GitLab merge request, so it cannot be used with --diff-file")
    );
    expect(commentService.postMergeRequestComment).not.toHaveBeenCalled();
    expect(mockConsole.log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("cannot be combined with --mr or --project", async () => {
    await scan(["--diff-file", VULNERABLE, "--mr", "1"]);

    expect(mockConsole.error).toHaveBeenCalledWith(
      "Error: --diff-file cannot be combined with --mr or --project."
    );
    expect(process.exitCode).toBe(1);
  });

  test("a missing file is a clean error", async () => {
    await scan(["--diff-file", path.join(tempDir, "nope.diff")]);

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining("Error: Cannot read diff file")
    );
    expect(process.exitCode).toBe(1);
  });

  test("an invalid --fail-on value is rejected", async () => {
    await scan(["--diff-file", VULNERABLE, "--fail-on", "severe"]);

    expect(mockConsole.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid --fail-on value "severe"')
    );
    expect(process.exitCode).toBe(1);
  });
});
