import { ROOMS } from './content';
import type { GameState } from './engine';

/** Only attempted locks are remembered; visiting a room never reveals its secrets. */
export function knownLocks(state: GameState) {
  return ROOMS.flatMap(room => room.choices
    .filter(choice => state.visitedRooms.includes(room.id)
      && state.knownLockedChoices?.includes(choice.id)
      && choice.requires && !state.inventory.includes(choice.requires)
      && !state.discoveries.includes(choice.id))
    .map(choice => ({ roomId: room.id, roomTitle: room.title, choiceId: choice.id, label: choice.label })));
}
