#!/usr/bin/env node

const { Command } = require("commander");
const fs = require("fs");
const os = require("os");
const path = require("path");


/**
 * Task 2.3 / 2.4 — Minh Nguyen
 * Get local config path for saved GitLab auth token.
 */
function getConfigPath() {
  return (
    process.env.SECURE_REVIEW_CONFIG_PATH ||
    path.join(os.homedir(), ".secure-review", "config.json")
  );
}
/**
 * Task 2.3 — Minh Nguyen
 * Save GitLab token locally after login.
 */
function saveToken(token) {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  fs.mkdirSync(configDir, { recursive: true });

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        gitlabToken: token,
        loginTime: new Date().toISOString(),
      },
      null,
      2
    )
  );
}

/**
 * Task 2.4 — Minh Nguyen
 * Read saved GitLab token from local config file.
 */
function readSavedToken() {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.gitlabToken || null;
  } catch (error) {
    return null;
  }
}

/**
 * Task 2.5 — Minh Nguyen
 * Validate basic GitLab token format for login.
 */
function isValidGitLabToken(token) {
  return typeof token === "string" && token.startsWith("glpat_");
}

/**
 * Task 2.6 — Minh Nguyen
 * Remove saved GitLab auth config during logout.
 */
function logout() {
  const configPath = getConfigPath();

  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

function createCli() {
  const program = new Command();

  program
    .name("secure-review")
    .description("AI security code review CLI for GitLab merge requests")
    .version("1.0.0");

  program
    .command("scan")
    .description("Scan a GitLab merge request for security risks")
    .option("--mr <id>", "GitLab merge request ID")
    .action((options) => {
      if (!options.mr) {
        console.error("Error: Missing required option --mr <id>");
        process.exitCode = 1;
        return;
      }

      /**
       * Task 2.4 — Minh Nguyen
       * Scan command reuses saved GitLab token if user already logged in.
       */
      const token = readSavedToken();

      if (!token) {
        console.error("ERROR: Please login first using secure-review login --token <token>");
        process.exitCode = 1;
        return;
      }

      console.log("Using saved GitLab authentication");

      console.log(`Scanning merge request ${options.mr}...`);
      console.log("CLI is working. Security scan will be added in later stories.");
    });
  /**
    * Task 2.5 — Minh Nguyen
    * Login command validates token and stores it locally.
    */
  program
    .command("login")
    .description("Save GitLab authentication token locally")
    .requiredOption("--token <token>", "GitLab personal access token")
    .action((options) => {
      if (!isValidGitLabToken(options.token)) {
        console.error("ERROR: Invalid GitLab token");
        process.exitCode = 1;
        return;
      }

      saveToken(options.token);
      console.log("Login successful");
    });

  /**
   * Task 2.6 — Minh Nguyen
   * Logout command removes saved GitLab token.
   */
  program
    .command("logout")
    .description("Remove saved GitLab authentication token")
    .action(() => {
      logout();
      console.log("Logged out successfully");
    });

  return program;
}

if (require.main === module) {
  const program = createCli();
  program.parse(process.argv);
}

module.exports = {
  createCli,
  getConfigPath,
  saveToken,
  readSavedToken,
  isValidGitLabToken,
  logout,
};