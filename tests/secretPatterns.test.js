const { secretPatterns } = require("../security/secretPatterns");

describe("secretPatterns", () => {
  test("should include API key pattern", () => {
    const line = `const api_key = "abc123secretvalue";`;

    const matchedPattern = secretPatterns.find((pattern) =>
      pattern.regex.test(line)
    );

    expect(matchedPattern).toBeDefined();
    expect(matchedPattern.type).toBe("API Key");
    expect(matchedPattern.riskLevel).toBe("HIGH");
  });

  test("should include password pattern", () => {
    const line = `const password = "myPassword123";`;

    const matchedPattern = secretPatterns.find((pattern) =>
      pattern.regex.test(line)
    );

    expect(matchedPattern).toBeDefined();
    expect(matchedPattern.type).toBe("Hardcoded Password");
    expect(matchedPattern.riskLevel).toBe("HIGH");
  });

  test("should include token pattern", () => {
    const line = `const token = "abc123tokenvalue";`;

    const matchedPattern = secretPatterns.find((pattern) =>
      pattern.regex.test(line)
    );

    expect(matchedPattern).toBeDefined();
    expect(matchedPattern.type).toBe("Access Token");
    expect(matchedPattern.riskLevel).toBe("HIGH");
  });

  test("should include AWS access key pattern", () => {
    const line = `const awsKey = "AKIA1234567890ABCDEF";`;

    const matchedPattern = secretPatterns.find((pattern) =>
      pattern.regex.test(line)
    );

    expect(matchedPattern).toBeDefined();
    expect(matchedPattern.type).toBe("AWS Access Key");
    expect(matchedPattern.riskLevel).toBe("CRITICAL");
  });

  test("should include private key pattern", () => {
    const line = `-----BEGIN PRIVATE KEY-----`;

    const matchedPattern = secretPatterns.find((pattern) =>
      pattern.regex.test(line)
    );

    expect(matchedPattern).toBeDefined();
    expect(matchedPattern.type).toBe("Private Key");
    expect(matchedPattern.riskLevel).toBe("CRITICAL");
  });

  test("each pattern should include explanation and suggested fix", () => {
    secretPatterns.forEach((pattern) => {
      expect(pattern.type).toBeDefined();
      expect(pattern.riskLevel).toBeDefined();
      expect(pattern.explanation).toBeDefined();
      expect(pattern.suggestedFix).toBeDefined();
    });
  });
});