# Secure-Review

Secure Review is a CLI-based AI security code review tool for GitLab merge requests.

It helps developers:

* connect their GitLab account
* scan merge request code changes
* detect security risks
* generate terminal reports
* export Markdown reports
* post review comments back to GitLab merge requests

How a scan works: the CLI downloads the merge request diff from GitLab, runs local
security rules on the diff (lines the MR removes are ignored), and optionally asks
Google Gemini to explain each finding. For each finding, Gemini only receives the issue
type, risk level, file name, line number and a generic description, not your code.
Without a Gemini API key the scan still works and uses the built-in explanations.

## Requirements

* Node.js 22 or newer (22 or 24 LTS recommended). Older versions are end-of-life; the CLI stops with a clear message on them.
* A GitLab.com account and a personal access token
* Optional: a Google Gemini API key

## Install

```bash
git clone https://github.com/TomNguyen132006/secure-review.git
cd secure-review
npm ci
```

Run the CLI with `node bin/secure-review.js ...`. To get a global `secure-review`
command, run `npm link` once in the project folder. The examples below use
`secure-review`; replace it with `node bin/secure-review.js` if you did not link it.

## Create a GitLab token

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

## Log in

Interactive (recommended; the token is not saved in your shell history):

```bash
secure-review gitlab login
```

The token is not shown while you type or paste it (nothing is echoed, not even `*`).
Press Enter when done, or Ctrl+C to cancel. This works in Windows Terminal,
PowerShell, cmd and macOS/Linux terminals. Git Bash (mintty) on Windows cannot hide
input; the CLI prints a note there. Use PowerShell, `winpty node bin/secure-review.js gitlab login`,
or `login --token` instead.

You can also pipe the token in, e.g. `printenv GITLAB_TOKEN | secure-review gitlab login`.

Non-interactive, for scripts and CI:

```bash
secure-review login --token "$GITLAB_TOKEN"
```

Both commands check the token against the GitLab API (`GET /api/v4/user`) and then save
the token and your GitLab username locally. An invalid or expired token is rejected and
nothing is saved.

Check or end the session:

```bash
secure-review gitlab status     # "GitLab connected as <username>."
secure-review logout            # same as: secure-review gitlab logout
```

## Scan a merge request

`--project` is the GitLab project path (`group/project`, as in the project URL) or its
numeric project ID. `--mr` is the merge request number shown in the MR URL
(`.../-/merge_requests/<mr>`).

```bash
# Terminal report
secure-review scan --project my-group/my-project --mr 42

# Also export a Markdown report (default file: secure-review-report.md)
secure-review scan --project my-group/my-project --mr 42 --markdown

# Markdown report to a custom file
secure-review scan --project my-group/my-project --mr 42 --markdown --output reports/mr-42.md

# Post the report as a comment on the merge request (token needs the api scope)
secure-review scan --project my-group/my-project --mr 42 --comment

# Both
secure-review scan --project my-group/my-project --mr 42 --markdown --comment

# CI gate: exit with code 2 if any finding is High or Critical
secure-review scan --project my-group/my-project --mr 42 --fail-on high
```

`--fail-on <level>` accepts `none` (default), `low`, `medium` or `high`. A finding
counts if its risk level is at or above the given level (`critical` findings always
count). A finding with an unknown risk level also counts, so the gate fails closed.
Reports and comments are still written before the CLI exits.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. With `--fail-on`, no finding reached the threshold. |
| `1` | Error: missing/invalid option, not logged in, GitLab error, failed `--comment`, ... |
| `2` | The scan worked, but at least one finding is at or above `--fail-on`. |
| `130` | `gitlab login` was cancelled with Ctrl+C. |

An error always wins: if the scan finds issues *and* posting the comment fails, the
exit code is `1`.

If GitLab returns an error (expired token, wrong project, MR not found), the scan stops
with an error message and exit code 1. It never reports "No security issues found."
for a merge request it could not read.

If Gemini is not configured or fails, the scan prints one line such as

```txt
Warning: AI analysis skipped (GEMINI_API_KEY is not set). Using local explanations.
```

and continues with the built-in explanations.

## Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Google Gemini API key. Without it, scans use local explanations. |
| `GEMINI_MODEL` | No | Gemini model to use. Default: `gemini-3.8-flash`. |
| `SECURE_REVIEW_CONFIG_PATH` | No | Full path of the login config file. Wins over `SECURE_REVIEW_HOME`. |
| `SECURE_REVIEW_HOME` | No | Folder used instead of your home folder; the config file becomes `$SECURE_REVIEW_HOME/.secure-review/config.json`. |

The CLI does not read `.env` files by itself. Copy `.env.example` to `.env`, fill it in,
and load it in one of these ways:

```bash
# Load .env with Node's built-in flag
node --env-file=.env bin/secure-review.js scan --project my-group/my-project --mr 42

# macOS / Linux shell
export GEMINI_API_KEY=...

# Windows PowerShell
$env:GEMINI_API_KEY = "..."
```

`.env` is listed in `.gitignore`. Never commit real keys.

### Where the login is stored

By default the token and username are saved in:

```txt
~/.secure-review/config.json
```

`SECURE_REVIEW_CONFIG_PATH` and `SECURE_REVIEW_HOME` (above) move it; they are checked
in that order. On macOS/Linux the file is created readable by your user only.

If the config file is empty or corrupted, the CLI prints a warning and treats you as
not logged in. Run `secure-review gitlab login` again to fix it.

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

## Project Structure

```txt
secure-review/
├── backend/               # Express endpoint for token validation
├── bin/
│   └── secure-review.js   # CLI entry point
├── security/              # Secret patterns and masking helpers
├── services/              # GitLab, Gemini, scanning and report services
├── tests/
│   ├── helpers/           # Network blocking and fetch stub for tests
│   └── *.test.js
├── .env.example
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
lsof -i :3000
kill -9 <PID>
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
