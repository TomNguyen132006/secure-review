const { spawnSync } = require("child_process");
const path = require("path");

const {
  getMinimumNodeMajor,
  getNodeVersionError,
} = require("../services/nodeVersion");
const packageJson = require("../package.json");

const REPO_ROOT = path.join(__dirname, "..");

describe("Node.js version check", () => {
  test("minimum comes from package.json engines and is 22", () => {
    expect(packageJson.engines.node).toBe(">=22");
    expect(getMinimumNodeMajor()).toBe(22);
  });

  test.each(["22.0.0", "v22.11.0", "24.13.1", "26.0.0"])("accepts %s", (version) => {
    expect(getNodeVersionError(version)).toBeNull();
  });

  test.each(["20.11.0", "v18.20.4", "16.0.0"])("rejects %s with a clear message", (version) => {
    const message = getNodeVersionError(version);

    expect(message).toContain("requires Node.js 22 or newer");
    expect(message).toContain(`v${version.replace(/^v/, "")}`);
    expect(message).toContain("https://nodejs.org/");
  });

  test("the running Node passes (tests only run on supported versions)", () => {
    expect(getNodeVersionError(process.versions.node)).toBeNull();
  });

  test("the CLI exits 1 with the message on an old Node, before loading anything else", () => {
    const result = spawnSync(
      process.execPath,
      ["-r", path.join(__dirname, "helpers", "fakeOldNode.js"), "bin/secure-review.js", "--help"],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, FAKE_NODE_VERSION: "20.11.0" },
        encoding: "utf8",
      }
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "secure-review requires Node.js 22 or newer, but you are running v20.11.0."
    );
    expect(result.stdout).toBe("");
  });
});
