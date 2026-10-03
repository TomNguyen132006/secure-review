const {
  analyzeSecurityFinding,
  analyzeSecurityFindingWithStatus,
  analyzeDiffWithGemini,
  DEFAULT_MODEL,
} = require("../services/geminiAnalysisService");

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

    // Assigning undefined to process.env stores the string "undefined".
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
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
  test("analyzeDiffWithGemini sends diff to Gemini successfully", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    riskLevel: "High",
                    issueType: "Hardcoded Password",
                    explanation: "A password appears to be hardcoded in the code.",
                    suggestedFix: "Move the password to an environment variable or secret manager.",
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const diff = `
diff --git a/app.js b/app.js
+ const password = "123456";
`;

    const result = await analyzeDiffWithGemini(diff);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.source).toBe("gemini");
    expect(result.riskLevel).toBe("High");
    expect(result.issueType).toBe("Hardcoded Password");
    expect(result.explanation).toBe(
      "A password appears to be hardcoded in the code."
    );
    expect(result.suggestedFix).toBe(
      "Move the password to an environment variable or secret manager."
    );
  });

  test("analyzeDiffWithGemini returns error when diff is empty", async () => {
    const result = await analyzeDiffWithGemini("");

    expect(result.success).toBe(false);
    expect(result.source).toBe("gemini");
    expect(result.error).toBe("No diff provided for Gemini analysis");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("analyzeDiffWithGemini handles Gemini timeout safely", async () => {
    global.fetch.mockImplementation(() => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";

      return Promise.reject(error);
    });

    const result = await analyzeDiffWithGemini("diff --git a/app.js b/app.js");

    expect(result.success).toBe(false);
    expect(result.source).toBe("gemini");
    expect(result.error).toBe("Gemini request timed out");
  });

  test("analyzeDiffWithGemini handles Gemini API failure safely", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await analyzeDiffWithGemini("diff --git a/app.js b/app.js");

    expect(result.success).toBe(false);
    expect(result.source).toBe("gemini");
    expect(result.error).toBe("Gemini server error");
  });

  test("analyzeDiffWithGemini does not crash when Gemini response is invalid", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [],
      }),
    });

    const result = await analyzeDiffWithGemini("diff --git a/app.js b/app.js");

    expect(result.success).toBe(false);
    expect(result.source).toBe("gemini");
    expect(result.error).toBe("Invalid Gemini response format.");
  });
  test("analyzeDiffWithGemini returns structured parsed Gemini response", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    riskLevel: "High",
                    issueType: "SQL Injection",
                    explanation:
                      "User input appears to be directly used in a SQL query.",
                    suggestedFix:
                      "Use parameterized queries or prepared statements.",
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const result = await analyzeDiffWithGemini("diff --git a/app.js b/app.js");

    expect(result.success).toBe(true);
    expect(result.source).toBe("gemini");
    expect(result.riskLevel).toBe("High");
    expect(result.issueType).toBe("SQL Injection");
    expect(result.explanation).toBe(
      "User input appears to be directly used in a SQL query."
    );
    expect(result.suggestedFix).toBe(
      "Use parameterized queries or prepared statements."
    );
  });

  test("analyzeDiffWithGemini returns error when Gemini response is invalid", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "This is normal text, not JSON.",
                },
              ],
            },
          },
        ],
      }),
    });

    const result = await analyzeDiffWithGemini("diff --git a/app.js b/app.js");

    expect(result.success).toBe(false);
    expect(result.source).toBe("gemini");
    expect(result.error).toBe("Invalid Gemini response format.");
  });
  test("analyzeDiffWithGemini returns safe error when Gemini JSON is missing required fields", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    riskLevel: "High",
                    issueType: "SQL Injection",
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const result = await analyzeDiffWithGemini("diff --git a/app.js b/app.js");

    expect(result.success).toBe(false);
    expect(result.source).toBe("gemini");
    expect(result.error).toBe("Invalid Gemini response format.");
  });
});

