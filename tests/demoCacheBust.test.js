const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildDemo } = require("../scripts/build-demo");

/*
  GitHub Pages serves every file with Cache-Control: max-age=600, so a plain
  <script src="app.js"> can keep running an old bundle after a deploy.
  The built index.html points at app.js?v=<hash of app.js>, so a new bundle
  always gets a new URL.
*/
let siteDir;

beforeAll(async () => {
  siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-cache-"));
  await buildDemo(siteDir);
}, 30000);

afterAll(() => {
  fs.rmSync(siteDir, { recursive: true, force: true });
});

test("built index.html loads app.js with a version from the bundle's content hash", () => {
  const html = fs.readFileSync(path.join(siteDir, "index.html"), "utf8");
  const bundle = fs.readFileSync(path.join(siteDir, "app.js"));
  const hash = crypto.createHash("sha256").update(bundle).digest("hex").slice(0, 12);

  expect(html).toContain(`<script src="app.js?v=${hash}" defer></script>`);
  expect(html).not.toContain('src="app.js"');
});

test("the source demo/index.html is left unversioned", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "demo", "index.html"), "utf8");

  expect(source).toContain('<script src="app.js" defer></script>');
});
