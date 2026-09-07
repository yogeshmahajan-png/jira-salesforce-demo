---
name: implement-jira
description: Deliver a Salesforce Jira story with test-case subtasks and testing reports
argument-hint: "Jira key, for example SF-125"
agent: agent
---

Implement ${input:jiraKey:Enter Jira key, for example SF-125}.
Use the resolved key as `<KEY>`. Follow these phases in order.

## 1. Requirements and security

- Read the exact story using Atlassian MCP; search only when no key is supplied.
  Use direct issue/page reads for known keys or IDs. Start with needed fields and
  subtask keys/summaries, then expand only for requirements, comments, or evidence
  that are actually needed. Extract components, API names/types/properties,
  acceptance criteria (ACs), personas, access, layouts, and testing requirements.
- Never invent requirements. If new fields lack explicit permissions or layout
  placement, comment with missing requirements and stop before edits/subtask
  creation. Resolve other material ambiguities before dependent work.
- For security/personas, find the approved Confluence page "Salesforce Persona
  Permission Set Mapping" once per run, then reuse that exact page while it remains
  current. Resolve persona -> label -> Permission Set API name. Stop for
  missing/ambiguous mappings; never guess or auto-create Permission Sets.

## 2. Test-case subtasks

- Assign stable AC IDs if absent. Cover every AC and relevant positive, negative,
  boundary, regression, and persona allow/deny cases. Combine checks into the
  fewest independently executable subtasks when they share setup, method, persona,
  and evidence.
- Discover project subtask types and required fields. Use its test-case subtask
  type or standard subtask; never assume a test plugin. Create one subtask per
  independently executable case under `<KEY>` before implementation.
  If creation is blocked, report the reason and stop.
- Reuse matching TC IDs/equivalent cases; avoid duplicates. Preserve history,
  update changed requirements, and explain superseded cases.
- Each subtask: `TC-ID: behavior | AC IDs | preconditions/org/persona/Permission Set |
data/setup | numbered steps + expected results | method/test/command | cleanup |
initial result: Not Run`.
- Keep one coverage matrix: `AC -> TC ID -> subtask key`; no uncovered ACs.
  Show a brief implementation/testing plan.

## 3. Implement

- Inspect relevant metadata/conventions. Run `npm run story:start -- <KEY>`;
  reuse a verified matching branch if present.
- Modify only story metadata under `force-app/main/default` and necessary tests.
  Reuse existing components and preserve unrelated work.
- Use `permissionsets/<API>.permissionset-meta.xml`. If missing locally, retrieve
  `PermissionSet:<API>` from the development org; stop if absent there too.
  Merge required permissions, preserving unrelated entries. Do not substitute
  Profiles or create replacement Permission Sets.
- Field permissions: Read/Edit = readable/editable true; Read Only = readable
  true/editable false; No Access = no grant. Resolve conflicting existing grants;
  never exceed requested access.
- Apex: follow architecture/error patterns, bulkify, avoid SOQL/DML in loops and
  hard-coded IDs, enforce required CRUD/FLS/sharing, and add meaningful tests.

## 4. Review and publish

- Check `git status`, scoped diff, `git diff --check`, changed XML, and applicable
  local tests. Fix failures before publishing.
- Present files/components, AC coverage, test links/results, and security matrix:
  `persona | Permission Set | field | read | edit`. Jira, Confluence, and metadata
  must agree; stop deployment on mismatch.
- Obtain approval for reviewed deployment/commit/push unless already explicitly
  authorized for this scope. Verify the intended development org and file scope.
- Run `npm run story:publish -- <KEY>`; it deploys, commits, and pushes together.
  Do not repeat these manually. Capture `STORY_RESULT`; publishing is not proof
  that acceptance tests passed.
- For reviewed destructive changes, never pass deleted files to `--source-dir`.
  Prepare `manifest/package.xml` for surviving components and
  `manifest/destructiveChangesPost.xml` for deletions. Run:
  `npm run deploy -- -TargetOrg <development-org> -DestructiveChanges manifest\destructiveChangesPost.xml`.
  Use exact Metadata API names, including layout `%28`/`%29` encoding.
  This only deploys: verify success before authorized commit/push; do not then
  use a publish path that cannot handle deletions.
