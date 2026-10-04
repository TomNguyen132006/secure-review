const crypto = require("crypto");

const { scanSecurityPatterns } = require("../services/localSecurityScanner");
const { recordAll, promptFor, findingsFor } = require("../scripts/record-gemini-demo");
const examples = require("../demo/src/examples.json");
const recordingsFile = require("../demo/src/gemini-recordings.json");

/*
  Random-looking strings (a possible leaked key or token, whatever its
  prefix). Every string field except codeSha256 is split into tokens of
  16+ key-like characters. A token is suspicious if it has high entropy and
  either mixes 3+ digits with letters, or flips letter case very often
  (random keys flip on ~half their letters; words like "ResponseEntity.ok"
  or "Object-Relational" flip on ~20%). Values we expect in recordings are
  exempt through an explicit allow-list.
*/
const EXAMPLE_IDS = examples.map((example) => example.id);

const ALLOWED_TOKENS = [
  /^gemini-[\d.]+(-[a-z]+)*$/, // model names
  /^(src|scripts|demo|tests)\/[\w/.-]+\.(js|java|json)$/, // file paths
  /^(process\.env\.)?[A-Z][A-Z0-9_]*$/, // env var names
  /^(sk|pk|rk)_(live|test)_[a-z0-9]{0,12}\.\.\.$/, // shortened placeholder like sk_live_abc123xyz...
  /x{8,}/i, // placeholders like glpat-xxxxxxxx
];

function shannonEntropy(text) {
  const counts = {};

  for (const char of text) {
    counts[char] = (counts[char] || 0) + 1;
  }

  return Object.values(counts).reduce((sum, count) => {
    const p = count / text.length;
    return sum - p * Math.log2(p);
  }, 0);
}

function isRandomLooking(token) {
  if (EXAMPLE_IDS.includes(token) || ALLOWED_TOKENS.some((pattern) => pattern.test(token))) {
    return false;
  }

  const letters = token.replace(/[^A-Za-z]/g, "");
  const digits = token.replace(/\D/g, "").length;
  let caseFlips = 0;

  for (let i = 1; i < letters.length; i += 1) {
    const upperNow = letters[i] === letters[i].toUpperCase();
    const upperBefore = letters[i - 1] === letters[i - 1].toUpperCase();

    if (upperNow !== upperBefore) {
      caseFlips += 1;
    }
  }

  const mixesDigits = digits >= 3 && letters.length >= 3;
  const flipsCaseOften = letters.length > 0 && caseFlips / letters.length >= 0.3;

  return shannonEntropy(token) >= 3 && (mixesDigits || flipsCaseOften);
}

// Returns [{ path, length }] for every random-looking token (never the token itself).
function findRandomLookingTokens(value, currentPath = "$") {
  if (typeof value === "string") {
    if (currentPath.endsWith(".codeSha256")) {
      return /^[0-9a-f]{64}$/.test(value) ? [] : [{ path: currentPath, length: value.length }];
    }

    return [...value.matchAll(/[A-Za-z0-9_\-+/=.]{16,}/g)]
      .map((match) => match[0])
      .filter(isRandomLooking)
      .map((token) => ({ path: currentPath, length: token.length }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      findRandomLookingTokens(child, `${currentPath}.${key}`)
    );
  }

  return [];
}

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

describe("recordings contain no random-looking strings (any key format)", () => {
  // Random-looking but deterministic fake secrets (derived from fixed text,
  // so the test is never flaky and no real secret is involved).
  const crypto = require("crypto");
  const fakeRandom = (seed, encoding) => crypto.createHash("sha256").update(seed).digest(encoding);
  const plantedToken = () => fakeRandom("planted-fake-token", "base64url");

  const sampleRecording = () => ({
    about: "Real Gemini outputs.",
    recordings: [
      {
        exampleId: "sql-injection",
        codeSha256: "a".repeat(64),
        model: "gemini-3.5-flash-lite",
        recordedAt: "2026-10-04T02:51:21.296Z",
        findings: [
          {
            issueType: "SQL Injection Risk",
            riskLevel: "High",
            lineNumber: 4,
            geminiInput: "File Name: src/users.js",
            explanation: "Use process.env.PAYMENT_API_KEY, not sk_live_abc123xyz... or glpat-xxxxxxxxxxxx.",
          },
        ],
      },
    ],
  });

  test("the committed recordings file passes", () => {
    expect(findRandomLookingTokens(recordingsFile)).toEqual([]);
  });

  test("a clean sample with paths, model, env vars and placeholders passes", () => {
    expect(findRandomLookingTokens(sampleRecording())).toEqual([]);
  });

  test("ordinary words and code names in Gemini's prose pass", () => {
    const data = sampleRecording();
    data.recordings[0].findings[0].explanation =
      "Use an Object-Relational Mapper; return ResponseEntity.ok from UserController.java " +
      "to avoid denial-of-service and MethodArgumentNotValidException.";

    expect(findRandomLookingTokens(data)).toEqual([]);
  });

  test.each([
    ["explanation", (data, token) => { data.recordings[0].findings[0].explanation += ` key=${token}`; }],
    ["geminiInput", (data, token) => { data.recordings[0].findings[0].geminiInput += `\n${token}`; }],
    ["model", (data, token) => { data.recordings[0].model = token; }],
    ["exampleId", (data, token) => { data.recordings[0].exampleId = token; }],
    ["about", (data, token) => { data.about = `see ${token}`; }],
  ])("a planted random token in %s is caught", (_field, plant) => {
    const data = sampleRecording();
    const token = plantedToken();
    plant(data, token);

    const hits = findRandomLookingTokens(data);

    expect(hits).toHaveLength(1);
    expect(JSON.stringify(hits)).not.toContain(token);
  });

  test("random hex and prefix-free key shapes are caught too", () => {
    for (const token of [
      fakeRandom("hex-shape", "hex").slice(0, 40),
      fakeRandom("base64url-shape", "base64url").slice(0, 39),
      fakeRandom("base64-shape", "base64").slice(0, 24),
    ]) {
      const data = sampleRecording();
      data.recordings[0].findings[0].explanation = `Example: ${token}`;
      expect(findRandomLookingTokens(data)).toHaveLength(1);
    }
  });

  test("codeSha256 must be a sha256 hex string", () => {
    const data = sampleRecording();
    data.recordings[0].codeSha256 = plantedToken();

    expect(findRandomLookingTokens(data)).toEqual([
      { path: "$.recordings.0.codeSha256", length: data.recordings[0].codeSha256.length },
    ]);
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
