const { createCli } = require("../src/cli");

describe("SecureReview CLI", () => {
  test("should create CLI with correct name", () => {
    const program = createCli();

    expect(program.name()).toBe("secure-review");
  });

  test("should include scan command", () => {
    const program = createCli();

    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toContain("scan");
  });

  test("should have correct description", () => {
    const program = createCli();

    expect(program.description()).toBe(
      "AI security code review CLI for GitLab merge requests"
    );
  });
});