describe("Gemini request safety and skip reasons", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  const FAKE_KEY = "fake-test-key-do-not-log";

  const finding = {
    issueType: "Hardcoded Password",
    riskLevel: "High",
    explanation: "A password appears to be hardcoded.",
    suggestedFix: "Use a secret manager.",
  };

  const okResponse = {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: "AI explanation" }] } }],
    }),
  };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = FAKE_KEY;
    delete process.env.GEMINI_MODEL;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;

    for (const [name, value] of [
      ["GEMINI_API_KEY", originalApiKey],
      ["GEMINI_MODEL", originalModel],
    ]) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  test("default model is a current stable Flash model, not the retired gemini-1.5-flash", () => {
    expect(DEFAULT_MODEL).toBe("gemini-3.8-flash");
  });

  test("sends the API key in the x-goog-api-key header, never in the URL", async () => {
    global.fetch.mockResolvedValue(okResponse);

    await analyzeSecurityFinding(finding);

    const [url, request] = global.fetch.mock.calls[0];

    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    );
    expect(url).not.toContain(FAKE_KEY);
    expect(url).not.toContain("key=");
    expect(request.headers["x-goog-api-key"]).toBe(FAKE_KEY);
  });

  test("analyzeDiffWithGemini also sends the key only in the header", async () => {
    global.fetch.mockResolvedValue(okResponse);

    await analyzeDiffWithGemini("+ const a = 1;");

    const [url, request] = global.fetch.mock.calls[0];

    expect(url).not.toContain(FAKE_KEY);
    expect(url).not.toContain("key=");
    expect(request.headers["x-goog-api-key"]).toBe(FAKE_KEY);
  });

  test("GEMINI_MODEL overrides the default model", async () => {
    process.env.GEMINI_MODEL = "gemini-3.6-flash";
    global.fetch.mockResolvedValue(okResponse);

    await analyzeSecurityFinding(finding);

    expect(global.fetch.mock.calls[0][0]).toContain("/models/gemini-3.6-flash:generateContent");
  });

  test("reports why AI analysis was skipped when the key is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await analyzeSecurityFindingWithStatus(finding);

    expect(result.skippedReason).toBe("GEMINI_API_KEY is not set");
    expect(result.finding.source).toBe("local-fallback");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test.each([
    [404, 'model "gemini-3.8-flash" was not found (HTTP 404); set GEMINI_MODEL'],
    [403, "API key was rejected (HTTP 403)"],
    [429, "rate limit or quota exceeded (HTTP 429)"],
    [503, "server error (HTTP 503)"],
  ])("explains HTTP %i without leaking the key", async (status, expected) => {
    global.fetch.mockResolvedValue({ ok: false, status, json: async () => ({}) });

    const result = await analyzeSecurityFindingWithStatus(finding);

    expect(result.skippedReason).toContain(expected);
    expect(result.skippedReason).not.toContain(FAKE_KEY);
    expect(result.finding.source).toBe("local-fallback");
  });

  test("explains network errors and bad responses without leaking the key", async () => {
    global.fetch.mockRejectedValue(new Error(`request to ...?key=${FAKE_KEY} failed`));
    const network = await analyzeSecurityFindingWithStatus(finding);

    expect(network.skippedReason).toBe("could not reach the Gemini API (network error)");

    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) });
    const badFormat = await analyzeSecurityFindingWithStatus(finding);

    expect(badFormat.skippedReason).toBe("Gemini returned an unexpected response format");

    for (const reason of [network.skippedReason, badFormat.skippedReason]) {
      expect(reason).not.toContain(FAKE_KEY);
    }
  });

  test("returns no skip reason when Gemini succeeds", async () => {
    global.fetch.mockResolvedValue(okResponse);

    const result = await analyzeSecurityFindingWithStatus(finding);

    expect(result.skippedReason).toBeNull();
    expect(result.finding.source).toBe("gemini");
    expect(result.finding.explanation).toBe("AI explanation");
  });
});
