import type { GameState } from "./engine";

export type JournalEntry = {
  title: string;
  text: string;
  category: "Investigation Notes" | "Lore Fragments";
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
        title: "Unsent Letter", category: "Investigation Notes",
        text: "My dear brother,\n\nSome discoveries are better left forgotten.\nI increasingly fear Adrian's investigations beneath the Estate.",
      },
    },
    {
      id: "key", tooltip: "Brass Key", bounds: [72, 43, 9, 7],
      itemId: "brass-key", message: "Item Acquired:\nBrass Key",
    },
    {
      id: "drawer", tooltip: "Partially Open Drawer", bounds: [33, 68, 39, 17],
      message: "The drawer shifts beneath your fingers. Something seems unusual here.",
    },
    {
      id: "compartment", tooltip: "Something seems unusual here.",
      bounds: [48, 77, 8, 7], requires: ["drawer"],
      itemId: "ancient-diary", itemScore: 100, completesChoiceId: "library-diary",
      journal: {
        title: "Family Fragment I", category: "Lore Fragments",
        text: 'The first missing page appears to have been removed intentionally.\n\nA note in the margin reads:\n\n"There are older foundations beneath the Estate than those recorded in any Blackthorn archive."',
      },
      message: "Family Fragment I Acquired\nItem Acquired: Ancient Diary",
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

/** Pure, idempotent reward transaction; the UI saves this outcome immediately. */
export function investigate(state: GameState, sceneId: string, hotspotId: string): GameState {
  const scene = INVESTIGATIONS.find(entry => entry.id === sceneId);
  const hotspot = scene?.hotspots.find(entry => entry.id === hotspotId);
  if (!scene || !hotspot || !hotspotAvailable(state, scene, hotspot)) return state;
  const progress = state.investigationProgress?.[sceneId] ?? [];
  if (progress.includes(hotspotId)) return state;
  return {
    ...state,
    investigationProgress: {
      ...(state.investigationProgress ?? {}),
      [sceneId]: [...progress, hotspotId],
    },
    inventory: hotspot.itemId && !state.inventory.includes(hotspot.itemId)
      ? [...state.inventory, hotspot.itemId] : state.inventory,
    score: state.score + (hotspot.itemId && !state.inventory.includes(hotspot.itemId) ? hotspot.itemScore ?? 0 : 0),
    discoveries: hotspot.completesChoiceId
      ? [...new Set([...state.discoveries, hotspot.completesChoiceId])] : state.discoveries,
    journalEntries: hotspot.journal
      ? { ...(state.journalEntries ?? {}), [`${sceneId}:${hotspotId}`]: hotspot.journal }
      : state.journalEntries,
  };
}
