"use strict";

class TestGenerator {
  constructor(vscode) {
    this.vscode = vscode;
  }

  generate(jiraKey, dryRun = false) {
    const safety = dryRun
      ? "This is a DRY RUN. Generate test cases only; do not create Jira issues or execute tests."
      : "Generate a test plan without executing tests.";
    return this.vscode.commands.executeCommand("workbench.action.chat.open", {
      query: `${safety} Generate a Salesforce test plan and Jira test-case coverage matrix for ${jiraKey}.`
    });
  }
}

module.exports = { TestGenerator };
