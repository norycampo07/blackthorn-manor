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
  /** Existing Discovery and House-response overlays own interaction while active. */
  blocked?: boolean;
};

type Reading = { title: string; text: string; reread: boolean } | null;

export function InvestigationLayer({ game, scene, onInvestigate, onExited, blocked = false }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [reading, setReading] = useState<Reading>(null);
  const [saveError, setSaveError] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const exitedRef = useRef(onExited);
  exitedRef.current = onExited;
  const returnFocus = useRef<HTMLElement | null>(null);
  const wasBlocked = useRef(blocked);
  const progress = game.investigationProgress?.[scene.id] ?? [];
  const src = `${import.meta.env.BASE_URL}${scene.asset.replace(/^\//, '')}`;

  const stepBack = () => { if (!leaving) setLeaving(true); };

  useEffect(() => {
    back.current?.focus({ preventScroll: true });
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('investigation-active');
    return () => {
      document.body.classList.remove('investigation-active');
      document.body.style.overflow = oldOverflow;
    };
  }, []);

  useEffect(() => {
    if (blocked) {
      if (layer.current?.contains(document.activeElement)) returnFocus.current = document.activeElement as HTMLElement;
    } else if (wasBlocked.current) {
      // Reloaded reward cards have no originating hotspot. Focus Step Back
      // after React removes inert, rather than leaving focus on BODY.
      const target = returnFocus.current?.isConnected ? returnFocus.current : back.current;
      target?.focus({ preventScroll: true });
      returnFocus.current = null;
    }
    wasBlocked.current = blocked;
  }, [blocked]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => exitedRef.current(), INVESTIGATION_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!blocked && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setLeaving(true); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [blocked]);

  const confineTab = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab' || !layer.current) return;
    const items = [...layer.current.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !layer.current.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !layer.current.contains(active))) { event.preventDefault(); first.focus(); }
  };

  const touch = (hotspot: InvestigationHotspot, launcher: HTMLElement) => {
    if (leaving || blocked) return;
    const done = progress.includes(hotspot.id);
    if (!done) {
      returnFocus.current = launcher;
      const ok = onInvestigate(hotspot);
      setSaveError(ok ? '' : 'The house could not record this discovery. Your browser refused to keep the save file.');
    }
    if (hotspot.journal?.category === 'Investigation Notes') setReading({ title: hotspot.journal.title, text: hotspot.journal.text, reread: done });
    else if (hotspot.id === 'drawer') setReading({ title: 'Partially Open Drawer', text: 'The drawer shifts beneath your fingers. Something seems unusual here.', reread: done });
    else setReading(null);
  };

  const visible = scene.hotspots.filter(h => hotspotAvailable(game, scene, h) || progress.includes(h.id));

  return (
    <div ref={layer} inert={blocked} aria-hidden={blocked ? true : undefined} className={`investigation-layer ${leaving ? 'leaving' : ''}`} role="region" aria-label={`Investigating: ${scene.actionLabel}`} onKeyDown={confineTab} data-testid={`investigation-${scene.id}`}>
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
              onClick={event => touch(hotspot, event.currentTarget)} data-testid={`hotspot-${hotspot.id}`}>
              <span className={`hotspot-tip ${y < 14 ? 'below' : ''}`} aria-hidden="true">{hotspot.tooltip}</span>
            </button>;
          })}
        </div>
        <section className={`investigation-lore ${reading ? 'open' : ''}`} tabIndex={0} aria-label="Investigation evidence" aria-live="polite" data-testid="text-investigation-lore">
          {reading ? <>
            <span className="lore-kicker">{reading.reread ? 'Read once more' : 'Discovered'}</span>
            <h2>{reading.title}</h2>
            <div className="lore-text">{reading.text.split('\n').map((line, i) => line ? <p key={i}>{line}</p> : <br key={i} />)}</div>
          </> : <span className="lore-idle">{scene.idleText ?? 'Pass your eyes over the desk. Some things want to be found.'}</span>}
        </section>
      </div>
      {saveError && <p className="investigation-save-error" role="alert" data-testid="status-save-error">{saveError}</p>}
    </div>
  );
}
