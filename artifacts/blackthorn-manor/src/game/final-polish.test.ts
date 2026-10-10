import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combatTurn, createGame, queueLuckEncounter, testLuck, type GameState } from './engine';
import { acceptDiscovery, stageDiscoveries } from './discoveries';
import { luckResult, LUCK_FAILURE_TITLES, LUCK_SUCCESS_TITLES } from './luck-presentation';
import { buildSurvivalRecord } from './survival-record';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: () => null, setItem: () => {},
} });
function random<T>(value: number, fn: () => T): T {
  const previous = Math.random; Math.random = () => value;
  try { return fn(); } finally { Math.random = previous; }
}
function combat(id: string, hp: number, phase: 'human' | 'demon' = 'human'): GameState {
  return { ...createGame('Polish Test'), phase: 'combat', inventory: ['rusty-revolver', 'blackthorn-dagger'],
    itemCharges: { 'rusty-revolver': 1 }, combat: { monsterId: id, enemyStamina: hp, enemyMaxStamina: 10,
      enemySkill: 7, enemyPhase: phase, round: 0, luckyEdge: false, log: [], dialogueMilestones: [] } };
}
test('a fast victory exposes only defeat dialogue, never missed thresholds', () => {
  const next = random(.99, () => combatTurn(combat('butler', 4), 'item', 'rusty-revolver'));
  assert.equal(next.phase, 'playing');
  assert.equal(next.lastCombatDialogue, 'I have failed this house.');
  assert.ok(!next.lastCombatDialogue.includes('Master must not wake'));
});
test('dying human and demon forms do not queue their missed threshold dialogue', () => {
  const demon = random(.99, () => combatTurn(combat('lord-blackthorn', 2), 'item', 'blackthorn-dagger'));
  assert.equal(demon.combat?.enemyPhase, 'demon');
  assert.deepEqual(demon.combat?.dialogueMilestones, []);
  assert.equal(demon.combat?.dialogue, 'You would destroy everything to save yourself.');
  const ending = random(.99, () => combatTurn(combat('lord-blackthorn', 2, 'demon'), 'item', 'blackthorn-dagger'));
  assert.equal(ending.phase, 'ending');
  assert.equal(ending.lastCombatDialogue, 'The house remembers.');
});
test('offering a Luck encounter changes no stats before the player tests fate', () => {
  const before = { ...createGame('Polish Test'), roomId: 'tower-observatory' };
  const offered = queueLuckEncounter(before);
  assert.equal(offered.pendingLuck?.id, 'tower-star');
  assert.equal(offered.luck, before.luck);
  assert.equal(offered.score, before.score);
  assert.deepEqual(offered.luckEventsSeen, []);
});
test('Luck failure separates narrative, stamina, fear, and Luck consequences', () => {
  const before = { ...createGame('Polish Test'), roomId: 'tower-observatory', luck: 2, fear: 3,
    pendingLuck: { id: 'tower-star', title: 'Chart', story: 'A trunk shifts.' } };
  const next = random(.99, () => testLuck(before));
  const result = luckResult(before, next);
  assert.ok(LUCK_FAILURE_TITLES.includes(result.title));
  assert.ok(result.story.includes('The stair gives beneath your foot.'));
  assert.ok(!result.story.includes('STAMINA'));
  assert.deepEqual(result.effects, ['−1 STAMINA', '+1 FEAR', '−1 LUCK']);
});
test('Luck reward result precedes saved item confirmation and credits exactly once', () => {
  const before = { ...createGame('Polish Test'), roomId: 'master-bedroom', luck: 12,
    pendingLuck: { id: 'bedroom-key', title: 'Floorboard', story: 'A board moves.' } };
  const next = random(.01, () => testLuck(before));
  const result = luckResult(before, next, { kind: 'item', itemId: 'brass-key', title: 'ITEM FOUND', story: '' });
  assert.ok(LUCK_SUCCESS_TITLES.includes(result.title));
  assert.ok(result.effects?.includes('+25 HOUSE SCORE'));
  const staged = stageDiscoveries(before, next, result);
  assert.equal(staged.pendingDiscovery?.kind, 'luck-result');
  assert.ok(!staged.inventory.includes('brass-key'));
  assert.equal(staged.score - before.score, 25);
  const confirmation = acceptDiscovery(staged);
  assert.equal(confirmation.pendingDiscovery?.kind, 'item');
  const taken = acceptDiscovery(confirmation);
  assert.ok(taken.inventory.includes('brass-key'));
  assert.equal(taken.score - before.score, 125);
  assert.equal(acceptDiscovery(taken).score, taken.score);
});
test('survival records have consistent fields and accomplishment counts, without totals', () => {
  const state = { ...createGame('Long Named Heir'), phase: 'ending' as const, ending: 'true' as const,
    visitedRooms: ['front-gate', 'library', 'library'], clues: ['a', 'b'], defeatedMonsters: ['butler'], achievements: ['true-heir'] };
  const record = buildSurvivalRecord(state);
  assert.equal(record.outcome, 'True Ending');
  assert.equal(record.areasExplored, 2);
  assert.equal(record.fragmentsRecovered, 2);
  assert.equal(record.monstersDefeated, 1);
  assert.equal(record.judgment, 'Worthy');
  const dead = buildSurvivalRecord({ ...state, phase: 'dead', fear: 10 });
  assert.equal(dead.outcome, 'The Terror Becomes Unbearable');
  assert.equal(dead.judgment, 'Claimed');
});
test('death records omit final NPC words and mechanical Luck banners', () => {
  const state = { ...createGame('Polish Test'), phase: 'dead' as const,
    lastEvent: { type: 'death' as const, message: 'Your strength fails.\nThank... you.' } };
  assert.equal(buildSurvivalRecord(state).outcome, 'Your strength fails.');
  const before = { ...createGame('Polish Test'), roomId: 'tower-observatory', stamina: 1, luck: 2,
    pendingLuck: { id: 'tower-star', title: 'Chart', story: 'A trunk shifts.' } };
  const fatal = random(.99, () => testLuck(before));
  assert.equal(fatal.phase, 'dead');
  assert.equal(buildSurvivalRecord(fatal).outcome, 'The stair gives beneath your foot.');
});
