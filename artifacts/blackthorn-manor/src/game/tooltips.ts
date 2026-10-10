export const TOOLTIPS = {
  rooms: "Search for unexplored parts of the Manor.",
  listen: "Listen carefully. Not every sound belongs to the living. May reveal clues.",
  testLuck: "Trust fate. Luck can reveal secrets, avoid danger, and influence critical moments.",
  stamina: "Your endurance. If it reaches zero, your journey ends.",
  skill: "Determines your effectiveness in combat and difficult challenges.",
  luck: "Fortune favors some explorers. Influences discoveries, hidden secrets, hazards, and critical combat moments.",
  score: "Measures your progress toward uncovering the Manor's secrets.",
  fear: "The deeper your fear, the more the Manor notices you.",
};
export const tooltip = (text: string) => ({ "data-tooltip": text, "aria-description": text });
