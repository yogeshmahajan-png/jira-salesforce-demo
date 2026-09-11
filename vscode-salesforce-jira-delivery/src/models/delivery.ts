export const DELIVERY_STEPS = [
  "Implementation",
  "Testing",
  "Deployment",
  "Git",
  "Jira Report"
] as const;

export type DeliveryStep = (typeof DELIVERY_STEPS)[number];
export type StepStatus = "pending" | "active" | "complete" | "blocked";

export type ApprovalStatus =
  | "NOT_REQUESTED"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export interface StepState {
  status: StepStatus;
  detail: string;
}

export interface ExecutionPipelineItem {
  key: "deploy" | "tests" | "jira" | "gitCommit" | "gitPush";
  label: string;
  status: StepStatus;
  detail: string;
}

export interface AnalysisChecklistItem {
  key:
    | "requirement"
    | "security"
    | "fields"
    | "permissionSets"
    | "validationRules"
    | "tests"
    | "dryRun";
  label: string;
  status: "complete" | "pending" | "blocked";
  detail?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
}

export interface DryRunResult {
  fields: string[];
  permissionSets: string[];
  validationRules: string[];
  tests: string[];
  deployment: "NOT_EXECUTED";
  git: "NOT_EXECUTED";
  jiraUpdate: "NOT_EXECUTED";
  generatedAt: string;
}

export interface DeliveryState {
  schemaVersion: 1;
  jiraKey: string;
  status:
    | "NEW"
    | "STARTED"
    | "ANALYZED"
    | "AWAITING_APPROVAL"
    | "EXECUTING"
    | "IMPLEMENTED"
    | "COMPLETED"
    | "BLOCKED"
    | "FAILED";
  branch?: string;
  targetOrg: string;
  dryRun: boolean;
  approval?: ApprovalStatus;
  dryRunResult?: DryRunResult;
  security: {
    status: "PENDING" | "NOT_REQUIRED" | "VALIDATED" | "BLOCKED";
    source?: string;
  };
  implementation: {
    status: "PENDING" | "PLANNED" | "IN_PROGRESS" | "SUCCESS" | "FAILED";
    components: number;
  };
  testing: {
    status: "NOT_RUN" | "RUNNING" | "PASS" | "FAIL" | "BLOCKED";
  } & TestSummary;
  deployment: {
    status: "NOT_RUN" | "RUNNING" | "SUCCESS" | "FAILED" | "BLOCKED";
    id?: string;
  };
  git: {
    status:
      | "PENDING"
      | "COMMITTING"
      | "COMMITTED"
      | "PUBLISHING"
      | "PUSHING"
      | "PUSHED"
      | "FAILED";
    commit?: string;
  };
  jiraReport: {
    status: "PENDING" | "RUNNING" | "POSTED" | "FAILED";
  };
  updatedAt: string;
}

export function normalizeJiraKey(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const key = String(value).trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(key)) {
    throw new Error(`Invalid Jira key: ${value}`);
  }
  return key;
}

export function createDeliveryState(
  jiraKey: string,
  targetOrg = "CopilotJiraOrg",
  dryRun = true
): DeliveryState {
  const normalizedKey = normalizeJiraKey(jiraKey);
  if (!normalizedKey) {
    throw new Error("A Jira key is required.");
  }
  if (!targetOrg.trim()) {
    throw new Error("A Salesforce target org is required.");
  }

  return {
    schemaVersion: 1,
    jiraKey: normalizedKey,
    status: "NEW",
    targetOrg: targetOrg.trim(),
    dryRun,
    approval: "NOT_REQUESTED",
    security: { status: "PENDING" },
    implementation: { status: "PENDING", components: 0 },
    testing: {
      status: "NOT_RUN",
      total: 0,
      passed: 0,
      failed: 0,
      blocked: 0
    },
    deployment: { status: "NOT_RUN" },
    git: { status: "PENDING" },
    jiraReport: { status: "PENDING" },
    updatedAt: new Date().toISOString()
  };
}

export function updateDeliveryState(
  state: DeliveryState,
  update: Partial<Omit<DeliveryState, "schemaVersion" | "jiraKey">>
): DeliveryState {
  const updated = {
    ...state,
    ...update,
    updatedAt: new Date().toISOString()
  };
  return update.status ? updated : { ...updated, status: deriveStatus(updated) };
}

