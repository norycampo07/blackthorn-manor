---
name: Combat and discovery intent
description: Preserve continuous combat, mysterious passive fortune, and earned potion knowledge.
---

Combat should progress after one Attack click, with pauses for significant dialogue, Fear, phases and item choices. Exploration Luck must follow the room's actual hazards and objects; combat fortune is passive, not a repeated Luck button.

**Why:** The user wants story-driven confrontations without repetitive clicking, and discoveries that feel grounded in the Manor rather than arbitrary rewards.

**How to apply:** Keep the existing combat balance while improving presentation. The Shadow Hound never speaks; the Bat Swarm only gradually reveals a human presence.

Potions begin unidentified by colour. Their effects and true names are learned through use, and that knowledge survives later histories.

**Why:** The user explicitly treats unidentified potions as a discovery mechanic and says identification is permanent.

**How to apply:** Do not expose an unknown potion's effect in its inventory description or tooltip; retain knowledge across loading, death and restarting.

Fast victories reveal less dialogue. Half- and quarter-health dialogue belongs only to live combat; missed lines are skipped on death or a phase ending. Defeat screens contain only the enemy's defeat narrative.

**Why:** The user wants longer encounters to reveal more story without awkwardly replaying skipped dialogue after victory.

**How to apply:** Keep dialogue thresholds separate from terminal outcomes when adding weapons, weaknesses, or boss phases.

Exploration Luck has its own coin identity: a 2.5-second coin sequence completes before any Fear candle sequence, and both finish before the Luck result appears. Narrative and stat consequences are separate.

**Why:** The user wants suspense and explicitly forbids overlapping Luck and Fear animations.

**How to apply:** Preserve sequential transitions and reward confirmation, including fatal outcomes.

Final enemy defeats need a brief atmospheric pause before the defeat narrative. A boss phase change is not a victory: preserve its transformation instead of presenting a normal defeat.

**Why:** The user wants time to register “I defeated the enemy” before seeing that it is gone.

**How to apply:** Apply defeat presentation only to completed encounters, not intermediate boss phases, and keep follow-up rewards behind the victory acknowledgment.

Persist completed outcomes before cosmetic delays; any zero-health portrait snapshot is display-only.

**Why:** Closing or refreshing during an animation must not lose earned progress or allow the final blow and its rewards to be credited twice.

**How to apply:** Save the resolved outcome and confirmation queue first, then reveal them after the animation. Never autosave the temporary combat snapshot.
