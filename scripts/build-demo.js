#!/usr/bin/env node
/*
  Build the GitHub Pages demo into _site/ (or the folder given as argv[2]).

  demo/src/main.js imports the REAL services/localSecurityScanner.js, so the
  browser runs exactly the CLI's detection code. Nothing is copied by hand.

  Usage:
    node scripts/build-demo.js            -> _site/
    node scripts/build-demo.js out/dir    -> out/dir/
*/
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const DEMO = path.join(ROOT, "demo");
const STATIC_FILES = ["index.html", "styles.css", "favicon.svg"];

// iOS 15 Safari (iPhone 13 as shipped) is the oldest browser we support.
const TARGETS = ["safari15", "ios15", "chrome100", "firefox100", "edge100"];

const BUNDLE_OPTIONS = {
  entryPoints: [path.join(DEMO, "src", "main.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: TARGETS,
  charset: "utf8",
  legalComments: "none",
  logLevel: "silent",
};

// Returns the bundled JavaScript as a string (used by tests).
async function bundleDemo() {
  const result = await esbuild.build({ ...BUNDLE_OPTIONS, write: false });

  return result.outputFiles[0].text;
}

async function buildDemo(outDir = path.join(ROOT, "_site")) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  await esbuild.build({ ...BUNDLE_OPTIONS, outfile: path.join(outDir, "app.js") });

  for (const file of STATIC_FILES) {
    fs.copyFileSync(path.join(DEMO, file), path.join(outDir, file));
  }

  versionScriptTag(outDir);

  // Tell GitHub Pages not to run Jekyll on the output.
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "");

  return outDir;
}

// GitHub Pages caches files for 10 minutes, so give app.js a URL that changes
// whenever its content does: app.js -> app.js?v=<first 12 hex of its sha256>.
function versionScriptTag(outDir) {
  const indexPath = path.join(outDir, "index.html");
  const tag = '<script src="app.js" defer></script>';
  const html = fs.readFileSync(indexPath, "utf8");

  if (!html.includes(tag)) {
    throw new Error(`demo/index.html must contain ${tag}`);
  }

  const bundle = fs.readFileSync(path.join(outDir, "app.js"));
  const hash = crypto.createHash("sha256").update(bundle).digest("hex").slice(0, 12);

  fs.writeFileSync(indexPath, html.replace(tag, `<script src="app.js?v=${hash}" defer></script>`));
}

module.exports = { bundleDemo, buildDemo, BUNDLE_OPTIONS };

if (require.main === module) {
  const outDir = path.resolve(process.argv[2] || path.join(ROOT, "_site"));

  buildDemo(outDir)
    .then((dir) => {
      const files = fs.readdirSync(dir);
      console.log(`Demo built in ${path.relative(process.cwd(), dir) || "."}: ${files.join(", ")}`);
    })
    .catch((error) => {
      console.error(`Demo build failed: ${error.message}`);
      process.exitCode = 1;
    });
}
