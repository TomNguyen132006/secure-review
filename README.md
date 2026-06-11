# Secure-Review

Secure Review is a CLI-based AI security code review tool for GitLab merge requests.

It helps developers:

* connect their GitLab account
* scan merge request code changes
* detect security risks
* generate terminal reports
* export Markdown reports
* post review comments back to GitLab merge requests

## Project Structure

```txt
secure-review/
├── backend/
│   ├── app.js
│   └── server.js
│
├── bin/
│   └── secure-review.js
│
├── security/
│   ├── maskSecret.js
│   ├── secretPatterns.js
│   └── secretScanner.js
│
├── services/
│   ├── diffChunkService.js
│   ├── geminiAnalysisService.js
│   ├── geminiPromptService.js
│   ├── geminiResponseParserService.js
│   ├── gitlabAuthService.js
│   ├── gitlabCommentService.js
│   ├── gitlabMergeRequestService.js
│   ├── gitlabService.js
│   ├── hybridScannerService.js
│   ├── localSecurityScanner.js
│   ├── markdownReportService.js
│   ├── secretScannerService.js
│   ├── securityAbstractionService.js
│   ├── securityReportFormatter.js
│   └── securityReportService.js
│
├── src/
│   └── AuthService.js
│
├── tests/
│   ├── authService.test.js
│   ├── cli.test.js
│   ├── diffChunkService.test.js
│   ├── geminiAnalysisService.test.js
│   ├── geminiPromptService.test.js
│   ├── geminiResponseParserService.test.js
│   ├── gitlabAuthService.test.js
│   ├── gitlabBackend.test.js
│   ├── gitlabCommentService.test.js
│   ├── gitlabLogin.test.js
│   ├── gitlabLogout.test.js
│   ├── gitlabMergeRequestService.test.js
│   ├── gitlabService.test.js
│   ├── hybridScannerService.test.js
│   ├── localSecurityScanner.test.js
│   ├── markdownReportService.test.js
│   ├── scanCommand.test.js
│   ├── scanCommandSecretScanner.test.js
│   ├── secretPatterns.test.js
│   ├── secretScanner.test.js
│   ├── secretScannerService.test.js
│   ├── securityAbstractionService.test.js
│   └── securityReportService.test.js
│
├── node_modules/          # Local dependency folder, do not commit
├── package.json
├── package-lock.json
└── README.md
```

## Setup

Install dependencies:

```bash
npm install
```

Run all tests:

```bash
npm test
```

Expected result:

```txt
Test Suites: passed
Tests: passed
```

## CLI Commands

Show help:

```bash
node bin/secure-review.js --help
```

Login with GitLab token:

```bash
node bin/secure-review.js login --token glpat_xxxxx
```

Scan a merge request:

```bash
node bin/secure-review.js scan --project TomNguyen132006/secure-review --mr 123
```

Export a Markdown report:

```bash
node bin/secure-review.js scan --project TomNguyen132006/secure-review --mr 123 --markdown
```

Export Markdown to a custom file:

```bash
node bin/secure-review.js scan --project TomNguyen132006/secure-review --mr 123 --markdown --output report.md
```

Post the security report as a GitLab merge request comment:

```bash
node bin/secure-review.js scan --project TomNguyen132006/secure-review --mr 123 --comment
```

Export Markdown and post GitLab comment together:

```bash
node bin/secure-review.js scan --project TomNguyen132006/secure-review --mr 123 --markdown --comment
```

Logout:

```bash
node bin/secure-review.js logout
```

GitLab connect flow:

```bash
node bin/secure-review.js gitlab login
node bin/secure-review.js gitlab status
node bin/secure-review.js gitlab logout
```

## Backend Server

Start backend server:

```bash
npm run start:backend
```

Backend runs on:

```txt
http://localhost:3000
```

Current backend endpoint:

```txt
POST /api/gitlab/validate-token
```

Example request body:

```json
{
  "token": "glpat_xxxxx"
}
```

Stop backend server:

```bash
CTRL + C
```

If port 3000 is still busy:

```bash
lsof -i :3000
kill -9 <PID>
```

## Git Workflow Notes

Before starting new work:

```bash
git status
git pull origin main
npm install
npm test
```

Before pushing:

```bash
npm test
git status
```

Only add files related to your task. Do not commit `node_modules`.

Good example:

```bash
git add bin/secure-review.js
git add services/markdownReportService.js
git add tests/markdownReportService.test.js
```

Bad example:

```bash
git add .
```

Use this commit format:

```bash
git commit -m "Story 13 | Minh | Add markdown report export"
```

For combined work:

```bash
git commit -m "Story 13 and 14 | Minh | Add markdown export and GitLab MR comment posting"
```

Push to main:

```bash
git push origin main
```

If `node_modules` appears in `git status`, clean it before committing:

```bash
git restore node_modules
rm -rf node_modules/fsevents
```

Then check again:

```bash
git status
```
