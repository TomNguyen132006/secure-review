const {
  fetchMergeRequestDiff,
} = require("./gitlabMergeRequestService");

const {
  splitDiffByFile,
} = require("./diffChunkService");

const {
  scanSecurityPatterns,
} = require("./localSecurityScanner");

const {
  analyzeSecurityFindingWithStatus,
  buildFallbackFinding,
} = require("./geminiAnalysisService");

const {
  createSecurityReport,
} = require("./securityReportService");

/*
  GitLab diff services can return data in different shapes.
  Examples:
    - a raw diff string
    - an array of changed file objects
    - an object with a changes array

*/
function normalizeDiffToText(diffResult) {
  if (!diffResult) {
    return "";
  }

  if (typeof diffResult === "string") {
    return diffResult;
  }

  if (Array.isArray(diffResult)) {
    return diffResult
      .map((change) => {
        const fileName =
          change.new_path ||
          change.old_path ||
          change.fileName ||
          change.file ||
          "unknown-file";

        const diffText = change.diff || change.code || change.content || "";

        return `diff --git a/${fileName} b/${fileName}\n${diffText}`;
      })
      .join("\n");
  }

  if (Array.isArray(diffResult.changes)) {
    return normalizeDiffToText(diffResult.changes);
  }

  if (diffResult.diff) {
    return diffResult.diff;
  }

  return "";
}

/*
  Make the scanner work even if splitDiffByFile returns strings or objects.
*/
function getChunkText(chunk) {
  if (!chunk) {
    return "";
  }

  if (typeof chunk === "string") {
    return chunk;
  }

  return chunk.content || chunk.diff || chunk.code || chunk.text || "";
}

/*
  Read the file name from a chunk. splitDiffByFile returns strings that start
  with "diff --git a/<old> b/<new>", so use the new path from that header.
*/
function getChunkFileName(chunk) {
  if (!chunk) {
    return undefined;
  }

  if (typeof chunk !== "string") {
    return chunk.fileName || chunk.newPath || chunk.oldPath;
  }

  const header = chunk.match(/^diff --git a\/.+? b\/(.+)$/m);

  return header ? header[1].trim() : undefined;
}

/*
  If the local scanner does not include a file name, use the file name from the diff chunk.
*/
function attachFileNameToFinding(finding, chunk) {
  if (!finding || typeof finding !== "object") {
    return finding;
  }

  return {
    ...finding,
    fileName: finding.fileName || finding.file || getChunkFileName(chunk),
  };
}

/*
  Map each line of a diff chunk to its line number in the new file, using the
  "@@ -a,b +c,d @@" hunk headers. Removed lines ("-") map to null because they
  no longer exist in the new file. Lines outside any hunk map to undefined.
*/
function buildNewFileLineMap(chunkText) {
  const lines = chunkText.split("\n");
  const lineMap = [];
  let newLine = null;

  for (const line of lines) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

    if (hunk) {
      newLine = Number(hunk[1]);
      lineMap.push(undefined);
      continue;
    }

    if (newLine === null) {
      lineMap.push(undefined);
      continue;
    }

    if (line.startsWith("-")) {
      lineMap.push(null);
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file"
      lineMap.push(undefined);
    } else {
      lineMap.push(newLine);
      newLine += 1;
    }
  }

  return lineMap;
}

/*
  Run the full Story 6 hybrid scanning flow.
  Steps:
    1. Fetch GitLab merge request diff.
    2. Split the diff into smaller chunks.
    3. Run local regex scanner first.
    4. Send each local finding to Gemini fallback analysis.
    5. Create a readable terminal report.
*/
async function runHybridScan(options) {
  const {
    projectId,
    mrId,
    token,
    onWarning = (message) => console.warn(message),
  } = options || {};

  const warnings = [];
  // Set after the first Gemini failure. The rest of the scan then uses local
  // explanations directly, so the warning prints once and a bad key/model
  // does not cost one timeout per finding.
  let aiSkippedReason = null;

  const diffResult = await fetchMergeRequestDiff(projectId, mrId, token);

  // A failed fetch must not look like a clean MR with no findings.
  if (diffResult && diffResult.success === false) {
    const message = String(
      diffResult.message || "Unable to fetch merge request diff."
    ).replace(/^Error:\s*/, "");

    const error = new Error(message);
    error.status = diffResult.status;
    throw error;
  }

  const diffText = normalizeDiffToText(diffResult);

  const chunks = splitDiffByFile(diffText);

  const analyzedFindings = [];

  for (const chunk of chunks) {
    const chunkText = getChunkText(chunk);
    const localFindings = scanSecurityPatterns(chunkText);
    const lineMap = buildNewFileLineMap(chunkText);

    for (const finding of localFindings) {
      const mappedLine = lineMap[finding.lineNumber - 1];

      // Skip code the MR removes: it is not a new risk.
      if (mappedLine === null) {
        continue;
      }

      const findingWithFileName = attachFileNameToFinding(
        mappedLine === undefined ? finding : { ...finding, lineNumber: mappedLine },
        chunk
      );

      if (aiSkippedReason) {
        analyzedFindings.push(buildFallbackFinding(findingWithFileName));
        continue;
      }

      const { finding: analyzedFinding, skippedReason } =
        await analyzeSecurityFindingWithStatus(findingWithFileName);

      if (skippedReason) {
        aiSkippedReason = skippedReason;

        const warning = `Warning: AI analysis skipped (${skippedReason}). Using local explanations.`;
        warnings.push(warning);
        onWarning(warning);
      }

      analyzedFindings.push(analyzedFinding);
    }
  }

  const report = createSecurityReport(analyzedFindings);

  return {
    report,
    findings: analyzedFindings,
    warnings,
  };
}

module.exports = {
  runHybridScan,
  normalizeDiffToText,
  getChunkText,
  getChunkFileName,
  attachFileNameToFinding,
  buildNewFileLineMap,
};