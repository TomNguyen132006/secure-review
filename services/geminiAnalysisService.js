const { createAbstractDescription } = require("./securityAbstractionService");
const {
  parseGeminiResponse,
} = require("./geminiResponseParserService");

// gemini-1.5-flash was retired in September 2025. gemini-3.8-flash is the
// newest stable Flash model with no announced shutdown date (checked against
// https://ai.google.dev/gemini-api/docs/deprecations, October 2026).
// Override with the GEMINI_MODEL environment variable.
const DEFAULT_MODEL = "gemini-3.8-flash";

const GEMINI_TIMEOUT_MS = 10000;

function getGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/*
  Short, key-free reason for a failed Gemini HTTP response.
*/
function describeGeminiHttpError(status, model) {
  if (status === 400) {
    return "Gemini rejected the request (HTTP 400)";
  }

  if (status === 401 || status === 403) {
    return `Gemini API key was rejected (HTTP ${status})`;
  }

  if (status === 404) {
    return `Gemini model "${model}" was not found (HTTP 404); set GEMINI_MODEL to a current model`;
  }

  if (status === 429) {
    return "Gemini rate limit or quota exceeded (HTTP 429)";
  }

  if (status >= 500) {
    return `Gemini server error (HTTP ${status})`;
  }

  return `Gemini request failed (HTTP ${status})`;
}

/*
  Send one prompt to Gemini.
  The API key goes in the x-goog-api-key header, never in the URL, so it
  cannot leak into logs or error messages.

  Returns:
    { ok: true, text }
    { ok: false, status?, timedOut?, badResponse?, reason }
*/
async function callGemini(prompt, apiKey) {
  const model = getGeminiModel();

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
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  if (typeof timeout.unref === "function") {
    timeout.unref();
  }

  let response;

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        ok: false,
        timedOut: true,
        reason: `Gemini request timed out after ${GEMINI_TIMEOUT_MS / 1000}s`,
      };
    }

    return { ok: false, reason: "could not reach the Gemini API (network error)" };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      reason: describeGeminiHttpError(response.status, model),
    };
  }

  let responseBody;

  try {
    responseBody = await response.json();
  } catch (error) {
    return { ok: false, badResponse: true, reason: "Gemini returned a response that is not JSON" };
  }

  const text = extractGeminiText(responseBody);

  if (!text) {
    return { ok: false, badResponse: true, reason: "Gemini returned an unexpected response format" };
  }

  return { ok: true, text };
}

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

  Returns { finding, skippedReason }. skippedReason is set (and finding is
  the local fallback) when Gemini was not used or failed. It never contains
  the API key.
*/
async function analyzeSecurityFindingWithStatus(finding) {
  const fallbackFinding = buildFallbackFinding(finding);

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { finding: fallbackFinding, skippedReason: "GEMINI_API_KEY is not set" };
    }

    const abstractDescription = createAbstractDescription(finding);
    const prompt = buildGeminiPrompt(abstractDescription);

    const result = await callGemini(prompt, apiKey);

    if (!result.ok) {
      return { finding: fallbackFinding, skippedReason: result.reason };
    }

    return {
      finding: {
        issueType: fallbackFinding.issueType,
        riskLevel: fallbackFinding.riskLevel,
        explanation: result.text,
        suggestedFix: fallbackFinding.suggestedFix,
        fileName: fallbackFinding.fileName,
        lineNumber: fallbackFinding.lineNumber,
        source: "gemini",
      },
      skippedReason: null,
    };
  } catch (error) {
    return {
      finding: fallbackFinding,
      skippedReason: "unexpected error while preparing the Gemini request",
    };
  }
}

/*
  Same as analyzeSecurityFindingWithStatus, but returns only the finding.
*/
async function analyzeSecurityFinding(finding) {
  const { finding: result } = await analyzeSecurityFindingWithStatus(finding);

  return result;
}

/*
  Task 10.1 + 10.2 + 10.3 + 11.3:
    Send a full merge request diff to Gemini for AI security review.
    Handle timeout and API failures safely.
    Parse Gemini structured JSON response safely.
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

    const prompt = `
You are a senior application security engineer.

Review the following GitLab merge request diff for security issues.

Return ONLY valid JSON in this exact format:
{
  "riskLevel": "High",
  "issueType": "SQL Injection",
  "explanation": "User input appears to be directly used in a SQL query.",
  "suggestedFix": "Use parameterized queries or prepared statements."
}

[DIFF START]
${diff}
[DIFF END]
`;

    const result = await callGemini(prompt, apiKey);

    if (!result.ok) {
      if (result.timedOut) {
        return {
          success: false,
          source: "gemini",
          error: "Gemini request timed out",
        };
      }

      if (result.status === 400) {
        return {
          success: false,
          source: "gemini",
          error: "Gemini request was blocked or invalid",
        };
      }

      if (result.status === 401 || result.status === 403) {
        return {
          success: false,
          source: "gemini",
          error: "Gemini API key is invalid or unauthorized",
        };
      }

      if (result.status >= 500) {
        return {
          success: false,
          source: "gemini",
          error: "Gemini server error",
        };
      }

      if (result.status) {
        return {
          success: false,
          source: "gemini",
          error: "Gemini API request failed",
        };
      }

      if (result.badResponse) {
        return {
          success: false,
          source: "gemini",
          error: "Invalid Gemini response format.",
        };
      }

      return {
        success: false,
        source: "gemini",
        error: "Gemini API request failed",
      };
    }

    const geminiText = result.text;

    const parsedResponse = parseGeminiResponse(geminiText);

    if (!parsedResponse.success) {
      return {
        success: false,
        source: "gemini",
        error: parsedResponse.error,
      };
    }

    return {
      success: true,
      source: "gemini",
      riskLevel: parsedResponse.riskLevel,
      issueType: parsedResponse.issueType,
      explanation: parsedResponse.explanation,
      suggestedFix: parsedResponse.suggestedFix,
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
  analyzeSecurityFindingWithStatus,
  callGemini,
  describeGeminiHttpError,
  getGeminiModel,
  DEFAULT_MODEL,
  analyzeDiffWithGemini,
  buildFallbackFinding,
  buildGeminiPrompt,
  extractGeminiText,
};