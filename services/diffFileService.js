const fs = require("fs");

// Large enough for any real merge request, small enough to fail fast on a
// wrong file (e.g. a build artifact).
const MAX_DIFF_BYTES = 20 * 1024 * 1024;

/*
  Decode a diff file regardless of how it was saved:
    - UTF-8 with or without BOM (git, most editors)
    - UTF-16 LE/BE with BOM (Windows PowerShell 5.1: `git diff > x.diff`)
  and normalize CRLF to LF.
*/
function decodeDiffBuffer(buffer) {
  let text;

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    text = buffer.subarray(2).toString("utf16le");
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    text = swapped.toString("utf16le");
  } else {
    text = buffer.toString("utf8");

    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
  }

  return text.replace(/\r\n/g, "\n");
}

/*
  Read a local unified diff (git diff / GitLab ".diff" download) for
  `scan --diff-file`. Throws an Error with a user-facing message.
  An empty file means "no changes" and returns "".
*/
function readDiffFile(filePath) {
  let stats;

  try {
    stats = fs.statSync(filePath);
  } catch (error) {
    throw new Error(`Cannot read diff file "${filePath}" (${error.code || error.message}).`);
  }

  if (!stats.isFile()) {
    throw new Error(`Diff file "${filePath}" is not a file.`);
  }

  if (stats.size > MAX_DIFF_BYTES) {
    throw new Error(
      `Diff file "${filePath}" is larger than ${MAX_DIFF_BYTES / (1024 * 1024)} MB.`
    );
  }

  const text = decodeDiffBuffer(fs.readFileSync(filePath));

  if (text.trim() === "") {
    return "";
  }

  if (!/^@@ /m.test(text)) {
    throw new Error(
      `"${filePath}" does not look like a unified diff (no "@@" hunk headers). ` +
        "Create one with: git diff > changes.diff"
    );
  }

  return text;
}

module.exports = {
  readDiffFile,
  decodeDiffBuffer,
  MAX_DIFF_BYTES,
};
