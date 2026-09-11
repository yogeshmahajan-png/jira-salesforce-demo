const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { normalize, reports } = require("./test-report");
const example = require("./test-results.example.json");
const fixture = () => JSON.parse(JSON.stringify(example));
function passed() {
  const data = fixture();
  data.run.commit = "abc1234";
  data.deployment.status = "Succeeded";
  Object.assign(data.cases[0], {
    result: "Passed",
    actual: "Saved and read back expected value",
    evidence: ["Sanitized API response: Customer_Tier__c=Gold"],
    commit: data.run.commit,
    followUp: "None"
  });
  return data;
}

test("incomplete runs and uncovered criteria never pass", () => {
  assert.equal(normalize(fixture()).testing, "Incomplete");
  const data = passed();
  data.criteria.push("AC-02");
  const result = normalize(data);
  assert.equal(result.testing, "Incomplete");
  assert.deepEqual(result.uncovered, ["AC-02"]);
  data.cases = [];
  assert.equal(normalize(data).testing, "Incomplete");
});
test("mixed results reconcile and failure takes precedence", () => {
  const data = passed();
  for (const [index, result] of ["Failed", "Blocked", "Not Run"].entries()) {
    data.cases.push({
      ...data.cases[0],
      id: `TC-${index + 2}`,
      key: `SF-${index + 127}`,
      result
    });
  }
  const result = normalize(data);
  assert.equal(result.testing, "Failed");
  assert.deepEqual(result.totals, {
    Passed: 1,
    Failed: 1,
    Blocked: 1,
    "Not Run": 1,
    total: 4
  });
});
test("rejects unsupported, duplicated, stale, or unevidenced results", () => {
  for (const mutate of [
    (d) => {
      d.cases[0].result = "Skipped";
    },
    (d) => {
      d.cases[0].evidence = [];
    },
    (d) => {
      d.cases[0].commit = "old";
    },
    (d) => {
      d.cases[0].ac = ["AC-99"];
    },
    (d) => {
      d.cases.push({ ...d.cases[0] });
    },
    (d) => {
      d.cases[0].key = d.story;
    },
    (d) => {
      d.jiraUrl = "https://user:secret@example.com";
    }
  ]) {
    const data = passed();
    mutate(data);
    assert.throws(() => normalize(data));
  }
});
test("generates reproducible parent/subtask text and ADF payloads", () => {
  const data = passed();
  data.cases[0].actual = "Value | saved\nnext line";
  const result = normalize(data);
  const output = reports(result);
  assert.equal(output.comments.length, 2);
  assert.equal(output.comments[0].issueKey, data.story);
  assert.equal(output.comments[1].issueKey, data.cases[0].key);
  assert.match(output.markdown, /^## Test report: SF-125/m);
  assert.match(output.markdown, /### Testing summary/);
  assert.match(
    output.markdown,
    /Totals:\*\* 1 passed, 0 failed, 0 blocked, 0 not run \(1 total\)/
  );
  assert.match(output.markdown, /### Test cases/);
  assert.match(output.markdown, /Value \\\| saved next line/);
  assert.equal(output.comments[1].body.type, "doc");
  assert.ok(output.comments[1].text.startsWith(output.comments[1].marker));
  assert.deepEqual(reports(result), output);
});
test("CLI writes compact artifacts, returns meaningful exit codes, and preserves prior runs", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "jira-report-test-"));
  try {
    const input = path.join(temp, "input.json");
    const out = path.join(temp, "out");
    const cli = (...args) =>
      spawnSync(
        process.execPath,
        [path.join(__dirname, "test-report.js"), ...args],
        { encoding: "utf8" }
      );
    fs.writeFileSync(input, JSON.stringify(fixture()));
    assert.equal(cli(input, out).status, 2);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(out, "test-results.json"))).testing,
      "Incomplete"
    );
    assert.ok(fs.existsSync(path.join(out, "jira-report.md")));
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(out, "jira-comments.json"))).length,
      2
    );
    assert.equal(cli(input, out).status, 1);
    fs.writeFileSync(input, JSON.stringify(passed()));
    assert.equal(cli(input, path.join(temp, "passed")).status, 0);
    fs.writeFileSync(input, "{}");
    const invalid = path.join(temp, "invalid");
    assert.equal(cli(input, invalid).status, 1);
    assert.equal(fs.existsSync(invalid), false);
  } finally {
    // Remove only the unique temporary directory created by this test.
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
test("CLI reports deployment failures even when test cases pass", () => {
  const temp = fs.mkdtempSync(
    path.join(os.tmpdir(), "jira-report-deploy-failure-")
  );
  try {
    const input = path.join(temp, "input.json");
    const out = path.join(temp, "out");
    const data = passed();
    data.deployment.status = "Failed";
    data.deployment.details = "Deployment validation failed";
    fs.writeFileSync(input, JSON.stringify(data));
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, "test-report.js"), input, out],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 2);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(out, "test-results.json")))
        .deployment.status,
      "Failed"
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
