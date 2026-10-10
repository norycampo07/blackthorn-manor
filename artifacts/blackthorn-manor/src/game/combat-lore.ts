export type DialogueStage = "start" | "half" | "quarter" | "defeat";
const LINES: Record<string, Record<DialogueStage, string>> = {
  butler: { start: "You should have left when the gate was still open.", half: "You have persisted longer than most.", quarter: "The Master must not wake.", defeat: "I have failed this house." },
  "hanging-lady": { start: "You should not remember me.", half: "I tried to leave.", quarter: "Do not trust the Manor.", defeat: "Thank... you." },
  "shadow-hound": { start: "A low growl emerges from the darkness.", half: "The creature circles beyond the lantern light.", quarter: "The Hound snaps at your throat.", defeat: "The beast retreats a step. The darkness behind it does not." },
  "bat-swarm": { start: "Hundreds of wings erupt from the darkness.", half: "The swarm briefly forms an unnatural shape.", quarter: "A voice seems to whisper through the wings.", defeat: "The swarm collapses. For a brief moment, a human silhouette appears. Then vanishes." },
  "lord-blackthorn": { start: "You came much farther than I expected.", half: "So. You found the fragments.", quarter: "You still do not understand what I sacrificed.", defeat: "The human shape breaks open." },
  demon: { start: "You would destroy everything to save yourself.", half: "The Manor lives because of me.", quarter: "No. You cannot leave me here.", defeat: "The house remembers." },
};
export const combatDialogue = (id: string, phase: string, stage: DialogueStage) => LINES[id === "lord-blackthorn" && phase === "demon" ? "demon" : id]?.[stage] ?? "";
export const defeatNarrative = (id: string) => ({
  butler: 'The Butler lowers his head.\n\nHis loyalty remains unshaken, even in defeat.\n\n“I have failed this house.”',
  'hanging-lady': 'The rope loosens.\n\nThe Lady’s distorted form flickers and grows still.\n\n“Thank... you.”',
  'shadow-hound': 'The beast recoils into the darkness.\n\nIts shape collapses into shadow and smoke.\n\nThe darkness remains.',
  'bat-swarm': 'The swarm scatters.\n\nFor a brief moment, the wings form a human silhouette.\n\nThen it is gone.',
  'lord-blackthorn': 'The Ritual Chamber falls silent.\n\nLord Blackthorn looks beyond you,\ntoward the Manor itself.\n\n“The house remembers.”',
}[id] ?? 'The room falls silent.');
export function weaknessBonus(monster: string, item: string) {
  const weaknesses: Record<string, string[]> = {
    "shadow-hound": ["lantern"], "bat-swarm": ["lantern", "matchbox"],
    "hanging-lady": ["silver-crucifix"], butler: ["rusty-revolver"],
    "lord-blackthorn": ["clear-potion", "silver-crucifix", "family-seal-ring"],
  };
  return weaknesses[monster]?.includes(item) ? 1 : 0;
}
export const COMBAT_ATMOSPHERE = [
  "The candle flame bends against a wind that should not exist.",
  "The darkness shifts.", "The Manor listens.", "A floorboard answers your step a moment too late.",
];