export function getAnalysisChecklist(
  state?: DeliveryState
): AnalysisChecklistItem[] {
  if (!state) {
    return [];
  }

  const items: AnalysisChecklistItem[] = [];

  // 1. Requirement analysis
  const reqComplete =
    Boolean(state.dryRunResult) ||
    [
      "ANALYZED",
      "AWAITING_APPROVAL",
      "EXECUTING",
      "IMPLEMENTED",
      "COMPLETED"
    ].includes(state.status) ||
    state.implementation.status === "PLANNED" ||
    state.implementation.status === "SUCCESS";

  items.push({
    key: "requirement",
    label: reqComplete ? "Requirement analyzed" : "Requirement analysis",
    status: reqComplete ? "complete" : "pending"
  });

  // 2. Security mapping
  if (state.security.status === "BLOCKED") {
    items.push({
      key: "security",
      label: "Security mapping blocked",
      status: "blocked",
      detail: state.security.source
    });
  } else {
    const secComplete =
      state.security.status === "VALIDATED" ||
      state.security.status === "NOT_REQUIRED" ||
      (Boolean(state.dryRunResult) &&
        (state.dryRunResult?.permissionSets.length ?? 0) >= 0);
    items.push({
      key: "security",
      label: secComplete ? "Security mapping found" : "Security mapping",
      status: secComplete ? "complete" : "pending",
      detail: state.security.source || "Confluence"
    });
  }

  // 3. Fields identified
  if (state.dryRunResult && state.dryRunResult.fields.length > 0) {
    const count = state.dryRunResult.fields.length;
    items.push({
      key: "fields",
      label: `${count} field${count === 1 ? "" : "s"} identified`,
      status: "complete",
      detail: state.dryRunResult.fields.join(", ")
    });
  }

  // 4. Permission sets identified
  if (state.dryRunResult && state.dryRunResult.permissionSets.length > 0) {
    const count = state.dryRunResult.permissionSets.length;
    items.push({
      key: "permissionSets",
      label:
        count === 1
          ? "Permission Sets identified"
          : `${count} Permission Sets identified`,
      status: "complete",
      detail: state.dryRunResult.permissionSets.join(", ")
    });
  }

  // 5. Validation rules identified
  if (state.dryRunResult && state.dryRunResult.validationRules.length > 0) {
    const count = state.dryRunResult.validationRules.length;
    items.push({
      key: "validationRules",
      label: `${count} validation rule${count === 1 ? "" : "s"} identified`,
      status: "complete",
      detail: state.dryRunResult.validationRules.join(", ")
    });
  }

  // 6. Test cases generated
  const testCount =
    state.dryRunResult?.tests.length ?? state.testing.total ?? 0;
  if (testCount > 0) {
    items.push({
      key: "tests",
      label: `${testCount} test cases generated`,
      status: "complete",
      detail: `${testCount} test cases`
    });
  }

  // 7. Dry run completed
  const dryRunDone = Boolean(state.dryRunResult);
  items.push({
    key: "dryRun",
    label: dryRunDone ? "Dry Run completed" : "Dry Run",
    status: dryRunDone ? "complete" : "pending",
    detail: dryRunDone ? "Verified" : undefined
  });

  return items;
}

