import assert from 'node:assert/strict';
import { test } from 'node:test';
import { beginPendingEncounter, combatTurn, createGame, interact, loadGame, saveGame, type GameState } from './engine';
import { acceptDiscovery, stageDiscoveries } from './discoveries';
import { defeatSnapshot, isFinalEnemyDefeat } from './encounter-transitions';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
} });
function fixed<T>(fn: () => T): T {
  const original = Math.random;
  Math.random = () => .99;
  try { return fn(); } finally { Math.random = original; }
}
function tunnel(): GameState {
  store.clear();
  return { ...createGame('Tunnel Heir'), inventory: ['rope'], roomId: 'secret-tunnel', visitedRooms: ['front-gate', 'secret-tunnel'] };
}
function bats(): GameState {
  return fixed(() => beginPendingEncounter(interact(tunnel(), 'tunnel-crack')));
}
function win(previous: GameState): GameState {
  return fixed(() => combatTurn({ ...previous, skill: 20, combat: { ...previous.combat!, enemyStamina: 1 } }, 'attack'));
}

test('narrow crack introduces its guard without granting or completing the fragment', () => {
  const previous = tunnel();
  const intro = fixed(() => interact(previous, 'tunnel-crack'));
  assert.equal(intro.phase, 'playing');
  assert.equal(intro.pendingEncounter?.stage, 'intro');
  assert.ok(intro.lastEvent?.message.includes('The sound of wings fills the air.'));
  assert.ok(!intro.clues.includes('narrow-way'));
  assert.ok(!intro.discoveries.includes('tunnel-crack'));
  assert.deepEqual([intro.score, intro.skill, intro.stamina, intro.luck, intro.fear],
    [previous.score, previous.skill, previous.stamina, previous.luck, previous.fear]);
  const combat = beginPendingEncounter(intro);
  assert.equal(combat.phase, 'combat');
  assert.equal(combat.combat?.monsterId, 'bat-swarm');
  assert.equal(combat.combat?.enemySkill, 6);
  assert.equal(combat.combat?.enemyStamina, 9);
  assert.equal(combat.pendingEncounter?.stage, 'combat');
});
test('the original Rope requirement remains in force before the introduction', () => {
  const locked = interact({ ...tunnel(), inventory: [] }, 'tunnel-crack');
  assert.equal(locked.pendingEncounter, undefined);
  assert.ok(locked.lastEvent?.message.includes('Rope'));
  assert.ok(!locked.clues.includes('narrow-way'));
});

test('guard introduction and combat survive save/load without granting a fragment', () => {
  const intro = fixed(() => interact(tunnel(), 'tunnel-crack'));
  const staged = stageDiscoveries(tunnel(), intro, { kind: 'encounter', title: 'BEYOND THE NARROW CRACK', story: intro.lastEvent!.message });
  saveGame(staged);
  assert.equal(loadGame()?.pendingDiscovery?.kind, 'encounter');
  const combat = beginPendingEncounter(loadGame()!);
  saveGame(combat);
  const loaded = loadGame()!;
  assert.equal(loaded.combat?.monsterId, 'bat-swarm');
  assert.equal(loaded.pendingEncounter?.stage, 'combat');
  assert.ok(!loaded.clues.includes('narrow-way'));
});

test('victory awards the original Narrow Way outcome and the existing score exactly once', () => {
  const previous = bats();
  const next = win(previous);
  assert.equal(next.phase, 'playing');
  assert.ok(next.defeatedMonsters.includes('bat-swarm'));
  assert.ok(next.clues.includes('narrow-way'));
  assert.ok(next.discoveries.includes('tunnel-crack'));
  assert.equal(next.pendingEncounter, undefined);
  assert.equal(next.score - previous.score, 100);
  assert.equal(next.lastEvent?.message, 'The passage opens into a chamber that has no door above.');
  const staged = stageDiscoveries(previous, next, {
    kind: 'fragment', clueId: 'narrow-way', title: 'FAMILY FRAGMENT DISCOVERED', story: next.lastEvent!.message,
  });
  assert.ok(!staged.clues.includes('narrow-way'));
  saveGame(staged);
  const claimed = acceptDiscovery(loadGame()!);
  assert.ok(claimed.clues.includes('narrow-way'));
  assert.equal(acceptDiscovery(claimed).score, claimed.score);
  const revisit = interact(claimed, 'tunnel-crack');
  assert.equal(revisit.phase, 'playing');
  assert.equal(revisit.score, claimed.score);
});

test('fleeing grants no fragment and leaves the guard encounter retryable', () => {
  const previous = bats();
  const escaped = fixed(() => combatTurn(previous, 'flee'));
  assert.equal(escaped.phase, 'playing');
  assert.ok(!escaped.clues.includes('narrow-way'));
  assert.ok(!escaped.discoveries.includes('tunnel-crack'));
  const retry = fixed(() => interact(escaped, 'tunnel-crack'));
  assert.equal(retry.pendingEncounter?.stage, 'intro');
  assert.equal(beginPendingEncounter(retry).combat?.monsterId, 'bat-swarm');
});

test('dying against the guard does not award its fragment', () => {
  const previous = bats();
  const dead = fixed(() => combatTurn({ ...previous, skill: 0, stamina: 1 }, 'attack'));
  assert.equal(dead.phase, 'dead');
  assert.ok(!dead.clues.includes('narrow-way'));
  assert.ok(!dead.discoveries.includes('tunnel-crack'));
  assert.equal(isFinalEnemyDefeat(previous, dead), false);
});

test('older saves with the completed narrow crack do not receive a retroactive fight', () => {
  const old = { ...tunnel(), discoveries: ['tunnel-crack'], clues: ['narrow-way'] };
  const result = interact(old, 'tunnel-crack');
  assert.equal(result.phase, 'playing');
  assert.equal(result.pendingEncounter, undefined);
});

test('defeat snapshots keep the same portrait at zero HP without mutating or crediting again', () => {
  const previous = bats();
  const result = win(previous);
  assert.equal(isFinalEnemyDefeat(previous, result), true);
  const snapshot = defeatSnapshot(previous, result);
  assert.equal(snapshot.phase, 'combat');
  assert.equal(snapshot.combat?.monsterId, 'bat-swarm');
  assert.equal(snapshot.combat?.enemyStamina, 0);
  assert.equal(previous.combat?.enemyStamina, 9);
  assert.equal(snapshot.score, previous.score);
  assert.ok(!snapshot.clues.includes('narrow-way'));
});

test('only final Lord Blackthorn defeat qualifies, never his human transformation', () => {
  const human: GameState = { ...tunnel(), phase: 'combat', inventory: ['blackthorn-dagger'], skill: 20,
    combat: { monsterId: 'lord-blackthorn', enemyStamina: 1, enemyMaxStamina: 6, enemySkill: 7,
      enemyPhase: 'human', round: 0, log: [], luckyEdge: false } };
  const transformed = fixed(() => combatTurn(human, 'item', 'blackthorn-dagger'));
  assert.equal(transformed.combat?.enemyPhase, 'demon');
  assert.equal(isFinalEnemyDefeat(human, transformed), false);
  const demon = { ...transformed, combat: { ...transformed.combat!, enemyStamina: 1 } };
  const ending = fixed(() => combatTurn(demon, 'item', 'blackthorn-dagger'));
  assert.equal(ending.phase, 'ending');
  assert.equal(isFinalEnemyDefeat(demon, ending), true);
});
