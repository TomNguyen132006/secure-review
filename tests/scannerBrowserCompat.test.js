const fs = require("fs");
const path = require("path");

/*
  The demo page runs services/localSecurityScanner.js in the browser.
  Safari before 16.4 (iOS 15, e.g. an iPhone 13 that was never updated)
  cannot parse regex lookbehind, and because the scanner builds its regexes
  when it runs, one lookbehind would make every scan fail there.
*/
describe("localSecurityScanner browser compatibility", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "services", "localSecurityScanner.js"),
    "utf8"
  );

  test.each(["(?<=", "(?<!"])("contains no regex lookbehind %s", (lookbehind) => {
    expect(source.includes(lookbehind)).toBe(false);
  });
});
