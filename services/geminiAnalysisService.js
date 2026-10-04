const { createAbstractDescription } = require("./securityAbstractionService");

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
    { ok: false, status?, reason }
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
    return { ok: false, reason: "Gemini returned a response that is not JSON" };
  }

  const text = extractGeminiText(responseBody);

  if (!text) {
    return { ok: false, reason: "Gemini returned an unexpected response format" };
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

module.exports = {
  analyzeSecurityFinding,
  analyzeSecurityFindingWithStatus,
  callGemini,
  describeGeminiHttpError,
  getGeminiModel,
  DEFAULT_MODEL,
  buildFallbackFinding,
  buildGeminiPrompt,
  extractGeminiText,
};