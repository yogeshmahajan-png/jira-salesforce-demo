---
name: implement-jira
description: Implement a Salesforce Jira story end-to-end
argument-hint: "Jira key, for example SF-125"
agent: agent
---

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
- personas/user types
- requested access level
- testing requirements

Examples of personas/user types may include:

- Standard User
- Admin
- Sales User
- Sales Manager
- Service User

If the requirements are materially ambiguous, explain the ambiguity rather than inventing requirements.

Do not assume that a Jira persona/user type is the Salesforce Permission Set API name.

---

## Phase 2 - Resolve Security from Confluence

If Jira specifies any persona, user type, or security/access requirement, use Atlassian MCP to search Confluence.

Search for the approved Salesforce persona-to-Permission-Set mapping.

Preferred Confluence page:

"Salesforce Persona Permission Set Mapping"

The Confluence mapping is the source of truth for determining which Salesforce Permission Set represents each Jira persona.

For every persona mentioned in Jira, resolve:

Jira Persona
→ Permission Set Label
→ Permission Set API Name

Example:

Jira:

Standard User

Confluence:

Standard User
→ Sales Standard User
→ Sales_Standard_User

Another example:

Admin
→ Sales Admin
→ Sales_Admin

Never guess or construct a Permission Set API name.

If no approved mapping exists for a Jira persona:

STOP.

Explain:

"No approved Permission Set mapping was found in Confluence for persona: <persona>."

Do not create a new Permission Set automatically.

If multiple mappings exist and it is unclear which one applies:

STOP.

Explain the ambiguity and ask the developer to resolve it.

Before continuing, produce a mapping summary:

| Jira Persona  | Permission Set Label | Permission Set API Name |
| ------------- | -------------------- | ----------------------- |
| Standard User | Sales Standard User  | Sales_Standard_User     |
| Admin         | Sales Admin          | Sales_Admin             |

---

## Phase 3 - Start Development

Run:

npm run story:start -- ${input:jiraKey}

Do not create a second branch if the correct Jira branch already exists.

If the branch already exists, use the existing branch after verifying that it belongs to the current Jira story.

---

## Phase 4 - Analyze Existing Implementation

Inspect the Salesforce DX repository before modifying anything.

Check whether the requested:

- objects
- fields
- Apex classes
- Flows
- validation rules
- Permission Sets
- other Salesforce metadata

already exist.

Follow existing project conventions.

For Permission Sets resolved from Confluence, look under:

force-app/main/default/permissionsets/

Example:

force-app/main/default/permissionsets/Sales_Standard_User.permissionset-meta.xml

If a required Permission Set exists locally, use the existing metadata file.

If the Permission Set does not exist locally, retrieve it from the development Salesforce org.

Example:

sf project retrieve start --metadata PermissionSet:Sales_Standard_User --target-org dev-sandbox

Do not create a replacement Permission Set simply because the expected Permission Set is missing from the local repository.

If the Permission Set cannot be found in Salesforce either:

STOP and report the problem.

---

## Phase 5 - Implement Salesforce Changes

Implement only the Salesforce changes required by the Jira story.

Do not modify unrelated files.

Store Salesforce metadata under:

force-app/main/default

For example, new Account fields belong under:

force-app/main/default/objects/Account/fields/

### Field Security

If Jira specifies field access by persona, update the Permission Set resolved from Confluence.

Use:

force-app/main/default/permissionsets/<PermissionSetApiName>.permissionset-meta.xml

Do not use Profile metadata when the approved Confluence mapping specifies a Permission Set.

Never replace the entire existing Permission Set file.

Merge the required field permissions into the existing Permission Set metadata while preserving all unrelated permissions.

For Read/Edit access:

```xml
<fieldPermissions>
    <editable>true</editable>
    <field>Account.Customer_Tier__c</field>
    <readable>true</readable>
</fieldPermissions>
```

For Read Only access:

```xml
<fieldPermissions>
    <editable>false</editable>
    <field>Account.Customer_Tier__c</field>
    <readable>true</readable>
</fieldPermissions>
```

For No Access:

Do not grant field permission unless existing repository conventions explicitly require an entry.

### Example

If Jira specifies:

Standard User:

- Customer_Tier__c: Read/Edit
- Renewal_Date__c: Read/Edit

Admin:

- Customer_Tier__c: Read/Edit
- Renewal_Date__c: Read/Edit

