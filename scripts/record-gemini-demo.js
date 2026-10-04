#!/usr/bin/env node
/*
  Record REAL Gemini results for the demo's built-in examples.

  Run it yourself with your own key (the key is read from the environment
  and never written anywhere):

    node --env-file=.env scripts/record-gemini-demo.js
    node scripts/record-gemini-demo.js --dry-run     # no key, no Gemini call

  For each vulnerable example in demo/src/examples.json it:
    1. runs the real local scanner,
    2. sends each finding through the CLI's real Gemini path
       (analyzeSecurityFindingWithStatus -> abstract description -> callGemini),
    3. writes demo/src/gemini-recordings.json with ONLY: example id, code hash,
       model, timestamp, and per finding the issue type, risk level, line,
       the exact (code-free) prompt that was sent, and Gemini's explanation.

  Nothing is written if any finding was not answered by Gemini, so local
  fallback text can never be shown as "AI" output.
*/
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { scanSecurityPatterns } = require("../services/localSecurityScanner");
const { createAbstractDescription } = require("../services/securityAbstractionService");
const {
  analyzeSecurityFindingWithStatus,
  buildGeminiPrompt,
  getGeminiModel,
} = require("../services/geminiAnalysisService");

const ROOT = path.join(__dirname, "..");
const EXAMPLES_PATH = path.join(ROOT, "demo", "src", "examples.json");
const OUTPUT_PATH = path.join(ROOT, "demo", "src", "gemini-recordings.json");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// The finding exactly as the CLI would analyze it (with the example's file name).
function findingsFor(example) {
  return scanSecurityPatterns(example.code).map((finding) => ({
    ...finding,
    fileName: example.fileName,
  }));
}

// The exact prompt analyzeSecurityFindingWithStatus sends for this finding.
function promptFor(finding) {
  return buildGeminiPrompt(createAbstractDescription(finding)).trim();
}

// Throws if a prompt contains any non-trivial line of the example's code.
function assertNoRawCode(prompt, example) {
  for (const line of example.code.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.length >= 12 && prompt.includes(trimmed)) {
      throw new Error(`Prompt for ${example.id} contains source code; refusing to record.`);
    }
  }
}

/*
  Build the recordings object. `analyze` defaults to the real CLI function;
  tests pass a stub so they never reach the network.
*/
async function recordAll({
  examples = JSON.parse(fs.readFileSync(EXAMPLES_PATH, "utf8")),
  analyze = analyzeSecurityFindingWithStatus,
  model = getGeminiModel(),
  now = () => new Date().toISOString(),
} = {}) {
  const recordings = [];

  for (const example of examples) {
    const findings = [];

    for (const finding of findingsFor(example)) {
      const prompt = promptFor(finding);
      assertNoRawCode(prompt, example);

      const { finding: analyzed, skippedReason } = await analyze(finding);

      if (skippedReason || !analyzed || analyzed.source !== "gemini") {
        throw new Error(
          `Gemini did not answer for ${example.id} line ${finding.lineNumber}` +
            (skippedReason ? `: ${skippedReason}` : "") +
            ". Nothing was written."
        );
      }

      // Allow-list: only these fields are saved.
      findings.push({
        issueType: finding.issueType,
        riskLevel: finding.riskLevel,
        lineNumber: finding.lineNumber,
        geminiInput: prompt,
        explanation: String(analyzed.explanation).trim(),
      });
    }

    recordings.push({
      exampleId: example.id,
      codeSha256: sha256(example.code),
      model,
      recordedAt: now(),
      findings,
    });
  }

  return {
    about:
      "Real Gemini outputs for the built-in examples. Written only by scripts/record-gemini-demo.js; do not edit by hand.",
    recordings,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const examples = JSON.parse(fs.readFileSync(EXAMPLES_PATH, "utf8"));

  if (dryRun) {
    console.log(`Dry run: model would be ${getGeminiModel()}. Nothing is sent or written.\n`);

    for (const example of examples) {
      for (const finding of findingsFor(example)) {
        const prompt = promptFor(finding);
        assertNoRawCode(prompt, example);
        console.log(`--- ${example.id}, line ${finding.lineNumber}: Gemini would receive:\n${prompt}\n`);
      }
    }

    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error(
      "GEMINI_API_KEY is not set. Run: node --env-file=.env scripts/record-gemini-demo.js"
    );
    process.exitCode = 1;
    return;
  }

  const result = await recordAll({ examples });
  const json = `${JSON.stringify(result, null, 2)}\n`;

  // Last safety check: the key must never end up in the file.
  if (json.includes(apiKey)) {
    throw new Error("Refusing to write: output contains the API key.");
  }

  fs.writeFileSync(OUTPUT_PATH, json);

  const count = result.recordings.reduce((sum, item) => sum + item.findings.length, 0);
  console.log(
    `Recorded ${count} Gemini result(s) for ${result.recordings.length} example(s) ` +
      `with ${result.recordings[0] ? result.recordings[0].model : getGeminiModel()} -> ` +
      path.relative(ROOT, OUTPUT_PATH)
  );
  console.log("Review the file, then run `npm test` and commit it.");
}

module.exports = { recordAll, promptFor, findingsFor, sha256, assertNoRawCode };

if (require.main === module) {
  main().catch((error) => {
    console.error(`Recording failed: ${error.message}`);
    process.exitCode = 1;
  });
}
