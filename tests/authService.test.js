// Import Node.js file system module
// fs helps us check, read, write, and delete files during the test
const fs = require("fs");

// Import Node.js path module
// path helps us create safe file paths
const path = require("path");

// Import AuthService from src/AuthService.js
const AuthService = require("../src/AuthService");

describe("AuthService", () => {
  // Create a fake config file path for testing only
  // This prevents the test from touching your real computer config file
  const testConfigPath = path.join(__dirname, "test-config.json");

  // Run before each test
  beforeEach(() => {
    // Tell AuthService to save token into the fake test config file
    process.env.SECURE_REVIEW_CONFIG_PATH = testConfigPath;

    // If old test config exists, delete it before starting
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  // Run after each test
  afterEach(() => {
    // Clean up the fake config file after test
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }

    // Remove test-only environment variable
    delete process.env.SECURE_REVIEW_CONFIG_PATH;
  });

  test("should process login request with valid token", () => {
    const authService = new AuthService();

    const result = authService.login("glpat_xxxxx");

    expect(result).toBe("Login successful");
  });

  test("should store token locally", () => {
    const authService = new AuthService();

    authService.login("glpat_xxxxx");

    const savedConfig = JSON.parse(fs.readFileSync(testConfigPath, "utf8"));

    expect(savedConfig.gitlabToken).toBe("glpat_xxxxx");
  });

  test("should store login time locally", () => {
    const authService = new AuthService();

    authService.login("glpat_xxxxx");

    const savedConfig = JSON.parse(fs.readFileSync(testConfigPath, "utf8"));

    expect(savedConfig.loginTime).toBeDefined();
  });

  test("should create config file after successful login", () => {
    const authService = new AuthService();

    authService.login("glpat_xxxxx");

    expect(fs.existsSync(testConfigPath)).toBe(true);
  });

  test("should fail when token is missing", () => {
    const authService = new AuthService();

    expect(() => {
      authService.login("");
    }).toThrow("Missing GitLab token");
  });

  test("should fail when token format is invalid", () => {
    const authService = new AuthService();

    expect(() => {
      authService.login("wrong_token");
    }).toThrow("Invalid GitLab token");
  });
});