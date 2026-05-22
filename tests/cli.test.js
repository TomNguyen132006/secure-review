const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");


describe("secure-review CLI", () => {
  test("should show help", () => {
    const output = execSync("node bin/secure-review.js --help").toString();
    expect(output).toContain("Usage");
    expect(output).toContain("scan");
  });


  test("should fail when --mr is missing", () => {
    expect(() => {
      execSync("node bin/secure-review.js scan", { stdio: "pipe" });
    }).toThrow();
  });
});

/**
 * Task 2.4 — Minh Nguyen
 * Test scan command can read saved GitLab token.
 */
test("shouldReadSavedToken", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
  const configDir = path.join(tempHome, ".secure-review");
  const configFile = path.join(configDir, "config.json");

  fs.mkdirSync(configDir, { recursive: true });

  fs.writeFileSync(
    configFile,
    JSON.stringify({
      gitlabToken: "glpat_testtoken123",
      loginTime: "2026-05-21T00:00:00.000Z",
    })
  );

  const output = execSync("node bin/secure-review.js scan --mr 123", {
    env: {
      ...process.env,
      HOME: tempHome,
    },
  }).toString();

  expect(output).toContain("Using saved GitLab authentication");
  expect(output).toContain("Scanning merge request 123");
});

/**
 * Task 2.5 — Minh Nguyen
 * Test login command accepts valid GitLab token.
 */
test("shouldLoginWithValidToken", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));

  const output = execSync(
    "node bin/secure-review.js login --token glpat_testtoken123",
    {
      env: {
        ...process.env,
        HOME: tempHome,
      },
    }
  ).toString();

  expect(output).toContain("Login successful");
});

/**
 * Task 2.5 — Minh Nguyen
 * Test login command rejects invalid GitLab token.
 */
test("shouldFailWhenTokenInvalid", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));

  expect(() => {
    execSync("node bin/secure-review.js login --token invalid_token", {
      env: {
        ...process.env,
        HOME: tempHome,
      },
      stdio: "pipe",
    });
  }).toThrow();
});

/**
 * Task 2.6 — Minh Nguyen
 * Test logout command removes saved GitLab token.
 */
test("shouldLogoutSuccessfully", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
  const configPath = path.join(tempHome, ".secure-review", "config.json");

  execSync("node bin/secure-review.js login --token glpat_testtoken123", {
    env: {
      ...process.env,
      HOME: tempHome,
    },
  });

  const output = execSync("node bin/secure-review.js logout", {
    env: {
      ...process.env,
      HOME: tempHome,
    },
  }).toString();

  expect(output).toContain("Logged out successfully");
  expect(fs.existsSync(configPath)).toBe(false);
});

/**
 * Task 2.7 — Minh Nguyen
 * Creates fake HOME folder so tests do not touch real user config.
 */
function createTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
}

/**
 * Task 2.7 — Minh Nguyen
 * Test login command fails when token is missing.
 */
test("shouldFailWhenTokenMissing", () => {
  const tempHome = createTempHome();

  expect(() => {
    execSync("node bin/secure-review.js login", {
      env: {
        ...process.env,
        HOME: tempHome,
      },
      stdio: "pipe",
    });
  }).toThrow();
});

/**
 * Task 2.7 — Minh Nguyen
 * Test token is stored locally after login.
 */
test("shouldStoreTokenLocally", () => {
  const tempHome = createTempHome();

  execSync("node bin/secure-review.js login --token glpat_testtoken123", {
    env: {
      ...process.env,
      HOME: tempHome,
    },
  });

  const configPath = path.join(tempHome, ".secure-review", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  expect(config.gitlabToken).toBe("glpat_testtoken123");
  expect(config.loginTime).toBeDefined();
});


/**
 * Task 2.8 — Minh Nguyen
 * Test scan works when user already logged in.
 */
test("should scan merge request when --mr is provided", () => {
  const tempHome = createTempHome();

  execSync("node bin/secure-review.js login --token glpat_testtoken123", {
    env: {
      ...process.env,
      HOME: tempHome,
    },
  });

  const output = execSync("node bin/secure-review.js scan --mr 123", {
    env: {
      ...process.env,
      HOME: tempHome,
    },
  }).toString();

  expect(output).toContain("Using saved GitLab authentication");
  expect(output).toContain("Scanning merge request 123");
});

/**
 * Task 2.8 — Minh Nguyen
 * Test scan command requires saved GitLab authentication.
 */
test("shouldFailScanWhenNotLoggedIn", () => {
  const tempHome = createTempHome();

  expect(() => {
    execSync("node bin/secure-review.js scan --mr 123", {
      env: {
        ...process.env,
        HOME: tempHome,
      },
      stdio: "pipe",
    });
  }).toThrow();
});