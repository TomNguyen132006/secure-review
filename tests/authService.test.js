const fs = require("fs");
const path = require("path");
const AuthService = require("../src/AuthService");

describe("AuthService", () => {
  const testConfigPath = path.join(__dirname, "test-config.json");

  // Test setup by beaforeEach() and afterEach()

  beforeEach(() => {
    // Tell AuthService to save token into the fake test config file
    process.env.SECURE_REVIEW_CONFIG_PATH = testConfigPath;

    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });
  afterEach(() => {
    // Clean up the fake config file after test
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }

    delete process.env.SECURE_REVIEW_CONFIG_PATH;
  });

  /*
  test case 2.2 
  */
  test("should process login request with valid token", () => {
    const authService = new AuthService();

    const result = authService.login("glpat_xxxxx");

    expect(result).toBe("Login successful");
  });

    /*
  test case 2.3 
  */
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

  /*
  test case 2.5
  */
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