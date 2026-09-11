"use strict";

class JiraService {
  constructor(vscode, terminal) {
    this.vscode = vscode;
    this.terminal = terminal;
  }

  async openIssue(jiraKey) {
    const value = await this.vscode.window.showInputBox({
      value: jiraKey || "",
      prompt: "Enter the Jira key to open",
      placeHolder: "SF-125",
      ignoreFocusOut: true
    });
    if (!value) {
      return undefined;
    }

    await this.vscode.env.openExternal(
      this.vscode.Uri.parse(`https://atlassian.net/browse/${value.trim()}`)
    );
    return value.trim().toUpperCase();
  }

  startStory(jiraKey) {
    return this.terminal.run("npm", ["run", "story:start", "--", jiraKey]);
  }

  publishStory(jiraKey) {
    return this.terminal.run("npm", ["run", "story:publish", "--", jiraKey]);
  }
}

module.exports = { JiraService };
