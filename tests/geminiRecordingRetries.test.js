const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  callGemini,
  getGeminiTimeoutMs,
  DEFAULT_GEMINI_TIMEOUT_MS,
} = require("../services/geminiAnalysisService");
const {
  main,
  recordAll,
  RECORDING_TIMEOUT_MS,
  RETRY_DELAYS_MS,
} = require("../scripts/record-gemini-demo");
const examples = require("../demo/src/examples.json");

/*
  Timeouts, retries and key validation for Gemini calls, using the REAL
  analyzeSecurityFindingWithStatus/callGemini with fetch mocked (no network).
*/
const FAKE_KEY = "test-key-not-real-0123456789";

const okResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: "Recorded explanation." }] } }] }),
});

const abortError = () => Object.assign(new Error("The operation was aborted"), { name: "AbortError" });

// A fetch that only settles when its AbortSignal fires (i.e. a real timeout).
const hangingFetch = (url, options) =>
  new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(abortError()));
  });

describe("Gemini timeouts, retries and key validation", () => {
  const saved = {};
  let tempDir;
  let sleep;
  let log;

  beforeEach(() => {
    for (const name of ["GEMINI_API_KEY", "GEMINI_TIMEOUT_MS", "GEMINI_MODEL"]) {
      saved[name] = process.env[name];
      delete process.env[name];
    }

    process.env.GEMINI_API_KEY = FAKE_KEY;
    global.fetch = jest.fn();
    sleep = jest.fn(async () => {});
    log = jest.fn();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const allLogText = () => log.mock.calls.map((call) => call.join(" ")).join("\n");

  describe("GEMINI_TIMEOUT_MS", () => {
    test("CLI default stays 10s", () => {
      expect(DEFAULT_GEMINI_TIMEOUT_MS).toBe(10000);
      expect(getGeminiTimeoutMs()).toBe(10000);
    });

    test("a whole number of milliseconds overrides the default", () => {
      process.env.GEMINI_TIMEOUT_MS = "25000";
      expect(getGeminiTimeoutMs()).toBe(25000);
    });

    test.each(["abc", "0", "-5", "30s", "1.5", "999999999", ""])(
      "invalid value %p falls back to the default",
      (value) => {
        process.env.GEMINI_TIMEOUT_MS = value;
        expect(getGeminiTimeoutMs()).toBe(10000);
      }
    );

    test("callGemini really aborts after GEMINI_TIMEOUT_MS", async () => {
      process.env.GEMINI_TIMEOUT_MS = "20";
      fetch.mockImplementation(hangingFetch);

      const result = await callGemini("prompt", FAKE_KEY);

      expect(result).toMatchObject({
        ok: false,
        retryable: true,
        reason: "Gemini request timed out after 0.02s",
      });
    });

    test("an explicit timeoutMs option wins over the environment", async () => {
      process.env.GEMINI_TIMEOUT_MS = "600000";
      fetch.mockImplementation(hangingFetch);

      const result = await callGemini("prompt", FAKE_KEY, { timeoutMs: 15 });

      expect(result.reason).toBe("Gemini request timed out after 0.015s");
    });
  });

  describe("recording script retries", () => {
    test("uses a 30s timeout and retries after 2s, then 5s", () => {
      expect(RECORDING_TIMEOUT_MS).toBe(30000);
      expect(RETRY_DELAYS_MS).toEqual([2000, 5000]);
    });

    test("timeout then success after one retry: every example is recorded", async () => {
      fetch.mockRejectedValueOnce(abortError()).mockImplementation(async () => okResponse());

      const result = await recordAll({ examples, sleep, log, now: () => "2026-01-01T00:00:00.000Z" });

      expect(result.recordings).toHaveLength(examples.length);
      expect(result.recordings.every((item) => item.findings.every((f) => f.explanation === "Recorded explanation."))).toBe(true);

      // 4 findings + 1 retry.
      expect(fetch).toHaveBeenCalledTimes(examples.length + 1);
      expect(sleep.mock.calls).toEqual([[2000]]);
      expect(log.mock.calls).toEqual([
        ["Retry 1/2 for hardcoded-api-key line 3 in 2s (Gemini request timed out after 30s)"],
      ]);
      expect(allLogText()).not.toContain(FAKE_KEY);
    });

    test("the 30s timeout is what the script passes to the real call", async () => {
      fetch.mockImplementationOnce(hangingFetch).mockImplementation(async () => okResponse());

      await recordAll({ examples, sleep, log, timeoutMs: 25 });

      expect(log.mock.calls[0][0]).toContain("(Gemini request timed out after 0.025s)");
    });

    test("HTTP 503 is retried; HTTP 403 is not", async () => {
      fetch
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
        .mockImplementation(async () => okResponse());

      await recordAll({ examples, sleep, log });
      expect(log).toHaveBeenCalledTimes(1);

      log.mockClear();
      fetch.mockReset();
      fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });

      await expect(recordAll({ examples, sleep, log })).rejects.toThrow(
        "Gemini API key was rejected (HTTP 403). Nothing was written."
      );
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalled();
    });

    test("all retries fail: error after 3 attempts and nothing is written", async () => {
      fetch.mockRejectedValue(abortError());
      const outputPath = path.join(tempDir, "gemini-recordings.json");

      await expect(
        main({ argv: ["node", "record"], outputPath, recordOptions: { sleep, log } })
      ).rejects.toThrow(
        "Gemini did not answer for hardcoded-api-key line 3: Gemini request timed out after 30s. Nothing was written."
      );

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls).toEqual([[2000], [5000]]);
      expect(log.mock.calls.map((call) => call[0])).toEqual([
        "Retry 1/2 for hardcoded-api-key line 3 in 2s (Gemini request timed out after 30s)",
        "Retry 2/2 for hardcoded-api-key line 3 in 5s (Gemini request timed out after 30s)",
      ]);
      expect(fs.existsSync(outputPath)).toBe(false);
    });

    test("success writes the file through main()", async () => {
      fetch.mockImplementation(async () => okResponse());
      const outputPath = path.join(tempDir, "gemini-recordings.json");
      jest.spyOn(console, "log").mockImplementation(() => {});

      await main({ argv: ["node", "record"], outputPath, recordOptions: { sleep, log } });

      const written = JSON.parse(fs.readFileSync(outputPath, "utf8"));
      expect(written.recordings).toHaveLength(examples.length);
      expect(fs.readFileSync(outputPath, "utf8")).not.toContain(FAKE_KEY);
      console.log.mockRestore();
    });
  });

  describe("invalid characters in GEMINI_API_KEY", () => {
    test.each([
      ["non-ASCII letter", "AIza-tëst-key-0123456789"],
      ["CJK character", "AIza-键-0123456789"],
      ["smart quote", "“AIza-0123456789”"],
      ["BOM", "﻿AIza-0123456789"],
      ["line break", "AIza-0123456789\r"],
      ["space", "AIza 0123456789"],
    ])("%s: clear message, no request, key not printed", async (_label, badKey) => {
      const result = await callGemini("prompt", badKey);

      expect(result).toMatchObject({ ok: false, retryable: false });
      expect(result.reason).toContain("GEMINI_API_KEY contains invalid characters");
      expect(result.reason).not.toContain("network error");
      expect(result.reason).not.toContain(badKey.trim());
      expect(fetch).not.toHaveBeenCalled();
    });

    test("the recording script reports it, does not retry, and writes nothing", async () => {
      process.env.GEMINI_API_KEY = "AIza-tëst-key-0123456789";
      const outputPath = path.join(tempDir, "gemini-recordings.json");

      const error = await main({ argv: ["node", "record"], outputPath, recordOptions: { sleep, log } }).catch(
        (caught) => caught
      );

      expect(error.message).toContain("GEMINI_API_KEY contains invalid characters");
      expect(error.message).not.toContain("network error");
      expect(error.message).not.toContain(process.env.GEMINI_API_KEY);
      expect(fetch).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
      expect(fs.existsSync(outputPath)).toBe(false);
    });

    test("a normal key is accepted", async () => {
      fetch.mockImplementation(async () => okResponse());

      const result = await callGemini("prompt", FAKE_KEY);

      expect(result).toEqual({ ok: true, text: "Recorded explanation." });
    });
  });
});
