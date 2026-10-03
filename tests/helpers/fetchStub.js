/*
  Preloaded into CLI subprocesses started by tests:
    node -r ./tests/helpers/fetchStub.js bin/secure-review.js ...

  Jest mocks do not reach child processes, so this replaces global fetch
  in the child. Responses come from the SECURE_REVIEW_TEST_FETCH env var,
  a JSON array of:
    { "urlIncludes": "/api/v4/user", "status": 200, "body": { ... } }

  The first route whose urlIncludes is part of the request URL wins.
  Requests that match no route fail like a network error, so a test can
  never reach the real network.
*/
const routes = JSON.parse(process.env.SECURE_REVIEW_TEST_FETCH || "[]");

global.fetch = async (url) => {
  const route = routes.find((item) => String(url).includes(item.urlIncludes));

  if (!route) {
    throw new Error(`Network disabled in tests: ${url}`);
  }

  const status = route.status || 200;

  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => route.body,
    text: async () => JSON.stringify(route.body),
  };
};
