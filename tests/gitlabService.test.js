const { validateGitLabToken } = require("../services/gitlabService");

global.fetch = jest.fn();

describe("Task 3.2 - GitLab Token Validation Service", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  //test 1
  test("should return user information when GitLab token is valid", async () => {
    const mockUser = {
      id: 123456,
      username: "developer123",
      name: "Developer Name",
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    });

    const result = await validateGitLabToken("valid-token");

    expect(fetch).toHaveBeenCalledWith("https://gitlab.com/api/v4/user", {
      method: "GET",
      headers: {
        "PRIVATE-TOKEN": "valid-token",
      },
    });

    expect(result).toEqual({
      success: true,
      user: mockUser,
    });
  });

  //test 2
  test("should return error when GitLab token is invalid", async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        message: "401 Unauthorized",
      }),
    });

    const result = await validateGitLabToken("invalid-token");

    expect(result).toEqual({
      success: false,
      message: "Invalid GitLab token.",
    });
  });

  //test 3
  test("should return error when token is empty", async () => {
    const result = await validateGitLabToken("");

    expect(result).toEqual({
      success: false,
      message: "GitLab token cannot be empty.",
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  //test 4
  test("should not crash when GitLab API is unavailable", async () => {
    fetch.mockRejectedValue(new Error("Network error"));

    const result = await validateGitLabToken("valid-token");

    expect(result).toEqual({
      success: false,
      message: "Unable to connect to GitLab.",
    });
  });

  /**
 * Task 3.7 — Minh Nguyen
 * Test GitLab token validation service.
 */
  describe("GitLab token validation", () => {
    beforeEach(() => {
    fetch.mockClear();
    });

    test("should reject empty token", async () => {
      const result = await validateGitLabToken("");

      expect(result.success).toBe(false);
      expect(result.message).toBe("GitLab token cannot be empty.");
      expect(fetch).not.toHaveBeenCalled();
    });

    test("should validate correct GitLab token", async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          username: "developer123",
        }),
      });

      const result = await validateGitLabToken("valid-token");

      expect(result.success).toBe(true);
      expect(result.user.username).toBe("developer123");
    });

    test("should reject invalid GitLab token", async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const result = await validateGitLabToken("bad-token");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid GitLab token.");
    });

    test("should handle GitLab API error", async () => {
      fetch.mockRejectedValue(new Error("Network error"));

      const result = await validateGitLabToken("valid-token");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Unable to connect to GitLab.");
    });
  });
});