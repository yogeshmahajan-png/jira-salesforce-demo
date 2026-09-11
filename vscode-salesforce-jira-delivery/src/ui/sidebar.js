"use strict";

let vscodeModule;
try {
  vscodeModule = require("vscode");
} catch {
  vscodeModule = null;
}

const { EventEmitter } = require("node:events");
const {
  DELIVERY_STEPS,
  getStepStates,
  getAnalysisChecklist,
  getExecutionPipeline
} = require("../models/delivery");

const ICONS = {
  pending: "circle-outline",
  active: "sync~spin",
  complete: "pass",
  blocked: "error"
};

function createTreeItem(vscode, label, collapsibleState) {
  if (vscode?.TreeItem) {
    return new vscode.TreeItem(label, collapsibleState);
  }
  return { label, collapsibleState };
}

function createThemeIcon(vscode, id) {
  if (vscode?.ThemeIcon) {
    return new vscode.ThemeIcon(id);
  }
  return { id };
}

class StoryHeaderItem {
  constructor(jiraKey, status, targetOrg, vscode = vscodeModule) {
    const item = createTreeItem(
      vscode,
      jiraKey,
      vscode?.TreeItemCollapsibleState?.None ?? 0
    );
    Object.assign(this, item);
    this.label = jiraKey;
    this.description = `[${status}] ${targetOrg}`;
    this.contextValue = "storyHeader";
    this.iconPath = createThemeIcon(
      vscode,
      status === "COMPLETED"
        ? "pass"
        : status === "FAILED"
          ? "error"
          : status === "EXECUTING"
            ? "sync~spin"
            : "bookmark"
    );
  }
}

class SelectStoryItem {
  constructor(vscode = vscodeModule) {
    const item = createTreeItem(
      vscode,
      "Select Jira Story",
      vscode?.TreeItemCollapsibleState?.None ?? 0
    );
    Object.assign(this, item);
    this.label = "Select Jira Story";
    this.description = "Click to set active story";
    this.contextValue = "selectStory";
    this.iconPath = createThemeIcon(vscode, "search");
    this.command = {
      command: "salesforceJiraDelivery.setStory",
      title: "Select Jira Story"
    };
  }
}

class AnalysisItem {
  constructor(item, vscode = vscodeModule) {
    const treeItem = createTreeItem(
      vscode,
      item.label,
      vscode?.TreeItemCollapsibleState?.None ?? 0
    );
    Object.assign(this, treeItem);
    this.label = item.label;
    this.description = item.detail || "";
    this.contextValue = "analysisChecklist";
    this.iconPath = createThemeIcon(
      vscode,
      ICONS[item.status] || "circle-outline"
    );
    if (item.key === "dryRun" && item.status === "complete") {
      this.command = {
        command: "salesforceJiraDelivery.showDryRunResult",
        title: "Show Dry Run Result"
      };
    }
  }
}

class ApprovalWaitItem {
  constructor(vscode = vscodeModule) {
    const item = createTreeItem(
      vscode,
      "Waiting for approval...",
      vscode?.TreeItemCollapsibleState?.None ?? 0
    );
    Object.assign(this, item);
    this.label = "Waiting for approval...";
    this.description = "Review before live execution";
    this.contextValue = "awaitingApproval";
    this.iconPath = createThemeIcon(vscode, "clock");
  }
}

class ApproveActionItem {
  constructor(vscode = vscodeModule) {
    const item = createTreeItem(
      vscode,
      "Approve & Execute",
      vscode?.TreeItemCollapsibleState?.None ?? 0
    );
    Object.assign(this, item);
    this.label = "Approve & Execute";
    this.description = "Run live delivery";
    this.contextValue = "approveAndExecuteAction";
    this.iconPath = createThemeIcon(vscode, "play");
    this.command = {
      command: "salesforceJiraDelivery.approveAndExecute",
      title: "Approve & Execute"
    };
  }
}

class PipelineStepItem {
  constructor(item, vscode = vscodeModule) {
    const treeItem = createTreeItem(
      vscode,
      item.label,
      vscode?.TreeItemCollapsibleState?.None ?? 0
    );
    Object.assign(this, treeItem);
    this.label = item.label;
    this.description = item.detail || "";
    this.contextValue = "pipelineStep";
    this.iconPath = createThemeIcon(
      vscode,
      ICONS[item.status] || "circle-outline"
    );
  }
}

