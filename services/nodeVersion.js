/*
  Node.js version check, run first by bin/secure-review.js before any other
  module is loaded. Written in old-style syntax (var, no arrow functions,
  no optional chaining) so that even very old Node versions can parse it
  and print the message instead of a syntax error.

  The minimum comes from "engines.node" in package.json (e.g. ">=22").
*/
var packageJson = require("../package.json");

function getMinimumNodeMajor() {
  var match = /(\d+)/.exec((packageJson.engines && packageJson.engines.node) || "");

  return match ? Number(match[1]) : 0;
}

function getNodeVersionError(currentVersion, minimumMajor) {
  var minimum = minimumMajor === undefined ? getMinimumNodeMajor() : minimumMajor;
  var major = Number(String(currentVersion).replace(/^v/, "").split(".")[0]);

  if (!major || major >= minimum) {
    return null;
  }

  return (
    "secure-review requires Node.js " +
    minimum +
    " or newer, but you are running v" +
    String(currentVersion).replace(/^v/, "") +
    ".\n" +
    "Install the current LTS version from https://nodejs.org/ and try again."
  );
}

module.exports = {
  getMinimumNodeMajor: getMinimumNodeMajor,
  getNodeVersionError: getNodeVersionError,
};
