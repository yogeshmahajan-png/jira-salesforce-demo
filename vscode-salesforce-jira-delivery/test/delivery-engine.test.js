"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { DeliveryEngine } = require("../dist/engine/deliveryEngine");
const {
  MemoryDeliveryStateStore
} = require("../dist/services/deliveryStateService");

function services(overrides = {}) {
  return {
    jira: {
      openIssue: async () => "SF-125",
      startStory: async () => undefined,
      publishStory: async () => undefined
    },
    confluence: { openPersonaMapping: async () => undefined },
    salesforce: { deploy: async () => undefined },
    git: { status: async () => undefined },
    tests: { runUnitTests: async () => undefined },
    storyAnalyzer: { analyze: async () => undefined },
    testGenerator: { generate: async () => undefined },
    ...overrides
  };
}

test("restores and advances a persisted delivery record", async () => {
  const store = new MemoryDeliveryStateStore();
  const first = new DeliveryEngine(services(), store);
  await first.setStory("SF-125", "dev-sandbox", false);
  await first.recordSecurityValidation("VALIDATED");
  await first.recordImplementation("SUCCESS", 6);
  await first.recordTestSummary("PASS", {
    total: 6,
    passed: 6,
    failed: 0,
    blocked: 0
  });
  await first.recordDeployment("SUCCESS", "0Af123");
  await first.recordGit("PUSHED", "abc123");

  const restored = new DeliveryEngine(services(), store);
  await restored.initialize();

  assert.equal(restored.state.jiraKey, "SF-125");
  assert.equal(restored.state.status, "IMPLEMENTED");
  assert.equal(restored.state.testing.passed, 6);
  assert.equal(restored.state.git.commit, "abc123");

  await restored.recordJiraReport("POSTED");
  assert.equal(restored.state.status, "COMPLETED");
});

test("records deployment failure and rethrows the service error", async () => {
  const store = new MemoryDeliveryStateStore();
  const engine = new DeliveryEngine(
    services({
      salesforce: {
        deploy: async () => {
          throw new Error("Deployment rejected");
        }
      }
    }),
    store
  );
  await engine.setStory("SF-125", "CopilotJiraOrg", false);

  await assert.rejects(engine.deploy(), /Deployment rejected/);
  assert.equal(engine.state.status, "FAILED");
  assert.equal(engine.state.deployment.status, "FAILED");
});

test("dry run produces a preview and never executes protected services", async () => {
  const calls = { start: 0, deploy: 0, tests: 0, publish: 0 };
  const engine = new DeliveryEngine(
    services({
      jira: {
        openIssue: async () => "SF-125",
        startStory: async () => {
          calls.start += 1;
        },
        publishStory: async () => {
          calls.publish += 1;
        }
      },
      salesforce: {
        deploy: async () => {
          calls.deploy += 1;
        }
      },
      tests: {
        runUnitTests: async () => {
          calls.tests += 1;
        }
      },
      storyAnalyzer: {
        analyze: async () => ({
          fields: ["Customer_Tier__c", "Renewal_Date__c"],
          permissionSets: ["Sales_Admin"],
          validationRules: ["Gold_Customer_Requires_Renewal_Date"]
        })
      },
      testGenerator: {
        generate: async () => ["TC-01", "TC-02", "TC-03"]
      }
    }),
    new MemoryDeliveryStateStore()
  );
  await engine.setStory("SF-125");

  const result = await engine.runDryRun();

  assert.deepEqual(result.fields, ["Customer_Tier__c", "Renewal_Date__c"]);
  assert.deepEqual(result.tests, ["TC-01", "TC-02", "TC-03"]);
  assert.equal(result.deployment, "NOT_EXECUTED");
  assert.deepEqual(calls, { start: 0, deploy: 0, tests: 0, publish: 0 });
  await assert.rejects(engine.deploy(), /Dry Run is enabled/);
  await assert.rejects(engine.runTests(), /Dry Run is enabled/);
  await assert.rejects(engine.publish(), /Dry Run is enabled/);
  await assert.rejects(
    engine.recordGit("PUSHED", "abc123"),
    /Dry Run is enabled/
  );
  await assert.rejects(engine.recordJiraReport("POSTED"), /Dry Run is enabled/);
  assert.deepEqual(calls, { start: 0, deploy: 0, tests: 0, publish: 0 });
});

