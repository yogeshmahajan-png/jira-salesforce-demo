const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const jiraKey = process.argv[2];

if (!jiraKey) {
  console.error(`
Usage:

npm run qa:start -- SF-125

Example:

npm run qa:start -- SF-125
`);
  process.exit(1);
}

if (!/^[A-Z][A-Z0-9]+-\d+$/.test(jiraKey)) {
  console.error(`Invalid Jira key: ${jiraKey}`);
  console.error("Expected format: SF-125");
  process.exit(1);
}

console.log("");
console.log("==========================================");
console.log(" Salesforce Jira QA Agent");
console.log("==========================================");
console.log("");

console.log(`Jira Story : ${jiraKey}`);
console.log(`Started    : ${new Date().toISOString()}`);
console.log("");

/*

* ---
* Configuration
* ---

*/

const PROJECT_ROOT = process.cwd();

const PROMPT_FILE = path.join(
  PROJECT_ROOT,
  ".github",
  "prompts",
  "implement-qa.prompt.md"
);

const AGENT_FILE = path.join(
  PROJECT_ROOT,
  ".github",
  "agents",
  "salesforce-qa.agent.md"
);

/*

* ---
* Validate QA files
* ---

*/

function validateFile(file, description) {
  if (!fs.existsSync(file)) {
    console.error(`Missing ${description}:`);
    console.error(file);
    process.exit(1);
  }
}

validateFile(PROMPT_FILE, "QA prompt file");

validateFile(AGENT_FILE, "QA agent file");

/*

* ---
* Environment validation
* ---

*/

const requiredEnvironment = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"];

const missingEnvironment = requiredEnvironment.filter(
  (key) => !process.env[key]
);

if (missingEnvironment.length > 0) {
  console.warn("");
  console.warn("Warning: Jira environment variables are missing.");
  console.warn("");

  missingEnvironment.forEach((key) => {
    console.warn(`Missing: ${key}`);
  });

  console.warn("");
  console.warn(
    "The QA agent can still be launched if Jira/Copilot authentication"
  );
  console.warn("is handled by your configured VS Code/Jira integration.");
  console.warn("");
}

/*

* ---
* QA context
* ---

*/

const qaContext = {
  jiraKey,
  startedAt: new Date().toISOString(),
  projectRoot: PROJECT_ROOT,
  promptFile: PROMPT_FILE,
  agentFile: AGENT_FILE
};

const contextDirectory = path.join(PROJECT_ROOT, ".qa");

if (!fs.existsSync(contextDirectory)) {
  fs.mkdirSync(contextDirectory, {
    recursive: true
  });
}

const contextFile = path.join(contextDirectory, `${jiraKey}-qa-context.json`);

fs.writeFileSync(contextFile, JSON.stringify(qaContext, null, 2));

console.log("QA context created:");
console.log(contextFile);
console.log("");

/*

* ---
* Salesforce CLI availability
* ---

*/

function commandExists(command) {
  ```
const result = spawnSync(
    process.platform === "win32"
        ? "where"
        : "which",
    [command],
    {
        stdio: "ignore"
    }
);

return result.status === 0;
```;
}

const sfCommandAvailable = commandExists("sf");

console.log(
  `Salesforce CLI: ${sfCommandAvailable ? "AVAILABLE" : "NOT AVAILABLE"}`
);

console.log("");

/*

* ---
* QA execution instructions
* ---
*
* The actual Jira/Xray operations are intentionally
* delegated to the Salesforce QA Agent.
*
* This script prepares and validates the execution
* context and gives Copilot a deterministic entry point.
*
* ---

*/

const executionInstruction = `
Run Salesforce QA for Jira story ${jiraKey}.

Use:

Agent:
${AGENT_FILE}

Prompt:
${PROMPT_FILE}

Requirements:

1. Verify Jira status is Ready for QA.
2. Read the Jira story.
3. Analyze acceptance criteria.
4. Generate functional understanding.
5. Generate positive, negative, boundary and security tests where applicable.
6. Check for duplicate Xray tests.
7. Create Xray Test issues.
8. Create Xray Test Execution.
9. Execute available Salesforce automated tests.
10. Update Xray test results.
11. Generate QA report.
12. Add the QA report to Jira.
13. Transition Jira according to the result.

Never fabricate test results.
`;

console.log("QA execution plan:");
console.log(executionInstruction);

/*

* ---
* Optional Salesforce validation
* ---
*
* This does NOT deploy anything.
*
* It only verifies that Salesforce CLI is available.
  */

if (sfCommandAvailable) {
  ```
console.log("Checking Salesforce CLI...");

const sfVersion = spawnSync(
    "sf",
    ["--version"],
    {
        encoding: "utf8"
    }
);

if (sfVersion.status === 0) {
    console.log(
        sfVersion.stdout.trim()
    );
} else {
    console.warn(
        "Salesforce CLI detected but version check failed."
    );
}
```;
} else {
  ```
console.warn(
    "Salesforce CLI was not found."
);

console.warn(
    "Automated Salesforce tests may be unavailable."
);
```;
}

console.log("");

/*

* ---
* Final handoff
* ---

*/

console.log("==========================================");
console.log(" QA AGENT READY");
console.log("==========================================");
console.log("");

console.log(`Story: ${jiraKey}`);

console.log("Next action: execute the salesforce-qa agent.");

console.log("");

console.log("Example Copilot command:");

console.log(`Run QA for ${jiraKey}`);

console.log("");

console.log("QA context:");

console.log(contextFile);

console.log("");
console.log("==========================================");
