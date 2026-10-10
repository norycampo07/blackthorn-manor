import { useEffect, useRef } from 'react';
import './fear-cinematic.css';

interface FearCinematicProps {
  fromFear: number;
  toFear: number;
  eventId: number;
  onComplete: () => void;
}

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(Number.isFinite(n) ? n : 0)));
const TOTAL = 2500;

export function FearCinematic({ fromFear, toFear, eventId, onComplete }: FearCinematicProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;
  const from = clamp(fromFear);
  const gained = Math.max(0, clamp(toFear) - from);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    rootRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => doneRef.current(), TOTAL);
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
      <div className="fc-dim" />
      <div className="fc-vignette" />
      <div className="fc-candle" aria-hidden="true">
        <div className="fc-glow" />
        <div className="fc-flame"><i /></div>
        <div className="fc-ember" />
        <div className="fc-wick" />
        <div className="fc-wax"><span className="drip d1" /><span className="drip d2" /></div>
        <div className="fc-dish" />
        <div className="fc-smoke"><i /><i /><i /></div>
      </div>
      <div className="fc-number" data-testid="text-fear-gain">+{gained} <small>FEAR</small></div>
    </div>
  );
}
