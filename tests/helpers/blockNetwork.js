/*
  Jest setup file (see "jest.setupFiles" in package.json).

  Replaces global fetch so no test can reach the real network by accident.
  Tests that need fetch should mock it themselves, e.g.
    global.fetch = jest.fn().mockResolvedValue({ ... });
*/
global.fetch = jest.fn(async (url) => {
  throw new Error(`Real network calls are disabled in tests: ${url}`);
});
