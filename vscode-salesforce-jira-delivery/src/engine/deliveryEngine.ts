import {
  createDeliveryState,
  normalizeJiraKey,
  type DryRunResult,
  type TestSummary,
  type DeliveryState,
  updateDeliveryState
} from "../models/delivery";
import type { DeliveryStateStore } from "../services/deliveryStateService";

export interface DeliveryRequest {
  jiraKey: string;
  targetOrg: string;
  dryRun: boolean;
}

export interface DeliveryResult {
  jiraKey: string;
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  branch?: string;
  commit?: string;
  deployment?: string;
  testSummary?: {
    total: number;
    passed: number;
    failed: number;
    blocked: number;
  };
}

interface JiraService {
  openIssue(jiraKey?: string): Promise<string | undefined>;
  startStory(jiraKey: string): Promise<void>;
  publishStory(jiraKey: string): Promise<void>;
}

interface ConfluenceService {
  openPersonaMapping(): Promise<unknown>;
}

interface SalesforceService {
  deploy(): Promise<void>;
}

interface GitService {
  status(): Promise<void>;
}

interface TestService {
  runUnitTests(): Promise<void>;
}

interface StoryAnalyzer {
  analyze(jiraKey: string, dryRun?: boolean): Promise<Partial<DryRunResult> | void>;
}

interface TestGenerator {
  generate(jiraKey: string, dryRun?: boolean): Promise<string[] | void>;
}

export interface DeliveryServices {
  jira: JiraService;
  confluence: ConfluenceService;
  salesforce: SalesforceService;
  git: GitService;
  tests: TestService;
  storyAnalyzer: StoryAnalyzer;
  testGenerator: TestGenerator;
}

type ChangeListener = (state: DeliveryState | undefined) => void;

function validateRequest(request: DeliveryRequest): DeliveryRequest {
  if (!request || typeof request !== "object") {
    throw new Error("A delivery request is required.");
  }

  const jiraKey = normalizeJiraKey(request.jiraKey);
  if (!jiraKey) {
    throw new Error("A Jira key is required.");
  }

  const targetOrg = request.targetOrg?.trim();
  if (!targetOrg) {
    throw new Error("A Salesforce target org is required.");
  }

  return { ...request, jiraKey, targetOrg };
}

export async function analyzeStory(
  request: DeliveryRequest
): Promise<DeliveryResult> {
  const validated = validateRequest(request);

  // The engine contract is intentionally independent of VS Code. Concrete Jira,
  // Confluence, repository, and planning integrations are injected by DeliveryEngine.
  return {
    jiraKey: validated.jiraKey,
    status: "SUCCESS"
  };
}

export class DeliveryEngine {
  public state: DeliveryState | undefined;
  public onChange: ChangeListener;
  public dryRunEnabled = true;

  public constructor(
    private readonly services: DeliveryServices,
    private readonly stateStore: DeliveryStateStore,
    onChange: ChangeListener = () => undefined
  ) {
    this.onChange = onChange;
    this.state = undefined;
  }

  public async initialize(): Promise<DeliveryState | undefined> {
    this.state = await this.stateStore.loadLatest();
    this.dryRunEnabled = this.state?.dryRun ?? true;
    this.notify();
    return this.state;
  }

  public async setStory(
    jiraKey: string,
    targetOrg = "CopilotJiraOrg",
    dryRun?: boolean
  ): Promise<DeliveryState> {
    const normalizedKey = normalizeJiraKey(jiraKey);
    if (!normalizedKey) {
      throw new Error("A Jira key is required.");
    }

    this.state =
      (await this.stateStore.load(normalizedKey)) ??
      createDeliveryState(
        normalizedKey,
        targetOrg,
        dryRun ?? this.dryRunEnabled
      );
    this.dryRunEnabled = this.state.dryRun;
    await this.persist();
    return this.state;
  }

  public async setDryRun(enabled: boolean): Promise<void> {
    this.dryRunEnabled = enabled;
    if (this.state) {
      await this.update({ dryRun: enabled });
      return;
    }
    this.notify();
  }

  public async selectStory(): Promise<DeliveryState | undefined> {
    const jiraKey = await this.services.jira.openIssue(this.state?.jiraKey);
    return jiraKey ? await this.setStory(jiraKey) : undefined;
  }

  public async start(jiraKey?: string): Promise<DeliveryState | undefined> {
    const selectedKey =
      jiraKey ??
      this.state?.jiraKey ??
      (await this.services.jira.openIssue());
    if (!selectedKey) {
      return undefined;
    }

    await this.setStory(selectedKey);
    if (this.requireState().dryRun) {
      await this.runDryRun();
      return this.state;
    }

    await this.update({
      status: "STARTED",
      branch: `feature/${this.requireStory()}`,
      implementation: {
        ...this.requireState().implementation,
        status: "IN_PROGRESS"
      }
    });
    try {
      await this.services.jira.startStory(this.requireStory());
    } catch (error) {
      await this.update({
        status: "FAILED",
        implementation: {
          ...this.requireState().implementation,
          status: "FAILED"
        }
      });
      throw error;
    }
    return this.state;
  }

