const {
  createSecurityReport,
  formatFinding,
  formatValue,
  isHighRisk,
} = require("../services/securityReportService");

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

  /*
Test case for Task 9.4
*/
  test("should include missing authorization check finding in final report", () => {
    const findings = [
      {
        issueType: "Missing Authorization Check",
        riskLevel: "High",
        fileName: "routes/admin.js",
        lineNumber: 12,
        explanation:
          "An admin route appears to be exposed without checking whether the user has an admin role.",
        suggestedFix:
          'Add role-based authorization middleware such as requireAdmin or checkRole("admin").',
        source: "local",
      },
    ];

    const report = createSecurityReport(findings);

    expect(report).toContain("Security Scan Report");
    expect(report).toContain("Total Findings   : 1");
    expect(report).toContain("High-Risk Issues : 1");

    expect(report).toContain("Issue Type : Missing Authorization Check");
    expect(report).toContain("Risk Level : High");
    expect(report).toContain("File       : routes/admin.js");
    expect(report).toContain("Line       : 12");
    expect(report).toContain("Source     : local");

    expect(report).toContain("Explanation:");
    expect(report).toContain(
      "An admin route appears to be exposed without checking whether the user has an admin role."
    );

    expect(report).toContain("Suggested Fix:");
    expect(report).toContain(
      'Add role-based authorization middleware such as requireAdmin or checkRole("admin").'
    );
  });
  /*
  Story 12 - Task 12.3
  Test that each finding is formatted clearly in the terminal report.
*/
  test("should format each security finding clearly", () => {
    const findings = [
      {
        issueType: "Missing Authorization Check",
        riskLevel: "High",
        fileName: "routes/admin.js",
        lineNumber: 12,
        explanation:
          "An admin route appears to be exposed without checking whether the user has an admin role.",
        suggestedFix:
          "Add role-based authorization middleware such as requireAdmin or checkRole('admin').",
        source: "local",
      },
    ];

    const report = createSecurityReport(findings);

    expect(report).toContain("Issue Type : Missing Authorization Check");
    expect(report).toContain("Risk Level : High");
    expect(report).toContain("File       : routes/admin.js");
    expect(report).toContain("Line       : 12");
    expect(report).toContain("Source     : local");

    expect(report).toContain("Explanation:");
    expect(report).toContain(
      "An admin route appears to be exposed without checking whether the user has an admin role."
    );

    expect(report).toContain("Suggested Fix:");
    expect(report).toContain(
      "Add role-based authorization middleware such as requireAdmin or checkRole('admin')."
    );
  });

  /*
  Story 12 - Task 12.4
  Test that the terminal report shows a clean message when no findings exist.
*/
  test("should show clean no-issues message when no findings exist", () => {
    const report = createSecurityReport([]);

    expect(report).toContain("Security Scan Report");
    expect(report).toContain("No security issues found.");
    expect(report).toContain("End of Report");
  });
  /*
  Story 12 - Task 12.6
  Test report service helper functions separately from the CLI.
*/
  test("formatValue should return fallback when value is missing", () => {
    expect(formatValue(undefined)).toBe("Not provided");
    expect(formatValue(null)).toBe("Not provided");
    expect(formatValue("")).toBe("Not provided");
  });

  test("formatValue should return original value when value exists", () => {
    expect(formatValue("config.js")).toBe("config.js");
    expect(formatValue(12)).toBe(12);
  });

  test("isHighRisk should detect high and critical risk levels", () => {
    expect(isHighRisk("High")).toBe(true);
    expect(isHighRisk("Critical")).toBe(true);
  });

  test("isHighRisk should return false for lower risk levels", () => {
    expect(isHighRisk("Medium")).toBe(false);
    expect(isHighRisk("Low")).toBe(false);
    expect(isHighRisk("Unknown")).toBe(false);
  });

  test("formatFinding should format a single finding clearly", () => {
    const finding = {
      issueType: "Hardcoded Password",
      riskLevel: "High",
      fileName: "config.js",
      lineNumber: 8,
      explanation: "A password appears to be hardcoded.",
      suggestedFix: "Move the password into an environment variable.",
      source: "local",
    };

    const formattedFinding = formatFinding(finding, 0);

    expect(formattedFinding).toContain("Finding #1");
    expect(formattedFinding).toContain("!!! HIGH RISK !!!");
    expect(formattedFinding).toContain("Issue Type : Hardcoded Password");
    expect(formattedFinding).toContain("Risk Level : High");
    expect(formattedFinding).toContain("File       : config.js");
    expect(formattedFinding).toContain("Line       : 8");
    expect(formattedFinding).toContain("Source     : local");
    expect(formattedFinding).toContain("Explanation:");
    expect(formattedFinding).toContain("A password appears to be hardcoded.");
    expect(formattedFinding).toContain("Suggested Fix:");
    expect(formattedFinding).toContain("Move the password into an environment variable.");
  });
});