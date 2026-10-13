import {
  DEATH_WHISPERS,
  ITEMS,
  MONSTERS,
  WHISPERS,
  itemById,
  monsterById,
  roomById,
  type Room,
} from "./content";
import { COMBAT_ATMOSPHERE, combatDialogue, weaknessBonus } from "./combat-lore";
import { availableLuckEvents, LUCK_ENCOUNTERS } from "./luck-events";
import { INVESTIGATIONS, migrateInvestigationJournal, type JournalEntry } from "./investigations";

export type GamePhase = "playing" | "combat" | "dead" | "ending";
export type Ending = "bad" | "good" | "true";
export type CombatAction = "attack" | "luck" | "item" | "flee";

export type PendingDiscovery = {
  kind: "locked" | "discovery" | "item" | "fragment" | "review" | "examine" | "luck" | "luck-result" | "encounter";
  title: string;
  story: string;
  itemId?: string;
  clueId?: string;
  usedItemId?: string;
  following?: PendingDiscovery[];
  rewardScore?: number;
  effects?: string[];
  investigationId?: string;
  discoveryId?: string;
  journalKey?: string;
  journalEntry?: JournalEntry;
};

export type Combat = {
  monsterId: string;
  enemyStamina: number;
  enemyMaxStamina: number;
  enemySkill: number;
  enemyPhase: "human" | "demon";
  log: string[];
  luckyEdge: boolean;
  round: number;
  lastPlayerRoll?: number;
  lastEnemyRoll?: number;
  dialogue?: string;
  dialogueMilestones?: string[];
  pauseReason?: string;
  outcome?: { heading: string; detail: string; playerDamage: number; enemyDamage: number; critical?: boolean; luck?: string };
};

export type GameEvent = {
  type: "story" | "fear" | "luck" | "misfortune" | "damage" | "item" | "combat" | "ending" | "death";
  message: string;
  amount?: number;
  target?: "player" | "enemy";
};

export type GameState = {
  username: string;
  phase: GamePhase;
  skill: number;
  stamina: number;
  luck: number;
  fear: number;
  luckWard?: boolean;
  roomId: string;
  inventory: string[];
  usedItems: string[];
  itemCharges: Record<string, number>;
  clues: string[];
  visitedRooms: string[];
  discoveries: string[];
  knownLockedChoices?: string[];
  investigationProgress?: Record<string, string[]>;
  journalEntries?: Record<string, JournalEntry>;
  pendingEncounter?: { choiceId: string; monsterId: string; stage: "intro" | "combat" };
  defeatedMonsters: string[];
  achievements: string[];
  endingsUnlocked: Ending[];
  score: number;
  luckSuccesses: number;
  startedAt: number;
  combat?: Combat;
  ending?: Ending;
  lastEvent?: GameEvent;
  whisper?: string;
  whisperCount: number;
  deathWhisper?: string;
  fearPulse?: number;
  pendingDiscovery?: PendingDiscovery;
  identifiedPotions: string[];
  luckEventsSeen: string[];
  pendingLuck?: { id: string; title: string; story: string };
  lastLuck?: { id: string; at: number; success: boolean; message: string };
  lastCombatDialogue?: string;
};

export type LeaderboardEntry = {
  username: string;
  score: number;
  ending: string;
  time: string;
  fear: number;
  monstersDefeated: number;
};

const SAVE_KEY = "blackthorn-manor-save-v1";
const LEADERBOARD_KEY = "blackthorn-manor-leaderboard-v1";
const META_KEY = "blackthorn-manor-progress-v1";
const ALL_ROOMS = [
  "front-gate", "entrance-hall", "library", "dining-room", "kitchen",
  "servant-corridor", "chapel", "master-bedroom", "nursery", "cellar",
  "secret-tunnel", "ritual-chamber", "tower-observatory",
];

function readMeta(): { achievements: string[]; endingsUnlocked: Ending[]; identifiedPotions: string[] } {
  try {
    const value = JSON.parse(localStorage.getItem(META_KEY) || "{}") as { achievements?: string[]; endingsUnlocked?: Ending[]; identifiedPotions?: string[] };
    return {
      achievements: Array.isArray(value.achievements) ? value.achievements : [],
      endingsUnlocked: Array.isArray(value.endingsUnlocked) ? value.endingsUnlocked : [],
      identifiedPotions: Array.isArray(value.identifiedPotions) ? value.identifiedPotions : [],
    };
  } catch {
    return { achievements: [], endingsUnlocked: [], identifiedPotions: [] };
  }
}

const rollDie = () => Math.floor(Math.random() * 6) + 1;
const rollTwo = () => rollDie() + rollDie();
const withEvent = (state: GameState, type: GameEvent["type"], message: string, amount?: number): GameState => ({
  ...state,
  lastEvent: { type, message, ...(amount === undefined ? {} : { amount }) },
});

function addFear(state: GameState, amount: number, cause: string): GameState {
  if (amount <= 0 || state.phase === "dead" || state.phase === "ending") return state;
  if (state.luckWard) {
    return { ...state, luckWard: false, lastEvent: { type: "luck", message: "LUCK IS ON YOUR SIDE — a sudden calm keeps the fear at bay." } };
  }
  const fear = Math.min(10, state.fear + amount);
  const next = { ...state, fear, fearPulse: Date.now() };
  if (fear >= 10) {
    return {
      ...next,
      phase: "dead",
      combat: undefined,
      deathWhisper: DEATH_WHISPERS[Math.floor(Math.random() * DEATH_WHISPERS.length)],
      lastEvent: { type: "death", message: `THE TERROR BECOMES UNBEARABLE. ${cause}`, amount },
    };
  }
  return withEvent(next, "fear", `${cause} +${amount} FEAR`, amount);
}

