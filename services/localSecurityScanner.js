/*
    Task 6.3 : Scan code diff locally for common security risks before sending anything to Gemini.
*/

const SECURITY_PATTERNS = [
  {
    issueType: "Hardcoded API Key",
    riskLevel: "High",
    pattern: /api[_-]?key\s*[:=]\s*["'][^"']{6,}["']/i,
    explanation:
      "An API key appears to be hardcoded in the source code. Hardcoded secrets can be leaked through Git history or shared repositories.",
    suggestedFix:
      "Move the API key to an environment variable or a secure secret manager.",
  },
  {
    issueType: "Hardcoded Password",
    riskLevel: "High",
    pattern: /password\s*[:=]\s*["'][^"']{4,}["']/i,
    explanation:
      "A password appears to be hardcoded in the source code. This can expose credentials to anyone with access to the repository.",
    suggestedFix:
      "Store passwords in environment variables or a secure secret manager. Never commit real passwords to source control.",
  },
  {
    issueType: "Hardcoded Token",
    riskLevel: "High",
    pattern: /token\s*[:=]\s*["'][^"']{6,}["']/i,
    explanation:
      "A token appears to be hardcoded in the source code. Tokens can provide access to private APIs, accounts, or services.",
    suggestedFix:
      "Move the token to an environment variable and rotate the exposed token if it was real.",
  },
  {
    issueType: "AWS Access Key",
    riskLevel: "Critical",
    pattern: /AKIA[0-9A-Z]{16}/,
    explanation:
      "An AWS access key pattern was detected. Exposed AWS keys can allow unauthorized access to cloud resources.",
    suggestedFix:
      "Remove the key from the code, rotate it immediately in AWS IAM, and use environment variables or IAM roles instead.",
  },
  {
    issueType: "Private Key Exposure",
    riskLevel: "Critical",
    pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
    explanation:
      "A private key appears to be included in the code. Private keys should never be committed to source control.",
    suggestedFix:
      "Remove the private key, rotate it immediately, and store it securely using a secret manager.",
  },
  {
    issueType: "SQL Injection Risk",
    riskLevel: "High",
    pattern: /(SELECT|INSERT|UPDATE|DELETE).*["'`]\s*\+\s*[a-zA-Z_$][\w$]*/i,
    explanation:
      "SQL query text appears to be combined with a variable using string concatenation. This can allow SQL injection if user input is included.",
    suggestedFix:
      "Use parameterized queries or prepared statements instead of building SQL strings manually.",
  },
  {
    issueType: "Unsafe SQL String Concatenation",
    riskLevel: "High",
    pattern: /query\s*\(\s*["'`].*(SELECT|INSERT|UPDATE|DELETE).*\+\s*[a-zA-Z_$][\w$]*/i,
    explanation:
      "A database query appears to use string concatenation. This is risky when variables contain user-controlled input.",
    suggestedFix:
      "Use safe query parameters, prepared statements, or an ORM query builder.",
  },
  {
  issueType: "Suspicious Data Exfiltration",
  riskLevel: "Critical",
  pattern:
    /(fetch|axios\.post|axios\.get|http\.request|https\.request)\s*\([^)]*(token|password|secret|apiKey|cookie|localStorage|sessionStorage)/i,
  explanation:
    "Code appears to send sensitive data using an external request. This may indicate data exfiltration.",
  suggestedFix:
    "Remove the suspicious request, verify the destination domain, and never send secrets, tokens, cookies, or stored user data to untrusted services.",
  },
];

/*
  Function:
    scanSecurityPatterns(codeDiff)

  Input:
    codeDiff - string containing code or GitLab merge request diff

  Output:
    Array of findings

  Example output:
    [
      {
        issueType: "Hardcoded Password",
        riskLevel: "High",
        explanation: "...",
        suggestedFix: "..."
      }
    ]
*/
function scanSecurityPatterns(codeDiff) {
  if (!codeDiff || typeof codeDiff !== "string") {
    return [];
  }

  const findings = [];

  SECURITY_PATTERNS.forEach((securityPattern) => {
    if (securityPattern.pattern.test(codeDiff)) {
      findings.push({
        issueType: securityPattern.issueType,
        riskLevel: securityPattern.riskLevel,
        explanation: securityPattern.explanation,
        suggestedFix: securityPattern.suggestedFix,
      });
    }
  });

  return findings;
}

module.exports = {
  scanSecurityPatterns,
};