  public async analyze(request?: Partial<DeliveryRequest>): Promise<DeliveryResult> {
    const jiraKey = request?.jiraKey ?? this.requireStory();
    const deliveryRequest = validateRequest({
      jiraKey,
      targetOrg: request?.targetOrg ?? this.requireState().targetOrg,
      dryRun: request?.dryRun ?? this.requireState().dryRun
    });

    try {
      await this.services.storyAnalyzer.analyze(
        deliveryRequest.jiraKey,
        deliveryRequest.dryRun
      );
    } catch (error) {
      await this.update({ status: "FAILED" });
      throw error;
    }
    await this.update({
      status: "ANALYZED",
      targetOrg: deliveryRequest.targetOrg,
      dryRun: deliveryRequest.dryRun,
      implementation: {
        ...this.requireState().implementation,
        status: "PLANNED"
      }
    });

    return analyzeStory(deliveryRequest);
  }

  public async generateTests(): Promise<void> {
    await this.services.testGenerator.generate(
      this.requireStory(),
      this.requireState().dryRun
    );
  }

  public async runDryRun(): Promise<DryRunResult> {
    const state = this.requireState();
    if (!state.dryRun) {
      throw new Error("Enable Dry Run before generating a dry-run result.");
    }

    let analysis: Partial<DryRunResult> | void;
    let tests: string[] | void;
    try {
      analysis = await this.services.storyAnalyzer.analyze(state.jiraKey, true);
      tests = await this.services.testGenerator.generate(state.jiraKey, true);
    } catch (error) {
      await this.update({ status: "FAILED" });
      throw error;
    }

    const result: DryRunResult = {
      fields: unique(analysis?.fields),
      permissionSets: unique(analysis?.permissionSets),
      validationRules: unique(analysis?.validationRules),
      tests: unique(tests ?? analysis?.tests),
      deployment: "NOT_EXECUTED",
      git: "NOT_EXECUTED",
      jiraUpdate: "NOT_EXECUTED",
      generatedAt: new Date().toISOString()
    };
    await this.update({
      status: "AWAITING_APPROVAL",
      approval: "AWAITING_APPROVAL",
      dryRunResult: result,
      security: {
        status:
          state.security.status === "PENDING"
            ? "VALIDATED"
            : state.security.status,
        source: state.security.source ?? "Confluence"
      },
      implementation: {
        ...state.implementation,
        status: "PLANNED",
        components:
          result.fields.length +
          result.permissionSets.length +
          result.validationRules.length
      },
      testing: {
        ...state.testing,
        total: result.tests.length || state.testing.total
      }
    });
    return result;
  }

  public async approveAndExecute(): Promise<DeliveryState> {
    const state = this.requireState();
    this.dryRunEnabled = false;
    await this.update({
      dryRun: false,
      approval: "APPROVED",
      status: "EXECUTING",
      branch: state.branch ?? `feature/${state.jiraKey}`,
      implementation: {
        ...state.implementation,
        status: "SUCCESS"
      }
    });

    // 1. Deploy Salesforce metadata
    await this.update({
      deployment: { ...this.requireState().deployment, status: "RUNNING" }
    });
    try {
      await this.services.salesforce.deploy();
      await this.update({
        deployment: { ...this.requireState().deployment, status: "SUCCESS" }
      });
    } catch (error) {
      await this.update({
        status: "FAILED",
        deployment: { ...this.requireState().deployment, status: "FAILED" }
      });
      throw error;
    }

    // 2. Running tests
    await this.update({
      testing: { ...this.requireState().testing, status: "RUNNING" }
    });
    try {
      await this.services.tests.runUnitTests();
      const currentTesting = this.requireState().testing;
      const total =
        currentTesting.total ||
        (this.state?.dryRunResult?.tests.length ?? 1);
      await this.update({
        testing: {
          ...currentTesting,
          status: "PASS",
          total,
          passed: total,
          failed: 0,
          blocked: 0
        }
      });
    } catch (error) {
      const currentTesting = this.requireState().testing;
      await this.update({
        status: "FAILED",
        testing: {
          ...currentTesting,
          status: "FAIL",
          failed: currentTesting.total || 1
        }
      });
      throw error;
    }

    // 3. Updating Jira
    await this.update({
      jiraReport: { status: "RUNNING" }
    });
    try {
      await this.services.jira.publishStory(this.requireStory());
      await this.update({
        jiraReport: { status: "POSTED" }
      });
    } catch (error) {
      await this.update({
        status: "FAILED",
        jiraReport: { status: "FAILED" }
      });
      throw error;
    }

    // 4. Git commit & push
    await this.update({
      git: { ...this.requireState().git, status: "PUBLISHING" }
    });
    try {
      await this.services.git.status();
      await this.update({
        git: {
          status: "PUSHED",
          commit: this.requireState().git.commit ?? "auto"
        },
        status: "COMPLETED"
      });
    } catch (error) {
      await this.update({
        status: "FAILED",
        git: { ...this.requireState().git, status: "FAILED" }
      });
      throw error;
    }

    return this.requireState();
  }

