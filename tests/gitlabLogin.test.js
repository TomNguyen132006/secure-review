const { createCli } = require("../bin/secure-review");

const VALID_TOKEN = "glpat-xxxxxxxxxxxxxxxxxxxx";

function createMocks({ token = VALID_TOKEN, validation } = {}) {
  const mockPrompt = jest.fn().mockResolvedValue(token);

  const mockAuthService = {
    validateGitLabToken: jest.fn().mockResolvedValue(
      validation || {
        success: true,
        user: { username: "developer123" },
      }
    ),
    saveGitLabToken: jest.fn(),
  };

  const mockConsole = {
    log: jest.fn(),
    error: jest.fn(),
  };

  const program = createCli({
    promptToken: mockPrompt,
    authService: mockAuthService,
    console: mockConsole,
  });

  return { program, mockPrompt, mockAuthService, mockConsole };
}

describe("Task 3.1 - GitLab Login Command", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  //Test 1
  test("GitLab login command exists", async () => {
    const { program, mockPrompt } = createMocks();

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockPrompt).toHaveBeenCalledWith("Enter GitLab token: ");
  });

  //Test 2
  test("Empty token is rejected", async () => {
    const { program, mockAuthService, mockConsole } = createMocks({ token: "" });

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockAuthService.validateGitLabToken).not.toHaveBeenCalled();
    expect(mockAuthService.saveGitLabToken).not.toHaveBeenCalled();
    expect(mockConsole.error).toHaveBeenCalledWith("GitLab token cannot be empty.");
    expect(process.exitCode).toBe(1);
  });

  //Test 3
  test("Token is validated against the GitLab API", async () => {
    const { program, mockAuthService } = createMocks();

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockAuthService.validateGitLabToken).toHaveBeenCalledWith(VALID_TOKEN);
  });

  //Test 4
  test("Valid token shows success message", async () => {
    const { program, mockConsole } = createMocks();

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockConsole.log).toHaveBeenCalledWith("GitLab account connected successfully.");
  });

  //Test 5
  test("Invalid token shows error message and is not saved", async () => {
    const { program, mockAuthService, mockConsole } = createMocks({
      validation: { success: false, message: "Invalid GitLab token." },
    });

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockConsole.error).toHaveBeenCalledWith("Invalid GitLab token.");
    expect(mockAuthService.saveGitLabToken).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  test("Valid token is saved together with the GitLab username", async () => {
    const { program, mockAuthService } = createMocks();

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockAuthService.saveGitLabToken).toHaveBeenCalledWith(VALID_TOKEN, {
      username: "developer123",
    });
  });

  test("Surrounding whitespace in a pasted token is ignored", async () => {
    const { program, mockAuthService } = createMocks({
      token: `  ${VALID_TOKEN}\n`,
    });

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockAuthService.validateGitLabToken).toHaveBeenCalledWith(VALID_TOKEN);
  });

  test("Network failure shows a clean error", async () => {
    const { program, mockAuthService, mockConsole } = createMocks({
      validation: { success: false, message: "Unable to connect to GitLab." },
    });

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockConsole.error).toHaveBeenCalledWith("Unable to connect to GitLab.");
    expect(mockAuthService.saveGitLabToken).not.toHaveBeenCalled();
  });
});

describe("login --token (non-interactive)", () => {
  afterEach(() => {
    process.exitCode = undefined;
  });

  test("validates the token via the API and saves token + username", async () => {
    const { program, mockAuthService, mockConsole, mockPrompt } = createMocks();

    await program.parseAsync(["node", "cli.js", "login", "--token", VALID_TOKEN]);

    expect(mockPrompt).not.toHaveBeenCalled();
    expect(mockAuthService.validateGitLabToken).toHaveBeenCalledWith(VALID_TOKEN);
    expect(mockAuthService.saveGitLabToken).toHaveBeenCalledWith(VALID_TOKEN, {
      username: "developer123",
    });
    expect(mockConsole.log).toHaveBeenCalledWith(
      "Login successful. Connected to GitLab as developer123."
    );
  });

  test("rejects a token GitLab does not accept", async () => {
    const { program, mockAuthService, mockConsole } = createMocks({
      validation: { success: false, message: "Invalid GitLab token." },
    });

    await program.parseAsync(["node", "cli.js", "login", "--token", "not-a-real-token"]);

    expect(mockConsole.error).toHaveBeenCalledWith("ERROR: Invalid GitLab token.");
    expect(mockAuthService.saveGitLabToken).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
