/**
 * Central registry for artwork. Missing entries intentionally use the in-game
 * gothic placeholder, so adding a new image never requires changing UI logic.
 */
export const ARTWORK = {
  rooms: {
    "front-gate": "/images/front-gate.webp",
    "entrance-hall": "/images/entrance-hall.webp",
    library: "/images/library.webp",
    "dining-room": "/images/dining-room.webp",
    kitchen: "/images/kitchen.webp",
    "servant-corridor": "/images/servant-corridor.webp",
    chapel: "/images/chapel.webp",
    "master-bedroom": "/images/master-bedroom.webp",
    nursery: "/images/nursery.webp",
    cellar: "/images/cellar.webp",
    "secret-tunnel": "/images/secret-tunnel.webp",
    "ritual-chamber": "/images/ritual-chamber.webp",
    "tower-observatory": "/images/tower-observatory.webp",
  } satisfies Record<string, string>,
  monsters: {
    butler: "/images/butler.webp",
    "shadow-hound": "/images/shadow-hound.webp",
    "bat-swarm": "/images/bat-swarm.webp",
    "hanging-lady": "/images/hanging-lady.webp",
    "lord-blackthorn": "/images/lord-blackthorn.webp",
    "lord-blackthorn-demon": "/images/lord-blackthorn-phase2.webp",
  } satisfies Record<string, string>,
  items: {
    "brass-key": "/images/brass-key.webp",
    "silver-crucifix": "/images/silver-crucifix.webp",
    lantern: "/images/lantern.webp",
    matchbox: "/images/matchbox.webp",
    "rusty-revolver": "/images/rusty-revolver.webp",
    rope: "/images/rope.webp",
    "clear-potion": "/images/clear-potion.webp",
    "purple-potion": "/images/purple-potion.webp",
    "blue-potion": "/images/blue-potion.webp",
    "green-potion": "/images/green-potion.webp",
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

// Coordinates are percentages of the full illustration, not of a cropped viewport.
// Reserved for a later exploration feature; no hotspots are active in this pass.
export interface ArtworkHotspot {
  id: string;
  choiceId: string;
  xPercent: number;
  yPercent: number;
  label: string;
}
export const ROOM_HOTSPOTS: Record<string, ArtworkHotspot[]> = {};