export function getExecutionPipeline(
  state?: DeliveryState
): ExecutionPipelineItem[] {
  if (!state) {
    return [];
  }

  const items: ExecutionPipelineItem[] = [];

  // 1. Deploying Salesforce metadata
  if (state.deployment.status === "RUNNING") {
    items.push({
      key: "deploy",
      label: "Deploying Salesforce metadata...",
      status: "active",
      detail: "Deploying..."
    });
  } else if (state.deployment.status === "SUCCESS") {
    items.push({
      key: "deploy",
      label: "Deploy Salesforce metadata",
      status: "complete",
      detail: state.deployment.id ? `Deployed (${state.deployment.id})` : "Deployed"
    });
  } else if (
    state.deployment.status === "FAILED" ||
    state.deployment.status === "BLOCKED"
  ) {
    items.push({
      key: "deploy",
      label: "Deploy Salesforce metadata",
      status: "blocked",
      detail: "Failed"
    });
  } else {
    items.push({
      key: "deploy",
      label: "Deploy Salesforce metadata",
      status: "pending",
      detail: "Pending"
    });
  }

  // 2. Running tests
  if (state.testing.status === "RUNNING") {
    items.push({
      key: "tests",
      label: "Running tests...",
      status: "active",
      detail: "Executing..."
    });
  } else if (state.testing.status === "PASS") {
    items.push({
      key: "tests",
      label: "Running tests",
      status: "complete",
      detail:
        state.testing.total > 0
          ? `Passed (${state.testing.passed}/${state.testing.total})`
          : "Passed"
    });
  } else if (
    state.testing.status === "FAIL" ||
    state.testing.status === "BLOCKED"
  ) {
    items.push({
      key: "tests",
      label: "Running tests",
      status: "blocked",
      detail:
        state.testing.status === "BLOCKED"
          ? "Blocked"
          : `Failed (${state.testing.failed})`
    });
  } else {
    items.push({
      key: "tests",
      label: "Running tests",
      status: "pending",
      detail: "Pending"
    });
  }

  // 3. Updating Jira
  if (
    state.jiraReport.status === "RUNNING"
  ) {
    items.push({
      key: "jira",
      label: "Updating Jira...",
      status: "active",
      detail: "Posting..."
    });
  } else if (state.jiraReport.status === "POSTED") {
    items.push({
      key: "jira",
      label: "Updating Jira",
      status: "complete",
      detail: "Updated"
    });
  } else if (state.jiraReport.status === "FAILED") {
    items.push({
      key: "jira",
      label: "Updating Jira",
      status: "blocked",
      detail: "Failed"
    });
  } else {
    items.push({
      key: "jira",
      label: "Updating Jira",
      status: "pending",
      detail: "Pending"
    });
  }

  // 4. Git commit
  if (state.git.status === "COMMITTING") {
    items.push({
      key: "gitCommit",
      label: "Git commit...",
      status: "active",
      detail: "Committing..."
    });
  } else if (
    state.git.commit ||
    state.git.status === "COMMITTED" ||
    state.git.status === "PUSHED"
  ) {
    items.push({
      key: "gitCommit",
      label: "Git commit",
      status: "complete",
      detail: state.git.commit ? state.git.commit.slice(0, 7) : "Committed"
    });
  } else if (state.git.status === "FAILED" && !state.git.commit) {
    items.push({
      key: "gitCommit",
      label: "Git commit",
      status: "blocked",
      detail: "Failed"
    });
  } else {
    items.push({
      key: "gitCommit",
      label: "Git commit",
      status: "pending",
      detail: "Pending"
    });
  }

  // 5. Git push
  if (
    state.git.status === "PUBLISHING" ||
    state.git.status === "PUSHING"
  ) {
    items.push({
      key: "gitPush",
      label: "Git push...",
      status: "active",
      detail: "Pushing..."
    });
  } else if (state.git.status === "PUSHED") {
    items.push({
      key: "gitPush",
      label: "Git push",
      status: "complete",
      detail: state.branch || "Pushed"
    });
  } else if (state.git.status === "FAILED") {
    items.push({
      key: "gitPush",
      label: "Git push",
      status: "blocked",
      detail: "Failed"
    });
  } else {
    items.push({
      key: "gitPush",
      label: "Git push",
      status: "pending",
      detail: "Pending"
    });
  }

  return items;
}

export function getStepStates(
  state?: DeliveryState
): Record<DeliveryStep, StepState> {
  return {
    Implementation: step(
      state?.implementation.status,
      ["SUCCESS"],
      ["IN_PROGRESS"],
      ["FAILED"]
    ),
    Testing: step(
      state?.testing.status,
      ["PASS"],
      ["RUNNING"],
      ["FAIL", "BLOCKED"]
    ),
    Deployment: step(
      state?.deployment.status,
      ["SUCCESS"],
      ["RUNNING"],
      ["FAILED", "BLOCKED"]
    ),
    Git: step(
      state?.git.status,
      ["PUSHED", "COMMITTED"],
      ["PUBLISHING", "PUSHING", "COMMITTING"],
      ["FAILED"]
    ),
    "Jira Report": step(
      state?.jiraReport.status,
      ["POSTED"],
      ["RUNNING"],
      ["FAILED"]
    )
  };
}

function step(
  value: string | undefined,
  complete: string[],
  active: string[],
  blocked: string[]
): StepState {
  if (value && complete.includes(value)) {
    return { status: "complete", detail: value };
  }
  if (value && active.includes(value)) {
    return { status: "active", detail: value };
  }
  if (value && blocked.includes(value)) {
    return { status: "blocked", detail: value };
  }
  return { status: "pending", detail: value ?? "PENDING" };
}

