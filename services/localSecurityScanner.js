function getFileNameFromDiffLine(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine.startsWith("+++ b/")) {
    return null;
  }

  return trimmedLine.replace("+++ b/", "").trim();
}

function createFinding({
  issueType,
  riskLevel,
  explanation,
  suggestedFix,
  fileName,
  lineNumber,
}) {
  return {
    issueType,
    riskLevel,
    explanation,
    suggestedFix,
    fileName,
    lineNumber,
  };
}

function scanSecurityPatterns(codeDiff) {
  if (!codeDiff || typeof codeDiff !== "string") {
    return [];
  }

  const findings = [];
  const lines = codeDiff.split("\n");

  let currentFileName = null;

  const weakPasswords = [
    "admin123",
    "password",
    "123456",
    "qwerty",
    "letmein",
    "welcome",
  ];

  const weakPasswordGroup = weakPasswords.join("|");

  const securityPatterns = [
    {
      regex: /\b(api[_-]?key|apikey)\b\s*=\s*["'][^"']+["']/i,
      issueType: "Hardcoded API Key",
      riskLevel: "High",
      explanation:
        "The code appears to contain a hardcoded API key.",
      suggestedFix:
        "Move API keys to environment variables or a secure secrets manager.",
    },
    {
      regex: /\bpassword\b\s*=\s*["'][^"']+["']/i,
      issueType: "Hardcoded Password",
      riskLevel: "High",
      explanation:
        "The code appears to contain a hardcoded password.",
      suggestedFix:
        "Do not hardcode passwords. Use environment variables, secret storage, or secure authentication services.",
    },
    {
      regex: /\btoken\b\s*=\s*["'][^"']+["']/i,
      issueType: "Hardcoded Token",
      riskLevel: "High",
      explanation:
        "The code appears to contain a hardcoded token.",
      suggestedFix:
        "Move tokens to environment variables or a secure secrets manager.",
    },
    {
      regex: /AKIA[0-9A-Z]{16}/,
      issueType: "AWS Access Key",
      riskLevel: "Critical",
      explanation:
        "The code appears to expose an AWS access key.",
      suggestedFix:
        "Remove the key immediately, rotate the credential, and store it in a secure secrets manager.",
    },
    {
      regex: /-----BEGIN PRIVATE KEY-----/i,
      issueType: "Private Key Exposure",
      riskLevel: "Critical",
      explanation:
        "The code appears to expose a private key.",
      suggestedFix:
        "Remove the private key from source code and rotate the compromised key.",
    },
    {
      regex: /SELECT\s+.*FROM\s+.*WHERE\s+.*\+\s*\w+/i,
      issueType: "SQL Injection Risk",
      riskLevel: "High",
      explanation:
        "The SQL query appears to concatenate user-controlled input directly into the query.",
      suggestedFix:
        "Use parameterized queries or prepared statements instead of string concatenation.",
    },
    {
      regex: /db\.query\(\s*["'`].*SELECT.*\+\s*\w+/i,
      issueType: "Unsafe SQL String Concatenation",
      riskLevel: "High",
      explanation:
        "The database query appears to use unsafe SQL string concatenation.",
      suggestedFix:
        "Use parameterized queries or prepared statements.",
    },
    {
      regex: /fetch\(\s*["'][^"']*(evil|steal|exfiltrate|malicious)[^"']*["']\s*\+/i,
      issueType: "Suspicious Data Exfiltration",
      riskLevel: "Critical",
      explanation:
        "The code appears to send sensitive data to a suspicious external destination.",
      suggestedFix:
        "Review the outbound request, remove unauthorized data transfer, and validate all external endpoints.",
    },
    {
      regex: new RegExp(
        `\\bpassword\\b\\s*=\\s*["'](${weakPasswordGroup})["']`,
        "i"
      ),
      issueType: "Weak Authentication",
      riskLevel: "High",
      explanation:
        "The code assigns a hardcoded weak or default password value.",
      suggestedFix:
        "Do not hardcode default passwords. Use secure password hashing and proper authentication storage.",
    },
    {
      regex: new RegExp(
        `\\bpassword\\b\\s*={2,3}\\s*["'](${weakPasswordGroup})["']`,
        "i"
      ),
      issueType: "Weak Authentication",
      riskLevel: "High",
      explanation:
        "The code directly compares a password to a hardcoded weak default password.",
      suggestedFix:
        "Do not hardcode passwords. Store hashed passwords securely and use a proper authentication system.",
    },
    {
      regex: new RegExp(
        `\\bpassword\\b\\.equals\\(\\s*["'](${weakPasswordGroup})["']\\s*\\)`,
        "i"
      ),
      issueType: "Weak Authentication",
      riskLevel: "High",
      explanation:
        "The code uses Java-style password comparison with a hardcoded weak default password.",
      suggestedFix:
        "Do not compare passwords directly in code. Use secure password hashing and proper authentication validation.",
    },
    {
      regex: new RegExp(
        `\\b(username|user)\\b\\s*={2,3}\\s*["']admin["'].*\\bpassword\\b\\s*={2,3}\\s*["'](${weakPasswordGroup})["']`,
        "i"
      ),
      issueType: "Weak Authentication",
      riskLevel: "High",
      explanation:
        "The code appears to use hardcoded admin credentials with a weak default password.",
      suggestedFix:
        "Remove hardcoded admin credentials. Use secure user management and hashed password storage.",
    },
  ];

  lines.forEach((line, index) => {
    const possibleFileName = getFileNameFromDiffLine(line);

    if (possibleFileName) {
      currentFileName = possibleFileName;
      return;
    }

    const missingValidationFinding = detectMissingValidation(
      lines,
      currentFileName,
      index
    );

    if (missingValidationFinding) {
      findings.push(missingValidationFinding);
    }

    const missingAuthorizationFinding = detectMissingAuthorization(
      line,
      currentFileName,
      index
    );

    if (missingAuthorizationFinding) {
      findings.push(missingAuthorizationFinding);
    }

    securityPatterns.forEach((pattern) => {
      if (pattern.regex.test(line)) {
        findings.push(
          createFinding({
            issueType: pattern.issueType,
            riskLevel: pattern.riskLevel,
            explanation: pattern.explanation,
            suggestedFix: pattern.suggestedFix,
            fileName: currentFileName,
            lineNumber: index + 1,
          })
        );
      }
    });
  });

  return findings;
}

function detectMissingValidation(lines, currentFileName, startIndex) {
  const currentLine = lines[startIndex];

  const hasMappingAnnotation =
    currentLine.includes("@PostMapping") ||
    currentLine.includes("@PutMapping") ||
    currentLine.includes("@PatchMapping");

  if (!hasMappingAnnotation) {
    return null;
  }

  const nearbyCode = lines.slice(startIndex, startIndex + 5).join(" ");

  const hasMethodSignature =
    nearbyCode.includes("public ") ||
    nearbyCode.includes("private ") ||
    nearbyCode.includes("protected ");

  const hasMethodParameter = /\([^)]*\)/.test(nearbyCode);

  const hasValidation =
    nearbyCode.includes("@Valid") || nearbyCode.includes("@Validated");

  if (hasMethodSignature && hasMethodParameter && !hasValidation) {
    return createFinding({
      issueType: "Missing Validation",
      riskLevel: "Medium",
      explanation: "Endpoint accepts user input without validation.",
      suggestedFix:
        "Use @Valid or @Validated with request body objects and define validation rules on the model.",
      fileName: currentFileName,
      lineNumber: startIndex + 1,
    });
  }

  return null;
}

function detectMissingAuthorization(line, currentFileName, lineIndex) {
  const adminRoutePattern =
    /(app|router)\.(get|post|put|patch|delete)\s*\(\s*["'`]\/admin[^"'`]*["'`]/;

  const hasAdminRoute = adminRoutePattern.test(line);

  if (!hasAdminRoute) {
    return null;
  }

  const hasAuthorizationCheck =
    line.includes("requireAdmin") ||
    line.includes('checkRole("admin")') ||
    line.includes("checkRole('admin')");

  if (hasAuthorizationCheck) {
    return null;
  }

  return createFinding({
    issueType: "Missing Authorization Check",
    riskLevel: "High",
    explanation:
      "An admin route appears to be exposed without checking whether the user has an admin role.",
    suggestedFix:
      "Add role-based authorization middleware such as requireAdmin or checkRole('admin').",
    fileName: currentFileName,
    lineNumber: lineIndex + 1,
  });
}

module.exports = {
  scanSecurityPatterns,
};