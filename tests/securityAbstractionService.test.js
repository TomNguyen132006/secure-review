const {
  createAbstractDescription
} = require("../services/securityAbstractionService");

describe("createAbstractDescription", () => {
  test("creates safe abstract description for hardcoded API key", () => {
    const finding = {
      issueType: "Hardcoded API Key",
      riskLevel: "High",
      fileName: "auth.js",
      lineNumber: 12,
      rawCode: 'const apiKey = "sk_live_secret_value";'
    };

    const result = createAbstractDescription(finding);

    expect(result.issueType).toBe("Hardcoded API Key");
    expect(result.riskLevel).toBe("High");
    expect(result.fileName).toBe("auth.js");
    expect(result.lineNumber).toBe(12);

    expect(result.description).toBe(
      "Variable assignment of string literal to credential-named identifier."
    );

    expect(result.geminiSafeSummary).toContain("Issue Type: Hardcoded API Key");
    expect(result.geminiSafeSummary).toContain("Risk Level: High");
    expect(result.geminiSafeSummary).toContain("File: auth.js");
    expect(result.geminiSafeSummary).toContain("Line: 12");

    expect(result.geminiSafeSummary).not.toContain("sk_live_secret_value");
    expect(result.geminiSafeSummary).not.toContain("const apiKey");
  });

  test("creates safe abstract description for SQL injection risk", () => {
    const finding = {
      issueType: "SQL Injection Risk",
      riskLevel: "Critical",
      fileName: "userService.js",
      lineNumber: 30,
      rawCode: 'db.query("SELECT * FROM users WHERE id = " + userInput);'
    };

    const result = createAbstractDescription(finding);

    expect(result.issueType).toBe("SQL Injection Risk");
    expect(result.riskLevel).toBe("Critical");
    expect(result.description).toBe(
      "User-controlled input appears to be directly concatenated into a SQL query."
    );

    expect(result.geminiSafeSummary).not.toContain("SELECT * FROM users");
    expect(result.geminiSafeSummary).not.toContain("userInput");
  });

  test("includes file name and line number if available", () => {
    const finding = {
      issueType: "Hardcoded Password",
      riskLevel: "High",
      fileName: "config.js",
      lineNumber: 8
    };

    const result = createAbstractDescription(finding);

    expect(result.fileName).toBe("config.js");
    expect(result.lineNumber).toBe(8);
    expect(result.geminiSafeSummary).toContain("File: config.js");
    expect(result.geminiSafeSummary).toContain("Line: 8");
  });

  test("handles missing file name and line number safely", () => {
    const finding = {
      issueType: "Hardcoded Token",
      riskLevel: "High"
    };

    const result = createAbstractDescription(finding);

    expect(result.fileName).toBe("Unknown file");
    expect(result.lineNumber).toBe("Unknown line");
    expect(result.geminiSafeSummary).toContain("File: Unknown file");
    expect(result.geminiSafeSummary).toContain("Line: Unknown line");
  });

  test("handles empty finding safely", () => {
    const result = createAbstractDescription();

    expect(result.issueType).toBe("Unknown Security Issue");
    expect(result.riskLevel).toBe("Unknown");
    expect(result.fileName).toBe("Unknown file");
    expect(result.lineNumber).toBe("Unknown line");
    expect(result.description).toBe(
      "A potentially risky security pattern was detected and summarized without raw code."
    );
  });

  test("does not include full raw dangerous code in Gemini safe summary", () => {
    const finding = {
      issueType: "Private Key",
      riskLevel: "Critical",
      fileName: "secret.pem",
      lineNumber: 1,
      rawCode: "-----BEGIN PRIVATE KEY-----"
    };

    const result = createAbstractDescription(finding);

    expect(result.geminiSafeSummary).not.toContain("-----BEGIN PRIVATE KEY-----");
    expect(result.geminiSafeSummary).toContain(
      "Raw risky code was intentionally removed before sending to AI."
    );
  });

  test("should create safe abstract description for weak authentication without raw password", () => {
    const finding = {
      issueType: "Weak Authentication",
      riskLevel: "High",
      explanation:
        "The code directly compares a password to a hardcoded weak default password admin123.",
      suggestedFix:
        "Do not hardcode passwords. Store hashed passwords securely.",
      fileName: "src/auth.js",
      lineNumber: 4,
      rawCode: 'password === "admin123"'
    };

    const result = createAbstractDescription(finding);

    expect(result.issueType).toBe("Weak Authentication");
    expect(result.riskLevel).toBe("High");
    expect(result.fileName).toBe("src/auth.js");
    expect(result.lineNumber).toBe(4);

    expect(result.description).toBe(
      "Authentication logic compares a password variable directly against a hardcoded weak or default password value."
    );

    expect(result.geminiSafeSummary).toContain("Issue Type: Weak Authentication");
    expect(result.geminiSafeSummary).toContain("Risk Level: High");
    expect(result.geminiSafeSummary).toContain("File: src/auth.js");
    expect(result.geminiSafeSummary).toContain("Line: 4");

    expect(result.geminiSafeSummary).not.toContain("admin123");
    expect(result.geminiSafeSummary).not.toContain('password === "admin123"');
  });

  test("should handle weak authentication finding without file name or line number", () => {
    const finding = {
      issueType: "Weak Authentication",
      riskLevel: "High",
      rawCode: 'password.equals("welcome")'
    };

    const result = createAbstractDescription(finding);

    expect(result.issueType).toBe("Weak Authentication");
    expect(result.riskLevel).toBe("High");
    expect(result.fileName).toBe("Unknown file");
    expect(result.lineNumber).toBe("Unknown line");

    expect(result.description).toBe(
      "Authentication logic compares a password variable directly against a hardcoded weak or default password value."
    );

    expect(result.geminiSafeSummary).toContain("Issue Type: Weak Authentication");
    expect(result.geminiSafeSummary).toContain("Risk Level: High");
    expect(result.geminiSafeSummary).toContain("File: Unknown file");
    expect(result.geminiSafeSummary).toContain("Line: Unknown line");

    expect(result.geminiSafeSummary).not.toContain("welcome");
    expect(result.geminiSafeSummary).not.toContain('password.equals("welcome")');
  });

  /*
Test case for story 9 - task 9.3
*/
  test("should create safe summary for missing authorization finding", () => {
    const finding = {
      issueType: "Missing Authorization Check",
      riskLevel: "High",
      fileName: "routes/admin.js",
      lineNumber: 12,
      explanation:
        "An admin route appears to be exposed without checking whether the user has an admin role.",
      suggestedFix:
        "Add role-based authorization middleware such as requireAdmin or checkRole('admin').",
      rawCode: 'app.get("/admin", (req, res) => { res.send("admin panel"); });'
    };

    const result = createAbstractDescription(finding);

    expect(result.issueType).toBe("Missing Authorization Check");
    expect(result.riskLevel).toBe("High");
    expect(result.fileName).toBe("routes/admin.js");
    expect(result.lineNumber).toBe(12);

    expect(result.description).toBe(
      "Admin route appears to be defined without role-based authorization middleware."
    );

    expect(result.geminiSafeSummary).toContain(
      "Issue Type: Missing Authorization Check"
    );
    expect(result.geminiSafeSummary).toContain("Risk Level: High");
    expect(result.geminiSafeSummary).toContain("File: routes/admin.js");
    expect(result.geminiSafeSummary).toContain("Line: 12");
    expect(result.geminiSafeSummary).toContain(
      "Safe Description: Admin route appears to be defined without role-based authorization middleware."
    );

    expect(result.geminiSafeSummary).not.toContain('app.get("/admin"');
    expect(result.geminiSafeSummary).not.toContain("router.post");
    expect(result.geminiSafeSummary).not.toContain("deleteUser");
  });
});