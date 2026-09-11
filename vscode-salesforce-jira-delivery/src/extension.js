"use strict";

const path = require("node:path");
const vscode = require("vscode");
const { install } = require("./installer");
const { JiraService } = require("./services/jiraService");
const { ConfluenceService } = require("./services/confluenceService");
const { SalesforceService } = require("./services/salesforceService");
const { GitService } = require("./services/gitService");
const { TestService } = require("./services/testService");
const { TerminalService } = require("./services/terminalService");
const {
  FileDeliveryStateStore,
  MemoryDeliveryStateStore
} = require("./services/deliveryStateService");
const { StoryAnalyzer } = require("./engine/storyAnalyzer");
const { TestGenerator } = require("./engine/testGenerator");
const { DeliveryEngine } = require("./engine/deliveryEngine");
const { registerSidebar } = require("./ui/sidebar");
const { createStatusBar, updateStatusBar } = require("./ui/status");
const { showDryRunReport } = require("./ui/dryRunReport");

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

async function activate(context) {
  const terminal = new TerminalService(vscode);
  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const stateStore = workspace
    ? new FileDeliveryStateStore(workspace)
    : new MemoryDeliveryStateStore();
  const services = {
    jira: new JiraService(vscode, terminal),
    confluence: new ConfluenceService(vscode),
    salesforce: new SalesforceService(terminal),
    git: new GitService(terminal),
    tests: new TestService(terminal),
    storyAnalyzer: new StoryAnalyzer(vscode),
    testGenerator: new TestGenerator(vscode)
  };
  const engine = new DeliveryEngine(services, stateStore);
  const status = createStatusBar(vscode);
  const sidebar = registerSidebar(context, engine);
  context.subscriptions.push(status);

  async function runDryRun() {
    const result = await engine.runDryRun();
    await showDryRunReport(vscode, engine.requireStory(), result);
  }

  async function showSavedDryRun() {
    const state = engine.state;
    if (!state?.dryRunResult) {
      await vscode.window.showInformationMessage(
        "No dry-run result is available for the selected story."
      );
      return;
    }
    await showDryRunReport(vscode, state.jiraKey, state.dryRunResult);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("salesforceJiraDelivery.install", () =>
      installAgent(context)
    ),
    vscode.commands.registerCommand("salesforceJiraDelivery.openSidebar", () =>
      vscode.commands.executeCommand(
        "workbench.view.extension.salesforceJiraDelivery"
      )
    ),
    vscode.commands.registerCommand(
      "salesforceJiraDelivery.setStory",
      async () => {
        await engine.selectStory();
      }
    ),
    vscode.commands.registerCommand(
      "salesforceJiraDelivery.startStory",
      async () => {
        const state = await engine.start();
        if (state?.dryRunResult) {
          await showDryRunReport(vscode, state.jiraKey, state.dryRunResult);
        }
      }
    ),
    vscode.commands.registerCommand(
      "salesforceJiraDelivery.analyzeStory",
      () => (engine.dryRunEnabled ? runDryRun() : engine.analyze())
    ),
    vscode.commands.registerCommand(
      "salesforceJiraDelivery.generateTests",
      () => engine.generateTests()
    ),
    vscode.commands.registerCommand("salesforceJiraDelivery.deploy", () =>
      engine.deploy()
    ),
    vscode.commands.registerCommand("salesforceJiraDelivery.runTests", () =>
      engine.runTests()
    ),
    vscode.commands.registerCommand("salesforceJiraDelivery.publish", () =>
      engine.publish()
    ),
    vscode.commands.registerCommand(
      "salesforceJiraDelivery.openPersonaMapping",
      () => engine.openPersonaMapping()
    ),
    vscode.commands.registerCommand("salesforceJiraDelivery.gitStatus", () =>
      engine.gitStatus()
    ),
    vscode.commands.registerCommand("salesforceJiraDelivery.toggleDryRun", () =>
      engine.setDryRun(!engine.dryRunEnabled)
    ),
    vscode.commands.registerCommand(
      "salesforceJiraDelivery.runDryRun",
      runDryRun
    ),
    vscode.commands.registerCommand(
      "salesforceJiraDelivery.showDryRunResult",
      showSavedDryRun
    ),
    vscode.commands.registerCommand(
      "salesforceJiraDelivery.approveAndExecute",
      async () => {
        try {
          await engine.approveAndExecute();
          await vscode.window.showInformationMessage(
            `Story ${engine.requireStory()} delivered successfully!`
          );
        } catch (error) {
          await vscode.window.showErrorMessage(
            `Delivery execution failed: ${error.message}`
          );
        }
      }
    )
  );

  engine.onChange = (state) => {
    sidebar.refresh();
    updateStatusBar(status, state);
    void vscode.commands.executeCommand(
      "setContext",
      "salesforceJiraDelivery.dryRun",
      engine.dryRunEnabled
    );
    void vscode.commands.executeCommand(
      "setContext",
      "salesforceJiraDelivery.hasDryRunResult",
      Boolean(state?.dryRunResult)
    );
    void vscode.commands.executeCommand(
      "setContext",
      "salesforceJiraDelivery.isAwaitingApproval",
      state?.approval === "AWAITING_APPROVAL"
    );
    void vscode.commands.executeCommand(
      "setContext",
      "salesforceJiraDelivery.isExecuting",
      state?.status === "EXECUTING"
    );
  };
  await engine.initialize();
}

function deactivate() {}

module.exports = { activate, deactivate };
