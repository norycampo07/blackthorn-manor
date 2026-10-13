import { getItem, getRoom, getChoicePrimaryOutcome, type GameState, type PendingDiscovery } from "./engine";

/** Keep discovered rewards in the saved confirmation queue, not in pockets. */
export function stageDiscoveries(previous: GameState, next: GameState, dialog?: PendingDiscovery): GameState {
  if (!dialog) return { ...next, pendingDiscovery: undefined };
  const deferredItems = new Set<string>();
  const deferredClues = new Set<string>();
  const deferredJournal = new Set<string>();
  let deferredScore = 0;
  const queue = [dialog, ...(dialog.following ?? [])].map(entry => {
    const reward = { ...entry, following: undefined };
    if (entry.kind === "item" && entry.itemId && next.inventory.includes(entry.itemId)
      && !previous.inventory.includes(entry.itemId)) {
      deferredItems.add(entry.itemId);
      reward.rewardScore = entry.rewardScore ?? (entry.itemId === "blackthorn-dagger" ? 150 : 100);
      deferredScore += reward.rewardScore;
    }
    if (entry.kind === "fragment" && entry.clueId && !previous.clues.includes(entry.clueId)) {
      deferredClues.add(entry.clueId);
      if (entry.journalKey && !previous.journalEntries?.[entry.journalKey]) deferredJournal.add(entry.journalKey);
    }
    return reward;
  });
  // Ordinary room actions use the same acceptance boundary as investigations.
  // Encounter actions are complete when combat starts, not when optional loot is taken.
  const deferredChoices = new Set<string>();
  for (const choiceId of next.discoveries.filter(id => !previous.discoveries.includes(id))) {
    if (!getRoom(next.roomId)?.choices.some(choice => choice.id === choiceId)) continue;
    const primary = getChoicePrimaryOutcome(choiceId);
    if (primary.kind === "encounter") continue;
    const reward = queue.find(entry => entry.kind === primary.kind
      && (primary.kind === "item" ? entry.itemId === primary.id
        : primary.kind === "fragment" ? entry.clueId === primary.id : true));
    if (reward) {
      reward.completesChoiceId = choiceId;
      deferredChoices.add(choiceId);
    }
  }
  for (const reward of queue) {
    if (reward.completesChoiceId && !previous.discoveries.includes(reward.completesChoiceId)) deferredChoices.add(reward.completesChoiceId);
  }
  const [first, ...following] = queue;
  return {
    ...next,
    inventory: next.inventory.filter(id => !deferredItems.has(id)),
    clues: next.clues.filter(id => !deferredClues.has(id)),
    score: next.score - deferredScore,
    discoveries: next.discoveries.filter(id => !deferredChoices.has(id)),
    journalEntries: Object.fromEntries(Object.entries(next.journalEntries ?? {}).filter(([key]) => !deferredJournal.has(key))),
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
  const requiredItem = dialog.completesChoiceId
    ? getRoom(state.roomId)?.choices.find(choice => choice.id === dialog.completesChoiceId)?.requires : undefined;
  return {
    ...state,
    inventory: newItem ? [...state.inventory, newItem] : state.inventory,
    clues: newClue ? [...state.clues, newClue] : state.clues,
    journalEntries: newClue && dialog.journalKey && dialog.journalEntry
      ? { ...(state.journalEntries ?? {}), [dialog.journalKey]: dialog.journalEntry } : state.journalEntries,
    score: state.score + (newItem ? dialog.rewardScore ?? 0 : 0),
    lastEvent: newItem
      ? { type: "item", message: `Taken ${getItem(newItem)?.name ?? newItem}.${dialog.rewardScore ? ` +${dialog.rewardScore} SECRET ITEM` : ""}`, amount: dialog.rewardScore }
      : newClue
        ? { type: "story", message: "A family fragment is preserved." }
        : state.lastEvent,
    pendingDiscovery,
    discoveries: [...new Set([
      ...state.discoveries, ...(dialog.discoveryId ? [dialog.discoveryId] : []),
      ...(dialog.completesChoiceId ? [dialog.completesChoiceId] : []),
    ])],
    usedItems: requiredItem ? [...new Set([...state.usedItems, requiredItem])] : state.usedItems,
  };
}
