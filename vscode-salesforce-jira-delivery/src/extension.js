"use strict";

const path = require("node:path");
const vscode = require("vscode");
const { install } = require("./installer");

async function chooseWorkspace() {
  const folders = vscode.workspace.workspaceFolders || [];
  if (!folders.length) {
    await vscode.window.showErrorMessage(
      "Open a project folder before installing Salesforce Jira Delivery."
    );
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  const selected = await vscode.window.showWorkspaceFolderPick({
    placeHolder: "Select the workspace that should receive the delivery agent"
  });
  return selected;
}

async function installAgent(context) {
  const folder = await chooseWorkspace();
  if (!folder) {
    return;
  }

  const workspace = folder.uri.fsPath;
  const resources = path.join(context.extensionPath, "resources");
  let result;

  try {
    result = install(workspace, resources);
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Salesforce Jira Delivery installation failed: ${error.message}`
    );
    return;
  }

  if (result.conflicts.length) {
    const choice = await vscode.window.showWarningMessage(
      `Installation found ${result.conflicts.length} conflicting workflow file or setting(s). Replace only those Salesforce Jira Delivery entries?`,
      { modal: true, detail: result.conflicts.join("\n") },
      "Replace conflicts"
    );
    if (choice !== "Replace conflicts") {
      return;
    }

    try {
      result = install(workspace, resources, { overwrite: true });
    } catch (error) {
      await vscode.window.showErrorMessage(
        `Salesforce Jira Delivery installation failed: ${error.message}`
      );
      return;
    }
  }

  const changed = result.installed.length;
  const action = await vscode.window.showInformationMessage(
    changed
      ? `Salesforce Jira Delivery installed ${changed} workflow files in ${folder.name}.`
      : `Salesforce Jira Delivery is already current in ${folder.name}.`,
    "Open Agent"
  );

  if (action === "Open Agent") {
    const agent = vscode.Uri.file(
      path.join(
        workspace,
        ".github",
        "agents",
        "salesforce-jira-delivery.agent.md"
      )
    );
    await vscode.window.showTextDocument(agent);
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("salesforceJiraDelivery.install", () =>
      installAgent(context)
    )
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