function maybeWhisper(state: GameState, force = false): GameState {
  if (state.phase !== "playing" && state.phase !== "combat") return state;
  const chance = Math.min(0.52, 0.07 + state.fear * 0.035 + (state.inventory.includes("family-seal-ring") ? 0.09 : 0));
  if (!force && Math.random() > chance) return state;
  const heir = state.inventory.includes("family-seal-ring");
  const lines = heir
    ? ["At last.", "You have returned.", "This room was yours.", "He wears your blood.", ...WHISPERS]
    : WHISPERS;
  return { ...state, whisper: lines[Math.floor(Math.random() * lines.length)], whisperCount: state.whisperCount + 1 };
}

function updateAchievements(state: GameState): GameState {
  const earned = new Set(state.achievements);
  if (ALL_ROOMS.every((id) => state.visitedRooms.includes(id))) earned.add("manor-explorer");
  if (state.defeatedMonsters.includes("hanging-lady")) earned.add("ghost-hunter");
  if (state.luckSuccesses >= 10) earned.add("fortunes-favorite");
  if (state.defeatedMonsters.includes("lord-blackthorn")) earned.add("blackthorn-slayer");
  if (state.ending === "true") earned.add("true-heir");
  if ((state.ending || state.phase === "ending") && state.fear <= 2) earned.add("fearless");
  return { ...state, achievements: [...earned] };
}

export function createGame(username: string): GameState {
  const meta = readMeta();
  return {
    username: username.trim().slice(0, 24) || "Unknown Guest",
    phase: "playing",
    skill: 8,
    stamina: 25,
    luck: 10,
    fear: 0,
    luckWard: false,
    roomId: "front-gate",
    inventory: [],
    usedItems: [],
    itemCharges: { matchbox: 7, "rusty-revolver": 1 },
    clues: [],
    visitedRooms: ["front-gate"],
    discoveries: [],
    defeatedMonsters: [],
    achievements: meta.achievements,
    endingsUnlocked: meta.endingsUnlocked,
    score: 25,
    luckSuccesses: 0,
    startedAt: Date.now(),
    whisperCount: 0,
    identifiedPotions: meta.identifiedPotions,
    luckEventsSeen: [],
  };
}

export function restartGame(username: string) {
  return createGame(username);
}

export function getRoom(roomId: string): Room | undefined {
  return roomById(roomId);
}

export function isExitAvailable(state: GameState, roomId: string): boolean {
  const current = roomById(state.roomId);
  if (!current?.exits.includes(roomId)) return false;
  if (state.roomId === "cellar" && roomId === "secret-tunnel" && !state.inventory.includes("lantern")) return false;
  if (state.roomId === "secret-tunnel" && roomId === "ritual-chamber" && !state.inventory.includes("rope")) return false;
  if (roomId === "ritual-chamber" && state.roomId === "chapel" && !state.clues.includes("chapel-burial")) return false;
  if (roomId === "secret-tunnel" && state.roomId === "library" && !state.clues.includes("hollow-library-wall")) return false;
  if (roomId === "secret-tunnel" && state.roomId === "tower-observatory" && !state.clues.includes("star-door")) return false;
  return true;
}

export function enterRoom(state: GameState, roomId: string): GameState {
  if (state.phase !== "playing" || !isExitAvailable(state, roomId)) {
    return withEvent(state, "story", "The passage will not yield. The house keeps this way for another time.");
  }
  const firstVisit = !state.visitedRooms.includes(roomId);
  let next: GameState = {
    ...state,
    roomId,
    visitedRooms: firstVisit ? [...state.visitedRooms, roomId] : state.visitedRooms,
    score: state.score + (firstVisit ? 25 : -10),
    lastEvent: {
      type: "story",
      message: firstVisit ? "The house takes note of your arrival. +25 ROOM DISCOVERY" : "The room seems smaller the second time. −10 for returning.",
      amount: firstVisit ? 25 : -10,
    },
  };
  next = updateAchievements(next);
  if (Math.random() < 0.14 && next.phase === "playing") next = queueLuckEncounter(next);
  return maybeWhisper(next);
}

