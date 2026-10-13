import assert from "node:assert/strict";
import test from "node:test";
import { createGame, getRoom, interact, loadGame, saveGame, type GameState } from "./engine";
import { acceptDiscovery, stageDiscoveries } from "./discoveries";
import { INVESTIGATIONS, investigate, hotspotAvailable, type InvestigationScene } from "./investigations";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  },
});
function at(roomId: string, inventory: string[] = []): GameState {
  store.clear();
  return { ...createGame("Relic Investigator"), roomId, inventory };
}
const scene = (id: string): InvestigationScene => INVESTIGATIONS.find(entry => entry.id === id)!;
function restore(state: GameState): GameState { assert.ok(saveGame(state)); return loadGame()!; }
function noChance<T>(run: () => T): T {
  const random = Math.random;
  Math.random = () => 0.99;
  try { return run(); } finally { Math.random = random; }
}

test("all three relic actions replace existing choices without new menus or instant rewards", () => {
  for (const [id, room, inventory] of [
    ["nursery-wooden-horse", "nursery", []],
    ["master-bedroom-wardrobe", "master-bedroom", ["brass-key"]],
    ["cellar-shrine", "cellar", ["lantern"]],
  ] as const) {
    const entry = scene(id);
    assert.equal(getRoom(room)!.choices.length, 3);
    assert.ok(getRoom(room)!.choices.some(choice => choice.id === entry.replaceChoiceId));
    const before = at(room, [...inventory]);
    const next = interact(before, entry.replaceChoiceId!);
    assert.deepEqual(next.inventory, before.inventory);
    assert.equal(next.discoveries.includes(entry.replaceChoiceId!), false);
  }
});

test("horse hatch and bundle appear in order; accepting the Gem completes without optional evidence", () => {
  const entry = scene("nursery-wooden-horse");
  let state = at("nursery");
  const hatch = entry.hotspots.find(h => h.id === "hatch")!;
  const heart = entry.hotspots.find(h => h.id === "heart")!;
  assert.equal(hotspotAvailable(state, entry, hatch), false);
  assert.equal(investigate(state, entry.id, "heart"), state);
  state = restore(investigate(state, entry.id, "underside"));
  assert.ok(hotspotAvailable(state, entry, hatch));
  assert.equal(hotspotAvailable(state, entry, heart), false);
  state = restore(investigate(state, entry.id, "hatch"));
  state = restore(investigate(state, entry.id, "heart"));
  assert.equal(state.inventory.includes("red-gem"), false);
  assert.equal(state.discoveries.includes("nursery-horse"), false);
  state = acceptDiscovery(state);
  assert.ok(state.inventory.includes("red-gem"));
  assert.ok(state.discoveries.includes("nursery-horse"));
  assert.equal(state.score, 125);
  assert.equal(state.journalEntries && Object.keys(state.journalEntries).length, 0);
  const saved = restore(state);
  assert.equal(investigate(saved, entry.id, "heart"), saved);
  assert.ok(investigate(saved, entry.id, "nameplate").journalEntries?.[`${entry.id}:nameplate`]);
});

test("wardrobe retains the Brass Key lock; only accepting the Ring completes it", () => {
  const entry = scene("master-bedroom-wardrobe");
  const locked = at("master-bedroom");
  assert.equal(investigate(locked, entry.id, "pocket"), locked);
  assert.ok(interact(locked, "bedroom-wardrobe").knownLockedChoices?.includes("bedroom-wardrobe"));
  const before = at("master-bedroom", ["brass-key"]);
  const note = investigate(before, entry.id, "case");
  assert.equal(note.discoveries.includes("bedroom-wardrobe"), false);
  const found = restore(investigate(note, entry.id, "pocket"));
  assert.equal(found.inventory.includes("family-seal-ring"), false);
  assert.equal(found.discoveries.includes("bedroom-wardrobe"), false);
  const taken = acceptDiscovery(found);
  assert.ok(taken.inventory.includes("family-seal-ring"));
  assert.ok(taken.discoveries.includes("bedroom-wardrobe"));
  assert.ok(taken.usedItems.includes("brass-key"));
  assert.equal(taken.inventory.includes("brass-key"), true);
  assert.equal(investigate(taken, entry.id, "pocket"), taken);
});

test("shrine preserves Lantern lock and enforces root before iron; optional fragment does not complete", () => {
  const entry = scene("cellar-shrine");
  let state = at("cellar");
  assert.equal(investigate(state, entry.id, "offering"), state);
  assert.ok(interact(state, "cellar-stairs").knownLockedChoices?.includes("cellar-stairs"));
  state = at("cellar", ["lantern"]);
  assert.equal(investigate(state, entry.id, "restraints"), state);
  assert.equal(investigate(state, entry.id, "blade"), state);
  state = acceptDiscovery(investigate(state, entry.id, "stone"));
  assert.ok(state.clues.includes("oath-under-stone"));
  assert.equal(state.discoveries.includes("cellar-stairs"), false);
  state = restore(investigate(state, entry.id, "offering"));
  state = restore(investigate(state, entry.id, "restraints"));
  state = restore(investigate(state, entry.id, "blade"));
  assert.equal(state.inventory.includes("blackthorn-dagger"), false);
  assert.equal(state.discoveries.includes("cellar-stairs"), false);
  const taken = restore(acceptDiscovery(state));
  assert.ok(taken.inventory.includes("blackthorn-dagger"));
  assert.ok(taken.discoveries.includes("cellar-stairs"));
  assert.equal(taken.score, 175);
  assert.equal(taken.stamina, 25);
  assert.deepEqual(taken.inventory, ["lantern", "blackthorn-dagger"]);
  assert.equal(investigate(taken, entry.id, "blade"), taken);
  assert.ok(investigate(taken, entry.id, "crest").journalEntries?.[`${entry.id}:crest`]);
});

