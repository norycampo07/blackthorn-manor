import { getItem, type GameState, type PendingDiscovery } from "./engine";

/** Keep discovered rewards in the saved confirmation queue, not in pockets. */
export function stageDiscoveries(previous: GameState, next: GameState, dialog?: PendingDiscovery): GameState {
  if (!dialog) return { ...next, pendingDiscovery: undefined };
  const deferredItems = new Set<string>();
  const deferredClues = new Set<string>();
  let deferredScore = 0;
  const queue = [dialog, ...(dialog.following ?? [])].map(entry => {
    const reward = { ...entry, following: undefined };
    if (entry.kind === "item" && entry.itemId && next.inventory.includes(entry.itemId)
      && !previous.inventory.includes(entry.itemId)) {
      deferredItems.add(entry.itemId);
      reward.rewardScore = entry.itemId === "blackthorn-dagger" ? 150 : 100;
      deferredScore += reward.rewardScore;
    }
    if (entry.kind === "fragment" && entry.clueId && !previous.clues.includes(entry.clueId)) {
      deferredClues.add(entry.clueId);
    }
    return reward;
  });
  const [first, ...following] = queue;
  return {
    ...next,
    inventory: next.inventory.filter(id => !deferredItems.has(id)),
    clues: next.clues.filter(id => !deferredClues.has(id)),
    score: next.score - deferredScore,
    lastEvent: deferredScore > 0 && next.lastEvent?.type === "item"
      ? { type: "story", message: `${getItem(dialog.itemId ?? "")?.name ?? "An item"} discovered.` }
      : next.lastEvent,
    pendingDiscovery: { ...first!, following: following.length ? following : undefined },
  };
}

/** Accept exactly one saved reward. Older already-credited saves stay valid. */
export function acceptDiscovery(state: GameState): GameState {
  const dialog = state.pendingDiscovery;
  if (!dialog) return state;
  const newItem = dialog.kind === "item" && dialog.itemId && !state.inventory.includes(dialog.itemId)
    ? dialog.itemId : undefined;
  const newClue = dialog.kind === "fragment" && dialog.clueId && !state.clues.includes(dialog.clueId)
    ? dialog.clueId : undefined;
  const [following, ...rest] = dialog.following ?? [];
  const pendingDiscovery: PendingDiscovery | undefined = following
    ? { ...following, following: rest.length ? rest : undefined }
    : dialog.kind === "item" && dialog.clueId
      ? { kind: "fragment", title: "FAMILY FRAGMENT DISCOVERED", clueId: dialog.clueId, story: dialog.story }
      : undefined;
  return {
    ...state,
    inventory: newItem ? [...state.inventory, newItem] : state.inventory,
    clues: newClue ? [...state.clues, newClue] : state.clues,
    score: state.score + (newItem ? dialog.rewardScore ?? 0 : 0),
    lastEvent: newItem
      ? { type: "item", message: `Taken ${getItem(newItem)?.name ?? newItem}.${dialog.rewardScore ? ` +${dialog.rewardScore} SECRET ITEM` : ""}`, amount: dialog.rewardScore }
      : newClue
        ? { type: "story", message: "A family fragment is preserved." }
        : state.lastEvent,
    pendingDiscovery,
  };
}