const choiceEffects: Record<string, { item?: string; clue?: string; fear?: number; monster?: string; guard?: string; introduction?: string; score?: number; stamina?: number; unlock?: string; text: string }> = {
  "gate-footprints": { clue: "returning-footprints", fear: 1, text: "The departing tracks end at the gate. The approaching ones are yours." },
  "hall-portraits": { clue: "blackthorn-portrait", text: "The signet crest matches the shape of a scar in your palm." },
  "hall-drawer": { item: "matchbox", text: "You find a matchbox wrapped in a child's drawing." },
  "library-diary": { item: "ancient-diary", text: "The diary opens to a page written in your own hand." },
  "library-wall": { clue: "hollow-library-wall", unlock: "secret-tunnel", text: "Behind the atlas, a narrow seam runs down the wall. The masonry gives way." },
  "dining-under": { item: "silver-crucifix", text: "A silver crucifix lies beneath the head of the table, wrapped in a napkin." },
  "dining-plate": { fear: 1, text: "The fruit collapses into a swarm of black flies. One spells your name." },
  "dining-seat": { monster: "butler", text: "A gloved hand settles on your shoulder. The Butler asks whether you are staying for supper." },
  "kitchen-cupboard": { item: "lantern", text: "A green flame stirs inside an old lantern. It lights without a match." },
  "kitchen-range": { item: "matchbox", text: "Beneath the ash, the matches are dry and warm." },
  "kitchen-pot": { fear: 1, text: "The reflection smiles a moment after you stop." },
  "corridor-panel": { item: "brass-key", text: "A brass key is hidden inside the polished panelling." },
  "corridor-door": { clue: "counting-child", text: "The little door opens onto a brick wall. The counting resumes, now from one." },
  "corridor-shadow": { monster: "shadow-hound", text: "Your voice answers from the dark, then runs toward you on four long legs." },
  "chapel-altar": { item: "silver-crucifix", text: "A silver crucifix rests in the altar hollow. The metal is warm." },
  "chapel-kneel": { monster: "hanging-lady", text: "A rope creaks above the altar. No rope is there." },
  "chapel-wall": { clue: "chapel-burial", text: "The erased name is beside a sealed stair. Someone buried the family secret beneath the chapel." },
  "bedroom-wardrobe": { item: "family-seal-ring", text: "A ring sits in the coat lining. The mirror shows you wearing it already." },
  "bedroom-mirror": { fear: 1, clue: "mirror-memory", text: "Your reflection mouths a name: Blackthorn." },
  "bedroom-bed": { item: "rusty-revolver", text: "A rusty revolver lies beneath the bed. One chamber holds a bullet." },
  "nursery-cradle": { clue: "warm-cradle", fear: 1, text: "The blanket holds the shape of a sleeping child. The shape is warm." },
  "nursery-music": { clue: "music-box-tune", text: "The melody contains a name hidden between its notes." },
  "nursery-horse": { item: "red-gem", text: "Inside the horse, a red gem beats like a tiny heart." },
  "cellar-root": { item: "rope", text: "Beneath the roots you find a coil of rope and a child's map of the cellar." },
  "cellar-rack": { clue: "red-bottle", fear: 1, text: "The red light in the bottle dims when you look directly at it." },
  "cellar-stairs": { item: "blackthorn-dagger", text: "At the bottom, a silvered dagger rests in a stone niche. The blade is warm." },
  "tunnel-map": { clue: "tunnel-map", item: "rope", text: "The scratched map shows a way beneath the foundations. A coil of rope hangs nearby." },
  "tunnel-crack": { clue: "narrow-way", guard: "bat-swarm",
    introduction: "The passage widens into a hidden chamber.\n\nSomething stirs in the darkness above.\n\nThe sound of wings fills the air.",
    text: "The passage opens into a chamber that has no door above." },
  "tunnel-listen": { fear: 1, text: "The whisper on the other side says: 'At last.' Then the wall goes quiet." },
  "ritual-circle": { fear: 2, clue: "ritual-memory", text: "The circle remembers blood. A family gathering flashes behind your eyes." },
  "ritual-eye": { clue: "crimson-eye-opened", score: 25, text: "The red gem settles into the stone. Beneath the floor, a second heartbeat stops." },
  "ritual-call": { monster: "lord-blackthorn", text: "The portraits bow. Lord Blackthorn steps out of the darkest frame." },
  "tower-telescope": { clue: "star-door", unlock: "secret-tunnel", text: "The stars mark a hidden passage beneath the west wall." },
  "tower-chart": { clue: "thirteen-year-cycle", text: "Every thirteenth year, the same child returns to the house." },
  "tower-window": { fear: 1, clue: "manor-shadow", text: "The manor's shadow raises one hand in greeting." },
};

export function getChoiceDiscoveryText(choiceId: string) {
  return choiceEffects[choiceId]?.text;
}

export function getChoiceReward(choiceId: string) {
  const effect = choiceEffects[choiceId];
  return { itemId: effect?.item, clueId: effect?.clue };
}

export function interact(state: GameState, choiceId: string): GameState {
  if (state.phase !== "playing") return state;
  const room = roomById(state.roomId);
  const choice = room?.choices.find((entry) => entry.id === choiceId);
  if (!choice) return withEvent(state, "story", "The house does not answer that gesture.");
  const investigation = INVESTIGATIONS.find(scene => scene.roomId === state.roomId && scene.replaceChoiceId === choiceId);
  const rewardHotspot = investigation?.hotspots.find(hotspot => hotspot.completesChoiceId === choiceId);
  if (investigation && rewardHotspot && !state.investigationProgress?.[investigation.id]?.includes(rewardHotspot.id)) {
    return withEvent(state, "story", investigation.description);
  }
  const effect = choiceEffects[choiceId];
  if (!effect) return withEvent(state, "story", choice.description);
  const hasRequiredItem = choice.requires
    ? state.inventory.includes(choice.requires) && (choice.requires !== "matchbox" || (state.itemCharges.matchbox ?? 0) > 0)
    : true;
  if (!hasRequiredItem) {
    return withEvent({ ...state, knownLockedChoices: [...new Set([...(state.knownLockedChoices ?? []), choiceId])] }, "story", `Something is missing. You need the ${itemById(choice.requires || "")?.name ?? choice.requires}.`);
  }
  if (state.discoveries.includes(choiceId)) {
    return withEvent(state, "story", "There is nothing more here. The house has already shown you this.");
  }
  if (effect.guard && !state.defeatedMonsters.includes(effect.guard)) {
    return maybeWhisper(withEvent({
      ...state, pendingEncounter: { choiceId, monsterId: effect.guard, stage: "intro" },
    }, "story", effect.introduction ?? "Something stirs beyond the passage."));
  }
  let next: GameState = {
    ...state,
    discoveries: [...state.discoveries, choiceId],
    usedItems: choice.requires ? [...new Set([...state.usedItems, choice.requires])] : state.usedItems,
    itemCharges: choice.requires === "matchbox"
      ? { ...state.itemCharges, matchbox: Math.max(0, (state.itemCharges.matchbox ?? 0) - 1) }
      : state.itemCharges,
    clues: effect.clue && !state.clues.includes(effect.clue) ? [...state.clues, effect.clue] : state.clues,
    score: state.score + (effect.score ?? 0),
    lastEvent: { type: "story", message: effect.text, ...(effect.score ? { amount: effect.score } : {}) },
  };
  if (effect.item && !next.inventory.includes(effect.item)) {
    const bonus = effect.item === "blackthorn-dagger" ? 150 : 100;
    next = {
      ...next,
      inventory: [...next.inventory, effect.item],
      itemCharges: effect.item === "matchbox" ? { ...next.itemCharges, matchbox: 7 } : next.itemCharges,
      score: next.score + bonus,
      lastEvent: { type: "item", message: `Found ${itemById(effect.item)?.name ?? effect.item}. +${bonus} SECRET ITEM`, amount: bonus },
    };
  }
  if (effect.unlock) next = { ...next, clues: [...new Set([...next.clues, effect.unlock])] };
  if (effect.stamina) next = { ...next, stamina: Math.min(Math.max(25, next.stamina), next.stamina + effect.stamina) };
  if (effect.fear) next = addFear(next, effect.fear, effect.text);
  if (effect.monster && next.phase !== "dead") next = startCombat(next, effect.monster);
  next = updateAchievements(next);
  if (Math.random() < 0.08 && next.phase === "playing") next = queueLuckEncounter(next);
  return maybeWhisper(next);
}

