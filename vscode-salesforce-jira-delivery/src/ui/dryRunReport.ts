import type { DryRunResult } from "../models/delivery";

interface TextDocument {
  uri: unknown;
}

interface VsCodeApi {
  workspace: {
    openTextDocument(options: {
      content: string;
      language: string;
    }): Promise<TextDocument>;
  };
  window: {
    showTextDocument(
      document: TextDocument,
      options: { preview: boolean }
    ): Promise<unknown>;
  };
}

export async function showDryRunReport(
  vscode: VsCodeApi,
  jiraKey: string,
  result: DryRunResult
): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: formatDryRunReport(jiraKey, result)
  });
  await vscode.window.showTextDocument(document, { preview: true });
}

export function formatDryRunReport(
  jiraKey: string,
  result: DryRunResult
): string {
  return [
    "# DRY RUN RESULT",
    "",
    `**Jira:** ${jiraKey}`,
    "",
    section("Fields", result.fields),
    section("Permission Sets", result.permissionSets),
    section("Validation Rules", result.validationRules),
    section("Tests", result.tests),
    "## Deployment",
    "",
    `**${result.deployment}**`,
    "",
    "## Git",
    "",
    `**${result.git}**`,
    "",
    "## Jira Update",
    "",
    `**${result.jiraUpdate}**`,
    ""
  ].join("\n");
}

function section(title: string, items: string[]): string {
  const content = items.length
    ? items.map((item) => `- ✓ ${item}`).join("\n")
    : "- No changes identified";
  return `## ${title}\n\n${content}\n`;
}
