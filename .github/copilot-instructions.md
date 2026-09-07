# Repository instructions

For requests to implement or complete a Salesforce Jira story, read and follow
[implement-jira.prompt.md](prompts/implement-jira.prompt.md) once per task. It owns
the requirements, security, test-subtask, publishing, and reporting workflow.
Resolve its Jira-key input from the user's request; never use an example key.
Do not start story delivery for requests only to review/edit instructions or code.
After every successful deployment, reconcile and create any missing Jira test-case
subtasks before executing tests, then run the reporting helper and post its parent
and subtask comments before claiming completion.

Keep work scoped to the request and preserve unrelated changes. Never expose
secrets, deploy to Production, force push, or bypass deployment failures.
Use focused searches and concise tool output; expand to resolve uncertainty.
