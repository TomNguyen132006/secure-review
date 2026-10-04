const { scanSecurityPatterns } = require("../services/localSecurityScanner");
const examples = require("../demo/src/examples.json");

/*
  The demo's one-click examples must behave as advertised with the REAL
  scanner: each vulnerable example triggers exactly its rule, and each safe
  version gives zero findings.
*/
describe("demo built-in examples", () => {
  test("there are at least 4 examples with unique ids", () => {
    expect(examples.length).toBeGreaterThanOrEqual(4);
    expect(new Set(examples.map((example) => example.id)).size).toBe(examples.length);
  });

  test.each(examples.map((example) => [example.id, example]))(
    "%s: has a non-empty expected list and a safe version",
    (_id, example) => {
      expect(Array.isArray(example.expected)).toBe(true);
      expect(example.expected.length).toBeGreaterThan(0);
      expect(typeof example.safeCode).toBe("string");
      expect(example.safeCode.trim()).not.toBe("");
    }
  );

  test.each(examples.map((example) => [example.id, example]))(
    "%s: vulnerable version triggers exactly its rule",
    (_id, example) => {
      const findings = scanSecurityPatterns(example.code).map(({ issueType, lineNumber }) => ({
        issueType,
        lineNumber,
      }));

      expect(findings).toEqual(example.expected);
    }
  );

  test.each(examples.map((example) => [example.id, example]))(
    "%s: safe version gives zero findings",
    (_id, example) => {
      expect(scanSecurityPatterns(example.safeCode)).toEqual([]);
    }
  );

  test("the examples cover the rules the demo promises", () => {
    const rules = examples.flatMap((example) => example.expected.map((item) => item.issueType));

    expect(rules).toEqual(
      expect.arrayContaining([
        "Hardcoded API Key",
        "SQL Injection Risk",
        "Missing Authorization Check",
        "Missing Validation",
      ])
    );
  });
});