export function isDeliveryState(value: unknown): value is DeliveryState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const state = value as Partial<DeliveryState>;
  return (
    state.schemaVersion === 1 &&
    typeof state.jiraKey === "string" &&
    /^[A-Z][A-Z0-9_]*-\d+$/.test(state.jiraKey) &&
    typeof state.targetOrg === "string" &&
    typeof state.dryRun === "boolean" &&
    (state.approval === undefined ||
      includes(
        ["NOT_REQUESTED", "AWAITING_APPROVAL", "APPROVED", "REJECTED"],
        state.approval
      )) &&
    (state.dryRunResult === undefined || isDryRunResult(state.dryRunResult)) &&
    typeof state.updatedAt === "string" &&
    includes(
      [
        "NEW",
        "STARTED",
        "ANALYZED",
        "AWAITING_APPROVAL",
        "EXECUTING",
        "IMPLEMENTED",
        "COMPLETED",
        "BLOCKED",
        "FAILED"
      ],
      state.status
    ) &&
    isRecord(state.security) &&
    includes(
      ["PENDING", "NOT_REQUIRED", "VALIDATED", "BLOCKED"],
      state.security.status
    ) &&
    isRecord(state.implementation) &&
    includes(
      ["PENDING", "PLANNED", "IN_PROGRESS", "SUCCESS", "FAILED"],
      state.implementation.status
    ) &&
    isCount(state.implementation.components) &&
    isRecord(state.testing) &&
    includes(
      ["NOT_RUN", "RUNNING", "PASS", "FAIL", "BLOCKED"],
      state.testing.status
    ) &&
    isCount(state.testing.total) &&
    isCount(state.testing.passed) &&
    isCount(state.testing.failed) &&
    isCount(state.testing.blocked) &&
    isRecord(state.deployment) &&
    includes(
      ["NOT_RUN", "RUNNING", "SUCCESS", "FAILED", "BLOCKED"],
      state.deployment.status
    ) &&
    isRecord(state.git) &&
    includes(
      [
        "PENDING",
        "COMMITTING",
        "COMMITTED",
        "PUBLISHING",
        "PUSHING",
        "PUSHED",
        "FAILED"
      ],
      state.git.status
    ) &&
    isRecord(state.jiraReport) &&
    includes(
      ["PENDING", "RUNNING", "POSTED", "FAILED"],
      state.jiraReport.status
    )
  );
}

function isDryRunResult(value: unknown): value is DryRunResult {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isStringArray(value.fields) &&
    isStringArray(value.permissionSets) &&
    isStringArray(value.validationRules) &&
    isStringArray(value.tests) &&
    value.deployment === "NOT_EXECUTED" &&
    value.git === "NOT_EXECUTED" &&
    value.jiraUpdate === "NOT_EXECUTED" &&
    typeof value.generatedAt === "string"
  );
}

function deriveStatus(state: DeliveryState): DeliveryState["status"] {
  if (
    state.implementation.status === "FAILED" ||
    state.testing.status === "FAIL" ||
    state.deployment.status === "FAILED" ||
    state.git.status === "FAILED" ||
    state.jiraReport.status === "FAILED"
  ) {
    return "FAILED";
  }
  if (
    state.security.status === "BLOCKED" ||
    state.testing.status === "BLOCKED" ||
    state.deployment.status === "BLOCKED"
  ) {
    return "BLOCKED";
  }
  if (
    state.deployment.status === "RUNNING" ||
    state.testing.status === "RUNNING" ||
    state.git.status === "PUBLISHING" ||
    state.git.status === "PUSHING" ||
    state.git.status === "COMMITTING" ||
    state.jiraReport.status === "RUNNING"
  ) {
    return "EXECUTING";
  }
  if (
    state.implementation.status === "SUCCESS" &&
    ["VALIDATED", "NOT_REQUIRED"].includes(state.security.status) &&
    state.testing.status === "PASS" &&
    state.deployment.status === "SUCCESS" &&
    state.git.status === "PUSHED" &&
    state.jiraReport.status === "POSTED"
  ) {
    return "COMPLETED";
  }
  if (state.approval === "AWAITING_APPROVAL") {
    return "AWAITING_APPROVAL";
  }
  if (state.implementation.status === "SUCCESS") {
    return "IMPLEMENTED";
  }
  return state.status;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function includes(values: readonly string[], value: unknown): value is string {
  return typeof value === "string" && values.includes(value);
}
