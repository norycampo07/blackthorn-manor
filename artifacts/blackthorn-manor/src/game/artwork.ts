/**
 * Central registry for artwork. Missing entries intentionally use the in-game
 * gothic placeholder, so adding a new image never requires changing UI logic.
 */
export const ARTWORK = {
  rooms: {
    "front-gate": "/images/front-gate.jpg",
    "entrance-hall": "/images/entrance-hall.webp",
    library: "/images/library.webp",
    "dining-room": "/images/dining-room.webp",
    kitchen: "/images/kitchen.jpg",
    "servant-corridor": "/images/servant-corridor.jpg",
    chapel: "/images/chapel.jpg",
    "master-bedroom": "/images/master-bedroom.jpg",
    nursery: "/images/nursery.jpg",
    cellar: "/images/cellar.webp",
    "secret-tunnel": "/images/secret-tunnel.jpg",
    "ritual-chamber": "/images/ritual-chamber.jpg",
    "tower-observatory": "/images/tower-observatory.jpg",
  } satisfies Record<string, string>,
  monsters: {
    butler: "/images/butler.webp",
    "shadow-hound": "/images/shadow-hound.webp",
    "bat-swarm": "/images/bat-swarm.jpg",
    "hanging-lady": "/images/hanging-lady.webp",
    "lord-blackthorn": "/images/lord-blackthorn.webp",
    "lord-blackthorn-demon": "/images/lord-blackthorn-phase2.webp",
  } satisfies Record<string, string>,
  items: {
    "ancient-diary": "/images/ancient-diary.webp",
    "blackthorn-dagger": "/images/blackthorn-dagger.webp",
    "family-seal-ring": "/images/family-seal-ring.webp",
    "red-gem": "/images/red-gem.webp",
  } satisfies Record<string, string>,
  endings: {
    true: "/images/true-ending.webp",
  } satisfies Record<string, string>,
  events: {
    "blackthorn-transformation": "/images/lord-blackthorn-phase2.webp",
  } satisfies Record<string, string>,
} as const;

export const artForRoom = (id: string) => ARTWORK.rooms[id as keyof typeof ARTWORK.rooms];
export const artForMonster = (id: string, demonPhase = false) =>
  demonPhase && id === "lord-blackthorn"
    ? ARTWORK.monsters["lord-blackthorn-demon"]
    : ARTWORK.monsters[id as keyof typeof ARTWORK.monsters];
export const artForItem = (id: string) => ARTWORK.items[id as keyof typeof ARTWORK.items];
export const artForEnding = (id: string) => ARTWORK.endings[id as keyof typeof ARTWORK.endings];
