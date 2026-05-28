const { scanMergeRequestDiff } = require("../security/secretScanner");

describe("scanMergeRequestDiff", () => {
  test("detects API key in merge request diff", () => {
    const mrDiff = {
      changes: [
        {
          new_path: "src/AuthService.java",
          diff: `
@@ -1,3 +1,4 @@
 public class AuthService {
+  String api_key = "abc123";
 }
          `,
        },
      ],
    };

    const result = scanMergeRequestDiff(mrDiff);

    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].file).toBe("src/AuthService.java");
    expect(result.issues[0].issueType).toBe("Hardcoded API Key");
    expect(result.issues[0].riskLevel).toBe("HIGH");
  });

  test("supports multiple files", () => {
    const mrDiff = {
      changes: [
        {
          new_path: "src/AuthService.java",
          diff: `
@@ -1,3 +1,4 @@
+String api_key = "abc123";
          `,
        },
        {
          new_path: "src/UserService.java",
          diff: `
@@ -1,3 +1,4 @@
+String password = "mypassword";
          `,
        },
      ],
    };

    const result = scanMergeRequestDiff(mrDiff);

    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].file).toBe("src/AuthService.java");
    expect(result.issues[1].file).toBe("src/UserService.java");
  });

  test("supports multiple secrets in one file", () => {
    const mrDiff = {
      changes: [
        {
          new_path: "src/AuthService.java",
          diff: `
@@ -1,5 +1,6 @@
+String api_key = "abc123";
+String token = "secret-token";
          `,
        },
      ],
    };

    const result = scanMergeRequestDiff(mrDiff);

    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].issueType).toBe("Hardcoded API Key");
    expect(result.issues[1].issueType).toBe("Hardcoded Token");
  });

  test("includes file name and risk level", () => {
    const mrDiff = {
      changes: [
        {
          new_path: "src/AuthService.java",
          diff: `
@@ -1,3 +1,4 @@
+String token = "abc123";
          `,
        },
      ],
    };

    const result = scanMergeRequestDiff(mrDiff);

    expect(result.issues[0]).toHaveProperty("file");
    expect(result.issues[0]).toHaveProperty("riskLevel");
  });

  test("returns empty issues when no secrets are found", () => {
    const mrDiff = {
      changes: [
        {
          new_path: "src/App.java",
          diff: `
@@ -1,3 +1,4 @@
+System.out.println("Hello world");
          `,
        },
      ],
    };

    const result = scanMergeRequestDiff(mrDiff);

    expect(result.success).toBe(true);
    expect(result.issues).toEqual([]);
  });
});