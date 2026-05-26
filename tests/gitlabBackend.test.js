/**
 * Task 3.6 — Minh Nguyen
 * Tests backend GitLab token validation endpoint.
 */

const request = require("supertest");
const app = require("../backend/app");
const gitlabService = require("../services/gitlabService");

jest.mock("../services/gitlabService");

describe("Task 3.6 - GitLab validation backend API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return 400 when token is empty", async () => {
    const response = await request(app)
      .post("/api/gitlab/validate-token")
      .send({ token: "" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      valid: false,
      message: "GitLab token cannot be empty",
    });
  });

  test("should return 401 when token is invalid", async () => {
    gitlabService.validateGitLabToken.mockResolvedValue({
      success: false,
      message: "Invalid GitLab token.",
    });

    const response = await request(app)
      .post("/api/gitlab/validate-token")
      .send({ token: "bad-token" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      valid: false,
      message: "Invalid GitLab token",
    });
  });

  test("should return 200 with username when token is valid", async () => {
    gitlabService.validateGitLabToken.mockResolvedValue({
      success: true,
      user: {
        username: "developer123",
      },
    });

    const response = await request(app)
      .post("/api/gitlab/validate-token")
      .send({ token: "valid-token" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      valid: true,
      username: "developer123",
    });
  });
});