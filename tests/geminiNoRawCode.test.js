const { runHybridScan } = require("../services/hybridScannerService");

/*
  Design guarantee: Gemini only receives abstract descriptions of findings,
  never diff text or source lines. This runs the real scan pipeline with
  Gemini enabled and inspects every request body sent to Gemini.
*/
const SECRET_LINES = [
  'const password = "SuperSecret123!";',
  'const query = "SELECT * FROM users WHERE id = " + req.params.id;',
  'if (password === "admin") {',
];

const MR_CHANGES = {
  changes: [
    {
      old_path: "src/db.js",
      new_path: "src/db.js",
      diff: [
        "@@ -0,0 +1,4 @@",
        `+${SECRET_LINES[0]}`,
        "+function findUser(db, req) {",
        `+  ${SECRET_LINES[1]}`,
        "+}",
        "",
      ].join("\n"),
    },
    {
      old_path: "src/auth.js",
      new_path: "src/auth.js",
      diff: ["@@ -1,1 +1,3 @@", " function login(password) {", `+  ${SECRET_LINES[2]}`, "+  }", ""].join(
        "\n"
      ),
    },
  ],
};

describe("no raw code is sent to Gemini", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "fake-test-key";

    global.fetch = jest.fn(async (url) => {
      if (String(url).startsWith("https://gitlab.com/")) {
        return { ok: true, status: 200, json: async () => MR_CHANGES };
      }

      if (String(url).startsWith("https://generativelanguage.googleapis.com/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "AI explanation" }] } }],
          }),
        };
      }

      throw new Error(`Unexpected request: ${url}`);
    });
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  test("Gemini requests contain no diff text or source lines", async () => {
    const result = await runHybridScan({
      projectId: "group/project",
      mrId: "1",
      token: "glpat-xxxxxxxxxxxxxxxxxxxx",
      onWarning: jest.fn(),
    });

    const geminiBodies = fetch.mock.calls
      .filter(([url]) => String(url).startsWith("https://generativelanguage.googleapis.com/"))
      .map(([, request]) => request.body);

    // One Gemini call per finding, all answered by Gemini.
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
    expect(geminiBodies).toHaveLength(result.findings.length);
    expect(result.findings.every((finding) => finding.source === "gemini")).toBe(true);

    for (const body of geminiBodies) {
      for (const line of SECRET_LINES) {
        expect(body).not.toContain(line);
      }

      expect(body).not.toContain("SuperSecret123!");
      expect(body).not.toContain("req.params.id");
      expect(body).not.toContain("@@ ");
      expect(body).not.toContain("diff --git");
    }
  });
});
