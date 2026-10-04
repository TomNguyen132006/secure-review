/*
  Preloaded into a CLI subprocess to simulate an old Node.js version:
    node -r ./tests/helpers/fakeOldNode.js bin/secure-review.js --help
*/
Object.defineProperty(process.versions, "node", {
  value: process.env.FAKE_NODE_VERSION || "20.11.0",
});