/** An introduction is saved before combat; its reward remains guarded until victory. */
export function beginPendingEncounter(state: GameState): GameState {
  const encounter = state.pendingEncounter;
  if (state.phase !== "playing" || encounter?.stage !== "intro"
    || !roomById(state.roomId)?.choices.some(choice => choice.id === encounter.choiceId)
    || choiceEffects[encounter.choiceId]?.guard !== encounter.monsterId) return state;
  return startCombat({
    ...state, pendingDiscovery: undefined, pendingEncounter: { ...encounter, stage: "combat" },
  }, encounter.monsterId);
}

export function startCombat(state: GameState, monsterId: string): GameState {
  const monster = monsterById(monsterId);
  if (!monster || state.phase === "dead" || state.phase === "ending") return state;
  const boss = monsterId === "lord-blackthorn";
  const combat: Combat = {
    monsterId,
    enemyStamina: boss ? 6 : monster.stamina,
    enemyMaxStamina: boss ? 6 : monster.stamina,
    enemySkill: monster.skill,
    enemyPhase: "human",
    log: [`${monster.name} blocks your way. ${monster.description}`],
    luckyEdge: false,
    round: 0,
    dialogue: combatDialogue(monsterId, "human", "start"),
    dialogueMilestones: [],
    pauseReason: "The encounter begins.",
  };
  return { ...state, phase: "combat", combat, lastEvent: { type: "combat", message: `${monster.name} attacks.` } };
}

function finishBoss(state: GameState): GameState {
  const requirements = ["blackthorn-dagger", "family-seal-ring", "ancient-diary", "red-gem"];
  const ending: Ending = requirements.every((item) => state.inventory.includes(item)) ? "true" : "good";
  const bonus = ending === "true" ? 1000 : 500;
  const fearBonus = state.fear <= 2 ? 300 : state.fear <= 4 ? 200 : state.fear <= 6 ? 100 : 0;
  const score = state.score + bonus + Math.max(0, state.stamina) * 10 + fearBonus;
  const endingsUnlocked = [...new Set([...state.endingsUnlocked, ending])];
  const message = ending === "true"
    ? 'The diary opens to its final page. You are the heir. The House speaks clearly, for the first and only time: "Welcome home." The manor finally sleeps.'
    : "The Blackthorn blade finds its mark. You escape before dawn as the storm breaks over the hill.";
  return updateAchievements({
    ...state,
    phase: "ending",
    ending,
    score,
    endingsUnlocked,
    defeatedMonsters: [...new Set([...state.defeatedMonsters, "lord-blackthorn"])],
    combat: undefined,
    lastEvent: { type: "ending", message: `${message} +${bonus} ENDING`, amount: bonus },
    whisper: ending === "true" ? "Welcome home." : undefined,
  });
}

function enemyHit(state: GameState, damage: number, monsterId: string, combat: Combat): GameState {
  const monster = monsterById(monsterId);
  let next: GameState = {
    ...state,
    stamina: Math.max(0, state.stamina - damage),
    combat: { ...combat, log: [...combat.log, `${monster?.name ?? "The enemy"} strikes for ${damage} damage.`] },
    lastEvent: { type: "damage", message: `${monster?.name ?? "The enemy"} strikes for ${damage} damage.`, amount: damage, target: "player" },
  };
  if (monsterId === "hanging-lady" && Math.random() < 0.5) next = addFear(next, monster?.fearAttack ?? 2, "Her gaze finds the fear you buried.");
  else if (Math.random() < 0.16) next = addFear(next, monster?.fearAttack ?? 1, `${monster?.name ?? "The enemy"} draws close.`);
  if (next.stamina <= 0 && next.phase !== "dead") {
    return { ...next, phase: "dead", combat: undefined, deathWhisper: DEATH_WHISPERS[Math.floor(Math.random() * DEATH_WHISPERS.length)], lastEvent: { type: "death", message: "Your strength fails. The house closes around you." } };
  }
  return next;
}

