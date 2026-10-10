import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import './fear-cinematic.css';

interface FearCinematicProps {
  fromFear: number;
  toFear: number;
  eventId: number;
  onComplete: () => void;
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(Number.isFinite(n) ? n : 0)));
const HEIGHTS = [74, 58, 82, 50, 68, 88, 54, 77, 62, 70];
const LEANS = [-2, 1.5, -1, 2.5, -3, 1, 2, -1.5, 3, -2.5];

export function FearCinematic({ fromFear, toFear, eventId, onComplete }: FearCinematicProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;
  const from = clamp(fromFear);
  const to = Math.max(from, clamp(toFear));
  const gained = to - from;
  const litStart = 10 - from;
  const litEnd = 10 - to;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    rootRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => doneRef.current(), 1200);
    return () => {
      window.clearTimeout(timer);
      if (prev && document.contains(prev) && prev !== document.body) prev.blur();
    };
  }, [eventId]);

  const swallow = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      key={eventId}
      ref={rootRef}
      className="fc-root"
      role="alert"
      aria-label={`Fear increased by ${gained}`}
      tabIndex={-1}
      onKeyDown={swallow}
      onKeyUp={swallow}
      onClick={swallow}
      onPointerDown={swallow}
      onContextMenu={swallow}
    >
      <div className="fc-stage">
        <div className="fc-flicker" />
        <div className="fc-vignette" />
        <div className="fc-row">
          {Array.from({ length: 10 }, (_, i) => {
            const lit = i < litStart;
            const dies = lit && i >= litEnd;
            const cls = `fc-candle ${lit ? 'is-lit' : 'is-dark'} ${dies ? 'is-dying' : ''}`;
            return (
              <span
                key={i}
                className={cls}
                style={{ '--h': `${HEIGHTS[i]}px`, '--lean': `${LEANS[i]}deg`, '--i': i } as CSSProperties}
              >
                {lit && <i className="fc-flame" />}
                <u className="fc-wick" />
                <b className="fc-wax" />
                <em className="fc-smoke" />
              </span>
            );
          })}
        </div>
        <div className="fc-indicator" aria-hidden="true">
          <span>+{gained}</span>
          <small>FEAR</small>
        </div>
      </div>
    </div>
  );
}

export default FearCinematic;
