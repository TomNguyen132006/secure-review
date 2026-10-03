const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  saveGitLabToken,
  getGitLabToken,
  isGitLabConnected,
  disconnectGitLab,
} = require("../services/gitlabAuthService");

describe("GitLab Auth Service", () => {
  let tempHome;
  let configDir;
  let configPath;
  let originalConfigPathEnv;

  beforeEach(() => {
    // Use an isolated temp home so tests never touch the real ~/.secure-review
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
    configDir = path.join(tempHome, ".secure-review");
    configPath = path.join(configDir, "config.json");

    process.env.SECURE_REVIEW_HOME = tempHome;

    // SECURE_REVIEW_CONFIG_PATH takes priority, so clear it for the test
    originalConfigPathEnv = process.env.SECURE_REVIEW_CONFIG_PATH;
    delete process.env.SECURE_REVIEW_CONFIG_PATH;
  });

  afterEach(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });

    delete process.env.SECURE_REVIEW_HOME;

    if (originalConfigPathEnv !== undefined) {
      process.env.SECURE_REVIEW_CONFIG_PATH = originalConfigPathEnv;
    }
  });

  test("should save GitLab token and username locally", () => {
    saveGitLabToken("test-token-123", {
      username: "developer123",
    });

    const savedData = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(savedData.gitlabToken).toBe("test-token-123");
    expect(savedData.gitlabUsername).toBe("developer123");
  });

  test("should create config folder and file automatically if missing", () => {
    saveGitLabToken("new-token-456", {
      username: "newuser",
    });

    expect(fs.existsSync(configDir)).toBe(true);
    expect(fs.existsSync(configPath)).toBe(true);
  });

  test("should read saved GitLab token", () => {
    saveGitLabToken("read-token-789", {
      username: "readeruser",
    });

    const token = getGitLabToken();

    expect(token).toBe("read-token-789");
  });

  test("should return null when no GitLab token exists", () => {
    const token = getGitLabToken();

    expect(token).toBe(null);
  });

  test("should return true when GitLab is connected", () => {
    saveGitLabToken("connected-token", {
      username: "connecteduser",
    });

    const connected = isGitLabConnected();

    expect(connected).toBe(true);
  });

  test("should return false when GitLab is not connected", () => {
    const connected = isGitLabConnected();

    expect(connected).toBe(false);
  });

  test("should disconnect GitLab by removing token and username", () => {
    saveGitLabToken("disconnect-token", {
      username: "disconnectuser",
    });

    disconnectGitLab();

    const savedData = JSON.parse(fs.readFileSync(configPath, "utf8"));

    expect(savedData.gitlabToken).toBeUndefined();
    expect(savedData.gitlabUsername).toBeUndefined();
    expect(getGitLabToken()).toBe(null);
    expect(isGitLabConnected()).toBe(false);
  });

  test("should throw error if token is missing", () => {
    expect(() => {
      saveGitLabToken("", {
        username: "developer123",
      });
    }).toThrow("GitLab token is required.");
  });

  test("should throw error if username is missing", () => {
    expect(() => {
      saveGitLabToken("valid-token", {});
    }).toThrow("GitLab username is required.");
  });
});