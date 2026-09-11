"use strict";

class TerminalService {
  constructor(vscode, name = "Salesforce Jira Delivery") {
    this.vscode = vscode;
    this.terminal = undefined;
    this.name = name;
  }

  run(command, args = []) {
    if (!this.terminal) {
      this.terminal = this.vscode.window.createTerminal(this.name);
    }
    this.terminal.show(true);
    const escaped = args.map(
      (value) => `"${String(value).replaceAll('"', '\\"')}"`
    );
    this.terminal.sendText([command, ...escaped].join(" "));
    return Promise.resolve();
  }
}

module.exports = { TerminalService };
