import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { GameState } from '@/game/engine';
import { hotspotAvailable, type InvestigationHotspot, type InvestigationScene } from '@/game/investigations';
import './investigation-layer.css';

export const INVESTIGATION_FADE_MS = 250;

type Props = {
  game: GameState;
  scene: InvestigationScene;
  /** Applies the hotspot and saves immediately; returns false when the save failed. */
  onInvestigate: (hotspot: InvestigationHotspot) => boolean;
  /** Called once the exit fade has fully completed. */
  onExited: () => void;
};

type Reading = { title: string; text: string; reread: boolean } | null;

export function InvestigationLayer({ game, scene, onInvestigate, onExited }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [reading, setReading] = useState<Reading>(null);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;
  const noticeTimer = useRef<number | undefined>(undefined);
  const progress = game.investigationProgress?.[scene.id] ?? [];
  const src = `${import.meta.env.BASE_URL}${scene.asset.replace(/^\//, '')}`;

  const stepBack = () => { if (!leaving) setLeaving(true); };

  useEffect(() => {
    back.current?.focus({ preventScroll: true });
    document.body.classList.add('investigation-active');
    return () => {
      document.body.classList.remove('investigation-active');
      window.clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => exitedRef.current(), INVESTIGATION_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setLeaving(true); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, []);

  const confineTab = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab' || !layer.current) return;
    const items = [...layer.current.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !layer.current.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !layer.current.contains(active))) { event.preventDefault(); first.focus(); }
  };

  const flash = (message: string) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3200);
  };

  const touch = (hotspot: InvestigationHotspot) => {
    if (leaving) return;
    const done = progress.includes(hotspot.id);
    if (!done) {
      const ok = onInvestigate(hotspot);
      setSaveError(ok ? '' : 'The house could not record this discovery. Your browser refused to keep the save file.');
    }
    if (hotspot.journal) setReading({ title: hotspot.journal.title, text: hotspot.journal.text, reread: done });
    else if (done) setReading(null);
    if (!done && hotspot.message) flash(hotspot.message);
    else if (done && !hotspot.journal) flash(hotspot.itemId ? `${hotspot.tooltip} already in your pockets.` : 'You have already examined this.');
  };

  const visible = scene.hotspots.filter(h => hotspotAvailable(game, scene, h) || progress.includes(h.id));

  return (
    <div ref={layer} className={`investigation-layer ${leaving ? 'leaving' : ''}`} role="region" aria-label={`Investigating: ${scene.actionLabel}`} onKeyDown={confineTab} data-testid={`investigation-${scene.id}`}>
      <div className="investigation-shade" aria-hidden="true" />
      <button ref={back} className="investigation-back" onClick={stepBack} data-testid="button-step-back"><ArrowLeft size={13} strokeWidth={1.5} /><span>Step Back</span></button>
      <div className="investigation-stage">
        <p className="investigation-whisper">{scene.description}</p>
        <div className="investigation-art">
          <img src={src} alt={scene.actionLabel} draggable={false} data-testid="img-investigation" />
          {visible.map(hotspot => {
            const [x, y, w, h] = hotspot.bounds;
            const done = progress.includes(hotspot.id);
            const fresh = hotspot.requires?.length && !done;
            return <button key={hotspot.id} className={`hotspot ${done ? 'examined' : ''} ${fresh ? 'emerging' : ''} ${hover === hotspot.id ? 'hovered' : ''}`}
              style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
              aria-label={`${hotspot.tooltip}${done ? ' (examined)' : ''}`}
              onMouseEnter={() => setHover(hotspot.id)} onMouseLeave={() => setHover(c => c === hotspot.id ? null : c)}
              onFocus={() => setHover(hotspot.id)} onBlur={() => setHover(c => c === hotspot.id ? null : c)}
              onClick={() => touch(hotspot)} data-testid={`hotspot-${hotspot.id}`}>
              <span className={`hotspot-tip ${y < 14 ? 'below' : ''}`} aria-hidden="true">{hotspot.tooltip}</span>
            </button>;
          })}
        </div>
        <section className={`investigation-lore ${reading ? 'open' : ''}`} aria-live="polite" data-testid="text-investigation-lore">
          {reading ? <>
            <span className="lore-kicker">{reading.reread ? 'Read once more' : 'Discovered'}</span>
            <h2>{reading.title}</h2>
            <div className="lore-text">{reading.text.split('\n').map((line, i) => line ? <p key={i}>{line}</p> : <br key={i} />)}</div>
          </> : <span className="lore-idle">Pass your eyes over the desk. Some things want to be found.</span>}
        </section>
      </div>
      <div className="investigation-notice" role="status" aria-live="assertive" data-testid="status-investigation">
        {notice && <div className="notice-card" key={notice}>{notice.split('\n').map((line, i) => i === 0 && notice.includes('\n') ? <small key={i}>{line}</small> : <b key={i}>{line}</b>)}</div>}
      </div>
      {saveError && <p className="investigation-save-error" role="alert" data-testid="status-save-error">{saveError}</p>}
    </div>
  );
}
