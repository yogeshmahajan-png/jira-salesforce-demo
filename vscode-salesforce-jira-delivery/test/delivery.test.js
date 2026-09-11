"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createDeliveryState,
  getStepStates,
  normalizeJiraKey,
  updateDeliveryState
} = require("../dist/models/delivery");
const { analyzeStory } = require("../dist/engine/deliveryEngine");

test("creates a normalized delivery state for a Jira story", () => {
  const state = createDeliveryState("sf-125", "dev-sandbox", false);

  assert.equal(state.jiraKey, "SF-125");
  assert.equal(state.targetOrg, "dev-sandbox");
  assert.equal(state.implementation.status, "PENDING");
  assert.equal(Object.keys(getStepStates(state)).length, 5);
});

test("updates delivery details without changing unrelated state", () => {
  const state = createDeliveryState("SF-125");
  const updated = updateDeliveryState(state, {
    deployment: { status: "SUCCESS", id: "0Af123" }
  });

  assert.deepEqual(updated.deployment, {
    status: "SUCCESS",
    id: "0Af123"
  });
  assert.equal(updated.testing.status, "NOT_RUN");
});

test("rejects malformed Jira keys", () => {
  assert.throws(() => normalizeJiraKey("not-a-jira-key"), /Invalid Jira key/);
});

test("analyzes a normalized delivery request", async () => {
  const result = await analyzeStory({
    jiraKey: "sf-125",
    targetOrg: "CopilotJiraOrg",
    dryRun: true
  });

  assert.deepEqual(result, {
    jiraKey: "SF-125",
    status: "SUCCESS"
  });
});

test("rejects analysis without a target org", async () => {
  await assert.rejects(
    analyzeStory({
      jiraKey: "SF-125",
      targetOrg: " ",
      dryRun: true
    }),
    /target org is required/
  );
});

test("generates analysis checklist and execution pipeline items", () => {
  const {
    getAnalysisChecklist,
    getExecutionPipeline
  } = require("../dist/models/delivery");

  const state = createDeliveryState("SF-125");
  state.dryRunResult = {
    fields: ["Customer_Tier__c", "Renewal_Date__c"],
    permissionSets: ["Sales_Admin"],
    validationRules: ["Gold_Customer_Requires_Renewal_Date"],
    tests: ["TC-01", "TC-02", "TC-03", "TC-04", "TC-05", "TC-06"],
    deployment: "NOT_EXECUTED",
    git: "NOT_EXECUTED",
    jiraUpdate: "NOT_EXECUTED",
    generatedAt: "2026-09-11T00:00:00.000Z"
  };
  state.status = "AWAITING_APPROVAL";
  state.approval = "AWAITING_APPROVAL";

  const checklist = getAnalysisChecklist(state);
  assert.equal(checklist.length, 7);
  assert.equal(checklist[0].label, "Requirement analyzed");
  assert.equal(checklist[0].status, "complete");
  assert.equal(checklist[1].label, "Security mapping found");
  assert.equal(checklist[1].status, "complete");
  assert.equal(checklist[2].label, "2 fields identified");
  assert.equal(checklist[3].label, "Permission Sets identified");
  assert.equal(checklist[4].label, "1 validation rule identified");
  assert.equal(checklist[5].label, "6 test cases generated");
  assert.equal(checklist[6].label, "Dry Run completed");

  const pipeline = getExecutionPipeline(state);
  assert.equal(pipeline.length, 5);
  assert.equal(pipeline[0].label, "Deploy Salesforce metadata");
  assert.equal(pipeline[0].status, "pending");
  assert.equal(pipeline[1].label, "Running tests");
  assert.equal(pipeline[1].status, "pending");
});
