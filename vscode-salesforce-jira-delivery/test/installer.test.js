"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const {
  ATLASSIAN_SERVER,
  FILES,
  WORKSPACE_SCRIPTS,
  findConflicts,
  install
} = require("../src/installer");

const temporaryDirectories = [];

function temporaryDirectory(prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function createResources() {
  const resources = temporaryDirectory("sf-jira-resources-");
  for (const [, source] of FILES) {
    const file = path.join(resources, source);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `bundled:${source}\n`);
  }
  return resources;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("installs all resources and creates portable workspace configuration", () => {
  const workspace = temporaryDirectory("sf-jira-workspace-");
  const resources = createResources();
  const result = install(workspace, resources);

  assert.equal(result.conflicts.length, 0);
  assert.equal(result.installed.length, FILES.length);
  for (const [destination] of FILES) {
    assert.ok(fs.existsSync(path.join(workspace, destination)));
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(workspace, "package.json"))
  );
  assert.deepEqual(packageJson.scripts, WORKSPACE_SCRIPTS);
  const mcp = JSON.parse(
    fs.readFileSync(path.join(workspace, ".vscode", "mcp.json"))
  );
  assert.deepEqual(mcp.servers.atlassian, ATLASSIAN_SERVER);
  assert.match(
    fs.readFileSync(path.join(workspace, ".gitignore"), "utf8"),
    /^artifacts\/jira\/$/m
  );
});

test("preserves unrelated package, MCP, and gitignore settings", () => {
  const workspace = temporaryDirectory("sf-jira-workspace-");
  const resources = createResources();
  fs.mkdirSync(path.join(workspace, ".vscode"));
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify({ name: "existing", scripts: { build: "node build.js" } })
  );
  fs.writeFileSync(
    path.join(workspace, ".vscode", "mcp.json"),
    JSON.stringify({ servers: { internal: { command: "internal-mcp" } } })
  );
  fs.writeFileSync(path.join(workspace, ".gitignore"), "dist/\n");

  install(workspace, resources);

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(workspace, "package.json"))
  );
  assert.equal(packageJson.name, "existing");
  assert.equal(packageJson.scripts.build, "node build.js");
  const mcp = JSON.parse(
    fs.readFileSync(path.join(workspace, ".vscode", "mcp.json"))
  );
  assert.deepEqual(mcp.servers.internal, { command: "internal-mcp" });
  assert.match(
    fs.readFileSync(path.join(workspace, ".gitignore"), "utf8"),
    /^dist\/$/m
  );
});

test("reports conflicts without changing the workspace", () => {
  const workspace = temporaryDirectory("sf-jira-workspace-");
  const resources = createResources();
  const target = path.join(workspace, FILES[0][0]);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "project-specific agent\n");
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify({ scripts: { "story:start": "custom command" } })
  );

  const conflicts = findConflicts(workspace, resources);
  assert.ok(conflicts.includes(FILES[0][0]));
  assert.ok(conflicts.includes("package.json#scripts.story:start"));
  const result = install(workspace, resources);
  assert.deepEqual(result.conflicts, conflicts);
  assert.equal(fs.readFileSync(target, "utf8"), "project-specific agent\n");
  assert.equal(
    fs.existsSync(path.join(workspace, ".vscode", "mcp.json")),
    false
  );
});

test("explicit overwrite replaces only managed conflicts and is idempotent", () => {
  const workspace = temporaryDirectory("sf-jira-workspace-");
  const resources = createResources();
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify({
      name: "existing",
      scripts: { "story:start": "custom command", build: "keep-me" }
    })
  );

  const first = install(workspace, resources, { overwrite: true });
  assert.equal(first.installed.length, FILES.length);
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(workspace, "package.json"))
  );
  assert.equal(
    packageJson.scripts["story:start"],
    WORKSPACE_SCRIPTS["story:start"]
  );
  assert.equal(packageJson.scripts.build, "keep-me");

  const second = install(workspace, resources);
  assert.equal(second.conflicts.length, 0);
  assert.equal(second.installed.length, 0);
  assert.equal(second.unchanged.length, FILES.length);
});

test("invalid existing JSON fails without silently replacing it", () => {
  const workspace = temporaryDirectory("sf-jira-workspace-");
  const resources = createResources();
  fs.writeFileSync(path.join(workspace, "package.json"), "{ invalid");

  assert.throws(
    () => install(workspace, resources),
    /Cannot parse .*package\.json/
  );
});
