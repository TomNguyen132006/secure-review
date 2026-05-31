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
  analyzeSecurityFinding,
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
  If the local scanner does not include a file name, use the file name from the diff chunk.
*/
function attachFileNameToFinding(finding, chunk) {
  if (!finding || typeof finding !== "object") {
    return finding;
  }

  return {
    ...finding,
    fileName:
      finding.fileName ||
      finding.file ||
      chunk?.fileName ||
      chunk?.newPath ||
      chunk?.oldPath,
  };
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
  const { projectId, mrId, token } = options || {};

  const diffResult = await fetchMergeRequestDiff(projectId, mrId, token);
  const diffText = normalizeDiffToText(diffResult);

  const chunks = splitDiffByFile(diffText);

  const analyzedFindings = [];

  for (const chunk of chunks) {
    const chunkText = getChunkText(chunk);
    const localFindings = scanSecurityPatterns(chunkText);

    for (const finding of localFindings) {
      const findingWithFileName = attachFileNameToFinding(finding, chunk);

      const analyzedFinding = await analyzeSecurityFinding(findingWithFileName);

      analyzedFindings.push(analyzedFinding);
    }
  }

  const report = createSecurityReport(analyzedFindings);

  return {
    report,
    findings: analyzedFindings,
  };
}

module.exports = {
  runHybridScan,
  normalizeDiffToText,
  getChunkText,
  attachFileNameToFinding,
};