/**
 * Task 3.6 — Minh Nguyen
 * Express backend for GitLab token validation.
 */

const express = require("express");
const { validateGitLabToken } = require("../services/gitlabService");

const app = express();

app.use(express.json());

/**
 * Task 3.6 — Minh Nguyen
 * Validate GitLab token through backend API.
 */
app.post("/api/gitlab/validate-token", async (req, res) => {
  const { token } = req.body;

  if (!token || token.trim() === "") {
    return res.status(400).json({
      valid: false,
      message: "GitLab token cannot be empty",
    });
  }

  const result = await validateGitLabToken(token);

  if (!result.success) {
    return res.status(401).json({
      valid: false,
      message: "Invalid GitLab token",
    });
  }

  return res.status(200).json({
    valid: true,
    username: result.user.username,
  });
});

module.exports = app;