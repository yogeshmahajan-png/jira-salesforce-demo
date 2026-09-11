"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { formatDryRunReport } = require("../dist/ui/dryRunReport");

test("formats an approval-ready dry-run report", () => {
  const report = formatDryRunReport("SF-125", {
    fields: ["Customer_Tier__c", "Renewal_Date__c"],
    permissionSets: ["Sales_Standard_User", "Sales_Admin"],
    validationRules: ["Gold_Customer_Requires_Renewal_Date"],
    tests: ["TC-01", "TC-02", "TC-03"],
    deployment: "NOT_EXECUTED",
    git: "NOT_EXECUTED",
    jiraUpdate: "NOT_EXECUTED",
    generatedAt: "2026-09-11T00:00:00.000Z"
  });

  assert.match(report, /# DRY RUN RESULT/);
  assert.match(report, /\*\*Jira:\*\* SF-125/);
  assert.match(report, /✓ Customer_Tier__c/);
  assert.match(report, /✓ Sales_Admin/);
  assert.match(report, /✓ TC-03/);
  assert.equal((report.match(/\*\*NOT_EXECUTED\*\*/g) || []).length, 3);
});
