import type { GameState } from "./engine";
import { stageDiscoveries } from "./discoveries";
import { roomById } from "./content";
import { RELIC_INVESTIGATIONS } from "./relic-investigations";

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
  discoveryTitle?: string;
  discoveryId?: string;
  itemStory?: string;
  reading?: { title: string; text: string };
  /** Visible interactions may need an earlier puzzle step, without hiding the object. */
  interactionRequires?: string[];
  blockedText?: string;
};

export type InvestigationScene = {
  id: string;
  roomId: string;
  actionLabel: string;
  replaceChoiceId?: string;
  description: string;
  asset: string;
  idleText?: string;
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
      id: "letter", tooltip: "Letter to a Brother", bounds: [72, 32, 15, 12],
      journal: {
        title: "Letter to a Brother", category: "Investigation Notes",
        text: "My dear brother,\n\nSome discoveries are better left forgotten.\nI increasingly fear Adrian's investigations beneath the Estate.",
      },
    },
    {
      id: "key", tooltip: "Brass Key", bounds: [72, 43, 9, 7],
      itemId: "brass-key", itemScore: 100,
    },
    {
      id: "drawer", tooltip: "Partially Open Drawer", bounds: [33, 68, 39, 17],
      reading: { title: "Partially Open Drawer", text: "The drawer shifts beneath your fingers. Something seems unusual here." },
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
}, {
  id: "library-bookshelf",
  roomId: "library",
  actionLabel: "Browse the bookshelves",
  replaceChoiceId: "library-bookshelves",
  description: "Lean closer to the volumes gathered over generations of Blackthorn history.",
  asset: "images/investigate-library-bookshelf.png",
  idleText: "Pass your eyes over the shelves. Some histories were never meant to be read.",
  hotspots: [
    {
      id: "genealogy", tooltip: "Blackthorn Genealogy", bounds: [20, 5, 16, 24],
      journal: {
        title: "Blackthorn Genealogy", category: "Investigation Notes",
        text: "The shelf's largest volume records generations of Blackthorn lineage.\n\nSeveral family members appear repeatedly in marginal notes while others have been deliberately crossed out.",
      },
    },
    {
      id: "missing-volume", tooltip: "Missing Volume", bounds: [64, 8, 11, 21],
      journal: {
        title: "Missing Volume", category: "Investigation Notes",
        text: "An obvious gap remains between surrounding books.\n\nThe dust suggests a single volume was removed recently.",
      },
    },
    {
      id: "burned-journal", tooltip: "Burned Journal", bounds: [37, 34, 15, 18],
      clueId: "burned-journal",
      journal: {
        title: "Burned Journal", category: "Family Fragments",
        text: "A partially charred journal appears to have survived an intentional fire.\n\nOnly fragments remain readable.",
      },
    },
    {
      id: "correspondence", tooltip: "Sealed Correspondence", bounds: [20, 69, 16, 6],
      journal: {
        title: "Sealed Correspondence", category: "Investigation Notes",
        text: "A sealed letter has been hidden among ordinary volumes.\n\nIts placement suggests it was concealed intentionally rather than stored.",
      },
    },
    {
      id: "lever", tooltip: "An unusual fitting", bounds: [84, 63, 5, 10],
      discoveryTitle: "Distant Note", discoveryId: "library-distant-note",
      completesChoiceId: "library-bookshelves",
      message: "You ease the concealed lever forward.\n\nFor a moment, nothing happens.\n\nThen, somewhere beyond the Library walls, a single piano note rings out.\n\nOne key.\n\nOne note.\n\nSilence follows.",
    },
  ],
}, ...RELIC_INVESTIGATIONS];

export function investigationsForRoom(roomId: string): InvestigationScene[] {
  return INVESTIGATIONS.filter(scene => scene.roomId === roomId);
}

export function hotspotAvailable(state: GameState, scene: InvestigationScene, hotspot: InvestigationHotspot): boolean {
  const discovered = state.investigationProgress?.[scene.id] ?? [];
  const requiredItem = roomById(scene.roomId)?.choices.find(choice => choice.id === scene.replaceChoiceId)?.requires;
  return state.phase === "playing" && state.roomId === scene.roomId
    && (!requiredItem || state.inventory.includes(requiredItem))
    && (hotspot.requires ?? []).every(id => discovered.includes(id));
}

export function interactionReady(state: GameState, scene: InvestigationScene, hotspot: InvestigationHotspot): boolean {
  return (hotspot.interactionRequires ?? []).every(id => state.investigationProgress?.[scene.id]?.includes(id));
}

