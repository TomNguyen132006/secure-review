const {
  fetchMergeRequestDiff,
} = require("../services/gitlabMergeRequestService");

global.fetch = jest.fn();

describe("fetchMergeRequestDiff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should send request to GitLab with token in header", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        changes: [
          {
            old_path: "src/app.js",
            new_path: "src/app.js",
            diff: "+ console.log('hello');",
            new_file: false,
            renamed_file: false,
            deleted_file: false,
          },
        ],
      }),
    });

    const result = await fetchMergeRequestDiff("123", "5", "fake-token");

    expect(fetch).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/123/merge_requests/5/changes",
      {
        method: "GET",
        headers: {
          "PRIVATE-TOKEN": "fake-token",
        },
      }
    );

    expect(result.success).toBe(true);
  });

  test("should return changed files from merge request diff", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        changes: [
          {
            old_path: "src/index.js",
            new_path: "src/index.js",
            diff: "- old code\n+ new code",
            new_file: false,
            renamed_file: false,
            deleted_file: false,
          },
          {
            old_path: "src/login.js",
            new_path: "src/login.js",
            diff: "+ function login() {}",
            new_file: true,
            renamed_file: false,
            deleted_file: false,
          },
        ],
      }),
    });

    const result = await fetchMergeRequestDiff("123", "10", "fake-token");

    expect(result.success).toBe(true);
    expect(result.mrId).toBe("10");
    expect(result.changes).toHaveLength(2);

    expect(result.changes[0]).toEqual({
      old_path: "src/index.js",
      new_path: "src/index.js",
      diff: "- old code\n+ new code",
      new_file: false,
      renamed_file: false,
      deleted_file: false,
    });
  });

  test("should support multiple changed files", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        changes: [
          {
            old_path: "src/app.js",
            new_path: "src/app.js",
            diff: "app diff",
            new_file: false,
            renamed_file: false,
            deleted_file: false,
          },
          {
            old_path: "src/utils.js",
            new_path: "src/helpers.js",
            diff: "rename diff",
            new_file: false,
            renamed_file: true,
            deleted_file: false,
          },
        ],
      }),
    });

    const result = await fetchMergeRequestDiff("123", "10", "fake-token");

    expect(result.success).toBe(true);
    expect(result.changes).toHaveLength(2);
    expect(result.changes[1].renamed_file).toBe(true);
  });

  test("should handle empty diff", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        changes: [],
      }),
    });

    const result = await fetchMergeRequestDiff("123", "10", "fake-token");

    expect(result.success).toBe(true);
    expect(result.mrId).toBe("10");
    expect(result.changes).toEqual([]);
  });

  test("should return error when GitLab request fails", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        message: "404 Not found",
      }),
    });

    const result = await fetchMergeRequestDiff("123", "999", "fake-token");

    expect(result.success).toBe(false);
    expect(result.message).toBe("Error: Merge request not found.");
    expect(result.status).toBe(404);
  });

  test("should return error when projectId, mrId, or token is missing", async () => {
    const result = await fetchMergeRequestDiff("", "5", "");

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "Project ID, merge request ID, and token are required."
    );
    expect(fetch).not.toHaveBeenCalled();
  });

    /**
     * Story 4 | Task 4.4 — Minh Nguyen
     * Test 404 invalid merge request response.
     */
    test("should return clear error when merge request is not found", async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({}),
        });

        const result = await fetchMergeRequestDiff("123", "999", "fake-token");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Error: Merge request not found.");
        expect(result.status).toBe(404);
    });

    /**
     * Story 4 | Task 4.5 — Minh Nguyen
     * Test private repo unauthorized or expired token response.
     */
    test("should return clear error when token is invalid or expired", async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({}),
        });

        const result = await fetchMergeRequestDiff("123", "5", "bad-token");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Error: Invalid or expired GitLab token.");
        expect(result.status).toBe(401);
    });

    /**
     * Story 4 | Task 4.4 — Minh Nguyen
     * Test GitLab server failure.
     */
    test("should return clear error when GitLab API fails", async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({}),
        });

        const result = await fetchMergeRequestDiff("123", "5", "fake-token");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Error: Unable to fetch merge request diff.");
        expect(result.status).toBe(500);
    });

    /**
     * Story 4 | Task 4.4 — Minh Nguyen
     * Test network failure.
     */
    test("should return clear error when network request fails", async () => {
        fetch.mockRejectedValueOnce(new Error("Network failure"));

        const result = await fetchMergeRequestDiff("123", "5", "fake-token");

        expect(result.success).toBe(false);
        expect(result.message).toBe("Error: Unable to fetch merge request diff.");
    });
});