#!/usr/bin/env node
/*
  Preview the built demo locally (no dependencies):
    npm run demo:serve        -> builds, then serves _site/ on http://127.0.0.1:8080

  Only listens on 127.0.0.1, only serves files inside _site/.
*/
const http = require("http");
const fs = require("fs");
const path = require("path");

const SITE = path.resolve(process.argv[2] || path.join(__dirname, "..", "_site"));
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const filePath = path.join(SITE, urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath);

  if (!filePath.startsWith(SITE + path.sep) && filePath !== SITE) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Serving ${SITE} at http://127.0.0.1:${PORT}/ (Ctrl+C to stop)`);
});
