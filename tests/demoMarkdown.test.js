const fs = require("fs");
const os = require("os");
const path = require("path");
const { JSDOM } = require("jsdom");

const { buildDemo } = require("../scripts/build-demo");
const { DEFAULT_MODEL } = require("../services/geminiAnalysisService");
const examples = require("../demo/src/examples.json");
const recordings = require("../demo/src/gemini-recordings.json").recordings;

/*
  The pre-recorded Gemini explanations are Markdown. The demo renders them
  with marked and sanitizes with DOMPurify (demo/src/markdown.js). These tests
  use the REAL built page and bundle in jsdom.

  Pages are opened with runScripts: "dangerously", so a <script> that made it
  into the DOM would actually run; the XSS tests check it never does.
*/
let siteDir;
let html;
let bundle;

beforeAll(async () => {
  siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "secure-review-md-"));
  await buildDemo(siteDir);
  // Drop the <script src> tag; the bundle is evaluated directly below.
  html = fs
    .readFileSync(path.join(siteDir, "index.html"), "utf8")
    .replace(/<script src="app\.js[^"]*" defer><\/script>/, "");
  bundle = fs.readFileSync(path.join(siteDir, "app.js"), "utf8");
}, 30000);

afterAll(() => {
  fs.rmSync(siteDir, { recursive: true, force: true });
});

async function openPage() {
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://127.0.0.1:8080/" });
  const { window } = dom;

  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {} });
  window.eval(bundle);

  if (window.document.readyState === "loading") {
    await new Promise((resolve) => window.document.addEventListener("DOMContentLoaded", resolve));
  }

  return { window, document: window.document };
}

async function render(markdown) {
  const { window, document } = await openPage();
  const container = document.createElement("div");
  document.body.appendChild(container);
  container.appendChild(window.SecureReviewDemo.renderMarkdown(markdown, window));

  return { window, container };
}

describe("demo: Markdown rendering of recorded Gemini text", () => {
  test("headings, bold, lists and code blocks become elements, not raw ### or **", async () => {
    const { container } = await render(
      [
        "### Risk Explanation",
        "",
        "This is **High** risk and `inline`.",
        "",
        "1. **First:** one",
        "2. Second",
        "",
        "- bullet",
        "",
        "```javascript",
        "const apiKey = process.env.PAYMENT_API_KEY;",
        "```",
      ].join("\n")
    );

    expect(container.querySelector("h4").textContent).toBe("Risk Explanation");
    expect(container.querySelector("p strong").textContent).toBe("High");
    expect(container.querySelector("p code").textContent).toBe("inline");
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
    expect(container.querySelector("ol li strong").textContent).toBe("First:");
    expect(container.querySelectorAll("ul > li")).toHaveLength(1);
    expect(container.querySelector("pre > code").textContent).toBe(
      "const apiKey = process.env.PAYMENT_API_KEY;\n"
    );
    expect(container.textContent).not.toMatch(/###|\*\*|```/);
  });

  test("clicking a recorded example renders every explanation as Markdown", async () => {
    const { document } = await openPage();
    const recorded = examples.filter((example) => recordings.some((r) => r.exampleId === example.id));

    expect(recorded.length).toBeGreaterThan(0);

    for (const example of recorded) {
      document.getElementById("code").value = example.code;
      document.getElementById("scan").click();

      const texts = [...document.querySelectorAll("#ai-review .ai-text")];
      const recording = recordings.find((r) => r.exampleId === example.id);

      expect(texts).toHaveLength(recording.findings.length);

      for (const text of texts) {
        expect(text.querySelector("h4, strong, li, pre")).not.toBeNull();
        expect(text.textContent).not.toMatch(/^#{1,6} |\*\*/m);
      }
    }
  });

  test("the pre-recorded note names the recorded model, the date and the CLI model", async () => {
    const { document } = await openPage();
    const recording = recordings[0];
    const example = examples.find((e) => e.id === recording.exampleId);

    document.getElementById("code").value = example.code;
    document.getElementById("scan").click();

    const note = document.querySelector("#ai-review .note").textContent;
    expect(note).toContain("Pre-recorded result");
    expect(note).toContain(recording.model);
    expect(note).toContain(recording.recordedAt.slice(0, 10));
    expect(note).toContain(DEFAULT_MODEL);
  });
});

describe("demo: recorded text is sanitized", () => {
  test("a <script> tag in the recorded text is neither inserted nor executed", async () => {
    const { window, container } = await render(
      "Intro\n\n<script>window.__pwned = 'block'</script>\n\nInline <script>window.__pwned = 'inline'</script> text"
    );

    expect(container.querySelector("script")).toBeNull();
    expect(window.__pwned).toBeUndefined();
    // Shown as harmless text instead.
    expect(container.textContent).toContain("<script>");
  });

  test("event handlers, javascript: links, images and iframes are stripped", async () => {
    const { window, container } = await render(
      [
        '<img src="x" onerror="window.__pwned = \'img\'">',
        "",
        '<iframe src="https://example.com"></iframe>',
        "",
        "[click](javascript:window.__pwned='link') and [ok](https://example.com)",
        "",
        "![tracker](https://example.com/pixel.png)",
      ].join("\n")
    );

    expect(container.querySelector("img, iframe, script")).toBeNull();
    expect(container.querySelector("[onerror], [onclick], [style]")).toBeNull();
    for (const link of container.querySelectorAll("a")) {
      expect(link.getAttribute("href") || "").not.toMatch(/^javascript:/i);
    }
    const safeLink = [...container.querySelectorAll("a")].find((a) => a.textContent === "ok");
    expect(safeLink.getAttribute("href")).toBe("https://example.com");
    expect(safeLink.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(window.__pwned).toBeUndefined();
  });
});

describe("demo: Markdown styles for small screens", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "demo", "styles.css"), "utf8");

  test("code blocks in explanations are monospace and scroll sideways", async () => {
    expect(css).toMatch(/\.ai-text pre\s*{[^}]*white-space:\s*pre;/);
    expect(css).toMatch(/\.ai-text pre\s*{[^}]*overflow-x:\s*auto;/);
    expect(css).toMatch(/\.ai-text pre\s*{[^}]*max-width:\s*100%;/);
    expect(css).toMatch(/code,\s*pre\s*{[^}]*font-family:\s*var\(--mono\)/);
  });
});

describe("demo: plain-language intro", () => {
  test("explains why it matters under the intro", async () => {
    const { document } = await openPage();
    const why = document.querySelector(".site-header .lede + .why");

    expect(why).not.toBeNull();
    expect(why.textContent.replace(/\s+/g, " ").trim()).toBe(
      "Why it matters: one leaked password or one SQL injection in merged code can expose " +
        "every user's data. SecureReview flags it before the merge."
    );
  });
});
