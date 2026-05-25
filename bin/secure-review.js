#!/usr/bin/env node

const { Command } = require("commander");
const { validateGitLabToken } = require("../services/gitlabService");
// const { disconnectGitLab } = require("../services/gitlabAuthService");
const {
  disconnectGitLab,
  isGitLabConnected,
  getGitLabUsername,
} = require("../services/gitlabAuthService");

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

function createCli(options = {}) {
  const program = new Command();

  const promptToken = options.promptToken || askQuestion;
  const output = options.console || console;
  const authService = options.authService;

  program
    .name("secure-review")
    .description("AI security code review CLI for GitLab merge requests")
    .version("1.0.0");

  /*
  Command:
    node bin/secure-review.js scan --mr 123
  Purpose:
    Scan a GitLab merge request.
  */
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

  /*
    New command:
      node bin/secure-review.js gitlab login
    Purpose:
      Ask the user to enter a GitLab token.
      Then send that token to backend validation.
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

  const gitlabCommand = program
    .command("gitlab")
    .description("GitLab account commands");

  gitlabCommand
    .command("login")
    .description("Connect GitLab account using a personal access token")
    .action(async () => {
      const token = await promptToken("Enter GitLab token: ");

      if (!token || token.trim() === "") {
        output.error("GitLab token cannot be empty.");
        process.exitCode = 1;
        return;
      }

      if (authService && authService.validateGitLabToken) {
        const isValid = await authService.validateGitLabToken(token);

        if (isValid) {
          output.log("GitLab account connected successfully.");
        } else {
          output.error("Invalid GitLab token.");
          process.exitCode = 1;
        }

        return;
      }

      const result = loginWithToken(
        token,
        "GitLab account connected successfully."
      );

      if (!result.success) {
        output.error(result.message);
        process.exitCode = 1;
        return;
      }

      output.log(result.message);
    });

  /*
  Command:
    node bin/secure-review.js logout

  Purpose:
    Remove saved GitLab token.
  */

  gitlabCommand
    .command("logout")
    .description("Disconnect your GitLab account")
    .action(() => {
      const result = disconnectGitLab();

      console.log(result.message);
    });
  /**
   * Task 3.5 — Minh Nguyen
   * Show whether GitLab account is connected.
  */
  gitlabCommand
    .command("status")
    .description("Show GitLab connection status")
    .action(() => {
      if (!isGitLabConnected()) {
        console.log("GitLab account is not connected.");
        return;
      }

      const username = getGitLabUsername();
      console.log(`GitLab connected as ${username}.`);
    });

  program
    .command("logout")
    .description("Remove saved GitLab authentication token")
    .action(() => {
      logout();
      console.log("Logged out successfully");
    });

  return program;

  
}


/*
  Task 2.3 / 2.4
  Get local config path for saved GitLab auth token.
*/
function getConfigPath() {
  return (
    process.env.SECURE_REVIEW_CONFIG_PATH ||
    path.join(os.homedir(), ".secure-review", "config.json")
  );
}

/*
task 2.3
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
 * Task 2.4
 * Read saved GitLab token
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
 * Task 2.5
 * Validate basic GitLab token format for login.
 */
function isValidGitLabToken(token) {
  return typeof token === "string" && token.startsWith("glpat_");
}

/**
 * Task 2.6
 */
function logout() {
  const configPath = getConfigPath();

  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}



if (require.main === module) {
  const program = createCli();
  program.parse(process.argv);
}



/* 
task 3.1
*/
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function loginWithToken(token, successMessage) {
  if (!token || token.trim() === "") {
    return {
      success: false,
      message: "GitLab token cannot be empty.",
    };
  }

  if (!isValidGitLabToken(token)) {
    return {
      success: false,
      message: "Invalid GitLab token.",
    };
  }

  saveToken(token);

  return {
    success: true,
    message: successMessage,
  };
}

module.exports = {
  createCli,
  getConfigPath,
  saveToken,
  readSavedToken,
  isValidGitLabToken,
  logout,
  askQuestion,
  loginWithToken,
};