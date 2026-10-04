const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { bundleDemo } = require("../scripts/build-demo");
const { scanSecurityPatterns } = require("../services/localSecurityScanner");
const examples = require("../demo/src/examples.json");

const DEMO = path.join(__dirname, "..", "demo");

/*
  The demo runs the browser bundle (app.js) built from the REAL scanner.
  These tests build that bundle and run it in a sandbox that has no Node
  globals (no require/process/module/Buffer) and where every network API is
  a trap that records calls.
*/
describe("demo browser bundle", () => {
  let bundle;
  let demo;
  let networkCalls;

  beforeAll(async () => {
    bundle = await bundleDemo();
    networkCalls = [];

    const trap = (name) =>
      function networkTrap(...args) {
        networkCalls.push({ name, args: args.map(String) });
        throw new Error(`network API ${name} called`);
      };

    const sandbox = {
      console,
      fetch: trap("fetch"),
      XMLHttpRequest: trap("XMLHttpRequest"),
      WebSocket: trap("WebSocket"),
      EventSource: trap("EventSource"),
      navigator: { sendBeacon: trap("sendBeacon") },
    };

    vm.createContext(sandbox);
    vm.runInContext(bundle, sandbox, { filename: "app.js" });
    demo = sandbox.SecureReviewDemo;
  }, 30000);

  const plainSamples = [
    'const token = "abc123secret";\nconst q = `SELECT * FROM t WHERE id = ${id}`;',
    'if (password === "Tr0ub4dor&3") {}\nif (typeof password === "string") {}',
    "router.get('/admin/stats', handler);\r\nconst AWS = 'AKIAABCDEFGHIJKLMNOP';",
    "",
  ];

  const inputs = [
    ...examples.flatMap((example) => [
      [`${example.id} (vulnerable)`, example.code],
      [`${example.id} (safe)`, example.safeCode],
    ]),
    ...plainSamples.map((sample, index) => [`plain sample ${index + 1}`, sample]),
  ];

  test("loads without Node globals and exposes the demo API", () => {
    expect(typeof demo.scanCode).toBe("function");
    expect(demo.examples).toHaveLength(examples.length);
  });

  test.each(inputs)("%s: identical findings to the Node scanner", (_name, input) => {
    const fromBundle = JSON.parse(JSON.stringify(demo.scanCode(input)));
    const fromNode = scanSecurityPatterns(input.replace(/\r\n?/g, "\n"));

    expect(fromBundle).toEqual(fromNode);
  });

  test("scanning every input made zero network calls", () => {
    for (const [, input] of inputs) {
      demo.scanCode(input);
    }

    expect(networkCalls).toEqual([]);
  });

  test("recognizes built-in examples and pasted code", () => {
    for (const example of examples) {
      expect(demo.identifyExample(example.code)).toMatchObject({ variant: "vulnerable" });
      expect(demo.identifyExample(example.safeCode.replace(/\n/g, "\r\n"))).toMatchObject({
        variant: "safe",
      });
    }

    expect(demo.identifyExample(`${examples[0].code}// edited`)).toBeNull();
  });

  test("flags input that looks like a diff", () => {
    expect(demo.looksLikeDiff("diff --git a/x b/x\n@@ -1 +1 @@\n+x")).toBe(true);
    expect(demo.looksLikeDiff("@@ -3,4 +3,6 @@ function a() {")).toBe(true);
    expect(demo.looksLikeDiff('const total = a - b;\n-- SQL comment\nconst x = "+++";')).toBe(false);
  });

  test("pre-recorded note names the model it is given", () => {
    expect(demo.preRecordedNote("gemini-3.5-flash-lite")).toBe(
      "Pre-recorded result from gemini-3.5-flash-lite. The CLI calls Gemini live."
    );
  });

  test("the note uses the model from the recordings file, not a hardcoded one", () => {
    const recordings = require("../demo/src/gemini-recordings.json").recordings;
    const source = require("fs").readFileSync(path.join(DEMO, "src", "main.js"), "utf8");

    expect(source).toContain("preRecordedNote(recording.model)");
    expect(source).not.toMatch(/Pre-recorded result from gemini-/);

    for (const recording of recordings) {
      expect(demo.findRecording(recording.exampleId).model).toBe(recording.model);
    }
  });

  test("bundle contains no network APIs or Gemini client code", () => {
    expect(bundle).not.toMatch(/XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts/);
    // No Gemini endpoint or auth header (the UI text may mention GEMINI_API_KEY).
    expect(bundle).not.toMatch(/generativelanguage|googleapis|x-goog-api-key/);

    // The only "fetch(" text allowed is inside the scanner's exfiltration regex.
    const fetchMentions = bundle.match(/.{0,2}fetch\s*\(/g) || [];
    expect(fetchMentions.every((mention) => mention.includes("/fetch\\("))).toBe(true);
  });

  test("bundle does not require Node-only modules", () => {
    // Node globals (process, require, Buffer) are absent from the sandbox above,
    // so any use of them while loading or scanning would already have failed.
    expect(bundle).not.toMatch(/\brequire\(\s*["'](fs|path|os|child_process|http|https|crypto)["']/);
  });
});

describe("demo page (index.html, styles.css)", () => {
  const html = fs.readFileSync(path.join(DEMO, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(DEMO, "styles.css"), "utf8");

  test("has a Content-Security-Policy that blocks all connections", () => {
    const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1];

    expect(csp).toBeDefined();
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
  });

  test("loads no external scripts, styles, fonts or images", () => {
    const loads = [...html.matchAll(/<(script|link|img|iframe|source)\b[^>]*>/g)].map((m) => m[0]);

    for (const tag of loads) {
      expect(tag).not.toMatch(/(src|href)="(https?:)?\/\//);
    }

    expect(css).not.toMatch(/@import|url\(/);
  });

  test("has no inline scripts, event handlers or style attributes", () => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/\sstyle=/i);
  });

  test("mobile basics: viewport meta, 16px textarea, 44px tap targets", () => {
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(css).toMatch(/textarea\s*{[^}]*font:\s*16px/);
    expect(css).toMatch(/\.btn\s*{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/summary\s*{[^}]*min-height:\s*44px/);
  });
});
