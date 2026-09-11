"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const { createDeliveryState } = require("../dist/models/delivery");
const {
  FileDeliveryStateStore
} = require("../dist/services/deliveryStateService");

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "delivery-state-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("persists delivery state in a story-specific workspace file", async () => {
  const workspace = temporaryDirectory();
  const store = new FileDeliveryStateStore(workspace);
  const state = createDeliveryState("sf-125", "dev-sandbox", false);
  state.status = "IMPLEMENTED";
  state.branch = "feature/SF-125";
  state.implementation = { status: "SUCCESS", components: 6 };

  await store.save(state);
  state.implementation.components = 7;
  await store.save(state);

  const file = path.join(workspace, ".delivery", "SF-125.json");
  assert.ok(fs.existsSync(file));
  assert.deepEqual(await store.load("SF-125"), state);
});

test("restores the most recently updated story", async () => {
  const workspace = temporaryDirectory();
  const store = new FileDeliveryStateStore(workspace);
  const first = createDeliveryState("SF-124");
  const second = createDeliveryState("SF-125");

  await store.save(first);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await store.save(second);

  assert.equal((await store.loadLatest()).jiraKey, "SF-125");
});

test("rejects malformed persisted state", async () => {
  const workspace = temporaryDirectory();
  const directory = path.join(workspace, ".delivery");
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "SF-125.json"), '{"jiraKey":"SF-125"}');

  const store = new FileDeliveryStateStore(workspace);
  await assert.rejects(store.load("SF-125"), /Invalid delivery state file/);
});
