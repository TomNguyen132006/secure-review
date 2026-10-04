const { createAbstractDescription } = require("./securityAbstractionService");

// gemini-1.5-flash was retired in September 2025. gemini-3.8-flash is the
// newest stable Flash model with no announced shutdown date (checked against
// https://ai.google.dev/gemini-api/docs/deprecations, October 2026).
// Override with the GEMINI_MODEL environment variable.
const DEFAULT_MODEL = "gemini-3.8-flash";

// Per-request timeout. Override with GEMINI_TIMEOUT_MS (milliseconds).
const DEFAULT_GEMINI_TIMEOUT_MS = 30000;
const MAX_GEMINI_TIMEOUT_MS = 600000;

function getGeminiModel() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

// GEMINI_TIMEOUT_MS if it is a whole number of milliseconds (1..600000),
// otherwise the default. Read on every call so it can change at runtime.
function getGeminiTimeoutMs() {
  const raw = String(process.env.GEMINI_TIMEOUT_MS || "").trim();

  if (!/^\d+$/.test(raw)) {
    return DEFAULT_GEMINI_TIMEOUT_MS;
  }

  const value = Number(raw);

  return value >= 1 && value <= MAX_GEMINI_TIMEOUT_MS ? value : DEFAULT_GEMINI_TIMEOUT_MS;
}

// An API key is plain printable ASCII with no spaces. Anything else (smart
// quotes, a BOM, a line break pasted into .env, ...) cannot be sent in an
// HTTP header and would otherwise surface as a confusing "network error".
function hasInvalidKeyCharacters(apiKey) {
  return !/^[\x21-\x7e]+$/.test(apiKey);
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

  options.timeoutMs overrides GEMINI_TIMEOUT_MS / the default.

  Returns:
    { ok: true, text }
    { ok: false, status?, retryable, reason }
  retryable is true only for failures that may pass on a second try
  (timeout, network error, HTTP 429 or 5xx).
*/
async function callGemini(prompt, apiKey, options = {}) {
  const model = getGeminiModel();
  const timeoutMs = options.timeoutMs || getGeminiTimeoutMs();

  if (hasInvalidKeyCharacters(apiKey)) {
    return {
      ok: false,
      retryable: false,
      reason:
        "GEMINI_API_KEY contains invalid characters (only plain ASCII without spaces or line breaks is allowed)",
    };
  }

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
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
        retryable: true,
        reason: `Gemini request timed out after ${timeoutMs / 1000}s`,
      };
    }

    return { ok: false, retryable: true, reason: "could not reach the Gemini API (network error)" };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
      reason: describeGeminiHttpError(response.status, model),
    };
  }

  let responseBody;

  try {
    responseBody = await response.json();
  } catch (error) {
    return { ok: false, retryable: false, reason: "Gemini returned a response that is not JSON" };
  }

  const text = extractGeminiText(responseBody);

  if (!text) {
    return { ok: false, retryable: false, reason: "Gemini returned an unexpected response format" };
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

  Returns { finding, skippedReason, retryable? }. skippedReason is set (and
  finding is the local fallback) when Gemini was not used or failed; it
  never contains the API key. retryable (only on failures) says whether a
  second try might succeed. options.timeoutMs is passed to callGemini.
*/
async function analyzeSecurityFindingWithStatus(finding, options = {}) {
  const fallbackFinding = buildFallbackFinding(finding);

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return { finding: fallbackFinding, skippedReason: "GEMINI_API_KEY is not set" };
    }

    const abstractDescription = createAbstractDescription(finding);
    const prompt = buildGeminiPrompt(abstractDescription);

    const result = await callGemini(prompt, apiKey, { timeoutMs: options.timeoutMs });

    if (!result.ok) {
      return {
        finding: fallbackFinding,
        skippedReason: result.reason,
        retryable: result.retryable === true,
      };
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
  getGeminiTimeoutMs,
  DEFAULT_GEMINI_TIMEOUT_MS,
  DEFAULT_MODEL,
  buildFallbackFinding,
  buildGeminiPrompt,
  extractGeminiText,
};