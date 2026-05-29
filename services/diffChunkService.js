/**
 * Task 6.2: Split a GitLab merge request diff into smaller chunks.
 *
 * Git diffs usually separate files using this header:
 * diff --git a/file.js b/file.js
 *
 * This function finds those headers and creates one chunk per changed file.
 *
 * @param {string} diff - Full merge request diff text
 * @returns {string[]} Array of file-based diff chunks
 */
function splitDiffByFile(diff) {
  // Handle empty, null, undefined, or non-string input safely.
  if (!diff || typeof diff !== "string" || diff.trim() === "") {
    return [];
  }

  // Split only when a new file diff starts.
  // The (?=...) keeps the "diff --git" header inside each chunk.
  const chunks = diff
    .split(/(?=^diff --git\s+a\/.+\s+b\/.+$)/gm)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  return chunks;
}

module.exports = {
  splitDiffByFile,
};