const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/*
  These tests run the real CLI in a child process.
  tests/helpers/fetchStub.js is preloaded so the child never reaches the
  real network: GitLab responses come from the routes passed to run().
*/
const REPO_ROOT = path.join(__dirname, "..");
const FETCH_STUB = path.join(__dirname, "helpers", "fetchStub.js");

const TOKEN = "glpat-xxxxxxxxxxxxxxxxxxxx";

const USER_OK = {
  urlIncludes: "/api/v4/user",
  status: 200,
  body: { id: 1, username: "developer123" },
};

const USER_UNAUTHORIZED = {
  urlIncludes: "/api/v4/user",
  status: 401,
  body: { message: "401 Unauthorized" },
};

const EMPTY_MR = {
  urlIncludes: "/merge_requests/123/changes",
  status: 200,
  body: { changes: [] },
};

describe("secure-review CLI", () => {
  let tempHome;
  let configPath;
  let baseEnv;

  function run(args, routes = [], stdinText) {
    const result = spawnSync(
      process.execPath,
      ["-r", FETCH_STUB, "bin/secure-review.js", ...args],
      {
        cwd: REPO_ROOT,
        env: { ...baseEnv, SECURE_REVIEW_TEST_FETCH: JSON.stringify(routes) },
        encoding: "utf8",
        input: stdinText,
      }
    );

    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
    configPath = path.join(tempHome, ".secure-review", "config.json");

    baseEnv = {
      ...process.env,
      SECURE_REVIEW_CONFIG_PATH: configPath,
    };
    delete baseEnv.SECURE_REVIEW_HOME;
    delete baseEnv.GEMINI_API_KEY;
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  //task 2.1
  test("should show help", () => {
    const { stdout } = run(["--help"]);

    expect(stdout).toContain("Usage");
    expect(stdout).toContain("scan");
    expect(stdout).toContain("login");
    expect(stdout).toContain("logout");
  });

  test("should recognize login command", () => {
    const { stdout } = run(["login", "--help"]);

    expect(stdout).toContain("Usage");
    expect(stdout).toContain("login");
    expect(stdout).toContain("--token");
  });

  test("should login when GitLab accepts the token", () => {
    const { status, stdout } = run(["login", "--token", TOKEN], [USER_OK]);

    expect(status).toBe(0);
    expect(stdout).toContain("Login successful");
    expect(stdout).toContain("developer123");
  });

  /*
  test case 2.3
  */
  test("should store token, username and login time locally", () => {
    run(["login", "--token", TOKEN], [USER_OK]);

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(config.gitlabToken).toBe(TOKEN);
    expect(config.gitlabUsername).toBe("developer123");
    expect(config.loginTime).toBeDefined();
  });

  test("gitlab login reads a piped token (non-TTY) and never prints it", () => {
    const { status, stdout, stderr } = run(["gitlab", "login"], [USER_OK], `${TOKEN}\n`);

    expect(status).toBe(0);
    expect(stdout).toContain("Enter GitLab token: ");
    expect(stdout).toContain("GitLab account connected successfully.");
    expect(stdout + stderr).not.toContain(TOKEN);

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    expect(config.gitlabToken).toBe(TOKEN);
  });

  test("should show username in gitlab status after login", () => {
    run(["login", "--token", TOKEN], [USER_OK]);

    const { stdout } = run(["gitlab", "status"]);

    expect(stdout).toContain("GitLab connected as developer123.");
  });

  /*
  test case 2.4 / 2.8
  */
  test("should fail scan when not logged in", () => {
    const { status, stderr } = run(["scan", "--project", "group/project", "--mr", "123"]);

    expect(status).toBe(1);
    expect(stderr).toContain("Please login first");
    expect(stderr).toContain("secure-review gitlab login");
  });

  test("should treat a corrupted config as not logged in without crashing", () => {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, "{ this is not json");

    const status = run(["gitlab", "status"]);
    expect(status.status).toBe(0);
    expect(status.stdout).toContain("GitLab account is not connected.");
    expect(status.stderr).toContain("is not valid JSON");

    const scan = run(["scan", "--project", "group/project", "--mr", "123"]);
    expect(scan.status).toBe(1);
    expect(scan.stderr).toContain("Please login first");
    expect(scan.stderr).not.toMatch(/\n\s+at /);
  });

  /*
  test 2.5
  */
  test("should fail when token is missing", () => {
    const { status } = run(["login"]);

    expect(status).not.toBe(0);
  });

  test("should fail cleanly when GitLab rejects the token", () => {
    const { status, stderr } = run(["login", "--token", "not-a-real-token"], [
      USER_UNAUTHORIZED,
    ]);

    expect(status).toBe(1);
    expect(stderr).toContain("Invalid GitLab token.");
    expect(stderr).not.toMatch(/\n\s+at /);
    expect(fs.existsSync(configPath)).toBe(false);
  });

  test("should fail cleanly when GitLab cannot be reached", () => {
    const { status, stderr } = run(["login", "--token", TOKEN], []);

    expect(status).toBe(1);
    expect(stderr).toContain("Unable to connect to GitLab.");
    expect(stderr).not.toMatch(/\n\s+at /);
    expect(fs.existsSync(configPath)).toBe(false);
  });

  /*
    test case 2.6
    */
  test("should logout successfully", () => {
    run(["login", "--token", TOKEN], [USER_OK]);

    const { stdout } = run(["logout"]);

    expect(stdout).toContain("GitLab account disconnected successfully.");

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    expect(config.gitlabToken).toBeUndefined();
  });

  /*
  test 2.8
  */
  test("should fail when --mr is missing", () => {
    const { status } = run(["scan"]);

    expect(status).toBe(1);
  });

  /**
   * Task 3.8 — Minh Nguyen
   * Test GitLab status when account is not connected.
   */
  test("should show GitLab not connected status", () => {
    const { stdout } = run(["gitlab", "status"]);

    expect(stdout).toContain("GitLab account is not connected.");
  });

  /**
   * Task 3.8 — Minh Nguyen
   * Test GitLab disconnect command does not crash.
   */
  test("should disconnect GitLab account", () => {
    const { stdout } = run(["gitlab", "logout"]);

    expect(stdout).toContain("GitLab account disconnected successfully.");
  });
  /*
  Story 12 - Task 12.1
  Test that scan command prints terminal security report after login.
*/
  test("should print terminal security report when scan runs after login", () => {
    // First, login so the scan command is allowed to run
    run(["login", "--token", TOKEN], [USER_OK]);

    // Then run scan command against a stubbed MR with no changes
    const { stdout } = run(["scan", "--project", "group/project", "--mr", "123"], [
      EMPTY_MR,
    ]);

    // The scan output should include the final terminal report
    expect(stdout).toContain("Security Scan Report");
    expect(stdout).toContain("No security issues found.");
  });
  /*
    Story 12 - Task 12.5
    Test that scan command prints full terminal report structure.
  */
  test("should print full terminal report structure after scan", () => {
    // First, login so the scan command is allowed to run
    run(["login", "--token", TOKEN], [USER_OK]);

    // Then run scan command against a stubbed MR with no changes
    const { stdout } = run(["scan", "--project", "group/project", "--mr", "123"], [
      EMPTY_MR,
    ]);

    // The CLI should show scan progress and report structure
    expect(stdout).toContain("Using saved GitLab authentication");
    expect(stdout).toContain("Scanning merge request 123");
    expect(stdout).toContain("Security Scan Report");
    expect(stdout).toContain("No security issues found.");
    expect(stdout).toContain("End of Report");
  });
});
