import { strict as assert } from "node:assert";
import { test } from "node:test";
import { combatTurn, createGame, getDisplayItem, loadGame, saveGame, startCombat, submitScore, testLuck, usePotion, type GameState } from "./engine";
import { LUCK_ENCOUNTERS, availableLuckEvents } from "./luck-events";
import { combatDialogue, weaknessBonus } from "./combat-lore";
import { acceptDiscovery, stageDiscoveries } from "./discoveries";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value),
} });
function random<T>(value: number | number[], work: () => T): T {
  const old = Math.random; let index = 0;
  Math.random = () => Array.isArray(value) ? value[index++] ?? 0.99 : value;
  try { return work(); } finally { Math.random = old; }
}
function potionState(id: string): GameState {
  return { ...createGame("Test Heir"), identifiedPotions: [], inventory: [id], itemCharges: { [id]: 1 }, fear: 3, stamina: 20 };
}
test("fixed potions identify on first use, apply exact effects, and cannot repeat", () => {
  for (const [id, field, delta] of [["clear-potion", "fear", -1], ["blue-potion", "skill", 1], ["green-potion", "stamina", 1]] as const) {
    const state = potionState(id);
    assert.ok(getDisplayItem(state, id)!.name.endsWith("Potion"));
    const next = usePotion(state, id);
    assert.equal(next[field], state[field] + delta);
    assert.equal(next.itemCharges[id], 0);
    assert.equal(next.identifiedPotions.includes(id), true);
    assert.notEqual(getDisplayItem(next, id)!.name, getDisplayItem(state, id)!.name);
    assert.equal(usePotion(next, id)[field], next[field]);
  }
});
test("all eight Chaos effects are possible and reported accurately", () => {
  const effects = [["stamina", 2], ["skill", 2], ["luck", 1], ["fear", -1], ["stamina", -1], ["skill", -1], ["luck", -1], ["fear", 1]] as const;
  effects.forEach(([field, delta], index) => {
    const state = potionState("purple-potion");
    const next = random((index + 0.1) / 8, () => usePotion(state, "purple-potion"));
    assert.equal(next[field], state[field] + delta);
    assert.equal(next.identifiedPotions.includes("purple-potion"), true);
  });
});
test("identification survives save/load, leaderboard submission and new histories", () => {
  store.clear();
  const state = usePotion(potionState("blue-potion"), "blue-potion");
  assert.equal(saveGame(state), true);
  assert.ok(loadGame()!.identifiedPotions.includes("blue-potion"));
  submitScore(state, "bad");
  assert.ok(createGame("Another Heir").identifiedPotions.includes("blue-potion"));
});
test("Chaos can cause death by fear or stamina without forgetting its identity", () => {
  const fear = random(0.99, () => usePotion({ ...potionState("purple-potion"), fear: 9 }, "purple-potion"));
  assert.equal(fear.phase, "dead"); assert.equal(fear.fear, 10);
  const stamina = random(4.1 / 8, () => usePotion({ ...potionState("purple-potion"), stamina: 1 }, "purple-potion"));
  assert.equal(stamina.phase, "dead"); assert.equal(stamina.stamina, 0);
  assert.ok(stamina.identifiedPotions.includes("purple-potion"));
});
test("Luck outcomes remain room-specific, one-time and save-compatible", () => {
  for (const event of LUCK_ENCOUNTERS) {
    assert.ok(availableLuckEvents(event.room, [], [], []).includes(event));
    assert.ok(!availableLuckEvents(event.room, [event.id], [], []).includes(event));
  }
  const before = { ...createGame("Test Heir"), roomId: "library", pendingLuck: { id: "library-latch", title: "", story: "" } };
  const won = random(0, () => testLuck(before));
  assert.ok(won.clues.includes("hollow-library-wall")); assert.equal(won.score, before.score + 26);
  const staged = stageDiscoveries(before, won, { kind: "fragment", clueId: "hollow-library-wall", title: "", story: "" });
  assert.equal(staged.clues.includes("hollow-library-wall"), false);
  assert.ok(acceptDiscovery(staged).clues.includes("hollow-library-wall"));
  assert.equal(saveGame(won), true); assert.ok(loadGame()!.luckEventsSeen.includes("library-latch"));
});
test("chandelier and boulder failures hurt; high Fear strengthens hazards", () => {
  for (const [roomId, id] of [["dining-room", "dining-chain"], ["secret-tunnel", "tunnel-boulder"]]) {
    const state = { ...createGame("Test Heir"), roomId, pendingLuck: { id: id!, title: "", story: "" } };
    const next = random(0.99, () => testLuck(state));
    assert.equal(next.stamina, 23); assert.equal(next.fear, 1);
    const tense = random(0.99, () => testLuck({ ...state, fear: 7 }));
    assert.equal(tense.stamina, 22); assert.equal(tense.fear, 9);
  }
});
test("enemy dialogue thresholds fire once and human/demon thresholds stay distinct", () => {
  const initial = startCombat(createGame("Test Heir"), "butler");
  assert.equal(initial.combat!.dialogue, "You should have left when the gate was still open.");
  let next = random(0.99, () => combatTurn({ ...initial, combat: { ...initial.combat!, enemyStamina: 6 } }, "attack"));
  assert.equal(next.combat!.dialogue, "You have persisted longer than most.");
  assert.ok(next.combat!.pauseReason);
  next = random(0.99, () => combatTurn(next, "attack"));
  assert.equal(next.combat!.dialogue, "The Master must not wake.");
  assert.deepEqual(next.combat!.dialogueMilestones, ["human:half", "human:quarter"]);
  next = random(0.99, () => combatTurn(next, "attack"));
  assert.ok(next.lastCombatDialogue?.includes("I have failed this house."));
});
test("item weaknesses add exactly one damage and matchbox use consumes a match", () => {
  assert.equal(weaknessBonus("shadow-hound", "lantern"), 1);
  for (const id of ["lantern", "matchbox"]) assert.equal(weaknessBonus("bat-swarm", id), 1);
  const state = startCombat({ ...createGame("Test Heir"), inventory: ["rusty-revolver"] }, "butler");
  const next = random(0.99, () => combatTurn(state, "item", "rusty-revolver"));
  assert.equal(next.combat!.enemyStamina, state.combat!.enemyStamina - 7);
  const bats = startCombat({ ...createGame("Test Heir"), inventory: ["matchbox"] }, "bat-swarm");
  const burned = random(0.99, () => combatTurn(bats, "item", "matchbox"));
  assert.equal(burned.itemCharges.matchbox, 6);
});
test("passive dodge avoids damage without spending Luck or extra clicks", () => {
  const state = startCombat(createGame("Test Heir"), "butler");
  const next = random([0, 0, 0.99, 0.99, 0.99, 0, 0, 0], () => combatTurn(state, "attack"));
  assert.equal(next.stamina, state.stamina);
  assert.equal(next.luck, state.luck);
  assert.ok(next.lastLuck?.message.includes("DODGE"));
  assert.equal(next.combat!.outcome!.heading, "LUCKY DODGE");
});
test("boss phases, item weaknesses and endings remain intact", () => {
  const state = startCombat({ ...createGame("Test Heir"), inventory: ["blackthorn-dagger", "clear-potion", "ancient-diary", "family-seal-ring", "red-gem"], itemCharges: { "clear-potion": 1 }, fear: 2 }, "lord-blackthorn");
  const holy = combatTurn(state, "item", "clear-potion");
  assert.equal(holy.combat!.enemyStamina, 5); assert.equal(holy.fear, 1);
  const demon = random(0.99, () => combatTurn(holy, "item", "blackthorn-dagger"));
  assert.equal(demon.combat!.enemyPhase, "demon"); assert.equal(demon.combat!.enemyMaxStamina, 10);
  assert.ok(demon.combat!.dialogue?.includes("You would destroy everything to save yourself."));
  let ending = random(0.99, () => combatTurn(demon, "item", "blackthorn-dagger"));
  ending = random(0.99, () => combatTurn(ending, "item", "blackthorn-dagger"));
  assert.equal(ending.ending, "true"); assert.ok(ending.lastCombatDialogue?.includes("The house remembers."));
  assert.ok(!combatDialogue("shadow-hound", "human", "start").includes('"'));
});
test("a fatal victory still preserves the enemy's final words before death", () => {
  const state = startCombat({ ...createGame("Test Heir"), inventory: ["blackthorn-dagger"], fear: 9 }, "hanging-lady");
  const next = random(0.99, () => combatTurn({ ...state, combat: { ...state.combat!, enemyStamina: 2 } }, "item", "blackthorn-dagger"));
  assert.equal(next.phase, "dead");
  assert.ok(next.lastEvent?.message.includes("Thank... you."));
});
test("preparing a potion does not count as the first combat attack", () => {
  const state = startCombat(potionState("blue-potion"), "butler");
  const next = combatTurn(state, "item", "blue-potion");
  assert.equal(next.combat!.round, 0);
  assert.equal(next.combat!.enemyStamina, state.combat!.enemyStamina);
  assert.equal(next.skill, state.skill + 1);
});
test("confusion reports the effective roll and pauses the exchange", () => {
  const state = startCombat(createGame("Test Heir"), "butler");
  const next = random([0.99, 0.99, 0.99, 0.99, 0, 0.99], () => combatTurn(state, "attack"));
  assert.equal(next.combat!.lastPlayerRoll, 17);
  assert.equal(next.combat!.outcome!.playerDamage, 2);
  assert.ok(next.combat!.pauseReason);
  assert.ok(next.combat!.log.some(line => line.includes("Confusion")));
});
