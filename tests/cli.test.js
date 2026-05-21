const { execSync } = require("child_process");

describe("secure-review CLI", () => {
  test("should show help", () => {
    const output = execSync("node bin/secure-review.js --help").toString();

    expect(output).toContain("Usage");
  });
});

test("should scan merge request when --mr is provided", () => {
  const output = execSync("node bin/secure-review.js scan --mr 123").toString();

  expect(output).toContain("Scanning merge request 123");
});

describe("secure-review CLI", () => {
  test("should show help", () => {
    const output = execSync("node bin/secure-review.js --help").toString();
    expect(output).toContain("Usage");
    expect(output).toContain("scan");
  });

  test("should scan merge request when --mr is provided", () => {
    const output = execSync("node bin/secure-review.js scan --mr 123").toString();
    expect(output).toContain("Scanning merge request 123");
  });

  test("should fail when --mr is missing", () => {
    expect(() => {
      execSync("node bin/secure-review.js scan", { stdio: "pipe" });
    }).toThrow();
  });
});