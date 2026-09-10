---
name: implement-jira
description: Execute a Salesforce Jira story using the Salesforce Jira Delivery agent workflow
argument-hint: "Jira key, for example SF-125"
agent: Salesforce Jira Delivery
---

Implement ${input:jiraKey:Enter Jira key}.

Use the resolved key as `<KEY>`. Follow the Salesforce Jira Delivery agent
instructions as the single source of truth for Jira and Confluence reads,
security mapping, Salesforce conventions, deployment approval, Git operations,
safety controls, testing, reporting, and completion status.

This prompt provides the story-specific execution checklist:

## 1. Requirements and test coverage

- Read and confirm the exact Jira story and acceptance criteria.
- Assign stable acceptance-criterion IDs when they are missing.
- Build one coverage matrix: `AC -> TC ID -> Jira subtask key`.
- Cover every acceptance criterion and relevant positive, negative, boundary,
  regression, and persona allow/deny behavior.
- Reuse equivalent existing test-case subtasks. Before creating anything,
  show missing cases and request approval as required by the agent workflow.
- Use the real Jira keys returned by Jira; never invent subtask keys.

## 2. Implementation

- Implement only the requested Salesforce changes and necessary tests.
- Preserve unrelated metadata and existing Permission Set entries.
- Before destructive changes, complete the repository-wide dependency scan
  required by the agent workflow and record its result in the review.
- Stop and report any unresolved dependency or material ambiguity instead of
  guessing.

## 3. Review and publish

- Review the scoped files, Salesforce components, acceptance-criteria coverage,
  security matrix, test plan, and dependency-scan results.
- Run applicable local checks and fix failures before requesting deployment.
- Obtain the required approval before deployment, commit, or push.
- Use `npm run story:publish -- <KEY>` for normal reviewed publishing. The
  script deploys Salesforce metadata, then stages, commits, and pushes the
  changed Salesforce files. It does not replace acceptance-test execution.
- For reviewed destructive changes, use the manifest/destructive-deployment
  procedure defined by the agent; do not pass deleted files to the normal
  source deployment path.

## 4. Execute and report tests

- After a successful deployment, reconcile the Jira test-case subtasks again.
- Do not create missing subtasks or execute their tests until the required
  approval is received.
- Execute every required case against the deployed version and record actual
  evidence. Use exactly: `Passed`, `Failed`, `Blocked`, or `Not Run`.
- Copy `scripts/test-results.example.json` to a unique ignored artifact input,
  replace every example value with the real story, deployment, case, result,
  and evidence data, then run:

  `npm run story:report -- artifacts/jira/<KEY>/<RUN>-input.json artifacts/jira/<KEY>/<RUN>`

- Read the concise report output and the needed `jira-comments.json` entries.
- Post generated parent and subtask comments through Atlassian MCP, using
  markers to avoid duplicate comments.
- Verify posted comment IDs and issue statuses before claiming completion.
- Follow the agent's completion rules for transitioning passed subtasks and
  the parent story; leave failed, blocked, and not-run work incomplete.

## Completion handoff

Summarize the Jira key, development org, branch and commit, deployment status
and ID, changed components, coverage matrix, test totals and evidence,
generated artifacts, posted comments, and verified Jira statuses.
