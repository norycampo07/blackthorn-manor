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

export type GamePhase = "playing" | "combat" | "dead" | "ending";
export type Ending = "bad" | "good" | "true";
export type CombatAction = "attack" | "luck" | "item" | "flee";

export type Combat = {
  monsterId: string;
  enemyStamina: number;
  enemySkill: number;
  enemyPhase: "human" | "demon";
  log: string[];
  luckyEdge: boolean;
  round: number;
  lastPlayerRoll?: number;
  lastEnemyRoll?: number;
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

function readMeta(): { achievements: string[]; endingsUnlocked: Ending[] } {
  try {
    const value = JSON.parse(localStorage.getItem(META_KEY) || "{}") as { achievements?: string[]; endingsUnlocked?: Ending[] };
    return {
      achievements: Array.isArray(value.achievements) ? value.achievements : [],
      endingsUnlocked: Array.isArray(value.endingsUnlocked) ? value.endingsUnlocked : [],
    };
  } catch {
    return { achievements: [], endingsUnlocked: [] };
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
  if (Math.random() < 0.14 && next.phase === "playing") next = testLuck(next);
  return maybeWhisper(next);
}

const choiceEffects: Record<string, { item?: string; clue?: string; fear?: number; monster?: string; score?: number; stamina?: number; unlock?: string; text: string }> = {
  "gate-footprints": { clue: "returning-footprints", fear: 1, text: "The departing tracks end at the gate. The approaching ones are yours." },
  "hall-portraits": { clue: "blackthorn-portrait", text: "The signet crest matches the shape of a scar in your palm." },
  "hall-drawer": { item: "matchbox", text: "You find a matchbox wrapped in a child's drawing." },
  "library-diary": { item: "ancient-diary", text: "The diary opens to a page written in your own hand." },
  "library-wall": { clue: "hollow-library-wall", unlock: "secret-tunnel", text: "Behind the atlas, a narrow seam runs down the wall. The masonry gives way." },
  "library-ledger": { clue: "family-ledger", text: "The ledger records a child born under a dead star—and no burial." },
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
  "tunnel-crack": { clue: "narrow-way", text: "The passage opens into a chamber that has no door above." },
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

export function interact(state: GameState, choiceId: string): GameState {
  if (state.phase !== "playing") return state;
  const room = roomById(state.roomId);
  const choice = room?.choices.find((entry) => entry.id === choiceId);
  if (!choice) return withEvent(state, "story", "The house does not answer that gesture.");
  const effect = choiceEffects[choiceId];
  if (!effect) return withEvent(state, "story", choice.description);
  const hasRequiredItem = choice.requires
    ? state.inventory.includes(choice.requires) && (choice.requires !== "matchbox" || (state.itemCharges.matchbox ?? 0) > 0)
    : true;
  if (!hasRequiredItem) {
    return withEvent(state, "story", `Something is missing. You need the ${itemById(choice.requires)?.name ?? choice.requires}.`);
  }
  if (state.discoveries.includes(choiceId)) {
    return withEvent(state, "story", "There is nothing more here. The house has already shown you this.");
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
  if (effect.stamina) next = { ...next, stamina: Math.min(25, next.stamina + effect.stamina) };
  if (effect.fear) next = addFear(next, effect.fear, effect.text);
  if (effect.monster && next.phase !== "dead") next = startCombat(next, effect.monster);
  next = updateAchievements(next);
  if (Math.random() < 0.08 && next.phase === "playing") next = testLuck(next);
  return maybeWhisper(next);
}

export function startCombat(state: GameState, monsterId: string): GameState {
  const monster = monsterById(monsterId);
  if (!monster || state.phase === "dead" || state.phase === "ending") return state;
  const boss = monsterId === "lord-blackthorn";
  const combat: Combat = {
    monsterId,
    enemyStamina: boss ? 6 : monster.stamina,
    enemySkill: monster.skill,
    enemyPhase: "human",
    log: [`${monster.name} blocks your way. ${monster.description}`],
    luckyEdge: false,
    round: 0,
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

export function combatTurn(state: GameState, action: CombatAction, itemId?: string): GameState {
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
  let nextCombat = { ...combat, round: combat.round + 1 };
  let next = state;
  let damageBonus = 0;
  let playerHits = false;
  let enemyHits = false;
  let playerRoll = state.skill + rollTwo();
  const enemyRoll = nextCombat.enemySkill + rollTwo();
  let attackMessage = "";
  if (monster.id === "butler" && action === "attack" && Math.random() < 0.22) {
    playerRoll -= 3;
    nextCombat.log = [...nextCombat.log, "The Butler's confusion makes the room turn around you."];
  }
  nextCombat = {
    ...nextCombat,
    lastPlayerRoll: playerRoll,
    lastEnemyRoll: enemyRoll,
    luckyEdge: playerRoll < enemyRoll ? combat.luckyEdge : false,
  };

  if (action === "item") {
    if (!itemId || !state.inventory.includes(itemId)) return withEvent(state, "story", "You do not have that item.");
    const validWeapons = ["blackthorn-dagger", "rusty-revolver", "lantern", "silver-crucifix"];
    if (!validWeapons.includes(itemId)) return withEvent(state, "story", "That item cannot harm this creature.");
    if (itemId === "rusty-revolver" && (state.itemCharges["rusty-revolver"] ?? 0) <= 0) {
      return withEvent(state, "combat", "The revolver clicks. Its single round is gone.");
    }
    const canHarmBoss = itemId === "blackthorn-dagger";
    if (combat.monsterId === "lord-blackthorn" && !canHarmBoss) {
      return withEvent(state, "combat", "The weapon passes through Lord Blackthorn. Only the Blackthorn Dagger can wound him.");
    }
    next = {
      ...state,
      usedItems: [...new Set([...state.usedItems, itemId])],
      itemCharges: itemId === "rusty-revolver"
        ? { ...state.itemCharges, "rusty-revolver": Math.max(0, state.itemCharges["rusty-revolver"] - 1) }
        : state.itemCharges,
    };
    if (itemId === "rusty-revolver") next.usedItems = [...new Set([...next.usedItems, itemId])];
    damageBonus = itemId === "blackthorn-dagger" ? 3 : itemId === "rusty-revolver" ? 4 : 2;
    attackMessage = itemId === "blackthorn-dagger" ? "A silver slash throws sparks through the dark." :
      itemId === "rusty-revolver" ? "The revolver cracks. White flash, black smoke." :
        itemId === "lantern" ? "Holy fire bursts from the lantern." : "White light pours from the crucifix.";
    playerRoll += 4;
  }

  if (playerRoll >= enemyRoll) {
    playerHits = true;
    const damage = 2 + damageBonus + (combat.luckyEdge ? 2 : 0);
    nextCombat.enemyStamina = Math.max(0, nextCombat.enemyStamina - damage);
    nextCombat.log = [...nextCombat.log, `${attackMessage ? `${attackMessage} ` : ""}You roll ${playerRoll} against ${enemyRoll} and deal ${damage} damage.`];
    next = { ...next, score: next.score + (combat.luckyEdge ? 0 : 0) };
  } else {
    enemyHits = true;
    nextCombat.log = [...nextCombat.log, `You roll ${playerRoll}; ${monster.name} rolls ${enemyRoll} and wins the exchange.`];
  }

  if (nextCombat.enemyStamina <= 0 && combat.monsterId === "lord-blackthorn" && nextCombat.enemyPhase === "human") {
    nextCombat.enemyPhase = "demon";
    nextCombat.enemySkill = monster.skill + 1;
    nextCombat.enemyStamina = 10;
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

  if (enemyHits && next.phase !== "dead") {
    const damage = 2 + (monster.id === "shadow-hound" && Math.random() < 0.28 ? 2 : 0);
    next = enemyHit(next, damage, monster.id, nextCombat);
    if (monster.id === "butler" && Math.random() < 0.24 && next.phase === "combat") {
      nextCombat.log = [...nextCombat.log, "The Butler's confusion turns the next strike into a question."];
    }
    if (monster.id === "bat-swarm" && Math.random() < 0.3 && next.phase === "combat") {
      next = enemyHit(next, 1, monster.id, nextCombat);
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
  if (state.phase !== "playing" && state.phase !== "combat") return state;
  const success = rollTwo() <= state.luck;
  if (success) {
    const successCount = state.luckSuccesses + 1;
    let next: GameState = {
      ...state,
      luck: Math.min(10, Math.max(0, state.luck - 1) + (successCount % 3 === 0 ? 1 : 0)),
      luckSuccesses: successCount,
      score: state.score + 25,
      lastEvent: { type: "luck", message: `LUCK IS ON YOUR SIDE${successCount % 3 === 0 ? " — fortune turns back toward you" : ""}. A golden glimmer turns the moment in your favor.`, amount: 25 },
    };
    if (state.phase === "combat" && state.combat) {
      next = { ...next, combat: { ...state.combat, luckyEdge: true, log: [...state.combat.log, "A golden glimmer turns the next exchange in your favor."] } };
    } else {
      const reward = Math.floor(Math.random() * 5);
      if (reward === 0) {
        next = { ...next, stamina: Math.min(25, next.stamina + 2), lastEvent: { type: "luck", message: "LUCK IS ON YOUR SIDE — a hidden spring restores your strength. +2 STAMINA", amount: 25 } };
      } else if (reward === 1) {
        const clue = state.roomId === "tower-observatory" ? "star-door" : state.roomId === "library" ? "hollow-library-wall" : "lucky-hidden-writing";
        next = { ...next, clues: [...new Set([...next.clues, clue])], lastEvent: { type: "luck", message: "LUCK IS ON YOUR SIDE — a hidden clue catches the candlelight.", amount: 25 } };
      } else if (reward === 2 && next.fear > 0) {
        next = { ...next, fear: next.fear - 1, lastEvent: { type: "luck", message: "LUCK IS ON YOUR SIDE — the fear passes without taking hold. −1 FEAR", amount: 25 } };
      } else if (reward === 3) {
        next = { ...next, luckWard: true, lastEvent: { type: "luck", message: "LUCK IS ON YOUR SIDE — a quiet calm waits to meet the next fear.", amount: 25 } };
      } else {
        const bonusItem = !next.inventory.includes("matchbox") ? "matchbox" : !next.inventory.includes("rope") ? "rope" : undefined;
        if (bonusItem) {
          next = {
            ...next,
            inventory: [...next.inventory, bonusItem],
            itemCharges: bonusItem === "matchbox" ? { ...next.itemCharges, matchbox: 7 } : next.itemCharges,
            score: next.score + 100,
            lastEvent: { type: "luck", message: `LUCK IS ON YOUR SIDE — you find the ${itemById(bonusItem)?.name}.`, amount: 125 },
          };
        } else {
          const pathClue = state.roomId === "tower-observatory" ? "star-door" : "hollow-library-wall";
          next = { ...next, clues: [...new Set([...next.clues, pathClue])], lastEvent: { type: "luck", message: "LUCK IS ON YOUR SIDE — a hidden passage reveals itself in the walls.", amount: 25 } };
        }
      }
    }
    next = updateAchievements(next);
    return next;
  }
  let next: GameState = { ...state, luck: Math.max(0, state.luck - 1), lastEvent: { type: "misfortune", message: "MISFORTUNE FOLLOWS YOU" } };
  if (state.phase === "combat" && state.combat) {
    next = enemyHit(next, 2, state.combat.monsterId, state.combat);
    return next.phase === "dead" ? next : { ...next, lastEvent: { type: "misfortune", message: "MISFORTUNE FOLLOWS YOU. The enemy takes advantage." } };
  }
  const penalty = Math.random();
  if (penalty < 0.45) return addFear(next, 1, "Misfortune finds a way into your thoughts.");
  if (penalty < 0.8) {
    next = { ...next, stamina: Math.max(1, next.stamina - 2) };
    return withEvent(next, "misfortune", "MISFORTUNE FOLLOWS YOU. Something cuts you in the dark.");
  }
  return withEvent(next, "misfortune", "MISFORTUNE FOLLOWS YOU. The house closes a door you had not yet found.");
}

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
    return {
      ...parsed,
      usedItems: Array.isArray(parsed.usedItems) ? parsed.usedItems : [],
      itemCharges: { matchbox: 7, "rusty-revolver": 1, ...(parsed.itemCharges ?? {}) },
      whisperCount: Number.isFinite(parsed.whisperCount) ? parsed.whisperCount : 0,
    };
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
    }));
  } catch {
    // A full browser store should not prevent the current ending from appearing.
  }
  return result;
}

export function getItem(itemId: string) {
  return itemById(itemId) ?? ITEMS.find((item) => item.id === itemId);
}

export function getMonster(monsterId: string) {
  return monsterById(monsterId);
}

export function getRandomWhisper(state: GameState) {
  return maybeWhisper(state, true).whisper;
}
