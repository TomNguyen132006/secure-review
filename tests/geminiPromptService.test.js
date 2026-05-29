const {
  createSecurityAuditPrompt,
} = require("../services/geminiPromptService");

describe("createSecurityAuditPrompt", () => {
  test("creates a professional security audit prompt", () => {
    const diffChunk = `
      const query = "SELECT * FROM users WHERE id = " + userId;
    `;

    const prompt = createSecurityAuditPrompt(diffChunk);

    expect(prompt).toContain("formal security audit");
    expect(prompt).toContain("GitLab merge request");
    expect(prompt).toContain("OWASP Top 10");
  });

  test("asks Gemini to identify vulnerabilities", () => {
    const diffChunk = `
      const password = "admin123";
    `;

    const prompt = createSecurityAuditPrompt(diffChunk);

    expect(prompt).toContain("Identify potential security vulnerabilities");
  });

  test("asks Gemini to suggest remediations", () => {
    const diffChunk = `
      const token = "abc123";
    `;

    const prompt = createSecurityAuditPrompt(diffChunk);

    expect(prompt).toContain("Suggest safe remediation steps");
  });

  test("separates code using clear start and end markers", () => {
    const diffChunk = `
      const apiKey = "secret-key";
    `;

    const prompt = createSecurityAuditPrompt(diffChunk);

    expect(prompt).toContain("[CODE DIFF START]");
    expect(prompt).toContain("[CODE DIFF END]");
  });

  test("includes the provided diff chunk inside the prompt", () => {
    const diffChunk = `
      const query = "SELECT * FROM users WHERE id = " + userId;
    `;

    const prompt = createSecurityAuditPrompt(diffChunk);

    expect(prompt).toContain(diffChunk.trim());
  });

  test("handles empty input safely", () => {
    const prompt = createSecurityAuditPrompt("");

    expect(prompt).toContain("No code diff content was provided");
    expect(prompt).toContain("[CODE DIFF START]");
    expect(prompt).toContain("[CODE DIFF END]");
  });
});