const { createSecurityReport } = require("../services/securityReportService");

describe("securityReportService", () => {
  test("creates a report with local scanner findings", () => {
    const results = [
      {
        issueType: "Hardcoded Password",
        riskLevel: "High",
        fileName: "config.js",
        lineNumber: 8,
        explanation: "A password appears to be hardcoded.",
        suggestedFix: "Move the password into an environment variable.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Security Scan Report");
    expect(report).toContain("Hardcoded Password");
    expect(report).toContain("High");
    expect(report).toContain("config.js");
    expect(report).toContain("8");
    expect(report).toContain("A password appears to be hardcoded.");
    expect(report).toContain("Move the password into an environment variable.");
    expect(report).toContain("local");
  });

  test("creates a report with Gemini explanations", () => {
    const results = [
      {
        issueType: "SQL Injection Risk",
        riskLevel: "Critical",
        fileName: "db.js",
        lineNumber: 21,
        explanation:
          "Gemini explanation: User input may affect a database query.",
        suggestedFix: "Use parameterized queries.",
        source: "gemini",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("SQL Injection Risk");
    expect(report).toContain("Critical");
    expect(report).toContain("Gemini explanation");
    expect(report).toContain("Use parameterized queries.");
    expect(report).toContain("gemini");
  });

  test("creates a report with fallback findings when Gemini is unavailable", () => {
    const results = [
      {
        issueType: "Private Key Exposure",
        riskLevel: "Critical",
        fileName: "keys.js",
        explanation: "A private key pattern was detected.",
        suggestedFix: "Remove the key and rotate it immediately.",
        source: "local-fallback",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Private Key Exposure");
    expect(report).toContain("Critical");
    expect(report).toContain("keys.js");
    expect(report).toContain("Line       : Not provided");
    expect(report).toContain("local-fallback");
  });

  test("returns clean message when there are no findings", () => {
    const report = createSecurityReport([]);

    expect(report).toContain("No security issues found");
  });

  test("handles invalid input safely", () => {
    const report = createSecurityReport(null);

    expect(report).toContain("No security issues found");
  });

  test("clearly marks high-risk issues", () => {
    const results = [
      {
        issueType: "AWS Access Key Exposure",
        riskLevel: "High",
        explanation: "An AWS access key pattern was detected.",
        suggestedFix: "Remove the key and rotate it.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("HIGH RISK");
  });
    test("includes weak authentication findings in the final report", () => {
    const results = [
      {
        issueType: "Weak Authentication",
        riskLevel: "High",
        fileName: "login.js",
        lineNumber: 12,
        explanation: "Authentication logic uses a hardcoded weak password.",
        suggestedFix: "Use secure password hashing and never hardcode passwords.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Security Scan Report");
    expect(report).toContain("Weak Authentication");
    expect(report).toContain("High");
    expect(report).toContain("login.js");
    expect(report).toContain("12");
    expect(report).toContain("Authentication logic uses a hardcoded weak password.");
    expect(report).toContain("Use secure password hashing and never hardcode passwords.");
    expect(report).toContain("local");
  });

  test("report still works when only local weak authentication finding exists", () => {
    const results = [
      {
        issueType: "Weak Authentication",
        riskLevel: "High",
        fileName: "auth.js",
        lineNumber: 5,
        explanation: "Password is compared directly against a weak default value.",
        suggestedFix: "Use hashed passwords and secure authentication checks.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Total Findings   : 1");
    expect(report).toContain("High-Risk Issues : 1");
    expect(report).toContain("Weak Authentication");
    expect(report).toContain("auth.js");
  });

  test("report does not break when Gemini is unavailable and local weak authentication finding is returned", () => {
    const results = [
      {
        issueType: "Weak Authentication",
        riskLevel: "High",
        fileName: "adminLogin.js",
        lineNumber: 8,
        explanation: "Hardcoded admin credential logic was detected.",
        suggestedFix: "Remove hardcoded admin credentials and use secure user management.",
        source: "local-fallback",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Weak Authentication");
    expect(report).toContain("adminLogin.js");
    expect(report).toContain("Hardcoded admin credential logic was detected.");
    expect(report).toContain("local-fallback");
  });

  test("weak authentication report includes required fields even when some values are missing", () => {
    const results = [
      {
        issueType: "Weak Authentication",
        riskLevel: "High",
        explanation: "Weak authentication logic was detected.",
        suggestedFix: "Use secure authentication logic.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Issue Type : Weak Authentication");
    expect(report).toContain("Risk Level : High");
    expect(report).toContain("File       : Not provided");
    expect(report).toContain("Line       : Not provided");
    expect(report).toContain("Explanation:");
    expect(report).toContain("Weak authentication logic was detected.");
    expect(report).toContain("Suggested Fix:");
    expect(report).toContain("Use secure authentication logic.");
  });
    test("includes missing validation findings in the final report", () => {
    const results = [
      {
        issueType: "Missing Validation",
        riskLevel: "Medium",
        fileName: "UserController.java",
        lineNumber: 8,
        explanation: "Endpoint accepts user input without validation.",
        suggestedFix:
          "Use @Valid or @Validated with request body objects and define validation rules on the model.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Security Scan Report");
    expect(report).toContain("Missing Validation");
    expect(report).toContain("Medium");
    expect(report).toContain("UserController.java");
    expect(report).toContain("8");
    expect(report).toContain("Endpoint accepts user input without validation.");
    expect(report).toContain(
      "Use @Valid or @Validated with request body objects and define validation rules on the model."
    );
    expect(report).toContain("local");
  });

  test("report still works when only local missing validation finding exists", () => {
    const results = [
      {
        issueType: "Missing Validation",
        riskLevel: "Medium",
        fileName: "UserController.java",
        lineNumber: 8,
        explanation: "Endpoint accepts user input without validation.",
        suggestedFix:
          "Use @Valid or @Validated with request body objects and define validation rules on the model.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Total Findings   : 1");
    expect(report).toContain("Missing Validation");
    expect(report).toContain("UserController.java");
    expect(report).toContain("Endpoint accepts user input without validation.");
  });

  test("report does not break when Gemini is unavailable and local missing validation finding is returned", () => {
    const results = [
      {
        issueType: "Missing Validation",
        riskLevel: "Medium",
        fileName: "UserController.java",
        lineNumber: 8,
        explanation: "Endpoint accepts user input without validation.",
        suggestedFix:
          "Use @Valid or @Validated with request body objects and define validation rules on the model.",
        source: "local-fallback",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Missing Validation");
    expect(report).toContain("UserController.java");
    expect(report).toContain("local-fallback");
  });

  test("missing validation report includes required fields even when some values are missing", () => {
    const results = [
      {
        issueType: "Missing Validation",
        riskLevel: "Medium",
        explanation: "Endpoint accepts user input without validation.",
        suggestedFix:
          "Use @Valid or @Validated with request body objects and define validation rules on the model.",
        source: "local",
      },
    ];

    const report = createSecurityReport(results);

    expect(report).toContain("Issue Type : Missing Validation");
    expect(report).toContain("Risk Level : Medium");
    expect(report).toContain("File       : Not provided");
    expect(report).toContain("Line       : Not provided");
    expect(report).toContain("Explanation:");
    expect(report).toContain("Endpoint accepts user input without validation.");
    expect(report).toContain("Suggested Fix:");
    expect(report).toContain(
      "Use @Valid or @Validated with request body objects and define validation rules on the model."
    );
  });
});