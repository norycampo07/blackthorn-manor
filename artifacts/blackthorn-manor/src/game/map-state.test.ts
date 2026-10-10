import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, interact, loadGame, saveGame } from './engine';
import { knownLocks } from './map-state';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
} });

test('visiting a room does not disclose locks or hidden puzzles', () => {
  const state = { ...createGame('Map Test'), roomId: 'master-bedroom', visitedRooms: ['front-gate', 'master-bedroom'] };
  assert.deepEqual(knownLocks(state), []);
});

test('an attempted locked interaction is remembered and survives a save', () => {
  const state = { ...createGame('Map Test'), roomId: 'master-bedroom', visitedRooms: ['front-gate', 'master-bedroom'] };
  const next = interact(state, 'bedroom-wardrobe');
  assert.equal(next.inventory.length, state.inventory.length);
  assert.equal(knownLocks(next)[0]?.choiceId, 'bedroom-wardrobe');
  saveGame(next);
  assert.equal(knownLocks(loadGame()!)[0]?.roomId, 'master-bedroom');
});

test('known lock markers disappear on acquiring the key or completing the interaction', () => {
  const state = { ...createGame('Map Test'), roomId: 'master-bedroom', visitedRooms: ['front-gate', 'master-bedroom'], knownLockedChoices: ['bedroom-wardrobe'] };
  assert.equal(knownLocks(state).length, 1);
  assert.deepEqual(knownLocks({ ...state, inventory: ['brass-key'] }), []);
  assert.deepEqual(knownLocks({ ...state, discoveries: ['bedroom-wardrobe'] }), []);
  assert.deepEqual(knownLocks({ ...state, visitedRooms: ['front-gate'] }), []);
});
