# Copilot test reporting

Read when executing the reporting phases of `implement-jira.prompt.md`.
The helper runs locally with Node and no additional dependencies or Jira credentials.
It formats supplied observations; it does not execute tests, verify evidence, check
Jira parent relationships, or post comments. Copilot performs those actions.

1. Before collecting results, re-read the parent story and its subtasks through
   Atlassian MCP. If deployment has succeeded and any acceptance criterion lacks
   a test-case subtask, create the missing standard Subtask under the parent,
   verify the returned Jira parent relationship, then include its real key in
   the report input. Never fabricate a Jira key.
2. Copy `scripts/test-results.example.json` to
   `artifacts/jira/<KEY>/<RUN>-input.json`. Replace all example values with the real
   story, Jira base URL, current complete AC list, and every current test-case subtask.
   Verify their parent in Jira. Keep run IDs unique; never omit failed/unrun cases.
3. Execute the required tests. Populate the input once from actual tool results:
   - `run`: ID, ISO timestamp, org, branch, tested commit (use `pending` before a commit exists).
   - `deployment`: Succeeded/Failed/Not Run, ID (`Not available` if absent), actual
     stage/details including publish failures, and component names.
   - `security`: concise persona/Permission Set/access changes; `[]` if not applicable.
   - `criteria`: all AC IDs, even if blocked or uncovered.
   - `cases`: TC ID, Jira key, AC IDs, expected/actual result, method/command,
     result (Passed/Failed/Blocked/Not Run), evidence array, follow-up, cleanup.
     Passed/Failed also require `commit` equal to `run.commit` and nonempty evidence.
     Include failing steps in `actual`; explain unexecuted cases. Use `None` for
     follow-up/cleanup only when accurate. Evidence must contain real run IDs,
     accessible links, or sanitized observations, never secrets or local-only links.
4. Run `npm run story:report -- artifacts/jira/<KEY>/<RUN>-input.json artifacts/jira/<KEY>/<RUN>`.
   On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.
   Use a new output directory; the helper refuses to overwrite previous reports.
   Exit 0 = generated, deployment succeeded and tests passed; 2 = generated but
   failed/incomplete testing or deployment; 1 = invalid input/write error. For 2,
   continue posting the report. For 1, fix the error before posting.
5. Read the concise stdout summary. Artifacts:
   - `test-results.json`: compact normalized results, calculated totals/status/uncovered ACs.
   - `jira-report.md`: parent-report preview.
   - `jira-comments.json`: one entry per parent/subtask with `issueKey`, `marker`,
     plain `text`, and ADF `body`. Read only the needed payload, not every format.
6. Through Atlassian MCP, post each entry to its `issueKey`, using `body` if the
   tool accepts ADF or `text` if it accepts text. Follow the tool's actual schema.
   Check for the exact marker in existing comments before retrying to avoid duplicates.
   If the same marker has different content, use a new run ID instead of silently
   skipping changed results. Record returned comment IDs; only then claim posting.

The generated status checks input consistency, not authenticity, Jira parent
relationships, or publishing success. Confirm those separately before claiming
completion. Generated files are gitignored; post evidence excerpts or approved
accessible links to Jira.
