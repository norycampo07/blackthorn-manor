import { strict as assert } from "node:assert";
import { test } from "node:test";
import { acceptDiscovery, stageDiscoveries } from "./discoveries";
import { createGame, loadGame, saveGame, type PendingDiscovery } from "./engine";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  },
});

test("item confirmation claims the item and score only once, including reload", () => {
  const previous = createGame("Test Heir");
  const next = { ...previous, inventory: ["matchbox"], score: previous.score + 100 };
  const staged = stageDiscoveries(previous, next, { kind: "item", title: "ITEM FOUND", story: "A child's drawing.", itemId: "matchbox" });
  assert.deepEqual(staged.inventory, []);
  assert.equal(staged.score, previous.score);
  assert.equal(saveGame(staged), true);
  const accepted = acceptDiscovery(loadGame()!);
  assert.deepEqual(accepted.inventory, ["matchbox"]);
  assert.equal(accepted.itemCharges.matchbox, 7);
  assert.equal(accepted.score, next.score);
  assert.equal(accepted.pendingDiscovery, undefined);
  assert.deepEqual(acceptDiscovery(accepted), accepted);
});

test("multi-reward discoveries claim each item and fragment in order", () => {
  const previous = createGame("Test Heir");
  const next = { ...previous, inventory: ["rope", "blackthorn-dagger"], clues: ["tunnel-map"], score: previous.score + 250 };
  const dialog: PendingDiscovery = {
    kind: "item", title: "ITEM FOUND", itemId: "rope", story: "Beneath the roots.",
    following: [
      { kind: "item", title: "ITEM FOUND", itemId: "blackthorn-dagger", story: "A sleeping blade." },
      { kind: "fragment", title: "FRAGMENT", clueId: "tunnel-map", story: "A scratched map." },
    ],
  };
  const staged = stageDiscoveries(previous, next, dialog);
  assert.deepEqual(staged.inventory, []);
  assert.deepEqual(staged.clues, []);
  assert.equal(staged.score, previous.score);
  const rope = acceptDiscovery(staged);
  assert.deepEqual(rope.inventory, ["rope"]);
  assert.equal(rope.score, previous.score + 100);
  const dagger = acceptDiscovery(rope);
  assert.deepEqual(dagger.inventory, ["rope", "blackthorn-dagger"]);
  assert.equal(dagger.score, next.score);
  const fragment = acceptDiscovery(dagger);
  assert.deepEqual(fragment.clues, ["tunnel-map"]);
  assert.equal(fragment.pendingDiscovery, undefined);
  assert.equal(fragment.score, next.score);
});

test("already-awarded legacy pending discoveries never duplicate score", () => {
  const state = {
    ...createGame("Returning Heir"), inventory: ["matchbox"], score: 125,
    pendingDiscovery: { kind: "item" as const, title: "ITEM FOUND", itemId: "matchbox", story: "A child's drawing." },
  };
  const accepted = acceptDiscovery(state);
  assert.equal(accepted.score, 125);
  assert.deepEqual(accepted.inventory, ["matchbox"]);
});
