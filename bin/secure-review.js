#!/usr/bin/env node

// Check the Node.js version before loading anything that needs a newer one.
var nodeVersionError = require("../services/nodeVersion").getNodeVersionError(
  process.versions.node
);

if (nodeVersionError) {
  console.error(nodeVersionError);
  process.exit(1);
}

const { Command } = require("commander");

const {
  saveGitLabToken,
  getGitLabToken,
  isGitLabConnected,
  disconnectGitLab,
  getGitLabUsername,
} = require("../services/gitlabAuthService");

const { validateGitLabToken } = require("../services/gitlabService");
const { runHybridScan, scanDiffText } = require("../services/hybridScannerService");
const { readDiffFile } = require("../services/diffFileService");

const { askHiddenQuestion } = require("../services/promptService");
const {
  FAIL_ON_LEVELS,
  isValidFailOnLevel,
  countFindingsAtOrAbove,
} = require("../services/severityService");

// Exit codes: 0 = scan OK, 1 = error, 2 = findings at or above --fail-on.
const EXIT_FINDINGS = 2;

const {
  createMarkdownReport,
  saveMarkdownReport,
} = require("../services/markdownReportService");

const { postMergeRequestComment } = require("../services/gitlabCommentService");

function createCli(options = {}) {
  const program = new Command();

  // Token input is hidden while typing (see services/promptService.js).
  const promptToken = options.promptToken || askHiddenQuestion;
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
      scanDiffText,
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
     node bin/secure-review.js scan --diff-file changes.diff   (offline)

   Purpose:
     Scan a GitLab merge request by ID, or a local unified diff, with the
     hybrid scanner (local rules first, then optional Gemini explanations).
   */
  program
    .command("scan")
    .description("Scan a GitLab merge request (or a local diff file) for security risks")
    .option("--mr <id>", "GitLab merge request ID (the number shown in the MR URL)")
    .option("--project <id>", "GitLab project ID or path, e.g. group/project")
    .option(
      "--diff-file <path>",
      "Scan a local unified diff (e.g. from git diff) instead of a GitLab MR; no login needed"
    )
    .option("--markdown", "Export security report as Markdown")
    .option("--output <file>", "Markdown output file path")
    .option("--comment", "Post security report as a GitLab merge request comment")
    .option(
      "--fail-on <level>",
      `Exit with code ${EXIT_FINDINGS} if any finding is at or above this level (${FAIL_ON_LEVELS.join(", ")})`,
      "none"
    )
    .action(async (commandOptions) => {
      const fail = (message) => {
        output.error(message);
        process.exitCode = 1;
      };
      const onWarning = (message) =>
        output.warn ? output.warn(message) : output.error(message);

      try {
        let scanResult;
        let projectId;
        let token;

        if (commandOptions.diffFile) {
          /*
            Offline mode: scan a local diff. No GitLab login, project or MR.
          */
          if (commandOptions.mr || commandOptions.project) {
            fail("Error: --diff-file cannot be combined with --mr or --project.");
            return;
          }

          if (commandOptions.comment) {
            fail(
              "Error: --comment posts to a GitLab merge request, so it cannot be used with --diff-file. " +
                "Use --markdown to save the report instead."
            );
            return;
          }

          if (!isValidFailOnLevel(commandOptions.failOn)) {
            fail(
              `Error: Invalid --fail-on value "${commandOptions.failOn}". Use one of: ${FAIL_ON_LEVELS.join(", ")}`
            );
            return;
          }

          const diffText = readDiffFile(commandOptions.diffFile);

          output.log(`Scanning diff file ${commandOptions.diffFile} (offline, no GitLab login needed)...`);

          scanResult = await hybridScannerService.scanDiffText({ diffText, onWarning });
        } else {
          if (!commandOptions.mr) {
            fail("Error: Missing required option --mr <id> (or use --diff-file <path> to scan a local diff)");
            return;
          }

          if (!isValidFailOnLevel(commandOptions.failOn)) {
            fail(
              `Error: Invalid --fail-on value "${commandOptions.failOn}". Use one of: ${FAIL_ON_LEVELS.join(", ")}`
            );
            return;
          }

          if (!commandOptions.project) {
            fail(
              "Error: Missing required option --project <id> (GitLab project ID or path, e.g. group/project)"
            );
            return;
          }

          /*
            The CLI should not scan private GitLab merge requests unless
            the user has logged in.
          */
          token = authService.getGitLabToken();

          if (!token) {
            fail(LOGIN_FIRST_MESSAGE);
            return;
          }

          projectId = commandOptions.project;

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
          scanResult = await hybridScannerService.runHybridScan({
            projectId,
            mrId: commandOptions.mr,
            token,
            onWarning,
          });
        }

        output.log(scanResult.report);

        if (commandOptions.markdown || commandOptions.comment) {
          const markdown = createMarkdownReport({
            ...scanResult,
            mrId: commandOptions.mr,
            diffFile: commandOptions.diffFile,
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

        const failOn = commandOptions.failOn.toLowerCase();
        const blockingCount = countFindingsAtOrAbove(scanResult.findings, failOn);

        if (blockingCount > 0) {
          output.error(
            `Failing: ${blockingCount} finding(s) at or above "${failOn}" (--fail-on ${failOn}).`
          );
          process.exitCode = EXIT_FINDINGS;
          return;
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
      let token;

      try {
        token = await promptToken("Enter GitLab token: ");
      } catch (error) {
        if (error.code === "PROMPT_CANCELLED") {
          output.error("Login cancelled.");
          process.exitCode = 130;
          return;
        }

        throw error;
      }

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



module.exports = {
  createCli,
  loginWithToken,
};