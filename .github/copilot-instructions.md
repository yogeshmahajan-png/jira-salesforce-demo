---
description: Workflow for implementing any Jira user story named or keyed in the user request.
applyTo: **/*
---

Trigger:

When the user provides a Jira user story name or key, run this workflow for that
story only. Replace `<JIRA_STORY>` below with the resolved Jira issue key. Do not
use KAN-125 or any other example key unless the user explicitly requests it.

Workflow:

1. Resolve and read `<JIRA_STORY>` using Atlassian MCP. Search only when the
   exact key is not provided. Extract the object, labels/API names, types,
   properties, and acceptance criteria. Ask if required metadata is unclear.

2. Requirement gate: If the story adds fields without explicitly specifying
   field permissions and page layout placement, do not change
   files, update status, deploy, commit, or push. Add a Jira comment to
   `<JIRA_STORY>` stating that permissions and layout placement are not defined
   and asking the requester to provide those requirements, then stop the
   workflow. Do not infer or recommend permissions or layout changes.

3. Show a concise plan and wait for approval. After approval, update Jira to
   "In Progress".

4. Inspect only relevant Salesforce DX files and create:
   `feature/<JIRA_STORY>-<short-description>`.

5. Implement only required metadata. Review `git diff` and `git diff --check`;
   validate only changed XML files.

6. Deploy only changed metadata to a development org with the reusable command:
   `npm run deploy -- -TargetOrg <development-org>`.
   For destructive changes, never pass deleted files to `--source-dir`.
   Instead create `manifest/package.xml` for surviving components and
   `manifest/destructiveChangesPost.xml` for intended deletions, then run:
   `npm run deploy -- -TargetOrg <development-org>
   -DestructiveChanges manifest\destructiveChangesPost.xml`.
   Use exact Metadata API member names, including `%28`/`%29` in layout names.
   The script uses concise JSON output and reports only deployment status,
   component counts, and deletions.

7. If deployment fails:
   - stop the workflow
   - do not commit
   - do not push
   - comment on `<JIRA_STORY>` with the failure details.

8. If deployment succeeds:
   - verify deployment
   - git add only files belonging to `<JIRA_STORY>`
   - commit with a message beginning `<JIRA_STORY>`
   - push the branch to GitHub.

9. Add a Jira comment to `<JIRA_STORY>` containing:
    - deployment status
    - Salesforce components
    - target org
    - branch
    - commit hash.
    - update JIRA status to "Done" after successful deployment.

10. Ask for approval before creating or merging a pull request.

Do not change the Jira status unless the user explicitly requests it. Surface
ambiguity in the story requirements instead of inventing field behavior or
acceptance criteria.