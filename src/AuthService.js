const fs = require("fs");
const os = require("os");
const path = require("path");

class AuthService {
  constructor() {
    this.configPath =
      process.env.SECURE_REVIEW_CONFIG_PATH ||
      path.join(os.homedir(), ".secure-review", "config.json");
  }

  // Task 2.2 / 2.5
  login(token) {
    if (!token) {
      throw new Error("Missing GitLab token");
    }

    if (!this.isValidGitLabToken(token)) {
      throw new Error("Invalid GitLab token");
    }

    this.saveToken(token);

    return "Login successful";
  }

  // Task 2.3
  saveToken(token) {
    const configDir = path.dirname(this.configPath);

    fs.mkdirSync(configDir, { recursive: true });

    const configData = {
      gitlabToken: token,
      loginTime: new Date().toISOString(),
    };

    fs.writeFileSync(
      this.configPath,
      JSON.stringify(configData, null, 2),
      "utf8"
    );
  }

  // Task 2.4
  readSavedToken() {
    if (!fs.existsSync(this.configPath)) {
      return null;
    }

    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
      return config.gitlabToken || null;
    } catch (error) {
      return null;
    }
  }

  // Task 2.5
  isValidGitLabToken(token) {
      return typeof token === "string" && token.startsWith("glpat_");
    }

  // Task 2.6
  logout() {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }

    return "Logged out successfully";
  }

  /*
  Helper method
   Return the config file path.
  */
  getConfigPath() {
    return this.configPath;
  
  }
}

  

module.exports = AuthService;