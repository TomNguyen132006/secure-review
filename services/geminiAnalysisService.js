const { createAbstractDescription } = require("./securityAbstractionService");

const DEFAULT_MODEL = "gemini-1.5-flash";

/*
  Task 6.5 : Return a safe local result when Gemini is unavailable.

*/
function buildFallbackFinding(finding) {
  return {
    issueType: finding.issueType || "Unknown Security Issue",
    riskLevel: finding.riskLevel || "Unknown",
    explanation:
      finding.explanation ||
      "A possible security issue was detected by the local scanner.",
    suggestedFix:
      finding.suggestedFix ||
      "Review the code and apply secure coding best practices.",
    fileName: finding.fileName,
    lineNumber: finding.lineNumber,
    source: "local-fallback",
  };
}

/*
  Create a professional prompt using only the safe abstract description.
*/
function buildGeminiPrompt(abstractDescription) {
  return `
You are a senior application security engineer.

Review the following safe abstract security finding.
Do not ask for raw code.
Explain the risk clearly and provide a safe remediation.

Security Finding:
Issue Type: ${abstractDescription.issueType}
Risk Level: ${abstractDescription.riskLevel}
File Name: ${abstractDescription.fileName || "Not provided"}
Line Number: ${abstractDescription.lineNumber || "Not provided"}
Description: ${abstractDescription.description}

Return a concise explanation and remediation.
`;
}

/*
  Purpose:
    Safely read Gemini's text response.

*/
function extractGeminiText(responseBody) {
  return responseBody?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

/*

  Purpose:
    Send a safe abstract description to Gemini for explanation.

  Flow:
    1. Create abstract description from local finding.
    2. Send only the abstract description to Gemini.
    3. If Gemini succeeds, return enhanced result.
    4. If Gemini fails, return local fallback result.
*/
async function analyzeSecurityFinding(finding) {
  const fallbackFinding = buildFallbackFinding(finding);

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return fallbackFinding;
    }

    const abstractDescription = createAbstractDescription(finding);
    const prompt = buildGeminiPrompt(abstractDescription);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    if (typeof timeout.unref === "function") {
      timeout.unref();
    }

    let response;

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return fallbackFinding;
    }

    const responseBody = await response.json();
    const geminiText = extractGeminiText(responseBody);

    if (!geminiText) {
      return fallbackFinding;
    }

    return {
      issueType: fallbackFinding.issueType,
      riskLevel: fallbackFinding.riskLevel,
      explanation: geminiText,
      suggestedFix: fallbackFinding.suggestedFix,
      fileName: fallbackFinding.fileName,
      lineNumber: fallbackFinding.lineNumber,
      source: "gemini",
    };
  } catch (error) {
    return fallbackFinding;
  }
}

/*
  Task 10.1 + 10.2 + 10.3:
    Send a full merge request diff to Gemini for AI security review.
    Handle timeout and API failures safely.
*/
async function analyzeDiffWithGemini(diff) {
  if (!diff || diff.trim() === "") {
    return {
      success: false,
      source: "gemini",
      error: "No diff provided for Gemini analysis",
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        source: "gemini",
        error: "Missing GEMINI_API_KEY environment variable",
      };
    }

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    const prompt = `
You are a senior application security engineer.

Review the following GitLab merge request diff for security issues.
Return clear security feedback including:
- issue type
- risk level
- explanation
- suggested fix

[DIFF START]
${diff}
[DIFF END]
`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    if (typeof timeout.unref === "function") {
      timeout.unref();
    }

    let response;

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 400) {
        return {
          success: false,
          source: "gemini",
          error: "Gemini request was blocked or invalid",
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          source: "gemini",
          error: "Gemini API key is invalid or unauthorized",
        };
      }

      if (response.status >= 500) {
        return {
          success: false,
          source: "gemini",
          error: "Gemini server error",
        };
      }

      return {
        success: false,
        source: "gemini",
        error: "Gemini API request failed",
      };
    }

    const responseBody = await response.json();
    const geminiText = extractGeminiText(responseBody);

    if (!geminiText) {
      return {
        success: false,
        source: "gemini",
        error: "Gemini returned an invalid response format",
      };
    }

    return {
      success: true,
      source: "gemini",
      message: geminiText,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        success: false,
        source: "gemini",
        error: "Gemini request timed out",
      };
    }

    return {
      success: false,
      source: "gemini",
      error: "Gemini API request failed",
    };
  }
}

module.exports = {
  analyzeSecurityFinding,
  analyzeDiffWithGemini,
  buildFallbackFinding,
  buildGeminiPrompt,
  extractGeminiText,
};