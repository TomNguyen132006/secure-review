const { postMergeRequestComment } = require("../services/gitlabCommentService");

describe("gitlabCommentService", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("posts merge request comment successfully", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
    });

    const result = await postMergeRequestComment(
      "TomNguyen132006/secure-review",
      "123",
      "fake-token",
      "# SecureReview Report"
    );

    expect(result.success).toBe(true);
    expect(result.message).toBe("GitLab MR comment posted successfully.");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/TomNguyen132006%2Fsecure-review/merge_requests/123/notes",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "PRIVATE-TOKEN": "fake-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ body: "# SecureReview Report" }),
      })
    );
  });

  test("handles invalid token", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await postMergeRequestComment(
      "project",
      "123",
      "bad-token",
      "report"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid or expired GitLab token.");
  });

  test("handles merge request not found", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await postMergeRequestComment(
      "project",
      "999",
      "fake-token",
      "report"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Merge request not found.");
  });

  test("handles GitLab API failure", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await postMergeRequestComment(
      "project",
      "123",
      "fake-token",
      "report"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Unable to post GitLab MR comment.");
  });

  test("handles network failure", async () => {
    global.fetch.mockRejectedValue(new Error("network failed"));

    const result = await postMergeRequestComment(
      "project",
      "123",
      "fake-token",
      "report"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("Unable to post GitLab MR comment.");
  });

  test("rejects missing required data", async () => {
    const result = await postMergeRequestComment("", "", "", "");

    expect(result.success).toBe(false);
    expect(result.message).toBe("Missing required GitLab comment information.");
  });
});