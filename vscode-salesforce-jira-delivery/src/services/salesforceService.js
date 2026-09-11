"use strict";

class SalesforceService {
  constructor(terminal, targetOrg = "CopilotJiraOrg") {
    this.terminal = terminal;
    this.targetOrg = targetOrg;
  }

  deploy() {
    return this.terminal.run("sf", [
      "project",
      "deploy",
      "start",
      "--target-org",
      this.targetOrg
    ]);
  }

  retrieve(metadata) {
    if (!metadata) {
      throw new Error("Salesforce metadata is required for retrieval.");
    }
    return this.terminal.run("sf", [
      "project",
      "retrieve",
      "start",
      "--metadata",
      metadata,
      "--target-org",
      this.targetOrg
    ]);
  }
}

module.exports = { SalesforceService };
