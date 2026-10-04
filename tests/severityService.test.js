const {
  isValidFailOnLevel,
  meetsThreshold,
  countFindingsAtOrAbove,
} = require("../services/severityService");

describe("severityService", () => {
  test.each(["none", "low", "medium", "high", "HIGH", " Medium "])(
    "accepts --fail-on %p",
    (level) => {
      expect(isValidFailOnLevel(level)).toBe(true);
    }
  );

  test.each(["critical", "severe", "", undefined, "hi"])("rejects --fail-on %p", (level) => {
    expect(isValidFailOnLevel(level)).toBe(false);
  });

  test.each([
    ["Low", "low", true],
    ["Low", "medium", false],
    ["Medium", "medium", true],
    ["Medium", "high", false],
    ["High", "high", true],
    ["High", "low", true],
    ["Critical", "high", true],
  ])("risk %s vs threshold %s -> %s", (risk, threshold, expected) => {
    expect(meetsThreshold(risk, threshold)).toBe(expected);
  });

  test("unknown or missing risk levels count as matching (fail closed)", () => {
    expect(meetsThreshold("Unknown", "high")).toBe(true);
    expect(meetsThreshold(undefined, "low")).toBe(true);
  });

  test("threshold none never matches", () => {
    const findings = [{ riskLevel: "Critical" }, { riskLevel: "Unknown" }];

    expect(countFindingsAtOrAbove(findings, "none")).toBe(0);
  });

  test("counts findings at or above the threshold", () => {
    const findings = [
      { riskLevel: "Low" },
      { riskLevel: "Medium" },
      { riskLevel: "High" },
      { riskLevel: "Critical" },
    ];

    expect(countFindingsAtOrAbove(findings, "low")).toBe(4);
    expect(countFindingsAtOrAbove(findings, "medium")).toBe(3);
    expect(countFindingsAtOrAbove(findings, "high")).toBe(2);
    expect(countFindingsAtOrAbove([], "low")).toBe(0);
    expect(countFindingsAtOrAbove(undefined, "low")).toBe(0);
  });
});
