/*
  SecureReview live demo.

  Runs the REAL local detection from the CLI (services/localSecurityScanner.js)
  in the browser. esbuild bundles it into app.js (scripts/build-demo.js).

  Privacy: nothing typed or pasted here leaves the page. This file makes no
  network requests, and the page's Content-Security-Policy sets
  connect-src 'none'. Gemini is never called from the demo: the "AI Review"
  panel shows results recorded with the real CLI code path
  (scripts/record-gemini-demo.js).
*/
import { scanSecurityPatterns } from "../../services/localSecurityScanner.js";
import { createAbstractDescription } from "../../services/securityAbstractionService.js";
import examples from "./examples.json";
import geminiRecordings from "./gemini-recordings.json";

export const PRE_RECORDED_NOTE = "Pre-recorded result. The CLI calls Gemini live.";

function normalizeNewlines(text) {
  return String(text).replace(/\r\n?/g, "\n");
}

export function scanCode(text) {
  return scanSecurityPatterns(normalizeNewlines(text));
}

export function looksLikeDiff(text) {
  return /^(diff --git |@@ -\d|\+\+\+ |--- a\/)/m.test(normalizeNewlines(text));
}

// Which built-in example (if any) is exactly in the textarea.
export function identifyExample(text) {
  const normalized = normalizeNewlines(text);

  for (const example of examples) {
    if (normalized === example.code) {
      return { example, variant: "vulnerable" };
    }

    if (normalized === example.safeCode) {
      return { example, variant: "safe" };
    }
  }

  return null;
}

export function findRecording(exampleId) {
  return (geminiRecordings.recordings || []).find((item) => item.exampleId === exampleId) || null;
}

// Exposed for tests (tests/demoBundle.test.js runs app.js in a sandbox).
if (typeof globalThis !== "undefined") {
  globalThis.SecureReviewDemo = {
    scanCode,
    looksLikeDiff,
    identifyExample,
    findRecording,
    examples,
    PRE_RECORDED_NOTE,
  };
}

/* ------------------------------------------------------------------ UI -- */

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

function severityClass(riskLevel) {
  const level = String(riskLevel || "").toLowerCase();

  return SEVERITY_ORDER[level] === undefined ? "sev sev-unknown" : `sev sev-${level}`;
}

function scannerWorks() {
  try {
    return scanCode('const password = "selftest-value";').length === 1;
  } catch (error) {
    return false;
  }
}

