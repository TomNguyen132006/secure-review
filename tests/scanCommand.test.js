const { createCli } = require("../bin/secure-review");

describe("scan command", () => {
  let mockConsole;
  let mockAuthService;
  let mockMergeRequestService;

  beforeEach(() => {
    jest.clearAllMocks();

    process.exitCode = 0;

    mockConsole = {
      log: jest.fn(),
      error: jest.fn(),
    };

    mockAuthService = {
      isGitLabConnected: jest.fn(),
      getGitLabToken: jest.fn(),
    };

    mockMergeRequestService = {
      scanMergeRequest: jest.fn(),
    };
  });

  test("should show error when --mr is missing", async () => {
    const program = createCli({
      console: mockConsole,
      authService: mockAuthService,
      mergeRequestService: mockMergeRequestService,
    });

    await program.parseAsync(["scan"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith(
      "Error: Missing required option --mr <id>"
    );
    expect(process.exitCode).toBe(1);
  });

  test("should show error when user is not logged in", async () => {
    mockAuthService.isGitLabConnected.mockReturnValue(false);

    const program = createCli({
      console: mockConsole,
      authService: mockAuthService,
      mergeRequestService: mockMergeRequestService,
    });

    await program.parseAsync(["scan", "--mr", "123"], {
      from: "user",
    });

    expect(mockAuthService.isGitLabConnected).toHaveBeenCalled();

    expect(mockConsole.error).toHaveBeenCalledWith(
      "ERROR: Please login first using secure-review login --token <token>"
    );

    expect(process.exitCode).toBe(1);
  });

  test("should scan merge request successfully", async () => {
    mockAuthService.isGitLabConnected.mockReturnValue(true);
    mockAuthService.getGitLabToken.mockReturnValue("fake-gitlab-token");

    mockMergeRequestService.scanMergeRequest.mockResolvedValue({
      success: true,
      message: "Merge request scanned successfully.",
      data: {
        mrId: "123",
        risksFound: 0,
      },
    });

    const program = createCli({
      console: mockConsole,
      authService: mockAuthService,
      mergeRequestService: mockMergeRequestService,
    });

    await program.parseAsync(["scan", "--mr", "123"], {
      from: "user",
    });

    expect(mockAuthService.getGitLabToken).toHaveBeenCalled();

    expect(mockMergeRequestService.scanMergeRequest).toHaveBeenCalledWith(
      "123",
      "fake-gitlab-token"
    );

    expect(mockConsole.log).toHaveBeenCalledWith(
      "Merge request scanned successfully."
    );

    expect(process.exitCode).toBe(0);
  });

  test("should show service error when scan fails", async () => {
    mockAuthService.isGitLabConnected.mockReturnValue(true);
    mockAuthService.getGitLabToken.mockReturnValue("fake-gitlab-token");

    mockMergeRequestService.scanMergeRequest.mockResolvedValue({
      success: false,
      message: "Invalid merge request ID.",
    });

    const program = createCli({
      console: mockConsole,
      authService: mockAuthService,
      mergeRequestService: mockMergeRequestService,
    });

    await program.parseAsync(["scan", "--mr", "999"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith("Invalid merge request ID.");
    expect(process.exitCode).toBe(1);
  });

  test("should not crash if scan service throws an error", async () => {
    mockAuthService.isGitLabConnected.mockReturnValue(true);
    mockAuthService.getGitLabToken.mockReturnValue("fake-gitlab-token");

    mockMergeRequestService.scanMergeRequest.mockRejectedValue(
      new Error("GitLab API failed")
    );

    const program = createCli({
      console: mockConsole,
      authService: mockAuthService,
      mergeRequestService: mockMergeRequestService,
    });

    await program.parseAsync(["scan", "--mr", "123"], {
      from: "user",
    });

    expect(mockConsole.error).toHaveBeenCalledWith("ERROR: GitLab API failed");
    expect(process.exitCode).toBe(1);
  });
});