const fs = require("fs");
const os = require("os");
const path = require("path");

const { Command } = require("commander");
const { createCli } = require("../bin/secure-review");

describe("Task 3.4 - GitLab Logout Command", () => {
  let testConfigDir;
  let testConfigFile;

  beforeEach(() => {
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
    testConfigFile = path.join(testConfigDir, ".secure-review", "config.json");

    process.env.SECURE_REVIEW_HOME = testConfigDir;

    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();

    fs.rmSync(testConfigDir, { recursive: true, force: true });

    delete process.env.SECURE_REVIEW_HOME;
  });

  test("should disconnect GitLab account successfully when token exists", async () => {
    const configDir = path.dirname(testConfigFile);
    fs.mkdirSync(configDir, { recursive: true });

    fs.writeFileSync(
      testConfigFile,
      JSON.stringify(
        {
          gitlabToken: "fake-gitlab-token",
          gitlabUsername: "developer123",
        },
        null,
        2
      )
    );

    const program = createCli();

    await program.parseAsync(["node", "secure-review", "gitlab", "logout"]);

    const updatedConfig = JSON.parse(fs.readFileSync(testConfigFile, "utf8"));

    expect(updatedConfig.gitlabToken).toBeUndefined();
    expect(updatedConfig.gitlabUsername).toBeUndefined();

    expect(console.log).toHaveBeenCalledWith(
      "GitLab account disconnected successfully."
    );
  });

  test("should not crash when no GitLab account is connected", async () => {
    const program = createCli();

    await expect(
      program.parseAsync(["node", "secure-review", "gitlab", "logout"])
    ).resolves.not.toThrow();

    expect(console.log).toHaveBeenCalledWith(
      "GitLab account disconnected successfully."
    );
  });
});