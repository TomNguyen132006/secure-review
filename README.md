# Secure-Review

Secure Review is a CLI-based AI security code review tool for GitLab merge requests.

It helps developers:

* connect their GitLab account
* scan merge request code changes (or a local diff, offline)
* detect security risks
* generate terminal reports
* export Markdown reports
* post review comments back to GitLab merge requests
* fail a CI pipeline when risky code is found

How a scan works: the CLI reads a diff (from a GitLab merge request or a local file),
runs local security rules on it (lines the change removes are ignored), and optionally
asks Google Gemini to explain each finding. For each finding, Gemini only receives the
issue type, risk level, file name, line number and a generic description, not your code.
Without a Gemini API key the scan still works and uses the built-in explanations.

**Try it in your browser:** the [live demo](https://tomnguyen132006.github.io/secure-review/)
runs the same local detection rules on code you paste. Nothing leaves the page.

## Quick start (no GitLab account needed)

You need [Node.js](https://nodejs.org/) 22 or newer and Git. Works on Windows
(PowerShell, cmd, Windows Terminal), macOS and Linux.

```bash
git clone https://github.com/TomNguyen132006/secure-review.git
cd secure-review
npm ci
npm test
npm run demo
```

`npm ci` may print a warning about vulnerabilities. They are in Jest, the test tool,
which is not part of the CLI; `npm audit --omit=dev` reports 0 for the CLI itself.

`npm run demo` scans [`examples/vulnerable.diff`](examples/vulnerable.diff), a small
change with three planted problems. The output starts like this:

```txt
> secure-review@1.0.0 demo
> node bin/secure-review.js scan --diff-file examples/vulnerable.diff

Scanning diff file examples/vulnerable.diff (offline, no GitLab login needed)...
Warning: AI analysis skipped (GEMINI_API_KEY is not set). Using local explanations.

============================================================
Security Scan Report
============================================================

Total Findings   : 3
High-Risk Issues : 3


------------------------------------------------------------
Finding #1 !!! HIGH RISK !!!
------------------------------------------------------------
Issue Type : Hardcoded Password
Risk Level : High
File       : src/db.js
Line       : 4
...
```

and continues with Finding #2 (`SQL Injection Risk`, `src/db.js` line 9) and
Finding #3 (`Weak Authentication`, `src/auth.js` line 4). The warning is expected:
without a Gemini key the built-in explanations are used.

Try the fixed version too, which has no findings:

```bash
node bin/secure-review.js scan --diff-file examples/safe.diff
```

### Scan your own changes offline

```bash
git diff main > changes.diff
node bin/secure-review.js scan --diff-file changes.diff
```

Any unified diff works: `git diff`, `git diff --staged`, or a GitLab merge request
downloaded as `.diff` (add `.diff` to the MR URL). Files saved by Windows PowerShell
(UTF-16) and files with Windows line endings are read correctly. `--markdown`,
`--output` and `--fail-on` work with `--diff-file`; `--comment` does not, because there
is no merge request to comment on.

### After pulling: run `npm ci` once

`node_modules` is no longer stored in git. When you pull this change, git removes the
old copy from your folder, so run this once (and again whenever `package-lock.json`
changes):

```bash
npm ci
```

## Real GitLab use

### 1. Create a GitLab token

1. On GitLab.com, select your avatar (upper-right) > **Edit profile**.
2. In the left sidebar, select **Access** > **Personal access tokens**.
3. Generate a new token. Give it a name and an expiry date.
4. Select a scope:

   | You want to... | Scope needed |
   | --- | --- |
   | Log in and scan merge requests | `read_api` |
   | Also post the report as an MR comment (`--comment`) | `api` |

   `read_api` grants read access to the API. `api` grants read **and write** access,
   so only choose it if you need `--comment`.
5. Copy the token (it starts with `glpat-`). GitLab shows it only once.

Treat the token like a password. Never commit it or paste it in issues or chat.

### 2. Log in

```bash
node bin/secure-review.js gitlab login
```

The token is not shown while you type or paste it (nothing is echoed, not even `*`).
Press Enter when done, or Ctrl+C to cancel. This works in Windows Terminal, PowerShell,
cmd and macOS/Linux terminals. Git Bash (mintty) on Windows cannot hide input; the CLI
prints a note there. Use PowerShell, `winpty node bin/secure-review.js gitlab login`,
or `login --token` instead.

For scripts and CI (non-interactive):

```bash
node bin/secure-review.js login --token "$GITLAB_TOKEN"
```

Both commands check the token against the GitLab API and then save the token and your
GitLab username locally. An invalid or expired token is rejected and nothing is saved.

```bash
node bin/secure-review.js gitlab status   # "GitLab connected as <username>."
node bin/secure-review.js logout          # same as: gitlab logout
```

### 3. Scan a merge request

`--project` is the project path as in its URL (`group/project`) or its numeric ID.
`--mr` is the merge request number from the MR URL (`.../-/merge_requests/<mr>`).

```bash
# Terminal report
node bin/secure-review.js scan --project my-group/my-project --mr 42

# Also export a Markdown report (default file: secure-review-report.md)
node bin/secure-review.js scan --project my-group/my-project --mr 42 --markdown

# Markdown report to a custom file
node bin/secure-review.js scan --project my-group/my-project --mr 42 --markdown --output reports/mr-42.md

# Post the report as a comment on the merge request (token needs the api scope)
node bin/secure-review.js scan --project my-group/my-project --mr 42 --comment

# CI gate: exit with code 2 if any finding is High or Critical
node bin/secure-review.js scan --project my-group/my-project --mr 42 --fail-on high
```

If GitLab returns an error (expired token, wrong project, MR not found), the scan stops
with an error and exit code 1. It never reports "No security issues found." for a merge
request it could not read.

Tip: run `npm link` once in the project folder to get a global `secure-review` command,
then use `secure-review scan ...` instead of `node bin/secure-review.js scan ...`.

### 4. Optional: Gemini explanations

Set `GEMINI_API_KEY` to get AI explanations for each finding. If it is not set, or
Gemini fails, the scan prints one line such as

```txt
Warning: AI analysis skipped (GEMINI_API_KEY is not set). Using local explanations.
```

and continues with the built-in explanations.

### `--fail-on` and exit codes

`--fail-on <level>` accepts `none` (default), `low`, `medium` or `high`. A finding
counts if its risk level is at or above the given level (`critical` findings always
count). A finding with an unknown risk level also counts, so the gate fails closed.
Reports and comments are still written before the CLI exits.

| Code | Meaning |
| --- | --- |
| `0` | Success. With `--fail-on`, no finding reached the threshold. |
| `1` | Error: missing/invalid option, not logged in, GitLab error, failed `--comment`, unreadable diff file, Node.js too old, ... |
| `2` | The scan worked, but at least one finding is at or above `--fail-on`. |
| `130` | `gitlab login` was cancelled with Ctrl+C. |

An error always wins: if the scan finds issues *and* posting the comment fails, the
exit code is `1`.

Check the exit code: `echo $?` (bash/zsh), `$LASTEXITCODE` (PowerShell),
`echo %ERRORLEVEL%` (cmd).

## Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Google Gemini API key. Without it, scans use local explanations. |
| `GEMINI_MODEL` | No | Gemini model to use. Default: `gemini-3.8-flash`. |
| `GEMINI_TIMEOUT_MS` | No | How long to wait for each Gemini answer, in milliseconds. Default: `30000` (30 seconds). Invalid values fall back to the default. |
| `SECURE_REVIEW_CONFIG_PATH` | No | Full path of the login config file. Wins over `SECURE_REVIEW_HOME`. |
| `SECURE_REVIEW_HOME` | No | Folder used instead of your home folder; the config file becomes `$SECURE_REVIEW_HOME/.secure-review/config.json`. |

The CLI does not read `.env` files by itself. Copy `.env.example` to `.env`, fill it in,
and load it in one of these ways:

```bash
# Node's built-in flag (any OS)
node --env-file=.env bin/secure-review.js scan --project my-group/my-project --mr 42

# macOS / Linux shell
export GEMINI_API_KEY=...

# Windows PowerShell
$env:GEMINI_API_KEY = "..."
```

`.env` is listed in `.gitignore`. Never commit real keys.

### Where the login is stored

By default the token and username are saved in `~/.secure-review/config.json`
(`%USERPROFILE%\.secure-review\config.json` on Windows). `SECURE_REVIEW_CONFIG_PATH`
and `SECURE_REVIEW_HOME` (above) move it; they are checked in that order. On
macOS/Linux the file is created readable by your user only.

If the config file is empty or corrupted, the CLI prints a warning and treats you as
not logged in. Log in again to fix it.

## Requirements

* Node.js 22 or newer (22 or 24 LTS recommended). Older versions are end-of-life;
  the CLI stops with a clear message on them.
* Git, to clone the project.
* For real GitLab use: a GitLab.com account and a personal access token.
* Optional: a Google Gemini API key.

## Run the tests

```bash
npm test
```

The tests never call the real GitLab or Gemini APIs and never touch your real
`~/.secure-review` folder:

* `tests/helpers/blockNetwork.js` (Jest `setupFiles`) replaces `fetch` so any
  unmocked network call fails the test.
* CLI tests that start a child process preload `tests/helpers/fetchStub.js`,
  which answers GitLab requests from fixtures.
* Tests that need a config file use a temp folder via `SECURE_REVIEW_HOME` or
  `SECURE_REVIEW_CONFIG_PATH`.

CI runs the tests, the demo, both example diffs and a package install check on
Windows, macOS and Linux with Node 22 and 24 (`.github/workflows/ci.yml`).

## Demo page (GitHub Pages)

`demo/` is a static page that runs the CLI's real local detection
(`services/localSecurityScanner.js`) in the browser. esbuild bundles it into
`app.js`; nothing is copied by hand. The page makes no network requests
(its Content-Security-Policy sets `connect-src 'none'`) and never calls Gemini.

Preview it locally:

```bash
npm run demo:serve      # builds into _site/ and serves http://127.0.0.1:8080/
```

The "AI Review (Gemini)" panel shows **real** Gemini results recorded with the CLI's own
code path. To (re)record them with your own key:

```bash
node scripts/record-gemini-demo.js --dry-run              # shows exactly what would be sent; no key needed
node --env-file=.env scripts/record-gemini-demo.js        # needs GEMINI_API_KEY; writes demo/src/gemini-recordings.json
npm test                                                  # checks the recordings match the examples
```

The script sends only the safe abstract description of each finding, never code, and saves
only the issue type, risk level, line, the exact prompt that was sent, Gemini's explanation,
the model and the date. Each request may take up to 30s; timeouts, network errors and
HTTP 429/5xx are retried up to 2 more times (after 2s, then 5s), with one line printed per
retry. It writes nothing if Gemini did not answer every finding.

Deployment: `.github/workflows/pages.yml` runs the tests, builds `_site/` and deploys it on
every push to `main` (or manually from the Actions tab). One-time setup in the GitHub repo:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Project Structure

```txt
secure-review/
├── backend/               # Express endpoint for token validation
├── bin/
│   └── secure-review.js   # CLI entry point
├── demo/                  # GitHub Pages demo (index.html, styles.css, src/)
├── examples/              # vulnerable.diff and safe.diff for npm run demo
├── scripts/               # demo build, local preview, Gemini recording
├── security/              # Secret patterns and masking helpers
├── services/              # GitLab, Gemini, scanning and report services
├── tests/
│   ├── helpers/           # Network blocking, fetch stub, old-Node simulation
│   └── *.test.js
├── .env.example
├── .gitattributes         # LF line endings on every OS
├── package.json
└── README.md
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
  "token": "glpat-xxxxxxxxxxxxxxxxxxxx"
}
```

Stop backend server:

```bash
CTRL + C
```

If port 3000 is still busy:

```bash
# macOS / Linux
lsof -i :3000
kill -9 <PID>

# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <PID>
```

## Git Workflow Notes

Before starting new work:

```bash
git status
git pull origin main
npm ci
npm test
```

Before pushing:

```bash
npm test
git status
```

Only add files related to your task. `node_modules` is ignored by `.gitignore`
and must not be committed.

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

Use this commit format, `<Story N or Area> | <Name> | <message>`:

```bash
git commit -m "Story 13 | Minh | Add markdown report export"
git commit -m "CI | Tam | Test on Windows, macOS and Linux"
```

For combined work:

```bash
git commit -m "Story 13 and 14 | Minh | Add markdown export and GitLab MR comment posting"
```

Push to main:

```bash
git push origin main
```