- On publish failure, stop downstream publishing; do not bypass or manually
  commit/push. Report the actual failed stage, reason, components/Permission Sets,
  org, and any completed deployment/commit. Mark prevented cases Blocked in
  subtask comments and proceed to the parent report with available results.

## 5. Execute and record tests

- After deployment succeeds, refresh the parent story and subtasks with minimal
  fields first: key, summary, status, updated, issue type, and parent. Fetch full
  descriptions/comments only when timestamps changed, coverage is unclear, or
  evidence is needed. Reconcile the coverage matrix against Jira. If any required
  test-case subtask is missing, stop and ask for approval to create the missing
  subtask(s) and run their tests. Do not create subtasks or execute their tests
  until approval is received. After approval, create them under `<KEY>`, use the
  standard Subtask type when no test-specific type exists, and verify each
  returned parent relationship. Never invent a Jira key: use the key returned by
  Jira.
  Do not generate or post the report until every AC has a Jira test-case subtask.
- Execute every current case against the published version using specified Apex
  tests, relevant LWC tests, and development-org API/UI checks as appropriate.
  Local tests do not replace required deployed checks. Await asynchronous results.
- Verify effective persona access: XML inspection or `System.runAs` alone does
  not prove CRUD/FLS. Missing users/tools/manual execution means Blocked.
- Continue independent cases after failures. Passed = expected behavior observed;
  Failed = mismatch; Blocked = missing prerequisite; Not Run = unattempted with
  explanation. Never fabricate results/evidence.
- Read [test-report-guide.md](test-report-guide.md). Record observed results once
  in its input JSON, run the report helper, then post the generated parent and
  subtask comments. Do not manually redraft reports or read every generated format
  when `jira-comments.json` is sufficient.
- Fix in-scope failures; repeat review/publish with applicable authorization.
  Rerun affected cases and relevant regression tests. Preserve execution history
  and tested versions; do not reuse stale results for changed behavior.

## 6. Parent report and completion

Use the same helper on successful, failed, or incomplete runs, including publish
failures. Exit code 2 means reports were generated with failures/incomplete work;
still post them. Exit code 1 means a generation error to fix. Use comment markers
to avoid duplicates.

Counts must reconcile. Testing passes only when all required cases pass for the
final version; any failure means Failed, otherwise Blocked/Not Run means Incomplete.
Deployment success or coverage alone is insufficient. Claim completion only after
successful publishing, required testing, and confirmed Jira reports.

If a Jira write fails, retain its pending payload locally, report the error, and
check whether it succeeded before retrying. Never claim unconfirmed updates.
Do not transition stories/subtasks unless explicitly requested; results are comments.
Obtain approval before creating/merging a PR unless already authorized.
Never expose secrets, deploy to Production, force push, or bypass deployment failures.

## Token-efficient execution

- Prefer direct Atlassian reads over semantic search when keys, IDs, CQL, or JQL are
  known. Request only needed Jira fields when supported. Read subtask
  IDs/summaries first, then necessary details. Start with relevant/latest
  execution comments; expand history for requirements/evidence. Preserve
  pagination needed for full coverage.
- Reuse unchanged requirements, issue-type metadata, and Confluence mappings within
  the run; refresh only when changed, stale, unclear, or resuming after
  interruption.
- Locate files with `rg`; read relevant sections/dependencies. Batch independent
  reads; keep dependent writes sequential.
- Prefer structured CLI output: status, counts, IDs, failure excerpts. Keep full
  sanitized logs in artifacts. Jira evidence needs accessible links or sufficient
  sanitized excerpts; local paths alone are not shared evidence.
- Run relevant tests together and map results to cases, rather than repeating a
  command per subtask. Rerun for changes, failures, or unresolved evidence; honor
  required suites. Use tool wait guidance rather than rapid polling.
- Reuse the coverage matrix in reports. Keep subtask evidence reproducible and
  parent rows concise; link instead of repeating logs/steps.
- For long runs, keep a compact checkpoint: key, requirement/mapping references,
  branch/commit, files, TC keys/results, run IDs, approvals, next step. Verify
  current state on resume. Never save tokens by omitting ACs, tests, gates, or evidence.
