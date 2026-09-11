import { promises as fs } from "node:fs";
import path from "node:path";
import {
  isDeliveryState,
  normalizeJiraKey,
  type DeliveryState
} from "../models/delivery";

export interface DeliveryStateStore {
  load(jiraKey: string): Promise<DeliveryState | undefined>;
  loadLatest(): Promise<DeliveryState | undefined>;
  save(state: DeliveryState): Promise<void>;
}

export class FileDeliveryStateStore implements DeliveryStateStore {
  private readonly directory: string;

  public constructor(workspace: string) {
    if (!path.isAbsolute(workspace)) {
      throw new Error("Delivery state workspace must be an absolute path.");
    }
    this.directory = path.join(workspace, ".delivery");
  }

  public async load(jiraKey: string): Promise<DeliveryState | undefined> {
    const normalizedKey = normalizeJiraKey(jiraKey);
    if (!normalizedKey) {
      throw new Error("A Jira key is required.");
    }

    const file = path.join(this.directory, `${normalizedKey}.json`);
    let content: string;
    try {
      content = await fs.readFile(file, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }

    const parsed: unknown = JSON.parse(content.replace(/^\uFEFF/, ""));
    if (!isDeliveryState(parsed)) {
      throw new Error(`Invalid delivery state file: ${file}`);
    }
    return parsed;
  }

  public async loadLatest(): Promise<DeliveryState | undefined> {
    let files: string[];
    try {
      files = (await fs.readdir(this.directory)).filter((file) =>
        /^[A-Z][A-Z0-9_]*-\d+\.json$/.test(file)
      );
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }

    const candidates = await Promise.all(
      files.map(async (file) => ({
        file,
        modified: (await fs.stat(path.join(this.directory, file))).mtimeMs
      }))
    );
    candidates.sort((left, right) => right.modified - left.modified);

    return candidates.length
      ? this.load(path.basename(candidates[0].file, ".json"))
      : undefined;
  }

  public async save(state: DeliveryState): Promise<void> {
    if (!isDeliveryState(state)) {
      throw new Error("Cannot persist invalid delivery state.");
    }

    await fs.mkdir(this.directory, { recursive: true });
    const target = path.join(this.directory, `${state.jiraKey}.json`);
    const temporary = `${target}.${process.pid}.tmp`;
    const content = `${JSON.stringify(state, null, 2)}\n`;

    await fs.writeFile(temporary, content, "utf8");
    await fs.rename(temporary, target);
  }
}

export class MemoryDeliveryStateStore implements DeliveryStateStore {
  private readonly states = new Map<string, DeliveryState>();

  public async load(jiraKey: string): Promise<DeliveryState | undefined> {
    return this.states.get(jiraKey);
  }

  public async loadLatest(): Promise<DeliveryState | undefined> {
    return [...this.states.values()].at(-1);
  }

  public async save(state: DeliveryState): Promise<void> {
    this.states.delete(state.jiraKey);
    this.states.set(state.jiraKey, structuredClone(state));
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
