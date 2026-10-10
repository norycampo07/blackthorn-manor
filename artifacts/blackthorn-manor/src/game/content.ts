export type StoryChoice = {
  id: string;
  label: string;
  description: string;
  requires?: string;
  once?: boolean;
};

export type Room = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  atmosphere: string;
  exits: string[];
  choices: StoryChoice[];
};

export type Monster = {
  id: string;
  name: string;
  skill: number;
  stamina: number;
  description: string;
  fearAttack: number;
  special: string;
};

export const ITEMS = [
  { id: "brass-key", name: "Brass Key", description: "Warm to the touch, though it has lain in the dark." },
  { id: "silver-crucifix", name: "Silver Crucifix", description: "The figure upon it has no face." },
  { id: "lantern", name: "Lantern", description: "A greenish flame burns without oil." },
  { id: "matchbox", name: "Matchbox", description: "Seven dry matches remain." },
  { id: "ancient-diary", name: "Ancient Diary", description: "The leather cover bears your initials." },
  { id: "rusty-revolver", name: "Rusty Revolver", description: "One chamber is loaded. The others are sealed with rust." },
  { id: "rope", name: "Rope", description: "A length of hemp, frayed but strong." },
  { id: "red-gem", name: "Red Gem", description: "A dark red stone pulses faintly in your palm." },
  { id: "family-seal-ring", name: "Family Seal Ring", description: "Blackthorn's thorned crest is engraved within." },
  { id: "blackthorn-dagger", name: "Blackthorn Dagger", description: "The silvered blade remembers every name it has taken." },
  { id: "clear-potion", name: "Clear Potion", description: "A colourless liquid. Its purpose is unknown." },
  { id: "blue-potion", name: "Blue Potion", description: "Blue sediment turns slowly inside the sealed glass. Unidentified." },
  { id: "green-potion", name: "Green Potion", description: "An unfamiliar green draught. Its effect is unknown." },
  { id: "purple-potion", name: "Purple Potion", description: "The purple liquid moves against gravity. Unidentified." },
] as const;

export const ITEM_LOCK_MESSAGES: Record<string, string> = {
  "brass-key": "The lock refuses to yield.\n\nA small key could still persuade it to reveal its secret.",
  rope: "The distance is greater than it first appeared.\n\nWithout something to secure your descent, the risk is too great.",
  matchbox: "Darkness gathers beyond this point.\n\nA little light might reveal what the shadows are hiding.",
  lantern: "The darkness ahead feels unnatural.\n\nOrdinary courage may not be enough to continue.",
  "silver-crucifix": "Something here recoils from faith.\n\nYou feel unprepared to proceed.",
  "rusty-revolver": "A dangerous presence lingers nearby.\n\nEntering unarmed would be unwise.",
  "blackthorn-dagger": "The House remains silent.\n\nWhatever waits beyond can only be faced with the sleeping blade.",
  "red-gem": "The chamber will not respond.\n\nSomething is still missing from the ritual.",
  "family-seal-ring": "The Manor hesitates.\n\nSome places remember a name that has not yet been claimed.",
  "ancient-diary": "The clues are incomplete.\n\nPerhaps the past has recorded the answer elsewhere.",
};

