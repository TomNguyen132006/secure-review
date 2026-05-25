const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  saveGitLabToken,
  getGitLabToken,
  isGitLabConnected,
  disconnectGitLab,
} = require("../services/gitlabAuthService");

const configDir = path.join(os.homedir(), ".secure-review");
const configPath = path.join(configDir, "config.json");

describe("GitLab Auth Service", () => {
  beforeEach(() => {
    // Remove config file before each test
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }

    // Remove config folder before each test
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
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