import assert from "node:assert/strict";
import test from "node:test";
import { createGame, getRoom, interact, loadGame, saveGame } from "./engine";
import { INVESTIGATIONS, hotspotAvailable, investigate, investigationsForRoom } from "./investigations";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  },
});
function library() {
  store.clear();
  return { ...createGame("Investigator"), roomId: "library" };
}
const scene = INVESTIGATIONS[0];

test("only the Library receives the desk action", () => {
  assert.equal(investigationsForRoom("library")[0].actionLabel, "Inspect the desk");
  assert.deepEqual(getRoom("library")!.choices.map(choice => choice.label), [
    "Inspect the desk", "Inspect the wall behind the atlas", "Read the family ledger",
  ]);
  assert.deepEqual(investigationsForRoom("kitchen"), []);
});
test("hidden compartment cannot be used before the drawer is inspected", () => {
  const state = library();
  const compartment = scene.hotspots.find(hotspot => hotspot.id === "compartment")!;
  assert.equal(hotspotAvailable(state, scene, compartment), false);
  assert.equal(investigate(state, scene.id, compartment.id), state);
  const inspected = investigate(state, scene.id, "drawer");
  assert.equal(hotspotAvailable(inspected, scene, compartment), true);
});
test("all lore has exact text and independent persistent discovery markers", () => {
  let state = library();
  for (const id of ["ledger", "atlas", "letter"]) state = investigate(state, scene.id, id);
  assert.deepEqual(state.investigationProgress?.[scene.id], ["ledger", "atlas", "letter"]);
  for (const hotspot of scene.hotspots.filter(entry => entry.journal && !entry.requires)) {
    assert.deepEqual(state.journalEntries?.[`${scene.id}:${hotspot.id}`], hotspot.journal);
  }
  assert.equal(investigate(state, scene.id, "ledger"), state);
});
test("key can be collected exactly once, including when acquired elsewhere", () => {
  const before = library();
  const after = investigate(before, scene.id, "key");
  assert.equal(after.inventory.filter(id => id === "brass-key").length, 1);
  assert.equal(investigate(after, scene.id, "key"), after);
  const alreadyOwned = investigate({ ...before, inventory: ["brass-key"] }, scene.id, "key");
  assert.equal(alreadyOwned.inventory.length, 1);
  assert.ok(alreadyOwned.investigationProgress?.[scene.id].includes("key"));
});
test("drawer and fragment persist through actual save/load without duplicate rewards", () => {
  let state = investigate(library(), scene.id, "drawer");
  assert.equal(saveGame(state), true);
  state = loadGame()!;
  assert.ok(hotspotAvailable(state, scene, scene.hotspots[5]));
  state = investigate(state, scene.id, "compartment");
  assert.equal(saveGame(state), true);
  const restored = loadGame()!;
  assert.equal(restored.journalEntries?.["library-desk:compartment"].title, "Family Fragment I");
  assert.equal(restored.journalEntries?.["library-desk:compartment"].category, "Lore Fragments");
  assert.ok(restored.inventory.includes("ancient-diary"));
  assert.ok(restored.discoveries.includes("library-diary"));
  assert.equal(investigate(restored, scene.id, "compartment"), restored);
});
test("the complete desk loop preserves gameplay stats, room, inventory ownership and journal on refresh", () => {
  const before = library();
  let state = before;
  for (const hotspot of scene.hotspots) state = investigate(state, scene.id, hotspot.id);
  assert.equal(saveGame(state), true);
  const restored = loadGame()!;
  assert.deepEqual(restored.investigationProgress?.[scene.id], scene.hotspots.map(hotspot => hotspot.id));
  assert.equal(Object.keys(restored.journalEntries ?? {}).length, 4);
  assert.ok(restored.inventory.includes("brass-key"));
  assert.equal(restored.score, before.score + 100);
  for (const field of ["roomId", "phase", "fear", "skill", "stamina", "luck", "visitedRooms"] as const) {
    assert.deepEqual(restored[field], before[field]);
  }
});
test("desk choice never grants the diary instantly, while the revealed compartment preserves its reward", () => {
  const state = library();
  const instant = interact(state, "library-diary");
  assert.equal(instant.inventory.includes("ancient-diary"), false);
  assert.equal(instant.discoveries.includes("library-diary"), false);
  const opened = investigate(investigate(state, scene.id, "drawer"), scene.id, "compartment");
  assert.equal(opened.inventory.filter(id => id === "ancient-diary").length, 1);
  assert.equal(opened.score, state.score + 100);
  assert.equal(investigate(opened, scene.id, "compartment"), opened);
});
test("old diary owners can investigate without duplicate diary or secret-item points", () => {
  const state = { ...library(), inventory: ["ancient-diary"], discoveries: ["library-diary"] };
  const opened = investigate(investigate(state, scene.id, "drawer"), scene.id, "compartment");
  assert.deepEqual(opened.inventory, ["ancient-diary"]);
  assert.equal(opened.score, state.score);
  assert.equal(opened.journalEntries?.["library-desk:compartment"].title, "Family Fragment I");
});
test("invalid scene/hotspot, another room and combat cannot grant investigation rewards", () => {
  const state = library();
  assert.equal(investigate(state, "unknown", "key"), state);
  assert.equal(investigate(state, scene.id, "unknown"), state);
  const otherRoom = { ...state, roomId: "kitchen" };
  assert.equal(investigate(otherRoom, scene.id, "key"), otherRoom);
  const combat = { ...state, phase: "combat" as const };
  assert.equal(investigate(combat, scene.id, "key"), combat);
});
test("old saves lacking investigation fields load safely; new runs do not inherit a previous run's items", () => {
  const old = library();
  assert.equal(saveGame(old), true);
  const restored = loadGame()!;
  assert.deepEqual(restored.investigationProgress, {});
  assert.deepEqual(restored.journalEntries, {});
  assert.equal(investigate(restored, scene.id, "ledger").journalEntries?.["library-desk:ledger"].title, "Family Ledger");
  const collected = investigate(restored, scene.id, "key");
  assert.equal(saveGame(collected), true);
  const fresh = createGame("Next Visitor");
  assert.equal(fresh.inventory.includes("brass-key"), false);
  assert.equal(fresh.investigationProgress?.[scene.id], undefined);
});
