"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FILES = [
  [
    ".github/agents/salesforce-jira-delivery.agent.md",
    "agent/salesforce-jira-delivery.agent.md"
  ],
  [
    ".github/prompts/implement-jira.prompt.md",
    "prompts/implement-jira.prompt.md"
  ],
  [".github/prompts/test-jira.prompt.md", "prompts/test-jira.prompt.md"],
  [".github/prompts/test-report-guide.md", "prompts/test-report-guide.md"],
  ["scripts/story.js", "scripts/story.js"],
  ["scripts/test-report.js", "scripts/test-report.js"],
  ["scripts/test-report.test.js", "scripts/test-report.test.js"],
  ["scripts/test-results.example.json", "scripts/test-results.example.json"]
];

const WORKSPACE_SCRIPTS = {
  "story:start": "node scripts/story.js start",
  "story:publish": "node scripts/story.js publish",
  "story:report": "node scripts/test-report.js",
  "test:report": "node --test scripts/test-report.test.js"
};

const ATLASSIAN_SERVER = {
  url: "https://mcp.atlassian.com/v1/mcp/authv2",
  type: "http"
};

function readJson(file, fallback) {
  if (!fs.existsSync(file)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`Cannot parse ${file}: ${error.message}`);
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sameFile(left, right) {
  return (
    fs.existsSync(left) && fs.readFileSync(left).equals(fs.readFileSync(right))
  );
}

function findConflicts(workspace, resources) {
  const conflicts = [];

  for (const [destination, source] of FILES) {
    const target = path.join(workspace, destination);
    const bundled = path.join(resources, source);
    if (fs.existsSync(target) && !sameFile(target, bundled)) {
      conflicts.push(destination);
    }
  }

  const packageFile = path.join(workspace, "package.json");
  const packageJson = readJson(packageFile, {});
  for (const [name, command] of Object.entries(WORKSPACE_SCRIPTS)) {
    if (packageJson.scripts?.[name] && packageJson.scripts[name] !== command) {
      conflicts.push(`package.json#scripts.${name}`);
    }
  }

  const mcpFile = path.join(workspace, ".vscode", "mcp.json");
  const mcp = readJson(mcpFile, {});
  if (
    mcp.servers?.atlassian &&
    JSON.stringify(mcp.servers.atlassian) !== JSON.stringify(ATLASSIAN_SERVER)
  ) {
    conflicts.push(".vscode/mcp.json#servers.atlassian");
  }

  return conflicts;
}

function copyFiles(workspace, resources, overwrite) {
  const installed = [];
  const unchanged = [];

  for (const [destination, source] of FILES) {
    const target = path.join(workspace, destination);
    const bundled = path.join(resources, source);

    if (sameFile(target, bundled)) {
      unchanged.push(destination);
      continue;
    }

    if (fs.existsSync(target) && !overwrite) {
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(bundled, target);
    installed.push(destination);
  }

  return { installed, unchanged };
}

function mergePackageJson(workspace, overwrite) {
  const file = path.join(workspace, "package.json");
  const packageJson = readJson(file, {
    name: path
      .basename(workspace)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-"),
    private: true,
    version: "1.0.0"
  });
  packageJson.scripts ||= {};

  for (const [name, command] of Object.entries(WORKSPACE_SCRIPTS)) {
    if (!packageJson.scripts[name] || overwrite) {
      packageJson.scripts[name] = command;
    }
  }

  writeJson(file, packageJson);
}

function mergeMcpJson(workspace, overwrite) {
  const file = path.join(workspace, ".vscode", "mcp.json");
  const mcp = readJson(file, {});
  mcp.servers ||= {};
  mcp.inputs ||= [];

  if (!mcp.servers.atlassian || overwrite) {
    mcp.servers.atlassian = ATLASSIAN_SERVER;
  }

  writeJson(file, mcp);
}

function ensureGitignore(workspace) {
  const file = path.join(workspace, ".gitignore");
  const entry = "artifacts/jira/";
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const lines = current.split(/\r?\n/);

  if (lines.includes(entry)) {
    return;
  }

  const separator = current && !current.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(
    file,
    `${current}${separator}\n# Salesforce Jira Delivery reports\n${entry}\n`
  );
}

function install(workspace, resources, options = {}) {
  const overwrite = options.overwrite === true;
  const conflicts = findConflicts(workspace, resources);

  if (conflicts.length && !overwrite) {
    return { conflicts, installed: [], unchanged: [] };
  }

  const copied = copyFiles(workspace, resources, overwrite);
  mergePackageJson(workspace, overwrite);
  mergeMcpJson(workspace, overwrite);
  ensureGitignore(workspace);

  return { conflicts: [], ...copied };
}

module.exports = {
  ATLASSIAN_SERVER,
  FILES,
  WORKSPACE_SCRIPTS,
  findConflicts,
  install
};
