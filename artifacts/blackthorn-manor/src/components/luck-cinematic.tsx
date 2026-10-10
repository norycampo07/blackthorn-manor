import { useEffect, useRef } from 'react';
import './luck-cinematic.css';

export function LuckCinematic({ onComplete }: { onComplete: () => void }) {
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const focus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focus.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => complete.current(), 2500);
    return () => window.clearTimeout(timer);
  }, []);
  return <div ref={focus} className="fortune-cinematic" role="dialog" aria-modal="true" aria-label="Fortune turns" tabIndex={-1} onKeyDown={event => {
    if (event.key === 'Tab') event.preventDefault();
  }}>
    <span className="fortune-heading">FORTUNE TURNS</span>
    <div className="fortune-perspective" aria-hidden="true"><div className="fortune-coin">
      <div className="coin-face coin-front"><span>BLACKTHORN</span><b>B</b><small>1847</small></div>
      <div className="coin-face coin-back"><span>FORTUNA</span><b>✦</b><small>REMEMBERS</small></div>
    </div></div>
    <p>The Manor waits.</p>
  </div>;
}