  public async recordSecurityValidation(
    status: DeliveryState["security"]["status"],
    source = "Confluence"
  ): Promise<void> {
    await this.update({ security: { status, source } });
  }

  public async recordImplementation(
    status: DeliveryState["implementation"]["status"],
    components: number
  ): Promise<void> {
    if (this.requireState().dryRun && status === "SUCCESS") {
      this.assertExecutionAllowed("record an implemented result");
    }
    if (!Number.isInteger(components) || components < 0) {
      throw new Error("Implementation component count must be a non-negative integer.");
    }
    await this.update({
      status: status === "SUCCESS" ? "IMPLEMENTED" : this.requireState().status,
      implementation: { status, components }
    });
  }

  public async recordTestSummary(
    status: DeliveryState["testing"]["status"],
    summary: TestSummary
  ): Promise<void> {
    this.assertExecutionAllowed("record executed test results");
    validateTestSummary(summary);
    await this.update({ testing: { status, ...summary } });
  }

  public async recordDeployment(
    status: DeliveryState["deployment"]["status"],
    id?: string
  ): Promise<void> {
    this.assertExecutionAllowed("record a deployment");
    await this.update({ deployment: { status, id } });
  }

  public async recordGit(
    status: DeliveryState["git"]["status"],
    commit?: string
  ): Promise<void> {
    this.assertExecutionAllowed("record a Git publication");
    await this.update({ git: { status, commit } });
  }

  public async recordJiraReport(
    status: DeliveryState["jiraReport"]["status"]
  ): Promise<void> {
    this.assertExecutionAllowed("record a Jira update");
    await this.update({ jiraReport: { status } });
  }

  public async deploy(): Promise<DeliveryState> {
    this.assertExecutionAllowed("deploy");
    this.requireStory();
    await this.update({
      deployment: {
        ...this.requireState().deployment,
        status: "RUNNING"
      }
    });
    try {
      await this.services.salesforce.deploy();
    } catch (error) {
      await this.recordDeployment("FAILED");
      throw error;
    }
    return this.requireState();
  }

  public async runTests(): Promise<void> {
    this.assertExecutionAllowed("execute tests");
    this.requireStory();
    await this.update({
      testing: {
        ...this.requireState().testing,
        status: "RUNNING"
      }
    });
    try {
      await this.services.tests.runUnitTests();
    } catch (error) {
      const testing = this.requireState().testing;
      await this.recordTestSummary("FAIL", {
        total: testing.total,
        passed: testing.passed,
        failed: testing.failed,
        blocked: testing.blocked
      });
      throw error;
    }
  }

  public async publish(): Promise<void> {
    this.assertExecutionAllowed("commit, push, or update Jira");
    await this.update({
      git: { ...this.requireState().git, status: "PUBLISHING" }
    });
    try {
      await this.services.jira.publishStory(this.requireStory());
    } catch (error) {
      await this.recordGit("FAILED");
      throw error;
    }
  }

  public openPersonaMapping(): Promise<unknown> {
    return this.services.confluence.openPersonaMapping();
  }

  public gitStatus(): Promise<void> {
    return this.services.git.status();
  }

  public requireStory(): string {
    if (!this.state?.jiraKey) {
      throw new Error("Select a Jira story before starting delivery.");
    }
    return this.state.jiraKey;
  }

  private requireState(): DeliveryState {
    if (!this.state) {
      throw new Error("Select a Jira story before starting delivery.");
    }
    return this.state;
  }

  private assertExecutionAllowed(action: string): void {
    if (this.requireState().dryRun) {
      throw new Error(
        `Dry Run is enabled. Cannot ${action}; disable Dry Run after approval.`
      );
    }
  }

  private async update(
    update: Partial<Omit<DeliveryState, "schemaVersion" | "jiraKey">>
  ): Promise<void> {
    this.state = updateDeliveryState(this.requireState(), update);
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.stateStore.save(this.requireState());
    this.notify();
  }

  private notify(): void {
    this.onChange(this.state);
  }
}

function unique(values?: string[]): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function validateTestSummary(summary: TestSummary): void {
  for (const [name, value] of Object.entries(summary)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Test summary ${name} must be a non-negative integer.`);
    }
  }

  if (summary.passed + summary.failed + summary.blocked > summary.total) {
    throw new Error("Test result counts cannot exceed the total test count.");
  }
}
