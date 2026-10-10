import type { CombatAction, GameState } from "./engine";

export type GuidanceState = {
  investigation: "gate" | "hall" | "done";
  mapOpened: boolean;
  itemTaken: boolean;
  fragmentAdded: boolean;
  combat: "unseen" | "active" | "done";
};

const GUIDANCE_KEY = "blackthorn-manor-guidance-v1";

export function readGuidance(saved: GameState | null): GuidanceState {
  const experienced = saved?.discoveries.some(id => id === "gate-footprints" || id === "hall-portraits")
    || saved?.visitedRooms.some(id => id !== "front-gate" && id !== "entrance-hall");
  const defaults: GuidanceState = {
    investigation: experienced ? "done" : saved?.roomId === "entrance-hall" ? "hall" : "gate",
    mapOpened: false,
    itemTaken: Boolean(saved?.inventory.length),
    fragmentAdded: Boolean(saved?.clues.length),
    combat: saved?.defeatedMonsters.length || (saved?.combat?.round ?? 0) > 0
      ? "done" : saved?.phase === "combat" ? "active" : "unseen",
  };
  try {
    const raw = localStorage.getItem(GUIDANCE_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw) as Partial<GuidanceState>;
    return {
      investigation: ["gate", "hall", "done"].includes(stored.investigation ?? "")
        ? stored.investigation! : defaults.investigation,
      mapOpened: typeof stored.mapOpened === "boolean" ? stored.mapOpened : defaults.mapOpened,
      itemTaken: typeof stored.itemTaken === "boolean" ? stored.itemTaken : defaults.itemTaken,
      fragmentAdded: typeof stored.fragmentAdded === "boolean" ? stored.fragmentAdded : defaults.fragmentAdded,
      combat: ["unseen", "active", "done"].includes(stored.combat ?? "") ? stored.combat! : defaults.combat,
    };
  } catch {
    return defaults;
  }
}

export function saveGuidance(state: GuidanceState): void {
  try {
    localStorage.setItem(GUIDANCE_KEY, JSON.stringify(state));
  } catch {
    // Cues still dismiss for this session when browser storage is unavailable.
  }
}

export function advanceGuidance(
  guidance: GuidanceState,
  previous: GameState,
  next: GameState,
  action: { choiceId?: string; combatAction?: CombatAction } = {},
): GuidanceState {
  const result = { ...guidance };
  if (result.investigation === "gate") {
    if (action.choiceId === "gate-footprints") result.investigation = "done";
    else if (next.roomId === "entrance-hall") result.investigation = "hall";
    else if (next.roomId !== "front-gate") result.investigation = "done";
  } else if (result.investigation === "hall") {
    if (next.roomId !== "entrance-hall" || (previous.roomId === "entrance-hall" && action.choiceId)) {
      result.investigation = "done";
    }
  }
  if (result.combat === "unseen" && next.phase === "combat") result.combat = "active";
  if (result.combat === "active" && previous.phase === "combat") {
    const attacked = action.combatAction === "attack"
      || (action.combatAction === "item" && (next.combat?.round ?? previous.combat!.round + 1) > previous.combat!.round);
    if (attacked || next.phase !== "combat") result.combat = "done";
  }
  return result;
}
