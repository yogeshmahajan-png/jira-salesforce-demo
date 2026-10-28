"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { loadRuns } = require("./lib");
const { createServer } = require("./server");

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "dev-agent-dashboard-")
);
const artifactsDirectory = path.join(temporaryDirectory, "artifacts", "jira");
const publicDirectory = path.join(temporaryDirectory, "public");
const storyDirectory = path.join(artifactsDirectory, "KAN-9");
let server;
let baseUrl;

function writeJson(file, value, withBom = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${withBom ? "\uFEFF" : ""}${JSON.stringify(value)}`);
}

before(async () => {
  const input = {
    version: 1,
    story: "KAN-9",
    run: {
      id: "run-1",
      time: "2026-10-28T08:00:00Z",
      org: "Dev",
      branch: "feature/KAN-9",
      commit: "abc123"
    },
    deployment: {
      status: "Succeeded",
      id: "deploy-1",
      details: "Deployment completed.",
      components: ["Field", "Layout"]
    },
    criteria: ["AC-01"],
    cases: [{ id: "TC-01", result: "Passed" }]
  };
  writeJson(path.join(storyDirectory, "run-1-input.json"), input, true);
  writeJson(path.join(storyDirectory, "run-1-report", "test-results.json"), {
    ...input,
    testing: "Passed",
    totals: { Passed: 1, Failed: 0, Blocked: 0, "Not Run": 0, total: 1 },
    uncovered: []
  });
  fs.mkdirSync(publicDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(publicDirectory, "index.html"),
    "<h1>Dashboard</h1>"
  );

  server = createServer({ artifactsDirectory, publicDirectory });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("normalizes saved run and matching test results", () => {
  const result = loadRuns(artifactsDirectory);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].status, "Succeeded");
  assert.equal(result.runs[0].componentCount, 2);
  assert.deepEqual(result.runs[0].totals, {
    Passed: 1,
    Failed: 0,
    Blocked: 0,
    "Not Run": 0,
    total: 1
  });
});

test("serves dashboard assets and normalized data only for read requests", async () => {
  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(
    page.headers.get("content-security-policy"),
    /default-src 'self'/
  );
  assert.match(await page.text(), /Dashboard/);

  const data = await fetch(`${baseUrl}/api/runs`);
  assert.equal(data.status, 200);
  assert.equal((await data.json()).runs[0].story, "KAN-9");

  const method = await fetch(`${baseUrl}/api/runs`, { method: "POST" });
  assert.equal(method.status, 405);
});

test("does not serve paths outside the public directory", async () => {
  const response = await fetch(`${baseUrl}/%2e%2e%2fserver.js`);
  assert.equal(response.status, 404);
});
