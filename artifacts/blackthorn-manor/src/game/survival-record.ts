import type { GameState } from "./engine";
import { LUCK_ENCOUNTERS } from "./luck-events";

export type SurvivalRecordData = {
  playerName: string;
  outcome: string;
  finalScore: number;
  areasExplored: number;
  fragmentsRecovered: number;
  fearRemaining: number;
  monstersDefeated: number;
  judgment: "Worthy" | "Survivor" | "Claimed";
  achievements: string[];
};

const titleCase = (id: string) =>
  id.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ").replace("Fortunes", "Fortune's");

export function deathCause(game: GameState): string {
  if (game.fear >= 10) return "The Terror Becomes Unbearable";
  let msg = (game.lastEvent?.type === "death" ? game.lastEvent.message : "") || "The house closes around you.";
  // A fatal Luck encounter reports its cause, not its roll banner or stat deltas.
  const encounter = LUCK_ENCOUNTERS.find(entry => entry.id === game.lastLuck?.id);
  if (encounter && game.lastLuck && !game.lastLuck.success && msg.includes(game.lastLuck.message)) return encounter.failure;
  // Combat may append unquoted final words on another line; those aren't the cause.
  msg = msg.split(/\r?\n/)[0];
  // strip appended NPC dialogue (quoted speech / em-dash speech)
  msg = msg.replace(/\s*["“][^"”]*["”]?\s*$/, "").replace(/\s+—\s*["“].*$/, "").trim();
  return msg || "The house closes around you.";
}

export function buildSurvivalRecord(game: GameState): SurvivalRecordData {
  const dead = game.phase === "dead";
  const judgment = dead ? "Claimed" : game.ending === "true" ? "Worthy" : "Survivor";
  return {
    playerName: game.username || "Unknown Guest",
    outcome: dead ? deathCause(game) : game.ending === "true" ? "True Ending" : "Escaped",
    finalScore: game.score,
    areasExplored: new Set(game.visitedRooms).size,
    fragmentsRecovered: game.clues.length,
    fearRemaining: game.fear,
    monstersDefeated: new Set(game.defeatedMonsters).size,
    judgment,
    achievements: [...new Set(game.achievements)].map(titleCase),
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= max) { line = test; continue; }
    if (line) lines.push(line);
    line = word;
    while (ctx.measureText(line).width > max && line.length > 1) {
      let i = line.length - 1;
      while (i > 1 && ctx.measureText(line.slice(0, i)).width > max) i--;
      lines.push(line.slice(0, i));
      line = line.slice(i);
    }
  }
  if (line) lines.push(line);
  return lines;
}

const W = 900, PAD = 70, INNER = W - PAD * 2;
const SERIF = "'Cormorant Garamond', Georgia, serif";
const MONO = "'Special Elite', 'Courier New', monospace";

function layout(ctx: CanvasRenderingContext2D, r: SurvivalRecordData, draw: boolean): number {
  let y = 90;
  const text = (s: string, font: string, color: string, x: number, align: CanvasTextAlign = "left") => {
    if (!draw) return;
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
  };
  const rule = () => {
    if (draw) { ctx.fillStyle = "rgba(193,173,128,.25)"; ctx.fillRect(PAD, y, INNER, 1); }
  };
  // ornament
  if (draw) {
    ctx.strokeStyle = "#9b8054"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, y - 20, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2, y - 36); ctx.lineTo(W / 2, y - 4); ctx.moveTo(W / 2 - 10, y - 26); ctx.lineTo(W / 2 + 10, y - 26); ctx.stroke();
  }
  y += 50;
  text("BLACKTHORN MANOR  ·  SURVIVAL RECORD", `15px ${MONO}`, "#b89d69", W / 2, "center");
  y += 60;
  ctx.font = `500 54px ${SERIF}`;
  for (const l of wrap(ctx, r.playerName, INNER)) { text(l, `500 54px ${SERIF}`, "#e5d9c1", W / 2, "center"); y += 58; }
  text("OUTCOME", `13px ${MONO}`, "#95866a", W / 2, "center"); y += 40;
  ctx.font = `italic 32px ${SERIF}`;
  for (const l of wrap(ctx, r.outcome, INNER)) { text(l, `italic 32px ${SERIF}`, r.judgment === "Claimed" ? "#c58f7d" : "#d6bd83", W / 2, "center"); y += 38; }
  y += 14; rule(); y += 10;
  const rows: [string, string][] = [
    ["Final Score", String(r.finalScore)],
    ["Areas Explored", String(r.areasExplored)],
    ["Fragments Recovered", String(r.fragmentsRecovered)],
    ["Fear Remaining", String(r.fearRemaining)],
    ["Monsters Defeated", String(r.monstersDefeated)],
    ["House’s Judgment", r.judgment],
  ];
  for (const [k, v] of rows) {
    y += 42;
    text(k.toUpperCase(), `15px ${MONO}`, "#a99a7e", PAD);
    text(v, `600 28px ${SERIF}`, "#e5d9c1", W - PAD, "right");
    y += 16; rule();
  }
  y += 46;
  text("ACHIEVEMENTS", `13px ${MONO}`, "#95866a", PAD); y += 36;
  const ach = r.achievements.length ? r.achievements.join("  ·  ") : "None claimed this night";
  ctx.font = `22px ${SERIF}`;
  for (const l of wrap(ctx, ach, INNER)) { text(l, `22px ${SERIF}`, "#c8b78d", PAD); y += 30; }
  y += 30;
  text("The house remembers every guest.", `italic 18px ${SERIF}`, "#7d7262", W / 2, "center");
  return y + 50;
}

export async function renderSurvivalRecordPng(r: SurvivalRecordData): Promise<Blob> {
  try { await document.fonts?.ready; } catch { /* ignore */ }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  const H = layout(ctx, r, false);
  canvas.width = W; canvas.height = H;
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 40, W / 2, H / 2, H);
  g.addColorStop(0, r.judgment === "Claimed" ? "#382521" : "#302b22");
  g.addColorStop(0.7, "#181613"); g.addColorStop(1, "#141210");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(205,187,141,.3)"; ctx.strokeRect(20.5, 20.5, W - 41, H - 41);
  ctx.strokeStyle = "rgba(205,187,141,.13)"; ctx.strokeRect(30.5, 30.5, W - 61, H - 61);
  ctx.textBaseline = "alphabetic";
  layout(ctx, r, true);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Image could not be generated."))), "image/png"));
}
