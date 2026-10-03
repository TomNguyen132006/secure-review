const fs = require("fs");
const os = require("os");
const path = require("path");

// Config paths we already warned about, so the warning prints once per run.
const warnedConfigPaths = new Set();

function warnBadConfig(configPath, reason) {
  if (warnedConfigPaths.has(configPath)) {
    return;
  }

  warnedConfigPaths.add(configPath);

  console.warn(
    `Warning: config file ${configPath} ${reason}. Treating it as not logged in. ` +
      "Run `secure-review gitlab login` to fix it."
  );
}

// Read local config. A missing, empty, unreadable or corrupted file is
// treated as "not logged in" instead of crashing.
function readConfig() {
  const configPath = getConfigFilePath();

  if (!fs.existsSync(configPath)) {
    return {};
  }

  let fileContent;

  try {
    fileContent = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    warnBadConfig(configPath, `could not be read (${error.code || error.message})`);
    return {};
  }

  if (fileContent.trim() === "") {
    warnBadConfig(configPath, "is empty");
    return {};
  }

  let config;

  try {
    config = JSON.parse(fileContent);
  } catch (error) {
    warnBadConfig(configPath, "is not valid JSON");
    return {};
  }

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    warnBadConfig(configPath, "does not contain a JSON object");
    return {};
  }

  return config;
}


// Write local config safely.
function writeConfig(config) {
  ensureConfigFile();

  const configFile = getConfigFilePath();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: 0o600 });
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
  config.loginTime = new Date().toISOString();

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


// Single source of truth for the config file location.
// Env vars are read on every call so tests can change them.
function getConfigFilePath() {
  if (process.env.SECURE_REVIEW_CONFIG_PATH) {
    return process.env.SECURE_REVIEW_CONFIG_PATH;
  }

  const homeDir = process.env.SECURE_REVIEW_HOME || os.homedir();

  return path.join(homeDir, ".secure-review", "config.json");
}

function getConfigDir() {
  return path.dirname(getConfigFilePath());
}

// Make sure the config folder and config file exist.
function ensureConfigFile() {
  const configDir = getConfigDir();
  const configFile = getConfigFilePath();

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (!fs.existsSync(configFile)) {
    // The config holds the GitLab token: owner read/write only (ignored on Windows).
    fs.writeFileSync(configFile, JSON.stringify({}, null, 2), { mode: 0o600 });
  }
}

// Disconnect GitLab account.
function disconnectGitLab() {
  if (!fs.existsSync(getConfigFilePath())) {
    return {
      success: true,
      message: "GitLab account disconnected successfully.",
    };
  }

  const config = readConfig();

  delete config.gitlabToken;
  delete config.gitlabUsername;
  delete config.loginTime;

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
  getGitLabUsername,
  getConfigFilePath,
};

/**
 * Task 3.5 — Minh Nguyen
 * Return saved GitLab username if connected.
 */
function getGitLabUsername() {
  const config = readConfig();
  return config.gitlabUsername || null;
}