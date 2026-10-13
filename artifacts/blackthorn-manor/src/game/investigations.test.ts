import assert from "node:assert/strict";
import test from "node:test";
import { createGame, getRoom, interact, loadGame, saveGame } from "./engine";
import { INVESTIGATIONS, hotspotAvailable, investigate, investigationsForRoom } from "./investigations";
import { acceptDiscovery } from "./discoveries";

function acceptAll(state: ReturnType<typeof createGame>) {
  while (state.pendingDiscovery) state = acceptDiscovery(state);
  return state;
}

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

test("only the Library receives the desk and bookshelf actions", () => {
  assert.equal(investigationsForRoom("library")[0].actionLabel, "Inspect the desk");
  assert.deepEqual(getRoom("library")!.choices.map(choice => choice.label), [
    "Inspect the desk", "Inspect the wall behind the atlas", "Browse the bookshelves",
  ]);
  assert.deepEqual(investigationsForRoom("kitchen"), []);
  assert.equal(investigationsForRoom("library").length, 2);
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
test("key is queued and only collected and scored on acceptance, including when acquired elsewhere", () => {
  const before = library();
  const found = investigate(before, scene.id, "key");
  assert.equal(found.inventory.includes("brass-key"), false);
  assert.equal(found.score, before.score);
  assert.equal(found.pendingDiscovery?.kind, "item");
  const after = acceptDiscovery(found);
  assert.equal(after.score, before.score + 100);
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
  const pending = loadGame()!;
  assert.equal(pending.inventory.includes("ancient-diary"), false);
  assert.equal(pending.clues.includes("family-fragment-i"), false);
  assert.equal(pending.journalEntries?.["library-desk:compartment"], undefined);
  assert.equal(pending.pendingDiscovery?.investigationId, scene.id);
  const taken = acceptDiscovery(pending);
  assert.ok(taken.inventory.includes("ancient-diary"));
  assert.equal(taken.clues.includes("family-fragment-i"), false);
  assert.equal(taken.pendingDiscovery?.kind, "fragment");
  assert.equal(saveGame(taken), true);
  const restored = acceptDiscovery(loadGame()!);
  assert.equal(restored.journalEntries?.["library-desk:compartment"].title, "Family Fragment I");
  assert.equal(restored.journalEntries?.["library-desk:compartment"].category, "Family Fragments");
  assert.ok(restored.clues.includes("family-fragment-i"));
  assert.ok(restored.inventory.includes("ancient-diary"));
  assert.ok(restored.discoveries.includes("library-diary"));
  assert.equal(investigate(restored, scene.id, "compartment"), restored);
});
test("the complete desk loop preserves gameplay stats, room, inventory ownership and journal on refresh", () => {
  const before = library();
  let state = before;
  for (const hotspot of scene.hotspots) state = acceptAll(investigate(state, scene.id, hotspot.id));
  assert.equal(saveGame(state), true);
  const restored = loadGame()!;
  assert.deepEqual(restored.investigationProgress?.[scene.id], scene.hotspots.map(hotspot => hotspot.id));
  assert.equal(Object.keys(restored.journalEntries ?? {}).length, 4);
  assert.ok(restored.inventory.includes("brass-key"));
  assert.equal(restored.score, before.score + 200);
  for (const field of ["roomId", "phase", "fear", "skill", "stamina", "luck", "visitedRooms"] as const) {
    assert.deepEqual(restored[field], before[field]);
  }
});
test("desk choice never grants the diary instantly, while the revealed compartment preserves its reward", () => {
  const state = library();
  const instant = interact(state, "library-diary");
  assert.equal(instant.inventory.includes("ancient-diary"), false);
  assert.equal(instant.discoveries.includes("library-diary"), false);
  const found = investigate(investigate(state, scene.id, "drawer"), scene.id, "compartment");
  assert.equal(found.inventory.includes("ancient-diary"), false);
  const opened = acceptAll(found);
  assert.equal(opened.inventory.filter(id => id === "ancient-diary").length, 1);
  assert.equal(opened.score, state.score + 100);
  assert.equal(investigate(opened, scene.id, "compartment"), opened);
});
test("old diary owners can investigate without duplicate diary or secret-item points", () => {
  const state = { ...library(), inventory: ["ancient-diary"], discoveries: ["library-diary"] };
  const found = investigate(investigate(state, scene.id, "drawer"), scene.id, "compartment");
  assert.equal(found.pendingDiscovery?.kind, "fragment");
  const opened = acceptAll(found);
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

test("pending rewards block other hotspots without overwriting the acceptance queue", () => {
  const found = investigate(library(), scene.id, "key");
  assert.equal(investigate(found, scene.id, "ledger"), found);
  assert.equal(investigate(found, scene.id, "key"), found);
  const taken = acceptAll(found);
  assert.ok(investigate(taken, scene.id, "ledger").journalEntries?.["library-desk:ledger"]);
});

test("legacy Lore Fragments migrate to Family Fragments once without losing rewards or score", () => {
  const state = acceptAll(investigate(investigate(library(), scene.id, "drawer"), scene.id, "compartment"));
  const old = JSON.parse(JSON.stringify(state));
  old.clues = [];
  old.journalEntries["library-desk:compartment"].category = "Lore Fragments";
  assert.equal(saveGame(old), true);
  const restored = loadGame()!;
  assert.deepEqual(restored.clues, ["family-fragment-i"]);
  assert.equal(restored.journalEntries?.["library-desk:compartment"].category, "Family Fragments");
  assert.equal(restored.score, state.score);
  assert.deepEqual(restored.inventory, state.inventory);
  assert.equal(saveGame(restored), true);
  assert.deepEqual(loadGame()!.clues, ["family-fragment-i"]);
});

const bookshelf = INVESTIGATIONS.find(entry => entry.id === "library-bookshelf")!;

test("bookshelf notes persist separately from desk evidence with distinct titles", () => {
  let state = investigate(library(), scene.id, "letter");
  for (const id of ["genealogy", "missing-volume", "correspondence"]) {
    state = investigate(state, bookshelf.id, id);
  }
  assert.equal(state.journalEntries?.["library-desk:letter"].title, "Letter to a Brother");
  assert.equal(state.journalEntries?.["library-bookshelf:correspondence"].title, "Sealed Correspondence");
  assert.equal(new Set(Object.values(state.journalEntries!).map(entry => entry.title)).size, 4);
  assert.equal(state.pendingDiscovery, undefined);
  saveGame(state);
  assert.deepEqual(loadGame()!.journalEntries, state.journalEntries);
});

test("Burned Journal uses the shared acceptance queue and cannot duplicate on revisit or reload", () => {
  const before = library();
  const found = investigate(before, bookshelf.id, "burned-journal");
  assert.equal(found.pendingDiscovery?.kind, "fragment");
  assert.equal(found.clues.includes("burned-journal"), false);
  assert.equal(found.journalEntries?.["library-bookshelf:burned-journal"], undefined);
  saveGame(found);
  const accepted = acceptDiscovery(loadGame()!);
  assert.ok(accepted.clues.includes("burned-journal"));
  assert.equal(accepted.journalEntries?.["library-bookshelf:burned-journal"].category, "Family Fragments");
  assert.equal(accepted.journalEntries?.["library-bookshelf:burned-journal"].title, "Burned Journal");
  assert.equal(accepted.score, before.score);
  assert.equal(investigate(accepted, bookshelf.id, "burned-journal"), accepted);
  saveGame(accepted);
  assert.equal(loadGame()!.clues.filter(id => id === "burned-journal").length, 1);
});

test("Distant Note is a saved discovery, not a path unlock, note, item or fragment", () => {
  const before = library();
  const found = investigate(before, bookshelf.id, "lever");
  assert.equal(found.pendingDiscovery?.kind, "discovery");
  assert.equal(found.pendingDiscovery?.title, "Distant Note");
  assert.equal(found.pendingDiscovery?.investigationId, bookshelf.id);
  assert.equal(found.discoveries.includes("library-distant-note"), false);
  assert.doesNotMatch(found.pendingDiscovery!.story, /Music Room|Secret Tunnel/i);
  saveGame(found);
  const accepted = acceptDiscovery(loadGame()!);
  assert.ok(accepted.discoveries.includes("library-distant-note"));
  for (const field of ["unlockedRooms", "inventory", "clues", "score", "roomId", "fear", "luck"] as const) {
    assert.deepEqual(accepted[field], before[field]);
  }
  assert.deepEqual(accepted.journalEntries, before.journalEntries ?? {});
  assert.equal(investigate(accepted, bookshelf.id, "lever"), accepted);
  saveGame(accepted);
  assert.ok(loadGame()!.discoveries.includes("library-distant-note"));
});

test("obsolete Family Ledger fragments and pending rewards migrate away without losing desk notes or earned rewards", () => {
  const state = investigate(library(), scene.id, "ledger");
  state.clues = ["family-ledger", "family-fragment-i"];
  state.inventory = ["ancient-diary"];
  state.score = 525;
  state.journalEntries!["obsolete-ledger"] = {
    title: "Family Ledger", text: "Old fragment", category: "Family Fragments", clueId: "family-ledger",
  };
  state.journalEntries!["library-desk:letter"] = {
    title: "Sealed Correspondence", text: "Existing letter text", category: "Investigation Notes",
  };
  state.pendingDiscovery = { kind: "fragment", title: "FAMILY FRAGMENT DISCOVERED", clueId: "family-ledger", story: "Old fragment" };
  saveGame(state);
  const restored = loadGame()!;
  assert.deepEqual(restored.clues, ["family-fragment-i"]);
  assert.equal(restored.journalEntries?.["obsolete-ledger"], undefined);
  assert.equal(restored.journalEntries?.["library-desk:ledger"].title, "Family Ledger");
  assert.equal(restored.journalEntries?.["library-desk:letter"].title, "Letter to a Brother");
  assert.equal(restored.journalEntries?.["library-desk:letter"].text, "Existing letter text");
  assert.equal(restored.pendingDiscovery, undefined);
  assert.equal(restored.score, 525);
  assert.deepEqual(restored.inventory, ["ancient-diary"]);
});

test("bookshelf interactions are blocked outside the Library, in combat, or during another pending reward", () => {
  const before = library();
  const wrongRoom = { ...before, roomId: "chapel" };
  assert.equal(investigate(wrongRoom, bookshelf.id, "genealogy"), wrongRoom);
  const combat = { ...before, phase: "combat" as const };
  assert.equal(investigate(combat, bookshelf.id, "lever"), combat);
  const pending = investigate(before, bookshelf.id, "burned-journal");
  assert.equal(investigate(pending, bookshelf.id, "lever"), pending);
  assert.equal(interact(before, "library-bookshelves").pendingDiscovery, undefined);
});
