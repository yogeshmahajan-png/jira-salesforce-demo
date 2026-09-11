"use strict";

function createStatusBar(vscode) {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  item.command = "salesforceJiraDelivery.openSidebar";
  item.text = "$(cloud-upload) Salesforce Jira";
  item.tooltip = "Open Salesforce Jira Delivery";
  item.show();
  return item;
}

function updateStatusBar(item, state) {
  if (!state) {
    item.text = "$(cloud-upload) No story";
    return;
  }

  const { getStepStates } = require("../models/delivery");
  const steps = getStepStates(state);
  const complete = Object.values(steps).filter(
    (phase) => phase.status === "complete"
  ).length;
  item.text = `$(cloud-upload) ${state.jiraKey} ${complete}/${Object.keys(steps).length}`;
}

module.exports = { createStatusBar, updateStatusBar };
