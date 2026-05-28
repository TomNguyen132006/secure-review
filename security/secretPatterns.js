/*
  Task 5.2 — Secret Detection Patterns

  Purpose:
    Store regex patterns for common hardcoded secrets.

  Each pattern includes:
    - type
    - riskLevel
    - regex
    - explanation
    - suggestedFix
*/

const secretPatterns = [
  {
    type: "API Key",
    riskLevel: "HIGH",
    regex: /api[_-]?key\s*=\s*["'][^"']+["']/i,
    explanation: "An API key appears to be hardcoded in the source code.",
    suggestedFix:
      "Move the API key to an environment variable or a secure secret manager.",
  },
  {
    type: "Hardcoded Password",
    riskLevel: "HIGH",
    regex: /password\s*=\s*["'][^"']+["']/i,
    explanation: "A password appears to be hardcoded in the source code.",
    suggestedFix:
      "Move the password to an environment variable and rotate the exposed password.",
  },
  {
    type: "Access Token",
    riskLevel: "HIGH",
    regex: /token\s*=\s*["'][^"']+["']/i,
    explanation: "An access token appears to be hardcoded in the source code.",
    suggestedFix:
      "Store the token in an environment variable or a secure secret manager.",
  },
  {
    type: "AWS Access Key",
    riskLevel: "CRITICAL",
    regex: /AKIA[0-9A-Z]{16}/,
    explanation: "An AWS access key appears to be hardcoded in the source code.",
    suggestedFix:
      "Remove the AWS key from the code, rotate it in AWS IAM, and store the new key securely.",
  },
  {
    type: "Private Key",
    riskLevel: "CRITICAL",
    regex: /-----BEGIN PRIVATE KEY-----/,
    explanation: "A private key appears to be included in the source code.",
    suggestedFix:
      "Remove the private key from the repository and store it in a secure secret manager.",
  },
];

module.exports = {
  secretPatterns,
};