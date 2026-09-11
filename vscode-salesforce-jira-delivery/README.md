# Salesforce Jira Delivery for VS Code

This extension provides a `Salesforce Jira Delivery` sidebar and installs the
GitHub Copilot custom agent and its complete workflow into the current
workspace. It is designed for reuse across Salesforce DX repositories rather
than being tied to this source project.

## Install the VSIX

1. Install GitHub Copilot Chat and sign in.
2. Install the packaged `.vsix` from VS Code with **Extensions: Install from
   VSIX...**, or run:

   ```text
   code --install-extension salesforce-jira-delivery-1.0.0.vsix
   ```

3. Open the target project.
4. Run **Salesforce Jira Delivery: Install Agent in Workspace** from the Command
   Palette.
5. Reload the VS Code window if the new agent or prompt files are not discovered
   immediately.

The command can be run again to update a workspace. Identical files are left
unchanged. Project-specific files or managed settings are never overwritten
without a modal confirmation. Unrelated npm scripts, MCP servers, and ignore
rules are preserved.

## Installed workspace files

- `.github/agents/salesforce-jira-delivery.agent.md`
- `.github/prompts/implement-jira.prompt.md`
- `.github/prompts/test-jira.prompt.md`
- `.github/prompts/test-report-guide.md`
- `scripts/story.js`
- `scripts/test-report.js`
- `scripts/test-report.test.js`
- `scripts/test-results.example.json`

The installer also:

- adds `story:start`, `story:publish`, `story:report`, and `test:report` to
  `package.json`;
- adds the official Atlassian MCP endpoint to `.vscode/mcp.json`; and
- ignores generated `artifacts/jira/` report data.

## Extension architecture

The extension UI and delivery orchestration are intentionally independent from
the portable `scripts/story.js` helper:

```text
src/
├── extension.js
├── ui/
│   ├── sidebar.js
│   └── status.js
├── services/
│   ├── jiraService.js
│   ├── confluenceService.js
│   ├── salesforceService.js
│   ├── gitService.js
│   └── testService.js
├── engine/
│   ├── deliveryEngine.ts
│   ├── storyAnalyzer.js
│   └── testGenerator.js
└── models/
    └── delivery.ts
```

`story.js` remains available for existing workspace scripts and publishing
workflows. The sidebar uses the service and engine layers, so future Jira,
Confluence, Salesforce, Git, and test integrations can evolve without making
the UI depend on that script. TypeScript sources are compiled to `dist/` before
testing and packaging; the extension runtime loads `dist/extension.js`.

## Persistent delivery state

Selecting a Jira story creates or restores `.delivery/<JIRA-KEY>.json` in the
active workspace. The versioned record tracks the target org, branch, security
validation, implementation component count, test totals, deployment, Git
commit, and Jira reporting status. The most recently updated record is restored
when VS Code reopens, allowing the sidebar to show completed, active, blocked,
and pending delivery steps without rerunning commands.

Delivery state is written through a temporary file and atomic rename. Invalid
or unsupported state files are reported instead of being silently replaced.

## Dry Run approval workflow

Dry Run is enabled by default and can be changed with the checkbox at the top
of the Delivery sidebar. Starting or analyzing a story while it is enabled:

1. requests Jira, Confluence security, and repository analysis;
2. requests a proposed Salesforce implementation and test-case plan;
3. persists the structured preview in `.delivery/<JIRA-KEY>.json`;
4. opens a `DRY RUN RESULT` document; and
5. stops before execution.

The result separates proposed fields, permission sets, validation rules, and
tests and explicitly marks deployment, Git, and Jira updates as
`NOT_EXECUTED`. Deploy, test execution, publish, and Jira-report recording are
disabled in the UI and independently rejected by the delivery engine while Dry
Run remains enabled. Disable Dry Run only after the preview has been approved.

See `DEPENDENCIES.json` for machine-readable prerequisites and the exact
package version.

## Use

In Copilot Chat, select **Salesforce Jira Delivery** as the agent and provide a
real Jira key, or run the installed `/implement-jira` prompt. Use `/test-jira`
when development and deployment are already complete and only test
reconciliation, execution, and reporting remain.

The workflow defaults to the authorized Salesforce development-org alias
`CopilotJiraOrg`. It never permits Production deployment.

## Build

From this extension directory:

```text
npm install
npm test
npm run package
```

The package command creates `salesforce-jira-delivery-1.0.0.vsix`.
