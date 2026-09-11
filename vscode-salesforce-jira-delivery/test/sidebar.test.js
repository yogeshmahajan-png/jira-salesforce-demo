"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  SidebarProvider,
  StoryHeaderItem,
  AnalysisItem,
  ApprovalWaitItem,
  ApproveActionItem,
  PipelineStepItem
} = require("../dist/ui/sidebar");

test("SidebarProvider renders select story item when no state is loaded", () => {
  const engine = { state: undefined, dryRunEnabled: true, onChange: () => {} };
  const provider = new SidebarProvider(engine, {});
  const children = provider.getChildren();

  assert.equal(children.length, 2);
  assert.equal(children[0].label, "Select Jira Story");
  assert.equal(children[1].label, "Dry Run");
});

test("SidebarProvider renders pre-execution checklist and approval gate after dry run", () => {
  const state = {
    schemaVersion: 1,
    jiraKey: "SF-125",
    targetOrg: "CopilotJiraOrg",
    status: "AWAITING_APPROVAL",
    dryRun: true,
    approval: "AWAITING_APPROVAL",
    security: { status: "VALIDATED", source: "Confluence" },
    implementation: { status: "PLANNED", components: 4 },
    testing: { status: "NOT_RUN", total: 6, passed: 0, failed: 0, blocked: 0 },
    deployment: { status: "NOT_RUN" },
    git: { status: "PENDING" },
    jiraReport: { status: "PENDING" },
    dryRunResult: {
      fields: ["Customer_Tier__c", "Renewal_Date__c"],
      permissionSets: ["Sales_Admin"],
      validationRules: ["Gold_Customer_Requires_Renewal_Date"],
      tests: ["TC-01", "TC-02", "TC-03", "TC-04", "TC-05", "TC-06"],
      deployment: "NOT_EXECUTED",
      git: "NOT_EXECUTED",
      jiraUpdate: "NOT_EXECUTED",
      generatedAt: "2026-09-11T00:00:00.000Z"
    },
    updatedAt: "2026-09-11T00:00:00.000Z"
  };

  const engine = { state, dryRunEnabled: true, onChange: () => {} };
  const provider = new SidebarProvider(engine, {});
  const children = provider.getChildren();
  const labels = children.map((c) => c.label);

  assert.ok(labels.includes("SF-125"));
  assert.ok(labels.includes("Dry Run"));
  assert.ok(labels.includes("Requirement analyzed"));
  assert.ok(labels.includes("Security mapping found"));
  assert.ok(labels.includes("2 fields identified"));
  assert.ok(labels.includes("Permission Sets identified"));
  assert.ok(labels.includes("1 validation rule identified"));
  assert.ok(labels.includes("6 test cases generated"));
  assert.ok(labels.includes("Dry Run completed"));
  assert.ok(labels.includes("Waiting for approval..."));
  assert.ok(labels.includes("Approve & Execute"));
});

test("SidebarProvider renders execution pipeline during live delivery", () => {
  const state = {
    schemaVersion: 1,
    jiraKey: "SF-125",
    targetOrg: "CopilotJiraOrg",
    status: "EXECUTING",
    dryRun: false,
    approval: "APPROVED",
    security: { status: "VALIDATED", source: "Confluence" },
    implementation: { status: "SUCCESS", components: 4 },
    testing: { status: "NOT_RUN", total: 6, passed: 0, failed: 0, blocked: 0 },
    deployment: { status: "RUNNING" },
    git: { status: "PENDING" },
    jiraReport: { status: "PENDING" },
    dryRunResult: {
      fields: ["Customer_Tier__c", "Renewal_Date__c"],
      permissionSets: ["Sales_Admin"],
      validationRules: ["Gold_Customer_Requires_Renewal_Date"],
      tests: ["TC-01", "TC-02", "TC-03", "TC-04", "TC-05", "TC-06"],
      deployment: "NOT_EXECUTED",
      git: "NOT_EXECUTED",
      jiraUpdate: "NOT_EXECUTED",
      generatedAt: "2026-09-11T00:00:00.000Z"
    },
    updatedAt: "2026-09-11T00:00:00.000Z"
  };

  const engine = { state, dryRunEnabled: false, onChange: () => {} };
  const provider = new SidebarProvider(engine, {});
  const children = provider.getChildren();
  const labels = children.map((c) => c.label);

  assert.ok(labels.includes("Deploying Salesforce metadata..."));
  assert.ok(labels.includes("Running tests"));
  assert.ok(labels.includes("Updating Jira"));
  assert.ok(labels.includes("Git commit"));
  assert.ok(labels.includes("Git push"));
  assert.ok(!labels.includes("Waiting for approval..."));
  assert.ok(!labels.includes("Approve & Execute"));
});
