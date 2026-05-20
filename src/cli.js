const { Command } = require("commander");

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

      console.log(`Scanning merge request ${options.mr}...`);
      console.log("CLI is working. Security scan will be added in later stories.");
    });

  return program;
}

module.exports = {
  createCli
};