const { createCli } = require("../bin/secure-review");

describe("Task 3.1 - GitLab Login Command", () => {
  //Test 1
  test("GitLab login command exists", async () => {
    const mockPrompt = jest.fn().mockResolvedValue("valid-token");

    const mockAuthService = {
      validateGitLabToken: jest.fn().mockResolvedValue(true),
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

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockPrompt).toHaveBeenCalledWith("Enter GitLab token: ");
  });

  //Test 2
  test("Empty token is rejected", async () => {
    const mockPrompt = jest.fn().mockResolvedValue("");

    const mockAuthService = {
      validateGitLabToken: jest.fn(),
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

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockAuthService.validateGitLabToken).not.toHaveBeenCalled();
    expect(mockConsole.error).toHaveBeenCalledWith("GitLab token cannot be empty.");
  });

  //Test 3
  test("Token is sent to the backend", async () => {
    const mockPrompt = jest.fn().mockResolvedValue("my-gitlab-token");

    const mockAuthService = {
      validateGitLabToken: jest.fn().mockResolvedValue(true),
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

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockAuthService.validateGitLabToken).toHaveBeenCalledWith("my-gitlab-token");
  });


  //Test 4 
  test("Valid token shows success message", async () => {
    const mockPrompt = jest.fn().mockResolvedValue("valid-token");

    const mockAuthService = {
      validateGitLabToken: jest.fn().mockResolvedValue(true),
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

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockConsole.log).toHaveBeenCalledWith("GitLab account connected successfully.");
  });

  //Test 5
  test("Invalid token shows error message", async () => {
    const mockPrompt = jest.fn().mockResolvedValue("invalid-token");

    const mockAuthService = {
      validateGitLabToken: jest.fn().mockResolvedValue(false),
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

    await program.parseAsync(["node", "cli.js", "gitlab", "login"]);

    expect(mockConsole.error).toHaveBeenCalledWith("Invalid GitLab token.");
  });
});