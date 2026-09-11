# Salesforce Jira Delivery for VS Code

This extension installs the `Salesforce Jira Delivery` GitHub Copilot custom
agent and its complete workflow into the current workspace. It is designed for
reuse across Salesforce DX repositories rather than being tied to this source
project.

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
