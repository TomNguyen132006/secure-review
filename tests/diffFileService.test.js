const fs = require("fs");
const os = require("os");
const path = require("path");

const { readDiffFile, decodeDiffBuffer } = require("../services/diffFileService");

const DIFF = "diff --git a/a.js b/a.js\n--- a/a.js\n+++ b/a.js\n@@ -1 +1 @@\n-old\n+new\n";

describe("diffFileService", () => {
  let tempDir;

  function writeFile(name, content) {
    const filePath = path.join(tempDir, name);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("reads a UTF-8 diff", () => {
    expect(readDiffFile(writeFile("a.diff", DIFF))).toBe(DIFF);
  });

  test("normalizes CRLF line endings (diff saved on Windows)", () => {
    expect(readDiffFile(writeFile("a.diff", DIFF.replace(/\n/g, "\r\n")))).toBe(DIFF);
  });

  test("strips a UTF-8 BOM", () => {
    expect(readDiffFile(writeFile("a.diff", `﻿${DIFF}`))).toBe(DIFF);
  });

  test("decodes UTF-16 LE with BOM (PowerShell 5.1: git diff > x.diff)", () => {
    const buffer = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(DIFF.replace(/\n/g, "\r\n"), "utf16le"),
    ]);

    expect(readDiffFile(writeFile("a.diff", buffer))).toBe(DIFF);
  });

  test("decodes UTF-16 BE with BOM", () => {
    const body = Buffer.from(DIFF, "utf16le");
    body.swap16();

    expect(decodeDiffBuffer(Buffer.concat([Buffer.from([0xfe, 0xff]), body]))).toBe(DIFF);
  });

  test("an empty diff means no changes", () => {
    expect(readDiffFile(writeFile("empty.diff", ""))).toBe("");
    expect(readDiffFile(writeFile("blank.diff", "\n  \n"))).toBe("");
  });

  test("rejects a file that is not a unified diff", () => {
    const filePath = writeFile("notes.txt", "just some text\nno hunks here\n");

    expect(() => readDiffFile(filePath)).toThrow('does not look like a unified diff');
  });

  test("reports a missing file clearly", () => {
    const filePath = path.join(tempDir, "missing.diff");

    expect(() => readDiffFile(filePath)).toThrow(`Cannot read diff file "${filePath}" (ENOENT).`);
  });

  test("rejects a directory", () => {
    expect(() => readDiffFile(tempDir)).toThrow("is not a file");
  });
});
