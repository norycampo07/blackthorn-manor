import { useEffect, useRef, useState } from 'react';
import { BookOpen, CircleDot, Gem, Sword } from 'lucide-react';
const RELICS = [
  { id: 'ancient-diary', name: 'Ancient Diary', Icon: BookOpen },
  { id: 'red-gem', name: 'Blackthorn Gem', Icon: Gem },
  { id: 'family-seal-ring', name: 'Family Seal Ring', Icon: CircleDot },
  { id: 'blackthorn-dagger', name: 'Ritual Dagger', Icon: Sword },
];
export function Relics({ inventory }: { inventory: string[] }) {
  const previous = useRef(new Set(inventory));
  const [lit, setLit] = useState<string[]>([]);
  useEffect(() => {
    const acquired = RELICS.filter(entry => inventory.includes(entry.id) && !previous.current.has(entry.id)).map(entry => entry.id);
    previous.current = new Set(inventory);
    if (acquired.length) setLit(current => [...new Set([...current, ...acquired])]);
  }, [inventory]);
  return <section className="relics-section"><div className="rail-heading"><span>RELICS</span><span className="tiny-rule" /></div>
    <div className="relic-icons">{RELICS.map(({ id, name, Icon }) => <span key={id} className={`relic-icon ${inventory.includes(id) ? 'owned' : ''} ${lit.includes(id) ? 'new-relic' : ''}`}
      onAnimationEnd={() => setLit(current => current.filter(entry => entry !== id))}
      title={inventory.includes(id) ? name : 'An undiscovered relic'} aria-label={inventory.includes(id) ? `${name} recovered` : 'Undiscovered relic'} tabIndex={0}><Icon size={25} aria-hidden="true" /></span>)}</div>
  </section>;
}
