const { analyzeSecurityFinding } = require("../services/geminiAnalysisService");

jest.mock("../services/securityAbstractionService", () => ({
  createAbstractDescription: jest.fn(() => ({
    issueType: "Hardcoded API Key",
    riskLevel: "High",
    fileName: "app.js",
    lineNumber: 12,
    description:
      "Variable assignment of string literal to credential-named identifier.",
  })),
}));

describe("geminiAnalysisService", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = "fake-test-key";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  test("returns Gemini explanation when Gemini succeeds", async () => {
    const localFinding = {
      issueType: "Hardcoded API Key",
      riskLevel: "High",
      explanation: "A secret appears to be hardcoded.",
      suggestedFix: "Move the secret into an environment variable.",
      fileName: "app.js",
      lineNumber: 12,
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "Gemini explanation: Store secrets outside source code.",
                },
              ],
            },
          },
        ],
      }),
    });

    const result = await analyzeSecurityFinding(localFinding);

    expect(result.issueType).toBe("Hardcoded API Key");
    expect(result.riskLevel).toBe("High");
    expect(result.explanation).toContain("Gemini explanation");
    expect(result.suggestedFix).toBe(localFinding.suggestedFix);
    expect(result.source).toBe("gemini");
  });

  test("returns local finding when Gemini blocks or returns an error", async () => {
    const localFinding = {
      issueType: "SQL Injection Risk",
      riskLevel: "High",
      explanation: "User input may affect a database query.",
      suggestedFix: "Use parameterized queries.",
      fileName: "db.js",
      lineNumber: 20,
    };

    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: "Content blocked",
        },
      }),
    });

    const result = await analyzeSecurityFinding(localFinding);

    expect(result.issueType).toBe("SQL Injection Risk");
    expect(result.riskLevel).toBe("High");
    expect(result.explanation).toBe(localFinding.explanation);
    expect(result.suggestedFix).toBe(localFinding.suggestedFix);
    expect(result.source).toBe("local-fallback");
  });

  test("returns local finding when Gemini API fails", async () => {
    const localFinding = {
      issueType: "Hardcoded Password",
      riskLevel: "High",
      explanation: "A password appears to be hardcoded.",
      suggestedFix: "Use a secure secret manager.",
    };

    global.fetch.mockRejectedValue(new Error("Network failure"));

    const result = await analyzeSecurityFinding(localFinding);

    expect(result.issueType).toBe("Hardcoded Password");
    expect(result.riskLevel).toBe("High");
    expect(result.explanation).toBe(localFinding.explanation);
    expect(result.suggestedFix).toBe(localFinding.suggestedFix);
    expect(result.source).toBe("local-fallback");
  });

  test("returns local finding when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const localFinding = {
      issueType: "Private Key Exposure",
      riskLevel: "Critical",
      explanation: "A private key pattern was detected.",
      suggestedFix: "Remove the key and rotate it immediately.",
    };

    const result = await analyzeSecurityFinding(localFinding);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.issueType).toBe("Private Key Exposure");
    expect(result.riskLevel).toBe("Critical");
    expect(result.explanation).toBe(localFinding.explanation);
    expect(result.suggestedFix).toBe(localFinding.suggestedFix);
    expect(result.source).toBe("local-fallback");
  });
});