class DeliveryItem {
  constructor(label, state, phase, vscode = vscodeModule) {
    const item = createTreeItem(
      vscode,
      label,
      vscode?.TreeItemCollapsibleState?.None ?? 0
    );
    Object.assign(this, item);
    this.label = label;
    this.description = state.detail || state.status;
    this.contextValue = "deliveryPhase";
    this.iconPath = createThemeIcon(vscode, ICONS[state.status]);
    this.phase = phase;
  }
}

class DryRunItem {
  constructor(checked, vscode = vscodeModule) {
    const item = createTreeItem(
      vscode,
      "Dry Run",
      vscode?.TreeItemCollapsibleState?.None ?? 0
    );
    Object.assign(this, item);
    this.label = "Dry Run";
    this.contextValue = "dryRunToggle";
    this.checkboxState = checked
      ? (vscode?.TreeItemCheckboxState?.Checked ?? 1)
      : (vscode?.TreeItemCheckboxState?.Unchecked ?? 0);
    this.description = checked ? "Safe preview only" : "Execution enabled";
    this.iconPath = createThemeIcon(vscode, "shield");
  }
}

class SidebarProvider {
  constructor(engine, commands, vscode = vscodeModule) {
    this.engine = engine;
    this.commands = commands;
    this.vscode = vscode;
    this.events = new EventEmitter();
    this.engine.onChange = () => this.refresh();
  }

  get onDidChangeTreeData() {
    return (listener) => {
      this.events.on("change", listener);
      return { dispose: () => this.events.off("change", listener) };
    };
  }

  refresh() {
    this.events.emit("change");
  }

  getTreeItem(item) {
    return item;
  }

  getChildren() {
    const state = this.engine.state;
    if (!state) {
      return [
        new SelectStoryItem(this.vscode),
        new DryRunItem(this.engine.dryRunEnabled, this.vscode)
      ];
    }

    const items = [
      new StoryHeaderItem(
        state.jiraKey,
        state.status,
        state.targetOrg,
        this.vscode
      ),
      new DryRunItem(this.engine.dryRunEnabled, this.vscode)
    ];

    // Analysis Checklist items
    const checklist = getAnalysisChecklist(state);
    for (const check of checklist) {
      items.push(new AnalysisItem(check, this.vscode));
    }

    // Approval Gate
    const isAwaitingApproval =
      state.dryRunResult &&
      state.approval !== "APPROVED" &&
      state.status !== "COMPLETED" &&
      state.status !== "EXECUTING";

    if (isAwaitingApproval) {
      items.push(new ApprovalWaitItem(this.vscode));
      items.push(new ApproveActionItem(this.vscode));
    }

    // Execution Pipeline
    const showPipeline =
      state.approval === "APPROVED" ||
      !state.dryRun ||
      state.status === "EXECUTING" ||
      state.status === "COMPLETED" ||
      state.deployment.status !== "NOT_RUN";

    if (showPipeline) {
      const pipeline = getExecutionPipeline(state);
      for (const step of pipeline) {
        items.push(new PipelineStepItem(step, this.vscode));
      }
    }

    return items;
  }
}

function registerSidebar(context, engine, vscode = vscodeModule) {
  const provider = new SidebarProvider(engine, {}, vscode);
  const tree = vscode.window.createTreeView("salesforceJiraDelivery.sidebar", {
    treeDataProvider: provider,
    showCollapseAll: false
  });
  context.subscriptions.push(
    tree,
    tree.onDidChangeCheckboxState(async (event) => {
      const [item, checkboxState] = event.items[0] || [];
      if (item?.contextValue !== "dryRunToggle") {
        return;
      }
      try {
        await engine.setDryRun(
          checkboxState === vscode.TreeItemCheckboxState.Checked
        );
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Unable to change Dry Run: ${error.message}`
        );
      }
    })
  );
  return provider;
}

module.exports = {
  StoryHeaderItem,
  SelectStoryItem,
  AnalysisItem,
  ApprovalWaitItem,
  ApproveActionItem,
  PipelineStepItem,
  DeliveryItem,
  DryRunItem,
  SidebarProvider,
  registerSidebar
};