function resolveExchange(state: GameState, action: CombatAction, itemId?: string): GameState {
  if (state.phase !== "combat" || !state.combat) return state;
  const combat = state.combat;
  const monster = monsterById(combat.monsterId);
  if (!monster) return state;
  if (combat.monsterId === "lord-blackthorn" && !state.inventory.includes("blackthorn-dagger")) {
    return {
      ...state,
      phase: "dead",
      ending: "bad",
      endingsUnlocked: [...new Set([...state.endingsUnlocked, "bad" as const])],
      combat: undefined,
      deathWhisper: "The blade was closer than you believed.",
      lastEvent: { type: "death", message: "You were not ready. Lord Blackthorn cannot be harmed without the Blackthorn Dagger. The house closes around you." },
    };
  }
  if (action === "flee") {
    const escaped = { ...state, phase: "playing" as const, combat: undefined };
    return addFear(escaped, 1, "You flee into the passage. Something follows.");
  }
  if (action === "luck") return testLuck(state);
  if (action === "item" && itemId?.endsWith("-potion")) return usePotion(state, itemId);
  let nextCombat: Combat = { ...combat, round: combat.round + 1 };
  let next = state;
  let damageBonus = 0;
  let playerHits = false;
  let enemyHits = false;
  let playerRoll = state.skill + rollTwo();
  const enemyRoll = nextCombat.enemySkill + rollTwo();
  let attackMessage = "";
  if (monster.id === "butler" && action === "attack" && Math.random() < 0.22) {
    playerRoll -= 3;
    nextCombat.pauseReason = "His words leave you striking at a memory.";
    nextCombat.log = [...nextCombat.log, "Confusion: the Butler's voice reduces your attack strength by 3."];
  }
  nextCombat = {
    ...nextCombat,
    lastPlayerRoll: playerRoll,
    lastEnemyRoll: enemyRoll,
    luckyEdge: playerRoll < enemyRoll ? combat.luckyEdge : false,
  };

  if (action === "item") {
    if (!itemId || !state.inventory.includes(itemId)) return withEvent(state, "story", "You do not have that item.");
    const validWeapons = ["blackthorn-dagger", "rusty-revolver", "lantern", "silver-crucifix", "matchbox", "family-seal-ring"];
    if (!validWeapons.includes(itemId)) return withEvent(state, "story", "That item cannot harm this creature.");
    if (itemId === "rusty-revolver" && (state.itemCharges["rusty-revolver"] ?? 0) <= 0) {
      return withEvent(state, "combat", "The revolver clicks. Its single round is gone.");
    }
    if (!canUseCombatItem(state, itemId)) return withEvent(state, "story", "That object offers no opening here.");
    next = {
      ...state,
      usedItems: [...new Set([...state.usedItems, itemId])],
      itemCharges: itemId === "rusty-revolver" || itemId === "matchbox"
        ? { ...state.itemCharges, [itemId]: Math.max(0, (state.itemCharges[itemId] ?? 0) - 1) }
        : state.itemCharges,
    };
    if (itemId === "rusty-revolver") next.usedItems = [...new Set([...next.usedItems, itemId])];
    damageBonus = (itemId === "blackthorn-dagger" ? 3 : itemId === "rusty-revolver" ? 4 : itemId === "matchbox" || itemId === "family-seal-ring" ? 0 : 2)
      + weaknessBonus(monster.id, itemId);
    attackMessage = itemId === "blackthorn-dagger" ? "A silver slash throws sparks through the dark." :
      itemId === "rusty-revolver" ? "The revolver cracks. White flash, black smoke." :
        itemId === "lantern" ? "Holy fire bursts from the lantern." : itemId === "matchbox" ? "A sudden match flame scatters the wings." :
          itemId === "family-seal-ring" ? "The family seal answers the blade in your hand." : "White light pours from the crucifix.";
    if (weaknessBonus(monster.id, itemId)) attackMessage += " Its weakness is exposed. +1 DAMAGE.";
    playerRoll += 4;
  }

  const fortunate = Math.random() < 0.14 && rollTwo() <= Math.max(2, state.luck - Math.floor(state.fear / 3));
  let dodge = false;
  if (fortunate) {
    const opportunity = playerRoll >= enemyRoll && Math.random() < 0.2;
    const line = playerRoll < enemyRoll ? "LUCKY DODGE — the attack narrowly misses."
      : opportunity ? "LUCKY OPPORTUNITY — a weakness opens for your next strike." : "LUCKY STRIKE — a brief opening adds 1 damage.";
    next = updateAchievements({ ...next, luckSuccesses: next.luckSuccesses + 1, score: next.score + 25,
      lastLuck: { id: `combat-${monster.id}-${nextCombat.round}`, at: Date.now(), success: true, message: line } });
    nextCombat.pauseReason = line;
    if (playerRoll < enemyRoll) dodge = true;
    else if (opportunity) nextCombat.luckyEdge = true;
    else damageBonus += 1;
    nextCombat.log = [...nextCombat.log, line];
  }
  if (playerRoll >= enemyRoll) {
    playerHits = true;
    const damage = 2 + damageBonus + (combat.luckyEdge ? 2 : 0);
    nextCombat.enemyStamina = Math.max(0, nextCombat.enemyStamina - damage);
    nextCombat.log = [...nextCombat.log, `${attackMessage ? `${attackMessage} ` : ""}You win the exchange. ${monster.name} loses ${damage} stamina.`];
    next = { ...next, score: next.score + (combat.luckyEdge ? 0 : 0) };
  } else {
    enemyHits = true;
    nextCombat.log = [...nextCombat.log, dodge ? "You slip beneath the attack. No stamina is lost." : `${monster.name} wins the exchange.`];
  }

  if (nextCombat.enemyStamina <= 0 && combat.monsterId === "lord-blackthorn" && nextCombat.enemyPhase === "human") {
    nextCombat.enemyPhase = "demon";
    nextCombat.enemySkill = monster.skill + 1;
    nextCombat.enemyStamina = 10;
    nextCombat.enemyMaxStamina = 10;
    nextCombat.log = [...nextCombat.log, "The human shape breaks open. The demon rises beneath it."];
    next = { ...next, combat: nextCombat, lastEvent: { type: "combat", message: "Lord Blackthorn reveals his demon form." } };
    if (!state.inventory.includes("blackthorn-dagger")) {
      return { ...next, phase: "dead", combat: undefined, deathWhisper: "The blade was closer than you believed.", lastEvent: { type: "death", message: "Your weapon cannot touch him. The manor takes its heir." } };
    }
  } else if (nextCombat.enemyStamina <= 0) {
    const defeated = [...new Set([...state.defeatedMonsters, combat.monsterId])];
    const reward = combat.monsterId === "lord-blackthorn" ? 0 : 100;
    next = updateAchievements({ ...next, phase: combat.monsterId === "lord-blackthorn" ? "ending" : "playing", combat: undefined, defeatedMonsters: defeated, score: next.score + reward });
    if (combat.monsterId === "lord-blackthorn") return finishBoss(next);
    next = withEvent(next, "combat", `${monster.name} is defeated. +${reward} MONSTER DEFEAT`, reward);
    if (monsterIdNeedsFear(combat.monsterId)) next = addFear(next, 1, "The last of the creature's terror clings to you.");
    return maybeWhisper(next);
  }

  if (enemyHits && !dodge && next.phase !== "dead") {
    const damage = 2 + (monster.id === "shadow-hound" && Math.random() < 0.28 ? 2 : 0);
    next = enemyHit(next, damage, monster.id, nextCombat);
    nextCombat = next.combat ?? nextCombat;
    if (monster.id === "butler" && Math.random() < 0.24 && next.phase === "combat") {
      nextCombat.log = [...nextCombat.log, "The Butler's confusion turns the next strike into a question."];
    }
    if (monster.id === "bat-swarm" && Math.random() < 0.3 && next.phase === "combat") {
      next = enemyHit(next, 1, monster.id, nextCombat);
      nextCombat = next.combat ?? nextCombat;
    }
  } else if (playerHits && next.phase !== "dead") {
    next = { ...next, combat: nextCombat, lastEvent: { type: "damage", message: attackMessage || "Your strike lands.", amount: 2 + damageBonus, target: "enemy" } };
    return next;
  }
  if (next.phase === "dead") return next;
  next = { ...next, combat: nextCombat };
  return maybeWhisper(next);
}