test("starting in dry-run mode analyzes without creating a branch", async () => {
  let startCalls = 0;
  const engine = new DeliveryEngine(
    services({
      jira: {
        openIssue: async () => "SF-125",
        startStory: async () => {
          startCalls += 1;
        },
        publishStory: async () => undefined
      }
    }),
    new MemoryDeliveryStateStore()
  );

  await engine.start("SF-125");

  assert.equal(startCalls, 0);
  assert.equal(engine.state.branch, undefined);
  assert.ok(engine.state.dryRunResult);
});

test("approveAndExecute runs the sequential pipeline with live state progression to completion", async () => {
  const progression = [];
  const calls = { deploy: 0, tests: 0, publish: 0, git: 0 };
  const engine = new DeliveryEngine(
    services({
      salesforce: {
        deploy: async () => {
          calls.deploy += 1;
        }
      },
      tests: {
        runUnitTests: async () => {
          calls.tests += 1;
        }
      },
      jira: {
        publishStory: async () => {
          calls.publish += 1;
        }
      },
      git: {
        status: async () => {
          calls.git += 1;
        }
      },
      storyAnalyzer: {
        analyze: async () => ({
          fields: ["Customer_Tier__c", "Renewal_Date__c"],
          permissionSets: ["Sales_Admin"],
          validationRules: ["Gold_Customer_Requires_Renewal_Date"]
        })
      },
      testGenerator: {
        generate: async () => [
          "TC-01",
          "TC-02",
          "TC-03",
          "TC-04",
          "TC-05",
          "TC-06"
        ]
      }
    }),
    new MemoryDeliveryStateStore(),
    (state) => {
      progression.push({
        status: state?.status,
        approval: state?.approval,
        deployment: state?.deployment.status,
        testing: state?.testing.status,
        jiraReport: state?.jiraReport.status,
        git: state?.git.status
      });
    }
  );

  await engine.setStory("SF-125");
  await engine.runDryRun();

  assert.equal(engine.state.approval, "AWAITING_APPROVAL");
  assert.equal(engine.state.dryRun, true);

  await engine.approveAndExecute();

  assert.equal(engine.state.approval, "APPROVED");
  assert.equal(engine.state.dryRun, false);
  assert.equal(engine.state.status, "COMPLETED");
  assert.equal(engine.state.deployment.status, "SUCCESS");
  assert.equal(engine.state.testing.status, "PASS");
  assert.equal(engine.state.testing.passed, 6);
  assert.equal(engine.state.jiraReport.status, "POSTED");
  assert.equal(engine.state.git.status, "PUSHED");
  assert.deepEqual(calls, { deploy: 1, tests: 1, publish: 1, git: 1 });
});

test("approveAndExecute halts and marks state as failed when deployment fails", async () => {
  const engine = new DeliveryEngine(
    services({
      salesforce: {
        deploy: async () => {
          throw new Error("Apex test compilation error");
        }
      },
      storyAnalyzer: {
        analyze: async () => ({
          fields: ["Tier__c"],
          permissionSets: [],
          validationRules: []
        })
      },
      testGenerator: {
        generate: async () => ["TC-01"]
      }
    }),
    new MemoryDeliveryStateStore()
  );

  await engine.setStory("SF-125");
  await engine.runDryRun();

  await assert.rejects(
    engine.approveAndExecute(),
    /Apex test compilation error/
  );
  assert.equal(engine.state.status, "FAILED");
  assert.equal(engine.state.deployment.status, "FAILED");
  assert.equal(engine.state.testing.status, "NOT_RUN");
});
