const fs = require("fs");
const os = require("os");
const path = require("path");

const configDir = path.join(os.homedir(), ".secure-review");
const configPath = path.join(configDir, "config.json");

function ensureConfigDirExists() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function readConfig() {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  const fileContent = fs.readFileSync(configPath, "utf8");

  if (!fileContent) {
    return {};
  }

  return JSON.parse(fileContent);
}



// Write local config safely.
function writeConfig(config) {
  ensureConfigFile();

  const configFile = getConfigFilePath();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

function saveGitLabToken(token, user) {
  if (!token) {
    throw new Error("GitLab token is required.");
  }

  if (!user || !user.username) {
    throw new Error("GitLab username is required.");
  }

  const config = readConfig();

  config.gitlabToken = token;
  config.gitlabUsername = user.username;

  writeConfig(config);

  return {
    success: true,
    message: "GitLab token saved successfully.",
  };
}

// Get saved GitLab token.
function getGitLabToken() {
  const config = readConfig();

  return config.gitlabToken || null;
}

function isGitLabConnected() {
  const token = getGitLabToken();

  return Boolean(token);
}


function getHomeDir() {
  return process.env.SECURE_REVIEW_HOME || os.homedir();
}

function getConfigDir() {
  return path.join(getHomeDir(), ".secure-review");
}

function getConfigFilePath() {
  return path.join(getConfigDir(), "config.json");
}

// Make sure the config folder and config file exist.
function ensureConfigFile() {
  const configDir = getConfigDir();
  const configFile = getConfigFilePath();

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({}, null, 2));
  }
}

// Disconnect GitLab account.
function disconnectGitLab() {
  const config = readConfig();

  delete config.gitlabToken;
  delete config.gitlabUsername;

  writeConfig(config);

  return {
    success: true,
    message: "GitLab account disconnected successfully.",
  };
}

module.exports = {
  saveGitLabToken,
  getGitLabToken,
  isGitLabConnected,
  disconnectGitLab,
  
};