export const ROOMS: Room[] = [
  {
    id: "front-gate", title: "Front Gate", subtitle: "Where the storm let you in",
    description: "Rain lashes the ironwork hard enough to sound like fingernails. Beyond the gate, Blackthorn Manor watches from its hilltop, every dark window reflecting a different flash of lightning.\n\nThe gate swings shut behind you without a hand upon it. In the mud, a second set of footprints already leads toward the house.",
    atmosphere: "Storm / Arrival", exits: ["entrance-hall"],
    choices: [{ id: "gate-footprints", label: "Study the footprints", description: "They are the same size as yours. One set approaches the house; the other leaves it." }],
  },
  {
    id: "entrance-hall", title: "Entrance Hall", subtitle: "A house with its eyes open",
    description: "A chandelier hangs above a black-and-white marble floor. Every candle is lit, though no flame bends in the draft. Portraits climb the walls: generations of Blackthorns, their painted eyes turned toward the door.\n\nThe newest portrait has a fresh strip of canvas where its face should be. Somewhere overhead, a child laughs once.",
    atmosphere: "Candlelit / Watched", exits: ["front-gate", "library", "dining-room", "servant-corridor"],
    choices: [
      { id: "hall-portraits", label: "Look closely at the portraits", description: "One painted hand wears a familiar signet ring." },
      { id: "hall-drawer", label: "Search the reception drawer", description: "A drawer is wedged open by something small." },
    ],
  },
  {
    id: "library", title: "Library", subtitle: "The dust has been disturbed",
    description: "Books swell with damp along the curved shelves. A fire smolders without giving warmth. On the desk, a place has been cleared in the dust—as if a book were lifted only moments ago.\n\nThe shelves are arranged by family member, not by subject. Your own name is written in the empty space at the end.",
    atmosphere: "Ash / Quiet", exits: ["entrance-hall", "chapel", "master-bedroom", "secret-tunnel"],
    choices: [
      { id: "library-diary", label: "Open the desk's hidden compartment", description: "A narrow catch is concealed beneath the desk.", once: true },
      { id: "library-wall", label: "Inspect the wall behind the atlas", description: "The stone sounds hollow in one place." },
      { id: "library-ledger", label: "Read the family ledger", description: "The last page is dated tomorrow.", once: true },
    ],
  },
  {
    id: "dining-room", title: "Dining Room", subtitle: "Dinner for the absent",
    description: "A long table gleams beneath a skin of dust. Thirteen places are set. At the head sits a chair pushed back from the table, its cushion still indented.\n\nThe silverware is arranged around an untouched plate of black fruit. From beneath the table comes the patient scrape of a chair being drawn out.",
    atmosphere: "Stale / Formal", exits: ["entrance-hall", "kitchen"],
    choices: [
      { id: "dining-under", label: "Look beneath the table", description: "Something glints between the chair legs." },
      { id: "dining-plate", label: "Touch the black fruit", description: "The fruit gives a soft, wet sigh." },
      { id: "dining-seat", label: "Take the empty seat", description: "A place has been laid for you.", once: true },
    ],
  },
  {
    id: "kitchen", title: "Kitchen", subtitle: "The fire is still hungry",
    description: "Copper pans sway above a cold range. A butcher's block is scored with deep, parallel cuts. Something bubbles in a pot though the stove is dark.\n\nA row of knives is missing from the wall. In their place, someone has scratched the words: HE IS STILL AT TABLE.",
    atmosphere: "Iron / Steam", exits: ["dining-room", "servant-corridor", "cellar"],
    choices: [
      { id: "kitchen-cupboard", label: "Open the dry-goods cupboard", description: "The cupboard door has been nailed shut from the inside." },
      { id: "kitchen-range", label: "Rake through the cold range", description: "A faint orange glow answers from the ash." },
      { id: "kitchen-pot", label: "Look into the bubbling pot", description: "The surface reflects a face that is not yours." },
    ],
  },
  {
    id: "servant-corridor", title: "Servant Corridor", subtitle: "A route for those not meant to be seen",
    description: "The passage is narrow enough to brush both walls with your shoulders. Small doors line it at uneven heights. Behind one, someone is counting backward from thirteen.\n\nA dark shape moves at the far end, keeping pace with you whenever you try to follow it.",
    atmosphere: "Close / Moving", exits: ["entrance-hall", "kitchen", "nursery", "cellar"],
    choices: [
      { id: "corridor-panel", label: "Feel along the panelling", description: "One strip of wood is polished smooth by many hands." },
      { id: "corridor-door", label: "Open the smallest door", description: "The voice behind it stops counting." },
      { id: "corridor-shadow", label: "Call into the darkness", description: "Something answers with your own voice.", once: true },
    ],
  },
  {
    id: "chapel", title: "Chapel", subtitle: "The faithful buried more than their dead",
    description: "The chapel's pews face a blank stone altar. The saints in the stained glass have had their eyes carefully removed. Rain falls upward behind the windows.\n\nNames are carved into the kneelers. One is yours, cut so deeply that pale wood curls from the letters.",
    atmosphere: "Incense / Reverent", exits: ["library", "master-bedroom", "ritual-chamber"],
    choices: [
      { id: "chapel-altar", label: "Search the altar", description: "A narrow hollow lies beneath the stone lip." },
      { id: "chapel-kneel", label: "Kneel and listen", description: "The silence has a pulse.", once: true },
      { id: "chapel-wall", label: "Read the names on the wall", description: "One name has been chiseled away from the family tree." },
    ],
  },
  {
    id: "master-bedroom", title: "Master Bedroom", subtitle: "Someone has just risen",
    description: "The bed curtains stir around an empty mattress. A man's coat hangs beside the wardrobe, rain-dark at the shoulders. The mirror above the washstand shows the room as it was decades ago.\n\nIn the reflection, a figure stands behind you. The real room is empty.",
    atmosphere: "Velvet / Cold", exits: ["library", "chapel", "nursery", "tower-observatory"],
    choices: [
      { id: "bedroom-wardrobe", label: "Search the wardrobe", description: "A hidden pocket has been stitched into the lining.", requires: "brass-key" },
      { id: "bedroom-mirror", label: "Touch the mirror", description: "The glass is warm, like skin." },
      { id: "bedroom-bed", label: "Look beneath the bed", description: "Dust gathers around a long, narrow case." },
    ],
  },
  {
    id: "nursery", title: "Nursery", subtitle: "The toy was never found",
    description: "A cradle rocks in a room without wind. Painted stars cover the ceiling, though one has been scratched out. A wooden horse faces the corner, its small wheels turning by themselves.\n\nThe music box on the shelf plays a tune you know from somewhere before your first memory.",
    atmosphere: "Lullaby / Wrong", exits: ["servant-corridor", "master-bedroom", "tower-observatory"],
    choices: [
      { id: "nursery-cradle", label: "Look inside the cradle", description: "The blanket is warm." },
      { id: "nursery-music", label: "Wind the music box", description: "A tiny keyhole waits beneath the lid.", requires: "brass-key", once: true },
      { id: "nursery-horse", label: "Turn the wooden horse around", description: "Something has been hidden in its hollow body." },
    ],
  },
  {
    id: "cellar", title: "Cellar", subtitle: "Beneath stone, beneath memory",
    description: "The cellar steps descend farther than the manor is tall. Roots have broken through the walls, pale and veined. Each one points toward the same patch of earth.\n\nA lantern swings overhead, though it has no chain. The darkness below it presses close, as if listening.",
    atmosphere: "Damp / Buried", exits: ["kitchen", "servant-corridor", "secret-tunnel"],
    choices: [
      { id: "cellar-root", label: "Move the pale roots", description: "The earth beneath them has been disturbed." },
      { id: "cellar-rack", label: "Search the bottle rack", description: "One bottle is filled with a red light.", requires: "matchbox" },
      { id: "cellar-stairs", label: "Descend into the lower dark", description: "The steps continue beneath the foundations.", requires: "lantern" },
    ],
  },
  {
    id: "secret-tunnel", title: "Secret Tunnel", subtitle: "A wall need not be a wall",
    description: "A low passage runs beneath the manor. The stones are marked with small handprints, all pointing deeper in. Cold air flows from the far end, carrying the smell of wet roses.\n\nSomething has carved a map into the mortar. It shows the house from below—and a room that has no door above.",
    atmosphere: "Stone / Breath", exits: ["cellar", "ritual-chamber", "front-gate"],
    choices: [
      { id: "tunnel-map", label: "Trace the map in the mortar", description: "One passage ends beneath the chapel." },
      { id: "tunnel-crack", label: "Squeeze through the narrow crack", description: "The stones shift like ribs.", requires: "rope" },
      { id: "tunnel-listen", label: "Listen at the far wall", description: "Someone on the other side is whispering your name." },
    ],
  },
  {
    id: "ritual-chamber", title: "Ritual Chamber", subtitle: "The crimson eye still beats",
    description: "A circle has been cut into the floor, its grooves filled with dark red wax. At the center, an iron chair faces a wall of family portraits turned toward it.\n\nThe air smells of lightning and old blood. A second heartbeat answers your own from beneath the stones.",
    atmosphere: "Blood / Threshold", exits: ["chapel", "secret-tunnel", "tower-observatory"],
    choices: [
      { id: "ritual-circle", label: "Stand inside the circle", description: "The carved lines warm beneath your feet.", once: true },
      { id: "ritual-eye", label: "Set the red gem into the stone eye", description: "The carved eye has a hollow at its center.", requires: "red-gem", once: true },
      { id: "ritual-call", label: "Speak the Blackthorn name", description: "The portraits turn to face the chair.", once: true },
    ],
  },
  {
    id: "tower-observatory", title: "Tower Observatory", subtitle: "The stars saw everything",
    description: "The brass telescope points through a slit in the roof at a sky with no storm. Constellations crawl slowly into unfamiliar shapes. A chart on the floor lists the names of every Blackthorn child.\n\nThe final name has been written in fresh ink. Your hand is still wet with it.",
    atmosphere: "Starlight / Unmoored", exits: ["master-bedroom", "nursery", "ritual-chamber", "secret-tunnel"],
    choices: [
      { id: "tower-telescope", label: "Look through the telescope", description: "The stars form the outline of a hidden doorway." },
      { id: "tower-chart", label: "Read the star chart", description: "A pattern repeats every thirteen years." },
      { id: "tower-window", label: "Look down at the grounds", description: "The manor's shadow is shaped like a man.", once: true },
    ],
  },
];

