const { scanForSecrets } = require("../services/secretScannerService");

describe("secretScannerService", () => {
  test("should return empty array when changes are empty", () => {
    const result = scanForSecrets([]);

    expect(result).toEqual([]);
  });

  test("should not crash when changes is undefined", () => {
    const result = scanForSecrets();

    expect(result).toEqual([]);
  });

  test("should detect hardcoded password in added line", () => {
    const changes = [
      {
        new_path: "src/config.js",
        diff: `
+const password = "mySecretPassword123";
 const username = "admin";
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({
      file: "src/config.js",
      riskLevel: "HIGH",
      type: "Hardcoded Password",
    });
  });

  test("should detect API key in added line", () => {
    const changes = [
      {
        new_path: "src/api.js",
        diff: `
+const apiKey = "sk_test_123456789abcdef";
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("API Key");
    expect(result[0].file).toBe("src/api.js");
  });

  test("should detect access token in added line", () => {
    const changes = [
      {
        new_path: "src/auth.js",
        diff: `
+const accessToken = "ghp_abcdefghijklmnopqrstuvwxyz123456";
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("Access Token");
  });

  test("should detect private key content", () => {
    const changes = [
      {
        new_path: "keys/private.pem",
        diff: `
+-----BEGIN PRIVATE KEY-----
+secretkeydatahere
+-----END PRIVATE KEY-----
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("Private Key");
    expect(result[0].riskLevel).toBe("CRITICAL");
  });

  test("should detect database URL", () => {
    const changes = [
      {
        new_path: "src/database.js",
        diff: `
+const dbUrl = "postgres://user:password@localhost:5432/mydb";
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("Database URL");
  });

  test("should detect JWT secret", () => {
    const changes = [
      {
        new_path: "src/jwt.js",
        diff: `
+const jwtSecret = "super_jwt_secret_value";
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].type).toBe("JWT Secret");
  });

  test("should support multiple changed files", () => {
    const changes = [
      {
        new_path: "src/config.js",
        diff: `
+const password = "abc12345";
        `,
      },
      {
        new_path: "src/api.js",
        diff: `
+const apiKey = "sk_live_123456789";
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result.length).toBe(2);
  });

  test("should ignore removed lines to reduce false positives", () => {
    const changes = [
      {
        new_path: "src/oldConfig.js",
        diff: `
-const password = "oldPassword123";
+const username = "admin";
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result).toEqual([]);
  });

  test("should ignore common placeholder values", () => {
    const changes = [
      {
        new_path: "src/example.js",
        diff: `
+const password = "password";
+const apiKey = "your-api-key";
        `,
      },
    ];

    const result = scanForSecrets(changes);

    expect(result).toEqual([]);
  });

  test("should not crash on file without diff", () => {
    const changes = [
      {
        new_path: "src/empty.js",
      },
    ];

    const result = scanForSecrets(changes);

    expect(result).toEqual([]);
  });
});