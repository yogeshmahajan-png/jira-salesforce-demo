// Offline report builder. Copilot executes tests, verifies Jira parent links,
// and supplies observed results before invoking this formatter.
const fs = require("node:fs");
const path = require("node:path");
const statuses = ["Passed", "Failed", "Blocked", "Not Run"];
const keyPattern = /^[A-Z][A-Z0-9_]*-\d+$/;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function string(value, name) {
  requireValue(
    typeof value === "string" && value.trim(),
    `${name} is required`
  );
  return value.trim();
}
function list(value, name, nonempty = false) {
  requireValue(Array.isArray(value), `${name} must be an array`);
  const result = value.map((item) => string(item, name));
  requireValue(!nonempty || result.length, `${name} must not be empty`);
  requireValue(
    new Set(result).size === result.length,
    `${name} contains duplicates`
  );
  return result;
}
function issue(value) {
  requireValue(keyPattern.test(value), "Invalid Jira issue key");
  return value;
}
function normalize(input) {
  requireValue(input && input.version === 1, "Input version must be 1");
  const run = {};
  for (const name of ["id", "time", "org", "branch", "commit"]) {
    run[name] = string(input.run?.[name], `run.${name}`);
  }
  requireValue(Number.isFinite(Date.parse(run.time)), "Invalid run.time");
  const deployment = {};
  deployment.status = string(input.deployment?.status, "deployment.status");
  requireValue(
    ["Succeeded", "Failed", "Not Run"].includes(deployment.status),
    "Invalid deployment.status"
  );
  for (const name of ["id", "details"])
    deployment[name] = string(input.deployment?.[name], `deployment.${name}`);
  deployment.components = list(
    input.deployment.components,
    "deployment.components"
  );
  const criteria = list(input.criteria, "criteria", true);
  requireValue(Array.isArray(input.cases), "cases must be an array");
  const ids = new Set();
  const keys = new Set();
  const cases = input.cases.map((source) => {
    const c = {};
    for (const name of [
      "id",
      "key",
      "expected",
      "actual",
      "method",
      "result",
      "followUp",
      "cleanup"
    ]) {
      c[name] = string(source[name], `case.${name}`);
    }
    requireValue(/^TC-\d+$/.test(c.id), "Case ID must be TC-<number>");
    issue(c.key);
    requireValue(c.key !== input.story, "Case key cannot be the parent story");
    requireValue(
      !ids.has(c.id) && !keys.has(c.key),
      "Duplicate case ID or subtask key"
    );
    ids.add(c.id);
    keys.add(c.key);
    requireValue(statuses.includes(c.result), `Invalid result for ${c.id}`);
    c.ac = list(source.ac, `${c.id}.ac`, true);
    requireValue(
      c.ac.every((ac) => criteria.includes(ac)),
      `Unknown AC in ${c.id}`
    );
    c.evidence = list(source.evidence, `${c.id}.evidence`);
    if (["Passed", "Failed"].includes(c.result)) {
      requireValue(c.evidence.length, `${c.id} requires execution evidence`);
      requireValue(
        source.commit === run.commit,
        `${c.id} tested commit must match run.commit`
      );
      c.commit = source.commit;
    }
    return c;
  });
  const totals = Object.fromEntries(
    statuses.map((s) => [s, cases.filter((c) => c.result === s).length])
  );
  totals.total = cases.length;
  const uncovered = criteria.filter(
    (ac) => !cases.some((c) => c.ac.includes(ac))
  );
  const testing = totals.Failed
    ? "Failed"
    : !cases.length || uncovered.length || totals.Blocked || totals["Not Run"]
      ? "Incomplete"
      : "Passed";
  const jira = new URL(string(input.jiraUrl, "jiraUrl"));
  requireValue(
    jira.protocol === "https:" &&
      !jira.username &&
      !jira.password &&
      !jira.search &&
      !jira.hash,
    "jiraUrl must be an HTTPS base URL without credentials, query, or fragment"
  );
  return {
    version: 1,
    story: issue(input.story),
    jiraUrl: jira.href.replace(/\/$/, ""),
    run,
    deployment,
    security: list(input.security, "security"),
    criteria,
    cases,
    totals,
    uncovered,
    testing
  };
}

