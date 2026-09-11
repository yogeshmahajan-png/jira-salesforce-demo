---
name: test-jira
description: Create or reconcile Jira test-case subtasks, run tests, and post reports for a completed Salesforce Jira story
argument-hint: "Jira key, for example SF-125"
agent: Salesforce Jira Delivery
---

Test ${input:jiraKey:Enter Jira key, for example SF-125}.
Use the resolved key as `<KEY>`. This command is for a story whose development
and deployment/publish step is already complete.

## Output and tool efficiency

- Request minimal Jira fields first: `key,summary,status,updated,issuetype,parent,subtasks`.
  Fetch full descriptions/comments only for changed, unclear, or evidence-bearing
  items.
- Cache the cloud ID, coverage matrix, transition IDs, and unchanged deployment
  details. Do not repeat equivalent Jira or Confluence reads.
- Batch independent Jira reads and keep shell output concise. Save full JSON to
  ignored artifacts; report only status, IDs, counts, and failure excerpts.
- Read only the report helper summary and needed `jira-comments.json` entries;
  never dump full ADF payloads or full Jira objects unless troubleshooting.

## Workflow

1. Read `<KEY>` directly through Atlassian MCP. Search only when no exact key is
   supplied. Request minimal fields first: key, summary, status, updated, issue
   type, parent, subtasks, acceptance criteria, and latest relevant comments.
   Fetch full descriptions/comments only when needed for AC coverage or evidence.
2. Build or refresh the coverage matrix: `AC -> TC ID -> subtask key`.
3. Reuse existing equivalent test-case subtasks. If any AC lacks a test-case
   subtask, show the missing subtasks and ask for approval before creating them.
   Do not create subtasks or execute tests until approval is received.
4. After approval, create missing standard Subtask items under `<KEY>` unless a
   project-specific test-case subtask type is available. Verify each returned
   parent relationship and use only real Jira keys returned by Jira.
5. Execute required tests for the deployed version. Use the smallest relevant
   existing commands, for example:
   - `npm run test:report`
   - `npm run test:unit -- --findRelatedTests <changed-lwc-file-or-test>`
   - required development-org API/UI checks for persona access or metadata
6. Continue independent test cases after failures. Mark each case as Passed,
   Failed, Blocked, or Not Run with actual evidence. Never fabricate evidence.
7. Copy `scripts/test-results.example.json` to
   `artifacts/jira/<KEY>/<RUN>-input.json`, replace all example values with the
   real story, current AC list, subtask keys, deployment details, results, and
   evidence.
8. Run:
   `npm run story:report -- artifacts/jira/<KEY>/<RUN>-input.json artifacts/jira/<KEY>/<RUN>`
9. Read the concise stdout and `jira-comments.json`. Post each generated comment
   to its Jira issue through Atlassian MCP, using markers to avoid duplicates.
10. After the report is generated and posted, the default completion path is to
    commit any reviewed follow-up changes and then transition each test-case
    subtask whose result is `Passed` to Jira status `Done`. When all required
    cases are `Passed`, transition the parent story to `Done` as well. Resolve
    the available transition by name for each issue, verify the returned status,
    and do not transition `Failed`, `Blocked`, or `Not Run` cases to `Done`. If
    a transition fails, surface the failure in the summary and do not claim that
    issue is complete.
11. Summarize deployment status, test totals, failed/blocked cases, report
    artifacts, posted Jira comments, and verified subtask statuses.

Follow [test-report-guide.md](test-report-guide.md) for report input rules and
posting behavior. The passed-subtask and all-passed parent transition rules above
are part of the workflow; leave incomplete work in its current status.