function initUi() {
  const textarea = document.getElementById("code");
  const scanButton = document.getElementById("scan");
  const clearButton = document.getElementById("clear");
  const examplesList = document.getElementById("examples");
  const sourceLabel = document.getElementById("source-label");
  const diffNote = document.getElementById("diff-note");
  const compatBanner = document.getElementById("compat");
  const results = document.getElementById("results");
  const ai = document.getElementById("ai-review");

  // Safety net 1: if this browser cannot run the scanner, say so up front.
  if (!scannerWorks()) {
    compatBanner.hidden = false;
    scanButton.disabled = true;
  }

  function updateSourceLabel() {
    const match = identifyExample(textarea.value);

    if (match) {
      const variant = match.variant === "safe" ? "safe version" : "vulnerable version";
      sourceLabel.textContent = `Built-in example: ${match.example.title} (${variant}) · ${match.example.fileName}`;
    } else if (textarea.value.trim() === "") {
      sourceLabel.textContent = "Paste code or pick an example.";
    } else {
      sourceLabel.textContent = "Your own code (stays in this browser).";
    }

    diffNote.hidden = !looksLikeDiff(textarea.value);
  }

  function loadExample(example, variant) {
    textarea.value = variant === "safe" ? example.safeCode : example.code;
    updateSourceLabel();
    runScan();
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  for (const example of examples) {
    const row = el("li", "example");
    row.appendChild(el("span", "example-title", example.title));

    const buttons = el("div", "example-buttons");
    const vulnerable = el("button", "btn btn-example", "Vulnerable");
    const safe = el("button", "btn btn-example btn-safe", "Safe version");

    vulnerable.type = "button";
    safe.type = "button";
    vulnerable.setAttribute("aria-label", `Load vulnerable example: ${example.title}`);
    safe.setAttribute("aria-label", `Load safe version: ${example.title}`);
    vulnerable.addEventListener("click", () => loadExample(example, "vulnerable"));
    safe.addEventListener("click", () => loadExample(example, "safe"));

    buttons.append(vulnerable, safe);
    row.appendChild(buttons);
    examplesList.appendChild(row);
  }

  function renderFindings(findings, lines, fileName) {
    results.replaceChildren();
    results.appendChild(el("h2", null, "Local detection results"));

    if (findings.length === 0) {
      const empty = el("div", "empty");
      empty.appendChild(el("p", "empty-title", "No issues found by local rules"));
      empty.appendChild(
        el(
          "p",
          "muted",
          "Local rules are pattern-based and can miss things. A clean result is not proof that the code is secure."
        )
      );
      results.appendChild(empty);
      return;
    }

    const highCount = findings.filter((finding) =>
      ["high", "critical"].includes(String(finding.riskLevel).toLowerCase())
    ).length;

    results.appendChild(
      el(
        "p",
        "summary",
        `${findings.length} finding${findings.length === 1 ? "" : "s"}, ${highCount} high-risk.`
      )
    );

    const list = el("ol", "findings");

    for (const finding of findings) {
      const card = el("li", "finding");
      const head = el("div", "finding-head");
      head.appendChild(el("span", severityClass(finding.riskLevel), finding.riskLevel));
      head.appendChild(el("h3", "finding-type", finding.issueType));
      card.appendChild(head);

      card.appendChild(
        el("p", "finding-meta", `Line ${finding.lineNumber}${fileName ? ` · ${fileName}` : ""}`)
      );

      const codeLine = el("pre", "code-line");
      const lineNo = el("span", "code-line-no", String(finding.lineNumber));
      lineNo.setAttribute("aria-hidden", "true");
      codeLine.appendChild(lineNo);
      codeLine.appendChild(el("code", null, lines[finding.lineNumber - 1] || ""));
      card.appendChild(codeLine);

      card.appendChild(el("p", "label", "Why it matters"));
      card.appendChild(el("p", null, finding.explanation));
      card.appendChild(el("p", "label", "Suggested fix"));
      card.appendChild(el("p", null, finding.suggestedFix));

      list.appendChild(card);
    }

    results.appendChild(list);
  }

  function renderAbstract(details, finding, fileName) {
    const abstract = createAbstractDescription({ ...finding, fileName });
    const pre = el(
      "pre",
      "abstract",
      [
        `Issue Type: ${abstract.issueType}`,
        `Risk Level: ${abstract.riskLevel}`,
        `File: ${abstract.fileName}`,
        `Line: ${abstract.lineNumber}`,
        `Description: ${abstract.description}`,
      ].join("\n")
    );
    details.appendChild(pre);
  }

  function renderAi(findings, match) {
    ai.replaceChildren();
    ai.appendChild(el("h2", null, "AI Review (Gemini)"));

    if (findings.length === 0) {
      ai.appendChild(
        el("p", "muted", "No local findings, so the CLI would not send anything to Gemini.")
      );
      return;
    }

    const recording = match && match.variant === "vulnerable" ? findRecording(match.example.id) : null;

    if (recording) {
      ai.appendChild(el("p", "note", PRE_RECORDED_NOTE));
      ai.appendChild(
        el(
          "p",
          "muted",
          `Recorded with ${recording.model} on ${String(recording.recordedAt).slice(0, 10)}.`
        )
      );

      for (const item of recording.findings) {
        const card = el("div", "ai-card");
        card.appendChild(el("h3", null, `${item.issueType} · line ${item.lineNumber}`));

        const details = el("details");
        details.appendChild(el("summary", null, "What Gemini received (no source code)"));
        details.appendChild(el("pre", "abstract", item.geminiInput));
        card.appendChild(details);

        card.appendChild(el("p", "label", "Gemini's explanation"));
        card.appendChild(el("p", "ai-text", item.explanation));
        ai.appendChild(card);
      }

      return;
    }

    if (match && match.variant === "vulnerable") {
      ai.appendChild(
        el(
          "p",
          "muted",
          "No pre-recorded Gemini result for this example yet. The CLI calls Gemini live when GEMINI_API_KEY is set."
        )
      );
    } else {
      ai.appendChild(
        el(
          "p",
          "muted",
          "This demo never calls Gemini, so your own code only gets local results here. AI review is available in the CLI (set GEMINI_API_KEY, see “Run it yourself”)."
        )
      );
    }

    ai.appendChild(
      el(
        "p",
        null,
        "In the CLI, Gemini would receive only a safe abstract description for each finding, never your code:"
      )
    );

    const fileName = match ? match.example.fileName : null;

    for (const finding of findings) {
      const details = el("details");
      details.appendChild(el("summary", null, `${finding.issueType} · line ${finding.lineNumber}`));
      renderAbstract(details, finding, fileName);
      ai.appendChild(details);
    }
  }

  function runScan() {
    const text = textarea.value;
    const match = identifyExample(text);
    let findings;

    try {
      findings = scanCode(text);
    } catch (error) {
      // Safety net 2: never fail silently.
      compatBanner.hidden = false;
      results.replaceChildren(
        el("p", "error", "The scanner could not run in this browser. See the note at the top of the page.")
      );
      ai.replaceChildren();
      return;
    }

    findings.sort((a, b) => a.lineNumber - b.lineNumber);

    const lines = normalizeNewlines(text).split("\n");
    renderFindings(findings, lines, match ? match.example.fileName : null);
    renderAi(findings, match);
    results.hidden = false;
    ai.hidden = false;
  }

  textarea.addEventListener("input", updateSourceLabel);
  scanButton.addEventListener("click", runScan);
  clearButton.addEventListener("click", () => {
    textarea.value = "";
    updateSourceLabel();
    results.hidden = true;
    ai.hidden = true;
    textarea.focus();
  });

  updateSourceLabel();
}

if (typeof document !== "undefined" && document.getElementById("code")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUi);
  } else {
    initUi();
  }
}
