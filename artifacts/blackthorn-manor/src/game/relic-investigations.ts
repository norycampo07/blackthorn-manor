import type { InvestigationScene } from "./investigations";

/** Relic paths reuse the shared layer, journal, puzzle gates, and acceptance queue. */
export const RELIC_INVESTIGATIONS: InvestigationScene[] = [
  {
    id: "nursery-wooden-horse", roomId: "nursery",
    replaceChoiceId: "nursery-horse", actionLabel: "Turn the wooden horse around",
    asset: "images/investigate-nursery-wooden-horse.png",
    description: "Lean closer to the toy that outlasted the child.",
    idleText: "Worn wood, a faded name, and the memory of small hands.",
    hotspots: [
      {
        id: "nameplate", tooltip: "The Child's Nameplate", bounds: [51, 50, 12, 6],
        journal: { title: "A Name Worn Away", category: "Investigation Notes",
          text: "The family name remains on the little brass plate. The child's name below it has been rubbed almost smooth.\n\nSomeone touched those letters long after the nursery was abandoned." },
      },
      {
        id: "saddle", tooltip: "Frayed Saddle", bounds: [42, 28, 26, 15],
        journal: { title: "The Last Small Rider", category: "Investigation Notes",
          text: "A narrow hollow in the saddle still holds the shape of its rider. Beneath a torn strap, a child's stitch keeps two layers of cloth together.\n\nThis was repaired with care, not discarded." },
      },
      {
        id: "underside", tooltip: "Inspect the Underside", bounds: [36, 63, 29, 10],
        reading: { title: "A Seam Beneath the Horse", text: "You lean the horse toward the faint window light. Beneath its belly, a seam interrupts the grain. A small wooden catch is concealed behind a hanging strap." },
      },
      {
        id: "hatch", tooltip: "Belly Hatch", bounds: [46, 56, 12, 7], requires: ["underside"],
        reading: { title: "Inside the Hollow Wood", text: "The catch yields with a child's soft click. Inside, a folded scrap of cloth conceals something warm. Its pulse is slower than your own." },
      },
      {
        id: "heart", tooltip: "Unwrap the Hidden Bundle", bounds: [49, 57, 7, 5], requires: ["hatch"],
        itemId: "red-gem", itemScore: 100, completesChoiceId: "nursery-horse",
        itemStory: "Within the cloth, a red gem beats like a tiny heart.\n\nFor a moment you remember holding it in a smaller hand. Then the memory is gone.",
      },
    ],
  },
  {
    id: "master-bedroom-wardrobe", roomId: "master-bedroom",
    replaceChoiceId: "bedroom-wardrobe", actionLabel: "Search the wardrobe",
    asset: "images/investigate-master-bedroom-wardrobe.png",
    description: "The brass key turns. The master's belongings wait where he left them.",
    idleText: "Examine the garments. A life can be hidden in what someone leaves behind.",
    hotspots: [
      {
        id: "monogram", tooltip: "Monogrammed Coat", bounds: [24, 33, 10, 9],
        journal: { title: "Initials in Gold", category: "Investigation Notes",
          text: "Gold thread forms the initials A.B. on a dark coat. The shoulders are worn; the cuffs have been repaired more than once.\n\nIts proportions seem strangely familiar." },
      },
      {
        id: "tailor", tooltip: "Tailor's Label", bounds: [83, 19, 11, 9],
        journal: { title: "A London Commission", category: "Investigation Notes",
          text: "A London tailor's label is sewn into the hanging garment bag. Beneath the maker's name, the family crest has been added by another hand.\n\nEven ordinary possessions were made to bear the house's mark." },
      },
      {
        id: "case", tooltip: "Open Velvet Case", bounds: [72, 57, 5, 5],
        journal: { title: "An Empty Place in Velvet", category: "Investigation Notes",
          text: "A small velvet case rests open among the personal effects. Its lining bears the impression of a signet.\n\nWhoever removed it chose not to take the case." },
      },
      {
        id: "pocket", tooltip: "Feel the Coat Lining", bounds: [27, 51, 10, 10],
        itemId: "family-seal-ring", itemScore: 100, completesChoiceId: "bedroom-wardrobe",
        itemStory: "A hard circle presses against your fingers inside the coat lining. You work it free: the Family Seal Ring.\n\nThe crest fits against your palm as though it has waited there before.",
      },
    ],
  },
  {
    id: "cellar-shrine", roomId: "cellar",
    replaceChoiceId: "cellar-stairs", actionLabel: "Descend into the lower dark",
    asset: "images/investigate-cellar-shrine.png",
    description: "Your lantern reveals a weapon held beneath roots and iron.",
    idleText: "The shrine does not conceal its prisoner. It withholds its release.",
    hotspots: [
      {
        id: "crest", tooltip: "Crowned Stone Relief", bounds: [34, 12, 31, 20],
        journal: { title: "The Terms of Release", category: "Investigation Notes",
          text: "Beneath the crowned crest, three lines remain legible:\n\n“Return what living blood owes the earth.\nLet iron follow root.\nTake the witness, not the crown.”\n\nThe words are an instruction, not a prayer." },
      },
      {
        id: "prisoner", tooltip: "The Bound Weapon", bounds: [47, 29, 11, 21],
        journal: { title: "A Witness Held Below", category: "Investigation Notes",
          text: "The outline of a weapon is visible through the binding roots. Iron crosses the growth rather than the weapon itself.\n\nPulling it free would tighten both restraints. It must be released, not seized." },
      },
      {
        id: "roots", tooltip: "Roots Across the Pedestal", bounds: [38, 48, 25, 16],
        journal: { title: "The Living Restraint", category: "Investigation Notes",
          text: "The roots run from the pedestal to a shallow bowl. They are brittle everywhere except where they meet its stained rim.\n\nHere the shrine is still alive. It waits for something the empty bowl once held." },
      },
      {
        id: "offering", tooltip: "The Stained Bowl", bounds: [2, 48, 19, 12],
        journal: { title: "A Debt Returned", category: "Investigation Notes",
          text: "At the bowl's rim your thumb meets a stone thorn. A single bead of blood falls into the hollow.\n\nThe roots tremble. Then they withdraw from the weapon, leaving only the iron across it.\n\nThe offering is acknowledged. Nothing more is taken." },
      },
      {
        id: "restraints", tooltip: "Iron Restraints", bounds: [25, 36, 54, 9],
        interactionRequires: ["offering"],
        blockedText: "You ease the chain, but the living roots tighten around the weapon. Forcing the iron will only bind it more firmly.\n\nThe roots must yield first. The relief above and the stained bowl may explain what they await.",
        reading: { title: "Iron Follows Root", text: "With the roots withdrawn, the iron no longer resists. You lift the chain from its groove and lower it carefully to the stone.\n\nThe weapon is no longer bound." },
      },
      {
        id: "blade", tooltip: "Lift the Released Weapon", bounds: [48, 33, 9, 17], requires: ["restraints"],
        itemId: "blackthorn-dagger", itemScore: 150, completesChoiceId: "cellar-stairs",
        itemStory: "Freed of roots and iron, the weapon reveals a silvered blade: the Blackthorn Dagger.\n\nThe lantern flame steadies as you take it. What was held below the house may finally be carried against its master.",
      },
      {
        id: "stone", tooltip: "Fallen Symbol Stone", bounds: [71, 70, 18, 15],
        clueId: "oath-under-stone",
        journal: { title: "Oath Under Stone", category: "Family Fragments",
          text: "On the reverse of the fallen stone, a different hand has cut a final line:\n\n“We bound the witness that no heir might raise it. May those who judge us never learn what we spared.”\n\nBelow it, the names have been chipped away." },
      },
    ],
  },
];
