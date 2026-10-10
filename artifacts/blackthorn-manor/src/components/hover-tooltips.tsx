import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** One viewport-clamped tooltip for mouse and keyboard; never intercepts input. */
export function HoverTooltips() {
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const show = (event: Event) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tooltip]') : null;
      const text = element?.dataset.tooltip;
      setTip(text && element ? { text, rect: element.getBoundingClientRect() } : null);
    };
    const hide = () => setTip(null);
    document.addEventListener('mouseover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('mouseout', hide);
    document.addEventListener('focusout', hide);
    document.addEventListener('click', hide);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('mouseover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('mouseout', hide);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('click', hide);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);
  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const above = tip.rect.top - height - 8;
    setPosition({
      left: Math.max(12, Math.min(tip.rect.left, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(above >= 12 ? above : tip.rect.bottom + 8, window.innerHeight - height - 12)),
    });
  }, [tip]);
  return tip ? createPortal(<div ref={ref} className="manor-tooltip" role="tooltip" style={position}>{tip.text}</div>, document.body) : null;
}
