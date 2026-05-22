const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("secure-review CLI", () => {
  let tempHome;
  let configPath;
  let testEnv;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
    configPath = path.join(tempHome, ".secure-review", "config.json");

    testEnv = {
      ...process.env,
      SECURE_REVIEW_CONFIG_PATH: configPath,
    };
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  test("should show help", () => {
    const output = execSync("node bin/secure-review.js --help", {
      env: testEnv,
    }).toString();

    expect(output).toContain("Usage");
    expect(output).toContain("scan");
    expect(output).toContain("login");
    expect(output).toContain("logout");
  });

  test("should recognize login command", () => {
    const output = execSync("node bin/secure-review.js login --help", {
      env: testEnv,
    }).toString();

    expect(output).toContain("Usage");
    expect(output).toContain("login");
    expect(output).toContain("--token");
  });

  test("should login when token is provided", () => {
    const output = execSync(
      "node bin/secure-review.js login --token glpat_xxxxx",
      { env: testEnv }
    ).toString();

    expect(output).toContain("Login successful");
  });

  test("should store token locally", () => {
    execSync("node bin/secure-review.js login --token glpat_testtoken123", {
      env: testEnv,
    });

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(config.gitlabToken).toBe("glpat_testtoken123");
    expect(config.loginTime).toBeDefined();
  });

  test("should fail when token is missing", () => {
    expect(() => {
      execSync("node bin/secure-review.js login", {
        stdio: "pipe",
        env: testEnv,
      });
    }).toThrow();
  });

  test("should fail when token format is invalid", () => {
    expect(() => {
      execSync("node bin/secure-review.js login --token wrong_token", {
        stdio: "pipe",
        env: testEnv,
      });
    }).toThrow();
  });

  test("should scan merge request when logged in and --mr is provided", () => {
    execSync("node bin/secure-review.js login --token glpat_xxxxx", {
      env: testEnv,
    });

    const output = execSync("node bin/secure-review.js scan --mr 123", {
      env: testEnv,
    }).toString();

    expect(output).toContain("Using saved GitLab authentication");
    expect(output).toContain("Scanning merge request 123");
  });

  test("should fail scan when not logged in", () => {
    expect(() => {
      execSync("node bin/secure-review.js scan --mr 123", {
        stdio: "pipe",
        env: testEnv,
      });
    }).toThrow();
  });

  test("should fail when --mr is missing", () => {
    expect(() => {
      execSync("node bin/secure-review.js scan", {
        stdio: "pipe",
        env: testEnv,
      });
    }).toThrow();
  });

  test("should logout successfully", () => {
    execSync("node bin/secure-review.js login --token glpat_xxxxx", {
      env: testEnv,
    });

    const output = execSync("node bin/secure-review.js logout", {
      env: testEnv,
    }).toString();

    expect(output).toContain("Logged out successfully");
  });
});