import type { GameState, PendingDiscovery } from './engine';
import { LUCK_ENCOUNTERS } from './luck-events';

export const LUCK_SUCCESS_TITLES = ['LUCK IS ON YOUR SIDE', 'FORTUNE FAVORS YOU', 'FATE INTERVENES'];
export const LUCK_FAILURE_TITLES = ['MISFORTUNE FOLLOWS YOU', 'FORTUNE ABANDONS YOU', 'FATE LOOKS AWAY'];

export function luckResult(previous: GameState, next: GameState, reward?: PendingDiscovery): PendingDiscovery {
  const success = Boolean(next.lastLuck?.success);
  const event = LUCK_ENCOUNTERS.find(entry => entry.id === next.lastLuck?.id);
  const titles = success ? LUCK_SUCCESS_TITLES : LUCK_FAILURE_TITLES;
  const effects: string[] = [];
  for (const [field, label] of [['stamina', 'STAMINA'], ['fear', 'FEAR'], ['luck', 'LUCK']] as const) {
    const delta = next[field] - previous[field];
    if (delta) effects.push(`${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${label}`);
  }
  const deferredScore = (reward ? [reward, ...(reward.following ?? [])] : [])
    .filter(entry => entry.kind === 'item').reduce((sum, entry) => sum + (entry.itemId === 'blackthorn-dagger' ? 150 : 100), 0);
  const score = next.score - previous.score - deferredScore;
  if (score) effects.push(`+${score} HOUSE SCORE`);
  return {
    kind: 'luck-result', title: titles[Math.floor(Math.random() * titles.length)],
    story: event ? `${event.story}\n\n${success ? event.success : event.failure}` : 'The Manor holds its breath.',
    effects,
    following: reward ? [{ ...reward, following: undefined }, ...(reward.following ?? [])] : undefined,
  };
}
