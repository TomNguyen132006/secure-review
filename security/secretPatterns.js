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
    issueType: "Hardcoded API Key",
    riskLevel: "HIGH",
    regex: /api[_-]?key\s*=\s*["'][^"']+["']/i,
    explanation: "API key is stored directly in source code.",
    suggestedFix: "Move the secret to environment variables or Google Secret Manager.",
  },
  {
    type: "Hardcoded Password",
    issueType: "Hardcoded Password",
    riskLevel: "HIGH",
    regex: /password\s*=\s*["'][^"']+["']/i,
    explanation: "Password is stored directly in source code.",
    suggestedFix: "Move the password to environment variables or Google Secret Manager.",
  },
  {
    type: "Access Token",
    issueType: "Hardcoded Token",
    riskLevel: "HIGH",
    regex: /token\s*=\s*["'][^"']+["']/i,
    explanation: "Access token is stored directly in source code.",
    suggestedFix: "Move the token to environment variables or Google Secret Manager.",
  },
  {
    type: "AWS Access Key",
    issueType: "AWS Access Key",
    riskLevel: "CRITICAL",
    regex: /AKIA[0-9A-Z]{16}/,
    explanation: "AWS access key appears to be hardcoded in source code.",
    suggestedFix: "Remove the key and rotate it immediately in AWS IAM.",
  },
  {
    type: "Private Key",
    issueType: "Private Key",
    riskLevel: "CRITICAL",
    regex: /-----BEGIN PRIVATE KEY-----/,
    explanation: "Private key is stored directly in source code.",
    suggestedFix: "Remove the private key and store it securely outside the repository.",
  },
];

module.exports = {
  secretPatterns,
};