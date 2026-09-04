javascript;
const { spawnSync } = require("child_process");

const TARGET_ORG = process.env.SF_TARGET_ORG || "dev-sandbox";

function command(program, args, options = {}) {
  const executable =
    process.platform === "win32" && program === "sf" ? "sf.cmd" : program;

  console.log(`\n> ${program} ${args.join(" ")}\n`);

  const result = spawnSync(executable, args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (options.capture) {
    if (result.stdout) {
      console.log(result.stdout);
    }

    if (result.stderr) {
      console.error(result.stderr);
    }
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${program} ${args.join(" ")}`);
  }

  return result.stdout || "";
}

function capture(program, args) {
  const executable =
    process.platform === "win32" && program === "sf" ? "sf.cmd" : program;

  const result = spawnSync(executable, args, {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr || `Command failed: ${program} ${args.join(" ")}`
    );
  }

  return result.stdout.trim();
}

function validateJiraKey(key) {
  if (!key) {
    throw new Error("Jira key is required. Example: SF-125");
  }

  if (!/^[A-Z][A-Z0-9_]*-\d+$/i.test(key)) {
    throw new Error(`Invalid Jira key: ${key}`);
  }

  return key.toUpperCase();
}

function getCurrentBranch() {
  return capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}

function getChangedFiles() {
  const trackedOutput = capture("git", ["diff", "--name-only", "HEAD"]);

  const untrackedOutput = capture("git", [
    "ls-files",
    "--others",
    "--exclude-standard"
  ]);

  const files = [
    ...trackedOutput.split(/\r?\n/),
    ...untrackedOutput.split(/\r?\n/)
  ]
    .map((file) => file.trim())
    .filter(Boolean);

  return [...new Set(files)];
}

function getSalesforceFiles() {
  return getChangedFiles().filter((file) => file.startsWith("force-app/"));
}

function getFieldFiles(files) {
  return files.filter(
    (file) =>
      file.includes("/objects/") &&
      file.includes("/fields/") &&
      file.endsWith(".field-meta.xml")
  );
}

function getPermissionSetFiles(files) {
  return files.filter(
    (file) =>
      file.includes("/permissionsets/") &&
      file.endsWith(".permissionset-meta.xml")
  );
}

function getApexFiles(files) {
  return files.filter(
    (file) =>
      file.includes("/classes/") &&
      (file.endsWith(".cls") || file.endsWith(".cls-meta.xml"))
  );
}

function getFlowFiles(files) {
  return files.filter(
    (file) => file.includes("/flows/") && file.endsWith(".flow-meta.xml")
  );
}

function getOtherSalesforceFiles(files) {
  const knownFiles = new Set([
    ...getFieldFiles(files),
    ...getPermissionSetFiles(files),
    ...getApexFiles(files),
    ...getFlowFiles(files)
  ]);

  return files.filter((file) => !knownFiles.has(file));
}

function ensureCleanWorkspace() {
  const status = capture("git", ["status", "--porcelain"]);

  if (status) {
    throw new Error(
      "Working tree is not clean. Commit or stash existing changes before starting a Jira story."
    );
  }
}

function startStory(jiraKey) {
  ensureCleanWorkspace();

  const branch = `feature/${jiraKey}`;

  console.log(`
Starting Jira story
-------------------
Jira:   ${jiraKey}
Branch: ${branch}
`);

  command("git", ["checkout", "-b", branch]);

  console.log(`
Story initialized successfully.

Next:
Copilot can now implement ${jiraKey}.

Copilot should:
1. Read Jira.
2. Resolve persona-to-Permission Set mapping from Confluence.
3. Implement Salesforce metadata.
4. Update required Permission Set field permissions.
5. Review git diff.

After reviewing and approving the implementation run:

npm run story:publish -- ${jiraKey}
`);
}

function printChangeSummary(files) {
  const fieldFiles = getFieldFiles(files);
  const permissionSetFiles = getPermissionSetFiles(files);
  const apexFiles = getApexFiles(files);
  const flowFiles = getFlowFiles(files);
  const otherFiles = getOtherSalesforceFiles(files);

  console.log(`
CHANGE SUMMARY
==============

Target Org:
${TARGET_ORG}

Fields:
${fieldFiles.length ? fieldFiles.join("\n") : "None"}

Permission Sets:
${permissionSetFiles.length ? permissionSetFiles.join("\n") : "None"}

Apex:
${apexFiles.length ? apexFiles.join("\n") : "None"}

Flows:
${flowFiles.length ? flowFiles.join("\n") : "None"}

Other Salesforce Metadata:
${otherFiles.length ? otherFiles.join("\n") : "None"}
`);
}

function validateSecurityChanges(files) {
  const fieldFiles = getFieldFiles(files);
  const permissionSetFiles = getPermissionSetFiles(files);

  if (fieldFiles.length > 0 && permissionSetFiles.length === 0) {
    console.warn(`
SECURITY WARNING
================

New or modified field metadata was detected, but no Permission Set metadata changed.

This may be valid if Jira does not require field access changes.

If Jira contains persona/security requirements, STOP and verify:
- Confluence persona mapping was resolved.
- Required Permission Set files were updated.
- FieldPermissions were added correctly.
`);
  }

  if (permissionSetFiles.length > 0) {
    console.log(`
SECURITY METADATA DETECTED
==========================

Permission Set files included in this story:

${permissionSetFiles.join("\n")}

Verify these Permission Sets match the Jira personas resolved from Confluence.
`);
  }
}

function deploySalesforce(files) {
  console.log(`
Salesforce components to deploy
-------------------------------
${files.join("\n")}
`);

  const args = ["project", "deploy", "start"];

  for (const file of files) {
    args.push("--source-dir", file);
  }

  args.push("--target-org", TARGET_ORG);
  args.push("--json");

  const output = capture("sf", args);

  let response;

  try {
    response = JSON.parse(output);
  } catch {
    console.log(output);
    throw new Error("Unable to parse Salesforce deployment result.");
  }

  if (response.status !== 0) {
    console.error(JSON.stringify(response, null, 2));

    throw new Error("Salesforce deployment failed.");
  }

  console.log(`
Salesforce deployment succeeded.
Target Org: ${TARGET_ORG}
`);

  return response;
}

function publishStory(jiraKey) {
  const currentBranch = getCurrentBranch();

  if (!currentBranch.includes(jiraKey)) {
    throw new Error(
      `Current branch "${currentBranch}" does not match ${jiraKey}.`
    );
  }

  const salesforceFiles = getSalesforceFiles();

  if (salesforceFiles.length === 0) {
    throw new Error("No Salesforce changes found under force-app.");
  }

  console.log(`
Publishing Jira Story
=====================

Jira:       ${jiraKey}
Branch:     ${currentBranch}
Target Org: ${TARGET_ORG}
`);

  /*
   * STEP 1
   * Show all Salesforce changes grouped by type.
   */
  printChangeSummary(salesforceFiles);

  /*
   * STEP 2
   * Warn if fields changed but Permission Sets did not.
   *
   * Copilot should already have validated Jira security
   * requirements against Confluence before this script runs.
   */
  validateSecurityChanges(salesforceFiles);

  /*
   * STEP 3
   * Deploy before commit.
   *
   * If Salesforce fails, execution stops here.
   */
  deploySalesforce(salesforceFiles);

  /*
   * STEP 4
   * Stage only Salesforce files belonging
   * to this Jira implementation.
   */
  command("git", ["add", "--", ...salesforceFiles]);

  /*
   * STEP 5
   * Commit.
   */
  command("git", ["commit", "-m", `${jiraKey} Salesforce implementation`]);

  /*
   * STEP 6
   * Get commit SHA.
   */
  const commit = capture("git", ["rev-parse", "--short", "HEAD"]);

  /*
   * STEP 7
   * Push feature branch.
   */
  command("git", ["push", "-u", "origin", currentBranch]);

  /*
   * Build categorized result output
   * so Copilot can post useful information back to Jira.
   */
  const fieldFiles = getFieldFiles(salesforceFiles);
  const permissionSetFiles = getPermissionSetFiles(salesforceFiles);
  const apexFiles = getApexFiles(salesforceFiles);
  const flowFiles = getFlowFiles(salesforceFiles);
  const otherFiles = getOtherSalesforceFiles(salesforceFiles);

  console.log(`
=== STORY_RESULT ===

Jira: ${jiraKey}
Status: SUCCESS
Salesforce Org: ${TARGET_ORG}
Branch: ${currentBranch}
Commit: ${commit}

Fields:
${fieldFiles.length ? fieldFiles.join("\n") : "None"}

Permission Sets:
${permissionSetFiles.length ? permissionSetFiles.join("\n") : "None"}

Apex:
${apexFiles.length ? apexFiles.join("\n") : "None"}

Flows:
${flowFiles.length ? flowFiles.join("\n") : "None"}

Other Salesforce Metadata:
${otherFiles.length ? otherFiles.join("\n") : "None"}

All Components:
${salesforceFiles.join("\n")}

=== END_STORY_RESULT ===
`);
}

function main() {
  const action = process.argv[2];

  const jiraKey = validateJiraKey(process.argv[3]);

  switch (action) {
    case "start":
      startStory(jiraKey);
      break;

    case "publish":
      publishStory(jiraKey);
      break;

    default:
      throw new Error(
        "Use: node scripts/story.js start SF-125\n" +
          "or: node scripts/story.js publish SF-125"
      );
  }
}

try {
  main();
} catch (error) {
  console.error(`
AUTOMATION FAILED
=================
${error.message}
`);

  process.exit(1);
}
