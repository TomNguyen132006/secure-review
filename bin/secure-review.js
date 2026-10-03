#!/usr/bin/env node

const { Command } = require("commander");

const {
  saveGitLabToken,
  getGitLabToken,
  isGitLabConnected,
  disconnectGitLab,
  getGitLabUsername,
} = require("../services/gitlabAuthService");

const { validateGitLabToken } = require("../services/gitlabService");
const { runHybridScan } = require("../services/hybridScannerService");

const readline = require("readline");

const {
  createMarkdownReport,
  saveMarkdownReport,
} = require("../services/markdownReportService");

const { postMergeRequestComment } = require("../services/gitlabCommentService");

function createCli(options = {}) {
  const program = new Command();

  const promptToken = options.promptToken || askQuestion;
  const output = options.console || console;
  // gitlabAuthService is the only module that reads/writes the config file.
  // Tests may override individual functions.
  const authService = {
    saveGitLabToken,
    getGitLabToken,
    isGitLabConnected,
    disconnectGitLab,
    getGitLabUsername,
    validateGitLabToken,
    ...(options.authService || {}),
  };
  const hybridScannerService =
    options.hybridScannerService || {
      runHybridScan,
    };
  const commentService =
    options.commentService || {
      postMergeRequestComment,
    };

  program
    .name("secure-review")
    .description("AI security code review CLI for GitLab merge requests")
    .version("1.0.0");

  /*
   Command:
     node bin/secure-review.js scan --project group/project --mr 123

   Purpose:
     Scan a GitLab merge request by ID with the hybrid scanner
     (local rules first, then optional Gemini explanations).
   */
  program
    .command("scan")
    .description("Scan a GitLab merge request for security risks")
    .option("--mr <id>", "GitLab merge request ID (the number shown in the MR URL)")
    .option("--project <id>", "GitLab project ID or path, e.g. group/project")
    .option("--markdown", "Export security report as Markdown")
    .option("--output <file>", "Markdown output file path")
    .option("--comment", "Post security report as a GitLab merge request comment")
    .action(async (commandOptions) => {
      try {
        if (!commandOptions.mr) {
          output.error("Error: Missing required option --mr <id>");
          process.exitCode = 1;
          return;
        }

        if (!commandOptions.project) {
          output.error(
            "Error: Missing required option --project <id> (GitLab project ID or path, e.g. group/project)"
          );
          process.exitCode = 1;
          return;
        }

        /*
          The CLI should not scan private GitLab merge requests unless
          the user has logged in.
        */
        const token = authService.getGitLabToken();

        if (!token) {
          output.error(LOGIN_FIRST_MESSAGE);
          process.exitCode = 1;
          return;
        }

        const projectId = commandOptions.project;

        output.log("Using saved GitLab authentication");
        output.log(`Scanning merge request ${commandOptions.mr} in ${projectId}...`);

        /*
          runHybridScan handles:
            1. Fetch GitLab MR diff (throws if GitLab returns an error).
            2. Split diff into file chunks.
            3. Run local scanner first.
            4. Create safe abstract findings.
            5. Send safe findings to Gemini.
            6. Fall back when Gemini fails.
            7. Create the final terminal report.
        */
        const scanResult = await hybridScannerService.runHybridScan({
          projectId,
          mrId: commandOptions.mr,
          token,
        });

        output.log(scanResult.report);

        if (commandOptions.markdown || commandOptions.comment) {
          const markdown = createMarkdownReport({
            ...scanResult,
            mrId: commandOptions.mr,
          });

          if (commandOptions.markdown) {
            const outputPath = commandOptions.output || "secure-review-report.md";
            saveMarkdownReport(markdown, outputPath);

            output.log(`Markdown report exported to ${outputPath}`);
          }

          if (commandOptions.comment) {
            const commentResult = await commentService.postMergeRequestComment(
              projectId,
              commandOptions.mr,
              token,
              markdown
            );

            if (!commentResult.success) {
              output.error(`Error: ${commentResult.message}`);
              process.exitCode = 1;
              return;
            }

            output.log(commentResult.message);
          }
        }

        process.exitCode = 0;
      } catch (error) {
        /*
          Final safety catch:
            Prevent the CLI from crashing with an ugly stack trace.
        */
        output.error(`Error: ${error.message}`);
        process.exitCode = 1;
      }
    });

  /*
    Command:
      node bin/secure-review.js login --token <token>
    Purpose:
      Non-interactive login for scripts/CI. The token is checked against
      the GitLab API, then the token and username are saved.
  */
  program
    .command("login")
    .description("Save GitLab authentication token locally")
    .requiredOption("--token <token>", "GitLab personal access token")
    .action(async (commandOptions) => {
      const result = await loginWithToken(commandOptions.token, authService);

      if (!result.success) {
        output.error(`ERROR: ${result.message}`);
        process.exitCode = 1;
        return;
      }

      output.log(`Login successful. Connected to GitLab as ${result.username}.`);
    });

  const gitlabCommand = program
    .command("gitlab")
    .description("GitLab account commands");

  /*
    Command:
      node bin/secure-review.js gitlab login
    Purpose:
      Ask the user to enter a GitLab token, check it against the GitLab API,
      then save the token and username.
  */
  gitlabCommand
    .command("login")
    .description("Connect GitLab account using a personal access token")
    .action(async () => {
      const token = await promptToken("Enter GitLab token: ");
      const result = await loginWithToken(token, authService);

      if (!result.success) {
        output.error(result.message);
        process.exitCode = 1;
        return;
      }

      output.log("GitLab account connected successfully.");
    });

  /*
  Command:
    node bin/secure-review.js gitlab logout
    node bin/secure-review.js logout

  Purpose:
    Remove saved GitLab token. Both commands do the same thing.
  */
  const logoutAction = () => {
    const result = authService.disconnectGitLab();

    output.log(result.message);
  };

  gitlabCommand
    .command("logout")
    .description("Disconnect your GitLab account")
    .action(logoutAction);

  /**
   * Task 3.5 — Minh Nguyen
   * Show whether GitLab account is connected.
  */
  gitlabCommand
    .command("status")
    .description("Show GitLab connection status")
    .action(() => {
      if (!authService.isGitLabConnected()) {
        output.log("GitLab account is not connected.");
        return;
      }

      const username = authService.getGitLabUsername();
      output.log(`GitLab connected as ${username}.`);
    });

  program
    .command("logout")
    .description("Remove saved GitLab authentication token")
    .action(logoutAction);

  return program;


}

const LOGIN_FIRST_MESSAGE =
  "ERROR: Please login first using: secure-review gitlab login " +
  "(or secure-review login --token <token> in scripts)";

/*
  Validate a token against the GitLab API, then save token + username.
  Shared by `login --token` and `gitlab login`.
*/
async function loginWithToken(token, authService) {
  if (!token || token.trim() === "") {
    return {
      success: false,
      message: "GitLab token cannot be empty.",
    };
  }

  const trimmedToken = token.trim();

  try {
    const result = await authService.validateGitLabToken(trimmedToken);

    if (!result || !result.success) {
      return {
        success: false,
        message: (result && result.message) || "Invalid GitLab token.",
      };
    }

    const username = result.user && result.user.username;

    authService.saveGitLabToken(trimmedToken, { username });

    return {
      success: true,
      username,
    };
  } catch (error) {
    return {
      success: false,
      message: `Login failed: ${error.message}`,
    };
  }
}

if (require.main === module) {
  const program = createCli();
  program.parseAsync(process.argv);
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

module.exports = {
  createCli,
  askQuestion,
  loginWithToken,
};