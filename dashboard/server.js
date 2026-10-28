"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { loadRuns } = require("./lib");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIRECTORY = path.join(__dirname, "public");
const ARTIFACTS_DIRECTORY = path.join(ROOT, "artifacts", "jira");
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function send(response, status, contentType, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function createServer(options = {}) {
  const publicDirectory = options.publicDirectory || PUBLIC_DIRECTORY;
  const artifactsDirectory = options.artifactsDirectory || ARTIFACTS_DIRECTORY;

  return http.createServer((request, response) => {
    if (request.method !== "GET") {
      send(response, 405, "text/plain; charset=utf-8", "Method not allowed");
      return;
    }

    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    if (pathname === "/api/runs") {
      const data = loadRuns(artifactsDirectory);
      send(
        response,
        200,
        "application/json; charset=utf-8",
        JSON.stringify({ generatedAt: new Date().toISOString(), ...data })
      );
      return;
    }

    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    let file;
    try {
      file = path.resolve(
        publicDirectory,
        `.${decodeURIComponent(requestedPath)}`
      );
    } catch {
      send(response, 400, "text/plain; charset=utf-8", "Invalid path");
      return;
    }

    if (
      !file.startsWith(`${path.resolve(publicDirectory)}${path.sep}`) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      send(response, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    const contentType = CONTENT_TYPES[path.extname(file)];
    if (!contentType) {
      send(response, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }

    send(response, 200, contentType, fs.readFileSync(file));
  });
}

if (require.main === module) {
  const port = Number(process.env.DASHBOARD_PORT || 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error("DASHBOARD_PORT must be an integer between 0 and 65535.");
    process.exitCode = 1;
  } else {
    const server = createServer();
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      console.log(
        `Dev agent dashboard is available at http://127.0.0.1:${address.port}`
      );
      console.log(
        "Status reflects saved Jira workflow artifacts, not live agents."
      );
    });
  }
}

module.exports = { createServer };
