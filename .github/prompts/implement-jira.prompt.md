---
name: implement-jira
description: Implement a Salesforce Jira story end-to-end
argument-hint: "Jira key, for example SF-125"
agent: agent
---

Implement Jira story:

${input:jiraKey:Enter Jira key, for example SF-125}

Follow these steps exactly.

## Phase 1 - Read Jira

Use the Atlassian MCP tools to retrieve the Jira issue.

Extract:

- summary
- description
- Salesforce objects
- requested fields/components
- API names
- data types
- acceptance criteria
- permissions/security requirements
- testing requirements

If the requirements are materially ambiguous, explain the ambiguity rather than inventing requirements.

## Phase 2 - Start development

Run:

npm run story:start -- ${input:jiraKey}

Do not create a second branch if the correct Jira branch already exists.

## Phase 3 - Analyze existing implementation

Inspect the Salesforce DX repository before modifying anything.

Check whether requested metadata already exists.

Follow existing project conventions.

## Phase 4 - Implement

Implement only the Salesforce changes required by the Jira story.

Do not modify unrelated files.

For Salesforce metadata:

force-app/main/default

If Apex is required:

- follow existing architecture
- bulkify code
- avoid SOQL/DML inside loops
- implement tests
- consider CRUD/FLS and sharing requirements

## Phase 5 - Review

Run:

git status
git diff

Explain:

1. files created
2. files modified
3. Salesforce components affected
4. how each change maps to the Jira acceptance criteria

STOP HERE and ask the developer to approve deployment.

Do not deploy, commit, or push without approval.

## Phase 6 - Publish after approval

When the developer approves, run:

npm run story:publish -- ${input:jiraKey}

Do not manually commit or push because the script handles this.

## Phase 7 - Handle failure

If the publish script fails:

- stop
- do not bypass the failure
- do not push
- use Atlassian MCP to comment on the Jira issue with:
  - status: failed
  - failure reason
  - affected component
  - Salesforce target org

## Phase 8 - Update Jira after success

Read the STORY_RESULT output produced by the publish command.

Use Atlassian MCP to add a Jira comment containing:

Implementation completed successfully.

Include:

- Salesforce target org
- deployed components
- Git branch
- Git commit
- deployment status

Do not transition the Jira issue unless explicitly requested.

## Security

Never:

- deploy to Production
- expose tokens
- expose passwords
- expose client secrets
- modify unrelated metadata
- force push Git
- bypass Salesforce deployment failures
