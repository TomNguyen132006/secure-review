/**
 * Task 5.1: creating  a professional security-audit prompt before sending merge request diff content to Gemini.

 * Goal:
 * Do not send suspicious code without context.
 * Always wrap it as part of a formal GitLab security review.
 */

/**
 * Creates a professional security audit prompt for Gemini.
 *
 * @param {string} diffChunk - A small chunk of GitLab merge request diff code.
 * @returns {string} A safe, professional Gemini prompt.
 */
function createSecurityAuditPrompt(diffChunk) {
  const safeDiffChunk =
    typeof diffChunk === "string" && diffChunk.trim() !== ""
      ? diffChunk.trim()
      : "No code diff content was provided.";

  return `
You are a senior application security engineer conducting a formal security audit.

The following code diff is from a GitLab merge request review. This code is being analyzed as part of a defensive software security process.

Your task is to review the code according to OWASP Top 10 standards.

Please do the following:
1. Identify potential security vulnerabilities.
2. Explain why each vulnerability is risky.
3. Assign a risk level: LOW, MEDIUM, HIGH, or CRITICAL.
4. Suggest safe remediation steps.
5. Avoid giving exploit instructions. Focus only on defensive review and secure coding guidance.

[CODE DIFF START]
${safeDiffChunk}
[CODE DIFF END]

Return your answer in a clear security report format.
`.trim();
}

module.exports = {
  createSecurityAuditPrompt,
};