function monsterIdNeedsFear(id: string) {
  return id === "hanging-lady";
}

export function testLuck(state: GameState): GameState {
  if (state.phase !== "playing") return withEvent(state, "story", "Fortune moves unseen between combat exchanges.");
  const candidates = availableLuckEvents(state.roomId, state.luckEventsSeen ?? [], state.inventory, state.clues);
  const event = state.pendingLuck
    ? LUCK_ENCOUNTERS.find(entry => entry.id === state.pendingLuck?.id && entry.room === state.roomId)
    : candidates[Math.floor(Math.random() * candidates.length)];
  if (!event || (state.luckEventsSeen ?? []).includes(event.id)) return withEvent(state, "story", "Nothing here tempts fate again. The Manor keeps its remaining secrets.");
  const success = rollTwo() <= Math.max(2, state.luck - Math.floor(state.fear / 3));
  let next: GameState = { ...state, pendingLuck: undefined, luck: Math.max(0, state.luck - 1),
    luckEventsSeen: [...(state.luckEventsSeen ?? []), event.id],
    lastLuck: { id: event.id, at: Date.now(), success, message: `${success ? "LUCK IS ON YOUR SIDE" : "MISFORTUNE FOLLOWS YOU"} — ${event.story} ${success ? event.success : event.failure}` } };
  if (success) {
    next.luckSuccesses += 1;
    next.score += 25 + (event.secret ? 1 : 0);
    if (event.item && !next.inventory.includes(event.item)) {
      next.inventory = [...next.inventory, event.item];
      next.itemCharges = { ...next.itemCharges, [event.item]: event.item === "matchbox" ? 7 : event.item.endsWith("-potion") ? 1 : next.itemCharges[event.item] ?? 1 };
      next.score += 100;
    }
    if (event.clue) next.clues = [...new Set([...next.clues, event.clue])];
    return updateAchievements(withEvent(next, "luck", `${next.lastLuck!.message}${event.secret ? " +1 HOUSE SCORE" : ""}. +25 LUCK`, 25 + (event.secret ? 1 : 0)));
  }
  const damage = (event.damage ?? 0) + (state.fear >= 7 && event.damage ? 1 : 0);
  next.stamina = Math.max(0, next.stamina - damage);
  const cause = `${next.lastLuck!.message}${damage ? ` −${damage} STAMINA.` : ""}`;
  if (event.fear) next = addFear(next, event.fear + (state.fear >= 7 ? 1 : 0), cause);
  else next = withEvent(next, "misfortune", cause);
  if (next.stamina <= 0 && next.phase !== "dead") next = { ...next, phase: "dead", combat: undefined, deathWhisper: "The storm remembers.", lastEvent: { type: "death", message: cause } };
  return next;
}

export function queueLuckEncounter(state: GameState): GameState {
  if (state.pendingLuck || state.pendingDiscovery) return state;
  const candidates = availableLuckEvents(state.roomId, state.luckEventsSeen ?? [], state.inventory, state.clues);
  const event = candidates[Math.floor(Math.random() * candidates.length)];
  return event ? { ...state, pendingLuck: { id: event.id, title: event.title, story: event.story } } : state;
}

