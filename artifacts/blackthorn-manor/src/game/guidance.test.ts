import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createGame, startCombat, type GameState } from "./engine";
import { advanceGuidance, readGuidance, saveGuidance, type GuidanceState } from "./guidance";

const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  },
});
const fresh = (): GuidanceState => ({
  investigation: "gate", mapOpened: false, itemTaken: false,
  fragmentAdded: false, combat: "unseen",
});
const at = (state: GameState, roomId: string): GameState => ({ ...state, roomId });

test("only the opening investigation or its hall fallback can be guided", () => {
  const gate = createGame("Test Heir");
  const hall = at(gate, "entrance-hall");
  assert.equal(advanceGuidance(fresh(), gate, gate, { choiceId: "gate-footprints" }).investigation, "done");
  const fallback = advanceGuidance(fresh(), gate, hall);
  assert.equal(fallback.investigation, "hall");
  assert.equal(advanceGuidance(fallback, hall, hall, { choiceId: "hall-portraits" }).investigation, "done");
  assert.equal(advanceGuidance(fallback, hall, hall, { choiceId: "hall-drawer" }).investigation, "done");
  const ignored = advanceGuidance(fallback, hall, at(hall, "library"));
  assert.equal(ignored.investigation, "done");
  assert.equal(advanceGuidance(ignored, hall, gate).investigation, "done");
});

test("combat guidance ends after an attack or leaving the first encounter", () => {
  const gate = createGame("Test Heir");
  const fight = startCombat(gate, "butler");
  const first = advanceGuidance(fresh(), gate, fight);
  assert.equal(first.combat, "active");
  assert.equal(advanceGuidance(first, fight, fight, { combatAction: "luck" }).combat, "active");
  const attacked = advanceGuidance(first, fight, fight, { combatAction: "attack" });
  assert.equal(attacked.combat, "done");
  assert.equal(advanceGuidance(attacked, gate, fight).combat, "done");
  const fled = advanceGuidance(first, fight, gate, { combatAction: "flee" });
  assert.equal(fled.combat, "done");
  assert.equal(advanceGuidance(fled, gate, fight).combat, "done");
});

test("first-use completion survives saves and new runs", () => {
  values.clear();
  const completed: GuidanceState = {
    investigation: "done", combat: "done", mapOpened: true,
    itemTaken: true, fragmentAdded: true,
  };
  saveGuidance(completed);
  assert.deepEqual(readGuidance(createGame("Another Heir")), completed);
});

test("a saved pending item does not dismiss the Take Item cue on reload", () => {
  values.clear();
  saveGuidance(fresh());
  const pending = {
    ...createGame("Test Heir"),
    inventory: ["matchbox"],
    pendingDiscovery: { kind: "item" as const, title: "ITEM FOUND", story: "A child's drawing.", itemId: "matchbox" },
  };
  assert.equal(readGuidance(pending).itemTaken, false);
});

test("older experienced saves do not receive repeated opening or reward cues", () => {
  values.clear();
  const saved = {
    ...createGame("Returning Heir"), roomId: "library",
    visitedRooms: ["front-gate", "entrance-hall", "library"],
    inventory: ["matchbox"], clues: ["blackthorn-portrait"], defeatedMonsters: ["butler"],
  };
  const migrated = readGuidance(saved);
  assert.equal(migrated.investigation, "done");
  assert.equal(migrated.itemTaken, true);
  assert.equal(migrated.fragmentAdded, true);
  assert.equal(migrated.combat, "done");
});
