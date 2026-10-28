"use strict";

const fs = require("node:fs");
const path = require("node:path");

const JIRA_KEY_PATTERN = /^[A-Z][A-Z0-9_]*-\d+$/i;

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listJsonFiles(fullPath);
    }

    return entry.isFile() && entry.name.endsWith(".json") ? [fullPath] : [];
  });
}

function readJson(file, warnings) {
  try {
    const contents = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(contents);
  } catch (error) {
    warnings.push({
      file: path.relative(process.cwd(), file),
      message: `Could not read JSON artifact: ${error.message}`
    });
    return undefined;
  }
}

function findTestReport(storyDirectory, runId, warnings) {
  const reports = listJsonFiles(storyDirectory).filter(
    (file) => path.basename(file) === "test-results.json"
  );

  for (const file of reports) {
    const report = readJson(file, warnings);
    if (report?.run?.id === runId) {
      return report;
    }
  }

  return undefined;
}

function testingStatus(report, input) {
  if (report && typeof report.testing === "string") {
    return report.testing;
  }

  const cases = Array.isArray(report?.cases)
    ? report.cases
    : Array.isArray(input.cases)
      ? input.cases
      : [];
  if (cases.some((testCase) => testCase.result === "Failed")) {
    return "Failed";
  }
  if (cases.length && cases.every((testCase) => testCase.result === "Passed")) {
    return "Passed";
  }
  if (
    cases.some(
      (testCase) =>
        testCase.result === "Blocked" || testCase.result === "Not Run"
    )
  ) {
    return "Incomplete";
  }
  return cases.length ? "Incomplete" : "Not recorded";
}

function runStatus(deployment, testing) {
  if (deployment === "Failed" || testing === "Failed") {
    return "Failed";
  }
  if (deployment === "Succeeded" && testing === "Passed") {
    return "Succeeded";
  }
  if (deployment === "Not Run" && testing === "Not recorded") {
    return "Not completed";
  }
  return "Incomplete";
}

function normalizeRun(input, file, warnings) {
  if (
    !input ||
    input.version !== 1 ||
    typeof input.story !== "string" ||
    !JIRA_KEY_PATTERN.test(input.story) ||
    typeof input.run?.id !== "string" ||
    typeof input.run?.time !== "string" ||
    !Number.isFinite(Date.parse(input.run.time))
  ) {
    return undefined;
  }

  const story = input.story.toUpperCase();
  const storyDirectory = path.dirname(file);
  const report = findTestReport(storyDirectory, input.run.id, warnings);
  const deployment =
    typeof input.deployment?.status === "string"
      ? input.deployment.status
      : "Not Run";
  const testing = testingStatus(report, input);
  const cases = Array.isArray(report?.cases)
    ? report.cases
    : Array.isArray(input.cases)
      ? input.cases
      : [];
  const totals =
    report?.totals ||
    cases.reduce(
      (result, testCase) => {
        if (testCase.result === "Passed") result.Passed += 1;
        else if (testCase.result === "Failed") result.Failed += 1;
        else if (testCase.result === "Blocked") result.Blocked += 1;
        else result["Not Run"] += 1;
        return result;
      },
      { Passed: 0, Failed: 0, Blocked: 0, "Not Run": 0, total: cases.length }
    );

  return {
    id: `${story}:${input.run.id}`,
    story,
    runId: input.run.id,
    time: input.run.time,
    org: input.run.org || "Not recorded",
    branch: input.run.branch || "Not recorded",
    commit: input.run.commit || "Not recorded",
    deployment,
    deploymentId: input.deployment?.id || "Not recorded",
    deploymentDetails: input.deployment?.details || "",
    componentCount: Array.isArray(input.deployment?.components)
      ? input.deployment.components.length
      : undefined,
    testing,
    totals,
    criteriaCount: Array.isArray(input.criteria) ? input.criteria.length : 0,
    uncoveredCount: Array.isArray(report?.uncovered)
      ? report.uncovered.length
      : 0,
    status: runStatus(deployment, testing)
  };
}

function loadRuns(artifactsDirectory) {
  const warnings = [];
  const storyDirectories = fs.existsSync(artifactsDirectory)
    ? fs
        .readdirSync(artifactsDirectory, { withFileTypes: true })
        .filter(
          (entry) => entry.isDirectory() && JIRA_KEY_PATTERN.test(entry.name)
        )
        .map((entry) => path.join(artifactsDirectory, entry.name))
    : [];
  const runs = [];

  for (const storyDirectory of storyDirectories) {
    const inputFiles = listJsonFiles(storyDirectory).filter(
      (file) =>
        path.basename(file) === "input.json" ||
        path.basename(file).endsWith("-input.json")
    );

    for (const file of inputFiles) {
      const input = readJson(file, warnings);
      const run = normalizeRun(input, file, warnings);
      if (run) runs.push(run);
    }
  }

  runs.sort((left, right) => Date.parse(right.time) - Date.parse(left.time));
  return { runs, warnings };
}

module.exports = { loadRuns };
