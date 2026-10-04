const fs = require("fs");
const os = require("os");
const path = require("path");
const { JSDOM } = require("jsdom");

const { buildDemo } = require("../scripts/build-demo");
const examples = require("../demo/src/examples.json");

/*
  Demo page behaviour, using the REAL built page (index.html) and bundle
  (app.js) in jsdom. jsdom has no layout engine, so scrollIntoView and
  matchMedia are stubbed and their calls recorded.
*/
const FALLBACK_TEXT =
  "Loading examples… If this doesn't change, the demo script didn't load. " +
  "Preview with npm run demo:serve instead of opening demo/index.html directly.";

let siteDir;
let html;
let bundle;

beforeAll(async () => {
  siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-test-"));
  await buildDemo(siteDir);
  html = fs.readFileSync(path.join(siteDir, "index.html"), "utf8");
  bundle = fs.readFileSync(path.join(siteDir, "app.js"), "utf8");
}, 30000);

afterAll(() => {
  fs.rmSync(siteDir, { recursive: true, force: true });
});

const normalizeSpace = (text) => text.replace(/\s+/g, " ").trim();

// Load the page; optionally run app.js. Returns the window plus recorded scrolls.
async function openPage({ reducedMotion = false, runScript = true } = {}) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://127.0.0.1:8080/" });
  const { window } = dom;
  const scrolls = [];

  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(options) {
    scrolls.push({ id: this.id, options });
  };
  window.matchMedia = (query) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });

  if (runScript) {
    window.eval(bundle);

    if (window.document.readyState === "loading") {
      await new Promise((resolve) => window.document.addEventListener("DOMContentLoaded", resolve));
    }
  }

  return { window, document: window.document, scrolls };
}

describe("demo: scroll to results", () => {
  test("Scan with pasted code scrolls to the results once, smoothly", async () => {
    const { document, scrolls } = await openPage();

    document.getElementById("code").value = 'const password = "hunter2-secret";';
    document.getElementById("scan").click();

    expect(document.getElementById("results").hidden).toBe(false);
    expect(scrolls).toEqual([{ id: "results", options: { behavior: "smooth", block: "start" } }]);
  });

  test("an example click scrolls exactly once", async () => {
    const { document, scrolls } = await openPage();

    document.querySelector("#examples button").click();

    expect(document.querySelectorAll("#results .finding").length).toBeGreaterThan(0);
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0].id).toBe("results");
  });

  test("prefers-reduced-motion uses behavior auto", async () => {
    const { document, scrolls } = await openPage({ reducedMotion: true });

    document.getElementById("code").value = "const ok = 1;";
    document.getElementById("scan").click();

    expect(scrolls).toEqual([{ id: "results", options: { behavior: "auto", block: "start" } }]);
  });

  test("a scanner failure shows the error and scrolls to it", async () => {
    const { window, document, scrolls } = await openPage();

    // Make the scanner throw (it splits the input into lines).
    window.eval(
      "String.prototype.__realSplit = String.prototype.split;" +
        "String.prototype.split = function () { throw new Error('simulated scanner failure'); };"
    );

    try {
      document.getElementById("code").value = "const ok = 1;";
      document.getElementById("scan").click();
    } finally {
      window.eval("String.prototype.split = String.prototype.__realSplit;");
    }

    const results = document.getElementById("results");
    expect(results.hidden).toBe(false);
    expect(results.querySelector(".error")).not.toBeNull();
    expect(document.getElementById("compat").hidden).toBe(false);
    expect(scrolls).toEqual([{ id: "results", options: { behavior: "smooth", block: "start" } }]);
  });
});

describe("demo: empty example list fallback", () => {
  test("the built page contains the fallback text inside #examples", async () => {
    const { document } = await openPage({ runScript: false });

    expect(normalizeSpace(document.getElementById("examples").textContent)).toBe(FALLBACK_TEXT);
  });

  test("main.js replaces the fallback with the examples", async () => {
    const { document } = await openPage();
    const list = document.getElementById("examples");

    expect(list.textContent).not.toContain("Loading examples");
    // The first 4 are in #examples; the rest are in the "More examples" <details>.
    expect(list.children).toHaveLength(Math.min(4, examples.length));
    expect(document.querySelector(".more-examples > ul").children).toHaveLength(examples.length - 4);
    expect(document.querySelectorAll("li.example")).toHaveLength(examples.length);
  });
});