const POTIONS: Record<string, { name: string; description: string }> = {
  "clear-potion": { name: "Holy Water", description: "Reduces Fear by 1. Lord Blackthorn recoils from it while you carry the Dagger." },
  "blue-potion": { name: "Blessed Elixir", description: "Increases Skill by 1." },
  "green-potion": { name: "Alchemy Potion", description: "Restores 1 Stamina." },
  "purple-potion": { name: "Chaos Potion", description: "Unpredictable: +2 Stamina, +2 Skill, +1 Luck, −1 Fear, or −1 Stamina, −1 Skill, −1 Luck, +1 Fear." },
};
export function getDisplayItem(state: GameState, id: string): { id: string; name: string; description: string } | undefined {
  const item = getItem(id);
  return item && (state.identifiedPotions ?? []).includes(id) && POTIONS[id] ? { ...item, ...POTIONS[id] } : item;
}
export function canUseCombatItem(state: GameState, id: string): boolean {
  if (!state.inventory.includes(id)) return false;
  if (POTIONS[id]) return (state.itemCharges[id] ?? 1) > 0;
  if (id === "matchbox") return state.combat?.monsterId === "bat-swarm" && (state.itemCharges[id] ?? 0) > 0;
  if (id === "family-seal-ring") return state.combat?.monsterId === "lord-blackthorn";
  return ["blackthorn-dagger", "lantern", "silver-crucifix"].includes(id) || id === "rusty-revolver" && (state.itemCharges[id] ?? 0) > 0;
}
export function usePotion(state: GameState, id: string): GameState {
  if (!POTIONS[id] || !state.inventory.includes(id) || (state.itemCharges[id] ?? 1) <= 0 || !["playing", "combat"].includes(state.phase)) return withEvent(state, "story", "The vial is empty.");
  let next: GameState = { ...state, usedItems: [...new Set([...state.usedItems, id])], itemCharges: { ...state.itemCharges, [id]: 0 },
    identifiedPotions: [...new Set([...(state.identifiedPotions ?? []), id])] };
  let effect = id === "clear-potion" ? 3 : id === "blue-potion" ? 8 : id === "green-potion" ? 9 : Math.floor(Math.random() * 8);
  if (effect === 0) next.stamina += 2;
  if (effect === 1) next.skill += 2;
  if (effect === 2) next.luck += 1;
  if (effect === 3) next.fear = Math.max(0, next.fear - 1);
  if (effect === 4) next.stamina = Math.max(0, next.stamina - 1);
  if (effect === 5) next.skill = Math.max(0, next.skill - 1);
  if (effect === 6) next.luck = Math.max(0, next.luck - 1);
  if (effect === 7) next = addFear(next, 1, "The draught tastes of a memory that is not yours.");
  if (effect === 8) next.skill += 1;
  if (effect === 9) next.stamina += 1;
  const labels = ["+2 STAMINA", "+2 SKILL", "+1 LUCK", "−1 FEAR", "−1 STAMINA", "−1 SKILL", "−1 LUCK", "+1 FEAR", "+1 SKILL", "+1 STAMINA"];
  const actualEffect = effect === 3 && state.fear === 0 ? "Fear is already quiet" : labels[effect];
  const message = `You recognise ${POTIONS[id]!.name}. ${actualEffect}.`;
  if (next.combat) {
    const damage = id === "clear-potion" && next.combat.monsterId === "lord-blackthorn" && next.inventory.includes("blackthorn-dagger") ? 1 : 0;
    next.combat = { ...next.combat, round: next.combat.round + (damage ? 1 : 0), enemyStamina: Math.max(0, next.combat.enemyStamina - damage),
      pauseReason: message, outcome: { heading: POTIONS[id]!.name.toUpperCase(), detail: message, playerDamage: Math.max(0, state.stamina - next.stamina), enemyDamage: damage },
      log: [...next.combat.log, `${message}${damage ? " The demon's blood recoils. +1 DAMAGE." : ""}`] };
  }
  if (next.stamina <= 0) return { ...next, phase: "dead", combat: undefined, deathWhisper: "The crimson eye still waits.", lastEvent: { type: "death", message } };
  return next.phase === "dead" ? next : withEvent(next, "item", message);
}