// Escape user text in Markdown tables; ADF uses literal text nodes.
function cell(value) {
  return String(value)
    .replace(/[\\`*_{}\[\]()<>#!|]/g, "\\$&")
    .replace(/\r?\n/g, " ");
}
function adf(text) {
  return {
    version: 1,
    type: "doc",
    content: text
      .split("\n")
      .filter(Boolean)
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }]
      }))
  };
}
function reports(result) {
  const { run, deployment: d } = result;
  const context = `Run: ${run.id} | ${run.time} | Org: ${run.org} | Branch: ${run.branch} | Commit: ${run.commit}`;
  const header = [
    `Story: ${result.story}`,
    context,
    `Deployment: ${d.status} | ID: ${d.id} | ${d.details}`,
    `Components: ${d.components.join(", ") || "None"}`,
    `Security: ${result.security.join("; ") || "Not applicable"}`,
    `Testing: ${result.testing}`,
    `Totals: ${JSON.stringify(result.totals)}`,
    `Uncovered ACs: ${result.uncovered.join(", ") || "None"}`
  ];
  const rows = result.cases.map((c) => [
    cell(c.ac.join(", ")),
    `[${c.key}](${result.jiraUrl}/browse/${c.key})`,
    `${cell(c.expected)} -> ${cell(c.actual)}`,
    c.result,
    cell(c.evidence.join("; ") || "None"),
    cell(c.followUp)
  ]);
  const markdown = [
    ...header.map(cell),
    "",
    "| AC | Subtask | Expected -> actual | Result | Evidence | Follow-up |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    ""
  ].join("\n");
  const caseText = (c) =>
    [
      `${c.id} | ${c.key} | AC: ${c.ac.join(", ")} | ${c.result}`,
      context,
      `Method: ${c.method}`,
      `Expected: ${c.expected}`,
      `Actual: ${c.actual}`,
      `Evidence: ${c.evidence.join("; ") || "None"}`,
      `Follow-up: ${c.followUp}`,
      `Cleanup: ${c.cleanup}`
    ].join("\n");
  const parentText = [
    ...header,
    ...result.cases.map(
      (c) =>
        `${c.ac.join(", ")} | ${result.jiraUrl}/browse/${c.key} | ${c.expected} -> ${c.actual} | ${c.result} | Evidence: ${c.evidence.join("; ") || "None"} | Follow-up: ${c.followUp}`
    )
  ].join("\n");
  const comments = [
    { issueKey: result.story, text: parentText },
    ...result.cases.map((c) => ({ issueKey: c.key, text: caseText(c) }))
  ]
    .map((c) => ({
      ...c,
      marker: `test-report:${result.story}:${run.id}:${c.issueKey}`
    }))
    .map((c) => ({
      ...c,
      text: `${c.marker}\n${c.text}`,
      body: adf(`${c.marker}\n${c.text}`)
    }));
  return { markdown, comments };
}

function main(args) {
  requireValue(
    args.length === 2,
    "Usage: npm run story:report -- <input.json> <new-output-directory>"
  );
  const input = JSON.parse(
    fs.readFileSync(args[0], "utf8").replace(/^\uFEFF/, "")
  );
  const result = normalize(input);
  const generated = reports(result);
  const directory = path.resolve(args[1]);
  requireValue(
    !fs.existsSync(directory),
    "Output directory already exists; use a new directory to preserve run history"
  );
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "test-results.json"),
    JSON.stringify(result) + "\n",
    { flag: "wx" }
  );
  fs.writeFileSync(path.join(directory, "jira-report.md"), generated.markdown, {
    flag: "wx"
  });
  fs.writeFileSync(
    path.join(directory, "jira-comments.json"),
    JSON.stringify(generated.comments) + "\n",
    { flag: "wx" }
  );
  console.log(
    JSON.stringify({
      story: result.story,
      testing: result.testing,
      totals: result.totals,
      uncovered: result.uncovered,
      directory
    })
  );
  // 2 means valid report requiring follow-up, not a report-generation failure.
  return result.testing === "Passed" && result.deployment.status === "Succeeded"
    ? 0
    : 2;
}
if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { normalize, reports, main };
