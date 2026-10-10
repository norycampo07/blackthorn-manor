import { useMemo, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import type { GameState } from "../game/engine";
import { buildSurvivalRecord, renderSurvivalRecordPng } from "../game/survival-record";
import "./survival-record.css";

type Feedback = { kind: "ok" | "error"; text: string } | null;

export function SurvivalRecord({ game, compact = false }: { game: GameState; compact?: boolean }) {
  const record = useMemo(() => buildSurvivalRecord(game), [game]);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const busyRef = useRef(false);

  const share = async () => {
    if (busyRef.current) return;
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      setFeedback({ kind: "error", text: "Image copying isn't supported in this browser. Use Download Survival Record instead." });
      return;
    }
    busyRef.current = true; setBusy("share"); setFeedback(null);
    try {
      const blobPromise = renderSurvivalRecordPng(record);
      // Pass the promise directly to preserve user activation (Safari).
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      setFeedback({ kind: "ok", text: "Survival Record copied." });
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setFeedback({ kind: "error", text: denied
        ? "Clipboard permission was denied. Use Download Survival Record instead."
        : "The record could not be copied as an image here. Use Download Survival Record instead." });
    } finally { busyRef.current = false; setBusy(null); }
  };

  const download = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy("download"); setFeedback(null);
    let url: string | null = null;
    try {
      const blob = await renderSurvivalRecordPng(record);
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "blackthorn-manor-result.png";
      document.body.appendChild(a); a.click(); a.remove();
      setFeedback({ kind: "ok", text: "Survival Record downloaded" });
    } catch (err) {
      setFeedback({ kind: "error", text: err instanceof Error ? err.message : "The record could not be generated." });
    } finally {
      if (url) { const u = url; setTimeout(() => URL.revokeObjectURL(u), 1000); }
      busyRef.current = false; setBusy(null);
    }
  };

  const controls = (
    <div className="sr-controls">
      <div className="sr-buttons">
        <button type="button" className="sr-btn" onClick={share} disabled={busy !== null} aria-busy={busy === "share"} data-testid="button-share-survival-record">
          <Share2 aria-hidden /> Share Survival Record
        </button>
        <button type="button" className="sr-btn" onClick={download} disabled={busy !== null} aria-busy={busy === "download"} data-testid="button-download-survival-record">
          <Download aria-hidden /> Download Survival Record
        </button>
      </div>
      <p className={`sr-feedback${feedback?.kind === "error" ? " error" : ""}`} role="status" aria-live="polite" data-testid="status-survival-record">
        {busy ? "Inscribing the record…" : feedback?.text ?? ""}
      </p>
    </div>
  );

  if (compact) return controls;

  const rows: [string, string | number][] = [
    ["Final Score", record.finalScore],
    ["Areas Explored", record.areasExplored],
    ["Fragments Recovered", record.fragmentsRecovered],
    ["Fear Remaining", record.fearRemaining],
    ["Monsters Defeated", record.monstersDefeated],
    ["House’s Judgment", record.judgment],
  ];

  return (
    <section className={`sr-card${record.judgment === "Claimed" ? " claimed" : ""}`} aria-label="Survival Record" data-testid="card-survival-record">
      <div className="sr-kicker">SURVIVAL RECORD</div>
      <span className="sr-label" style={{ marginTop: 14 }}>PLAYER NAME</span>
      <h2 className="sr-name" data-testid="text-record-name">{record.playerName}</h2>
      <span className="sr-label">OUTCOME</span>
      <p className="sr-outcome" data-testid="text-record-outcome">{record.outcome}</p>
      <dl className="sr-rows">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd data-testid={`text-record-${k.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{v}</dd></div>
        ))}
      </dl>
      <div className="sr-ach">
        <span className="sr-label">ACHIEVEMENTS</span>
        {record.achievements.length
          ? <ul>{record.achievements.map((a) => <li key={a}>{a}</li>)}</ul>
          : <p>None claimed this night.</p>}
      </div>
      {controls}
    </section>
  );
}

export default SurvivalRecord;