test("Distant Note, not Burned Journal or reading all notes, completes the bookshelves on acceptance", () => {
  const entry = scene("library-bookshelf");
  let state = at("library");
  for (const id of ["genealogy", "missing-volume", "correspondence", "burned-journal"]) {
    state = investigate(state, entry.id, id);
    if (state.pendingDiscovery) state = acceptDiscovery(state);
  }
  assert.equal(state.discoveries.includes("library-bookshelves"), false);
  state = restore(investigate(state, entry.id, "lever"));
  assert.equal(state.discoveries.includes("library-bookshelves"), false);
  state = restore(acceptDiscovery(state));
  assert.ok(state.discoveries.includes("library-bookshelves"));
  assert.ok(state.discoveries.includes("library-distant-note"));
  assert.deepEqual(state.clues, ["burned-journal"]);
  assert.deepEqual(state.inventory, []);
});

test("Diary acceptance completes the desk before its optional Family Fragment acceptance", () => {
  const entry = scene("library-desk");
  let state = investigate(at("library"), entry.id, "drawer");
  state = restore(investigate(state, entry.id, "compartment"));
  assert.equal(state.discoveries.includes("library-diary"), false);
  state = acceptDiscovery(state);
  assert.ok(state.discoveries.includes("library-diary"));
  assert.ok(state.inventory.includes("ancient-diary"));
  assert.equal(state.clues.includes("family-fragment-i"), false);
  assert.equal(state.pendingDiscovery?.kind, "fragment");
});

test("older earned relics and accepted Distant Note align completion without new rewards", () => {
  let state = at("library", ["ancient-diary", "red-gem", "family-seal-ring", "blackthorn-dagger"]);
  state.discoveries = ["library-distant-note"];
  state = restore(state);
  for (const id of ["library-diary", "library-bookshelves", "nursery-horse", "bedroom-wardrobe", "cellar-stairs"]) assert.ok(state.discoveries.includes(id));
  assert.equal(state.score, 25);
  const oldPending = at("library");
  oldPending.discoveries = ["library-diary"];
  oldPending.pendingDiscovery = { kind: "item", itemId: "ancient-diary", title: "ITEM FOUND", story: "Old diary discovery", investigationId: "library-desk", rewardScore: 100 };
  const restored = restore(oldPending);
  assert.equal(restored.discoveries.includes("library-diary"), false);
  assert.ok(acceptDiscovery(restored).discoveries.includes("library-diary"));
});

test("ordinary item, fragment and narrative actions complete at their primary acceptance boundary", () => {
  noChance(() => {
    for (const [room, choiceId, kind, id] of [
      ["entrance-hall", "hall-drawer", "item", "matchbox"],
      ["entrance-hall", "hall-portraits", "fragment", "blackthorn-portrait"],
      ["kitchen", "kitchen-pot", "discovery", undefined],
    ] as const) {
      const before = at(room);
      const next = interact(before, choiceId);
      const staged = stageDiscoveries(before, next, { kind, title: "DISCOVERY", story: "Evidence", itemId: kind === "item" ? id : undefined, clueId: kind === "fragment" ? id : undefined });
      assert.equal(staged.discoveries.includes(choiceId), false);
      assert.ok(acceptDiscovery(restore(staged)).discoveries.includes(choiceId));
    }
  });
});

test("progression completes at unlock acceptance and encounters complete when combat begins", () => {
  noChance(() => {
    const before = at("library");
    const next = interact(before, "library-wall");
    const staged = stageDiscoveries(before, next, {
      kind: "fragment", title: "FRAGMENT", clueId: "hollow-library-wall", story: "Hollow wall",
      following: [{ kind: "fragment", title: "DISCOVERY", clueId: "secret-tunnel", story: "The passage opens." }],
    });
    const supporting = acceptDiscovery(staged);
    assert.equal(supporting.discoveries.includes("library-wall"), false);
    const unlocked = acceptDiscovery(supporting);
    assert.ok(unlocked.clues.includes("secret-tunnel"));
    assert.ok(unlocked.discoveries.includes("library-wall"));
    const dining = at("dining-room");
    const encounter = interact(dining, "dining-seat");
    assert.equal(encounter.phase, "combat");
    assert.ok(encounter.discoveries.includes("dining-seat"));
  });
});

test("all investigation journal titles are distinct and all hotspots stay inside uncropped artwork", () => {
  const titles = INVESTIGATIONS.flatMap(entry => entry.hotspots.flatMap(h => h.journal ? [h.journal.title] : []));
  assert.equal(new Set(titles).size, titles.length);
  for (const entry of INVESTIGATIONS) {
    assert.equal(entry.hotspots.filter(h => h.completesChoiceId).length, 1);
    for (const h of entry.hotspots) {
      const [x, y, w, height] = h.bounds;
      assert.ok(x >= 0 && y >= 0 && w > 0 && height > 0 && x + w <= 100 && y + height <= 100);
    }
  }
});
