/*
  Task 5.1
  Purpose:
    Scan GitLab merge request diff changes and detect hardcoded secrets.
  Example change object:
    {
      new_path: "src/config.js",
      old_path: "src/config.js",
      diff: "+const password = 'secret123';"
    }

  Output:
    Array of detected security issues.

  Example output:
    [
      {
        file: "src/config.js",
        line: 1,
        type: "Hardcoded Password",
        riskLevel: "HIGH",
        explanation: "A password appears to be hardcoded in the source code.",
        suggestedFix: "Move the secret to an environment variable or a secure secret manager."
      }
    ]
*/

const SECRET_PATTERNS = [
  {
    type: "Private Key",
    riskLevel: "CRITICAL",
    regex: /-----BEGIN\s+(RSA\s+|DSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----/i,
    explanation: "A private key appears to be included in the code.",
    suggestedFix:
      "Remove the private key from the repository and store it in a secure secret manager.",
  },
  {
    type: "Database URL",
    riskLevel: "CRITICAL",
    regex:
      /(postgres|postgresql|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^/\s]+/i,
    explanation: "A database connection URL with credentials appears to be hardcoded.",
    suggestedFix:
      "Move the database URL to an environment variable and rotate the exposed credentials.",
  },
  {
    type: "Access Token",
    riskLevel: "HIGH",
    regex:
      /(access[_-]?token|auth[_-]?token|github[_-]?token|gitlab[_-]?token)\s*[:=]\s*["'][^"']{12,}["']/i,
    explanation: "An access token appears to be hardcoded in the source code.",
    suggestedFix:
      "Store access tokens in environment variables or a secure secret manager.",
  },
  {
    type: "Access Token",
    riskLevel: "HIGH",
    regex: /\b(ghp_|glpat-)[A-Za-z0-9_\-]{15,}\b/,
    explanation: "A GitHub or GitLab-style token appears to be hardcoded.",
    suggestedFix:
      "Remove the token, rotate it, and store the new token securely.",
  },
  {
    type: "API Key",
    riskLevel: "HIGH",
    regex:
      /(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i,
    explanation: "An API key appears to be hardcoded in the source code.",
    suggestedFix:
      "Move the API key to an environment variable or a secure secret manager.",
  },
  {
    type: "Hardcoded Password",
    riskLevel: "HIGH",
    regex:
      /(password|passwd|pwd)\s*[:=]\s*["'][^"']{6,}["']/i,
    explanation: "A password appears to be hardcoded in the source code.",
    suggestedFix:
      "Move the password to an environment variable and rotate the exposed password.",
  },
  {
    type: "JWT Secret",
    riskLevel: "HIGH",
    regex:
      /(jwt[_-]?secret|jwtsecret|token[_-]?secret)\s*[:=]\s*["'][^"']{8,}["']/i,
    explanation: "A JWT secret appears to be hardcoded in the source code.",
    suggestedFix:
      "Store the JWT secret in an environment variable or secure secret manager.",
  },
];

/*
  Common fake values should not be reported.

  This helps reduce false positives.
*/
const PLACEHOLDER_VALUES = [
  "password",
  "changeme",
  "change_me",
  "your-password",
  "your_password",
  "your-api-key",
  "your_api_key",
  "example",
  "example_key",
  "test",
  "dummy",
  "placeholder",
];

/*
  Extracts the value inside quotes.

  Example:
    const password = "secret123";

  Returns:
    secret123
*/
function extractQuotedValue(line) {
  const match = line.match(/["']([^"']+)["']/);
  return match ? match[1] : "";
}

/*
  Checks if the detected value is probably fake.

  Example:
    password = "password"
    apiKey = "your-api-key"

  These should not be reported.
*/
function isPlaceholderValue(line) {
  const value = extractQuotedValue(line).toLowerCase().trim();

  if (!value) {
    return false;
  }

  return PLACEHOLDER_VALUES.includes(value);
}

/*
  Git diff lines:
    + added line
    - removed line
      unchanged line

  We only scan added lines because the goal is to scan
  new code introduced by the merge request.
*/
function getAddedLines(diff) {
  if (!diff || typeof diff !== "string") {
    return [];
  }

  return diff
    .split("\n")
    .map((line, index) => ({
      content: line,
      lineNumber: index + 1,
    }))
    .filter((line) => {
      return (
        line.content.startsWith("+") &&
        !line.content.startsWith("+++") &&
        line.content.trim().length > 1
      );
    });
}

/*
  Main scanner function.
*/
function scanForSecrets(changes = []) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return [];
  }

  const issues = [];

  changes.forEach((change) => {
    const file = change.new_path || change.old_path || "unknown file";
    const addedLines = getAddedLines(change.diff);

    addedLines.forEach((line) => {
      const cleanLine = line.content.substring(1).trim();

      if (isPlaceholderValue(cleanLine)) {
        return;
      }

      SECRET_PATTERNS.forEach((pattern) => {
        if (pattern.regex.test(cleanLine)) {
          issues.push({
            file,
            line: line.lineNumber,
            type: pattern.type,
            riskLevel: pattern.riskLevel,
            explanation: pattern.explanation,
            suggestedFix: pattern.suggestedFix,
          });
        }
      });
    });
  });

  return issues;
}

module.exports = {
  scanForSecrets,
};