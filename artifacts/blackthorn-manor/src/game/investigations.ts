import type { GameState } from "./engine";
import { stageDiscoveries } from "./discoveries";

export type JournalEntry = {
  title: string;
  text: string;
  category: "Investigation Notes" | "Family Fragments";
  clueId?: string;
};

export type InvestigationHotspot = {
  id: string;
  tooltip: string;
  /** Percentages relative to the full, uncropped image: x, y, width, height. */
  bounds: [number, number, number, number];
  requires?: string[];
  itemId?: string;
  itemScore?: number;
  completesChoiceId?: string;
  journal?: JournalEntry;
  clueId?: string;
  message?: string;
};

export type InvestigationScene = {
  id: string;
  roomId: string;
  actionLabel: string;
  replaceChoiceId?: string;
  description: string;
  asset: string;
  hotspots: InvestigationHotspot[];
};

/** New scenes need only their artwork and an entry in this registry. */
export const INVESTIGATIONS: InvestigationScene[] = [{
  id: "library-desk",
  roomId: "library",
  actionLabel: "Inspect the desk",
  replaceChoiceId: "library-diary",
  description: "Lean closer to the papers and objects on the writing desk.",
  asset: "images/investigate-library-desk.png",
  hotspots: [
    {
      id: "ledger", tooltip: "Family Ledger", bounds: [33, 24, 38, 33],
      journal: {
        title: "Family Ledger", category: "Investigation Notes",
        text: "Several entries have been removed.\nThe remaining entries suggest portions of Estate history have been deliberately concealed.",
      },
    },
    {
      id: "atlas", tooltip: "Blackthorn Estate Atlas", bounds: [7, 15, 24, 32],
      journal: {
        title: "Estate Atlas", category: "Investigation Notes",
        text: "Several locations have been circled repeatedly.\nOne area beyond the Chapel appears heavily annotated.",
      },
    },
    {
      id: "letter", tooltip: "Sealed Correspondence", bounds: [72, 32, 15, 12],
      journal: {
        title: "Sealed Correspondence", category: "Investigation Notes",
        text: "My dear brother,\n\nSome discoveries are better left forgotten.\nI increasingly fear Adrian's investigations beneath the Estate.",
      },
    },
    {
      id: "key", tooltip: "Brass Key", bounds: [72, 43, 9, 7],
      itemId: "brass-key", itemScore: 100,
    },
    {
      id: "drawer", tooltip: "Partially Open Drawer", bounds: [33, 68, 39, 17],
    },
    {
      id: "compartment", tooltip: "Something seems unusual here.",
      bounds: [48, 77, 8, 7], requires: ["drawer"],
      itemId: "ancient-diary", itemScore: 100, completesChoiceId: "library-diary",
      clueId: "family-fragment-i",
      journal: {
        title: "Family Fragment I", category: "Family Fragments",
        text: 'The first missing page appears to have been removed intentionally.\n\nA note in the margin reads:\n\n"There are older foundations beneath the Estate than those recorded in any Blackthorn archive."',
      },
    },
  ],
}];

export function investigationsForRoom(roomId: string): InvestigationScene[] {
  return INVESTIGATIONS.filter(scene => scene.roomId === roomId);
}

export function hotspotAvailable(state: GameState, scene: InvestigationScene, hotspot: InvestigationHotspot): boolean {
  const discovered = state.investigationProgress?.[scene.id] ?? [];
  return state.phase === "playing" && state.roomId === scene.roomId
    && (hotspot.requires ?? []).every(id => discovered.includes(id));
}

/** Evidence is recorded immediately; collectible rewards use the saved acceptance queue. */
export function investigate(state: GameState, sceneId: string, hotspotId: string): GameState {
  const scene = INVESTIGATIONS.find(entry => entry.id === sceneId);
  const hotspot = scene?.hotspots.find(entry => entry.id === hotspotId);
  if (!scene || !hotspot || !hotspotAvailable(state, scene, hotspot) || state.pendingDiscovery) return state;
  const progress = state.investigationProgress?.[sceneId] ?? [];
  if (progress.includes(hotspotId)) return state;
  const journalKey = `${sceneId}:${hotspotId}`;
  const fragment = hotspot.journal?.category === "Family Fragments";
  const journalEntry = fragment ? { ...hotspot.journal!, clueId: hotspot.clueId } : hotspot.journal;
  const newItem = hotspot.itemId && !state.inventory.includes(hotspot.itemId);
  const newFragment = hotspot.clueId && !state.clues.includes(hotspot.clueId);
  const next: GameState = {
    ...state,
    investigationProgress: {
      ...(state.investigationProgress ?? {}),
      [sceneId]: [...progress, hotspotId],
    },
    inventory: hotspot.itemId && !state.inventory.includes(hotspot.itemId)
      ? [...state.inventory, hotspot.itemId] : state.inventory,
    clues: newFragment ? [...state.clues, hotspot.clueId!] : state.clues,
    score: state.score + (hotspot.itemId && !state.inventory.includes(hotspot.itemId) ? hotspot.itemScore ?? 0 : 0),
    discoveries: hotspot.completesChoiceId
      ? [...new Set([...state.discoveries, hotspot.completesChoiceId])] : state.discoveries,
    journalEntries: journalEntry
      ? { ...(state.journalEntries ?? {}), [journalKey]: journalEntry }
      : state.journalEntries,
    lastEvent: undefined,
  };
  const rewards: NonNullable<GameState["pendingDiscovery"]>[] = [];
  if (newItem) rewards.push({
    kind: "item", title: "ITEM FOUND", itemId: hotspot.itemId,
    rewardScore: hotspot.itemScore ?? 0, story: fragment ? hotspot.journal!.text : `You discover the ${hotspot.tooltip} on the desk.`,
    investigationId: sceneId,
  });
  if (newFragment) rewards.push({
    kind: "fragment", title: "FAMILY FRAGMENT DISCOVERED", clueId: hotspot.clueId,
    story: hotspot.journal?.text ?? "", journalKey, journalEntry,
    investigationId: sceneId,
  });
  if (hotspot.message) rewards.push({
    kind: "discovery", title: "DISCOVERY", story: hotspot.message, investigationId: sceneId,
  });
  const [first, ...following] = rewards;
  return first ? stageDiscoveries(state, next, { ...first, following }) : next;
}

/** Preserve earned legacy lore, but expose one canonical collectible fragment list. */
export function migrateInvestigationJournal(state: GameState): GameState {
  const clues = new Set(state.clues);
  const journalEntries: Record<string, JournalEntry> = {};
  for (const [key, entry] of Object.entries(state.journalEntries ?? {})) {
    const category = (entry.category as string) === "Lore Fragments" ? "Family Fragments" : entry.category;
    journalEntries[key] = { ...entry, category };
    if (category === "Family Fragments") {
      const configured = INVESTIGATIONS.flatMap(scene => scene.hotspots.map(h => ({ key: `${scene.id}:${h.id}`, clueId: h.clueId }))).find(h => h.key === key);
      const clueId = entry.clueId ?? configured?.clueId ?? entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      clues.add(clueId);
      journalEntries[key].clueId = clueId;
    }
  }
  return { ...state, clues: [...clues], journalEntries };
}