/** Evidence is recorded immediately; collectible rewards use the saved acceptance queue. */
export function investigate(state: GameState, sceneId: string, hotspotId: string): GameState {
  const scene = INVESTIGATIONS.find(entry => entry.id === sceneId);
  const hotspot = scene?.hotspots.find(entry => entry.id === hotspotId);
  if (!scene || !hotspot || !hotspotAvailable(state, scene, hotspot) || !interactionReady(state, scene, hotspot) || state.pendingDiscovery) return state;
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
    discoveries: hotspot.completesChoiceId && hotspot.itemId && !newItem
      ? [...new Set([...state.discoveries, hotspot.completesChoiceId])] : state.discoveries,
    journalEntries: journalEntry
      ? { ...(state.journalEntries ?? {}), [journalKey]: journalEntry }
      : state.journalEntries,
    lastEvent: undefined,
  };
  const rewards: NonNullable<GameState["pendingDiscovery"]>[] = [];
  if (newItem) rewards.push({
    kind: "item", title: "ITEM FOUND", itemId: hotspot.itemId,
    rewardScore: hotspot.itemScore ?? 0,
    story: hotspot.itemStory ?? (fragment ? hotspot.journal!.text : `You discover the ${hotspot.tooltip}.`),
    investigationId: sceneId, completesChoiceId: hotspot.completesChoiceId,
  });
  if (newFragment) rewards.push({
    kind: "fragment", title: "FAMILY FRAGMENT DISCOVERED", clueId: hotspot.clueId,
    story: hotspot.journal?.text ?? "", journalKey, journalEntry,
    investigationId: sceneId, completesChoiceId: !hotspot.itemId ? hotspot.completesChoiceId : undefined,
  });
  if (hotspot.message) rewards.push({
    kind: "discovery", title: hotspot.discoveryTitle ?? "DISCOVERY", story: hotspot.message,
    discoveryId: hotspot.discoveryId, investigationId: sceneId, completesChoiceId: hotspot.completesChoiceId,
  });
  const [first, ...following] = rewards;
  return first ? stageDiscoveries(state, next, { ...first, following }) : next;
}

/** Preserve earned legacy lore, but expose one canonical collectible fragment list. */
export function migrateInvestigationJournal(state: GameState): GameState {
  const clues = new Set(state.clues.filter(id => id !== "family-ledger"));
  const journalEntries: Record<string, JournalEntry> = {};
  for (const [key, entry] of Object.entries(state.journalEntries ?? {})) {
    if (entry.category !== "Investigation Notes" && (entry.clueId === "family-ledger" || entry.title === "Family Ledger")) continue;
    const category = (entry.category as string) === "Lore Fragments" ? "Family Fragments" : entry.category;
    journalEntries[key] = {
      ...entry, category,
      title: key === "library-desk:letter" ? "Letter to a Brother" : entry.title,
    };
    if (category === "Family Fragments") {
      const configured = INVESTIGATIONS.flatMap(scene => scene.hotspots.map(h => ({ key: `${scene.id}:${h.id}`, clueId: h.clueId }))).find(h => h.key === key);
      const clueId = entry.clueId ?? configured?.clueId ?? entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      clues.add(clueId);
      journalEntries[key].clueId = clueId;
    }
  }
  // A save may have paused on the obsolete room reward before acceptance.
  const removeObsoleteReward = (reward: NonNullable<GameState["pendingDiscovery"]>): GameState["pendingDiscovery"] => {
    const following = (reward.following ?? []).flatMap(entry => {
      const kept = removeObsoleteReward(entry);
      return kept ? [kept] : [];
    });
    if (reward.kind === "fragment" && reward.clueId === "family-ledger") {
      const [first, ...rest] = following;
      return first ? { ...first, following: rest.length ? rest : undefined } : undefined;
    }
    const primary = INVESTIGATIONS.flatMap(scene => scene.hotspots).find(h =>
      h.completesChoiceId && (reward.kind === "item" ? h.itemId === reward.itemId
        : reward.kind === "discovery" ? h.discoveryId === reward.discoveryId : false));
    return { ...reward, completesChoiceId: reward.completesChoiceId ?? primary?.completesChoiceId, following: following.length ? following : undefined };
  };
  const discoveries = new Set(state.discoveries);
  for (const scene of INVESTIGATIONS) {
    for (const hotspot of scene.hotspots.filter(h => h.completesChoiceId)) {
      if ((hotspot.itemId && state.inventory.includes(hotspot.itemId))
        || (hotspot.discoveryId && discoveries.has(hotspot.discoveryId))) {
        discoveries.add(hotspot.completesChoiceId!);
      }
    }
  }
  const pendingDiscovery = state.pendingDiscovery ? removeObsoleteReward(state.pendingDiscovery) : undefined;
  for (const reward of pendingDiscovery ? [pendingDiscovery, ...(pendingDiscovery.following ?? [])] : []) {
    if (reward.completesChoiceId && reward.kind === "item" && reward.itemId && !state.inventory.includes(reward.itemId)) {
      discoveries.delete(reward.completesChoiceId);
    }
  }
  return {
    ...state, clues: [...clues], journalEntries, discoveries: [...discoveries], pendingDiscovery,
  };
}
