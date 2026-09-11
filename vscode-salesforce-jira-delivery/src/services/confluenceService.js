"use strict";

class ConfluenceService {
  constructor(vscode) {
    this.vscode = vscode;
  }

  openPersonaMapping() {
    return this.vscode.commands.executeCommand("workbench.action.chat.open", {
      query:
        "Find the approved Salesforce Persona Permission Set Mapping in Confluence."
    });
  }
}

module.exports = { ConfluenceService };
