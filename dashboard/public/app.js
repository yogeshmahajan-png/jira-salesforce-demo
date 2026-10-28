"use strict";

const runList = document.querySelector("#run-list");
const searchInput = document.querySelector("#search");
const statusFilter = document.querySelector("#status-filter");
const dateFrom = document.querySelector("#date-from");
const dateTo = document.querySelector("#date-to");
const resultCount = document.querySelector("#result-count");
let runs = [];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function statusClass(status) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function renderRun(run) {
  const card = element("article", "run-card");
  const summary = element("div", "run-summary");
  const identity = element("div", "run-identity");
  const titleRow = element("div", "run-title-row");
  const title = element("h3", "run-title");
  title.append(
    element("span", "issue-link", run.story),
    document.createTextNode(` · ${run.runId}`)
  );
  titleRow.append(title);
  const badge = element(
    "span",
    `badge badge-${statusClass(run.status)}`,
    run.status
  );
  titleRow.append(badge);
  identity.append(titleRow);

  const meta = element("div", "run-meta");
  meta.append(
    element("span", "", formatDate(run.time)),
    element("span", "", run.branch),
    element("span", "", run.org)
  );
  identity.append(meta);

  const outcome = element("div", "run-outcome");
  const deployment = element("div", "outcome-item");
  deployment.append(
    element("span", "outcome-label", "Deployment"),
    element("strong", "", run.deployment)
  );
  const testing = element("div", "outcome-item");
  testing.append(
    element("span", "outcome-label", "Testing"),
    element("strong", "", run.testing)
  );
  outcome.append(deployment, testing);
  summary.append(identity, outcome);
  card.append(summary);

  const detail = element("details", "run-details");
  const detailSummary = element("summary", "", "View run details");
  const detailGrid = element("div", "detail-grid");
  const detailValues = [
    ["Commit", run.commit],
    ["Deployment ID", run.deploymentId],
    ["Components", run.componentCount ?? "Not recorded"],
    ["Test cases", run.totals.total ?? 0],
    ["Acceptance criteria", run.criteriaCount],
    ["Uncovered criteria", run.uncoveredCount]
  ];
  for (const [label, value] of detailValues) {
    const item = element("div", "detail-item");
    item.append(
      element("span", "detail-label", label),
      element("strong", "detail-value", String(value))
    );
    detailGrid.append(item);
  }

  const totals = element(
    "p",
    "test-totals",
    `${run.totals.Passed || 0} passed · ${run.totals.Failed || 0} failed · ${run.totals.Blocked || 0} blocked · ${run.totals["Not Run"] || 0} not run`
  );
  detail.append(detailSummary, detailGrid, totals);
  if (run.deploymentDetails) {
    detail.append(element("p", "deployment-details", run.deploymentDetails));
  }
  card.append(detail);
  return card;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const filtered = runs.filter((run) => {
    const timestamp = Date.parse(run.time);
    const day = new Date(timestamp).toISOString().slice(0, 10);
    const searchable = [run.story, run.runId, run.branch, run.org, run.commit]
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (!status || run.status === status) &&
      (!dateFrom.value || day >= dateFrom.value) &&
      (!dateTo.value || day <= dateTo.value)
    );
  });

  runList.replaceChildren();
  resultCount.textContent = `${filtered.length} of ${runs.length} runs`;
  if (!filtered.length) {
    runList.append(
      element(
        "div",
        "empty-state",
        runs.length
          ? "No runs match these filters. Try changing or clearing them."
          : "No recorded runs found. Run a delivery workflow that writes artifacts to artifacts/jira/."
      )
    );
    return;
  }

  for (const run of filtered) runList.append(renderRun(run));
}

async function loadRuns() {
  const refreshButton = document.querySelector("#refresh");
  refreshButton.disabled = true;
  try {
    const response = await fetch("/api/runs", { cache: "no-store" });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const data = await response.json();
    runs = Array.isArray(data.runs) ? data.runs : [];

    document.querySelector("#metric-total").textContent = runs.length;
    document.querySelector("#metric-succeeded").textContent = runs.filter(
      (run) => run.status === "Succeeded"
    ).length;
    document.querySelector("#metric-failed").textContent = runs.filter(
      (run) => run.status === "Failed"
    ).length;
    document.querySelector("#metric-incomplete").textContent = runs.filter(
      (run) => ["Incomplete", "Not completed"].includes(run.status)
    ).length;
    document.querySelector("#last-updated").textContent =
      `Updated ${formatDate(data.generatedAt)}`;

    const warningBanner = document.querySelector("#warning-banner");
    warningBanner.hidden = !data.warnings?.length;
    warningBanner.textContent = data.warnings?.length
      ? `${data.warnings.length} artifact file(s) could not be read. The visible run data may be incomplete.`
      : "";
    render();
  } catch (error) {
    runList.replaceChildren(
      element(
        "div",
        "error-state",
        `Could not load dashboard data: ${error.message}`
      )
    );
    document.querySelector("#last-updated").textContent = "Update failed";
  } finally {
    refreshButton.disabled = false;
  }
}

for (const input of [searchInput, statusFilter, dateFrom, dateTo]) {
  input.addEventListener("input", render);
  input.addEventListener("change", render);
}
document.querySelector("#filters").addEventListener("submit", (event) => {
  event.preventDefault();
});
document.querySelector("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  statusFilter.value = "";
  dateFrom.value = "";
  dateTo.value = "";
  render();
});
document.querySelector("#refresh").addEventListener("click", loadRuns);

loadRuns();
