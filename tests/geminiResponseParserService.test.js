const {
  parseGeminiResponse,
} = require("../services/geminiResponseParserService");

describe("geminiResponseParserService", () => {
  test("should parse valid Gemini JSON response", () => {
    const responseText = JSON.stringify({
      riskLevel: "High",
      issueType: "SQL Injection",
      explanation: "User input appears to be directly used in a SQL query.",
      suggestedFix: "Use parameterized queries or prepared statements.",
    });

    const result = parseGeminiResponse(responseText);

    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe("High");
    expect(result.issueType).toBe("SQL Injection");
    expect(result.explanation).toBe(
      "User input appears to be directly used in a SQL query."
    );
    expect(result.suggestedFix).toBe(
      "Use parameterized queries or prepared statements."
    );
  });

  test("should return error when response is empty", () => {
    const result = parseGeminiResponse("");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid Gemini response format.");
  });

  test("should return error when response is invalid JSON", () => {
    const responseText = "{ riskLevel: High, issueType: SQL Injection }";

    const result = parseGeminiResponse(responseText);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid Gemini response format.");
  });

  test("should return error when required fields are missing", () => {
    const responseText = JSON.stringify({
      riskLevel: "High",
      issueType: "SQL Injection",
    });

    const result = parseGeminiResponse(responseText);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid Gemini response format.");
  });

  test("should ignore extra Gemini fields safely", () => {
    const responseText = JSON.stringify({
      riskLevel: "High",
      issueType: "Hardcoded API Key",
      explanation: "A credential appears to be hardcoded in the code.",
      suggestedFix: "Move the credential to an environment variable or secret manager.",
      confidenceScore: 0.95,
      extraNotes: "This is extra Gemini data.",
    });

    const result = parseGeminiResponse(responseText);

    expect(result.success).toBe(true);
    expect(result.riskLevel).toBe("High");
    expect(result.issueType).toBe("Hardcoded API Key");
    expect(result.explanation).toBe(
      "A credential appears to be hardcoded in the code."
    );
    expect(result.suggestedFix).toBe(
      "Move the credential to an environment variable or secret manager."
    );

    expect(result.confidenceScore).toBeUndefined();
    expect(result.extraNotes).toBeUndefined();
  });
});