export const MONSTERS: Monster[] = [
  { id: "butler", name: "The Butler", skill: 7, stamina: 8, description: "His white gloves are spotless. His face is not.", fearAttack: 1, special: "Confusion: a lost round may make you strike at a memory instead." },
  { id: "shadow-hound", name: "Shadow Hound", skill: 8, stamina: 10, description: "A dog-shaped absence with too many joints.", fearAttack: 1, special: "Fast strikes: it may attack twice after a successful pounce." },
  { id: "bat-swarm", name: "Bat Swarm", skill: 6, stamina: 9, description: "A storm of wings, each one whispering a different name.", fearAttack: 1, special: "Multiple attacks: a cloud of wings can land a second blow." },
  { id: "hanging-lady", name: "The Hanging Lady", skill: 8, stamina: 11, description: "She hangs without a rope, turning slowly toward the sound of your pulse.", fearAttack: 2, special: "Fear damage: her gaze steals courage before it touches flesh." },
  { id: "lord-blackthorn", name: "Lord Blackthorn", skill: 9, stamina: 12, description: "A pale man in an immaculate coat. His shadow wears a crown of horns.", fearAttack: 2, special: "Two phases: the human lord becomes a demon when wounded." },
];

export const WHISPERS = [
  "You are late.", "The storm remembers.", "You have walked these halls before.",
  "The toy was never found.", "The stars saw everything.", "The lock waits for its partner.",
  "A wall need not be a wall.", "The blade sleeps where prayers died.",
  "The faithful buried more than their dead.", "The crimson eye still beats.",
  "Beneath stone, beneath memory.", "Do not look behind you.",
  "It watches through borrowed eyes.", "The house is listening.",
];

export const DEATH_WHISPERS = [
  "The chapel keeps secrets.", "The stars reveal hidden paths.",
  "The crimson eye still waits.", "The blade was closer than you believed.",
];

export const roomById = (id: string) => ROOMS.find((room) => room.id === id);
export const itemById = (id: string) => ITEMS.find((item) => item.id === id);
export const monsterById = (id: string) => MONSTERS.find((monster) => monster.id === id);