And Confluence resolves:

Standard User
→ Sales_Standard_User

Admin
→ Sales_Admin

Then modify:

force-app/main/default/permissionsets/Sales_Standard_User.permissionset-meta.xml

and:

force-app/main/default/permissionsets/Sales_Admin.permissionset-meta.xml

Do not modify unrelated Permission Sets.

### Apex Requirements

If Apex is required:

- follow existing architecture
- bulkify code
- avoid SOQL/DML inside loops
- implement appropriate tests
- consider CRUD/FLS
- consider sharing requirements
- follow existing error-handling patterns
- do not hard-code IDs

---

## Phase 6 - Validate Security

If Jira contains security requirements, create a security validation matrix before deployment.

Example:

| Persona       | Permission Set      | Field                    | Read | Edit |
| ------------- | ------------------- | ------------------------ | ---- | ---- |
| Standard User | Sales_Standard_User | Account.Customer_Tier__c | Yes  | Yes  |
| Standard User | Sales_Standard_User | Account.Renewal_Date__c  | Yes  | Yes  |
| Admin         | Sales_Admin         | Account.Customer_Tier__c | Yes  | Yes  |
| Admin         | Sales_Admin         | Account.Renewal_Date__c  | Yes  | Yes  |

Compare this matrix against:

1. Jira requirements
2. Confluence persona mapping
3. Generated Salesforce Permission Set metadata

All three must agree.

If they do not agree:

STOP.

Do not deploy until the mismatch is resolved.

---

## Phase 7 - Review

Run:

git status

git diff

Explain:

1. files created
2. files modified
3. Salesforce components affected
4. fields/components created
5. Permission Sets modified
6. Jira personas identified
7. Confluence persona-to-Permission-Set mappings used
8. field access granted to each Permission Set
9. how each change maps to the Jira acceptance criteria

If security is involved, display the final security matrix.

Verify that no unrelated Salesforce metadata was changed.

STOP HERE and ask the developer to approve deployment.

Do not deploy, commit, or push without approval.

---

## Phase 8 - Publish After Approval

Only after the developer explicitly approves the reviewed changes, run:

npm run story:publish -- ${input:jiraKey}

Do not manually commit or push because the script handles this.

The publish process must include all Salesforce files related to the Jira story, including:

- field metadata
- Permission Set metadata
- Apex
- Flow
- other required Salesforce metadata

Do not include unrelated changes.

---

## Phase 9 - Handle Failure

If the publish script fails:

- stop
- do not bypass the failure
- do not commit manually
- do not push
- identify the deployment failure

Use Atlassian MCP to comment on the Jira issue with:

- status: failed
- failure reason
- affected Salesforce component
- affected Permission Set, if applicable
- Salesforce target org

Do not transition the Jira issue.

---

## Phase 10 - Update Jira After Success

Read the STORY_RESULT output produced by the publish command.

Use Atlassian MCP to add a Jira comment.

The comment should contain:

Implementation completed successfully.

Include:

- Salesforce target org
- deployed components
- fields created/modified
- Jira personas
- Permission Sets modified
- field access granted
- Git branch
- Git commit
- deployment status

Example:

Implementation completed successfully.

Salesforce Org:
dev-sandbox

Components:

- Account.Customer_Tier__c
- Account.Renewal_Date__c

Security:

Standard User
→ Sales_Standard_User
→ Customer_Tier__c: Read/Edit
→ Renewal_Date__c: Read/Edit

Admin
→ Sales_Admin
→ Customer_Tier__c: Read/Edit
→ Renewal_Date__c: Read/Edit

Deployment:
Succeeded

Branch:
feature/SF-125

Commit:
abc1234

Do not transition the Jira issue unless explicitly requested.

---

## Security and Safety Rules

Never:

- deploy to Production
- expose tokens
- expose passwords
- expose client secrets
- modify unrelated metadata
- force push Git
- bypass Salesforce deployment failures
- guess Permission Set API names
- create Permission Sets without an explicit requirement
- change Profile metadata when Confluence specifies Permission Sets
- grant more access than Jira requests
- remove existing unrelated Permission Set permissions

Always use:

Jira
→ business requirement and requested access

Confluence
→ approved persona-to-Permission-Set mapping

Salesforce repository/org
→ actual Permission Set metadata

The final implementation must be consistent across all three sources.