export function combatTurn(state: GameState, action: CombatAction, itemId?: string): GameState {
  const before = state.combat;
  if (!before || state.phase !== "combat") return state;
  // Start a fresh exchange record; milestones persist, pauses do not.
  let next = resolveExchange({ ...state, combat: { ...before, pauseReason: undefined, outcome: undefined } }, action, itemId);
  if (next.combat?.enemyStamina === 0) {
    if (before.monsterId === "lord-blackthorn" && before.enemyPhase === "human") next = {
      ...next, combat: { ...next.combat, enemyPhase: "demon", enemyMaxStamina: 10, enemyStamina: 10, enemySkill: getMonster(before.monsterId)!.skill + 1 } };
    else {
      next = updateAchievements({ ...next, phase: before.monsterId === "lord-blackthorn" ? "ending" : "playing", combat: undefined,
        defeatedMonsters: [...new Set([...next.defeatedMonsters, before.monsterId])], score: next.score + (before.monsterId === "lord-blackthorn" ? 0 : 100) });
      if (before.monsterId === "lord-blackthorn") next = finishBoss(next);
      else next = withEvent(next, "combat", `${getMonster(before.monsterId)?.name} is defeated. +100 MONSTER DEFEAT`);
    }
  }
  const phaseChanged = next.combat && next.combat.enemyPhase !== before.enemyPhase;
  const won = next.defeatedMonsters.includes(before.monsterId) && !state.defeatedMonsters.includes(before.monsterId);
  const endingHp = phaseChanged || won ? 0 : next.combat?.enemyStamina ?? before.enemyStamina;
  const milestones = [...(before.dialogueMilestones ?? [])];
  const lines: string[] = [];
  for (const [stage, fraction] of [["half", 0.5], ["quarter", 0.25]] as const) {
    const key = `${before.enemyPhase}:${stage}`;
    if (!won && !phaseChanged && next.phase === "combat" && endingHp > 0
      && endingHp <= (before.enemyMaxStamina ?? (before.enemyPhase === "demon" ? 10 : getMonster(before.monsterId)!.stamina)) * fraction && !milestones.includes(key)) {
      milestones.push(key); lines.push(combatDialogue(before.monsterId, before.enemyPhase, stage));
    }
  }
  if (phaseChanged) lines.push(combatDialogue(before.monsterId, "demon", "start"));
  if (won) {
    next.lastCombatDialogue = combatDialogue(before.monsterId, before.enemyPhase, "defeat");
    if (next.phase === "dead") next.lastEvent = { type: "death", message: `${next.lastEvent?.message ?? ""}\n${next.lastCombatDialogue}` };
    const encounter = state.pendingEncounter;
    if (next.phase === "playing" && encounter?.stage === "combat" && encounter.monsterId === before.monsterId) {
      next = interact({ ...next, pendingEncounter: undefined }, encounter.choiceId);
    }
  }
  if (next.combat) {
    const enemyDamage = Math.max(0, before.enemyStamina - endingHp);
    const playerDamage = Math.max(0, state.stamina - next.stamina);
    const fortunate = next.lastLuck !== state.lastLuck && next.lastLuck?.success;
    const heading = fortunate && next.lastLuck?.message.includes("DODGE") ? "LUCKY DODGE"
      : fortunate && next.lastLuck?.message.includes("STRIKE") ? "CRITICAL STRIKE"
        : enemyDamage > 0 ? "YOU WIN THE EXCHANGE" : playerDamage > 0 ? `${getMonster(before.monsterId)?.name.toUpperCase()} WINS THE EXCHANGE` : "THE EXCHANGE BREAKS";
    next.combat = { ...next.combat, dialogueMilestones: milestones,
      dialogue: lines.length ? lines.join("\n") : before.dialogue,
      pauseReason: lines.length ? "The enemy's story interrupts the battle." : next.fear > state.fear ? "The Manor has noticed your fear." : next.combat.pauseReason,
      outcome: next.combat.outcome ?? { heading, detail: next.lastEvent?.message ?? "", enemyDamage, playerDamage, critical: Boolean(fortunate), luck: fortunate ? next.lastLuck?.message : undefined },
      log: [...next.combat.log, ...lines, ...(next.combat.round > before.round && next.combat.round % 3 === 0 ? [COMBAT_ATMOSPHERE[Math.floor(Math.random() * COMBAT_ATMOSPHERE.length)]!] : [])].slice(-35) };
  }
  return next;
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    const meta = readMeta();
    localStorage.setItem(META_KEY, JSON.stringify({ achievements: [...new Set([...meta.achievements, ...state.achievements])],
      endingsUnlocked: [...new Set([...meta.endingsUnlocked, ...state.endingsUnlocked])],
      identifiedPotions: [...new Set([...meta.identifiedPotions, ...(state.identifiedPotions ?? [])])] }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || typeof parsed.username !== "string" || !roomById(parsed.roomId) || !Array.isArray(parsed.inventory)) return null;
    return migrateInvestigationJournal({
      ...parsed,
      usedItems: Array.isArray(parsed.usedItems) ? parsed.usedItems : [],
      itemCharges: { matchbox: 7, "rusty-revolver": 1, ...(parsed.itemCharges ?? {}) },
      whisperCount: Number.isFinite(parsed.whisperCount) ? parsed.whisperCount : 0,
      identifiedPotions: [...new Set([...readMeta().identifiedPotions, ...(parsed.identifiedPotions ?? [])])],
      luckEventsSeen: Array.isArray(parsed.luckEventsSeen) ? parsed.luckEventsSeen : [],
      knownLockedChoices: Array.isArray(parsed.knownLockedChoices) ? parsed.knownLockedChoices : [],
      investigationProgress: parsed.investigationProgress ?? {},
      journalEntries: parsed.journalEntries ?? {},
      combat: parsed.combat ? { ...parsed.combat, enemyMaxStamina: parsed.combat.enemyMaxStamina ?? (parsed.combat.enemyPhase === "demon" ? 10 : parsed.combat.monsterId === "lord-blackthorn" ? 6 : getMonster(parsed.combat.monsterId)?.stamina ?? parsed.combat.enemyStamina),
        dialogueMilestones: parsed.combat.dialogueMilestones ?? [], dialogue: parsed.combat.dialogue ?? combatDialogue(parsed.combat.monsterId, parsed.combat.enemyPhase, "start") } : undefined,
    });
  } catch {
    return null;
  }
}

export function getLeaderboard(): LeaderboardEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function submitScore(state: GameState, ending: Ending = state.ending ?? "bad"): LeaderboardEntry[] {
  const duration = Math.max(1, Math.floor((Date.now() - state.startedAt) / 1000));
  const entry: LeaderboardEntry = {
    username: state.username,
    score: state.score,
    ending: ending === "true" ? "True Ending" : ending === "good" ? "Escaped" : "Lost to the House",
    time: `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
    fear: state.fear,
    monstersDefeated: state.defeatedMonsters.length,
  };
  const result = [...getLeaderboard(), entry].sort((a, b) => b.score - a.score || a.fear - b.fear).slice(0, 10);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(result));
    const meta = readMeta();
    localStorage.setItem(META_KEY, JSON.stringify({
      achievements: [...new Set([...meta.achievements, ...state.achievements])],
      endingsUnlocked: [...new Set([...meta.endingsUnlocked, ...state.endingsUnlocked])],
      identifiedPotions: [...new Set([...meta.identifiedPotions, ...(state.identifiedPotions ?? [])])],
    }));
  } catch {
    // A full browser store should not prevent the current ending from appearing.
  }
  return result;
}

export function getItem(itemId: string): { id: string; name: string; description: string } | undefined {
  return itemById(itemId) ?? ITEMS.find((item) => item.id === itemId);
}

export function getMonster(monsterId: string) {
  return monsterById(monsterId);
}

export function getRandomWhisper(state: GameState) {
  return maybeWhisper(state, true).whisper;
}
