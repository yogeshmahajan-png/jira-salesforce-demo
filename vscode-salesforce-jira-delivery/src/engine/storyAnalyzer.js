"use strict";

class StoryAnalyzer {
  constructor(vscode) {
    this.vscode = vscode;
  }

  analyze(jiraKey, dryRun = false) {
    const safety = dryRun
      ? "This is a DRY RUN. Read Jira and Confluence, analyze the repository, and generate an implementation plan. Do not edit files, deploy, commit, push, or update Jira."
      : "Analyze only; do not deploy, commit, push, or update Jira.";
    return this.vscode.commands.executeCommand("workbench.action.chat.open", {
      query: `${safety} Analyze Jira story ${jiraKey}, its Salesforce acceptance criteria, security mappings, and proposed fields, permission sets, validation rules, and repository changes.`
    });
  }
}

module.exports = { StoryAnalyzer };
