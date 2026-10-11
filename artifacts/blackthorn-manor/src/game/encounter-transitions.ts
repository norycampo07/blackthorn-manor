import type { GameState } from './engine';

export const DEFEAT_TRANSITION_MS = 2500;

export function isFinalEnemyDefeat(previous: GameState, next: GameState): boolean {
  const combat = previous.combat;
  return previous.phase === 'combat' && Boolean(combat)
    && !(combat!.monsterId === 'lord-blackthorn' && combat!.enemyPhase === 'human')
    && !previous.defeatedMonsters.includes(combat!.monsterId)
    && next.defeatedMonsters.includes(combat!.monsterId);
}

/** Display the existing encounter at zero HP without mutating the saved outcome. */
export function defeatSnapshot(previous: GameState, next: GameState): GameState {
  if (!previous.combat) return previous;
  return {
    ...previous, stamina: next.stamina,
    combat: {
      ...previous.combat, enemyStamina: 0, round: previous.combat.round + 1,
      dialogue: undefined, outcome: undefined, pauseReason: 'The enemy falls.',
    },
  };
}
