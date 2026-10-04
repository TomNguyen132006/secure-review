const crypto = require("crypto");

const { scanSecurityPatterns } = require("../services/localSecurityScanner");
const { recordAll, promptFor, findingsFor } = require("../scripts/record-gemini-demo");
const examples = require("../demo/src/examples.json");
const recordingsFile = require("../demo/src/gemini-recordings.json");

const ALLOWED_RECORDING_KEYS = ["exampleId", "codeSha256", "model", "recordedAt", "findings"];
const ALLOWED_FINDING_KEYS = ["issueType", "riskLevel", "lineNumber", "geminiInput", "explanation"];

/*
  demo/src/gemini-recordings.json holds REAL Gemini outputs written by
  scripts/record-gemini-demo.js. These tests keep it honest and safe.
  (The recording script itself is tested with a stub; no test calls Gemini.)
*/
describe("committed Gemini recordings", () => {
  const recordings = recordingsFile.recordings;

  test("file has the expected shape", () => {
    expect(Array.isArray(recordings)).toBe(true);
  });

  // Loops instead of test.each so the file also passes before anything is recorded.
  test("every recording matches its current example and scanner output", () => {
    for (const recording of recordings) {
      const example = examples.find((item) => item.id === recording.exampleId);
      expect(example).toBeDefined();

      const hash = crypto.createHash("sha256").update(example.code, "utf8").digest("hex");
      expect(recording.codeSha256).toBe(hash);

      const local = scanSecurityPatterns(example.code).map(({ issueType, lineNumber }) => ({
        issueType,
        lineNumber,
      }));
      expect(recording.findings.map(({ issueType, lineNumber }) => ({ issueType, lineNumber }))).toEqual(
        local
      );
    }
  });

  test("every recording has only allow-listed fields, no secrets, no raw code sent", () => {
    for (const recording of recordings) {
      const example = examples.find((item) => item.id === recording.exampleId);

      expect(Object.keys(recording).sort()).toEqual([...ALLOWED_RECORDING_KEYS].sort());

      for (const finding of recording.findings) {
        expect(Object.keys(finding).sort()).toEqual([...ALLOWED_FINDING_KEYS].sort());
        expect(finding.explanation.trim()).not.toBe("");

        for (const line of example.code.split("\n").map((item) => item.trim())) {
          if (line.length >= 12) {
            expect(finding.geminiInput).not.toContain(line);
          }
        }
      }

      const json = JSON.stringify(recording);
      expect(json).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|x-goog-api-key|[?&]key=|generativelanguage/);
    }
  });
});

describe("scripts/record-gemini-demo.js (with a stubbed Gemini call)", () => {
  const geminiStub = jest.fn(async (finding) => ({
    finding: { ...finding, explanation: `stubbed explanation for ${finding.issueType}`, source: "gemini" },
    skippedReason: null,
  }));

  test("records allow-listed fields for every finding of every example", async () => {
    const result = await recordAll({
      examples,
      analyze: geminiStub,
      model: "test-model",
      now: () => "2026-01-01T00:00:00.000Z",
    });

    expect(result.recordings.map((item) => item.exampleId)).toEqual(examples.map((item) => item.id));

    for (const recording of result.recordings) {
      expect(Object.keys(recording).sort()).toEqual([...ALLOWED_RECORDING_KEYS].sort());
      expect(recording.model).toBe("test-model");

      for (const finding of recording.findings) {
        expect(Object.keys(finding).sort()).toEqual([...ALLOWED_FINDING_KEYS].sort());
      }
    }
  });

  test("the recorded prompt is exactly what the CLI sends, and contains no code", () => {
    for (const example of examples) {
      for (const finding of findingsFor(example)) {
        const prompt = promptFor(finding);

        expect(prompt).toContain(`Issue Type: ${finding.issueType}`);
        expect(prompt).toContain(`File Name: ${example.fileName}`);
        expect(prompt).not.toContain(example.code.split("\n")[finding.lineNumber - 1].trim());
      }
    }
  });

  test("writes nothing when Gemini was skipped", async () => {
    const skipped = jest.fn(async (finding) => ({
      finding: { ...finding, source: "local-fallback" },
      skippedReason: "GEMINI_API_KEY is not set",
    }));

    await expect(recordAll({ examples, analyze: skipped })).rejects.toThrow(
      "GEMINI_API_KEY is not set. Nothing was written."
    );
  });

  test("refuses local fallback text even without a skip reason", async () => {
    const fallback = jest.fn(async (finding) => ({
      finding: { ...finding, source: "local-fallback" },
      skippedReason: null,
    }));

    await expect(recordAll({ examples, analyze: fallback })).rejects.toThrow("Nothing was written.");
  });
});
